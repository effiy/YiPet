/**
 * PetManager - Chat Window UI Logic
 * Extracted from petManager.core.js
 */
(function() {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') return;
    const proto = window.PetManager.prototype;

    // 动态更新上下文覆盖层的位置与尺寸，避免遮挡 chat-header

    // 更新聊天窗口中的模型选择器显示

    // 创建聊天窗口
    proto.createChatWindow = async function() {
        console.log('PetManager: Using ChatWindow component');
        
        // Ensure components namespace exists
        if (!window.PetManager.Components || !window.PetManager.Components.ChatWindow) {
            console.error('PetManager: ChatWindow component not found');
            return null;
        }

        // Create instance if not exists
        if (!this.chatUiComponent) {
            this.chatUiComponent = new window.PetManager.Components.ChatWindow(this);
        }

        // Create the window
        this.chatWindow = await this.chatUiComponent.create();
        if (!this.chatWindow) {
            console.error('PetManager: ChatWindow create() returned null');
            return null;
        }

        this.chatWindowComponent = this.chatUiComponent;
        
        // Add to document if not already added
        if (this.chatWindow && !this.chatWindow.parentNode) {
            document.body.appendChild(this.chatWindow);
        }
        
        // 加载并应用侧边栏折叠状态（确保侧边栏正确显示）
        if (typeof this.loadSidebarCollapsed === 'function') {
            this.loadSidebarCollapsed();
        } else {
            // 如果加载方法不存在，确保侧边栏默认显示
            this.sidebarCollapsed = false;
            if (this.chatWindowComponent && typeof this.chatWindowComponent.setSidebarCollapsed === 'function') {
                this.chatWindowComponent.setSidebarCollapsed(false);
            } else if (this.sessionSidebar) {
                this.sessionSidebar.classList.remove('js-hidden');
                this.sessionSidebar.classList.remove('collapsed');
            }
        }
        
        // Initialize messages only; 会话列表由打开聊天窗口时统一加载
        await this.updateSessionSidebar();
        await this.loadSessionMessages();
        
        // Listen for role config changes (Legacy support)
        if (!this.roleConfigChangeListener && chrome && chrome.storage) {
            this.roleConfigChangeListener = async (changes, namespace) => {
                if (namespace === 'local' && changes.roleConfigs) {
                    await this.refreshWelcomeActionButtons();
                    await this.refreshAllMessageActionButtons();
                }
            };
            chrome.storage.onChanged.addListener(this.roleConfigChangeListener);
        }
        return this.chatWindow;
    }

    // 更新消息容器的底部padding（公共方法）- 已移除，由CSS处理


    // 更新聊天窗口样式
    proto.updateChatWindowStyle = function() {
        if (this.chatUiComponent) {
            this.chatUiComponent.updateChatWindowStyle();
        }
    }

    // 切换全屏模式
    proto.toggleFullscreen = function() {
        if (this.chatUiComponent) {
            this.chatUiComponent.toggleFullscreen();
        }
    }

    // 从渐变色中提取主色调
    proto.getMainColorFromGradient = function(gradient) {
        const match = gradient.match(/#[0-9a-fA-F]{6}/);
        return match ? match[0] : '#3b82f6';
    }

    // 更新聊天窗口标题（显示当前会话名称）
    proto.updateChatHeaderTitle = function() {
        if (this.chatUiComponent) {
            this.chatUiComponent.updateChatHeaderTitle();
        }
    }

    // 更新聊天窗口颜色（跟随宠物颜色）
    proto.updateChatWindowColor = function() {
        if (this.chatUiComponent) {
            this.chatUiComponent.updateTheme();
        }
    }
    // 保存聊天窗口状态
    proto.saveChatWindowState = function() {
        if (!this.chatWindowState) return;

        try {
            const state = {
                x: this.chatWindowState.x,
                y: this.chatWindowState.y,
                width: this.chatWindowState.width,
                height: this.chatWindowState.height,
                timestamp: Date.now()
            };

            // 保存到chrome.storage.local避免写入配额限制
            chrome.storage.local.set({ [PET_CONFIG.storage.keys.chatWindowState]: state }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('保存聊天窗口状态失败:', chrome.runtime.lastError.message);
                } else {
                    console.log('聊天窗口状态已保存到local存储:', state);
                }
            });
        } catch (error) {
            console.log('保存聊天窗口状态失败:', error);
        }
    }

    // 加载聊天窗口状态
    proto.loadChatWindowState = function(callback) {
        try {
            chrome.storage.local.get([PET_CONFIG.storage.keys.chatWindowState], (result) => {
                if (result[PET_CONFIG.storage.keys.chatWindowState]) {
                    const state = result[PET_CONFIG.storage.keys.chatWindowState];
                    this.restoreChatWindowState(state);

                    // 更新聊天窗口样式（如果已经创建）
                    if (this.chatWindow) {
                        this.updateChatWindowStyle();
                    }

                    if (callback) callback(true);
                } else {
                    if (callback) callback(false);
                }
            });

            // 监听存储变化，实现跨页面同步
            chrome.storage.onChanged.addListener((changes, namespace) => {
                // 监听 local 存储的变化（新版本使用 local 避免写入配额限制）
                if (namespace === 'local' && changes[PET_CONFIG.storage.keys.chatWindowState]) {
                    const newState = changes[PET_CONFIG.storage.keys.chatWindowState].newValue;
                    if (newState && !this.chatWindowState.isDragging && !this.chatWindowState.isResizing) {
                        this.restoreChatWindowState(newState);

                        // 更新聊天窗口样式（如果已经创建）
                        if (this.chatWindow) {
                            this.updateChatWindowStyle();
                            console.log('聊天窗口状态已从local存储更新:', newState);
                        }
                    }
                }
            });

            return true;
        } catch (error) {
            console.log('恢复聊天窗口状态失败:', error);
            if (callback) callback(false);
            return false;
        }
    }

    // 恢复聊天窗口状态（应用位置和大小）
    proto.restoreChatWindowState = function(state) {
        this.chatWindowState = {
            ...this.chatWindowState,
            ...state,
            isDragging: false,
            isResizing: false,
            resizeType: 'bottom-right', // 默认缩放类型
            isFullscreen: false // Force false on restore to ensure consistent start state
        };

        // Sync manager state
        this.isFullscreen = false;
        this.preFullscreenStyle = null;

        if (this._forceDockedChatWindowOnOpen) {
            try {
                const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
                const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
                const sizeLimits = PET_CONFIG?.chatWindow?.sizeLimits || {};
                const minWidth = Number.isFinite(sizeLimits.minWidth) ? sizeLimits.minWidth : 300;
                const maxWidth = Number.isFinite(sizeLimits.maxWidth) ? sizeLimits.maxWidth : viewportWidth;
                const maxHeight = Number.isFinite(sizeLimits.maxHeight) ? sizeLimits.maxHeight : viewportHeight;

                const desiredWidth = Math.round(viewportWidth * 0.5);
                const width = Math.min(Math.max(desiredWidth, minWidth), Math.min(maxWidth, viewportWidth));
                const height = Math.min(maxHeight, viewportHeight);

                this.chatWindowState.width = width;
                this.chatWindowState.height = height;
                this.chatWindowState.x = Math.max(0, viewportWidth - width);
                this.chatWindowState.y = 0;
            } catch (_) {}
            this._forceDockedChatWindowOnOpen = false;
        }

        // 验证位置和大小
        const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
        const minWidth = PET_CONFIG.chatWindow.sizeLimits.minWidth;
        const maxWidth = PET_CONFIG.chatWindow.sizeLimits.maxWidth;
        const minHeight = PET_CONFIG.chatWindow.sizeLimits.minHeight;
        const maxHeight = PET_CONFIG.chatWindow.sizeLimits.maxHeight;

        const safeMinWidth = Math.min(minWidth, viewportWidth);
        const safeMinHeight = Math.min(minHeight, viewportHeight);

        this.chatWindowState.width = Math.max(safeMinWidth, Math.min(Math.min(maxWidth, viewportWidth), this.chatWindowState.width));
        this.chatWindowState.height = Math.max(safeMinHeight, Math.min(Math.min(maxHeight, viewportHeight), this.chatWindowState.height));
        this.chatWindowState.x = Math.max(0, Math.min(viewportWidth - this.chatWindowState.width, this.chatWindowState.x));
        this.chatWindowState.y = Math.max(0, Math.min(viewportHeight - this.chatWindowState.height, this.chatWindowState.y));

        console.log('聊天窗口状态已恢复:', this.chatWindowState);
    }

    // 为消息添加动作按钮
    proto.addActionButtonsToMessage = async function(messageDiv, forceRefresh = false) {
        if (this.chatUiComponent && typeof this.chatUiComponent.addActionButtonsToMessage === 'function') {
            await this.chatUiComponent.addActionButtonsToMessage(messageDiv, forceRefresh);
        }
    }

    /**
     * 为宠物消息添加重新生成按钮
     * @param {HTMLElement} container - 按钮容器
     * @param {HTMLElement} messageDiv - 宠物消息元素
     */
    proto.addTryAgainButton = function(container, messageDiv) {
        if (this.chatUiComponent && typeof this.chatUiComponent.addTryAgainButton === 'function') {
            this.chatUiComponent.addTryAgainButton(container, messageDiv);
        }
    }

})();
