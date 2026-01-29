(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_INPUT_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/ChatInput/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            CHAT_INPUT_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-chat-input-template',
            'Failed to load ChatInput template'
        );
    }

    function createComponent(params) {
        const manager = params?.manager;
        const instance = params?.instance;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref, onMounted } = Vue;
        if (typeof defineComponent !== 'function' || typeof ref !== 'function' || typeof onMounted !== 'function') return null;

        const fallbackTemplate = `
            <div class="yi-pet-chat-input-container chat-input-container"></div>
        `;

        const resolvedTemplate = String(template || '').trim() || fallbackTemplate;

        return defineComponent({
            name: 'YiPetChatInput',
            props: {
                uiTick: { type: Number, required: true }
            },
            setup() {
                const rootEl = ref(null);
                const textareaEl = ref(null);
                const imageInputEl = ref(null);
                const draftImagesEl = ref(null);
                const requestStatusButtonEl = ref(null);
                const contextSwitchContainerEl = ref(null);
                const contextSwitchEnabled = ref(true);

                let isComposing = false;
                let compositionEndTime = 0;
                const COMPOSITION_END_DELAY = 100;

                const readContextSwitchEnabled = async () => {
                    try {
                        if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.get === 'function') {
                            await new Promise((resolve) => {
                                chrome.storage.local.get(['contextSwitchEnabled'], (result) => {
                                    if (result && result.contextSwitchEnabled !== undefined) {
                                        contextSwitchEnabled.value = !!result.contextSwitchEnabled;
                                    }
                                    resolve();
                                });
                            });
                        }
                    } catch (_) {}
                };

                const writeContextSwitchEnabled = (value) => {
                    try {
                        if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.set === 'function') {
                            chrome.storage.local.set({ contextSwitchEnabled: !!value });
                        }
                    } catch (_) {}
                };

                const onContextClick = () => {
                    if (typeof manager?.openContextEditor === 'function') manager.openContextEditor();
                };

                const onEditSessionClick = async (e) => {
                    e?.stopPropagation?.();
                    if (!manager?.currentSessionId) {
                        manager?.showNotification?.('当前没有活动会话', 'warning');
                        return;
                    }
                    if (typeof manager?.editSessionTitle === 'function') {
                        await manager.editSessionTitle(manager.currentSessionId);
                        return;
                    }
                    manager?.showNotification?.('编辑功能不可用', 'error');
                };

                const onTagManagerClick = async () => {
                    try {
                        if (typeof manager?.closeWeWorkRobotSettingsModal === 'function') manager.closeWeWorkRobotSettingsModal();
                        if (typeof manager?.closeContextEditor === 'function') manager.closeContextEditor();

                        if (!manager?.currentSessionId) {
                            manager?.showNotification?.('请先选择一个会话', 'warning');
                            return;
                        }
                        if (!manager?.sessions || !manager.sessions[manager.currentSessionId]) {
                            manager?.showNotification?.('会话不存在，无法管理标签', 'error');
                            return;
                        }
                        if (typeof manager?.openTagManager === 'function') {
                            manager.openTagManager(manager.currentSessionId);
                            return;
                        }
                        manager?.showNotification?.('标签管理功能不可用', 'error');
                    } catch (error) {
                        manager?.showNotification?.(`打开标签管理失败：${error?.message || '未知错误'}`, 'error');
                    }
                };

                const onFaqClick = async () => {
                    try {
                        if (typeof manager?.closeWeWorkRobotSettingsModal === 'function') manager.closeWeWorkRobotSettingsModal();
                        if (typeof manager?.closeContextEditor === 'function') manager.closeContextEditor();

                        if (typeof manager?.openFaqManager === 'function') {
                            await manager.openFaqManager();
                            return;
                        }
                        manager?.showNotification?.('常见问题功能不可用', 'error');
                    } catch (error) {
                        manager?.showNotification?.(`打开常见问题失败：${error?.message || '未知错误'}`, 'error');
                    }
                };

                const onWeChatClick = () => {
                    if (typeof manager?.openWeChatSettings === 'function') {
                        manager.openWeChatSettings();
                        return;
                    }
                    if (typeof manager?.showSettingsModal === 'function') {
                        manager.showSettingsModal();
                    }
                };

                const onImageClick = () => {
                    if (imageInputEl.value) imageInputEl.value.click();
                };

                const onImageInputChange = (e) => {
                    if (instance && typeof instance.handleImageInputChange === 'function') {
                        instance.handleImageInputChange(e);
                    }
                };

                const updateInputState = () => {
                    const textarea = textareaEl.value;
                    if (!textarea) return;
                    const hasContent = String(textarea.value || '').trim().length > 0;
                    textarea.classList.toggle('chat-message-input--has-content', hasContent);
                };

                const onTextareaInput = () => {
                    const textarea = textareaEl.value;
                    if (!textarea) return;
                    textarea.style.height = 'auto';
                    const newHeight = Math.max(60, textarea.scrollHeight);
                    textarea.style.height = `${newHeight}px`;
                    updateInputState();
                    if (instance && typeof instance.scrollToBottom === 'function') instance.scrollToBottom();
                };

                const onTextareaPaste = async (e) => {
                    const textarea = textareaEl.value;
                    if (!textarea) return;

                    const items = e?.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
                    const imageItems = items.filter((item) => item && typeof item.type === 'string' && item.type.includes('image'));
                    if (imageItems.length === 0) return;

                    e.preventDefault();

                    const maxDraftImages = typeof instance?.maxDraftImages === 'number' ? instance.maxDraftImages : 4;
                    const draftImages = Array.isArray(instance?.draftImages) ? instance.draftImages : [];
                    const remainingSlots = maxDraftImages - draftImages.length;
                    if (remainingSlots <= 0) {
                        manager?.showNotification?.(`最多只能添加 ${maxDraftImages} 张图片`, 'warn');
                        return;
                    }

                    const itemsToRead = imageItems.slice(0, remainingSlots);
                    await Promise.all(
                        itemsToRead.map((item) => {
                            const file = item.getAsFile();
                            if (!file) return Promise.resolve();
                            return new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const src = event?.target?.result;
                                    if (src) draftImages.push(src);
                                    resolve();
                                };
                                reader.onerror = () => resolve();
                                reader.readAsDataURL(file);
                            });
                        })
                    );

                    if (instance) instance.draftImages = draftImages;
                    if (instance && typeof instance.updateDraftImagesDisplay === 'function') instance.updateDraftImagesDisplay();
                };

                const onCompositionStart = () => {
                    isComposing = true;
                    compositionEndTime = 0;
                    const textarea = textareaEl.value;
                    if (textarea) textarea.composing = true;
                };

                const onCompositionUpdate = () => {
                    isComposing = true;
                    compositionEndTime = 0;
                    const textarea = textareaEl.value;
                    if (textarea) textarea.composing = true;
                };

                const onCompositionEnd = () => {
                    isComposing = false;
                    compositionEndTime = Date.now();
                    const textarea = textareaEl.value;
                    if (textarea) textarea.composing = false;
                };

                const onTextareaKeydown = (e) => {
                    const textarea = textareaEl.value;
                    if (!textarea) return;

                    if (e.key !== 'Enter') {
                        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'k') {
                            if (manager && manager.quickCommentShortcutEnabled !== false) {
                                if (manager.commentState && manager.commentState.showQuickComment) {
                                    const commentTextarea = document.getElementById('pet-quick-comment-textarea');
                                    if (commentTextarea) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.stopImmediatePropagation();
                                        commentTextarea.focus();
                                        return;
                                    }
                                }
                                if (typeof manager.openQuickCommentFromShortcut === 'function') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.stopImmediatePropagation();
                                    manager.openQuickCommentFromShortcut();
                                    return;
                                }
                            }
                        }

                        if (e.key === 'Escape') {
                            e.preventDefault();
                            textarea.value = '';
                            textarea.style.height = '60px';
                            updateInputState();
                            textarea.blur();
                        }
                        return;
                    }

                    if (e.isComposing || e.keyCode === 229 || textarea.composing || isComposing) {
                        return;
                    }

                    if (e.key === 'Enter' && compositionEndTime > 0) {
                        if (Date.now() - compositionEndTime < COMPOSITION_END_DELAY) {
                            return;
                        }
                    }

                    if (e.key === 'Enter' && e.shiftKey) {
                        return;
                    }

                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (instance && typeof instance.sendMessage === 'function') {
                            instance.sendMessage();
                        }
                    }
                };

                const toggleContextSwitch = () => {
                    contextSwitchEnabled.value = !contextSwitchEnabled.value;
                    writeContextSwitchEnabled(contextSwitchEnabled.value);
                };

                const onContextSwitchChange = (e) => {
                    contextSwitchEnabled.value = !!e?.target?.checked;
                    writeContextSwitchEnabled(contextSwitchEnabled.value);
                };

                const onRequestStatusClick = () => {
                    if (instance && typeof instance.abortRequest === 'function') instance.abortRequest();
                };

                onMounted(async () => {
                    if (instance) {
                        if (rootEl.value) instance.inputContainer = rootEl.value;
                        if (textareaEl.value) instance.messageInput = textareaEl.value;
                        if (draftImagesEl.value) instance.draftImagesContainer = draftImagesEl.value;
                        if (imageInputEl.value) instance.imageInput = imageInputEl.value;
                        if (requestStatusButtonEl.value) instance.requestStatusButton = requestStatusButtonEl.value;
                        if (contextSwitchContainerEl.value) {
                            instance.contextSwitchContainer = contextSwitchContainerEl.value;
                            instance.contextSwitchContainer.updateColor = () => {};
                        }
                    }

                    await readContextSwitchEnabled();
                    updateInputState();
                });

                return {
                    rootEl,
                    textareaEl,
                    imageInputEl,
                    draftImagesEl,
                    requestStatusButtonEl,
                    contextSwitchContainerEl,
                    contextSwitchEnabled,
                    onContextClick,
                    onEditSessionClick,
                    onTagManagerClick,
                    onFaqClick,
                    onWeChatClick,
                    onImageClick,
                    onImageInputChange,
                    onTextareaInput,
                    onTextareaKeydown,
                    onTextareaPaste,
                    onCompositionStart,
                    onCompositionUpdate,
                    onCompositionEnd,
                    toggleContextSwitch,
                    onContextSwitchChange,
                    onRequestStatusClick
                };
            },
            template: resolvedTemplate
        });
    }

    /**
     * 创建 fallback 模式下的 yi-pet-chat-input-container DOM（无 Vue 时使用，如 ChatWindow.createFallbackDom）
     * 将 DOM 引用与事件绑定到 chatWindowInstance 上。
     * @param {Object} manager - PetManager 实例
     * @param {Object} instance - ChatWindow 实例
     * @returns {HTMLElement} yi-pet-chat-input-container 根元素
     */
    function createInputContainerElement(manager, instance) {
        const inputContainer = document.createElement('div');
        inputContainer.className = 'yi-pet-chat-input-container chat-input-container';

        const topToolbar = document.createElement('div');
        topToolbar.className = 'yi-pet-chat-toolbar chat-input-toolbar';

        const inputLeftButtonGroup = document.createElement('div');
        inputLeftButtonGroup.className = 'yi-pet-chat-toolbar-left chat-input-btn-group';

        const contextBtn = manager.createButton({
            text: '📝',
            className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
            attrs: { title: '编辑页面上下文', 'aria-label': '页面上下文' },
            onClick: () => {
                if (typeof manager.openContextEditor === 'function') manager.openContextEditor();
            }
        });
        inputLeftButtonGroup.appendChild(contextBtn);

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
        instance.editSessionButton = editSessionBtn;

        const tagManagerBtn = manager.createButton({
            text: '🏷️',
            className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
            attrs: { title: '管理会话标签', 'aria-label': '标签管理' },
            onClick: async () => {
                try {
                    if (typeof manager.closeWeWorkRobotSettingsModal === 'function') manager.closeWeWorkRobotSettingsModal();
                    if (typeof manager.closeContextEditor === 'function') manager.closeContextEditor();
                    if (!manager.currentSessionId) {
                        if (typeof manager.showNotification === 'function') manager.showNotification('请先选择一个会话', 'warning');
                        return;
                    }
                    if (!manager.sessions || !manager.sessions[manager.currentSessionId]) {
                        if (typeof manager.showNotification === 'function') manager.showNotification('会话不存在，无法管理标签', 'error');
                        return;
                    }
                    if (typeof manager.openTagManager === 'function') {
                        manager.openTagManager(manager.currentSessionId);
                    } else {
                        if (typeof manager.showNotification === 'function') manager.showNotification('标签管理功能不可用', 'error');
                    }
                } catch (error) {
                    if (typeof manager.showNotification === 'function') manager.showNotification(`打开标签管理失败：${error.message || '未知错误'}`, 'error');
                }
            }
        });
        inputLeftButtonGroup.appendChild(tagManagerBtn);

        const faqBtn = manager.createButton({
            text: '💡',
            className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
            attrs: { title: '常见问题', 'aria-label': '常见问题' },
            onClick: async () => {
                try {
                    if (typeof manager.closeWeWorkRobotSettingsModal === 'function') manager.closeWeWorkRobotSettingsModal();
                    if (typeof manager.closeContextEditor === 'function') manager.closeContextEditor();
                    if (typeof manager.openFaqManager === 'function') {
                        await manager.openFaqManager();
                    } else {
                        if (typeof manager.showNotification === 'function') manager.showNotification('常见问题功能不可用', 'error');
                    }
                } catch (error) {
                    if (typeof manager.showNotification === 'function') manager.showNotification(`打开常见问题失败：${error.message || '未知错误'}`, 'error');
                }
            }
        });
        inputLeftButtonGroup.appendChild(faqBtn);

        const weChatBtn = manager.createButton({
            text: '🤖',
            className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
            attrs: { title: '微信机器人设置', 'aria-label': '微信机器人设置' },
            onClick: () => {
                if (typeof manager.openWeChatSettings === 'function') manager.openWeChatSettings();
                else if (typeof manager.showSettingsModal === 'function') manager.showSettingsModal();
            }
        });
        inputLeftButtonGroup.appendChild(weChatBtn);

        const imageBtn = manager.createButton({
            text: '🖼️',
            className: 'yi-pet-chat-btn chat-input-btn chat-input-text-btn',
            attrs: { title: '上传图片', 'aria-label': '上传图片' },
            onClick: () => {
                if (instance.imageInput) instance.imageInput.click();
            }
        });
        inputLeftButtonGroup.appendChild(imageBtn);

        const imageInput = document.createElement('input');
        imageInput.type = 'file';
        imageInput.accept = 'image/*';
        imageInput.multiple = true;
        imageInput.className = 'js-hidden';
        imageInput.id = 'yi-pet-chat-image-input';
        imageInput.addEventListener('change', (e) => {
            if (typeof instance.handleImageInputChange === 'function') instance.handleImageInputChange(e);
        });
        inputLeftButtonGroup.appendChild(imageInput);
        instance.imageInput = imageInput;

        topToolbar.appendChild(inputLeftButtonGroup);

        const inputRightButtonGroup = document.createElement('div');
        inputRightButtonGroup.className = 'yi-pet-chat-toolbar-right chat-input-btn-group';

        if (typeof instance.createContextSwitch === 'function') {
            const contextSwitch = instance.createContextSwitch();
            if (contextSwitch) inputRightButtonGroup.appendChild(contextSwitch);
        }

        const requestStatusButton = document.createElement('button');
        requestStatusButton.type = 'button';
        requestStatusButton.id = 'request-status-btn';
        requestStatusButton.className = 'chat-input-status-btn';
        requestStatusButton.innerHTML = '⏹️';
        requestStatusButton.title = '请求状态：空闲';
        requestStatusButton.setAttribute('aria-label', '请求状态');
        requestStatusButton.disabled = true;
        requestStatusButton.addEventListener('click', () => {
            if (typeof instance.abortRequest === 'function') instance.abortRequest();
        });
        inputRightButtonGroup.appendChild(requestStatusButton);
        instance.requestStatusButton = requestStatusButton;

        topToolbar.appendChild(inputRightButtonGroup);

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'chat-input-wrapper';

        const draftImagesContainer = document.createElement('div');
        draftImagesContainer.className = 'yi-pet-chat-draft-images js-hidden';
        draftImagesContainer.setAttribute('aria-label', '待发送图片');
        inputWrapper.appendChild(draftImagesContainer);
        instance.draftImagesContainer = draftImagesContainer;

        const inputRow = document.createElement('div');
        inputRow.className = 'yi-pet-chat-input-row';

        const textarea = document.createElement('textarea');
        textarea.id = 'yi-pet-chat-input';
        textarea.className = 'yi-pet-chat-textarea chat-message-input';
        textarea.placeholder = '输入消息... (Shift+Enter 换行，Enter 发送)';
        textarea.rows = 4;
        textarea.setAttribute('aria-label', '会话输入框');
        instance.messageInput = textarea;

        const updateInputState = () => {
            const hasContent = textarea.value.trim().length > 0;
            textarea.classList.toggle('chat-message-input--has-content', hasContent);
        };

        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px';
            updateInputState();
            if (typeof instance.scrollToBottom === 'function') instance.scrollToBottom();
        });

        textarea.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
            const imageItems = items.filter((item) => item && typeof item.type === 'string' && item.type.includes('image'));
            if (imageItems.length === 0) return;
            e.preventDefault();
            const remainingSlots = (instance.maxDraftImages || 4) - (instance.draftImages || []).length;
            if (remainingSlots <= 0) {
                if (typeof manager.showNotification === 'function') manager.showNotification(`最多只能添加 ${instance.maxDraftImages || 4} 张图片`, 'warn');
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
                        if (src && instance.draftImages) instance.draftImages.push(src);
                        resolve();
                    };
                    reader.onerror = () => resolve();
                    reader.readAsDataURL(file);
                });
            }));
            if (typeof instance.updateDraftImagesDisplay === 'function') instance.updateDraftImagesDisplay();
        });

        let isComposing = false;
        let compositionEndTime = 0;
        const COMPOSITION_END_DELAY = 100;

        textarea.addEventListener('compositionstart', () => {
            isComposing = true;
            compositionEndTime = 0;
            textarea.composing = true;
        });
        textarea.addEventListener('compositionupdate', () => {
            isComposing = true;
            compositionEndTime = 0;
            textarea.composing = true;
        });
        textarea.addEventListener('compositionend', () => {
            isComposing = false;
            compositionEndTime = Date.now();
            textarea.composing = false;
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') {
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'k') {
                    if (manager && manager.quickCommentShortcutEnabled !== false) {
                        if (manager.commentState && manager.commentState.showQuickComment) {
                            const commentTextarea = document.getElementById('pet-quick-comment-textarea');
                            if (commentTextarea) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                commentTextarea.focus();
                                return;
                            }
                        }
                        if (typeof manager.openQuickCommentFromShortcut === 'function') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            manager.openQuickCommentFromShortcut();
                            return;
                        }
                    }
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    textarea.value = '';
                    textarea.style.height = '60px';
                    updateInputState();
                    textarea.blur();
                }
                return;
            }
            if (e.isComposing || e.keyCode === 229 || textarea.composing || isComposing) return;
            if (e.key === 'Enter' && compositionEndTime > 0 && Date.now() - compositionEndTime < COMPOSITION_END_DELAY) return;
            if (e.key === 'Enter' && e.shiftKey) return;
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (typeof instance.sendMessage === 'function') instance.sendMessage();
            }
        });

        inputRow.appendChild(textarea);
        inputWrapper.appendChild(inputRow);
        inputContainer.appendChild(topToolbar);
        inputContainer.appendChild(inputWrapper);

        return inputContainer;
    }

    window.PetManager.Components.ChatInput = {
        loadTemplate,
        createComponent,
        createInputContainerElement
    };
})();
