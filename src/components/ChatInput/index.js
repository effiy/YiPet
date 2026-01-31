(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_INPUT_TEMPLATES_RESOURCE_PATH = 'src/components/ChatInput/index.html';
    let chatInputTemplateCache = '';

    async function loadTemplate() {
        if (chatInputTemplateCache) return chatInputTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        chatInputTemplateCache = await DomHelper.loadHtmlTemplate(
            CHAT_INPUT_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-chat-input-template',
            'Failed to load ChatInput template'
        );
        return chatInputTemplateCache;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const instance = params?.instance;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref, onMounted } = Vue;
        if (typeof defineComponent !== 'function' || typeof ref !== 'function' || typeof onMounted !== 'function') return null;

        const resolvedTemplate = String(template || chatInputTemplateCache || '').trim();
        if (!resolvedTemplate) return null;

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
                        instance.handleImageInputChange = (e) => handleImageInputChange(manager, instance, e);
                        instance.removeDraftImage = (index) => removeDraftImage(instance, index);
                        instance.clearDraftImages = () => clearDraftImages(instance);
                        instance.previewDraftImage = (src, index) => previewDraftImage(src, index);
                        instance.updateDraftImagesDisplay = () => updateDraftImagesDisplay(instance);
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

        const contextSwitchContainer = document.createElement('div');
        contextSwitchContainer.className = 'context-switch-container';
        contextSwitchContainer.title = '开启/关闭页面上下文，帮助AI理解当前页面内容';

        const contextSwitchLabel = document.createElement('span');
        contextSwitchLabel.className = 'context-switch-label';
        contextSwitchLabel.textContent = '页面上下文';

        const switchWrapper = document.createElement('div');
        switchWrapper.className = 'context-switch-wrapper';

        const switchThumb = document.createElement('div');
        switchThumb.className = 'context-switch-thumb';

        const contextSwitch = document.createElement('input');
        contextSwitch.type = 'checkbox';
        contextSwitch.id = 'context-switch';
        contextSwitch.className = 'context-switch-input';
        contextSwitch.checked = true;

        const updateSwitchState = (isChecked) => {
            if (isChecked) {
                contextSwitchContainer.classList.add('active');
            } else {
                contextSwitchContainer.classList.remove('active');
            }
        };
        updateSwitchState(contextSwitch.checked);

        switchWrapper.appendChild(switchThumb);
        contextSwitchContainer.appendChild(contextSwitchLabel);
        contextSwitchContainer.appendChild(switchWrapper);
        contextSwitchContainer.appendChild(contextSwitch);

        const toggleSwitch = (e) => {
            e?.stopPropagation?.();
            contextSwitch.checked = !contextSwitch.checked;
            updateSwitchState(contextSwitch.checked);
            contextSwitch.dispatchEvent(new Event('change'));
        };
        contextSwitchContainer.addEventListener('click', toggleSwitch);
        contextSwitch.addEventListener('click', (e) => e.stopPropagation());

        if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.get === 'function') {
            chrome.storage.local.get(['contextSwitchEnabled'], (result) => {
                if (result && result.contextSwitchEnabled !== undefined) {
                    contextSwitch.checked = !!result.contextSwitchEnabled;
                    updateSwitchState(contextSwitch.checked);
                }
            });
        }

        contextSwitch.addEventListener('change', () => {
            updateSwitchState(contextSwitch.checked);
            if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.set === 'function') {
                chrome.storage.local.set({ contextSwitchEnabled: contextSwitch.checked });
            }
        });

        contextSwitchContainer.updateColor = () => {};
        if (instance) instance.contextSwitchContainer = contextSwitchContainer;
        inputRightButtonGroup.appendChild(contextSwitchContainer);

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
        instance.handleImageInputChange = (e) => handleImageInputChange(manager, instance, e);
        instance.removeDraftImage = (index) => removeDraftImage(instance, index);
        instance.clearDraftImages = () => clearDraftImages(instance);
        instance.previewDraftImage = (src, index) => previewDraftImage(src, index);
        instance.updateDraftImagesDisplay = () => updateDraftImagesDisplay(instance);

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

    function updateDraftImagesDisplay(instance) {
        const container = instance?.draftImagesContainer;
        if (!container) return;
        const draftImages = Array.isArray(instance?.draftImages) ? instance.draftImages : [];
        if (draftImages.length === 0) {
            container.classList.add('js-hidden');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('js-hidden');

        const fragment = document.createDocumentFragment();

        const existingImages = container.querySelectorAll('.yi-pet-chat-draft-image');
        existingImages.forEach((img) => img.remove());
        const existingClearBtn = container.querySelector('.yi-pet-chat-draft-images-clear');
        if (existingClearBtn) existingClearBtn.remove();

        draftImages.forEach((src, index) => {
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'yi-pet-chat-draft-image';
            imageWrapper.setAttribute('data-image-index', index);

            const img = document.createElement('img');
            img.className = 'yi-pet-chat-draft-image-preview';
            img.src = src;
            img.alt = `待发送图片 ${index + 1}`;
            img.loading = 'lazy';

            img.addEventListener('error', () => {
                imageWrapper.classList.add('yi-pet-chat-draft-image-error');
                img.classList.add('tw-hidden');
            });

            img.addEventListener('load', () => {
                imageWrapper.classList.remove('yi-pet-chat-draft-image-loading');
                img.classList.remove('tw-hidden');
            });

            imageWrapper.addEventListener('click', (e) => {
                if (e.target.classList.contains('yi-pet-chat-draft-image-remove')) {
                    return;
                }
                if (typeof instance?.previewDraftImage === 'function') {
                    instance.previewDraftImage(src, index);
                }
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'yi-pet-chat-draft-image-remove';
            removeBtn.innerHTML = '✕';
            removeBtn.setAttribute('aria-label', `移除第 ${index + 1} 张图片`);
            removeBtn.title = '移除';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof instance?.removeDraftImage === 'function') {
                    instance.removeDraftImage(index);
                }
            });

            imageWrapper.classList.add('yi-pet-chat-draft-image-loading');

            imageWrapper.appendChild(img);
            imageWrapper.appendChild(removeBtn);
            fragment.appendChild(imageWrapper);
        });

        container.appendChild(fragment);

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'yi-pet-chat-draft-images-clear';
        clearBtn.textContent = `清空图片 (${draftImages.length})`;
        clearBtn.setAttribute('aria-label', `清空所有 ${draftImages.length} 张图片`);
        clearBtn.title = '清空所有图片';
        clearBtn.addEventListener('click', () => {
            if (typeof instance?.clearDraftImages === 'function') {
                instance.clearDraftImages();
                return;
            }
            if (Array.isArray(instance?.draftImages)) {
                instance.draftImages = [];
                updateDraftImagesDisplay(instance);
            }
        });
        container.appendChild(clearBtn);
    }

    function handleImageInputChange(manager, instance, e) {
        const target = e?.target;
        const files = Array.from(target?.files || []);
        if (files.length === 0) return;

        const maxDraftImages = typeof instance?.maxDraftImages === 'number' ? instance.maxDraftImages : 4;
        const draftImages = Array.isArray(instance?.draftImages) ? instance.draftImages : [];

        const remainingSlots = maxDraftImages - draftImages.length;
        if (remainingSlots <= 0) {
            manager?.showNotification?.(`最多只能添加 ${maxDraftImages} 张图片`, 'warn');
            if (target) target.value = '';
            return;
        }

        const imageFiles = files.filter((file) => file && typeof file.type === 'string' && file.type.startsWith('image/'));
        const filesToProcess = imageFiles.slice(0, remainingSlots);

        if (imageFiles.length > remainingSlots) {
            manager?.showNotification?.(`只能添加 ${remainingSlots} 张图片（已达上限）`, 'warn');
        }

        let loadedCount = 0;
        filesToProcess.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const src = event?.target?.result;
                if (src) draftImages.push(src);
                loadedCount += 1;
                if (loadedCount === filesToProcess.length) {
                    if (instance) instance.draftImages = draftImages;
                    instance?.updateDraftImagesDisplay?.();
                }
            };
            reader.onerror = () => {
                manager?.showNotification?.(`图片 ${file?.name || ''} 加载失败`, 'error');
                loadedCount += 1;
                if (loadedCount === filesToProcess.length) {
                    if (instance) instance.draftImages = draftImages;
                    instance?.updateDraftImagesDisplay?.();
                }
            };
            reader.readAsDataURL(file);
        });

        if (target) target.value = '';
    }

    function removeDraftImage(instance, index) {
        const draftImages = Array.isArray(instance?.draftImages) ? instance.draftImages : [];
        const idx = Number(index);
        if (!Number.isFinite(idx) || idx < 0 || idx >= draftImages.length) return;
        draftImages.splice(idx, 1);
        if (instance) instance.draftImages = draftImages;
        instance?.updateDraftImagesDisplay?.();
    }

    function clearDraftImages(instance) {
        if (instance) instance.draftImages = [];
        instance?.updateDraftImagesDisplay?.();
    }

    function previewDraftImage(src, index) {
        const modal = document.createElement('div');
        modal.className = 'pet-draft-image-preview-modal';

        const img = document.createElement('img');
        img.src = src;
        img.alt = `待发送图片 ${Number(index) + 1 || ''}`;

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

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        document.body.style.overflow = 'hidden';

        modal.appendChild(img);
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);
    }

    window.PetManager.Components.ChatInput = {
        loadTemplate,
        createComponent,
        createInputContainerElement,
        updateDraftImagesDisplay
    };
})();
