(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};
    if (!window.PetManager.Components.ChatWindowHooks) window.PetManager.Components.ChatWindowHooks = {};

    window.PetManager.Components.ChatWindowHooks.useMethods = function useMethods(params) {
        const { manager, instance, store } = params;
        const createSidebarMethods = () => {
            const sidebarHooks = window.PetManager?.Components?.SessionSidebarHooks || {};
            if (typeof sidebarHooks.useMethods === 'function') {
                return sidebarHooks.useMethods({ manager, store });
            }

            let timer = null;

            const clearSearch = () => {
                store.searchValue.value = '';
                manager.sessionTitleFilter = '';
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            };

            const onSearchInput = (e) => {
                store.searchValue.value = e?.target?.value ?? '';
                manager.sessionTitleFilter = (store.searchValue.value || '').trim();
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
                }, 300);
            };

            const onSearchKeydown = (e) => {
                if (e?.key === 'Escape') {
                    clearSearch();
                }
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

            return {
                clearSearch,
                onSearchInput,
                onSearchKeydown,
                onBatchToggleClick,
                onExportClick,
                onImportClick,
                onAddClick
            };
        };

        const sidebarMethods = createSidebarMethods();

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
            ...sidebarMethods,
            onAuthClick,
            onRefreshClick,
            onSidebarToggleClick
        };
    };

    window.PetManager.Components.ChatWindowHooks.applyWindowMethods = function applyWindowMethods(proto) {
        if (!proto) return;

        proto.updateRequestStatus = function updateRequestStatus(status) {
            const btn = this.requestStatusButton;
            if (!btn) return;

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
        };

        proto.abortRequest = function abortRequest() {
            if (this._currentAbortController) {
                this.updateRequestStatus('stopping');
                this._currentAbortController.abort();
                this._currentAbortController = null;

                if (typeof this.manager.showNotification === 'function') {
                    this.manager.showNotification('请求已取消', 'info');
                }
            }
        };

        proto._updateRequestStatus = function _updateRequestStatus(status, abortController = null) {
            if (this._setAbortController) {
                this._setAbortController(abortController);
            }
            this.isProcessing = (status === 'loading');

            if (this.element) {
                const metaActions = this.element.querySelectorAll('.pet-chat-meta-actions');
                metaActions.forEach((container) => {
                    const buttons = container.querySelectorAll('button[data-standard-button="true"]');
                    buttons.forEach((btn) => {
                        const btnText = btn.textContent || '';
                        if (btnText.includes('📨') || btnText.includes('🔄') || btnText.includes('🗑️')) {
                            btn.disabled = this.isProcessing;
                        }
                    });
                });
            }
        };

        proto._setAbortController = function _setAbortController(controller) {
            this.abortController = controller;
        };

        proto.createResizeHandles = function createResizeHandles() {
            const positions = ['ne', 'nw', 'se', 'sw'];

            positions.forEach((pos) => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${pos}`;

                handle.addEventListener('mousedown', (e) => this.initResize(e, pos));
                this.element.appendChild(handle);
                this.resizeHandles[pos] = handle;
            });
        };

        proto.bindEvents = function bindEvents() {
            this.header.addEventListener('mousedown', (e) => {
                const isButton = e.target.closest('button') || e.target.closest('.yi-pet-chat-header-btn');
                if (isButton) {
                    return;
                }
                if (Date.now() < this._suppressDragUntil) return;
                this.initDrag(e);
            });

            this.header.addEventListener('dblclick', (e) => {
                const isButton = e.target.closest('button') || e.target.closest('.yi-pet-chat-header-btn');
                if (isButton) return;
                if (this._fullscreenAnimating) return;
                this._fullscreenAnimating = true;
                this._suppressDragUntil = Date.now() + 300;
                requestAnimationFrame(() => {
                    this.toggleFullscreen();
                    this._fullscreenAnimating = false;
                });
            });

            this.messagesContainer.addEventListener(
                'wheel',
                (e) => {
                    e.stopPropagation();
                },
                { passive: true }
            );
        };

        proto.initDrag = function initDrag(e) {
            if (this.isResizing || this.manager.isFullscreen) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = this.element.offsetLeft;
            const startTop = this.element.offsetTop;

            let isDragStarted = false;
            const dragThreshold = 5;

            const onMouseMove = (e2) => {
                if (!isDragStarted) {
                    const moveX = Math.abs(e2.clientX - startX);
                    const moveY = Math.abs(e2.clientY - startY);

                    if (moveX > dragThreshold || moveY > dragThreshold) {
                        isDragStarted = true;
                        this.isDragging = true;
                        this.element.classList.add('dragging');
                    } else {
                        return;
                    }
                }

                if (!this.isDragging) return;

                const dx = e2.clientX - startX;
                const dy = e2.clientY - startY;

                this.element.style.left = `${startLeft + dx}px`;
                this.element.style.top = `${startTop + dy}px`;
                this.element.style.bottom = 'auto';
                this.element.style.right = 'auto';
            };

            const onMouseUp = () => {
                if (isDragStarted) {
                    this.isDragging = false;
                    this.element.classList.remove('dragging');

                    if (typeof this.manager.saveWindowPosition === 'function') {
                        this.manager.saveWindowPosition();
                    }
                }

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        proto.initResize = function initResize(e, pos) {
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

            const onMouseMove = (e2) => {
                if (!this.isResizing) return;

                const dx = e2.clientX - startX;
                const dy = e2.clientY - startY;

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

                if (typeof this.manager.saveWindowSize === 'function') {
                    this.manager.saveWindowSize();
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        proto.toggleFullscreen = function toggleFullscreen() {
            const manager = this.manager;
            if (!manager.chatWindowState) {
                manager.chatWindowState = {};
            }

            if (!manager.isFullscreen) {
                manager.preFullscreenStyle = {
                    width: this.element.style.width,
                    height: this.element.style.height,
                    top: this.element.style.top,
                    left: this.element.style.left,
                    bottom: this.element.style.bottom,
                    right: this.element.style.right,
                    transform: this.element.style.transform
                };

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

                this.updateFullscreenHeight();

                requestAnimationFrame(() => {
                    this.updateFullscreenHeight();
                });

                if (!this._fullscreenResizeHandler) {
                    this._fullscreenResizeHandler = () => {
                        if (manager.isFullscreen) {
                            if (this._fullscreenResizeTimer) {
                                clearTimeout(this._fullscreenResizeTimer);
                            }
                            this._fullscreenResizeTimer = setTimeout(() => {
                                this.updateFullscreenHeight();
                            }, 50);
                        }
                    };
                    window.addEventListener('resize', this._fullscreenResizeHandler);
                    if (window.visualViewport) {
                        window.visualViewport.addEventListener('resize', this._fullscreenResizeHandler);
                        window.visualViewport.addEventListener('scroll', this._fullscreenResizeHandler);
                    }
                }

                if (this.header) {
                    this.header.title = '双击退出全屏';
                }
            } else {
                if (this._fullscreenResizeTimer) {
                    clearTimeout(this._fullscreenResizeTimer);
                    this._fullscreenResizeTimer = null;
                }

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

                manager.isFullscreen = false;
                manager.chatWindowState.isFullscreen = false;
                this.element.classList.remove('fullscreen');

                if (this.header) {
                    this.header.title = '拖拽移动窗口 | 双击全屏';
                }
            }
        };

        proto.updateFullscreenHeight = function updateFullscreenHeight() {
            if (!this.manager || !this.manager.isFullscreen || !this.element) return;

            let viewportHeight;
            if (window.visualViewport && window.visualViewport.height) {
                viewportHeight = window.visualViewport.height;
            } else {
                viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            }

            if (!viewportHeight || viewportHeight <= 0) {
                viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
            }

            this.element.style.setProperty('height', `${viewportHeight}px`, 'important');
            this.element.style.setProperty('max-height', `${viewportHeight}px`, 'important');
            this.element.style.setProperty('min-height', `${viewportHeight}px`, 'important');

            requestAnimationFrame(() => {
                void this.element.offsetHeight;

                const contentContainer = this.element.querySelector('.yi-pet-chat-content-container');
                if (contentContainer) {
                    void contentContainer.offsetHeight;
                }

                const mainContent = this.element.querySelector('.yi-pet-chat-main-content, .yi-pet-chat-right-panel');
                if (mainContent) {
                    void mainContent.offsetHeight;
                }

                if (this.messagesContainer) {
                    void this.messagesContainer.offsetHeight;
                }

                const inputContainer = this.inputContainer || this.element.querySelector('.yi-pet-chat-input-container');
                if (inputContainer) {
                    void inputContainer.offsetHeight;
                    inputContainer.style.setProperty('flex-shrink', '0', 'important');
                    inputContainer.style.setProperty('position', 'relative', 'important');
                    inputContainer.style.setProperty('z-index', '10', 'important');
                }
            });
        };

        proto._getOrCreateMessageContentDiv = function _getOrCreateMessageContentDiv(messageBubble, streaming = false) {
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
        };

        proto._findUserMessageForRetry = function _findUserMessageForRetry(messageDiv, messagesContainer) {
            const allMessages = Array.from(messagesContainer.children);
            const currentIndex = allMessages.indexOf(messageDiv);

            if (currentIndex === -1) {
                throw new Error('当前消息不在消息容器中');
            }

            for (let i = currentIndex - 1; i >= 0; i--) {
                const messageElement = allMessages[i];
                const userBubble = messageElement.querySelector('[data-message-type="user-bubble"]');

                if (userBubble) {
                    const userMessageText =
                        userBubble.getAttribute('data-original-text') || userBubble.textContent || userBubble.innerText;

                    if (userMessageText && userMessageText.trim()) {
                        return userMessageText.trim();
                    }
                }
            }

            return null;
        };

        proto._getWaitingIcon = function _getWaitingIcon() {
            if (this.element) {
                const welcomeActions = this.element.querySelector('#pet-welcome-actions');
                if (welcomeActions) {
                    const firstButton = welcomeActions.querySelector('[data-action-key]');
                    if (firstButton && firstButton.innerHTML) {
                        return firstButton.innerHTML.trim();
                    }
                }
            }
            return '⏳';
        };

        proto._updateTryAgainButtonState = function _updateTryAgainButtonState(button, state) {
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

            button.classList.remove('try-again-button--loading', 'try-again-button--success', 'try-again-button--error');

            if (state !== 'idle') {
                button.classList.add(`try-again-button--${state}`);
            }
        };

        proto._createStreamContentCallback = function _createStreamContentCallback(messageBubble, messagesContainer, messageDiv = null) {
            let fullContent = '';

            if (messageDiv) {
                messageDiv.classList.add('is-streaming');
            }

            const callback = (chunk, accumulatedContent) => {
                fullContent = accumulatedContent;

                let contentDiv = messageBubble.querySelector('.pet-chat-content');
                if (!contentDiv) {
                    contentDiv = document.createElement('div');
                    contentDiv.className = 'pet-chat-content md-preview-body pet-chat-content-streaming';
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
                    if (!contentDiv.classList.contains('pet-chat-content-streaming')) {
                        contentDiv.classList.add('pet-chat-content-streaming');
                    }
                }

                contentDiv.innerHTML = this.manager.renderMarkdown(fullContent);
                messageBubble.setAttribute('data-original-text', fullContent);

                if (messageBubble._mermaidTimeout) {
                    clearTimeout(messageBubble._mermaidTimeout);
                }
                messageBubble._mermaidTimeout = setTimeout(async () => {
                    try {
                        await this.manager.loadMermaid();
                        const hasMermaidCode = contentDiv.querySelector(
                            'code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"], div.mermaid'
                        );
                        if (hasMermaidCode) {
                            await this.manager.processMermaidBlocks(contentDiv);
                        }
                    } catch (error) {
                        console.error('处理 Mermaid 图表时出错:', error);
                    }
                    messageBubble._mermaidTimeout = null;
                }, 500);

                if (this.messagesContainer) {
                    this.scrollToBottom();
                }
                return fullContent;
            };
            callback.getFullContent = () => fullContent;
            return callback;
        };

        proto._retryGenerateResponse = async function _retryGenerateResponse(messageDiv, userMessageText, messagesContainer) {
            const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
            if (!messageBubble) {
                throw new Error('未找到消息气泡');
            }

            const waitingIcon = this._getWaitingIcon();
            const contentDiv = this._getOrCreateMessageContentDiv(messageBubble);
            if (contentDiv) {
                contentDiv.innerHTML = this.manager.renderMarkdown(`${waitingIcon} 正在重新生成回复...`);
                messageBubble.setAttribute('data-original-text', `${waitingIcon} 正在重新生成回复...`);
            }
            this.scrollToBottom(true);

            const onStreamContent = this._createStreamContentCallback(messageBubble, messagesContainer, messageDiv);

            const abortController = new AbortController();
            this._updateRequestStatus('loading', abortController);

            try {
                const reply = await this.manager.generatePetResponseStream(userMessageText, onStreamContent, abortController);
                const streamedReply =
                    onStreamContent && typeof onStreamContent.getFullContent === 'function' ? onStreamContent.getFullContent() : '';
                const finalContent = String(streamedReply || reply || '').trim() || '请继续。';

                messageDiv.classList.remove('is-streaming');
                const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
                if (finalContentDiv) {
                    finalContentDiv.classList.remove('pet-chat-content-streaming');
                }

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

                this.scrollToBottom();

                return finalContent;
            } catch (error) {
                messageDiv.classList.remove('is-streaming');
                const errorContentDiv = messageBubble.querySelector('.pet-chat-content');
                if (errorContentDiv) {
                    errorContentDiv.classList.remove('pet-chat-content-streaming');
                }
                throw error;
            } finally {
                messageDiv.classList.remove('is-streaming');
                const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
                if (finalContentDiv) {
                    finalContentDiv.classList.remove('pet-chat-content-streaming');
                }
                this._updateRequestStatus('idle', null);
            }
        };

        proto._handleRetryError = function _handleRetryError(messageDiv, error) {
            const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

            if (!isAbortError) {
                console.error('重新生成回复失败:', error);

                const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                if (messageBubble) {
                    const originalText = messageBubble.getAttribute('data-original-text') || '抱歉，重新生成失败，请稍后重试。';
                    const contentDiv = this._getOrCreateMessageContentDiv(messageBubble);
                    if (contentDiv) {
                        contentDiv.innerHTML = this.manager.renderMarkdown(originalText);
                    }
                }
            }

            return isAbortError;
        };

        proto._setupSidebarAfterRender = function _setupSidebarAfterRender(sidebarEl, options = {}) {
            const manager = this.manager;
            const { store, computedProps, methods, bindSidebarDomEvents } = options;

            const sidebarWidth = manager.sidebarWidth || 320;
            manager.sidebarWidth = sidebarWidth;
            sidebarEl.style.setProperty('--session-sidebar-width', `${sidebarWidth}px`);
            manager.sessionSidebar = sidebarEl;

            const tagMount = sidebarEl.querySelector('#yi-pet-tag-filter-mount');
            if (tagMount) {
                const hasVueTagFilter =
                    !!tagMount.querySelector('[data-pet-tag-filter="vue"]') || !!sidebarEl.querySelector('[data-pet-tag-filter="vue"]');
                if (!hasVueTagFilter) {
                    const SessionSidebarModule = window.PetManager?.Components?.SessionSidebar;
                    const tagFilterContainer =
                        SessionSidebarModule && typeof SessionSidebarModule.createTagFilterFallbackElement === 'function'
                            ? SessionSidebarModule.createTagFilterFallbackElement()
                            : null;
                    if (tagFilterContainer) tagMount.replaceWith(tagFilterContainer);
                }
            }

            const batchMount = sidebarEl.querySelector('#yi-pet-batch-toolbar-mount');
            if (batchMount) {
                const hasVueBatchToolbar =
                    !!batchMount.querySelector('[data-pet-batch-toolbar="vue"]') ||
                    !!sidebarEl.querySelector('[data-pet-batch-toolbar="vue"]');
                if (!hasVueBatchToolbar) {
                    const SessionSidebarModule = window.PetManager?.Components?.SessionSidebar;
                    const batchToolbar =
                        typeof manager.buildBatchToolbar === 'function'
                            ? manager.buildBatchToolbar()
                            : SessionSidebarModule && typeof SessionSidebarModule.createBatchToolbarElement === 'function'
                              ? SessionSidebarModule.createBatchToolbarElement(manager)
                              : null;
                    if (batchToolbar) batchMount.replaceWith(batchToolbar);
                }
            }

            if (bindSidebarDomEvents) {
                this._bindSidebarDomEvents(sidebarEl, { store, computedProps, methods });
            }

            this.sessionListContainer = sidebarEl.querySelector('#session-list');
            this.createSidebarResizer(sidebarEl);

            setTimeout(() => {
                if (typeof manager.updateSessionSidebar === 'function') manager.updateSessionSidebar();
            }, 0);
        };

        proto._bindHeaderDomEvents = function _bindHeaderDomEvents(rootEl, methods) {
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
        };

        proto._bindSidebarDomEvents = function _bindSidebarDomEvents(sidebarEl, options = {}) {
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
        };
    };
})();
