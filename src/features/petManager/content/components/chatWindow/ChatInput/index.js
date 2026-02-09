(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const CHAT_INPUT_TEMPLATES_RESOURCE_PATH = 'src/features/petManager/content/components/chatWindow/ChatInput/index.html';
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

    function closeOverlays(manager) {
        try {
            if (typeof manager?.closeWeWorkRobotSettingsModal === 'function') manager.closeWeWorkRobotSettingsModal();
        } catch (_) {}
        try {
            if (typeof manager?.closeContextEditor === 'function') manager.closeContextEditor();
        } catch (_) {}
    }

    async function openTagManagerSafe(manager) {
        try {
            closeOverlays(manager);

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
    }

    async function openFaqManagerSafe(manager) {
        try {
            closeOverlays(manager);

            if (typeof manager?.openFaqManager === 'function') {
                await manager.openFaqManager();
                return;
            }
            manager?.showNotification?.('常见问题功能不可用', 'error');
        } catch (error) {
            manager?.showNotification?.(`打开常见问题失败：${error?.message || '未知错误'}`, 'error');
        }
    }

    async function readContextSwitchEnabledFromStorage() {
        try {
            if (typeof chrome === 'undefined' || !chrome?.storage?.local || typeof chrome.storage.local.get !== 'function') {
                return undefined;
            }
            return await new Promise((resolve) => {
                chrome.storage.local.get(['contextSwitchEnabled'], (result) => {
                    if (result && result.contextSwitchEnabled !== undefined) {
                        resolve(!!result.contextSwitchEnabled);
                        return;
                    }
                    resolve(undefined);
                });
            });
        } catch (_) {
            return undefined;
        }
    }

    function writeContextSwitchEnabledToStorage(value) {
        try {
            if (typeof chrome !== 'undefined' && chrome?.storage?.local && typeof chrome.storage.local.set === 'function') {
                chrome.storage.local.set({ contextSwitchEnabled: !!value });
            }
        } catch (_) {}
    }

    function createComponent(params) {
        const manager = params?.manager;
        const instance = params?.instance;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, ref, onMounted, onBeforeUnmount, nextTick } = Vue;
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
                const draftImages = ref([]);
                const draftImageMeta = ref([]);
                const previewVisible = ref(false);
                const previewSrc = ref('');
                const previewAlt = ref('');
                const textareaHeight = ref('60px');
                const hasContent = ref(false);

                let isComposing = false;
                let compositionEndTime = 0;
                const COMPOSITION_END_DELAY = 100;

                const scheduleNextTick = (cb) => {
                    try {
                        if (typeof nextTick === 'function') return nextTick(cb);
                    } catch (_) {}
                    return Promise.resolve().then(cb);
                };

                const syncDraftImages = () => {
                    const list = Array.isArray(instance?.draftImages) ? [...instance.draftImages] : [];
                    draftImages.value = list;
                    draftImageMeta.value = list.map(() => ({ loading: true, error: false }));
                    if (previewVisible.value) {
                        const current = String(previewSrc.value || '');
                        if (!current || !list.includes(current)) {
                            previewVisible.value = false;
                            previewSrc.value = '';
                            previewAlt.value = '';
                            try {
                                document.body.style.overflow = '';
                            } catch (_) {}
                        }
                    }
                };

                const readContextSwitchEnabled = async () => {
                    const v = await readContextSwitchEnabledFromStorage();
                    if (v !== undefined) contextSwitchEnabled.value = v;
                };

                const writeContextSwitchEnabled = (value) => {
                    writeContextSwitchEnabledToStorage(value);
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

                const onTagManagerClick = async (e) => {
                    e?.stopPropagation?.();
                    await openTagManagerSafe(manager);
                };

                const onFaqClick = async (e) => {
                    e?.stopPropagation?.();
                    await openFaqManagerSafe(manager);
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
                    handleImageInputChange(manager, instance, e);
                    if (!instance || typeof instance._syncChatInputDraftImages !== 'function') {
                        syncDraftImages();
                    }
                };

                const updateInputState = () => {
                    const textarea = textareaEl.value;
                    if (!textarea) return;
                    hasContent.value = String(textarea.value || '').trim().length > 0;
                };

                const updateTextareaHeight = () => {
                    const textarea = textareaEl.value;
                    if (!textarea) return;
                    textareaHeight.value = 'auto';
                    scheduleNextTick(() => {
                        const el = textareaEl.value;
                        if (!el) return;
                        const nextH = Math.max(60, el.scrollHeight || 60);
                        textareaHeight.value = `${nextH}px`;
                    });
                };

                const onTextareaInput = () => {
                    updateTextareaHeight();
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
                    if (!Array.isArray(instance?.draftImages)) instance.draftImages = [];
                    const current = Array.isArray(instance?.draftImages) ? instance.draftImages : [];
                    const remainingSlots = maxDraftImages - current.length;
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
                                    if (src) current.push(src);
                                    resolve();
                                };
                                reader.onerror = () => resolve();
                                reader.readAsDataURL(file);
                            });
                        })
                    );

                    if (instance) instance.draftImages = current;
                    syncDraftImages();
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
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            textarea.value = '';
                        textareaHeight.value = '60px';
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

                const onDraftImageLoad = (index) => {
                    const idx = Number(index);
                    if (!Number.isFinite(idx) || idx < 0) return;
                    if (!draftImageMeta.value[idx]) draftImageMeta.value[idx] = { loading: false, error: false };
                    draftImageMeta.value[idx].loading = false;
                    draftImageMeta.value[idx].error = false;
                };

                const onDraftImageError = (index) => {
                    const idx = Number(index);
                    if (!Number.isFinite(idx) || idx < 0) return;
                    if (!draftImageMeta.value[idx]) draftImageMeta.value[idx] = { loading: false, error: true };
                    draftImageMeta.value[idx].loading = false;
                    draftImageMeta.value[idx].error = true;
                };

                const openPreview = (src, index) => {
                    previewSrc.value = src;
                    previewAlt.value = `待发送图片 ${Number(index) + 1 || ''}`;
                    previewVisible.value = true;
                    try {
                        document.body.style.overflow = 'hidden';
                    } catch (_) {}
                };

                const closePreview = () => {
                    previewVisible.value = false;
                    previewSrc.value = '';
                    previewAlt.value = '';
                    try {
                        document.body.style.overflow = '';
                    } catch (_) {}
                };

                const onPreviewOverlayClick = (e) => {
                    if (e?.target === e?.currentTarget) closePreview();
                };

                const onDraftImageClick = (src, index) => {
                    if (!src) return;
                    openPreview(src, index);
                };

                const onRemoveDraftImage = (index) => {
                    const idx = Number(index);
                    if (!Number.isFinite(idx) || idx < 0) return;
                    const current = Array.isArray(instance?.draftImages) ? instance.draftImages : [];
                    if (idx >= current.length) return;
                    current.splice(idx, 1);
                    if (instance) instance.draftImages = current;
                    syncDraftImages();
                };

                const onClearDraftImages = () => {
                    if (instance) instance.draftImages = [];
                    syncDraftImages();
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
                        instance._syncChatInputDraftImages = () => syncDraftImages();
                        instance.handleImageInputChange = (e) => handleImageInputChange(manager, instance, e);
                        instance.removeDraftImage = (index) => onRemoveDraftImage(index);
                        instance.clearDraftImages = () => onClearDraftImages();
                        instance.previewDraftImage = (src, index) => openPreview(src, index);
                    }

                    await readContextSwitchEnabled();
                    updateInputState();
                    updateTextareaHeight();
                    syncDraftImages();
                });

                if (typeof onBeforeUnmount === 'function') {
                    onBeforeUnmount(() => {
                        closePreview();
                    });
                }

                const onKeyDown = (e) => {
                    if (e?.key === 'Escape' && previewVisible.value) closePreview();
                };
                onMounted(() => {
                    document.addEventListener('keydown', onKeyDown);
                });
                if (typeof onBeforeUnmount === 'function') {
                    onBeforeUnmount(() => {
                        document.removeEventListener('keydown', onKeyDown);
                    });
                }

                return {
                    rootEl,
                    textareaEl,
                    imageInputEl,
                    draftImagesEl,
                    requestStatusButtonEl,
                    contextSwitchContainerEl,
                    contextSwitchEnabled,
                    draftImages,
                    draftImageMeta,
                    previewVisible,
                    previewSrc,
                    previewAlt,
                    textareaHeight,
                    hasContent,
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
                    onRequestStatusClick,
                    onDraftImageClick,
                    onDraftImageLoad,
                    onDraftImageError,
                    onRemoveDraftImage,
                    onClearDraftImages,
                    onPreviewOverlayClick,
                    closePreview
                };
            },
            template: resolvedTemplate
        });
    }

    function updateDraftImagesDisplay(instance) {
        if (instance && typeof instance._syncChatInputDraftImages === 'function') {
            instance._syncChatInputDraftImages();
            return;
        }

        const container = instance?.draftImagesContainer;
        if (!container) return;
        const draftImages = Array.isArray(instance?.draftImages) ? instance.draftImages : [];
        if (draftImages.length === 0) {
            container.classList.add('js-hidden');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('js-hidden');

        const escapeAttr = (value) =>
            String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

        const imagesHtml = draftImages
            .map((src, index) => {
                const idx = Number(index) + 1;
                return `
                    <div class="yi-pet-chat-draft-image yi-pet-chat-draft-image-loading" data-image-index="${Number(index)}">
                        <img class="yi-pet-chat-draft-image-preview" src="${escapeAttr(src || '')}" alt="待发送图片 ${idx}" loading="lazy" />
                        <button type="button" class="yi-pet-chat-draft-image-remove" aria-label="移除第 ${idx} 张图片" title="移除">✕</button>
                    </div>
                `.trim();
            })
            .join('');

        const clearBtnHtml = `
            <button
                type="button"
                class="yi-pet-chat-draft-images-clear"
                aria-label="清空所有 ${draftImages.length} 张图片"
                title="清空所有图片"
            >清空图片 (${draftImages.length})</button>
        `.trim();

        container.innerHTML = `${imagesHtml}${clearBtnHtml}`;

        if (!container._yiPetDraftImagesBound) {
            container._yiPetDraftImagesBound = true;
            container.addEventListener('click', (e) => {
                const target = e?.target;
                if (!target) return;

                const clearBtn = target.closest?.('.yi-pet-chat-draft-images-clear');
                if (clearBtn) {
                    if (typeof instance?.clearDraftImages === 'function') {
                        instance.clearDraftImages();
                        return;
                    }
                    if (Array.isArray(instance?.draftImages)) {
                        instance.draftImages = [];
                        updateDraftImagesDisplay(instance);
                    }
                    return;
                }

                const removeBtn = target.closest?.('.yi-pet-chat-draft-image-remove');
                if (removeBtn) {
                    e.stopPropagation();
                    const wrapper = removeBtn.closest?.('.yi-pet-chat-draft-image');
                    const idx = Number(wrapper?.getAttribute?.('data-image-index'));
                    if (Number.isFinite(idx) && typeof instance?.removeDraftImage === 'function') {
                        instance.removeDraftImage(idx);
                    }
                    return;
                }

                const wrapper = target.closest?.('.yi-pet-chat-draft-image');
                if (!wrapper) return;
                const idx = Number(wrapper.getAttribute('data-image-index'));
                if (!Number.isFinite(idx)) return;
                const src = draftImages[idx];
                if (typeof instance?.previewDraftImage === 'function') {
                    instance.previewDraftImage(src, idx);
                }
            });
        }

        const previewImages = container.querySelectorAll('.yi-pet-chat-draft-image-preview');
        previewImages.forEach((img) => {
            const wrapper = img.closest?.('.yi-pet-chat-draft-image');
            if (!wrapper) return;
            img.addEventListener('error', () => {
                wrapper.classList.add('yi-pet-chat-draft-image-error');
                img.classList.add('tw-hidden');
            });
            img.addEventListener('load', () => {
                wrapper.classList.remove('yi-pet-chat-draft-image-loading');
                img.classList.remove('tw-hidden');
            });
        });
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
                    updateDraftImagesDisplay(instance);
                }
            };
            reader.onerror = () => {
                manager?.showNotification?.(`图片 ${file?.name || ''} 加载失败`, 'error');
                loadedCount += 1;
                if (loadedCount === filesToProcess.length) {
                    if (instance) instance.draftImages = draftImages;
                    updateDraftImagesDisplay(instance);
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
        updateDraftImagesDisplay(instance);
    }

    function clearDraftImages(instance) {
        if (instance) instance.draftImages = [];
        updateDraftImagesDisplay(instance);
    }

    function previewDraftImage(src, index) {
        const existing = document.body ? document.body.querySelector('.pet-draft-image-preview-modal') : null;
        if (existing) existing.remove();

        const escapeAttr = (value) =>
            String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

        const safeSrc = escapeAttr(src || '');
        const safeAlt = escapeAttr(`待发送图片 ${Number(index) + 1 || ''}`);

        document.body.insertAdjacentHTML(
            'beforeend',
            `
                <div class="pet-draft-image-preview-modal" role="dialog" aria-modal="true" aria-label="图片预览">
                    <img src="${safeSrc}" alt="${safeAlt}" />
                    <button type="button" class="modal-close-btn" aria-label="关闭预览">✕</button>
                </div>
            `.trim()
        );

        const modal = document.body.querySelector('.pet-draft-image-preview-modal');
        const closeBtn = modal ? modal.querySelector('.modal-close-btn') : null;
        if (!modal) return;

        const closeModal = () => {
            try {
                modal.remove();
            } catch (_) {}
            try {
                document.body.style.overflow = '';
            } catch (_) {}
            try {
                document.removeEventListener('keydown', handleKeyDown);
            } catch (_) {}
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') closeModal();
        };

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
    }

    function createFallbackInputHtml() {
        return `
            <div class="yi-pet-chat-input-container chat-input-container">
                <div class="yi-pet-chat-toolbar chat-input-toolbar">
                    <div class="yi-pet-chat-toolbar-left chat-input-btn-group">
                        <button type="button" class="yi-pet-chat-btn chat-input-btn chat-input-text-btn ui-btn" title="编辑页面上下文" aria-label="页面上下文" data-action="context">📝</button>
                        <button type="button" class="yi-pet-chat-btn chat-input-btn chat-input-text-btn ui-btn" title="编辑当前会话信息（标题、描述等）" aria-label="编辑会话" id="edit-session-btn" data-action="edit-session">✏️</button>
                        <button type="button" class="yi-pet-chat-btn chat-input-btn chat-input-text-btn ui-btn" title="管理会话标签" aria-label="标签管理" data-action="tag-manager">🏷️</button>
                        <button type="button" class="yi-pet-chat-btn chat-input-btn chat-input-text-btn ui-btn" title="常见问题" aria-label="常见问题" data-action="faq">💡</button>
                        <button type="button" class="yi-pet-chat-btn chat-input-btn chat-input-text-btn ui-btn" title="微信机器人设置" aria-label="微信机器人设置" data-action="wechat">🤖</button>
                        <button type="button" class="yi-pet-chat-btn chat-input-btn chat-input-text-btn ui-btn" title="上传图片" aria-label="上传图片" data-action="image">🖼️</button>
                        <input type="file" accept="image/*" multiple class="js-hidden" id="yi-pet-chat-image-input" />
                    </div>

                    <div class="yi-pet-chat-toolbar-right chat-input-btn-group">
                        <div class="context-switch-container" title="开启/关闭页面上下文，帮助AI理解当前页面内容">
                            <span class="context-switch-label">页面上下文</span>
                            <div class="context-switch-wrapper">
                                <div class="context-switch-thumb"></div>
                            </div>
                            <input type="checkbox" id="context-switch" class="context-switch-input" checked />
                        </div>

                        <button
                            type="button"
                            id="request-status-btn"
                            class="chat-input-status-btn"
                            aria-label="请求状态"
                            title="请求状态：空闲"
                            disabled
                        >⏹️</button>
                    </div>
                </div>

                <div class="chat-input-wrapper">
                    <div class="yi-pet-chat-draft-images js-hidden" aria-label="待发送图片"></div>
                    <div class="yi-pet-chat-input-row">
                        <textarea
                            id="yi-pet-chat-input"
                            class="yi-pet-chat-textarea chat-message-input"
                            placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
                            rows="4"
                            aria-label="会话输入框"
                        ></textarea>
                    </div>
                </div>
            </div>
        `.trim();
    }

    function createInputContainerElement(manager, instance) {
        const html = createFallbackInputHtml();
        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        const root = tpl.content.firstElementChild;
        if (!root) return document.createElement('div');

        const textarea = root.querySelector('#yi-pet-chat-input');
        const imageInput = root.querySelector('#yi-pet-chat-image-input');
        const draftImagesContainer = root.querySelector('.yi-pet-chat-draft-images');
        const requestStatusButton = root.querySelector('#request-status-btn');
        const contextSwitchContainer = root.querySelector('.context-switch-container');
        const contextSwitch = root.querySelector('#context-switch');

        const updateInputState = () => {
            if (!textarea) return;
            const hasContent = String(textarea.value || '').trim().length > 0;
            textarea.classList.toggle('chat-message-input--has-content', hasContent);
        };

        const onTextareaInput = () => {
            if (!textarea) return;
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.max(60, textarea.scrollHeight)}px`;
            updateInputState();
            if (instance && typeof instance.scrollToBottom === 'function') instance.scrollToBottom();
        };

        const onTextareaPaste = async (e) => {
            const items = e?.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
            const imageItems = items.filter((item) => item && typeof item.type === 'string' && item.type.includes('image'));
            if (imageItems.length === 0) return;
            e.preventDefault();

            const maxDraftImages = typeof instance?.maxDraftImages === 'number' ? instance.maxDraftImages : 4;
            const current = Array.isArray(instance?.draftImages) ? instance.draftImages : [];
            const remainingSlots = maxDraftImages - current.length;
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
                            if (src) current.push(src);
                            resolve();
                        };
                        reader.onerror = () => resolve();
                        reader.readAsDataURL(file);
                    });
                })
            );

            if (instance) instance.draftImages = current;
            updateDraftImagesDisplay(instance);
        };

        let isComposing = false;
        let compositionEndTime = 0;
        const COMPOSITION_END_DELAY = 100;

        const onCompositionStart = () => {
            isComposing = true;
            compositionEndTime = 0;
            if (textarea) textarea.composing = true;
        };
        const onCompositionUpdate = () => {
            isComposing = true;
            compositionEndTime = 0;
            if (textarea) textarea.composing = true;
        };
        const onCompositionEnd = () => {
            isComposing = false;
            compositionEndTime = Date.now();
            if (textarea) textarea.composing = false;
        };

        const onTextareaKeydown = (e) => {
            if (!textarea) return;
            if (e.key !== 'Enter') {
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
                if (instance && typeof instance.sendMessage === 'function') instance.sendMessage();
            }
        };

        if (textarea) {
            textarea.addEventListener('input', onTextareaInput);
            textarea.addEventListener('keydown', onTextareaKeydown);
            textarea.addEventListener('paste', onTextareaPaste);
            textarea.addEventListener('compositionstart', onCompositionStart);
            textarea.addEventListener('compositionupdate', onCompositionUpdate);
            textarea.addEventListener('compositionend', onCompositionEnd);
        }

        const bindAction = (action, handler) => {
            const btn = root.querySelector(`[data-action="${action}"]`);
            if (btn) btn.addEventListener('click', (e) => handler(e));
        };
        bindAction('context', (e) => {
            e?.stopPropagation?.();
            if (typeof manager?.openContextEditor === 'function') manager.openContextEditor();
        });
        bindAction('edit-session', async (e) => {
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
        });
        bindAction('tag-manager', async (e) => {
            e?.stopPropagation?.();
            await openTagManagerSafe(manager);
        });
        bindAction('faq', async (e) => {
            e?.stopPropagation?.();
            await openFaqManagerSafe(manager);
        });
        bindAction('wechat', (e) => {
            e?.stopPropagation?.();
            if (typeof manager?.openWeChatSettings === 'function') {
                manager.openWeChatSettings();
                return;
            }
            if (typeof manager?.showSettingsModal === 'function') {
                manager.showSettingsModal();
            }
        });
        bindAction('image', (e) => {
            e?.stopPropagation?.();
            if (imageInput) imageInput.click();
        });

        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                handleImageInputChange(manager, instance, e);
            });
        }

        if (contextSwitchContainer && contextSwitch) {
            const updateSwitchState = (isChecked) => {
                contextSwitchContainer.classList.toggle('active', !!isChecked);
            };
            updateSwitchState(!!contextSwitch.checked);

            contextSwitchContainer.addEventListener('click', (e) => {
                e?.stopPropagation?.();
                contextSwitch.checked = !contextSwitch.checked;
                updateSwitchState(contextSwitch.checked);
                writeContextSwitchEnabledToStorage(contextSwitch.checked);
                try {
                    contextSwitch.dispatchEvent(new Event('change'));
                } catch (_) {}
            });
            contextSwitch.addEventListener('click', (e) => e.stopPropagation());
            contextSwitch.addEventListener('change', () => {
                updateSwitchState(contextSwitch.checked);
                writeContextSwitchEnabledToStorage(contextSwitch.checked);
            });

            try {
                Promise.resolve()
                    .then(() => readContextSwitchEnabledFromStorage())
                    .then((v) => {
                        if (v !== undefined) {
                            contextSwitch.checked = v;
                            updateSwitchState(contextSwitch.checked);
                        }
                    });
            } catch (_) {}

            contextSwitchContainer.updateColor = () => {};
        }

        if (requestStatusButton) {
            requestStatusButton.addEventListener('click', (e) => {
                e?.stopPropagation?.();
                if (instance && typeof instance.abortRequest === 'function') instance.abortRequest();
            });
        }

        if (instance) {
            instance.inputContainer = root;
            instance.messageInput = textarea;
            instance.imageInput = imageInput;
            instance.draftImagesContainer = draftImagesContainer;
            instance.requestStatusButton = requestStatusButton;
            instance.contextSwitchContainer = contextSwitchContainer;
            if (instance.contextSwitchContainer) instance.contextSwitchContainer.updateColor = () => {};

            instance.handleImageInputChange = (e) => handleImageInputChange(manager, instance, e);
            instance.removeDraftImage = (index) => removeDraftImage(instance, index);
            instance.clearDraftImages = () => clearDraftImages(instance);
            instance.previewDraftImage = (src, index) => previewDraftImage(src, index);
        }

        updateInputState();
        updateDraftImagesDisplay(instance);
        return root;
    }

    window.PetManager.Components.ChatInput = {
        loadTemplate,
        createComponent,
        createInputContainerElement,
        updateDraftImagesDisplay
    };
})();
