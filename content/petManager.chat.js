/**
 * PetManager - 聊天窗口相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 切换聊天窗口
    proto.toggleChatWindow = function() {
        if (this.isChatOpen) {
            this.closeChatWindow();
        } else {
            this.openChatWindow();
        }
    };

    // 仅切换聊天窗口的显示/隐藏状态（用于快捷键，不影响其他功能）
    proto.toggleChatWindowVisibility = function() {
        if (!this.chatWindow) {
            // 如果窗口还未创建，需要先创建
            this.openChatWindow();
            return;
        }
        
        if (this.isChatOpen) {
            // 仅隐藏窗口，不保存会话，不影响其他功能
            this.chatWindow.style.display = 'none';
            this.isChatOpen = false;
        } else {
            // 仅显示窗口，不重新初始化，不影响其他功能
            this.chatWindow.style.display = 'block';
            this.isChatOpen = true;
        }
    };

    // 预加载 html2canvas 库（用于导出聊天记录功能）
    // 注意：html2canvas 现在通过 manifest.json 的 content_scripts 自动加载
    proto.preloadHtml2Canvas = function() {
        // html2canvas 已经通过 content_scripts 加载，这个方法保留用于向后兼容
        if (typeof html2canvas !== 'undefined') {
            console.log('html2canvas 已加载');
        } else {
            console.warn('html2canvas 未加载，请检查扩展配置');
        }
    };

    // 打开聊天窗口
    proto.openChatWindow = async function() {
        // 预加载 html2canvas 库（用于导出功能）
        this.preloadHtml2Canvas();
        
        // 如果是第一次打开聊天窗口，加载会话列表和文件列表
        if (this.isChatWindowFirstOpen) {
            this.isChatWindowFirstOpen = false;
            console.log('第一次打开聊天窗口，加载会话列表和文件列表...');
            
            // 加载会话列表（强制刷新）
            if (this.sessionApi && this.sessionApi.isEnabled()) {
                try {
                    await this.loadSessionsFromBackend(true);
                } catch (error) {
                    console.warn('第一次打开聊天窗口时加载会话列表失败:', error);
                }
            }
            
            // 不再自动加载文件列表，改为在第一次切换文件视图时才请求
        }
        
        if (this.chatWindow) {
            this.chatWindow.style.display = 'block';
            this.isChatOpen = true;

            // 初始化会话
            await this.initSession();

            // 重新初始化滚动功能
            this.initializeChatScroll();

            // 更新模型选择器显示
            this.updateChatModelSelector();

            // 更新聊天窗口颜色
            this.updateChatWindowColor();
            
            // 更新聊天窗口标题（显示当前会话名称）
            this.updateChatHeaderTitle();
            
            // 确保会话侧边栏已更新（如果侧边栏已创建）
            if (this.sessionSidebar) {
                await this.loadAllSessions(); // 确保数据已加载
                await this.updateSessionSidebar();
            }
            
            
            return;
        }

        // 初始化聊天窗口状态（先设置默认值）
        const defaultSize = PET_CONFIG.chatWindow.defaultSize;
        const defaultPosition = getChatWindowDefaultPosition(defaultSize.width, defaultSize.height);

        this.chatWindowState = {
            x: defaultPosition.x,
            y: defaultPosition.y,
            width: defaultSize.width,
            height: defaultSize.height,
            isDragging: false,
            isResizing: false,
            resizeType: 'bottom-right', // 默认缩放类型
            dragStart: { x: 0, y: 0 },
            resizeStart: { x: 0, y: 0, width: 0, height: 0 },
            isFullscreen: false,
            originalState: null // 保存全屏前的原始状态
        };

        // 尝试加载保存的聊天窗口状态（会覆盖默认值）
        // 加载完成后创建窗口
        this.loadChatWindowState(async (success) => {
            if (success) {
                console.log('聊天窗口状态已加载，创建窗口');
            } else {
                console.log('使用默认聊天窗口状态，创建窗口');
            }

            // 初始化会话
            await this.initSession();

            await this.createChatWindow();
            this.isChatOpen = true;
            
            // 更新聊天窗口标题（显示当前会话名称）
            this.updateChatHeaderTitle();
        });
    };

    // 关闭聊天窗口
    proto.closeChatWindow = function() {
        if (this.chatWindow) {
            // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
            this.chatWindow.style.display = 'none';
            this.isChatOpen = false;
        }
    };

    // 初始化聊天窗口滚动
    proto.initializeChatScroll = function() {
        if (!this.chatWindow) return;

        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (messagesContainer) {
            // 确保滚动功能正常
            messagesContainer.style.overflowY = 'auto';

            // 滚动到底部显示最新消息
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);

            // 强制重新计算布局
            messagesContainer.style.height = 'auto';
            messagesContainer.offsetHeight; // 触发重排

            // 添加滚动事件监听器，确保滚动功能正常
            messagesContainer.addEventListener('scroll', () => {
                // 可以在这里添加滚动相关的逻辑
            });
        }
    };

    // 更新聊天窗口中的模型选择器显示
    proto.updateChatModelSelector = function() {
        if (!this.chatWindow) return;

        const modelSelector = this.chatWindow.querySelector('.chat-model-selector');
        if (modelSelector) {
            modelSelector.value = this.currentModel;
        }
    };

    // 更新聊天窗口标题
    proto.updateChatHeaderTitle = function() {
        if (!this.chatWindow) return;
        
        const titleTextEl = this.chatWindow.querySelector('#pet-chat-header-title-text');
        if (!titleTextEl) return;
        
        // 获取当前会话名称
        if (this.currentSessionId && this.sessions[this.currentSessionId]) {
            const sessionTitle = this.sessions[this.currentSessionId].pageTitle || '未命名会话';
            // 如果标题太长，截断并添加省略号
            const displayTitle = sessionTitle.length > 20 
                ? sessionTitle.substring(0, 20) + '...' 
                : sessionTitle;
            titleTextEl.textContent = displayTitle;
        } else {
            // 如果没有会话，显示默认文本
            titleTextEl.textContent = '与我聊天';
        }
    };

    // 更新聊天窗口颜色（跟随宠物颜色）
    proto.updateChatWindowColor = function() {
        if (!this.chatWindow) return;

        // 获取当前宠物颜色
        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);

        // 更新聊天窗口头部元素
        const chatHeader = this.chatWindow.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.style.setProperty('background', currentColor, 'important');
        }

        // 更新输入框边框颜色
        const messageInput = this.chatWindow.querySelector('.chat-message-input');
        if (messageInput) {
            messageInput.style.setProperty('border-color', mainColor, 'important');
        }

        // 更新模型选择器边框颜色
        const modelSelector = this.chatWindow.querySelector('.chat-model-selector');
        if (modelSelector) {
            modelSelector.style.setProperty('border-color', mainColor, 'important');
        }

        // 更新所有使用颜色的按钮
        const allButtons = this.chatWindow.querySelectorAll('button');
        allButtons.forEach(button => {
            // 跳过关闭按钮（保持白色）
            if (button.textContent.includes('✕')) return;

            // 更新@按钮和+按钮
            if (button.innerHTML === '@' || button.innerHTML === '+') {
                button.style.setProperty('color', mainColor, 'important');
                button.style.setProperty('border-color', mainColor, 'important');
                button.setAttribute('data-theme-color', mainColor);
            }

            // 更新图片上传按钮
            if (button.className.includes('chat-image-upload-button')) {
                button.style.setProperty('color', mainColor, 'important');
                button.style.setProperty('border-color', mainColor, 'important');
                button.setAttribute('data-theme-color', mainColor);
            }
        });

        // 更新页面上下文开关颜色
        const contextSwitchContainer = this.chatWindow.querySelector('.context-switch-container');
        if (contextSwitchContainer && contextSwitchContainer.updateColor) {
            contextSwitchContainer.updateColor();
        }

        // 更新所有已有消息的气泡和头像颜色（仅宠物消息）
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (messagesContainer) {
            // 更新宠物头像
            const petAvatars = messagesContainer.querySelectorAll('[data-message-type="pet-avatar"]');
            petAvatars.forEach(avatar => {
                avatar.style.setProperty('background', currentColor, 'important');
            });

            // 更新宠物消息气泡
            const petBubbles = messagesContainer.querySelectorAll('[data-message-type="pet-bubble"]');
            petBubbles.forEach(bubble => {
                bubble.style.setProperty('background', currentColor, 'important');
            });
        }
    };

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
    };

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
    };

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
    };

})();

