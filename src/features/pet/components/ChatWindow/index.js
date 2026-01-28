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
                      const fileInput = document.createElement('input');
                      fileInput.type = 'file';
                      fileInput.accept = '.zip';
                      fileInput.className = 'js-hidden';
                      fileInput.addEventListener('change', async (e) => {
                          const file = e?.target?.files?.[0];
                          if (file && typeof manager.importSessionsFromZip === 'function') {
                              await manager.importSessionsFromZip(file);
                          }
                      });
                      document.body.appendChild(fileInput);
                      fileInput.click();
                      document.body.removeChild(fileInput);
                  };

                  const onAddClick = () => {
                      if (typeof manager.createBlankSession === 'function') manager.createBlankSession();
                  };

                  const onAuthClick = (e) => {
                      e?.stopPropagation?.();
                      e?.preventDefault?.();
                      manager.openAuth();
                  };

                  const onRefreshClick = (e) => {
                      e?.stopPropagation?.();
                      e?.preventDefault?.();
                      manager.manualRefresh(e.currentTarget);
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
                      onRefreshClick,
                      onSidebarToggleClick
                  };
              };

    const CHAT_WINDOW_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/ChatWindow/index.html';
    let chatWindowTemplatesPromise = null;
    let chatWindowTemplatesCache = null;

    function resolveExtensionResourceUrl(relativePath) {
        try {
            if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) return chrome.runtime.getURL(relativePath);
        } catch (_) {}
        return relativePath;
    }

    async function loadChatWindowTemplates() {
        if (chatWindowTemplatesCache) return chatWindowTemplatesCache;
        if (!chatWindowTemplatesPromise) {
            chatWindowTemplatesPromise = (async () => {
                const url = resolveExtensionResourceUrl(CHAT_WINDOW_TEMPLATES_RESOURCE_PATH);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to load templates: ${res.status}`);

                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const chatWindowEl = doc.querySelector('#yi-pet-chat-window-template');

                chatWindowTemplatesCache = {
                    chatWindow: chatWindowEl ? chatWindowEl.innerHTML : ''
                };
                return chatWindowTemplatesCache;
            })();
        }
        return chatWindowTemplatesPromise;
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
            this.sidebarWidth = manager.sidebarWidth || 320;
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

            // 防重复提交标志
            this.isProcessing = false;
        }

        getMainColorFromGradient(gradient) {
            if (!gradient) return '#3b82f6';
            const match = gradient.match(/#[0-9a-fA-F]{6}/);
            return match ? match[0] : '#3b82f6';
        }

        createFallbackDom() {
            const manager = this.manager;

            // Create chat window container
            this.element = document.createElement('div');
            this.element.id = 'pet-chat-window';
            this.updateChatWindowStyle();

            // Get current color
            const currentColor = manager.colors[manager.colorIndex];

            // Initial Theme Setup
            this.updateTheme();

            // Create Header
            this.header = this.createHeader(currentColor);
            this.element.appendChild(this.header);

            // Create Content Container - 包裹侧边栏和主内容区域（水平布局）
            const contentContainer = document.createElement('div');
            contentContainer.className = 'yi-pet-chat-content-container';

            // Create Sidebar - 会话列表侧边栏
            this.sidebar = this.createSidebar();
            manager.sessionSidebar = this.sidebar;
            contentContainer.appendChild(this.sidebar);

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

            // Input Container - 输入区域
            this.inputContainer = this.createInputContainer(currentColor);
            this.mainContent.appendChild(this.inputContainer);

            contentContainer.appendChild(this.mainContent);
            this.element.appendChild(contentContainer);

            // Create Resize Handles (只保留四个角)
            this.createResizeHandles();

            // Bind Events
            this.bindEvents();

            // 确保侧边栏默认显示（加载状态会在 createChatWindow 中处理）
            // 如果 manager 的 sidebarCollapsed 未定义，默认为 false（显示）
            if (manager.sidebarCollapsed === undefined) {
                manager.sidebarCollapsed = false;
            }
            // 立即应用状态
            this.setSidebarCollapsed(manager.sidebarCollapsed);

            return this.element;
        }

        async create() {
            const manager = this.manager;

            this.element = document.createElement('div');
            this.element.id = 'pet-chat-window';
            this.updateChatWindowStyle();

            const currentColor = manager.colors[manager.colorIndex];

            this.updateTheme();

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

            const instance = this;
            const Vue = window.Vue;
            const canRenderWithVue =
                Vue &&
                typeof Vue.createApp === 'function' &&
                typeof Vue.defineComponent === 'function' &&
                typeof Vue.ref === 'function' &&
                typeof Vue.onMounted === 'function';

            if (!canRenderWithVue) {
                return this.createFallbackDom();
            }

            const { createApp, defineComponent, ref, onMounted } = Vue;

            const store = (() => {
                let resolved = null;
                try {
                    resolved = createStore(manager);
                } catch (_) {
                    resolved = null;
                }
                const current = resolved && typeof resolved === 'object' ? resolved : {};
                if (!current.searchValue || typeof current.searchValue !== 'object' || !('value' in current.searchValue)) {
                    current.searchValue = ref(manager?.sessionTitleFilter || '');
                }
                return current;
            })();

            const computedProps = (() => {
                let resolved = null;
                try {
                    resolved = useComputed(store);
                } catch (_) {
                    resolved = null;
                }
                const current = resolved && typeof resolved === 'object' ? resolved : {};
                if (!current.clearVisible || typeof current.clearVisible !== 'object' || !('value' in current.clearVisible)) {
                    current.clearVisible = {
                        get value() {
                            return !!String(store?.searchValue?.value || '').trim();
                        }
                    };
                }
                return current;
            })();

            const methods = useMethods({ manager, instance, store });

            let SessionSidebar = null;
            try {
                const sessionSidebarModule = window.PetManager?.Components?.SessionSidebar;
                if (
                    sessionSidebarModule &&
                    typeof sessionSidebarModule.loadTemplate === 'function' &&
                    typeof sessionSidebarModule.createComponent === 'function'
                ) {
                    const template = await sessionSidebarModule.loadTemplate();
                    SessionSidebar = sessionSidebarModule.createComponent({
                        template,
                        store,
                        computedProps,
                        methods,
                        manager
                    });
                }
            } catch (_) {
                SessionSidebar = null;
            }

            if (!SessionSidebar) {
                return this.createFallbackDom();
            }

            const evalAllowed = (() => {
                try {
                    Function('return 1')();
                    return true;
                } catch (_) {
                    return false;
                }
            })();
            const canUseTemplate = typeof Vue?.compile === 'function' && evalAllowed;
            if (!canUseTemplate) {
                return this.createFallbackDom();
            }

            const templates = await (async () => {
                try {
                    return await loadChatWindowTemplates();
                } catch (_) {
                    return null;
                }
            })();
            const resolvedTemplate =
                String(templates?.chatWindow || '').trim() ||
                '<div><div class="yi-pet-chat-header" ref="headerEl" title="拖拽移动窗口 | 双击全屏" style="position: relative"><div class="yi-pet-chat-header-title" id="yi-pet-chat-header-title"><span style="font-size: 20px;">💕</span><span id="yi-pet-chat-header-title-text" style="font-weight: 600; font-size: 16px;">与我聊天</span></div><div class="yi-pet-chat-header-buttons"><button id="yi-pet-chat-auth-btn" class="yi-pet-chat-header-btn" aria-label="API 鉴权" title="API 鉴权" @click="onAuthClick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1Z" /></svg></button><button id="yi-pet-chat-refresh-btn" class="yi-pet-chat-header-btn pet-chat-refresh-btn" aria-label="刷新" title="刷新" @click="onRefreshClick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 19 12c0-1.93-.78-3.68-2.05-4.95Z" /></svg></button></div><button id="sidebar-toggle-btn" class="yi-pet-chat-header-btn sidebar-toggle-btn" aria-label="折叠/展开会话列表" title="折叠会话列表" @click="onSidebarToggleClick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" /></svg></button></div><div class="yi-pet-chat-content-container"><div class="session-sidebar" ref="sidebarEl"><SessionSidebar /></div><div class="yi-pet-chat-right-panel" ref="mainEl" aria-label="会话聊天面板"><div id="yi-pet-chat-messages" ref="messagesEl" class="yi-pet-chat-messages" role="log" aria-live="polite"></div><div id="yi-pet-input-mount" ref="inputMountEl"></div></div></div></div>';

            const Root = defineComponent({
                name: 'YiPetChatWindow',
                components: { SessionSidebar },
                setup() {
                    const headerEl = ref(null);
                    const sidebarEl = ref(null);
                    const mainEl = ref(null);
                    const messagesEl = ref(null);
                    const inputMountEl = ref(null);

                    onMounted(() => {
                        instance.header = headerEl.value;
                        instance.sidebar = sidebarEl.value;
                        instance.mainContent = mainEl.value;
                        instance.messagesContainer = messagesEl.value;

                        if (instance.sidebar) {
                            instance._setupSidebarAfterRender(instance.sidebar, {
                                store,
                                computedProps,
                                methods,
                                bindSidebarDomEvents: false
                            });
                        }

                        instance.inputContainer = instance.createInputContainer(currentColor);
                        if (inputMountEl.value && instance.inputContainer) inputMountEl.value.replaceWith(instance.inputContainer);

                        instance.createResizeHandles();
                        instance.bindEvents();

                        if (manager.sidebarCollapsed === undefined) {
                            manager.sidebarCollapsed = false;
                        }
                        instance.setSidebarCollapsed(manager.sidebarCollapsed);

                        requestAnimationFrame(() => {
                            instance.updateSidebarToggleButton(manager.sidebarCollapsed || false);
                        });
                    });

                    const onAuthClick = (e) => methods?.onAuthClick?.(e);
                    const onRefreshClick = (e) => methods?.onRefreshClick?.(e);
                    const onSidebarToggleClick = (e) => methods?.onSidebarToggleClick?.(e);

                    return {
                        headerEl,
                        sidebarEl,
                        mainEl,
                        messagesEl,
                        inputMountEl,
                        onAuthClick,
                        onRefreshClick,
                        onSidebarToggleClick
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

        createHeader(currentColor) {
            const manager = this.manager;
            const chatHeader = document.createElement('div');
            chatHeader.className = 'yi-pet-chat-header';
            chatHeader.title = '拖拽移动窗口 | 双击全屏';

            // Title
            const headerTitle = document.createElement('div');
            headerTitle.className = 'yi-pet-chat-header-title';
            headerTitle.id = 'yi-pet-chat-header-title';
            headerTitle.innerHTML = `
                <span style="font-size: 20px;">💕</span>
                <span id="yi-pet-chat-header-title-text" style="font-weight: 600; font-size: 16px;">与我聊天</span>
            `;

            // Buttons Container
            const headerButtons = document.createElement('div');
            headerButtons.className = 'yi-pet-chat-header-buttons';

            // Auth Button
            const authBtn = this.createHeaderButton(
                'yi-pet-chat-auth-btn',
                'API 鉴权',
                '<path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1Z"/>',
                () => manager.openAuth()
            );

            // Refresh Button
            const refreshBtn = this.createHeaderButton(
                'yi-pet-chat-refresh-btn',
                '刷新',
                '<path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 19 12c0-1.93-.78-3.68-2.05-4.95Z"/>',
                (e, btn) => manager.manualRefresh(btn)
            );
            refreshBtn.classList.add('pet-chat-refresh-btn');

            headerButtons.appendChild(authBtn);
            headerButtons.appendChild(refreshBtn);

            chatHeader.appendChild(headerTitle);
            chatHeader.appendChild(headerButtons);
            
            // Sidebar Toggle Button - 添加到 header（绝对定位）
            chatHeader.style.position = 'relative';
            const sidebarToggleBtn = document.createElement('button');
            sidebarToggleBtn.id = 'sidebar-toggle-btn';
            sidebarToggleBtn.className = 'yi-pet-chat-header-btn sidebar-toggle-btn';
            sidebarToggleBtn.setAttribute('aria-label', '折叠/展开会话列表');
            sidebarToggleBtn.setAttribute('title', '折叠会话列表');
            // 初始图标（侧边栏展开时显示三条横线）
            sidebarToggleBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
            sidebarToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this.toggleSidebar) {
                    this.toggleSidebar();
                }
            });
            // 位置和样式通过 CSS 类设置，按钮将始终在 title 左边
            // 不再根据侧边栏宽度设置 left，改为通过 CSS 定位在 title 左边
            chatHeader.appendChild(sidebarToggleBtn);
            
            // 初始化按钮状态
            requestAnimationFrame(() => {
                this.updateSidebarToggleButton(manager.sidebarCollapsed || false);
            });

            return chatHeader;
        }

        createHeaderButton(id, label, path, onClick) {
            const btn = document.createElement('button');
            btn.id = id;
            btn.className = 'yi-pet-chat-header-btn';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;

            btn.addEventListener('click', (e) => {
                console.log(`[ChatWindow] Header button clicked: ${label}`);
                e.stopPropagation();
                e.preventDefault();
                onClick(e, btn);
            });
            return btn;
        }

        createSidebarVue() {
            return this.createSidebar();
        }

        createSidebar() {
            const manager = this.manager;
            const sidebar = document.createElement('div');
            sidebar.className = 'session-sidebar';
            // 确保侧边栏宽度使用新的默认值
            const sidebarWidth = manager.sidebarWidth || 320;
            manager.sidebarWidth = sidebarWidth;
            sidebar.style.setProperty('--session-sidebar-width', `${sidebarWidth}px`);
            manager.sessionSidebar = sidebar;

            // Sidebar Header
            const sidebarHeader = document.createElement('div');
            sidebarHeader.className = 'session-sidebar-header';

            // First Row: Search
            const firstRow = document.createElement('div');
            firstRow.className = 'session-sidebar-search-row';

            const searchContainer = document.createElement('div');
            searchContainer.className = 'session-search-container';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = '搜索会话...';
            searchInput.value = manager.sessionTitleFilter || '';
            searchInput.id = 'session-search-input';
            searchInput.className = 'session-search-input';

            // Clear Button
            const clearBtn = document.createElement('button');
            clearBtn.innerHTML = '✕';
            clearBtn.type = 'button';
            clearBtn.className = 'session-search-clear-btn';

            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(clearBtn);
            firstRow.appendChild(searchContainer);

            sidebarHeader.appendChild(firstRow);
            sidebar.appendChild(sidebarHeader);

            // Second Row: Buttons (Toolbar) - 移到 tag-filter-list 下面
            const secondRow = document.createElement('div');
            secondRow.className = 'session-sidebar-actions-row';

            // Left Group: Batch, Export, Import
            const leftButtonGroup = document.createElement('div');
            leftButtonGroup.className = 'session-actions-left-group';

            const createSessionActionButton = (text, className) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.innerHTML = text;
                btn.className = `session-action-btn ${className}`;
                return btn;
            };

            const batchModeBtn = createSessionActionButton('☑️ 批量', 'session-action-btn--batch');
            batchModeBtn.title = '批量选择';

            const exportBtn = createSessionActionButton('⬇️ 导出', 'session-action-btn--export');

            const importBtn = createSessionActionButton('⬆️ 导入', 'session-action-btn--import');

            leftButtonGroup.appendChild(batchModeBtn);
            leftButtonGroup.appendChild(exportBtn);
            leftButtonGroup.appendChild(importBtn);

            // Right Group: Add New
            const rightButtonGroup = document.createElement('div');
            rightButtonGroup.className = 'session-actions-right-group';

            const addSessionBtn = document.createElement('button');
            addSessionBtn.type = 'button';
            addSessionBtn.innerHTML = '➕ 新建';
            addSessionBtn.className = 'session-action-btn session-action-btn--add';

            rightButtonGroup.appendChild(addSessionBtn);

            secondRow.appendChild(leftButtonGroup);
            secondRow.appendChild(rightButtonGroup);

            // Scrollable Content Container
            const scrollableContent = document.createElement('div');
            scrollableContent.className = 'session-sidebar-scrollable-content';

            // Tag Filter Container
            const tagFilterContainer = this.createTagFilter();
            scrollableContent.appendChild(tagFilterContainer);

            // Actions Row (移到 tag-filter-list 下面)
            scrollableContent.appendChild(secondRow);

            // Batch Toolbar (参考 YiWeb：在会话列表上方)
            // 使用 manager 的 buildBatchToolbar 方法（已在 petManager.ui.js 中重构）
            const batchToolbar = typeof manager.buildBatchToolbar === 'function'
                ? manager.buildBatchToolbar()
                : this.buildBatchToolbar();
            scrollableContent.appendChild(batchToolbar);

            // Session List Container
            const sessionList = document.createElement('div');
            this.sessionListContainer = sessionList;
            sessionList.className = 'session-list';
            sessionList.id = 'session-list';

            scrollableContent.appendChild(sessionList);
            sidebar.appendChild(scrollableContent);

            // Resizer
            this.createSidebarResizer(sidebar);

            this._bindSidebarDomEvents(sidebar);

            // Initial load
            setTimeout(() => {
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            }, 0);

            return sidebar;
        }

        createTagFilter() {
            const manager = this.manager;

            // Tag Filter Container
            const tagFilterContainer = document.createElement('div');
            tagFilterContainer.className = 'tag-filter-container';

            // Filter Header
            const filterHeader = document.createElement('div');
            filterHeader.className = 'tag-filter-header';

            // Filter Actions
            const filterActions = document.createElement('div');
            filterActions.className = 'tag-filter-actions';



            // Expand Toggle Button
            const expandToggleBtn = document.createElement('button');
            expandToggleBtn.className = 'tag-filter-action-btn tag-filter-expand';
            if (manager.tagFilterExpanded) expandToggleBtn.classList.add('active');
            expandToggleBtn.title = '展开/收起更多标签';
            expandToggleBtn.innerHTML = '⋮'; // Vertical ellipsis

            expandToggleBtn.addEventListener('click', () => {
                manager.tagFilterExpanded = !manager.tagFilterExpanded;
                expandToggleBtn.classList.toggle('active', manager.tagFilterExpanded);
                if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            });

            // Reverse Filter Button
            const reverseFilterBtn = document.createElement('button');
            reverseFilterBtn.className = 'tag-filter-action-btn tag-filter-reverse';
            if (manager.tagFilterReverse) reverseFilterBtn.classList.add('active');
            reverseFilterBtn.title = '反向过滤';
            reverseFilterBtn.innerHTML = '⇄';

            reverseFilterBtn.addEventListener('click', () => {
                manager.tagFilterReverse = !manager.tagFilterReverse;
                reverseFilterBtn.classList.toggle('active', manager.tagFilterReverse);
                if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            });

            // No Tags Filter Button
            const noTagsFilterBtn = document.createElement('button');
            noTagsFilterBtn.className = 'tag-filter-action-btn tag-filter-no-tags';
            if (manager.tagFilterNoTags) noTagsFilterBtn.classList.add('active');
            noTagsFilterBtn.title = '筛选无标签';
            noTagsFilterBtn.innerHTML = '∅';

            noTagsFilterBtn.addEventListener('click', () => {
                manager.tagFilterNoTags = !manager.tagFilterNoTags;
                noTagsFilterBtn.classList.toggle('active', manager.tagFilterNoTags);
                if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            });

            // Clear Filter Button
            const clearFilterBtn = document.createElement('button');
            clearFilterBtn.className = 'tag-filter-clear-btn';
            clearFilterBtn.textContent = '×';
            clearFilterBtn.title = '清除筛选';

            const updateClearFilterBtnStyle = () => {
                const hasSelectedTags = manager.selectedFilterTags && manager.selectedFilterTags.length > 0;
                const hasSearchKeyword = manager.tagFilterSearchKeyword && manager.tagFilterSearchKeyword.trim() !== '';
                const hasActiveFilter = hasSelectedTags || manager.tagFilterNoTags || hasSearchKeyword;

                clearFilterBtn.classList.toggle('active', hasActiveFilter);
            };

            // Initial check
            updateClearFilterBtnStyle();

            clearFilterBtn.addEventListener('click', () => {
                const hasSelectedTags = manager.selectedFilterTags && manager.selectedFilterTags.length > 0;
                const hasSearchKeyword = manager.tagFilterSearchKeyword && manager.tagFilterSearchKeyword.trim() !== '';
                const hasActiveFilter = hasSelectedTags || manager.tagFilterNoTags || hasSearchKeyword;

                if (hasActiveFilter) {
                    manager.selectedFilterTags = [];
                    manager.tagFilterNoTags = false;
                    manager.tagFilterSearchKeyword = '';

                    // Reset search input
                    const tagSearchInput = tagFilterContainer.querySelector('.tag-filter-search');
                    const tagSearchClearBtn = tagFilterContainer.querySelector('.tag-filter-search-clear');
                    if (tagSearchInput) tagSearchInput.value = '';
                    if (tagSearchClearBtn) tagSearchClearBtn.classList.remove('visible');

                    if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                }
            });

            filterActions.appendChild(reverseFilterBtn);
            filterActions.appendChild(noTagsFilterBtn);
            filterActions.appendChild(expandToggleBtn);
            filterActions.appendChild(clearFilterBtn);

            // Search Input
            if (typeof manager.createSearchInput === 'function') {
                const searchComp = manager.createSearchInput({
                    className: 'tag-filter-search',
                    placeholder: '搜索标签...',
                    value: manager.tagFilterSearchKeyword || '',
                    onChange: (v) => {
                        manager.tagFilterSearchKeyword = v;
                        if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                    },
                    onClear: () => {
                        manager.tagFilterSearchKeyword = '';
                        if (typeof manager.updateTagFilterUI === 'function') manager.updateTagFilterUI();
                    },
                    debounce: 300
                });
                filterHeader.appendChild(searchComp.container);
            }

            filterHeader.appendChild(filterActions);

            // Tag List Container
            const tagFilterList = document.createElement('div');
            tagFilterList.className = 'tag-filter-list';

            tagFilterContainer.appendChild(filterHeader);
            tagFilterContainer.appendChild(tagFilterList);

            return tagFilterContainer;
        }

        buildBatchToolbar() {
            const toolbar = document.createElement('div');
            toolbar.id = 'batch-toolbar';
            toolbar.className = 'batch-toolbar';

            const selectedCount = document.createElement('span');
            selectedCount.id = 'selected-count';
            selectedCount.textContent = '已选择 0 个';
            selectedCount.className = 'batch-selected-count';

            const createBtn = (text, className, onClick) => {
                const btn = document.createElement('button');
                btn.textContent = text;
                btn.className = className;
                btn.addEventListener('click', onClick);
                return btn;
            };

            const selectAllBtn = createBtn('全选', 'batch-toolbar-btn batch-toolbar-btn--default', () => {
                if (typeof this.manager.toggleSelectAll === 'function') this.manager.toggleSelectAll();
            });
            selectAllBtn.id = 'select-all-btn';

            const batchDeleteBtn = createBtn('删除', 'batch-toolbar-btn batch-toolbar-btn--danger', async () => {
                if (typeof this.manager.batchDeleteSessions === 'function') await this.manager.batchDeleteSessions();
            });
            batchDeleteBtn.id = 'batch-delete-btn';

            const cancelBtn = createBtn('取消', 'batch-toolbar-btn batch-toolbar-btn--default', () => {
                if (typeof this.manager.exitBatchMode === 'function') this.manager.exitBatchMode();
            });

            toolbar.appendChild(selectedCount);
            toolbar.appendChild(selectAllBtn);
            toolbar.appendChild(batchDeleteBtn);
            toolbar.appendChild(cancelBtn);

            return toolbar;
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
                    // 双击重置为默认宽度
                    const defaultWidth = 320;
                    const manager = this.manager;
                    manager.sidebarWidth = defaultWidth;
                    sidebar.style.setProperty('width', `${defaultWidth}px`, 'important');
                    
                    // 更新折叠按钮位置（如果按钮存在且侧边栏未折叠）
                    const toggleBtn = this.element?.querySelector('#sidebar-toggle-btn');
                    if (toggleBtn && !manager.sidebarCollapsed) {
                        toggleBtn.style.left = `${defaultWidth}px`;
                    }

                    // 保存宽度偏好
                    if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.set === 'function') {
                        chrome.storage.local.set({ sidebarWidth: defaultWidth });
                    }
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
            const startWidth = parseInt(getComputedStyle(sidebar).width, 10);
            const manager = this.manager;

            // 添加全局样式，禁用文本选择
            document.body.classList.add('pet-is-resizing');

            // 使用 requestAnimationFrame 优化性能
            let rafId = null;
            let pendingWidth = startWidth;

            // 更新宽度的辅助函数
            const updateWidth = (newWidth) => {
                // 限制宽度范围
                newWidth = Math.min(Math.max(320, newWidth), 800);
                pendingWidth = newWidth;

                if (rafId === null) {
                    rafId = requestAnimationFrame(() => {
                        sidebar.style.setProperty('width', `${pendingWidth}px`, 'important');
                        manager.sidebarWidth = pendingWidth;
                        // 更新折叠按钮位置（如果按钮存在且侧边栏未折叠）
                        const toggleBtn = this.element?.querySelector('#sidebar-toggle-btn');
                        if (toggleBtn && !manager.sidebarCollapsed) {
                            toggleBtn.style.left = `${pendingWidth}px`;
                        }
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
                sidebar.style.setProperty('width', `${pendingWidth}px`, 'important');
                manager.sidebarWidth = pendingWidth;
                
                // 更新折叠按钮位置（如果按钮存在且侧边栏未折叠）
                const toggleBtn = this.element?.querySelector('#sidebar-toggle-btn');
                if (toggleBtn && !manager.sidebarCollapsed) {
                    toggleBtn.style.left = `${pendingWidth}px`;
                }

                this.isResizingSidebar = false;
                resizer.classList.remove('dragging');
                resizer.classList.remove('hover');

                // 恢复全局样式
                document.body.classList.remove('pet-is-resizing');

                // 立即保存宽度偏好
                if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.set === 'function') {
                    chrome.storage.local.set({ sidebarWidth: manager.sidebarWidth });
                }

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        createContextSwitch() {
            const manager = this.manager;

            // Context Switch Container
            const contextSwitchContainer = document.createElement('div');
            contextSwitchContainer.className = 'context-switch-container';
            contextSwitchContainer.title = '开启/关闭页面上下文，帮助AI理解当前页面内容';

            // Label
            const contextSwitchLabel = document.createElement('span');
            contextSwitchLabel.className = 'context-switch-label';
            contextSwitchLabel.textContent = '页面上下文';

            // Switch Wrapper
            const switchWrapper = document.createElement('div');
            switchWrapper.className = 'context-switch-wrapper';

            // Switch Thumb
            const switchThumb = document.createElement('div');
            switchThumb.className = 'context-switch-thumb';

            // Hidden Checkbox
            const contextSwitch = document.createElement('input');
            contextSwitch.type = 'checkbox';
            contextSwitch.id = 'context-switch';
            contextSwitch.className = 'context-switch-input';
            contextSwitch.checked = true; // Default

            // Update State Function
            const updateSwitchState = (isChecked) => {
                if (isChecked) {
                    contextSwitchContainer.classList.add('active');
                } else {
                    contextSwitchContainer.classList.remove('active');
                }
            };

            // Initial State
            updateSwitchState(contextSwitch.checked);

            // Assembly
            switchWrapper.appendChild(switchThumb);
            contextSwitchContainer.appendChild(contextSwitchLabel);
            contextSwitchContainer.appendChild(switchWrapper);
            contextSwitchContainer.appendChild(contextSwitch);

            // Toggle logic
            const toggleSwitch = (e) => {
                e.stopPropagation();
                contextSwitch.checked = !contextSwitch.checked;
                updateSwitchState(contextSwitch.checked);
                contextSwitch.dispatchEvent(new Event('change'));
            };

            contextSwitchContainer.addEventListener('click', toggleSwitch);

            // Load from storage
            if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.get === 'function') {
                chrome.storage.local.get(['contextSwitchEnabled'], (result) => {
                    if (result.contextSwitchEnabled !== undefined) {
                        contextSwitch.checked = result.contextSwitchEnabled;
                        updateSwitchState(contextSwitch.checked);
                    }
                });
            }

            // Save to storage
            contextSwitch.addEventListener('change', () => {
                updateSwitchState(contextSwitch.checked);
                if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.set === 'function') {
                    chrome.storage.local.set({ contextSwitchEnabled: contextSwitch.checked });
                }
            });

            // Store reference and update function
            this.contextSwitchContainer = contextSwitchContainer;
            this.contextSwitchContainer.updateColor = () => {
                // No-op as CSS variables handle this now
            };

            return contextSwitchContainer;
        }

        createInputContainer(currentColor) {
            const manager = this.manager;

            // Outer container
            const inputContainer = document.createElement('div');
            inputContainer.className = 'yi-pet-chat-input-container chat-input-container';

            // Top Toolbar
            const topToolbar = document.createElement('div');
            topToolbar.className = 'yi-pet-chat-toolbar chat-input-toolbar';

            // Left Button Group
            const inputLeftButtonGroup = document.createElement('div');
            inputLeftButtonGroup.className = 'yi-pet-chat-toolbar-left chat-input-btn-group';

            // Context Editor Button
            const contextBtn = manager.createButton({
                text: '📝',
                className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
                attrs: { title: '编辑页面上下文', 'aria-label': '页面上下文' },
                onClick: () => {
                    if (typeof manager.openContextEditor === 'function') manager.openContextEditor();
                }
            });
            inputLeftButtonGroup.appendChild(contextBtn);

            // Edit Session Button - 编辑会话按钮（在标签管理按钮前面）
            const editSessionBtn = manager.createButton({
                text: '✏️',
                className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
                attrs: {
                    title: '编辑当前会话信息（标题、描述等）',
                    'aria-label': '编辑会话',
                    id: 'edit-session-btn'
                },
                onClick: async (e) => {
                    e.stopPropagation();
                    if (!manager.currentSessionId) {
                        manager.showNotification('当前没有活动会话', 'warning');
                        return;
                    }
                    if (typeof manager.editSessionTitle === 'function') {
                        await manager.editSessionTitle(manager.currentSessionId);
                    } else {
                        console.warn('editSessionTitle 方法不存在');
                        manager.showNotification('编辑功能不可用', 'error');
                    }
                }
            });
            inputLeftButtonGroup.appendChild(editSessionBtn);
            this.editSessionButton = editSessionBtn;

            // Tag Manager Button
            const tagManagerBtn = manager.createButton({
                text: '🏷️',
                className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
                attrs: { title: '管理会话标签', 'aria-label': '标签管理' },
                onClick: async () => {
                    try {
                        // 关闭其他弹窗（如微信机器人设置、页面上下文等）
                        if (typeof manager.closeWeWorkRobotSettingsModal === 'function') {
                            manager.closeWeWorkRobotSettingsModal();
                        }
                        if (typeof manager.closeContextEditor === 'function') {
                            manager.closeContextEditor();
                        }

                        // 检查是否有当前会话
                        if (!manager.currentSessionId) {
                            if (typeof manager.showNotification === 'function') {
                                manager.showNotification('请先选择一个会话', 'warning');
                            }
                            return;
                        }

                        // 确保会话存在
                        if (!manager.sessions || !manager.sessions[manager.currentSessionId]) {
                            if (typeof manager.showNotification === 'function') {
                                manager.showNotification('会话不存在，无法管理标签', 'error');
                            }
                            return;
                        }

                        // 打开标签管理器
                        if (typeof manager.openTagManager === 'function') {
                            manager.openTagManager(manager.currentSessionId);
                        } else {
                            const errorMsg = '标签管理按钮：openTagManager 方法不存在';
                            console.error(errorMsg);
                            if (typeof manager.showNotification === 'function') {
                                manager.showNotification('标签管理功能不可用', 'error');
                            }
                        }
                    } catch (error) {
                        console.error('标签管理按钮点击错误:', error);
                        if (typeof manager.showNotification === 'function') {
                            manager.showNotification(`打开标签管理失败：${error.message || '未知错误'}`, 'error');
                        }
                    }
                }
            });
            inputLeftButtonGroup.appendChild(tagManagerBtn);

            // FAQ Button
            const faqBtn = manager.createButton({
                text: '💡',
                className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
                attrs: { title: '常见问题', 'aria-label': '常见问题' },
                onClick: async () => {
                    try {
                        // 关闭其他弹窗（如微信机器人设置、页面上下文等）
                        // 与 YiWeb 保持一致的行为
                        if (typeof manager.closeWeWorkRobotSettingsModal === 'function') {
                            manager.closeWeWorkRobotSettingsModal();
                        }
                        if (typeof manager.closeContextEditor === 'function') {
                            manager.closeContextEditor();
                        }

                        // 打开常见问题管理器
                        if (typeof manager.openFaqManager === 'function') {
                            await manager.openFaqManager();
                        } else {
                            const errorMsg = '常见问题按钮：openFaqManager 方法不存在';
                            console.error(errorMsg);
                            if (typeof manager.showNotification === 'function') {
                                manager.showNotification('常见问题功能不可用', 'error');
                            }
                        }
                    } catch (error) {
                        console.error('常见问题按钮点击错误:', error);
                        if (typeof manager.showNotification === 'function') {
                            manager.showNotification(`打开常见问题失败：${error.message || '未知错误'}`, 'error');
                        }
                    }
                }
            });
            inputLeftButtonGroup.appendChild(faqBtn);

            // WeChat Settings Button
            const weChatBtn = manager.createButton({
                text: '🤖',
                className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
                attrs: { title: '微信机器人设置', 'aria-label': '微信机器人设置' },
                onClick: () => {
                    if (typeof manager.openWeChatSettings === 'function') {
                        manager.openWeChatSettings();
                    } else if (typeof manager.showSettingsModal === 'function') {
                        manager.showSettingsModal();
                    }
                }
            });
            inputLeftButtonGroup.appendChild(weChatBtn);

            // Image Upload Button
            const imageBtn = manager.createButton({
                text: '🖼️',
                className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
                attrs: { title: '上传图片', 'aria-label': '上传图片' },
                onClick: () => {
                    if (this.imageInput) {
                        this.imageInput.click();
                    }
                }
            });
            inputLeftButtonGroup.appendChild(imageBtn);

            // Hidden Image Input
            this.imageInput = document.createElement('input');
            this.imageInput.type = 'file';
            this.imageInput.accept = 'image/*';
            this.imageInput.multiple = true;
            this.imageInput.className = 'js-hidden';
            this.imageInput.id = 'yi-pet-chat-image-input';
            this.imageInput.addEventListener('change', (e) => {
                this.handleImageInputChange(e);
            });
            inputLeftButtonGroup.appendChild(this.imageInput);

            topToolbar.appendChild(inputLeftButtonGroup);

            // Right Button Group
            const inputRightButtonGroup = document.createElement('div');
            inputRightButtonGroup.className = 'yi-pet-chat-toolbar-right chat-input-btn-group';

            // Context Switch
            const contextSwitch = this.createContextSwitch();
            inputRightButtonGroup.appendChild(contextSwitch);

            // Request Status Button
            this.requestStatusButton = document.createElement('button');
            this.requestStatusButton.type = 'button';
            this.requestStatusButton.id = 'request-status-btn';
            this.requestStatusButton.className = 'chat-input-status-btn';
            this.requestStatusButton.innerHTML = '⏹️';
            this.requestStatusButton.title = '请求状态：空闲';
            this.requestStatusButton.setAttribute('aria-label', '请求状态');
            this.requestStatusButton.disabled = true;

            this.requestStatusButton.addEventListener('click', () => {
                if (this.abortRequest) {
                    this.abortRequest();
                }
            });
            inputRightButtonGroup.appendChild(this.requestStatusButton);

            topToolbar.appendChild(inputRightButtonGroup);

            // Input Wrapper
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'chat-input-wrapper';

            // Draft Images Container
            this.draftImagesContainer = document.createElement('div');
            this.draftImagesContainer.className = 'yi-pet-chat-draft-images js-hidden';
            this.draftImagesContainer.setAttribute('aria-label', '待发送图片');
            inputWrapper.appendChild(this.draftImagesContainer);

            // Input Row
            const inputRow = document.createElement('div');
            inputRow.className = 'yi-pet-chat-input-row';

            const textarea = document.createElement('textarea');
            this.messageInput = textarea; // Store reference
            textarea.id = 'yi-pet-chat-input';
            textarea.className = 'yi-pet-chat-textarea chat-message-input';
            textarea.placeholder = '输入消息... (Shift+Enter 换行，Enter 发送)';
            textarea.rows = 4;
            textarea.setAttribute('aria-label', '会话输入框');


            // Input State Management
            const updateInputState = () => {
                const hasContent = textarea.value.trim().length > 0;
                if (hasContent) {
                    textarea.classList.add('chat-message-input--has-content');
                } else {
                    textarea.classList.remove('chat-message-input--has-content');
                }
            };

            // Auto-resize
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                const newHeight = Math.max(60, textarea.scrollHeight);
                textarea.style.height = newHeight + 'px';
                updateInputState();

                // Scroll messages to bottom if needed (智能滚动)
                this.scrollToBottom();
            });

            // Focus effects
            textarea.addEventListener('focus', () => {
                // Background and box shadow handled by CSS
            });

            textarea.addEventListener('blur', () => {
                // Background and box shadow handled by CSS
            });

            // Paste Image Support
            textarea.addEventListener('paste', async (e) => {
                const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
                const imageItems = items.filter((item) => item && typeof item.type === 'string' && item.type.includes('image'));
                if (imageItems.length === 0) return;

                e.preventDefault();

                const remainingSlots = this.maxDraftImages - this.draftImages.length;
                if (remainingSlots <= 0) {
                    if (typeof this.manager.showNotification === 'function') {
                        this.manager.showNotification(`最多只能添加 ${this.maxDraftImages} 张图片`, 'warn');
                    }
                    return;
                }

                const itemsToRead = imageItems.slice(0, remainingSlots);
                await Promise.all(itemsToRead.map((item) => {
                    const file = item.getAsFile();
                    if (!file) return Promise.resolve();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const src = event?.target?.result;
                            if (src) this.draftImages.push(src);
                            resolve();
                        };
                        reader.onerror = () => resolve();
                        reader.readAsDataURL(file);
                    });
                }));

                this.updateDraftImagesDisplay();
            });

            // Composition State (IME)
            let isComposing = false;
            let compositionEndTime = 0;
            const COMPOSITION_END_DELAY = 100;

            textarea.addEventListener('compositionstart', (e) => {
                isComposing = true;
                compositionEndTime = 0;
                textarea.composing = true; // 兼容性标记
                console.log('[输入法检测] 输入法开始');
            });

            textarea.addEventListener('compositionupdate', (e) => {
                isComposing = true;
                compositionEndTime = 0;
                textarea.composing = true; // 兼容性标记
            });

            textarea.addEventListener('compositionend', (e) => {
                isComposing = false;
                compositionEndTime = Date.now();
                textarea.composing = false; // 兼容性标记
                console.log('[输入法检测] 输入法结束');
            });

            // 处理消息输入框的回车事件
            textarea.addEventListener('keydown', (e) => {
                // 检查是否按下回车键
                if (e.key !== 'Enter') {
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'k') {
                        if (this.manager && this.manager.quickCommentShortcutEnabled !== false) {
                            if (this.manager.commentState && this.manager.commentState.showQuickComment) {
                                const commentTextarea = document.getElementById('pet-quick-comment-textarea');
                                if (commentTextarea) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.stopImmediatePropagation();
                                    commentTextarea.focus();
                                    return;
                                }
                            }

                            if (typeof this.manager.openQuickCommentFromShortcut === 'function') {
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                this.manager.openQuickCommentFromShortcut();
                                return;
                            }
                        }
                    }
                    // 处理 Escape 键
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        textarea.value = '';
                        textarea.style.height = '60px';
                        updateInputState();
                        textarea.blur();
                    }
                    return;
                }

                // 输入法检测
                if (e.isComposing || e.keyCode === 229 || textarea.composing || isComposing) {
                    console.log('[输入法检测] 检测到输入法输入，忽略回车事件');
                    return;
                }

                // 检查输入法结束后的延迟
                if (e.key === 'Enter' && compositionEndTime > 0) {
                    if (Date.now() - compositionEndTime < COMPOSITION_END_DELAY) {
                        console.log('[输入法检测] 输入法刚结束，忽略回车事件');
                        return;
                    }
                }

                // 处理 Shift+Enter（换行）
                if (e.key === 'Enter' && e.shiftKey) {
                    // 允许换行，不阻止默认行为
                    return;
                }

                // 处理 Enter（发送）
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // 调用 sendMessage 发送消息
                    if (typeof this.sendMessage === 'function') {
                        this.sendMessage();
                    }
                    return;
                }
            });

            inputRow.appendChild(textarea);
            inputWrapper.appendChild(inputRow);

            // 直接将工具栏和输入包装器添加到输入容器
            inputContainer.appendChild(topToolbar);
            inputContainer.appendChild(inputWrapper);

            return inputContainer;
        }

        handleImageInputChange(e) {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;

            // 检查是否超过最大数量
            const remainingSlots = this.maxDraftImages - this.draftImages.length;
            if (remainingSlots <= 0) {
                if (typeof this.manager.showNotification === 'function') {
                    this.manager.showNotification(`最多只能添加 ${this.maxDraftImages} 张图片`, 'warn');
                }
                e.target.value = '';
                return;
            }

            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            const filesToProcess = imageFiles.slice(0, remainingSlots);

            if (imageFiles.length > remainingSlots) {
                if (typeof this.manager.showNotification === 'function') {
                    this.manager.showNotification(`只能添加 ${remainingSlots} 张图片（已达上限）`, 'warn');
                }
            }

            let loadedCount = 0;
            filesToProcess.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.draftImages.push(event.target.result);
                    loadedCount++;
                    if (loadedCount === filesToProcess.length) {
                        this.updateDraftImagesDisplay();
                    }
                };
                reader.onerror = () => {
                    console.error('图片加载失败:', file.name);
                    if (typeof this.manager.showNotification === 'function') {
                        this.manager.showNotification(`图片 ${file.name} 加载失败`, 'error');
                    }
                    loadedCount++;
                    if (loadedCount === filesToProcess.length) {
                        this.updateDraftImagesDisplay();
                    }
                };
                reader.readAsDataURL(file);
            });

            // Reset input
            e.target.value = '';
        }

        updateDraftImagesDisplay() {
            if (!this.draftImagesContainer) return;

            if (this.draftImages.length === 0) {
                this.draftImagesContainer.classList.add('js-hidden');
                this.draftImagesContainer.innerHTML = '';
                return;
            }

            this.draftImagesContainer.classList.remove('js-hidden');

            // 使用 DocumentFragment 提高性能
            const fragment = document.createDocumentFragment();

            // 清空容器（保留结构）
            const existingImages = this.draftImagesContainer.querySelectorAll('.yi-pet-chat-draft-image');
            existingImages.forEach(img => img.remove());
            const existingClearBtn = this.draftImagesContainer.querySelector('.yi-pet-chat-draft-images-clear');
            if (existingClearBtn) existingClearBtn.remove();

            this.draftImages.forEach((src, index) => {
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'yi-pet-chat-draft-image';
                imageWrapper.setAttribute('data-image-index', index);

                const img = document.createElement('img');
                img.className = 'yi-pet-chat-draft-image-preview';
                img.src = src;
                img.alt = `待发送图片 ${index + 1}`;
                img.loading = 'lazy'; // 懒加载

                // 图片加载错误处理
                img.addEventListener('error', () => {
                    imageWrapper.classList.add('yi-pet-chat-draft-image-error');
                    img.classList.add('tw-hidden');
                });

                // 图片加载成功
                img.addEventListener('load', () => {
                    imageWrapper.classList.remove('yi-pet-chat-draft-image-loading');
                    img.classList.remove('tw-hidden');
                });

                // 点击预览
                imageWrapper.addEventListener('click', (e) => {
                    // 如果点击的是删除按钮，不触发预览
                    if (e.target.classList.contains('yi-pet-chat-draft-image-remove')) {
                        return;
                    }
                    this.previewDraftImage(src, index);
                });

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'yi-pet-chat-draft-image-remove';
                removeBtn.innerHTML = '✕';
                removeBtn.setAttribute('aria-label', `移除第 ${index + 1} 张图片`);
                removeBtn.title = '移除';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止触发预览
                    this.removeDraftImage(index);
                });

                // 初始加载状态
                imageWrapper.classList.add('yi-pet-chat-draft-image-loading');

                imageWrapper.appendChild(img);
                imageWrapper.appendChild(removeBtn);
                fragment.appendChild(imageWrapper);
            });

            this.draftImagesContainer.appendChild(fragment);

            // Add clear all button
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'yi-pet-chat-draft-images-clear';
            clearBtn.textContent = `清空图片 (${this.draftImages.length})`;
            clearBtn.setAttribute('aria-label', `清空所有 ${this.draftImages.length} 张图片`);
            clearBtn.title = '清空所有图片';
            clearBtn.addEventListener('click', () => {
                this.clearDraftImages();
            });
            this.draftImagesContainer.appendChild(clearBtn);
        }

        /**
         * 移除指定索引的图片
         * @param {number} index - 图片索引
         */
        removeDraftImage(index) {
            if (index >= 0 && index < this.draftImages.length) {
                this.draftImages.splice(index, 1);
                this.updateDraftImagesDisplay();
            }
        }

        /**
         * 预览草稿图片
         * @param {string} src - 图片源
         * @param {number} index - 图片索引
         */
        previewDraftImage(src, index) {
            // 创建预览模态框
            const modal = document.createElement('div');
            modal.className = 'pet-draft-image-preview-modal';

            const img = document.createElement('img');
            img.src = src;

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.className = 'modal-close-btn';

            const closeModal = () => {
                modal.remove();
                document.body.style.overflow = '';
            };

            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target === closeBtn) {
                    closeModal();
                }
            });

            closeBtn.addEventListener('click', closeModal);

            // ESC 键关闭
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', handleKeyDown);
                }
            };
            document.addEventListener('keydown', handleKeyDown);

            // 阻止背景滚动
            document.body.style.overflow = 'hidden';

            modal.appendChild(img);
            modal.appendChild(closeBtn);
            document.body.appendChild(modal);
        }

        clearDraftImages() {
            this.draftImages = [];
            this.updateDraftImagesDisplay();
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
                console.log('[消息发送] 正在处理中，忽略重复请求');
                return;
            }

            // 确保有当前会话
            if (!manager.currentSessionId) {
                await manager.initSession();
            }

            const messagesContainer = this.messagesContainer;
            if (!messagesContainer) {
                console.error('[消息发送] 消息容器未找到');
                return;
            }

            // 设置处理状态
            this.isProcessing = true;
            const abortController = new AbortController();
            this._currentAbortController = abortController;
            this._updateRequestStatus('loading', abortController);

            try {
                // 1. 创建用户消息元素并添加到 DOM（不保存到会话）
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
                const allMessages = Array.from(messagesContainer.children).filter(msg => !msg.hasAttribute('data-welcome-message'));
                userMessageElement.setAttribute('data-chat-idx', allMessages.length.toString());
                messagesContainer.appendChild(userMessageElement);

                // 添加操作按钮
                setTimeout(() => {
                    if (typeof manager.addActionButtonsToMessage === 'function') {
                        manager.addActionButtonsToMessage(userMessageElement);
                    }
                }, 0);

                // 2. 清空输入框和图片
                if (userContent === null) {
                    textarea.value = '';
                    textarea.style.height = '60px';
                }
                this.clearDraftImages();

                // 3. 创建宠物回复消息元素（占位）
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

                // 添加操作按钮
                setTimeout(() => {
                    if (typeof manager.addActionButtonsToMessage === 'function') {
                        manager.addActionButtonsToMessage(petMessageElement);
                    }
                }, 0);

                // 滚动到底部
                this.scrollToBottom(true);

                // 4. 创建流式内容更新回调
                const messageBubble = petMessageElement.querySelector('[data-message-type="pet-bubble"]');
                if (!messageBubble) {
                    throw new Error('未找到宠物消息气泡');
                }

                const onStreamContent = this._createStreamContentCallback(messageBubble, messagesContainer, petMessageElement);

                // 5. 调用流式生成 API（第一个接口）
                const imagesForApi = images.length > 0 ? images : null;
                const reply = await manager.generatePetResponseStream(
                    messageText,
                    onStreamContent,
                    abortController,
                    { images: imagesForApi }
                );

                // 6. 获取最终内容（优先使用流式回调中保存的内容，确保与显示内容一致）
                // 如果流式回调中有内容，优先使用；否则使用 API 返回的内容
                const streamedReply = (onStreamContent && typeof onStreamContent.getFullContent === 'function')
                    ? onStreamContent.getFullContent()
                    : '';
                
                // 如果流式回调中没有内容，尝试从 DOM 中获取实际显示的内容（备选方案）
                let domContent = '';
                if (!streamedReply && messageBubble) {
                    const dataOriginalText = messageBubble.getAttribute('data-original-text');
                    if (dataOriginalText) {
                        domContent = dataOriginalText.trim();
                    }
                }
                
                // 确保使用实际显示的内容，优先级：streamedReply > reply > domContent
                const finalContent = String(streamedReply || reply || domContent || '').trim() || '请继续。';
                
                // 调试日志：检查内容一致性
                if (streamedReply && reply && streamedReply !== reply) {
                    console.warn('[消息发送] 流式回调内容和 API 返回内容不一致，使用流式回调内容');
                    console.log('流式回调内容长度:', streamedReply.length);
                    console.log('API 返回内容长度:', reply.length);
                }

                // 7. 移除流式消息状态类
                petMessageElement.classList.remove('is-streaming');
                const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
                if (finalContentDiv) {
                    finalContentDiv.classList.remove('pet-chat-content-streaming');
                }

                // 8. 确保最终内容被显示
                if (finalContent) {
                    const finalDiv = this._getOrCreateMessageContentDiv(messageBubble);
                    if (finalDiv) {
                        finalDiv.innerHTML = manager.renderMarkdown(finalContent);
                    }
                    messageBubble.setAttribute('data-original-text', finalContent);

                    // 处理 Mermaid 图表
                    setTimeout(async () => {
                        const targetDiv = messageBubble.querySelector('.pet-chat-content') || messageBubble;
                        await manager.processMermaidBlocks(targetDiv);
                    }, 100);
                }

                // 9. 流式完成后，调用 update_document 接口（第二个接口）
                if (manager.currentSessionId && typeof manager.callUpdateDocument === 'function') {
                    try {
                        // 构建消息数据
                        const userMessage = {
                            type: 'user',
                            content: messageText,
                            timestamp: userTimestamp
                        };
                        if (images.length > 0) {
                            userMessage.imageDataUrl = images[0];
                        }

                        const petMessage = {
                            type: 'pet',
                            content: finalContent,
                            timestamp: petTimestamp
                        };

                        // 调用 update_document 接口更新会话
                        await manager.callUpdateDocument(manager.currentSessionId, [userMessage, petMessage]);
                        console.log('[消息发送] update_document 接口调用成功');
                    } catch (error) {
                        console.error('[消息发送] 调用 update_document 接口时出错:', error);
                        // 不阻止流程，只记录错误
                    }
                }

                // 10. 滚动到底部
                this.scrollToBottom();

            } catch (error) {
                console.error('[消息发送] 发送消息时出错:', error);

                // 如果是取消操作，不显示错误
                if (error.name === 'AbortError' || abortController.signal.aborted) {
                    console.log('[消息发送] 请求已取消');
                    if (typeof manager.showNotification === 'function') {
                        manager.showNotification('请求已取消', 'info');
                    }
                } else {
                    // 显示错误消息
                    const errorMessage = error.message || '发送消息失败，请重试';
                    if (typeof manager.showNotification === 'function') {
                        manager.showNotification(errorMessage, 'error');
                    }

                    // 移除流式状态类
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
            } finally {
                // 清理状态
                this.isProcessing = false;
                this._currentAbortController = null;
                this._updateRequestStatus('idle');
            }
        }

        updateRequestStatus(status) {
            const btn = this.requestStatusButton;
            if (!btn) return;

            // Reset classes
            btn.classList.remove('active', 'stopping');
            btn.disabled = true;

            if (status === 'idle') {
                btn.innerHTML = '⏹️';
                btn.title = '请求状态：空闲';
            } else if (status === 'loading') {
                btn.innerHTML = '⏸️';
                btn.title = '点击终止请求';
                btn.classList.add('active');
                btn.disabled = false;
            } else if (status === 'stopping') {
                btn.innerHTML = '⏹️';
                btn.title = '正在终止请求...';
                btn.classList.add('stopping');
            }
        }

        abortRequest() {
            if (this._currentAbortController) {
                this.updateRequestStatus('stopping');
                this._currentAbortController.abort();
                this._currentAbortController = null;

                // Show notification
                if (typeof this.manager.showNotification === 'function') {
                    this.manager.showNotification('请求已取消', 'info');
                }
            }
        }

        // 只创建四个角的拖拽手柄
        createResizeHandles() {
            const positions = ['ne', 'nw', 'se', 'sw']; // 只保留四个角

            positions.forEach(pos => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${pos}`;

                handle.addEventListener('mousedown', (e) => this.initResize(e, pos));
                this.element.appendChild(handle);
                this.resizeHandles[pos] = handle;
            });
        }

        bindEvents() {
            // Drag support
            this.header.addEventListener('mousedown', (e) => {
                // 检查是否点击了按钮或按钮内的元素
                const isButton = e.target.closest('button') ||
                    e.target.closest('.yi-pet-chat-header-btn');
                if (isButton) {
                    return;
                }
                if (Date.now() < this._suppressDragUntil) return;
                this.initDrag(e);
            });

            // Double click to maximize
            this.header.addEventListener('dblclick', (e) => {
                const isButton = e.target.closest('button') ||
                    e.target.closest('.yi-pet-chat-header-btn');
                if (isButton) return;
                if (this._fullscreenAnimating) return;
                this._fullscreenAnimating = true;
                this._suppressDragUntil = Date.now() + 300;
                requestAnimationFrame(() => {
                    this.toggleFullscreen();
                    this._fullscreenAnimating = false;
                });
            });

            // Prevent scrolling propagation
            this.messagesContainer.addEventListener('wheel', (e) => {
                e.stopPropagation();
            }, { passive: true });
        }

        initDrag(e) {
            if (this.isResizing || this.manager.isFullscreen) return;

            // Don't start dragging immediately
            // Wait for movement threshold to avoid conflict with double click
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = this.element.offsetLeft;
            const startTop = this.element.offsetTop;

            let isDragStarted = false;
            const dragThreshold = 5; // pixels

            const onMouseMove = (e) => {
                // If not yet started, check threshold
                if (!isDragStarted) {
                    const moveX = Math.abs(e.clientX - startX);
                    const moveY = Math.abs(e.clientY - startY);

                    if (moveX > dragThreshold || moveY > dragThreshold) {
                        isDragStarted = true;
                        this.isDragging = true;
                        this.element.classList.add('dragging');
                    } else {
                        return; // Not moved enough yet
                    }
                }

                if (!this.isDragging) return;

                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                this.element.style.left = `${startLeft + dx}px`;
                this.element.style.top = `${startTop + dy}px`;
                this.element.style.bottom = 'auto';
                this.element.style.right = 'auto';
            };

            const onMouseUp = () => {
                if (isDragStarted) {
                    this.isDragging = false;
                    this.element.classList.remove('dragging');

                    // Save position only if actually dragged
                    if (typeof this.manager.saveWindowPosition === 'function') {
                        this.manager.saveWindowPosition();
                    }
                }

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        initResize(e, pos) {
            if (this.manager.isFullscreen) return;

            e.preventDefault();
            e.stopPropagation();
            this.isResizing = true;
            this.element.classList.add('resizing');

            const startX = e.clientX;
            const startY = e.clientY;
            const startRect = this.element.getBoundingClientRect();
            const minWidth = 400;
            const minHeight = 450;
            const maxHeight = window.innerHeight * 0.9;

            const onMouseMove = (e) => {
                if (!this.isResizing) return;

                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                let newWidth = startRect.width;
                let newHeight = startRect.height;
                let newLeft = startRect.left;
                let newTop = startRect.top;

                if (pos.includes('e')) newWidth = Math.max(minWidth, startRect.width + dx);
                if (pos.includes('s')) newHeight = Math.min(maxHeight, Math.max(minHeight, startRect.height + dy));
                if (pos.includes('w')) {
                    const width = Math.max(minWidth, startRect.width - dx);
                    newLeft = startRect.left + (startRect.width - width);
                    newWidth = width;
                }
                if (pos.includes('n')) {
                    const height = Math.min(maxHeight, Math.max(minHeight, startRect.height - dy));
                    newTop = startRect.top + (startRect.height - height);
                    newHeight = height;
                }

                this.element.style.width = `${newWidth}px`;
                this.element.style.height = `${newHeight}px`;
                this.element.style.left = `${newLeft}px`;
                this.element.style.top = `${newTop}px`;
            };

            const onMouseUp = () => {
                this.isResizing = false;
                this.element.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // Save size
                if (typeof this.manager.saveWindowSize === 'function') {
                    this.manager.saveWindowSize();
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        toggleFullscreen() {
            const manager = this.manager;
            // Sync with manager.chatWindowState
            if (!manager.chatWindowState) {
                manager.chatWindowState = {};
            }

            if (!manager.isFullscreen) {
                // Enter fullscreen
                manager.preFullscreenStyle = {
                    width: this.element.style.width,
                    height: this.element.style.height,
                    top: this.element.style.top,
                    left: this.element.style.left,
                    bottom: this.element.style.bottom,
                    right: this.element.style.right,
                    transform: this.element.style.transform
                };

                // Clear inline styles to ensure CSS class with !important takes precedence
                // Because inline styles with !important (set by updateChatWindowStyle) would override CSS !important
                this.element.style.removeProperty('width');
                this.element.style.removeProperty('height');
                this.element.style.removeProperty('top');
                this.element.style.removeProperty('left');
                this.element.style.removeProperty('bottom');
                this.element.style.removeProperty('right');
                this.element.style.removeProperty('transform');
                this.element.style.removeProperty('max-height');

                manager.isFullscreen = true;
                manager.chatWindowState.isFullscreen = true;
                this.element.classList.add('fullscreen');

                // 立即更新全屏高度
                this.updateFullscreenHeight();

                // 延迟再次更新，确保 CSS 类已应用
                requestAnimationFrame(() => {
                    this.updateFullscreenHeight();
                });

                // 添加窗口 resize 事件监听，确保全屏时高度始终正确
                if (!this._fullscreenResizeHandler) {
                    this._fullscreenResizeHandler = () => {
                        if (manager.isFullscreen) {
                            // 使用防抖，避免频繁更新
                            if (this._fullscreenResizeTimer) {
                                clearTimeout(this._fullscreenResizeTimer);
                            }
                            this._fullscreenResizeTimer = setTimeout(() => {
                                this.updateFullscreenHeight();
                            }, 50);
                        }
                    };
                    window.addEventListener('resize', this._fullscreenResizeHandler);
                    // 也监听 visualViewport 变化（移动设备浏览器工具栏）
                    if (window.visualViewport) {
                        window.visualViewport.addEventListener('resize', this._fullscreenResizeHandler);
                        window.visualViewport.addEventListener('scroll', this._fullscreenResizeHandler);
                    }
                }

                if (this.header) {
                    this.header.title = '双击退出全屏';
                    // header borderRadius handled by CSS class
                }
            } else {
                // Exit fullscreen
                // 清除防抖定时器
                if (this._fullscreenResizeTimer) {
                    clearTimeout(this._fullscreenResizeTimer);
                    this._fullscreenResizeTimer = null;
                }

                // 移除 resize 事件监听
                if (this._fullscreenResizeHandler) {
                    window.removeEventListener('resize', this._fullscreenResizeHandler);
                    if (window.visualViewport) {
                        window.visualViewport.removeEventListener('resize', this._fullscreenResizeHandler);
                        window.visualViewport.removeEventListener('scroll', this._fullscreenResizeHandler);
                    }
                    this._fullscreenResizeHandler = null;
                }

                if (manager.preFullscreenStyle) {
                    Object.assign(this.element.style, manager.preFullscreenStyle);
                }
                // borderRadius handled by CSS class

                manager.isFullscreen = false;
                manager.chatWindowState.isFullscreen = false;
                this.element.classList.remove('fullscreen');

                if (this.header) {
                    this.header.title = '拖拽移动窗口 | 双击全屏';
                    // header borderRadius handled by CSS class
                }
            }
        }

        /**
         * 更新全屏模式下的窗口高度
         */
        updateFullscreenHeight() {
            if (!this.manager || !this.manager.isFullscreen || !this.element) return;

            // 获取视口高度，优先使用 visualViewport（移动设备，处理浏览器工具栏）
            let viewportHeight;
            if (window.visualViewport && window.visualViewport.height) {
                viewportHeight = window.visualViewport.height;
            } else {
                viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            }

            // 确保高度是有效数值
            if (!viewportHeight || viewportHeight <= 0) {
                viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
            }

            // 设置窗口高度和最大高度
            this.element.style.setProperty('height', `${viewportHeight}px`, 'important');
            this.element.style.setProperty('max-height', `${viewportHeight}px`, 'important');
            this.element.style.setProperty('min-height', `${viewportHeight}px`, 'important');

            // 强制重新计算布局，确保子元素高度正确
            requestAnimationFrame(() => {
                // 触发重排
                void this.element.offsetHeight;
                
                // 确保内容容器高度正确
                const contentContainer = this.element.querySelector('.yi-pet-chat-content-container');
                if (contentContainer) {
                    void contentContainer.offsetHeight;
                }
                
                // 确保主内容区域高度正确
                const mainContent = this.element.querySelector('.yi-pet-chat-main-content, .yi-pet-chat-right-panel');
                if (mainContent) {
                    void mainContent.offsetHeight;
                }
                
                // 确保消息容器能正确显示滚动条
                if (this.messagesContainer) {
                    void this.messagesContainer.offsetHeight;
                }
                
                // 确保输入框容器可见
                const inputContainer = this.inputContainer || this.element.querySelector('.yi-pet-chat-input-container');
                if (inputContainer) {
                    void inputContainer.offsetHeight;
                    // 确保输入框容器在视口内且不被压缩
                    inputContainer.style.setProperty('flex-shrink', '0', 'important');
                    inputContainer.style.setProperty('position', 'relative', 'important');
                    inputContainer.style.setProperty('z-index', '10', 'important');
                }
            });
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

            const width = state.width || 850;
            const height = state.height || 720;
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
                return distance < 140;
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
            if (!this.messagesContainer) return;
            while (this.messagesContainer.firstChild) {
                this.messagesContainer.removeChild(this.messagesContainer.firstChild);
            }
        }

        _getOrCreateMessageContentDiv(messageBubble, streaming = false) {
            if (!messageBubble) return null;
            let contentDiv = messageBubble.querySelector('.pet-chat-content');
            if (!contentDiv) {
                contentDiv = document.createElement('div');
                contentDiv.className = 'pet-chat-content md-preview-body';
                const typingDiv = messageBubble.querySelector('.pet-chat-typing');
                if (typingDiv) typingDiv.remove();
                const meta = messageBubble.querySelector('.pet-chat-meta');
                if (meta) {
                    messageBubble.insertBefore(contentDiv, meta);
                } else {
                    messageBubble.appendChild(contentDiv);
                }
            }
            if (streaming && !contentDiv.classList.contains('pet-chat-content-streaming')) {
                contentDiv.classList.add('pet-chat-content-streaming');
            }
            return contentDiv;
        }

        /**
         * 查找与宠物消息对应的用户消息
         * @param {HTMLElement} messageDiv - 宠物消息元素
         * @param {HTMLElement} messagesContainer - 消息容器
         * @returns {string|null} 用户消息文本，如果未找到则返回 null
         */
        _findUserMessageForRetry(messageDiv, messagesContainer) {
            const allMessages = Array.from(messagesContainer.children);
            const currentIndex = allMessages.indexOf(messageDiv);

            if (currentIndex === -1) {
                throw new Error('当前消息不在消息容器中');
            }

            // 向前遍历所有消息，找到最近的用户消息
            for (let i = currentIndex - 1; i >= 0; i--) {
                const messageElement = allMessages[i];
                const userBubble = messageElement.querySelector('[data-message-type="user-bubble"]');

                if (userBubble) {
                    // 优先使用 data-original-text，如果没有则使用文本内容
                    const userMessageText = userBubble.getAttribute('data-original-text') ||
                        userBubble.textContent ||
                        userBubble.innerText;

                    if (userMessageText && userMessageText.trim()) {
                        return userMessageText.trim();
                    }
                }
            }

            return null;
        }

        /**
         * 获取等待图标（从欢迎动作按钮中获取）
         * @returns {string} 等待图标
         */
        _getWaitingIcon() {
            if (this.element) {
                const welcomeActions = this.element.querySelector('#pet-welcome-actions');
                if (welcomeActions) {
                    const firstButton = welcomeActions.querySelector('[data-action-key]');
                    if (firstButton && firstButton.innerHTML) {
                        return firstButton.innerHTML.trim();
                    }
                }
            }
            return '⏳'; // 默认图标
        }

        /**
         * 更新重新生成按钮的状态
         * @param {HTMLElement} button - 按钮元素
         * @param {string} state - 状态: 'idle' | 'loading' | 'success' | 'error'
         */
        _updateTryAgainButtonState(button, state) {
            const states = {
                idle: {
                    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
                },
                loading: {
                    icon: this._getWaitingIcon()
                },
                success: {
                    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
                },
                error: {
                    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`
                }
            };

            const buttonState = states[state] || states.idle;
            button.innerHTML = buttonState.icon;

            // 移除所有状态类
            button.classList.remove('try-again-button--loading', 'try-again-button--success', 'try-again-button--error');

            // 添加当前状态类
            if (state !== 'idle') {
                button.classList.add(`try-again-button--${state}`);
            }
        }

        /**
         * 更新请求状态（loading/idle）
         * @param {string} status - 状态: 'loading' | 'idle'
         * @param {AbortController|null} abortController - 中止控制器
         */
        _updateRequestStatus(status, abortController = null) {
            if (this._setAbortController) {
                this._setAbortController(abortController);
            }
            // 更新 isProcessing 状态
            this.isProcessing = (status === 'loading');

            // 更新所有标准按钮的 disabled 状态
            if (this.element) {
                const metaActions = this.element.querySelectorAll('.pet-chat-meta-actions');
                metaActions.forEach(container => {
                    const buttons = container.querySelectorAll('button[data-standard-button="true"]');
                    buttons.forEach(btn => {
                        // 只更新编辑、重新发送、重新生成、删除按钮的 disabled 状态
                        const btnText = btn.textContent || '';
                        if (btnText.includes('📨') || btnText.includes('🔄') || btnText.includes('🗑️')) {
                            btn.disabled = this.isProcessing;
                        }
                    });
                });
            }
        }

        // Helper to set abort controller (migrated from logic in _updateRequestStatus)
        _setAbortController(controller) {
            this.abortController = controller;
        }

        /**
         * 创建流式内容更新回调
         * @param {HTMLElement} messageBubble - 消息气泡元素
         * @param {HTMLElement} messagesContainer - 消息容器
         * @param {HTMLElement} messageDiv - 消息容器元素（可选，用于添加 is-streaming 类）
         * @returns {Function} 内容更新回调函数
         */
        _createStreamContentCallback(messageBubble, messagesContainer, messageDiv = null) {
            let fullContent = '';

            // 添加流式消息状态类（与 YiWeb 保持一致）
            if (messageDiv) {
                messageDiv.classList.add('is-streaming');
            }

            const callback = (chunk, accumulatedContent) => {
                fullContent = accumulatedContent;

                // 确保内容容器存在且具有正确的类名（与 YiWeb 保持一致）
                let contentDiv = messageBubble.querySelector('.pet-chat-content');
                if (!contentDiv) {
                    // 如果不存在，创建内容容器
                    contentDiv = document.createElement('div');
                    contentDiv.className = 'pet-chat-content md-preview-body pet-chat-content-streaming';
                    // 移除现有的 typing 指示器
                    const typingDiv = messageBubble.querySelector('.pet-chat-typing');
                    if (typingDiv) {
                        typingDiv.remove();
                    }
                    const meta = messageBubble.querySelector('.pet-chat-meta');
                    if (meta) {
                        messageBubble.insertBefore(contentDiv, meta);
                    } else {
                        messageBubble.appendChild(contentDiv);
                    }
                } else {
                    // 确保有 streaming 类
                    if (!contentDiv.classList.contains('pet-chat-content-streaming')) {
                        contentDiv.classList.add('pet-chat-content-streaming');
                    }
                }

                // 更新内容
                contentDiv.innerHTML = this.manager.renderMarkdown(fullContent);
                messageBubble.setAttribute('data-original-text', fullContent);

                // 处理可能的 Mermaid 图表
                if (messageBubble._mermaidTimeout) {
                    clearTimeout(messageBubble._mermaidTimeout);
                }
                messageBubble._mermaidTimeout = setTimeout(async () => {
                    try {
                        await this.manager.loadMermaid();
                        const hasMermaidCode = contentDiv.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"], div.mermaid');
                        if (hasMermaidCode) {
                            await this.manager.processMermaidBlocks(contentDiv);
                        }
                    } catch (error) {
                        console.error('处理 Mermaid 图表时出错:', error);
                    }
                    messageBubble._mermaidTimeout = null;
                }, 500);

                if (this.messagesContainer) {
                    this.scrollToBottom(); // 智能滚动
                }
                return fullContent;
            };
            callback.getFullContent = () => fullContent;
            return callback;
        }

        /**
         * 执行重新生成回复的核心逻辑
         * @param {HTMLElement} messageDiv - 宠物消息元素
         * @param {string} userMessageText - 用户消息文本
         * @param {HTMLElement} messagesContainer - 消息容器
         * @returns {Promise<string>} 生成的回复内容
         */
        async _retryGenerateResponse(messageDiv, userMessageText, messagesContainer) {
            const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
            if (!messageBubble) {
                throw new Error('未找到消息气泡');
            }

            const waitingIcon = this._getWaitingIcon();
            // 清除现有内容，准备重新生成
            const contentDiv = this._getOrCreateMessageContentDiv(messageBubble);
            if (contentDiv) {
                contentDiv.innerHTML = this.manager.renderMarkdown(`${waitingIcon} 正在重新生成回复...`);
                messageBubble.setAttribute('data-original-text', `${waitingIcon} 正在重新生成回复...`);
            }
            this.scrollToBottom(true); // 显示等待状态后强制滚动

            // 创建流式内容更新回调（传入 messageDiv 以支持 is-streaming 类）
            const onStreamContent = this._createStreamContentCallback(messageBubble, messagesContainer, messageDiv);

            // 创建 AbortController 用于终止请求
            const abortController = new AbortController();
            this._updateRequestStatus('loading', abortController);

            try {
                // 调用 API 重新生成
                const reply = await this.manager.generatePetResponseStream(userMessageText, onStreamContent, abortController);
                const streamedReply = (onStreamContent && typeof onStreamContent.getFullContent === 'function')
                    ? onStreamContent.getFullContent()
                    : '';
                const finalContent = String(streamedReply || reply || '').trim() || '请继续。';

                // 移除流式消息状态类（与 YiWeb 保持一致）
                messageDiv.classList.remove('is-streaming');
                const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
                if (finalContentDiv) {
                    finalContentDiv.classList.remove('pet-chat-content-streaming');
                }

                // 确保最终内容被显示（流式更新可能已经完成，但再次确认）
                if (finalContent) {
                    const finalDiv = this._getOrCreateMessageContentDiv(messageBubble);
                    if (finalDiv) {
                        finalDiv.innerHTML = this.manager.renderMarkdown(finalContent);
                    }
                    messageBubble.setAttribute('data-original-text', finalContent);
                    setTimeout(async () => {
                        const targetDiv = messageBubble.querySelector('.pet-chat-content') || messageBubble;
                        await this.manager.processMermaidBlocks(targetDiv);
                    }, 100);
                }

                // 更新复制按钮
                const copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
                if (copyButtonContainer && finalContent) {
                    // 按钮现在由 addActionButtonsToMessage 统一管理
                    // 不再需要单独调用 addCopyButton
                }

                this.scrollToBottom(); // 智能滚动

                return finalContent;
            } catch (error) {
                // 移除流式消息状态类（确保即使出错也能清理）
                messageDiv.classList.remove('is-streaming');
                const errorContentDiv = messageBubble.querySelector('.pet-chat-content');
                if (errorContentDiv) {
                    errorContentDiv.classList.remove('pet-chat-content-streaming');
                }
                throw error;
            } finally {
                // 确保移除流式状态类
                messageDiv.classList.remove('is-streaming');
                const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
                if (finalContentDiv) {
                    finalContentDiv.classList.remove('pet-chat-content-streaming');
                }
                this._updateRequestStatus('idle', null);
            }
        }

        /**
         * 处理重新生成失败的情况
         * @param {HTMLElement} messageDiv - 宠物消息元素
         * @param {Error} error - 错误对象
         */
        _handleRetryError(messageDiv, error) {
            const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

            if (!isAbortError) {
                console.error('重新生成回复失败:', error);

                const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                if (messageBubble) {
                    const originalText = messageBubble.getAttribute('data-original-text') ||
                        '抱歉，重新生成失败，请稍后重试。';
                    const contentDiv = this._getOrCreateMessageContentDiv(messageBubble);
                    if (contentDiv) {
                        contentDiv.innerHTML = this.manager.renderMarkdown(originalText);
                    }
                }
            }

            return isAbortError;
        }

        _setupSidebarAfterRender(sidebarEl, options = {}) {
            const manager = this.manager;
            const { store, computedProps, methods, bindSidebarDomEvents } = options;

            const sidebarWidth = manager.sidebarWidth || 320;
            manager.sidebarWidth = sidebarWidth;
            sidebarEl.style.setProperty('--session-sidebar-width', `${sidebarWidth}px`);
            manager.sessionSidebar = sidebarEl;

            const tagMount = sidebarEl.querySelector('#yi-pet-tag-filter-mount');
            if (tagMount) {
                const tagFilterContainer = this.createTagFilter();
                tagMount.replaceWith(tagFilterContainer);
            }

            const batchMount = sidebarEl.querySelector('#yi-pet-batch-toolbar-mount');
            if (batchMount) {
                const batchToolbar =
                    typeof manager.buildBatchToolbar === 'function' ? manager.buildBatchToolbar() : this.buildBatchToolbar();
                batchMount.replaceWith(batchToolbar);
            }

            if (bindSidebarDomEvents) {
                this._bindSidebarDomEvents(sidebarEl, { store, computedProps, methods });
            }

            this.sessionListContainer = sidebarEl.querySelector('#session-list');
            this.createSidebarResizer(sidebarEl);

            setTimeout(() => {
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            }, 0);
        }

        _bindHeaderDomEvents(rootEl, methods) {
            if (!rootEl || rootEl.hasAttribute('data-header-events-bound')) return;
            rootEl.setAttribute('data-header-events-bound', 'true');

            const authBtn = rootEl.querySelector('#yi-pet-chat-auth-btn');
            if (authBtn && typeof methods?.onAuthClick === 'function') {
                authBtn.addEventListener('click', (e) => methods.onAuthClick(e));
            }

            const refreshBtn = rootEl.querySelector('#yi-pet-chat-refresh-btn');
            if (refreshBtn && typeof methods?.onRefreshClick === 'function') {
                refreshBtn.addEventListener('click', (e) => methods.onRefreshClick(e));
            }

            const sidebarToggleBtn = rootEl.querySelector('#sidebar-toggle-btn');
            if (sidebarToggleBtn && typeof methods?.onSidebarToggleClick === 'function') {
                sidebarToggleBtn.addEventListener('click', (e) => methods.onSidebarToggleClick(e));
            }
        }

        _bindSidebarDomEvents(sidebarEl, options = {}) {
            if (!sidebarEl || sidebarEl.hasAttribute('data-sidebar-events-bound')) return;
            sidebarEl.setAttribute('data-sidebar-events-bound', 'true');

            const manager = this.manager;
            const { store, computedProps, methods } = options;

            const searchInput = sidebarEl.querySelector('#session-search-input');
            const searchContainer = sidebarEl.querySelector('.session-search-container');
            const clearBtn = searchContainer ? searchContainer.querySelector('button') : null;

            if (clearBtn && !clearBtn.classList.contains('session-search-clear-btn')) {
                clearBtn.className = 'session-search-clear-btn';
            }

            const isClearVisible = () => {
                const computedVisible = computedProps?.clearVisible;
                if (computedVisible && typeof computedVisible === 'object' && 'value' in computedVisible) {
                    return !!computedVisible.value;
                }
                const value = searchInput ? searchInput.value : String(store?.searchValue?.value || '');
                return !!String(value || '').trim();
            };

            const updateClearBtn = () => {
                if (!clearBtn) return;
                const visible = isClearVisible();
                if (visible) clearBtn.classList.add('visible');
                else clearBtn.classList.remove('visible');
            };

            if (searchInput) {
                if (store?.searchValue && typeof store.searchValue === 'object' && 'value' in store.searchValue) {
                    searchInput.value = store.searchValue.value || '';
                } else {
                    searchInput.value = manager.sessionTitleFilter || '';
                }

                searchInput.addEventListener('input', (e) => {
                    if (typeof methods?.onSearchInput === 'function') {
                        methods.onSearchInput(e);
                    } else {
                        manager.sessionTitleFilter = String(e?.target?.value || '').trim();
                        if (this._searchTimer) clearTimeout(this._searchTimer);
                        this._searchTimer = setTimeout(() => {
                            if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                        }, 300);
                    }
                    updateClearBtn();
                });

                searchInput.addEventListener('keydown', (e) => {
                    if (typeof methods?.onSearchKeydown === 'function') {
                        methods.onSearchKeydown(e);
                    } else if (e?.key === 'Escape') {
                        if (clearBtn) clearBtn.click();
                    }
                    updateClearBtn();
                });

                searchInput.addEventListener('click', (e) => e?.stopPropagation?.());
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    if (typeof methods?.clearSearch === 'function') {
                        methods.clearSearch();
                        if (searchInput && store?.searchValue) searchInput.value = store.searchValue.value || '';
                    } else {
                        if (searchInput) searchInput.value = '';
                        manager.sessionTitleFilter = '';
                        if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                    }
                    updateClearBtn();
                });
            }

            updateClearBtn();

            const batchBtn = sidebarEl.querySelector('.session-action-btn--batch');
            if (batchBtn) {
                batchBtn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    if (typeof methods?.onBatchToggleClick === 'function') {
                        methods.onBatchToggleClick();
                    } else if (manager.batchMode) {
                        if (typeof manager.exitBatchMode === 'function') manager.exitBatchMode();
                    } else {
                        if (typeof manager.enterBatchMode === 'function') manager.enterBatchMode();
                    }
                });
            }

            const exportBtn = sidebarEl.querySelector('.session-action-btn--export');
            if (exportBtn) {
                exportBtn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    if (typeof methods?.onExportClick === 'function') {
                        methods.onExportClick();
                    } else if (typeof manager.exportSessionsToZip === 'function') {
                        manager.exportSessionsToZip();
                    }
                });
            }

            const importBtn = sidebarEl.querySelector('.session-action-btn--import');
            if (importBtn) {
                importBtn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    if (typeof methods?.onImportClick === 'function') {
                        methods.onImportClick();
                        return;
                    }

                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = '.zip';
                    fileInput.className = 'js-hidden';
                    fileInput.addEventListener('change', async (e2) => {
                        const file = e2?.target?.files?.[0];
                        if (file && typeof manager.importSessionsFromZip === 'function') {
                            await manager.importSessionsFromZip(file);
                        }
                    });
                    document.body.appendChild(fileInput);
                    fileInput.click();
                    document.body.removeChild(fileInput);
                });
            }

            const addBtn = sidebarEl.querySelector('.session-action-btn--add');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e?.stopPropagation?.();
                    if (typeof methods?.onAddClick === 'function') {
                        methods.onAddClick();
                    } else if (typeof manager.createBlankSession === 'function') {
                        manager.createBlankSession();
                    }
                });
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
            const bubble = messageDiv.querySelector('.pet-chat-bubble');
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
    }

    // Export to namespace
    window.PetManager.Components.ChatWindow = ChatWindow;

})();
