(function () {
    'use strict';

    if (typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    const TEMPLATE_RESOURCE_PATH = 'src/features/petManager/content/components/sessionEditor/SessionInfoEditor/index.html';
    let sessionInfoEditorTemplateCache = '';

    const ensureMdSuffix = (str) => {
        if (!str || !String(str).trim()) return '';
        const s = String(str).trim();
        return s.endsWith('.md') ? s : `${s}.md`;
    };

    const stripMdSuffix = (str) => {
        const s = String(str || '').trim();
        return s.toLowerCase().endsWith('.md') ? s.slice(0, -3) : s;
    };

    const normalizeNameSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, '_');

    const extractChatReplyText = (result) => {
        if (!result || typeof result !== 'object') return '';
        if (result.code !== 0) return '';
        const data = result.data || {};
        if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
        if (typeof data.content === 'string' && data.content.trim()) return data.content.trim();
        return '';
    };

    function canUseVueTemplate(Vue) {
        if (typeof Vue?.compile !== 'function') return false;
        try {
            Function('return 1')();
            return true;
        } catch (_) {
            return false;
        }
    }

    async function loadTemplate() {
        if (sessionInfoEditorTemplateCache) return sessionInfoEditorTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        sessionInfoEditorTemplateCache = await DomHelper.loadHtmlTemplate(
            TEMPLATE_RESOURCE_PATH,
            '#yi-pet-session-info-editor-template',
            'Failed to load SessionInfoEditor template'
        );
        return sessionInfoEditorTemplateCache;
    }

    function getSessionEditorOverlay(manager) {
        return (manager?.chatWindow ? manager.chatWindow.querySelector('#pet-session-info-editor') : null) || document.body.querySelector('#pet-session-info-editor');
    }

    function getSessionEditorStore(manager) {
        return manager?._sessionInfoEditorStore || getSessionEditorOverlay(manager)?._store || null;
    }

    proto.ensureSessionInfoEditorUi = function () {
        const existing = getSessionEditorOverlay(this);
        if (existing) {
            if (existing._store) this._sessionInfoEditorStore = existing._store;
            return;
        }

        const Vue = window.Vue || {};
        const { createApp, reactive, watch, defineComponent, ref, nextTick, h } = Vue;
        if (typeof createApp !== 'function' || typeof reactive !== 'function' || typeof defineComponent !== 'function') return;
        const useTemplate = canUseVueTemplate(Vue);
        if (!useTemplate && typeof h !== 'function') return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-session-info-editor';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', '编辑会话');

        const mountEl = document.createElement('div');
        overlay.appendChild(mountEl);

        const store = reactive({
            visible: false,
            sessionId: '',
            title: '',
            url: '',
            description: '',
            isSaving: false,
            isGeneratingDescription: false
        });

        overlay._store = store;
        this._sessionInfoEditorStore = store;

        if (typeof watch === 'function') {
            watch(
                () => store.visible,
                (v) => {
                    overlay.classList.toggle('js-visible', !!v);
                },
                { immediate: true }
            );
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeSessionInfoEditor();
            }
        });

        overlay._mountPromise = (async () => {
            const resolvedTemplate = useTemplate ? String(await loadTemplate() || '').trim() : '';
            if (useTemplate && !resolvedTemplate) return;

            const manager = this;
            const SessionInfoEditor = defineComponent({
                name: 'YiPetSessionInfoEditor',
                setup() {
                    const modalEl = ref(null);
                    const titleInputEl = ref(null);

                    if (typeof watch === 'function') {
                        watch(
                            () => store.visible,
                            async (v) => {
                                if (!v) return;
                                await nextTick();
                                const el = titleInputEl.value;
                                if (el && typeof el.focus === 'function') {
                                    try {
                                        el.focus();
                                        if (typeof el.select === 'function') el.select();
                                    } catch (_) {}
                                }
                            }
                        );
                    }

                    const close = () => manager.closeSessionInfoEditor();
                    const save = async () => manager.saveSessionInfo(store.sessionId);
                    const generateDescription = async () => manager.generateSessionDescription(store.sessionId);

                    return { store, modalEl, titleInputEl, close, save, generateDescription };
                },
                ...(useTemplate
                    ? { template: resolvedTemplate }
                    : {
                          render() {
                              const onEsc = (e) => {
                                  if (!e || e.key !== 'Escape') return;
                                  e.preventDefault?.();
                                  e.stopPropagation?.();
                                  this.close();
                              };
                              return h(
                                  'div',
                                  {
                                      ref: this.modalEl,
                                      class: 'aicr-session-context-modal-body aicr-session-settings-modal-body session-editor-modal',
                                      role: 'document',
                                      tabindex: 0,
                                      onKeydown: onEsc
                                  },
                                  [
                                      h('div', { class: 'aicr-session-context-modal-header session-editor-header' }, [
                                          h('div', { class: 'aicr-session-context-modal-title session-editor-title' }, '✏️ 编辑会话'),
                                          h('div', { class: 'aicr-session-context-modal-header-right session-editor-header-right' }, [
                                              h(
                                                  'button',
                                                  {
                                                      type: 'button',
                                                      class: 'aicr-session-context-toolbar-btn primary session-editor-save',
                                                      'aria-label': '保存',
                                                      title: '保存',
                                                      disabled: !!this.store.isSaving,
                                                      onClick: this.save
                                                  },
                                                  this.store.isSaving ? '保存中...' : '保存'
                                              ),
                                              h(
                                                  'div',
                                                  {
                                                      class: 'aicr-session-context-modal-close',
                                                      role: 'button',
                                                      'aria-label': '关闭',
                                                      tabindex: 0,
                                                      onClick: this.close
                                                  },
                                                  '✕'
                                              )
                                          ])
                                      ]),
                                      h('div', { class: 'aicr-session-context-modal-content aicr-session-settings-modal-content' }, [
                                          h('div', { class: 'aicr-session-settings-field' }, [
                                              h('label', { class: 'aicr-session-settings-label', for: 'session-edit-title' }, '标题'),
                                              h('input', {
                                                  ref: this.titleInputEl,
                                                  id: 'session-edit-title',
                                                  type: 'text',
                                                  class: 'aicr-session-settings-input',
                                                  placeholder: '请输入会话标题',
                                                  autocomplete: 'off',
                                                  spellcheck: 'false',
                                                  'aria-label': '会话标题',
                                                  value: this.store.title,
                                                  onInput: (e) => {
                                                      this.store.title = e?.target?.value ?? '';
                                                  }
                                              })
                                          ]),
                                          h('div', { class: 'aicr-session-settings-field' }, [
                                              h('label', { class: 'aicr-session-settings-label', for: 'session-edit-url' }, '网址'),
                                              h('input', {
                                                  id: 'session-edit-url',
                                                  type: 'url',
                                                  class: 'aicr-session-settings-input',
                                                  placeholder: '请输入网址（可选）',
                                                  autocomplete: 'off',
                                                  spellcheck: 'false',
                                                  'aria-label': '会话网址',
                                                  value: this.store.url,
                                                  onInput: (e) => {
                                                      this.store.url = e?.target?.value ?? '';
                                                  }
                                              }),
                                              h('div', { class: 'aicr-session-settings-hint' }, '网址将显示在欢迎卡片中')
                                          ]),
                                          h('div', { class: 'aicr-session-settings-field' }, [
                                              h('div', { class: 'aicr-session-edit-description-header' }, [
                                                  h('label', { class: 'aicr-session-settings-label', for: 'session-edit-description' }, '描述'),
                                                  h(
                                                      'button',
                                                      {
                                                          type: 'button',
                                                          class: 'aicr-session-context-toolbar-btn session-editor-generate-description',
                                                          'aria-label': 'AI生成描述',
                                                          title: '根据页面上下文内容AI智能生成描述',
                                                          disabled: !!this.store.isGeneratingDescription,
                                                          onClick: this.generateDescription
                                                      },
                                                      this.store.isGeneratingDescription ? '生成中...' : '✨ AI生成'
                                                  )
                                              ]),
                                              h('textarea', {
                                                  id: 'session-edit-description',
                                                  class: 'aicr-session-settings-textarea',
                                                  rows: 6,
                                                  placeholder: '请输入会话描述，或点击AI生成按钮自动生成',
                                                  'aria-label': '会话描述',
                                                  value: this.store.description,
                                                  onInput: (e) => {
                                                      this.store.description = e?.target?.value ?? '';
                                                  }
                                              }),
                                              h('div', { class: 'aicr-session-settings-hint' }, '描述将帮助您更好地理解和管理会话内容')
                                          ])
                                      ])
                                  ]
                              );
                          }
                      })
            });

            overlay._vueApp = createApp(SessionInfoEditor);
            overlay._vueInstance = overlay._vueApp.mount(mountEl);
        })();

        if (this.chatWindow) {
            const currentPosition = window.getComputedStyle(this.chatWindow).position;
            if (currentPosition === 'static') {
                this.chatWindow.style.position = 'relative';
            }
            this.chatWindow.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }
    };

    proto.openSessionInfoEditor = function (sessionId, originalTitle, originalDescription) {
        this.ensureSessionInfoEditorUi();
        const store = getSessionEditorStore(this);
        if (!store) return;

        const resolvedSessionId = String(sessionId || '').trim();
        store.sessionId = resolvedSessionId;

        const session = resolvedSessionId && this.sessions ? this.sessions[resolvedSessionId] : null;
        store.title = normalizeNameSpaces(String(originalTitle || session?.title || '').trim());
        store.url = String(session?.url || '').trim();
        store.description = String(originalDescription || session?.pageDescription || '').trim();
        store.visible = true;
    };

    proto.closeSessionInfoEditor = function () {
        const store = getSessionEditorStore(this);
        if (store) store.visible = false;
    };

    proto.saveSessionInfo = async function (sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            return;
        }

        const store = getSessionEditorStore(this);
        const rawNewTitle = normalizeNameSpaces(String(store?.title || '').trim());
        const newUrl = String(store?.url || '').trim();
        const newDescription = String(store?.description || '').trim();

        if (!rawNewTitle) {
            if (this.showNotification) this.showNotification('标题不能为空', 'error');
            return;
        }

        if (store) store.isSaving = true;

        const session = this.sessions[sessionId];
        const originalTitle = session.title || '未命名会话';
        const originalUrl = session.url || '';
        const originalDescription = session.pageDescription || '';
        const normalizedNewTitle = ensureMdSuffix(rawNewTitle);
        const normalizedOriginalTitle = ensureMdSuffix(originalTitle);
        const titleChanged = normalizedNewTitle !== normalizedOriginalTitle;

        if (!titleChanged && newUrl === originalUrl && newDescription === originalDescription) {
            this.closeSessionInfoEditor();
            if (store) store.isSaving = false;
            return;
        }

        try {
            if (titleChanged) {
                const buildFilePath = (session, title, normalizeFolders = true) => {
                    const tags = Array.isArray(session.tags) ? session.tags : [];
                    let currentPath = '';
                    tags.forEach((folderName) => {
                        const folder = normalizeFolders ? normalizeNameSpaces(folderName) : String(folderName ?? '').trim();
                        if (!folder || folder.toLowerCase() === 'default') return;
                        currentPath = currentPath ? currentPath + '/' + folder : folder;
                    });

                    const sanitizeFileName = (name) => String(name || '').replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '-').trim();
                    let fileName = sanitizeFileName(title) || 'Untitled';
                    fileName = String(fileName).replace(/\//g, '-');

                    let cleanPath = currentPath ? currentPath + '/' + fileName : fileName;
                    cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
                    if (cleanPath.startsWith('static/')) {
                        cleanPath = cleanPath.substring(7);
                    }
                    cleanPath = cleanPath.replace(/^\/+/, '');

                    if (!cleanPath) {
                        const pageDesc = session.pageDescription || '';
                        if (pageDesc && pageDesc.includes('文件：')) {
                            const filePath = pageDesc.replace('文件：', '').trim();
                            const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                            cleanPath = dirPath + fileName;
                            cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
                            if (cleanPath.startsWith('static/')) {
                                cleanPath = cleanPath.substring(7);
                            }
                            cleanPath = cleanPath.replace(/^\/+/, '');
                        }
                    }

                    return cleanPath;
                };

                const oldPath = buildFilePath(session, normalizedOriginalTitle, false);
                const tempSession = { ...session, title: normalizedNewTitle };
                const newPath = buildFilePath(tempSession, normalizedNewTitle, true);

                if (oldPath && newPath && oldPath !== newPath) {
                    const apiBase = window.API_URL && /^https?:\/\//i.test(window.API_URL) ? String(window.API_URL).replace(/\/+$/, '') : PET_CONFIG?.api?.yiaiBaseUrl || '';

                    if (apiBase) {
                        try {
                            const response = await fetch(`${apiBase}/rename-file`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
                                },
                                body: JSON.stringify({
                                    old_path: oldPath,
                                    new_path: newPath
                                })
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP ${response.status}: ${errorText}`);
                            }

                            const envelope = await response.json();
                            if (!envelope || typeof envelope !== 'object') {
                                throw new Error('响应格式错误');
                            }
                            if (envelope.code !== 0) {
                                throw new Error(envelope.message || `请求失败 (code=${envelope.code})`);
                            }

                            if (session.pageDescription && session.pageDescription.includes('文件：')) {
                                session.pageDescription = session.pageDescription.replace(/文件：.*/, `文件：${newPath}`);
                            }
                        } catch (_) {}
                    }
                }
            }

            session.title = normalizedNewTitle;
            session.url = newUrl;
            session.pageDescription = newDescription;
            session.updatedAt = Date.now();
            session.lastAccessTime = Date.now();

            await this.saveAllSessions(false, true);
            await this.updateSessionSidebar(true);

            if (sessionId === this.currentSessionId) {
                if (typeof this.updateChatHeaderTitle === 'function') {
                    this.updateChatHeaderTitle();
                }
                if (typeof this.refreshWelcomeMessage === 'function') {
                    await this.refreshWelcomeMessage();
                }
            }

            if (this.sessionApi && typeof this.sessionApi.isEnabled === 'function' && this.sessionApi.isEnabled()) {
                const apiUrl = this.sessionApi.baseUrl || (typeof PET_CONFIG !== 'undefined' ? PET_CONFIG.api.yiaiBaseUrl : '');
                const base = String(apiUrl || '').replace(/\/+$/, '');
                if (base) {
                    try {
                        const payload = {
                            module_name: 'services.database.data_service',
                            method_name: 'update_document',
                            parameters: {
                                cname: 'sessions',
                                key: sessionId,
                                data: {
                                    key: sessionId,
                                    title: session.title || '',
                                    url: session.url || '',
                                    pageDescription: session.pageDescription || '',
                                    updatedAt: session.updatedAt || Date.now(),
                                    lastAccessTime: session.lastAccessTime || Date.now()
                                }
                            }
                        };
                        const response = await fetch(`${base}/`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
                            },
                            body: JSON.stringify(payload)
                        });

                        if (response.ok) {
                            const envelope = await response.json();
                            if (!envelope || typeof envelope !== 'object') throw new Error('响应格式错误');
                            if (envelope.code !== 0) throw new Error(envelope.message || `请求失败 (code=${envelope.code})`);
                        }
                    } catch (_) {}
                }
            }

            if (this.showNotification) {
                this.showNotification('会话已更新', 'success');
            }
            this.closeSessionInfoEditor();
        } catch (_) {
            if (this.showNotification) {
                this.showNotification('更新信息失败，请重试', 'error');
            }
        } finally {
            if (store) store.isSaving = false;
        }
    };

    proto.generateSessionDescription = async function (sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            return;
        }

        const store = getSessionEditorStore(this);
        if (store) store.isGeneratingDescription = true;

        try {
            const session = this.sessions[sessionId];
            const title = stripMdSuffix(session?.title || '');
            const url = session?.url || '';
            const pageContent = session?.pageContent ? String(session.pageContent || '').trim() : '';
            const messages = Array.isArray(session?.messages) ? session.messages : [];
            const usableMessages = messages.filter((msg) => msg && (msg.type === 'user' || msg.type === 'pet'));

            let systemPrompt = '你是一个专业的助手，擅长根据会话内容生成简洁、准确的网页描述。';
            let userPrompt = '请根据以下会话内容，生成一个简洁、准确的网页描述：\n\n';

            if (title) userPrompt += `页面标题：${title}\n`;
            if (url) userPrompt += `页面URL：${url}\n`;

            if (usableMessages.length > 0) {
                userPrompt += '\n会话内容：\n';
                usableMessages.slice(0, 15).forEach((msg) => {
                    const role = msg.type === 'user' ? '用户' : '助手';
                    const content = String(msg.content || '').trim();
                    if (content) {
                        userPrompt += `${role}：${content.substring(0, 300)}\n`;
                    }
                });
            } else if (pageContent) {
                userPrompt += '\n页面内容摘要：\n';
                userPrompt += pageContent.substring(0, 1000);
            }

            userPrompt += '\n\n请直接返回描述，不要包含其他说明文字。描述应该简洁明了，概括会话或页面的主要内容。';

            const oldPayload = this.buildPromptPayload(systemPrompt, userPrompt);
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: oldPayload.fromSystem,
                    user: oldPayload.fromUser,
                    stream: false
                }
            };
            if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
                payload.parameters.images = oldPayload.images;
            }
            const selectedModel = this.currentModel || (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3';
            if (selectedModel) payload.parameters.model = selectedModel;
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

            const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            if (!result || typeof result !== 'object') {
                throw new Error('响应格式错误');
            }
            if (result.code !== 0) {
                throw new Error(result.message || `请求失败 (code=${result.code})`);
            }

            let generatedDescription = extractChatReplyText(result);
            if (this.stripThinkContent) {
                generatedDescription = this.stripThinkContent(generatedDescription);
            }
            generatedDescription = generatedDescription.replace(/^["']|["']$/g, '').trim();

            if (generatedDescription && store) {
                store.description = generatedDescription;
            }
        } catch (e) {
            if (this.showNotification) {
                this.showNotification('生成描述失败：' + (e?.message || '未知错误'), 'error');
            }
        } finally {
            if (store) store.isGeneratingDescription = false;
        }
    };
})();
