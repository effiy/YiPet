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

    // 检查是否接近底部（阈值：50px）
    proto.isNearBottom = function(container, threshold = 50) {
        if (!container) return true;
        const { scrollTop, scrollHeight, clientHeight } = container;
        return scrollHeight - scrollTop - clientHeight <= threshold;
    };

    // 滚动到底部（优化版）
    proto.scrollToBottom = function(smooth = false, force = false) {
        if (!this.chatWindow) return;
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) return;

        // 如果不是强制滚动，且用户不在底部附近，则不自动滚动
        if (!force && !this.isNearBottom(messagesContainer, 100)) {
            return;
        }

        const scrollToBottom = () => {
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };

        if (smooth) {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            // 使用 requestAnimationFrame 优化性能
            requestAnimationFrame(() => {
                scrollToBottom();
                // 延迟一次确保异步内容加载后也能滚动到底部
                requestAnimationFrame(() => {
                    scrollToBottom();
                });
            });
        }
    };

    // 初始化聊天窗口滚动
    proto.initializeChatScroll = function() {
        if (!this.chatWindow) return;

        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (messagesContainer) {
            // 确保滚动功能正常
            messagesContainer.style.overflowY = 'auto';

            // 使用 requestAnimationFrame 优化滚动性能
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                // 再次确保滚动（处理异步内容加载）
                requestAnimationFrame(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                });
            });
        }
    };


    // 更新聊天窗口标题
    proto.updateChatHeaderTitle = function() {
        if (!this.chatWindow) return;
        
        const titleTextEl = this.chatWindow.querySelector('#pet-chat-header-title-text');
        if (!titleTextEl) return;
        
        // 获取当前会话名称
        if (this.currentSessionId && this.sessions[this.currentSessionId]) {
            const session = this.sessions[this.currentSessionId];
            // 优先使用 pageTitle，如果没有则使用 title（兼容后端可能返回 title 字段的情况）
            const sessionTitle = session.pageTitle || session.title || '未命名会话';
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

    // 加载当前会话的消息（确保消息与会话一一对应）
    proto.loadSessionMessages = async function() {
        if (!this.chatWindow || !this.currentSessionId) {
            console.warn('无法加载消息：聊天窗口或会话ID不存在');
            return;
        }

        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) {
            console.warn('无法加载消息：消息容器不存在');
            return;
        }

        // 获取当前会话数据
        const session = this.sessions[this.currentSessionId];
        if (!session) {
            console.warn('会话不存在，无法加载消息:', this.currentSessionId);
            return;
        }

        console.log(`加载会话 ${this.currentSessionId} 的消息，共 ${session.messages?.length || 0} 条`);

        // 清空现有消息（确保干净的加载状态）
        messagesContainer.innerHTML = '';

        // 创建欢迎消息（使用会话保存的页面信息）
        const pageInfo = {
            title: session.pageTitle || document.title || '当前页面',
            url: session.url || window.location.href,
            description: session.pageDescription || ''
        };
        await this.createWelcomeMessage(messagesContainer, pageInfo);

        // 确保欢迎消息的按钮容器存在并刷新角色按钮
        // 如果按钮容器不存在，创建一个临时的以确保 refreshWelcomeActionButtons 能正常工作
        setTimeout(async () => {
            let welcomeActionsContainer = this.chatWindow.querySelector('#pet-welcome-actions');
            if (!welcomeActionsContainer) {
                // 如果按钮容器不存在，找到欢迎消息的时间容器并创建按钮容器
                const welcomeMessage = messagesContainer.querySelector('[data-welcome-message]');
                if (welcomeMessage) {
                    let messageTime = welcomeMessage.querySelector('[data-message-time]');
                    if (messageTime) {
                        // 检查 messageTime 是否在 messageTimeWrapper 中，如果是，使用 messageTimeWrapper
                        // 因为 createMessageElement 会创建 messageTimeWrapper 包裹 messageTime
                        const messageTimeWrapper = messageTime.parentElement;
                        let targetContainer = messageTime;

                        // 如果 messageTime 有父容器且父容器是 messageTimeWrapper，使用 messageTime 本身
                        // 但需要检查父容器的结构
                        const timeAndCopyContainer = messageTimeWrapper?.parentElement;
                        if (timeAndCopyContainer && timeAndCopyContainer.querySelector('[data-copy-button-container]')) {
                            // 这是标准的消息结构，messageTime 在 messageTimeWrapper 中
                            // 我们需要修改 messageTime 的样式，使其成为 flex 容器
                            targetContainer = messageTime;
                        }

                        // 创建按钮容器（与 createChatWindow 中的逻辑一致）
                        // 将按钮直接添加到 data-message-time 元素中，和时间同一行
                        // 首先确保 messageTime 是 flex 布局
                        targetContainer.style.cssText = `
                            display: flex !important;
                            justify-content: space-between !important;
                            align-items: center !important;
                            font-size: 11px !important;
                            color: #999 !important;
                            margin-top: 4px !important;
                            max-width: 100% !important;
                            width: 100% !important;
                        `;

                        // 如果 targetContainer 没有时间文本，创建一个
                        let timeText = targetContainer.querySelector('span');
                        if (!timeText) {
                            timeText = document.createElement('span');
                            timeText.style.cssText = 'flex: 1 !important; min-width: 0 !important;';
                            timeText.textContent = this.getCurrentTime();
                            // 如果 targetContainer 有文本内容，先清除
                            if (targetContainer.textContent.trim()) {
                                const originalText = targetContainer.textContent.trim();
                                targetContainer.innerHTML = '';
                                timeText.textContent = originalText || this.getCurrentTime();
                            }
                            targetContainer.appendChild(timeText);
                        }

                        // 创建按钮容器
                        const actionsGroup = document.createElement('div');
                        actionsGroup.id = 'pet-welcome-actions';
                        actionsGroup.style.cssText = `
                            display: inline-flex !important;
                            align-items: center !important;
                            gap: 8px !important;
                            flex-shrink: 0 !important;
                        `;

                        const actionsWrapper = document.createElement('div');
                        actionsWrapper.style.cssText = `
                            position: relative !important;
                            display: inline-flex !important;
                            align-items: center !important;
                            gap: 8px !important;
                        `;
                        actionsWrapper.appendChild(actionsGroup);
                        targetContainer.appendChild(actionsWrapper);
                    }
                }
            }
            // 刷新角色按钮（确保显示最新的角色列表）
            await this.refreshWelcomeActionButtons();

        }, 150);

        // 加载会话消息（确保消息顺序和内容正确）
        if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
            // 先使用 DocumentFragment 批量添加消息，提高性能
            const fragment = document.createDocumentFragment();
            const petMessages = []; // 保存所有宠物消息，用于后续添加按钮
            const userMessages = []; // 保存所有用户消息，用于后续添加按钮
            let isFirstPetMessage = true; // 标记是否是第一条宠物消息

            for (const msg of session.messages) {
                // 验证消息格式：必须有类型，并且有内容或图片
                if (!msg || !msg.type || (!msg.content && !msg.imageDataUrl)) {
                    console.warn('跳过无效消息:', msg);
                    continue;
                }

                // 使用消息保存的时间戳（如果有）
                const timestamp = msg.timestamp || null;

                // 获取图片数据（如果有）
                const imageDataUrl = msg.imageDataUrl || null;

                if (msg.type === 'pet') {
                    isFirstPetMessage = false;
                }

                const msgEl = this.createMessageElement(msg.content || '', msg.type, imageDataUrl, timestamp);
                fragment.appendChild(msgEl);

                // 如果是宠物消息，渲染 Markdown
                if (msg.type === 'pet') {
                    const petBubble = msgEl.querySelector('[data-message-type="pet-bubble"]');
                    if (petBubble) {
                        petBubble.innerHTML = this.renderMarkdown(msg.content);
                        petBubble.setAttribute('data-original-text', msg.content);

                        // 保存宠物消息引用，用于后续添加按钮
                        petMessages.push(msgEl);

                        // 处理 Mermaid 图表（异步处理，不阻塞其他消息渲染）
                        this.processMermaidBlocks(petBubble).catch(err => {
                            console.error('处理 Mermaid 图表失败:', err);
                        });
                    }
                } else if (msg.type === 'user') {
                    // 渲染用户消息（使用 Markdown 渲染，与 pet 消息一致）
                    const userBubble = msgEl.querySelector('[data-message-type="user-bubble"]');
                    if (userBubble) {
                        // 如果有图片，先添加图片元素
                        if (imageDataUrl) {
                            const imageContainer = document.createElement('div');
                            imageContainer.style.cssText = `
                                margin-bottom: ${msg.content ? '8px' : '0'} !important;
                                border-radius: 8px !important;
                                overflow: hidden !important;
                                max-width: 100% !important;
                                width: 100% !important;
                            `;

                            const img = document.createElement('img');
                            img.src = imageDataUrl;
                            img.style.cssText = `
                                max-width: 100% !important;
                                width: 100% !important;
                                height: auto !important;
                                max-height: 300px !important;
                                border-radius: 8px !important;
                                display: block !important;
                                cursor: pointer !important;
                                object-fit: contain !important;
                            `;

                            // 点击查看大图
                            img.addEventListener('click', () => {
                                this.showImagePreview(imageDataUrl);
                            });

                            imageContainer.appendChild(img);
                            userBubble.innerHTML = '';
                            userBubble.appendChild(imageContainer);
                        } else {
                            userBubble.innerHTML = '';
                        }

                        // 如果有文本内容，添加文本
                        if (msg.content) {
                            const displayText = this.renderMarkdown(msg.content);
                            if (imageDataUrl) {
                                // 如果已经添加了图片，则追加文本
                                const textSpan = document.createElement('span');
                                textSpan.innerHTML = displayText;
                                userBubble.appendChild(textSpan);
                            } else {
                                userBubble.innerHTML = displayText;
                            }
                        } else if (imageDataUrl) {
                            // 如果没有文本只有图片，保持容器为空
                            userBubble.style.padding = '0';
                        }

                        userBubble.setAttribute('data-original-text', msg.content || '');
                        userBubble.classList.add('markdown-content');

                        // 处理可能的 Mermaid 图表
                        this.processMermaidBlocks(userBubble).catch(err => {
                            console.error('处理用户消息的 Mermaid 图表失败:', err);
                        });
                    }
                    // 保存用户消息引用，用于后续添加按钮
                    userMessages.push(msgEl);
                }
            }

            // 一次性添加所有消息
            messagesContainer.appendChild(fragment);

            // 为所有消息添加按钮（异步处理，不阻塞渲染）
            // 使用 setTimeout 确保 DOM 完全更新后再添加按钮
            setTimeout(async () => {
                // 为宠物消息添加按钮
                for (const petMsg of petMessages) {
                    try {
                        const petBubble = petMsg.querySelector('[data-message-type="pet-bubble"]');
                        if (!petBubble) continue;

                        // 检查是否是欢迎消息（第一条消息），欢迎消息不需要添加按钮
                        const isWelcome = petMsg.hasAttribute('data-welcome-message');
                        if (isWelcome) continue;

                        // 添加复制按钮（编辑和删除按钮）
                        const copyButtonContainer = petMsg.querySelector('[data-copy-button-container]');
                        if (copyButtonContainer) {
                            // 如果还没有复制按钮，就添加（包括复制、编辑、删除按钮）
                            if (!copyButtonContainer.querySelector('.copy-button')) {
                                this.addCopyButton(copyButtonContainer, petBubble);
                            }
                        }

                        // 为宠物消息添加导出按钮
                        if (copyButtonContainer) {
                            this.addExportButtonForMessage(copyButtonContainer, petMsg, 'pet');
                        }

                        // 添加重试按钮（仅当不是第一条消息时）
                        // 检查是否是第一条宠物消息
                        const allPetMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]') &&
                            !child.hasAttribute('data-welcome-message')
                        );

                        if (allPetMessages.length > 0) {
                            const tryAgainContainer = petMsg.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                // 检查是否是按钮操作生成的消息，不添加重试按钮
                                if (!petMsg.hasAttribute('data-button-action')) {
                                    this.addTryAgainButton(tryAgainContainer, petMsg);
                                }
                            }
                        }

                        // 添加动作按钮（包括角色按钮和设置按钮）
                        await this.addActionButtonsToMessage(petMsg);

                        // 为宠物消息添加排序按钮
                        if (copyButtonContainer) {
                            this.addSortButtons(copyButtonContainer, petMsg);
                        }
                    } catch (error) {
                        console.error('为消息添加按钮时出错:', error);
                    }
                }

                // 为用户消息添加按钮
                for (const userMsg of userMessages) {
                    try {
                        // 确保copyButtonContainer存在（如果不存在，addActionButtonsToMessage会创建它）
                        // 添加动作按钮（包括机器人按钮）
                        await this.addActionButtonsToMessage(userMsg);

                        // 为用户消息添加复制按钮
                        const userBubble = userMsg.querySelector('[data-message-type="user-bubble"]');
                        let copyButtonContainer = userMsg.querySelector('[data-copy-button-container]');

                        // 如果copyButtonContainer不存在，尝试创建它
                        if (!copyButtonContainer && userBubble) {
                            // 查找用户消息的content容器
                            const content = userMsg.querySelector('div[style*="flex: 1"]') ||
                                           userMsg.querySelector('div:last-child');
                            if (content) {
                                // 查找是否已有timeAndCopyContainer
                                let timeAndCopyContainer = content.querySelector('div[style*="justify-content: space-between"]');
                                if (!timeAndCopyContainer) {
                                    // 创建timeAndCopyContainer
                                    timeAndCopyContainer = document.createElement('div');
                                    timeAndCopyContainer.style.cssText = `
                                        display: flex !important;
                                        align-items: center !important;
                                        justify-content: space-between !important;
                                        max-width: 80% !important;
                                        width: 100% !important;
                                        margin-top: 4px !important;
                                        margin-left: auto !important;
                                        box-sizing: border-box !important;
                                    `;
                                    content.appendChild(timeAndCopyContainer);
                                }

                                // 创建copyButtonContainer
                                copyButtonContainer = document.createElement('div');
                                copyButtonContainer.setAttribute('data-copy-button-container', 'true');
                                copyButtonContainer.style.cssText = 'display: flex;';
                                timeAndCopyContainer.insertBefore(copyButtonContainer, timeAndCopyContainer.firstChild);
                            }
                        }

                        if (copyButtonContainer && userBubble && !copyButtonContainer.querySelector('.copy-button')) {
                            this.addCopyButton(copyButtonContainer, userBubble);
                        }

                        // 为用户消息添加删除、编辑和重新发送按钮
                        if (copyButtonContainer && userBubble) {
                            // 检查是否已经添加过这些按钮（通过检查是否有删除按钮）
                            if (!copyButtonContainer.querySelector('.delete-button')) {
                                this.addDeleteButtonForUserMessage(copyButtonContainer, userBubble);
                            }
                        }

                        // 为用户消息添加排序按钮
                        if (copyButtonContainer) {
                            this.addSortButtons(copyButtonContainer, userMsg);
                        }

                        // 为用户消息添加导出按钮
                        if (copyButtonContainer) {
                            this.addExportButtonForMessage(copyButtonContainer, userMsg, 'user');
                        }
                    } catch (error) {
                        console.error('为用户消息添加按钮时出错:', error);
                    }
                }


                // 确保滚动到底部
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);

            // 使用 requestAnimationFrame 确保 DOM 更新完成后再滚动
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        } else {
            // 如果没有消息，确保滚动到底部
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        }
    };

    // @param {Object} pageInfo - 页面信息对象（可选，如果不提供则使用当前页面信息）
    //   - title: 页面标题
    //   - url: 页面URL
    //   - description: 页面描述（可选）
    proto.createWelcomeMessage = async function(messagesContainer, pageInfo = null) {
        const session = this.currentSessionId ? this.sessions[this.currentSessionId] : null;

        // 检查是否是接口会话
        const isApiRequestSession = session && session._isApiRequestSession;
        const apiRequestInfo = session && session._apiRequestInfo ? session._apiRequestInfo : null;

        // 如果是接口会话，使用接口信息
        if (isApiRequestSession && apiRequestInfo) {
            return await this.createApiRequestWelcomeMessage(messagesContainer, apiRequestInfo);
        }

        // 如果没有提供页面信息，使用当前页面信息或会话信息
        if (!pageInfo) {
            // 优先使用当前会话的页面信息，如果没有则使用当前页面信息
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                pageInfo = {
                    title: session.pageTitle || document.title || '当前页面',
                    url: session.url || window.location.href,
                    description: session.pageDescription || ''
                };
            } else {
                // 使用 getPageInfo 方法获取当前页面信息
                const currentPageInfo = this.getPageInfo();
                pageInfo = {
                    title: currentPageInfo.title,
                    url: currentPageInfo.url,
                    description: currentPageInfo.description || ''
                };
            }
        }

        // 获取页面图标
        const pageIconUrl = this.getPageIconUrl();

        // 构建页面信息显示内容（优化后的HTML结构）
        let pageInfoHtml = `
            <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(68, 160, 141, 0.05)); border-radius: 12px; border-left: 3px solid #4ECDC4;">
                <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <img src="${pageIconUrl}" alt="页面图标" style="width: 20px; height: 20px; border-radius: 4px; object-fit: contain; flex-shrink: 0;" onerror="this.style.display='none'">
                    <span style="font-weight: 600; font-size: 15px; color: #374151;">${this.escapeHtml(pageInfo.title)}</span>
                </div>

                <div style="margin-bottom: 12px;">
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px; font-weight: 500;">🔗 网址</div>
                    <a href="${pageInfo.url}" target="_blank" style="word-break: break-all; color: #2196F3; text-decoration: none; font-size: 13px; display: inline-block; max-width: 100%;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${this.escapeHtml(pageInfo.url)}</a>
                </div>
        `;

        if (pageInfo.description && pageInfo.description.trim()) {
            pageInfoHtml += `
                <div style="margin-bottom: 0;">
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px; font-weight: 500;">📝 页面描述</div>
                    <div class="markdown-content" style="font-size: 13px; color: #4B5563; line-height: 1.5;">${this.renderMarkdown(pageInfo.description)}</div>
                </div>
            `;
        }

        pageInfoHtml += `</div>`;

        // 检查是否是空白会话（手动新建的会话）
        const isBlankSession = session && (session._isBlankSession || session.url?.startsWith('blank-session://'));

        // 检查会话是否已有消息（如果已有消息，说明会话已被使用，不应该显示保存按钮）
        const hasMessages = session && session.messages && Array.isArray(session.messages) && session.messages.length > 0;

        // 检查当前会话是否已存在于后端会话列表中，决定是否显示保存按钮
        // 空白会话（手动新建的会话）不显示保存按钮
        // 如果会话已有消息，也不显示保存按钮（因为会话已经被使用过了）
        // 先检查 backendSessionIds 集合，如果已包含则直接跳过异步调用
        const isInBackendList = this.backendSessionIds.has(this.currentSessionId) || await this.isSessionInBackendList(this.currentSessionId);
        const shouldShowSaveButton = !isBlankSession && !isInBackendList && !hasMessages;

        // 根据检查结果决定是否添加手动保存会话按钮
        if (shouldShowSaveButton) {
        pageInfoHtml += `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(78, 205, 196, 0.2);">
                <button id="pet-manual-save-session-btn" class="pet-manual-save-btn" style="
                    position: relative !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 8px !important;
                    width: 100% !important;
                    padding: 10px 20px !important;
                    background: linear-gradient(135deg, #4ECDC4, #44A08D) !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 10px !important;
                    font-size: 14px !important;
                    font-weight: 600 !important;
                    cursor: pointer !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    box-shadow: 0 2px 8px rgba(78, 205, 196, 0.25), 0 1px 3px rgba(0, 0, 0, 0.1) !important;
                    overflow: hidden !important;
                    user-select: none !important;
                ">
                    <span class="save-btn-icon" style="
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        font-size: 16px !important;
                        transition: transform 0.3s ease !important;
                    ">💾</span>
                    <span class="save-btn-text">保存会话</span>
                    <span class="save-btn-loader" style="
                        display: none !important;
                        position: absolute !important;
                        width: 16px !important;
                        height: 16px !important;
                        border: 2px solid rgba(255, 255, 255, 0.3) !important;
                        border-top-color: white !important;
                        border-radius: 50% !important;
                        animation: spin 0.8s linear infinite !important;
                    "></span>
                </button>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    .pet-manual-save-btn:hover:not(:disabled) {
                        transform: translateY(-2px) !important;
                        box-shadow: 0 4px 12px rgba(78, 205, 196, 0.35), 0 2px 6px rgba(0, 0, 0, 0.15) !important;
                    }
                    .pet-manual-save-btn:active:not(:disabled) {
                        transform: translateY(0) !important;
                        box-shadow: 0 1px 4px rgba(78, 205, 196, 0.2) !important;
                    }
                    .pet-manual-save-btn:disabled {
                        opacity: 0.7 !important;
                        cursor: not-allowed !important;
                        transform: none !important;
                    }
                    .pet-manual-save-btn.loading .save-btn-icon,
                    .pet-manual-save-btn.loading .save-btn-text {
                        opacity: 0 !important;
                    }
                    .pet-manual-save-btn.loading .save-btn-loader {
                        display: block !important;
                    }
                    .pet-manual-save-btn.success {
                        background: linear-gradient(135deg, #4CAF50, #45a049) !important;
                        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3) !important;
                    }
                    .pet-manual-save-btn.error {
                        background: linear-gradient(135deg, #f44336, #d32f2f) !important;
                        box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3) !important;
                    }
                </style>
            </div>
        `;
        }

        // 创建欢迎消息元素
        const welcomeMessage = this.createMessageElement('', 'pet');
        welcomeMessage.setAttribute('data-welcome-message', 'true');
        messagesContainer.appendChild(welcomeMessage);

        const messageText = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
        if (messageText) {
            messageText.innerHTML = pageInfoHtml;
            // 保存原始HTML用于后续保存（虽然欢迎消息不会被保存到消息数组中）
            messageText.setAttribute('data-original-text', pageInfoHtml);

            // 绑定手动保存按钮的点击事件
            const saveBtn = messageText.querySelector('#pet-manual-save-session-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    this.handleManualSaveSession(saveBtn);
                });
            }
        }

        return welcomeMessage;
    };

    // 刷新第一条欢迎消息（当会话信息更新时调用）
    proto.refreshWelcomeMessage = async function() {
        if (!this.chatWindow || !this.currentSessionId) {
            return;
        }

        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) {
            return;
        }

        // 查找第一条欢迎消息
        const welcomeMessage = messagesContainer.querySelector('[data-welcome-message]');
        if (!welcomeMessage) {
            console.log('未找到欢迎消息，跳过刷新');
            return;
        }

        // 获取当前会话的更新后的页面信息
        const session = this.sessions[this.currentSessionId];
        if (!session) {
            return;
        }


        const pageInfo = {
            title: session.pageTitle || document.title || '当前页面',
            url: session.url || window.location.href,
            description: session.pageDescription || ''
        };

        // 获取页面图标
        const pageIconUrl = this.getPageIconUrl();

        // 重新构建页面信息显示内容
        let pageInfoHtml = `
            <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(68, 160, 141, 0.05)); border-radius: 12px; border-left: 3px solid #4ECDC4;">
                <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <img src="${pageIconUrl}" alt="页面图标" style="width: 20px; height: 20px; border-radius: 4px; object-fit: contain; flex-shrink: 0;" onerror="this.style.display='none'">
                    <span style="font-weight: 600; font-size: 15px; color: #374151;">${this.escapeHtml(pageInfo.title)}</span>
                </div>

                <div style="margin-bottom: 12px;">
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px; font-weight: 500;">🔗 网址</div>
                    <a href="${pageInfo.url}" target="_blank" style="word-break: break-all; color: #2196F3; text-decoration: none; font-size: 13px; display: inline-block; max-width: 100%;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${this.escapeHtml(pageInfo.url)}</a>
                </div>
        `;

        if (pageInfo.description && pageInfo.description.trim()) {
            pageInfoHtml += `
                <div style="margin-bottom: 0;">
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px; font-weight: 500;">📝 页面描述</div>
                    <div class="markdown-content" style="font-size: 13px; color: #4B5563; line-height: 1.5;">${this.renderMarkdown(pageInfo.description)}</div>
                </div>
            `;
        }

        pageInfoHtml += `</div>`;

        // 检查是否是空白会话（手动新建的会话）
        const isBlankSession = session && (session._isBlankSession || session.url?.startsWith('blank-session://'));

        // 检查会话是否已有消息（如果已有消息，说明会话已被使用，不应该显示保存按钮）
        const hasMessages = session && session.messages && Array.isArray(session.messages) && session.messages.length > 0;

        // 检查当前会话是否已存在于后端会话列表中，决定是否显示保存按钮
        // 空白会话（手动新建的会话）不显示保存按钮
        // 如果会话已有消息，也不显示保存按钮（因为会话已经被使用过了）
        // 先检查 backendSessionIds 集合，如果已包含则直接跳过异步调用
        const isInBackendList = this.backendSessionIds.has(this.currentSessionId) || await this.isSessionInBackendList(this.currentSessionId);
        const shouldShowSaveButton = !isBlankSession && !isInBackendList && !hasMessages;

        // 根据检查结果决定是否添加手动保存会话按钮
        if (shouldShowSaveButton) {
        pageInfoHtml += `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(78, 205, 196, 0.2);">
                <button id="pet-manual-save-session-btn" class="pet-manual-save-btn" style="
                    position: relative !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 8px !important;
                    width: 100% !important;
                    padding: 10px 20px !important;
                    background: linear-gradient(135deg, #4ECDC4, #44A08D) !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 10px !important;
                    font-size: 14px !important;
                    font-weight: 600 !important;
                    cursor: pointer !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    box-shadow: 0 2px 8px rgba(78, 205, 196, 0.25), 0 1px 3px rgba(0, 0, 0, 0.1) !important;
                    overflow: hidden !important;
                    user-select: none !important;
                ">
                    <span class="save-btn-icon" style="
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        font-size: 16px !important;
                        transition: transform 0.3s ease !important;
                    ">💾</span>
                    <span class="save-btn-text">保存会话</span>
                    <span class="save-btn-loader" style="
                        display: none !important;
                        position: absolute !important;
                        width: 16px !important;
                        height: 16px !important;
                        border: 2px solid rgba(255, 255, 255, 0.3) !important;
                        border-top-color: white !important;
                        border-radius: 50% !important;
                        animation: spin 0.8s linear infinite !important;
                    "></span>
                </button>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    .pet-manual-save-btn:hover:not(:disabled) {
                        transform: translateY(-2px) !important;
                        box-shadow: 0 4px 12px rgba(78, 205, 196, 0.35), 0 2px 6px rgba(0, 0, 0, 0.15) !important;
                    }
                    .pet-manual-save-btn:active:not(:disabled) {
                        transform: translateY(0) !important;
                        box-shadow: 0 1px 4px rgba(78, 205, 196, 0.2) !important;
                    }
                    .pet-manual-save-btn:disabled {
                        opacity: 0.7 !important;
                        cursor: not-allowed !important;
                        transform: none !important;
                    }
                    .pet-manual-save-btn.loading .save-btn-icon,
                    .pet-manual-save-btn.loading .save-btn-text {
                        opacity: 0 !important;
                    }
                    .pet-manual-save-btn.loading .save-btn-loader {
                        display: block !important;
                    }
                    .pet-manual-save-btn.success {
                        background: linear-gradient(135deg, #4CAF50, #45a049) !important;
                        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3) !important;
                    }
                    .pet-manual-save-btn.error {
                        background: linear-gradient(135deg, #f44336, #d32f2f) !important;
                        box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3) !important;
                    }
                </style>
            </div>
        `;
        }

        // 更新欢迎消息的内容
        const messageText = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
        if (messageText) {
            messageText.innerHTML = pageInfoHtml;
            // 更新原始HTML
            messageText.setAttribute('data-original-text', pageInfoHtml);

            // 重新绑定手动保存按钮的点击事件（innerHTML 会移除所有事件监听器，所以直接绑定即可）
            const saveBtn = messageText.querySelector('#pet-manual-save-session-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    this.handleManualSaveSession(saveBtn);
                });
            }
        }

        console.log('欢迎消息已刷新');
    };

    // HTML转义辅助方法（防止XSS）
    proto.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    proto.getCurrentTime = function() {
        const now = new Date();
        return this.formatTimestamp(now.getTime());
    };

    // 格式化时间戳为年月日时分格式
    proto.formatTimestamp = function(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}年${month}月${day}日 ${hour}:${minute}`;
    };

    // 添加聊天滚动条样式
    proto.addChatScrollbarStyles = function() {
        if (document.getElementById('pet-chat-styles')) return;

        const style = document.createElement('style');
        style.id = 'pet-chat-styles';
        style.textContent = `
            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Chrome/Safari 滚动条样式 */
            #pet-chat-messages::-webkit-scrollbar {
                width: 8px;
            }

            #pet-chat-messages::-webkit-scrollbar-track {
                background: rgba(241, 241, 241, 0.5);
                border-radius: 4px;
            }

            #pet-chat-messages::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 4px;
                border: 1px solid transparent;
                background-clip: padding-box;
            }

            #pet-chat-messages::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }

            /* Firefox 滚动条样式 */
            #pet-chat-messages {
                scrollbar-width: thin;
                scrollbar-color: #c1c1c1 rgba(241, 241, 241, 0.5);
            }

            /* 确保消息容器可以滚动 */
            #pet-chat-messages {
                overflow-y: auto !important;
                overflow-x: hidden !important;
            }
        `;
        document.head.appendChild(style);
    };

    // 播放聊天动画
    proto.playChatAnimation = function() {
        if (!this.pet) return;

        // 先清理之前的动画
        if (this.chatBubbleInterval) {
            clearInterval(this.chatBubbleInterval);
            this.chatBubbleInterval = null;
        }
        if (this.lastChatBubble && this.lastChatBubble.parentNode) {
            this.lastChatBubble.parentNode.removeChild(this.lastChatBubble);
            this.lastChatBubble = null;
        }

        // 添加思考动画（更丰富的动画效果）
        this.pet.style.animation = 'none';
        setTimeout(() => {
            // 随机选择不同的动画效果
            const animations = [
                'petThinking 0.8s ease-in-out infinite',
                'petThinkingBounce 1.2s ease-in-out infinite',
                'petThinkingPulse 1s ease-in-out infinite'
            ];
            const selectedAnimation = animations[Math.floor(Math.random() * animations.length)];
            this.pet.style.animation = selectedAnimation;
        }, 10);

        // 添加聊天气泡效果
        this.showChatBubble();
    };

    // 显示聊天气泡
    proto.showChatBubble = function() {
        if (!this.pet) return;

        // 创建聊天气泡
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.style.cssText = `
            position: absolute !important;
            top: -40px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: rgba(0, 0, 0, 0.8) !important;
            color: white !important;
            padding: 8px 12px !important;
            border-radius: 12px !important;
            font-size: 12px !important;
            white-space: nowrap !important;
            z-index: 2147483648 !important;
            pointer-events: none !important;
            animation: bubbleAppear 0.5s ease-out !important;
        `;

        // 添加动画样式
        if (!document.getElementById('chat-bubble-styles')) {
            const style = document.createElement('style');
            style.id = 'chat-bubble-styles';
            style.textContent = `
                @keyframes petThinking {
                    0%, 100% { transform: scale(1) rotate(0deg); }
                    25% { transform: scale(1.1) rotate(-5deg); }
                    50% { transform: scale(1.05) rotate(5deg); }
                    75% { transform: scale(1.1) rotate(-3deg); }
                }

                @keyframes petThinkingBounce {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-8px) scale(1.08); }
                }

                @keyframes petThinkingPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.15); opacity: 0.9; }
                }

                @keyframes bubbleAppear {
                    0% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(10px) scale(0.8);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                }
            `;
            if (document.head) {
                document.head.appendChild(style);
            }
        }

        // 随机选择思考文本（更有趣的提示语）
        const thinkingTexts = [
            '🤔 让我想想...',
            '💭 思考中...',
            '✨ 灵感涌现',
            '🌟 整理思路',
            '🎯 深度分析',
            '🔍 搜索答案',
            '💡 想法来了',
            '🌊 头脑风暴',
            '📝 组织语言',
            '🎨 酝酿回复',
            '⚡ 快想好了',
            '🌈 无限接近',
            '🚀 马上就来'
        ];
        bubble.textContent = thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)];

        this.pet.appendChild(bubble);

        // 保存气泡到实例以便后续更新
        this.lastChatBubble = bubble;

        // 动态更新气泡文本（让用户感受到进展）
        const updateBubbleInterval = setInterval(() => {
            if (bubble.parentNode) {
                let newText;
                do {
                    newText = thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)];
                } while (newText === bubble.textContent && thinkingTexts.length > 1);
                bubble.textContent = newText;
            } else {
                clearInterval(updateBubbleInterval);
            }
        }, 1500);

        // 保存interval以便后续清理
        this.chatBubbleInterval = updateBubbleInterval;

        // 3秒后移除气泡
        setTimeout(() => {
            clearInterval(updateBubbleInterval);
            if (bubble.parentNode) {
                bubble.style.animation = 'bubbleAppear 0.3s ease-out reverse';
                setTimeout(() => {
                    if (bubble.parentNode) {
                        bubble.parentNode.removeChild(bubble);
                    }
                    this.lastChatBubble = null;
                }, 300);
            }
        }, 3000);
    };

})();




