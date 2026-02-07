/**
 * ChatWindow Component
 * Handles the creation and management of the chat window UI.
 */
(function () {
    'use strict';

    // Ensure namespace exists
    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const hooks = window.PetManager.Components.ChatWindowHooks || {};

    const DEFAULT_SIDEBAR_WIDTH = 320;
    const MIN_SIDEBAR_WIDTH = 320;
    const MAX_SIDEBAR_WIDTH = 800;
    const DEFAULT_CHAT_WINDOW_WIDTH = 850;
    const DEFAULT_CHAT_WINDOW_HEIGHT = 720;
    const AUTO_SCROLL_THRESHOLD_PX = 140;

    function safeCall(fn, fallbackValue = null) {
        try {
            return fn();
        } catch (_) {
            return fallbackValue;
        }
    }

    async function safeCallAsync(fn, fallbackValue = null) {
        try {
            return await fn();
        } catch (_) {
            return fallbackValue;
        }
    }

    function getVueApi(Vue) {
        if (
            !Vue ||
            typeof Vue.createApp !== 'function' ||
            typeof Vue.defineComponent !== 'function' ||
            typeof Vue.ref !== 'function' ||
            typeof Vue.onMounted !== 'function'
        ) {
            return null;
        }
        return {
            createApp: Vue.createApp,
            defineComponent: Vue.defineComponent,
            ref: Vue.ref,
            onMounted: Vue.onMounted
        };
    }

    function canUseVueTemplate(Vue) {
        if (typeof Vue?.compile !== 'function') return false;
        return safeCall(() => {
            Function('return 1')();
            return true;
        }, false);
    }

    function getComponentModule(name) {
        return window.PetManager?.Components?.[name] || null;
    }

    async function loadTemplateIfAvailable(mod) {
        if (!mod || typeof mod.loadTemplate !== 'function') return '';
        return String((await safeCallAsync(() => mod.loadTemplate(), '')) || '');
    }

    const createStore =
        typeof hooks.createStore === 'function'
            ? hooks.createStore
            : (manager) => ({ searchValue: { value: manager?.sessionTitleFilter || '' } });

    const useComputed =
        typeof hooks.useComputed === 'function'
            ? hooks.useComputed
            : (store) => ({
                  clearVisible: {
                      get value() {
                          return !!String(store?.searchValue?.value || '').trim();
                      }
                  }
              });

    const useMethods =
        typeof hooks.useMethods === 'function'
            ? hooks.useMethods
            : function useMethods(params) {
                  const { manager, instance, store } = params;
                  let timer = null;

                  const clearSearch = () => {
                      if (store?.searchValue) store.searchValue.value = '';
                      manager.sessionTitleFilter = '';
                      if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                  };

                  const onSearchInput = (e) => {
                      const value = e?.target?.value ?? '';
                      if (store?.searchValue) store.searchValue.value = value;
                      manager.sessionTitleFilter = String(value || '').trim();
                      if (timer) clearTimeout(timer);
                      timer = setTimeout(() => {
                          if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                      }, 300);
                  };

                  const onSearchKeydown = (e) => {
                      if (e?.key === 'Escape') clearSearch();
                  };

                  const onBatchToggleClick = () => {
                      if (manager.batchMode) {
                          if (typeof manager.exitBatchMode === 'function') manager.exitBatchMode();
                      } else {
                          if (typeof manager.enterBatchMode === 'function') manager.enterBatchMode();
                      }
                  };

                  const onExportClick = () => {
                      if (typeof manager.exportSessionsToZip === 'function') manager.exportSessionsToZip();
                  };

                  const onImportClick = () => {
                      const DomHelper = window.DomHelper;
                      if (!DomHelper || typeof DomHelper.pickFile !== 'function') return;
                      DomHelper.pickFile({ accept: '.zip' })
                          .then(async (file) => {
                              if (file && typeof manager.importSessionsFromZip === 'function') {
                                  await manager.importSessionsFromZip(file);
                              }
                          })
                          .catch(() => {});
                  };

                  const onAddClick = () => {
                      if (typeof manager.createBlankSession === 'function') manager.createBlankSession();
                  };

                  const onAuthClick = (e) => {
                      e?.stopPropagation?.();
                      e?.preventDefault?.();
                      manager.openAuth();
                  };

                  const onSidebarToggleClick = (e) => {
                      e?.stopPropagation?.();
                      e?.preventDefault?.();
                      if (instance.toggleSidebar) instance.toggleSidebar();
                  };

                  return {
                      clearSearch,
                      onSearchInput,
                      onSearchKeydown,
                      onBatchToggleClick,
                      onExportClick,
                      onImportClick,
                      onAddClick,
                      onAuthClick,
                      onSidebarToggleClick
                  };
              };

    const CHAT_WINDOW_TEMPLATES_RESOURCE_PATH = 'src/features/petManager/content/components/chatWindow/ChatWindow/index.html';
    let chatWindowTemplatesCache = null;

    async function loadChatWindowTemplates() {
        if (chatWindowTemplatesCache) return chatWindowTemplatesCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') {
            chatWindowTemplatesCache = { chatWindow: '' };
            return chatWindowTemplatesCache;
        }
        const tpl = await DomHelper.loadHtmlTemplate(
            CHAT_WINDOW_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-chat-window-template',
            'Failed to load templates'
        );
        chatWindowTemplatesCache = { chatWindow: tpl };
        return chatWindowTemplatesCache;
    }

    class ChatWindow {
        constructor(manager) {
            this.manager = manager;
            this.element = null;
            this._vueApp = null;
            this._vueInstance = null;
            this._sidebarVueApp = null;
            this._sidebarVueInstance = null;
            this.header = null;
            this.sidebar = null;
            this.mainContent = null;
            this.messagesContainer = null;
            this.inputContainer = null;
            this.sessionListContainer = null;
            this.robotSettingsButton = null;
            this.requestStatusButton = null;
            this.settingsButton = null;
            this.resizeHandles = {};
            this.isResizing = false;
            this.isDragging = false;
            this._fullscreenResizeHandler = null; // 全屏模式下的 resize 事件处理器

            // UI State
            this.sidebarWidth = manager.sidebarWidth || DEFAULT_SIDEBAR_WIDTH;
            this.inputHeight = manager.inputHeight || 150;
            this._currentAbortController = null;
            this._searchTimer = null;
            this.isResizingSidebar = false;
            this._suppressDragUntil = 0;
            this._fullscreenAnimating = false;
            this._fullscreenResizeTimer = null; // 全屏 resize 防抖定时器

            // Draft Images
            this.draftImages = [];
            this.imageInput = null;
            this.draftImagesContainer = null;
            this.maxDraftImages = 4; // 最大图片数量限制
            this.updateDraftImagesDisplay = () => {
                const ChatInputModule = window.PetManager?.Components?.ChatInput;
                if (ChatInputModule && typeof ChatInputModule.updateDraftImagesDisplay === 'function') {
                    ChatInputModule.updateDraftImagesDisplay(this);
                }
            };

            // 防重复提交标志
            this.isProcessing = false;
        }

        _clampSidebarWidth(width) {
            const n = Number(width);
            if (!Number.isFinite(n)) return DEFAULT_SIDEBAR_WIDTH;
            return Math.min(Math.max(MIN_SIDEBAR_WIDTH, n), MAX_SIDEBAR_WIDTH);
        }

        _persistSidebarWidth(width) {
            if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.set === 'function') {
                chrome.storage.local.set({ sidebarWidth: width });
            }
        }

        _syncSidebarToggleButtonLeft(width) {
            const toggleBtn = this.element?.querySelector('#sidebar-toggle-btn');
            if (!toggleBtn) return;
            if (this.manager?.sidebarCollapsed) return;
            toggleBtn.style.left = `${width}px`;
        }

        _applySidebarWidth(sidebar, width, { persist = false } = {}) {
            if (!sidebar) return;
            const clamped = this._clampSidebarWidth(width);
            sidebar.style.setProperty('width', `${clamped}px`, 'important');
            if (this.manager) this.manager.sidebarWidth = clamped;
            this._syncSidebarToggleButtonLeft(clamped);
            if (persist) this._persistSidebarWidth(clamped);
        }

        _resetComposerAfterSend(textarea, clearTextarea) {
            if (clearTextarea && textarea) {
                textarea.value = '';
                textarea.style.height = '60px';
            }
            if (typeof this.clearDraftImages === 'function') {
                this.clearDraftImages();
                return;
            }
            this.draftImages = [];
            if (typeof this.updateDraftImagesDisplay === 'function') this.updateDraftImagesDisplay();
        }

        async _persistChatMessages({ messageText, images, finalContent, userTimestamp, petTimestamp }) {
            const manager = this.manager;
            if (!manager?.currentSessionId || typeof manager.callUpdateDocument !== 'function') return;

            try {
                const userMessage = { type: 'user', content: messageText, timestamp: userTimestamp };
                if (Array.isArray(images) && images.length > 0) userMessage.imageDataUrl = images[0];
                const petMessage = { type: 'pet', content: finalContent, timestamp: petTimestamp };
                await manager.callUpdateDocument(manager.currentSessionId, [userMessage, petMessage]);
            } catch (error) {
                console.error('[消息发送] 调用 update_document 接口时出错:', error);
            }
        }

        getMainColorFromGradient(gradient) {
            if (!gradient) return '#3b82f6';
            const match = gradient.match(/#[0-9a-fA-F]{6}/);
            return match ? match[0] : '#3b82f6';
        }

        async createFallbackDom() {
            const manager = this.manager;

            // Create chat window container
            this.element = document.createElement('div');
            this.element.id = 'pet-chat-window';
            this.updateChatWindowStyle();

            // Initial Theme Setup
            this.updateTheme();

            // Create Header（使用 ChatHeader/index.html 模板内容）
            this.header = await this.createHeader();
            if (this.header) this.element.appendChild(this.header);

            // Create Content Container - 包裹侧边栏和主内容区域（水平布局）
            const contentContainer = document.createElement('div');
            contentContainer.className = 'yi-pet-chat-content-container';

            this.sidebar = null;
            if (manager) manager.sessionSidebar = null;

            // Create Main Content Container - 与 YiWeb pet-chat-right-panel 完全一致
            this.mainContent = document.createElement('div');
            this.mainContent.className = 'yi-pet-chat-right-panel';
            this.mainContent.setAttribute('aria-label', '会话聊天面板');

            // Messages Container - 消息列表区域，与 YiWeb 完全一致
            this.messagesContainer = document.createElement('div');
            this.messagesContainer.id = 'yi-pet-chat-messages';
            this.messagesContainer.className = 'yi-pet-chat-messages';
            this.messagesContainer.setAttribute('role', 'log');
            this.messagesContainer.setAttribute('aria-live', 'polite');
            this.mainContent.appendChild(this.messagesContainer);

            // Input Container - 输入区域（由 ChatInput 组件提供 createInputContainerElement）
            this.inputContainer = this.createInputContainer();
            if (this.inputContainer) this.mainContent.appendChild(this.inputContainer);

            contentContainer.appendChild(this.mainContent);
            this.element.appendChild(contentContainer);

            // Create Resize Handles (只保留四个角)
            this.createResizeHandles();

            // Bind Events
            this.bindEvents();

            return this.element;
        }

        async create() {
            const manager = this.manager;

            this.element = document.createElement('div');
            this.element.id = 'pet-chat-window';
            this.updateChatWindowStyle();

            this.updateTheme();

            const instance = this;
            const Vue = window.Vue;
            const vueApi = getVueApi(Vue);
            if (this._vueApp) {
                try {
                    this._vueApp.unmount();
                } catch (_) {}
                this._vueApp = null;
                this._vueInstance = null;
            }
            if (this._sidebarVueApp) {
                try {
                    this._sidebarVueApp.unmount();
                } catch (_) {}
                this._sidebarVueApp = null;
                this._sidebarVueInstance = null;
            }
            if (!vueApi) {
                return this.createFallbackDom();
            }

            const { createApp, defineComponent, ref, onMounted } = vueApi;

            const uiTick = ref(0);
            if (manager) manager.sessionSidebar = null;

            const loadComponent = async (name, args, options) => {
                const opts = options && typeof options === 'object' ? options : {};
                const mod = getComponentModule(name);
                if (!mod || typeof mod.createComponent !== 'function') return null;
                if (opts.requireTemplateLoader && typeof mod.loadTemplate !== 'function') return null;
                const template = opts.includeTemplate ? await loadTemplateIfAvailable(mod) : '';
                const payload = opts.includeTemplate ? { ...(args || {}), template } : (args || {});
                return safeCall(() => mod.createComponent(payload), null);
            };

            if (typeof manager?.ensureFaqManagerStore === 'function') {
                try {
                    manager.ensureFaqManagerStore();
                } catch (_) {}
            }
            if (typeof manager?.ensureFaqTagManagerStore === 'function') {
                try {
                    manager.ensureFaqTagManagerStore();
                } catch (_) {}
            }

            const ChatHeader = await loadComponent('ChatHeader', { manager }, { includeTemplate: true, requireTemplateLoader: false });
            const ChatInput = await loadComponent('ChatInput', { manager, instance }, { includeTemplate: true, requireTemplateLoader: false });
            if (!ChatHeader || !ChatInput) {
                return this.createFallbackDom();
            }

            const ChatMessages = await loadComponent('ChatMessages', null, { includeTemplate: true, requireTemplateLoader: true });
            if (!ChatMessages) {
                return this.createFallbackDom();
            }

            const FaqManager = await loadComponent(
                'FaqManager',
                { manager, store: manager?._faqManagerStore },
                { includeTemplate: true, requireTemplateLoader: true }
            );
            const FaqTagManager = await loadComponent(
                'FaqTagManager',
                { manager, store: manager?._faqTagManagerStore },
                { includeTemplate: true, requireTemplateLoader: true }
            );
            if (!FaqManager || !FaqTagManager) {
                return this.createFallbackDom();
            }

            if (!canUseVueTemplate(Vue)) {
                return this.createFallbackDom();
            }

            const templates = await safeCallAsync(() => loadChatWindowTemplates(), null);
            const resolvedTemplate =
                String(templates?.chatWindow || '').trim() ||
                '<div><ChatHeader ref="headerEl" :uiTick="uiTick" /><div class="yi-pet-chat-content-container"><div class="yi-pet-chat-right-panel" ref="mainEl" aria-label="会话聊天面板"><div id="yi-pet-chat-messages" ref="messagesEl" class="yi-pet-chat-messages" role="log" aria-live="polite"><ChatMessages :instance="instance" :manager="manager" /></div><ChatInput :uiTick="uiTick" /></div></div><FaqManager /><FaqTagManager /></div>';

            const Root = defineComponent({
                name: 'YiPetChatWindow',
                components: { ChatHeader, ChatInput, ChatMessages, FaqManager, FaqTagManager },
                setup() {
                    const headerEl = ref(null);
                    const mainEl = ref(null);
                    const messagesEl = ref(null);

                    onMounted(() => {
                        instance.header = headerEl.value?.$el ?? headerEl.value;
                        instance.sidebar = null;
                        instance.mainContent = mainEl.value;
                        instance.messagesContainer = messagesEl.value;

                        instance.createResizeHandles();
                        instance.bindEvents();
                    });

                    return {
                        uiTick,
                        instance,
                        manager,
                        headerEl,
                        mainEl,
                        messagesEl
                    };
                },
                template: resolvedTemplate
            });

            this._vueApp = createApp(Root);
            if (this._vueApp && this._vueApp.config) {
                this._vueApp.config.compilerOptions = this._vueApp.config.compilerOptions || {};
                this._vueApp.config.compilerOptions.isCustomElement = () => false;
            }
            this._vueInstance = this._vueApp.mount(this.element);

            return this.element;
        }

        async createHeader() {
            const manager = this.manager;
            const ChatHeaderModule = window.PetManager?.Components?.ChatHeader;
            const template =
                ChatHeaderModule && typeof ChatHeaderModule.loadTemplate === 'function'
                    ? await ChatHeaderModule.loadTemplate()
                    : '';
            const resolvedTemplate = String(template || '').trim();
            if (!resolvedTemplate) return null;

            const tpl = document.createElement('template');
            tpl.innerHTML = resolvedTemplate;
            const root = tpl.content.firstElementChild;
            if (!root) return null;

            const stopEvent = (e) => {
                e?.stopPropagation?.();
                e?.preventDefault?.();
            };

            const resolveExternalUrl = (key, fallbackUrl) => {
                const urls = window.PET_CONFIG?.constants?.URLS;
                const value = urls && typeof urls[key] === 'string' ? urls[key] : '';
                return String(value || fallbackUrl || '').trim();
            };

            const openExternal = (url) => {
                const targetUrl = String(url || '').trim();
                if (!targetUrl) return;
                const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
                if (newWindow) {
                    try {
                        newWindow.opener = null;
                    } catch (_) {}
                }
            };

            const authBtn = root.querySelector('#yi-pet-chat-auth-btn');
            if (authBtn) {
                authBtn.addEventListener('click', (e) => {
                    stopEvent(e);
                    if (typeof manager?.openAuth === 'function') manager.openAuth();
                });
            }

            const aicrBtn = root.querySelector('#yi-pet-chat-aicr-btn');
            if (aicrBtn) {
                aicrBtn.addEventListener('click', (e) => {
                    stopEvent(e);
                    openExternal(resolveExternalUrl('AICR_REVIEW_PAGE', 'https://effiy.cn/src/views/aicr/index.html'));
                });
            }

            const newsBtn = root.querySelector('#yi-pet-chat-news-btn');
            if (newsBtn) {
                newsBtn.addEventListener('click', (e) => {
                    stopEvent(e);
                    openExternal(resolveExternalUrl('NEWS_ASSISTANT_PAGE', 'https://effiy.cn/src/views/news/index.html'));
                });
            }

            const sidebarToggleBtn = root.querySelector('#sidebar-toggle-btn');
            if (sidebarToggleBtn) {
                sidebarToggleBtn.addEventListener('click', (e) => {
                    stopEvent(e);
                    if (typeof this.toggleSidebar === 'function') this.toggleSidebar();
                });
            }

            if (typeof this.updateSidebarToggleButton === 'function' && manager) {
                requestAnimationFrame(() => {
                    this.updateSidebarToggleButton(manager.sidebarCollapsed || false);
                });
            }

            return root;
        }

        createSidebar() {
            const manager = this.manager;
            const SessionSidebarModule = window.PetManager?.Components?.SessionSidebar;
            const sidebar =
                SessionSidebarModule && typeof SessionSidebarModule.createSidebarElement === 'function'
                    ? SessionSidebarModule.createSidebarElement(manager)
                    : document.createElement('div');
            if (!sidebar.classList.contains('session-sidebar')) sidebar.className = 'session-sidebar';

            if (typeof this._setupSidebarAfterRender === 'function') {
                this._setupSidebarAfterRender(sidebar, { bindSidebarDomEvents: true });
            } else {
                const sidebarWidth = manager.sidebarWidth || DEFAULT_SIDEBAR_WIDTH;
                manager.sidebarWidth = sidebarWidth;
                sidebar.style.setProperty('--session-sidebar-width', `${sidebarWidth}px`);
                manager.sessionSidebar = sidebar;

                this.sessionListContainer = sidebar.querySelector('#session-list');
                this.createSidebarResizer(sidebar);
                this._bindSidebarDomEvents(sidebar);

                setTimeout(() => {
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                }, 0);
            }

            return sidebar;
        }

        createSidebarResizer(sidebar) {
            const resizer = document.createElement('div');
            resizer.className = 'sidebar-resizer';

            resizer.addEventListener('mouseenter', () => {
                if (!this.isResizingSidebar) {
                    resizer.classList.add('hover');
                }
            });

            resizer.addEventListener('mouseleave', () => {
                if (!this.isResizingSidebar) {
                    resizer.classList.remove('hover');
                }
            });

            // 双击重置宽度
            let lastClickTime = 0;
            resizer.addEventListener('click', (e) => {
                const currentTime = Date.now();
                if (currentTime - lastClickTime < 300) {
                    this._applySidebarWidth(sidebar, DEFAULT_SIDEBAR_WIDTH, { persist: true });
                    e.preventDefault();
                    e.stopPropagation();
                }
                lastClickTime = currentTime;
            });

            resizer.addEventListener('mousedown', (e) => this.initSidebarResize(e, sidebar, resizer));

            sidebar.appendChild(resizer);
        }

        initSidebarResize(e, sidebar, resizer) {
            e.preventDefault();
            e.stopPropagation();
            this.isResizingSidebar = true;
            resizer.classList.add('dragging');
            resizer.classList.remove('hover');

            const startX = e.clientX;
            const startWidth = parseInt(getComputedStyle(sidebar).width, 10) || DEFAULT_SIDEBAR_WIDTH;

            // 添加全局样式，禁用文本选择
            document.body.classList.add('pet-is-resizing');

            // 使用 requestAnimationFrame 优化性能
            let rafId = null;
            let pendingWidth = this._clampSidebarWidth(startWidth);

            // 更新宽度的辅助函数
            const updateWidth = (newWidth) => {
                pendingWidth = this._clampSidebarWidth(newWidth);

                if (rafId === null) {
                    rafId = requestAnimationFrame(() => {
                        this._applySidebarWidth(sidebar, pendingWidth, { persist: false });
                        rafId = null;
                    });
                }
            };

            const onMouseMove = (e) => {
                if (!this.isResizingSidebar) return;
                const deltaX = e.clientX - startX;
                const newWidth = startWidth + deltaX;
                updateWidth(newWidth);
            };

            const onMouseUp = () => {
                // 取消待处理的动画帧
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }

                // 确保最终宽度已应用
                this._applySidebarWidth(sidebar, pendingWidth, { persist: true });

                this.isResizingSidebar = false;
                resizer.classList.remove('dragging');
                resizer.classList.remove('hover');

                // 恢复全局样式
                document.body.classList.remove('pet-is-resizing');

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        createInputContainer() {
            const ChatInputModule = window.PetManager?.Components?.ChatInput;
            if (ChatInputModule && typeof ChatInputModule.createInputContainerElement === 'function') {
                return ChatInputModule.createInputContainerElement(this.manager, this);
            }
            return null;
        }

        async _ensureCurrentSession() {
            const manager = this.manager;
            if (!manager) return;
            if (manager.currentSessionId) return;
            if (typeof manager.initSession === 'function') {
                await manager.initSession();
            }
        }

        _beginMessageRequest(abortController) {
            this.isProcessing = true;
            this._currentAbortController = abortController;
            this._updateRequestStatus('loading', abortController);
        }

        _endMessageRequest() {
            this.isProcessing = false;
            this._currentAbortController = null;
            this._updateRequestStatus('idle');
        }

        async _sendMessageWithVue({ manager, messageText, images, textarea, clearTextarea, abortController }) {
            const userTimestamp = Date.now();
            const userMsg = {
                type: 'user',
                content: messageText,
                timestamp: userTimestamp,
                imageDataUrl: images.length > 0 ? images[0] : null
            };
            this._messagesAppend(userMsg);

            this._resetComposerAfterSend(textarea, clearTextarea);

            const waitingIcon = this._getWaitingIcon();
            const petTimestamp = Date.now();
            const petMsg = {
                type: 'pet',
                content: `${waitingIcon} 正在思考...`,
                timestamp: petTimestamp,
                streaming: true
            };
            this._messagesAppend(petMsg);
            const list = this._getMessagesList && this._getMessagesList();
            const petIdx = list ? list.length - 1 : 0;

            this.scrollToBottom(true);

            let streamedContent = '';
            const onStreamContent = (_chunk, accumulatedContent) => {
                streamedContent = accumulatedContent;
                if (typeof this._messagesUpdateContent === 'function') {
                    this._messagesUpdateContent(petIdx, accumulatedContent);
                }
                if (this.messagesContainer) this.scrollToBottom();
                return accumulatedContent;
            };
            onStreamContent.getFullContent = () => streamedContent;

            const imagesForApi = images.length > 0 ? images : null;
            const reply = await manager.generatePetResponseStream(messageText, onStreamContent, abortController, { images: imagesForApi });

            const finalContent = String(streamedContent || reply || '').trim() || '请继续。';
            if (typeof this._messagesSetStreaming === 'function') this._messagesSetStreaming(petIdx, false);
            if (typeof this._messagesUpdateContent === 'function') this._messagesUpdateContent(petIdx, finalContent);

            await this._persistChatMessages({ messageText, images, finalContent, userTimestamp, petTimestamp });
            this.scrollToBottom();
        }

        async _sendMessageWithDom({ manager, messageText, images, textarea, clearTextarea, abortController, messagesContainer }) {
            const userTimestamp = Date.now();
            const userMessageElement = manager.createMessageElement(
                messageText,
                'user',
                images.length > 0 ? images[0] : null,
                userTimestamp,
                {}
            );
            userMessageElement.setAttribute('data-chat-timestamp', userTimestamp.toString());
            userMessageElement.setAttribute('data-chat-type', 'user');
            const allMessages = Array.from(messagesContainer.children).filter((msg) => !msg.hasAttribute('data-welcome-message'));
            userMessageElement.setAttribute('data-chat-idx', allMessages.length.toString());
            messagesContainer.appendChild(userMessageElement);

            setTimeout(() => {
                if (typeof manager.addActionButtonsToMessage === 'function') {
                    manager.addActionButtonsToMessage(userMessageElement);
                }
            }, 0);

            this._resetComposerAfterSend(textarea, clearTextarea);

            const waitingIcon = this._getWaitingIcon();
            const petTimestamp = Date.now();
            const petMessageElement = manager.createMessageElement(
                `${waitingIcon} 正在思考...`,
                'pet',
                null,
                petTimestamp,
                { streaming: true }
            );
            petMessageElement.classList.add('is-streaming');
            petMessageElement.setAttribute('data-chat-timestamp', petTimestamp.toString());
            petMessageElement.setAttribute('data-chat-type', 'pet');
            messagesContainer.appendChild(petMessageElement);

            setTimeout(() => {
                if (typeof manager.addActionButtonsToMessage === 'function') {
                    manager.addActionButtonsToMessage(petMessageElement);
                }
            }, 0);

            this.scrollToBottom(true);

            const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
            if (!messageBubble) {
                throw new Error('未找到宠物消息气泡');
            }

            const onStreamContent = this._createStreamContentCallback(messageBubble, messagesContainer, petMessageElement);

            const imagesForApi = images.length > 0 ? images : null;
            const reply = await manager.generatePetResponseStream(messageText, onStreamContent, abortController, { images: imagesForApi });

            const streamedReply =
                onStreamContent && typeof onStreamContent.getFullContent === 'function' ? onStreamContent.getFullContent() : '';

            let domContent = '';
            if (!streamedReply && messageBubble) {
                const dataOriginalText = messageBubble.getAttribute('data-original-text');
                if (dataOriginalText) domContent = dataOriginalText.trim();
            }

            const finalContent = String(streamedReply || reply || domContent || '').trim() || '请继续。';

            petMessageElement.classList.remove('is-streaming');
            const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
            if (finalContentDiv) {
                finalContentDiv.classList.remove('pet-chat-content-streaming');
            }

            if (finalContent) {
                const finalDiv = this._getOrCreateMessageContentDiv(messageBubble);
                if (finalDiv) {
                    finalDiv.innerHTML = manager.renderMarkdown(finalContent);
                }
                messageBubble.setAttribute('data-original-text', finalContent);

                setTimeout(async () => {
                    const targetDiv = messageBubble.querySelector('.pet-chat-content') || messageBubble;
                    await manager.processMermaidBlocks(targetDiv);
                }, 100);
            }

            await this._persistChatMessages({ messageText, images, finalContent, userTimestamp, petTimestamp });
            this.scrollToBottom();
        }

        async sendMessage(userContent = null, userImageDataUrl = null) {
            const manager = this.manager;
            if (!manager) {
                console.error('[消息发送] Manager 未初始化');
                return;
            }

            // 获取用户输入
            const textarea = this.messageInput;
            if (!textarea) {
                console.error('[消息发送] 输入框未找到');
                return;
            }

            // 使用传入的内容，或从输入框获取
            const messageText = userContent !== null ? String(userContent).trim() : textarea.value.trim();
            const images = userImageDataUrl ? [userImageDataUrl] : (this.draftImages || []);

            // 检查是否有内容
            if (!messageText && images.length === 0) {
                if (typeof manager.showNotification === 'function') {
                    manager.showNotification('请输入消息或添加图片', 'info');
                }
                return;
            }

            // 检查是否正在处理
            if (this.isProcessing || this._currentAbortController) {
                return;
            }

            // 确保有当前会话
            await this._ensureCurrentSession();

            const messagesContainer = this.messagesContainer;
            if (!messagesContainer) {
                console.error('[消息发送] 消息容器未找到');
                return;
            }

            // 设置处理状态
            const abortController = new AbortController();
            this._beginMessageRequest(abortController);

            const useVueMessages = this._vueApp && typeof this._messagesAppend === 'function';

            try {
                if (useVueMessages) {
                    await this._sendMessageWithVue({
                        manager,
                        messageText,
                        images,
                        textarea,
                        clearTextarea: userContent === null,
                        abortController
                    });
                    return;
                }

                await this._sendMessageWithDom({
                    manager,
                    messageText,
                    images,
                    textarea,
                    clearTextarea: userContent === null,
                    abortController,
                    messagesContainer
                });

            } catch (error) {
                console.error('[消息发送] 发送消息时出错:', error);

                // 如果是取消操作，不显示错误
                if (error.name === 'AbortError' || abortController.signal.aborted) {
                    if (typeof manager.showNotification === 'function') {
                        manager.showNotification('请求已取消', 'info');
                    }
                } else {
                    const errorMessage = error.message || '发送消息失败，请重试';
                    if (typeof manager.showNotification === 'function') {
                        manager.showNotification(errorMessage, 'error');
                    }
                    if (useVueMessages && typeof this._messagesUpdateContent === 'function') {
                        const list = this._getMessagesList && this._getMessagesList();
                        if (list && list.length > 0) {
                            const petIdx = list.length - 1;
                            if (list[petIdx].type === 'pet') {
                                if (typeof this._messagesSetStreaming === 'function') this._messagesSetStreaming(petIdx, false);
                                this._messagesUpdateContent(petIdx, `❌ ${errorMessage}`);
                            }
                        }
                    } else {
                        const petMessageElement = messagesContainer.querySelector('.is-streaming');
                        if (petMessageElement) {
                            petMessageElement.classList.remove('is-streaming');
                            const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                            if (messageBubble) {
                                const contentDiv = messageBubble.querySelector('.pet-chat-content');
                                if (contentDiv) {
                                    contentDiv.classList.remove('pet-chat-content-streaming');
                                    contentDiv.innerHTML = manager.renderMarkdown(`❌ ${errorMessage}`);
                                }
                            }
                        }
                    }
                }
            } finally {
                // 清理状态
                this._endMessageRequest();
            }
        }

        /**
         * 更新聊天窗口标题（显示当前会话名称）
         */
        updateChatHeaderTitle() {
            if (!this.element) return;

            const titleTextEl = this.element.querySelector('#yi-pet-chat-header-title-text');
            if (!titleTextEl) return;

            const manager = this.manager;

            // 获取当前会话名称
            if (manager.currentSessionId && manager.sessions && manager.sessions[manager.currentSessionId]) {
                const session = manager.sessions[manager.currentSessionId];
                const sessionTitle = session.title || '未命名会话';
                // 如果标题太长，截断并添加省略号
                const displayTitle = sessionTitle.length > 20
                    ? sessionTitle.substring(0, 20) + '...'
                    : sessionTitle;
                titleTextEl.textContent = displayTitle;
            } else {
                // 如果没有会话，显示默认文本
                titleTextEl.textContent = '与我聊天';
            }

            // 更新编辑会话按钮状态
            const editSessionBtn = this.element.querySelector('#edit-session-btn');
            if (editSessionBtn) {
                if (manager.currentSessionId && manager.sessions && manager.sessions[manager.currentSessionId]) {
                    editSessionBtn.disabled = false;
                } else {
                    editSessionBtn.disabled = true;
                }
            }
        }

        /**
         * 更新聊天窗口主题颜色
         */
        updateTheme() {
            if (!this.element) return;
            const manager = this.manager;

            // 获取当前宠物颜色
            const currentColor = manager.colors[manager.colorIndex];
            const mainColor = this.getMainColorFromGradient(currentColor);

            // Update CSS variables
            this.element.style.setProperty('--pet-chat-primary-color', currentColor, 'important');
            this.element.style.setProperty('--pet-chat-main-color', mainColor, 'important');

            // 其余组件通过 CSS 变量生效，无需逐一设置
        }

        updateChatWindowStyle() {
            if (!this.element) return;

            const state = this.manager.chatWindowState || {};

            // Ensure fullscreen class is synced with state
            if (state.isFullscreen) {
                this.element.classList.add('fullscreen');
                // In fullscreen, we don't apply specific width/height/pos
                // relying on CSS class instead
                return;
            } else {
                this.element.classList.remove('fullscreen');
            }

            const width = state.width || DEFAULT_CHAT_WINDOW_WIDTH;
            const height = state.height || DEFAULT_CHAT_WINDOW_HEIGHT;
            const left = state.x;
            const top = state.y;

            // Dynamic values only
            this.element.style.setProperty('width', `${width}px`, 'important');
            this.element.style.setProperty('height', `${height}px`, 'important');
            this.element.style.setProperty('z-index', `${PET_CONFIG.ui.zIndex.chatWindow}`, 'important');
            if (left !== undefined && top !== undefined) {
                this.element.style.setProperty('left', `${left}px`, 'important');
                this.element.style.setProperty('top', `${top}px`, 'important');
                this.element.style.setProperty('bottom', `auto`, 'important');
                this.element.style.setProperty('right', `auto`, 'important');
            } else {
                this.element.style.setProperty('bottom', `100px`, 'important');
                this.element.style.setProperty('right', `20px`, 'important');
                this.element.style.setProperty('left', `auto`, 'important');
                this.element.style.setProperty('top', `auto`, 'important');
            }
            // Initial animation can be controlled via CSS; ensure opacity/transform are reset if previously set
            this.element.style.removeProperty('opacity');
            this.element.style.removeProperty('transform');
        }

        /**
         * 判断是否应该自动滚动到底部
         * @returns {boolean} 如果距离底部小于 140px 则返回 true
         */
        shouldAutoScroll() {
            try {
                const el = this.messagesContainer || document.getElementById('pet-chat-messages');
                if (!el) return true;
                const distance = (el.scrollHeight || 0) - (el.scrollTop || 0) - (el.clientHeight || 0);
                return distance < AUTO_SCROLL_THRESHOLD_PX;
            } catch (_) {
                return true;
            }
        }

        /**
         * 滚动到指定索引的消息
         * @param {number} targetIdx - 目标消息索引
         */
        scrollToIndex(targetIdx) {
            try {
                const el = document.querySelector(`[data-chat-idx="${targetIdx}"]`);
                if (el && typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ block: 'nearest' });
                    return;
                }
                const container = this.messagesContainer || document.getElementById('pet-chat-messages');
                if (container) container.scrollTop = container.scrollHeight;
            } catch (_) { }
        }

        /**
         * 滚动到底部 - 智能判断是否需要滚动
         * @param {boolean} force - 是否强制滚动
         */
        scrollToBottom(force = false) {
            if (!force && !this.shouldAutoScroll()) {
                return;
            }
            try {
                const container = this.messagesContainer || document.getElementById('pet-chat-messages');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            } catch (_) { }
        }

        initializeChatScroll() {
            // Wait for messages to be populated
            setTimeout(() => {
                this.scrollToBottom(true);
            }, 100);
        }

        /**
         * 显示加载状态
         */
        showLoadingState(message = '正在加载会话...') {
            if (this._vueApp && typeof this._setMessagesViewState === 'function') {
                this._setMessagesViewState('loading', message);
                return;
            }
            if (!this.messagesContainer) return;
            this.clearMessagesContainer();
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'yi-pet-chat-loading';
            loadingDiv.setAttribute('role', 'status');
            loadingDiv.setAttribute('aria-live', 'polite');
            loadingDiv.innerHTML = `
                <div class="loading-spinner" aria-hidden="true"></div>
                <div class="loading-text">${message}</div>
            `;
            this.messagesContainer.appendChild(loadingDiv);
        }

        /**
         * 显示错误状态
         */
        showErrorState(errorMessage) {
            if (this._vueApp && typeof this._setMessagesViewState === 'function') {
                this._setMessagesViewState('error', errorMessage || '发生错误');
                return;
            }
            if (!this.messagesContainer) return;
            this.clearMessagesContainer();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'yi-pet-chat-error';
            errorDiv.setAttribute('role', 'alert');
            errorDiv.setAttribute('aria-live', 'polite');
            errorDiv.innerHTML = `
                <div class="error-text">${errorMessage || '发生错误'}</div>
            `;
            this.messagesContainer.appendChild(errorDiv);
        }

        /**
         * 显示空状态 - 与 YiWeb 完全一致
         */
        showEmptyState(title = '未选择会话', subtitle = '从左侧会话列表选择一个会话开始聊天', hint = '也可以在左侧搜索框输入关键词快速定位') {
            if (this._vueApp && typeof this._setMessagesViewState === 'function') {
                this._setMessagesViewState('empty', { title, subtitle, hint });
                return;
            }
            if (!this.messagesContainer) return;
            this.clearMessagesContainer();
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'yi-pet-chat-empty';
            emptyDiv.innerHTML = `
                <div class="sr-only" role="status" aria-live="polite">${subtitle}</div>
                <div class="pet-chat-empty-card">
                    <div class="pet-chat-empty-icon" aria-hidden="true">
                        <i class="fas fa-comments"></i>
                    </div>
                    <div class="pet-chat-empty-title">${title}</div>
                    <div class="pet-chat-empty-subtitle">${subtitle}</div>
                    ${hint ? `<div class="pet-chat-empty-hint">${hint}</div>` : ''}
                </div>
            `;
            this.messagesContainer.appendChild(emptyDiv);
        }

        /**
         * 清空消息容器（保留容器本身）
         */
        clearMessagesContainer() {
            if (this._vueApp && typeof this._messagesClear === 'function') {
                this._messagesClear();
                if (typeof this._setMessagesViewState === 'function') this._setMessagesViewState('empty', null);
                return;
            }
            if (!this.messagesContainer) return;
            while (this.messagesContainer.firstChild) {
                this.messagesContainer.removeChild(this.messagesContainer.firstChild);
            }
        }

        _getMessageText(messageBubble) {
            return String(
                messageBubble?.getAttribute?.('data-original-text') ||
                    messageBubble?.textContent ||
                    messageBubble?.innerText ||
                    ''
            ).trim();
        }

        _getMessageIndex(messageDiv, messagesContainer) {
            const container = messagesContainer || (this.element ? this.element.querySelector('#yi-pet-chat-messages') : null);
            if (!container) return -1;
            const allMessages = Array.from(container.children).filter((msg) => !msg.hasAttribute('data-welcome-message'));
            return allMessages.indexOf(messageDiv);
        }

        _createMetaButton(metaActions, options) {
            const { text, title, ariaLabel, disabled, attrs, onClick } = options || {};
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pet-chat-meta-btn';
            btn.setAttribute('data-standard-button', 'true');
            if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
            if (title) btn.setAttribute('title', title);
            if (attrs && typeof attrs === 'object') {
                for (const [k, v] of Object.entries(attrs)) {
                    if (v === undefined || v === null) continue;
                    btn.setAttribute(k, String(v));
                }
            }
            btn.textContent = text || '';
            btn.disabled = !!disabled;
            if (typeof onClick === 'function') {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onClick(e, btn);
                });
            }
            metaActions.appendChild(btn);
            return btn;
        }

        _canRegenerateAt(idx) {
            if (!this.manager || !this.manager.currentSessionId || !this.manager.sessions?.[this.manager.currentSessionId]) return false;
            const session = this.manager.sessions[this.manager.currentSessionId];
            if (!session?.messages || !Array.isArray(session.messages) || idx <= 0 || idx >= session.messages.length) return false;

            for (let i = idx - 1; i >= 0; i--) {
                const prevMsg = session.messages[i];
                if (!prevMsg || prevMsg.type === 'pet') continue;
                const text = String(prevMsg.content ?? prevMsg.message ?? '').trim();
                const hasImages =
                    (Array.isArray(prevMsg.imageDataUrls) && prevMsg.imageDataUrls.some(Boolean)) ||
                    !!String(prevMsg.imageDataUrl || '').trim();
                if (text || hasImages) return true;
            }

            return false;
        }

        // 为消息添加动作按钮（复制欢迎消息的按钮，设置按钮已移动到 chat-request-status-button 后面）
        async addActionButtonsToMessage(messageDiv, forceRefresh = false) {
            // 检查是否是欢迎消息，如果是则不添加（因为它已经有按钮了）
            const messagesContainer = this.element ? this.element.querySelector('#yi-pet-chat-messages') : null;
            if (!messagesContainer) return;

            // 检查当前消息是否是欢迎消息，如果是则跳过（欢迎消息已经有按钮了）
            const isWelcome = messageDiv.hasAttribute('data-welcome-message');
            if (isWelcome) return;

            const bubble = messageDiv.querySelector('.pet-chat-bubble');
            const metaActions = bubble ? bubble.querySelector('.pet-chat-meta-actions') : null;
            if (!metaActions) {
                console.warn('无法找到 pet-chat-meta-actions 容器，按钮添加失败');
                return;
            }

            const isUserMessage = !!messageDiv.querySelector('[data-message-type="user-bubble"]');
            const existingContainer = metaActions.querySelector('[data-message-actions]');

            if (existingContainer) {
                if (forceRefresh || existingContainer.children.length === 0) {
                    existingContainer.remove();
                } else {
                    const hasStandardButtons = metaActions.querySelector('button[data-standard-button="true"]');
                    if (!hasStandardButtons) {
                        await this._addStandardMessageButtons(metaActions, messageDiv, isUserMessage);
                    }
                    return;
                }
            }

            // 如果强制刷新，先移除现有的标准按钮（保留角色按钮）
            if (forceRefresh) {
                const standardButtons = metaActions.querySelectorAll('button[data-standard-button="true"]');
                standardButtons.forEach(btn => btn.remove());
            }

            // 检查是否已经有标准按钮
            const hasStandardButtons = metaActions.querySelector('button[data-standard-button="true"]');
            if (hasStandardButtons && !forceRefresh) {
                // 如果已有标准按钮且不强制刷新，只添加角色按钮
            } else {
                // 添加标准消息按钮（与 YiWeb 一致）
                await this._addStandardMessageButtons(metaActions, messageDiv, isUserMessage);
            }
        }

        /**
         * 添加标准消息按钮（与 YiWeb 一致）
         * @param {HTMLElement} metaActions - pet-chat-meta-actions 容器
         * @param {HTMLElement} messageDiv - 消息元素
         * @param {boolean} isUserMessage - 是否是用户消息
         */
        async _addStandardMessageButtons(metaActions, messageDiv, isUserMessage) {
            const messagesContainer = this.element ? this.element.querySelector('#yi-pet-chat-messages') : null;
            if (!messagesContainer) return;

            // 获取消息索引
            const idx = this._getMessageIndex(messageDiv, messagesContainer);
            if (idx < 0) return;

            // 获取消息内容
            const messageBubble = messageDiv.querySelector(isUserMessage ? '[data-message-type="user-bubble"]' : '[data-message-type="pet-bubble"]');
            const hasContent = messageBubble && (
                (messageBubble.getAttribute('data-original-text') || '').trim() ||
                messageBubble.textContent?.trim() ||
                messageBubble.innerText?.trim()
            );

            // 1. 复制按钮（如果有内容）
            if (hasContent) {
                this._createMetaButton(metaActions, {
                    text: '📋',
                    title: '复制',
                    ariaLabel: '复制消息',
                    onClick: async (_e, btn) => {
                        const content = this._getMessageText(messageBubble);
                        if (content && navigator.clipboard) {
                            try {
                                await navigator.clipboard.writeText(content);
                                btn.textContent = '✓';
                                setTimeout(() => {
                                    btn.textContent = '📋';
                                }, 1000);
                            } catch (err) {
                                console.error('复制失败:', err);
                            }
                        }
                    }
                });
            }

            if (messageBubble) {
                this._createMetaButton(metaActions, {
                    text: '✏️',
                    title: '编辑',
                    ariaLabel: '编辑消息',
                    onClick: () => {
                        if (this.manager && typeof this.manager.openMessageEditor === 'function') {
                            this.manager.openMessageEditor(messageDiv);
                        }
                    }
                });
            }

            if (!isUserMessage && hasContent && this.manager && typeof this.manager.getWeWorkRobotConfigs === 'function') {
                try {
                    const configsRaw = await this.manager.getWeWorkRobotConfigs();
                    const robotConfigs = Array.isArray(configsRaw) ? configsRaw : [];
                    for (const robotConfig of robotConfigs) {
                        if (!robotConfig || !robotConfig.webhookUrl) continue;
                        const enabled = (typeof robotConfig.enabled === 'boolean') ? robotConfig.enabled : true;
                        if (!enabled) continue;

                        const robotName = String(robotConfig.name || '').trim() || '机器人';
                        this._createMetaButton(metaActions, {
                            text: robotName,
                            title: `发送到：${robotName}`,
                            ariaLabel: `发送到机器人：${robotName}`,
                            attrs: { 'data-robot-id': String(robotConfig.id || '') },
                            onClick: async (_e, btn) => {
                                const rawContent = this._getMessageText(messageBubble);
                                if (!rawContent) {
                                    if (this.manager && typeof this.manager.showNotification === 'function') {
                                        this.manager.showNotification('消息内容为空，无法发送', 'error');
                                    }
                                    return;
                                }

                                const original = btn.textContent;
                                btn.disabled = true;
                                btn.textContent = '⏳';

                                try {
                                    let finalContent = rawContent;
                                    if (
                                        this.manager &&
                                        typeof this.manager.isMarkdownFormat === 'function' &&
                                        typeof this.manager.convertToMarkdown === 'function'
                                    ) {
                                        if (!this.manager.isMarkdownFormat(finalContent)) {
                                            finalContent = await this.manager.convertToMarkdown(finalContent);
                                        }
                                    }

                                    if (this.manager && typeof this.manager.sendToWeWorkRobot === 'function') {
                                        await this.manager.sendToWeWorkRobot(robotConfig.webhookUrl, finalContent);
                                        btn.textContent = '✓';
                                        if (this.manager && typeof this.manager.showNotification === 'function') {
                                            this.manager.showNotification(`已发送到 ${robotConfig.name || '企微机器人'}`, 'success');
                                        }
                                    } else {
                                        throw new Error('机器人发送能力不可用');
                                    }
                                } catch (error) {
                                    btn.textContent = '✕';
                                    if (this.manager && typeof this.manager.showNotification === 'function') {
                                        this.manager.showNotification(`发送失败：${error?.message || '未知错误'}`, 'error');
                                    }
                                } finally {
                                    setTimeout(() => {
                                        btn.textContent = original;
                                        btn.disabled = false;
                                    }, 1200);
                                }
                            }
                        });
                    }
                } catch (_) { }
            }

            // 3. 重新发送按钮（仅用户消息）
            if (isUserMessage) {
                this._createMetaButton(metaActions, {
                    text: '📨',
                    title: '重新发送',
                    ariaLabel: '重新发送',
                    disabled: this.isProcessing || false,
                    onClick: async () => {
                        if (this.manager && typeof this.manager.resendMessageAt === 'function') {
                            await this.manager.resendMessageAt(idx);
                        }
                    }
                });
            }

            // 4. 上移按钮
            this._createMetaButton(metaActions, {
                text: '⬆️',
                title: '上移',
                ariaLabel: '上移消息',
                onClick: async () => {
                    if (this.manager && typeof this.manager.moveMessageUpAt === 'function') {
                        await this.manager.moveMessageUpAt(idx);
                    }
                }
            });

            // 5. 下移按钮
            this._createMetaButton(metaActions, {
                text: '⬇️',
                title: '下移',
                ariaLabel: '下移消息',
                onClick: async () => {
                    if (this.manager && typeof this.manager.moveMessageDownAt === 'function') {
                        await this.manager.moveMessageDownAt(idx);
                    }
                }
            });

            // 6. 重新生成按钮（仅宠物消息，且可以重新生成）
            if (!isUserMessage) {
                if (this._canRegenerateAt(idx)) {
                    this._createMetaButton(metaActions, {
                        text: '🔄',
                        title: '重新生成',
                        ariaLabel: '重新生成回复',
                        disabled: this.isProcessing || false,
                        onClick: async () => {
                            if (this.manager && typeof this.manager.regenerateMessage === 'function') {
                                await this.manager.regenerateMessage(messageDiv);
                            }
                        }
                    });
                }
            }

            // 7. 删除按钮
            this._createMetaButton(metaActions, {
                text: '🗑️',
                title: '删除',
                ariaLabel: '删除消息',
                disabled: this.isProcessing || false,
                onClick: async () => {
                    if (confirm('确定要删除这条消息吗？')) {
                        if (this.manager && typeof this.manager.deleteMessage === 'function') {
                            await this.manager.deleteMessage(messageDiv);
                        }
                    }
                }
            });
        }

        /**
         * 为宠物消息添加重新生成按钮
         * @param {HTMLElement} container - 按钮容器
         * @param {HTMLElement} messageDiv - 宠物消息元素
         */
        addTryAgainButton(container, messageDiv) {
            // 如果已经添加过，就不再添加
            if (container.querySelector('.try-again-button')) {
                return;
            }

            // 如果是按钮操作生成的消息，不添加 try again 按钮
            if (messageDiv.hasAttribute('data-button-action')) {
                return;
            }

            const messagesContainer = this.element ? this.element.querySelector('#yi-pet-chat-messages') : null;
            if (!messagesContainer) {
                return;
            }

            // 创建重新生成按钮
            const tryAgainButton = document.createElement('button');
            tryAgainButton.className = 'try-again-button';
            tryAgainButton.setAttribute('title', '重新生成回复');
            tryAgainButton.setAttribute('aria-label', '重新生成回复');
            // 图标：刷新/重试
            tryAgainButton.innerHTML = '🔄';

            // 初始化按钮状态
            this._updateTryAgainButtonState(tryAgainButton, 'idle');

            // 点击重新生成
            tryAgainButton.addEventListener('click', async (e) => {
                e.stopPropagation();

                // 防止重复点击
                if (tryAgainButton.hasAttribute('data-retrying')) {
                    return;
                }

                tryAgainButton.setAttribute('data-retrying', 'true');
                this._updateTryAgainButtonState(tryAgainButton, 'loading');

                try {
                    // 查找对应的用户消息
                    const userMessageText = this._findUserMessageForRetry(messageDiv, messagesContainer);

                    if (!userMessageText) {
                        // 如果找不到用户消息，可能是通过按钮触发的操作
                        console.warn('未找到对应的用户消息，无法重新生成回复');

                        const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                        if (messageBubble) {
                            const originalText = messageBubble.getAttribute('data-original-text') ||
                                messageBubble.textContent ||
                                '此消息无法重新生成';
                            const contentDiv = this._getOrCreateMessageContentDiv(messageBubble);
                            if (contentDiv) {
                                contentDiv.innerHTML = this.manager.renderMarkdown(
                                    `${originalText}\n\n💡 **提示**：此消息可能是通过按钮操作生成的，无法重新生成。`
                                );
                            }
                        }

                        this._updateTryAgainButtonState(tryAgainButton, 'idle');
                        tryAgainButton.removeAttribute('data-retrying');
                        return;
                    }

                    // 执行重新生成
                    await this._retryGenerateResponse(messageDiv, userMessageText, messagesContainer);

                    // 显示成功状态
                    this._updateTryAgainButtonState(tryAgainButton, 'success');

                    // 1.5秒后恢复为初始状态
                    setTimeout(() => {
                        this._updateTryAgainButtonState(tryAgainButton, 'idle');
                        tryAgainButton.removeAttribute('data-retrying');
                    }, 1500);

                } catch (error) {
                    // 处理错误
                    let isAbortError = this._handleRetryError(messageDiv, error);

                    if (!isAbortError) {
                        // 显示错误状态
                        this._updateTryAgainButtonState(tryAgainButton, 'error');

                        // 1.5秒后恢复为初始状态
                        setTimeout(() => {
                            this._updateTryAgainButtonState(tryAgainButton, 'idle');
                            tryAgainButton.removeAttribute('data-retrying');
                        }, 1500);
                    } else {
                        // 请求被取消，直接恢复状态
                        this._updateTryAgainButtonState(tryAgainButton, 'idle');
                        tryAgainButton.removeAttribute('data-retrying');
                    }
                }
            });

            container.appendChild(tryAgainButton);
        }

        // 设置侧边栏折叠状态
        setSidebarCollapsed(collapsed) {
            if (!this.sidebar) return;
            if (collapsed) {
                this.sidebar.classList.add('collapsed');
            } else {
                this.sidebar.classList.remove('collapsed');
            }
            // 更新 manager 状态
            if (this.manager) {
                this.manager.sidebarCollapsed = collapsed;
            }
            // 更新折叠按钮图标和位置
            this.updateSidebarToggleButton(collapsed);
        }
        
        // 更新侧边栏折叠按钮
        updateSidebarToggleButton(collapsed) {
            const toggleBtn = this.element?.querySelector('#sidebar-toggle-btn');
            if (!toggleBtn) return;
            
            if (collapsed) {
                // 侧边栏已折叠，显示展开图标（向右箭头）
                toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
                toggleBtn.setAttribute('title', '展开会话列表');
            } else {
                // 侧边栏已展开，显示折叠图标（三条横线）
                toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
                toggleBtn.setAttribute('title', '折叠会话列表');
                // 按钮位置由 CSS 控制，始终在 title 左边，不再需要根据侧边栏宽度设置
            }
            
            // 注意：不在这里调用 manager.updateToggleButtonPosition，避免循环调用
            // manager.updateToggleButtonPosition 会在需要时单独调用
        }

        // 切换侧边栏折叠状态
        toggleSidebar() {
            if (!this.sidebar) return;
            const isCollapsed = this.sidebar.classList.contains('collapsed');
            this.setSidebarCollapsed(!isCollapsed);
            // 保存状态
            if (this.manager && typeof this.manager.saveSidebarCollapsed === 'function') {
                this.manager.saveSidebarCollapsed();
            }
            // 注意：updateSidebarToggleButton 已经在 setSidebarCollapsed 中调用，不需要再次调用
        }

        // 设置输入容器折叠状态
        setInputContainerCollapsed(collapsed) {
            if (!this.inputContainer) return;
            if (collapsed) {
                this.inputContainer.classList.add('collapsed');
            } else {
                this.inputContainer.classList.remove('collapsed');
            }
        }

        // 切换输入容器折叠状态
        toggleInputContainer() {
            if (!this.inputContainer) return;
            const isCollapsed = this.inputContainer.classList.contains('collapsed');
            this.setInputContainerCollapsed(!isCollapsed);
            // 保存状态到 manager
            if (this.manager) {
                this.manager.inputContainerCollapsed = !isCollapsed;
                if (typeof this.manager.saveInputContainerCollapsed === 'function') {
                    this.manager.saveInputContainerCollapsed();
                }
            }
        }

        isVisible() {
            const el = this.element || this.manager?.chatWindow;
            if (!el) return false;
            if (el.hasAttribute('hidden')) return false;
            if (el.classList && el.classList.contains('js-hidden')) return false;
            return true;
        }

        focusInput() {
            const root = this.element || this.manager?.chatWindow;
            if (!root) return false;
            const textarea = root.querySelector('#yi-pet-chat-input');
            if (textarea && typeof textarea.focus === 'function') {
                textarea.focus();
                return true;
            }
            return false;
        }

        setVisible(visible, options) {
            const opts = options && typeof options === 'object' ? options : {};
            const focus = opts.focus !== false;
            const el = this.element || this.manager?.chatWindow;
            if (!el) return;

            if (visible) {
                el.classList?.remove('js-hidden');
                try {
                    el.removeAttribute('hidden');
                } catch (_) {}
                if (this.manager) this.manager.isChatOpen = true;
                if (focus) this.focusInput();
                return;
            }

            el.classList?.add('js-hidden');
            try {
                el.setAttribute('hidden', '');
            } catch (_) {}
            if (this.manager) this.manager.isChatOpen = false;
        }

        toggleVisible(options) {
            const visible = this.isVisible();
            this.setVisible(!visible, options);
        }
    }

    const applyWindowMethods = hooks.applyWindowMethods;
    if (typeof applyWindowMethods === 'function') {
        applyWindowMethods(ChatWindow.prototype);
    }

    // Export to namespace
    window.PetManager.Components.ChatWindow = ChatWindow;

})();
