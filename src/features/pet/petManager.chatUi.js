/**
 * PetManager - Chat Window UI Logic
 * Extracted from petManager.core.js
 */
(function() {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') return;
    const proto = window.PetManager.prototype;

    // 动态更新上下文覆盖层的位置与尺寸，避免遮挡 chat-header

    // 初始化聊天滚动功能 - 已移除，由 petManager.chat.js 或组件处理


    // 更新聊天窗口中的模型选择器显示

    // 创建聊天窗口
    proto.createChatWindow = async function() {
        console.log('PetManager: Using ChatWindow component');
        
        // Ensure components namespace exists
        if (!window.PetManager.Components || !window.PetManager.Components.ChatWindow) {
            console.error('PetManager: ChatWindow component not found');
            return;
        }

        // Create instance if not exists
        if (!this.chatUiComponent) {
            this.chatUiComponent = new window.PetManager.Components.ChatWindow(this);
        }

        // Create the window
        this.chatWindow = await this.chatUiComponent.create();
        
        // 设置 chatWindowComponent 引用（用于侧边栏控制等方法）
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

    // 添加聊天窗口交互功能 - 已移除，由组件内部处理


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

            // 同时保存到localStorage作为备用
            localStorage.setItem('petChatWindowState', JSON.stringify(state));
            console.log('聊天窗口状态已保存:', state);
        } catch (error) {
            console.log('保存聊天窗口状态失败:', error);
        }
    }

    // 加载聊天窗口状态
    proto.loadChatWindowState = function(callback) {
        try {
            // 首先尝试从Chrome存储API加载全局状态
            chrome.storage.sync.get([PET_CONFIG.storage.keys.chatWindowState], (result) => {
                if (result[PET_CONFIG.storage.keys.chatWindowState]) {
                    const state = result[PET_CONFIG.storage.keys.chatWindowState];
                    this.restoreChatWindowState(state);

                    // 更新聊天窗口样式（如果已经创建）
                    if (this.chatWindow) {
                        this.updateChatWindowStyle();
                    }

                    if (callback) callback(true);
                } else {
                    // 如果全局状态不存在，尝试从localStorage加载
                    const success = this.loadChatWindowStateFromLocalStorage();
                    if (callback) callback(success);
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
                // 兼容旧版本的 sync 存储
                if (namespace === 'sync' && changes[PET_CONFIG.storage.keys.chatWindowState]) {
                    const newState = changes[PET_CONFIG.storage.keys.chatWindowState].newValue;
                    if (newState && !this.chatWindowState.isDragging && !this.chatWindowState.isResizing) {
                        this.restoreChatWindowState(newState);
                        if (this.chatWindow) {
                            this.updateChatWindowStyle();
                            console.log('聊天窗口状态已从sync存储更新（兼容旧版本）:', newState);
                        }
                    }
                }
            });

            return true;
        } catch (error) {
            console.log('恢复聊天窗口状态失败:', error);
            const success = this.loadChatWindowStateFromLocalStorage();
            if (callback) callback(success);
            return success;
        }
    }

    // 从localStorage加载聊天窗口状态（备用方法）
    proto.loadChatWindowStateFromLocalStorage = function() {
        try {
            const savedState = localStorage.getItem('petChatWindowState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.restoreChatWindowState(state);
                console.log('聊天窗口状态已从本地存储恢复:', this.chatWindowState);
                return true;
            }
        } catch (error) {
            console.log('恢复本地聊天窗口状态失败:', error);
        }
        return false;
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

        // 验证位置和大小
        this.chatWindowState.width = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.width));
        this.chatWindowState.height = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.height));
        this.chatWindowState.x = Math.max(0, Math.min(window.innerWidth - this.chatWindowState.width, this.chatWindowState.x));
        this.chatWindowState.y = Math.max(0, Math.min(window.innerHeight - this.chatWindowState.height, this.chatWindowState.y));

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
