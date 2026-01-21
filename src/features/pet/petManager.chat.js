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
    proto.toggleChatWindow = function () {
        if (this.isChatOpen) {
            this.closeChatWindow();
        } else {
            this.openChatWindow();
        }
    };

    // 仅切换聊天窗口的显示/隐藏状态（用于快捷键，不影响其他功能）
    proto.toggleChatWindowVisibility = function () {
        // 原生 JS 版本的处理逻辑
        if (!this.chatWindow) {
            // 如果窗口还未创建，需要先创建
            this.openChatWindow();
            return;
        }

        if (this.isChatOpen) {
            // 仅隐藏窗口，不保存会话，不影响其他功能
            this.chatWindow.style.setProperty('display', 'none', 'important');
            this.chatWindow.style.setProperty('visibility', 'hidden', 'important');
            this.isChatOpen = false;
        } else {
            // 仅显示窗口，不重新初始化，不影响其他功能
            this.chatWindow.style.setProperty('display', 'block', 'important');
            this.chatWindow.style.setProperty('visibility', 'visible', 'important');
            this.isChatOpen = true;
        }
    };

    // 预加载 html2canvas 库（用于导出聊天记录功能）
    // 注意：html2canvas 现在通过 manifest.json 的 content_scripts 自动加载
    proto.preloadHtml2Canvas = function () {
        // html2canvas 已经通过 content_scripts 加载，这个方法保留用于向后兼容
        if (typeof html2canvas !== 'undefined') {
            console.log('html2canvas 已加载');
        } else {
            console.warn('html2canvas 未加载，请检查扩展配置');
        }
    };

    // 打开聊天窗口
    proto.openChatWindow = async function () {
        // 预加载 html2canvas 库（用于导出功能）
        this.preloadHtml2Canvas();
        this.isChatOpen = true;

        // 如果是第一次打开聊天窗口，加载会话列表
        if (this.isChatWindowFirstOpen) {
            this.isChatWindowFirstOpen = false;
            console.log('第一次打开聊天窗口，加载会话列表...');

            // 加载会话列表（强制刷新）
            if (this.sessionApi && this.sessionApi.isEnabled()) {
                try {
                    await this.loadSessionsFromBackend(true);
                    this.hasLoadedSessionsForChat = true;
                } catch (error) {
                    console.warn('第一次打开聊天窗口时加载会话列表失败:', error);
                }
            }
        }

        if (this.chatWindow) {
            // 移除之前设置的隐藏样式
            this.chatWindow.style.removeProperty('visibility');
            this.chatWindow.style.removeProperty('opacity');
            this.chatWindow.removeAttribute('hidden');
            this.chatWindow.style.display = 'block';
            this.isChatOpen = true;

            // 更新聊天窗口样式（确保高度等样式正确）
            if (typeof this.updateChatWindowStyle === 'function') {
                this.updateChatWindowStyle();
            }

            // 先处理 URL 匹配和会话创建/选中（确保会话列表已加载）
            // 这个方法会检查当前 URL 是否在会话列表中，如果不在则创建新会话
            const matchedSessionId = await this.handleUrlBasedSession();

            // 如果 handleUrlBasedSession 没有创建/选中会话，则调用 initSession 作为后备
            if (!this.currentSessionId) {
                await this.initSession();
            }

            // 重新初始化滚动功能
            this.initializeChatScroll();

            // 更新模型选择器显示

            // 更新聊天窗口颜色
            this.updateChatWindowColor();

            // 更新聊天窗口标题（显示当前会话名称）
            this.updateChatHeaderTitle();

            // 确保会话侧边栏已更新（如果侧边栏已创建）
            if (this.sessionSidebar) {
                await this.updateSessionSidebar();

                // 在侧边栏更新完成后，滚动到 URL 匹配的会话项位置
                // 使用 matchedSessionId 或 currentSessionId
                const sessionIdToScroll = matchedSessionId || this.currentSessionId;
                if (sessionIdToScroll && typeof this.scrollToSessionItem === 'function') {
                    // 等待侧边栏完全渲染后再滚动
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await this.scrollToSessionItem(sessionIdToScroll);
                }
            }

            // 确保加载当前会话的消息（修复对话记录没有显示的问题）
            if (this.currentSessionId && typeof this.loadSessionMessages === 'function') {
                await this.loadSessionMessages();
            }

            // 强制重新计算消息容器高度（修复第二次打开时的高度问题）
            setTimeout(() => {
                const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages');
                const mainContent = this.chatWindow?.querySelector('.yi-pet-chat-main-content');
                
                if (messagesContainer && mainContent) {
                    // 移除可能冲突的内联样式，让 CSS 的 flex 布局生效
                    mainContent.style.removeProperty('height');
                    messagesContainer.style.removeProperty('height');
                    
                    // 触发重排以确保 flex 布局正确计算
                    void mainContent.offsetHeight;
                    void messagesContainer.offsetHeight;
                }
            }, 10);

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

            // 先处理 URL 匹配和会话创建/选中（确保会话列表已加载）
            // 这个方法会检查当前 URL 是否在会话列表中，如果不在则创建新会话
            const matchedSessionId = await this.handleUrlBasedSession();

            // 如果 handleUrlBasedSession 没有创建/选中会话，则调用 initSession 作为后备
            if (!this.currentSessionId) {
                await this.initSession();
            }

            await this.createChatWindow();
            this.isChatOpen = true;
            this.hasLoadedSessionsForChat = true;

            // 更新聊天窗口标题（显示当前会话名称）
            this.updateChatHeaderTitle();

            // 在侧边栏创建完成后，滚动到 URL 匹配的会话项位置
            if (this.sessionSidebar) {
                const sessionIdToScroll = matchedSessionId || this.currentSessionId;
                if (sessionIdToScroll && typeof this.scrollToSessionItem === 'function') {
                    // 等待侧边栏完全渲染后再滚动
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await this.scrollToSessionItem(sessionIdToScroll);
                }
            }
        });
    };

    // 关闭聊天窗口
    proto.closeChatWindow = function () {
        try {
            console.log('[PetManager] closeChatWindow 被调用');
            const chatWindowElement = this.chatWindow || document.getElementById('pet-chat-window');

            if (chatWindowElement) {
                console.log('[PetManager] 正在隐藏聊天窗口');

                // 使用 setProperty 和 !important 确保样式生效
                chatWindowElement.style.setProperty('display', 'none', 'important');
                chatWindowElement.style.setProperty('visibility', 'hidden', 'important');
                chatWindowElement.style.setProperty('opacity', '0', 'important');
                chatWindowElement.setAttribute('hidden', ''); // 添加 hidden 属性

                this.isChatOpen = false;
                // 注意：不要重置 hasLoadedSessionsForChat，以便下次打开时能快速加载
                // this.hasLoadedSessionsForChat = false;

                // 确保 this.chatWindow 引用正确
                if (!this.chatWindow) {
                    this.chatWindow = chatWindowElement;
                }

                console.log('[PetManager] 聊天窗口已关闭');
            } else {
                console.warn('[PetManager] chatWindow 不存在, this.chatWindow:', this.chatWindow);
                // 即使找不到元素，也要确保状态正确
                this.isChatOpen = false;
            }
        } catch (error) {
            console.error('[PetManager] closeChatWindow 出错:', error);
            // 即使出错也要确保状态正确
            this.isChatOpen = false;
        }
    };

    // 检查是否接近底部（阈值：50px）
    proto.isNearBottom = function (container, threshold = 50) {
        if (!container) return true;
        const { scrollTop, scrollHeight, clientHeight } = container;
        return scrollHeight - scrollTop - clientHeight <= threshold;
    };

    // 滚动到底部（优化版）
    proto.scrollToBottom = function (smooth = false, force = false) {
        if (!this.chatWindow) return;
        const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages');
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
    proto.initializeChatScroll = function () {
        if (!this.chatWindow) return;

        const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages');
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
    proto.updateChatHeaderTitle = function () {
        if (!this.chatWindow) return;

        const titleTextEl = this.chatWindow.querySelector('#yi-pet-chat-header-title-text');
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

        // 更新编辑会话按钮状态
        const editSessionBtn = this.chatWindow.querySelector('#edit-session-btn');
        if (editSessionBtn) {
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                editSessionBtn.disabled = false;
                editSessionBtn.style.opacity = '1';
                editSessionBtn.style.cursor = 'pointer';
            } else {
                editSessionBtn.disabled = true;
                editSessionBtn.style.opacity = '0.5';
                editSessionBtn.style.cursor = 'not-allowed';
            }
        }
    };

    // 更新聊天窗口颜色（跟随宠物颜色）
    proto.updateChatWindowColor = function () {
        if (!this.chatWindow) return;

        // 获取当前宠物颜色
        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);

        // 通过 CSS 变量统一更新主题色
        this.chatWindow.style.setProperty('--pet-chat-primary-color', currentColor);
        this.chatWindow.style.setProperty('--pet-chat-main-color', mainColor);

        // 更新页面上下文开关颜色
        const contextSwitchContainer = this.chatWindow.querySelector('.context-switch-container');
        if (contextSwitchContainer && contextSwitchContainer.updateColor) {
            contextSwitchContainer.updateColor();
        }

        // 不再逐个元素设置颜色，统一通过 CSS 变量生效
    };

    // 保存聊天窗口状态
    proto.saveChatWindowState = function () {
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
    proto.loadChatWindowState = function (callback) {
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
    proto.loadChatWindowStateFromLocalStorage = function () {
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

    // 加载当前会话的消息
    proto.loadSessionMessages = async function () {
        if (!this.chatWindow || !this.currentSessionId) {
            return;
        }

        const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages');
        if (!messagesContainer) {
            return;
        }

        // 获取当前会话
        const session = this.sessions[this.currentSessionId];
        if (!session) {
            console.warn('未找到当前会话:', this.currentSessionId);
            return;
        }

        // 清空消息容器
        messagesContainer.innerHTML = '';

        // 先创建欢迎消息（放在最前面）
        try {
            await this.createWelcomeMessage(messagesContainer, null, true);
            console.log('欢迎消息已创建');
        } catch (error) {
            console.warn('创建欢迎消息失败:', error);
        }

        // 加载并渲染历史消息
        if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
            // 保持接口返回的消息顺序，不进行排序
            // 接口返回的消息顺序应该是正确的（在 sessionSyncService.js 中已按时间戳排序）
            // 如果接口返回的顺序不正确，应该在接口层面修复
            const messages = [...session.messages];

            console.log(`开始加载 ${messages.length} 条历史消息`);

            // 遍历消息并渲染
            for (let idx = 0; idx < messages.length; idx++) {
                const msg = messages[idx];
                
                // 规范化消息类型
                const messageType = msg.type === 'pet' ? 'pet' : 'user';
                const messageContent = msg.content || msg.message || '';
                const messageTimestamp = msg.timestamp || Date.now();
                const messageImage = msg.imageDataUrl || (Array.isArray(msg.imageDataUrls) && msg.imageDataUrls.length > 0 ? msg.imageDataUrls : null);
                const messageOptions = {
                    error: !!msg.error,
                    aborted: !!msg.aborted,
                    // 如果需要支持流式状态，可以在这里添加判断逻辑
                    streaming: false
                };

                // 跳过空消息
                if (!messageContent.trim() && !messageImage) {
                    continue;
                }

                try {
                    // 创建消息元素
                    const messageElement = this.createMessageElement(
                        messageContent,
                        messageType,
                        messageImage,
                        messageTimestamp,
                        messageOptions
                    );

                    // 设置消息索引
                    messageElement.setAttribute('data-chat-idx', idx.toString());

                    // 添加到消息容器
                    messagesContainer.appendChild(messageElement);

                    // 添加操作按钮（延迟执行，确保 DOM 已渲染）
                    setTimeout(() => {
                        if (typeof this.addActionButtonsToMessage === 'function') {
                            this.addActionButtonsToMessage(messageElement);
                        }
                    }, 0);
                } catch (error) {
                    console.error(`渲染消息 ${idx} 时出错:`, error, msg);
                }
            }

            console.log(`已加载 ${messages.length} 条历史消息`);
        }

        // 滚动到底部
        setTimeout(() => {
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 100);
    };

    // 绑定欢迎卡片的交互事件
    proto.bindWelcomeCardEvents = function (container) {
        if (!container) return;

        // 复制功能
        const copyButtons = container.querySelectorAll('[data-copy-target], [data-copy-text]');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                let textToCopy = '';
                
                // 从目标元素复制
                const copyTarget = btn.getAttribute('data-copy-target');
                if (copyTarget) {
                    const targetElement = container.querySelector(`#${copyTarget}`);
                    if (targetElement) {
                        textToCopy = targetElement.textContent || targetElement.innerText || '';
                    }
                }
                
                // 从属性复制
                if (!textToCopy) {
                    const copyText = btn.getAttribute('data-copy-text');
                    if (copyText) {
                        textToCopy = copyText;
                    }
                }
                
                if (textToCopy) {
                    try {
                        await navigator.clipboard.writeText(textToCopy);
                        // 显示成功反馈
                        const icon = btn.querySelector('i');
                        if (icon) {
                            const originalClass = icon.className;
                            icon.className = 'fas fa-check';
                            btn.style.color = 'rgba(34, 197, 94, 0.9)';
                            setTimeout(() => {
                                icon.className = originalClass;
                                btn.style.color = '';
                            }, 2000);
                        }
                    } catch (err) {
                        console.error('复制失败:', err);
                    }
                }
            });
        });

        // 展开/折叠功能
        const toggleButtons = container.querySelectorAll('.welcome-card-toggle-btn');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const targetId = btn.getAttribute('data-toggle-target');
                const previewText = btn.getAttribute('data-preview-text');
                const fullText = btn.getAttribute('data-full-text');
                
                if (!targetId) return;
                
                const targetElement = container.querySelector(`#${targetId}`);
                const icon = btn.querySelector('i');
                
                if (!targetElement) return;
                
                const isExpanded = targetElement.classList.contains('expanded');
                
                if (isExpanded) {
                    // 折叠
                    targetElement.classList.remove('expanded');
                    targetElement.innerHTML = this.renderMarkdown(previewText);
                    if (icon) {
                        icon.className = 'fas fa-chevron-down';
                    }
                } else {
                    // 展开
                    targetElement.classList.add('expanded');
                    targetElement.innerHTML = this.renderMarkdown(fullText);
                    if (icon) {
                        icon.className = 'fas fa-chevron-up';
                    }
                }
            });
        });
    };

    // 构建欢迎卡片 HTML（只显示有值的字段，参考 YiWeb 的条件渲染）
    proto.buildWelcomeCardHtml = function (pageInfo, session = null) {
        // 如果会话为空，尝试从当前会话ID获取
        if (!session && this.currentSessionId) {
            session = this.sessions[this.currentSessionId];
        }
        
        // 获取会话信息（如果有）
        const sessionTags = session && Array.isArray(session.tags) ? session.tags.filter(t => t && t.trim()) : [];
        let sessionMessages = session && Array.isArray(session.messages) ? session.messages : [];
        const sessionCreatedAt = session && session.createdAt ? session.createdAt : null;
        const sessionUpdatedAt = session && session.updatedAt ? session.updatedAt : null;
        
        // 调试日志：检查会话消息（仅在开发环境或消息数量大于0时输出）
        if (sessionMessages.length > 0 || !session) {
            console.log('[buildWelcomeCardHtml] 会话信息:', {
                hasSession: !!session,
                currentSessionId: this.currentSessionId,
                sessionId: session ? (session.key || session.id) : null,
                messagesCount: sessionMessages.length,
                messages: sessionMessages.slice(0, 3).map(m => ({
                    type: m.type,
                    role: m.role,
                    hasContent: !!(m.content || m.message)
                }))
            });
        }

        // 检查会话是否有有效的 URL
        // 如果会话存在但没有 url 对象或者 url 对象为空，就不显示网址
        const hasSessionUrl = session && session.url && session.url.trim();
        const shouldShowUrl = !session || hasSessionUrl; // 如果没有会话，或者会话有有效URL，才显示

        // 构建欢迎卡片 HTML（只显示有值的字段）
        let pageInfoHtml = '<div class="welcome-card">';

        // 检查是否有任何内容可显示
        const hasTitle = pageInfo.title && pageInfo.title.trim();
        const hasUrl = shouldShowUrl && pageInfo.url && pageInfo.url.trim();
        const hasDescription = pageInfo.description && pageInfo.description.trim();
        const hasAnyContent = hasTitle || hasUrl || hasDescription || sessionTags.length > 0 || 
                             sessionMessages.length > 0 || sessionCreatedAt || sessionUpdatedAt;

        // 如果没有任何内容，显示空状态提示
        if (!hasAnyContent) {
            pageInfoHtml += `
                <div class="welcome-card-header">
                    <span class="welcome-card-title">当前页面</span>
                </div>
                <div class="welcome-card-section">
                    <div class="welcome-card-empty">暂无页面信息</div>
                </div>
            `;
            pageInfoHtml += '</div>';
            return pageInfoHtml;
        }

        // 标题（如果有）
        if (hasTitle) {
            pageInfoHtml += `
                <div class="welcome-card-header">
                    <span class="welcome-card-title">${this.escapeHtml(pageInfo.title)}</span>
                </div>
            `;
        }

        // 网址（如果有且应该显示）
        // 如果会话存在但没有 url 对象或者 url 对象为空，就不显示网址和网址内容
        if (hasUrl) {
            const urlId = `welcome-url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            pageInfoHtml += `
                <div class="welcome-card-section">
                    <div class="welcome-card-section-header">
                        <div class="welcome-card-section-title">🔗 网址</div>
                        <button type="button" class="welcome-card-action-btn" data-copy-target="${urlId}" title="复制网址" aria-label="复制网址">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <a href="${this.escapeHtml(pageInfo.url)}" target="_blank" class="welcome-card-url" id="${urlId}">${this.escapeHtml(pageInfo.url)}</a>
                </div>
            `;
        }

        // 页面描述（如果有）
        if (pageInfo.description && pageInfo.description.trim()) {
            const descId = `welcome-desc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            pageInfoHtml += `
                <div class="welcome-card-section welcome-card-description">
                    <div class="welcome-card-section-header">
                        <div class="welcome-card-section-title">📝 页面描述</div>
                        <button type="button" class="welcome-card-action-btn" data-copy-text="${this.escapeHtml(pageInfo.description)}" title="复制描述" aria-label="复制描述">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="markdown-content" id="${descId}">${this.renderMarkdown(pageInfo.description)}</div>
                </div>
            `;
        }

        // 标签（如果有）
        if (sessionTags.length > 0) {
            const tagsHtml = sessionTags.map(tag => {
                const escapedTag = this.escapeHtml(tag);
                return `<span class="welcome-card-tag">${escapedTag}</span>`;
            }).join('');
            pageInfoHtml += `
                <div class="welcome-card-section">
                    <div class="welcome-card-section-title">🏷️ 标签</div>
                    <div class="welcome-card-tags">${tagsHtml}</div>
                </div>
            `;
        }

        // 消息数量（如果有消息）
        if (sessionMessages.length > 0) {
            // 兼容 role 和 type 字段
            const userMessages = sessionMessages.filter(m => {
                if (!m || typeof m !== 'object') return false;
                const role = m.role || (m.type === 'user' ? 'user' : null);
                return role === 'user';
            }).length;
            const assistantMessages = sessionMessages.filter(m => {
                if (!m || typeof m !== 'object') return false;
                const role = m.role || (m.type === 'pet' ? 'pet' : (m.type === 'assistant' ? 'assistant' : null));
                return role === 'assistant' || role === 'pet';
            }).length;
            
            pageInfoHtml += `
                <div class="welcome-card-section">
                    <div class="welcome-card-section-title">💬 对话记录</div>
                    <div class="welcome-card-meta">
                        <span>共 ${sessionMessages.length} 条消息</span>
                        ${userMessages > 0 ? `<span>（用户: ${userMessages} 条）</span>` : ''}
                        ${assistantMessages > 0 ? `<span>（助手: ${assistantMessages} 条）</span>` : ''}
                    </div>
                </div>
            `;
        }

        // 时间信息（合并显示创建时间和更新时间）
        if (sessionCreatedAt || sessionUpdatedAt) {
            const createdDate = sessionCreatedAt ? new Date(sessionCreatedAt) : null;
            const updatedDate = sessionUpdatedAt ? new Date(sessionUpdatedAt) : null;
            const hasValidCreated = createdDate && !isNaN(createdDate.getTime());
            const hasValidUpdated = updatedDate && !isNaN(updatedDate.getTime());
            const isSameTime = hasValidCreated && hasValidUpdated && 
                              Math.abs(createdDate.getTime() - updatedDate.getTime()) < 60000; // 1分钟内视为相同
            
            if (hasValidCreated || hasValidUpdated) {
                pageInfoHtml += `
                    <div class="welcome-card-section">
                        <div class="welcome-card-section-title">⏰ 时间信息</div>
                        <div class="welcome-card-meta">
                            ${hasValidCreated ? `<span>创建: ${this.escapeHtml(this.formatDate(createdDate))}</span>` : ''}
                            ${hasValidUpdated && !isSameTime ? `<span>更新: ${this.escapeHtml(this.formatDate(updatedDate))}</span>` : ''}
                        </div>
                    </div>
                `;
            }
        }

        pageInfoHtml += '</div>';
        return pageInfoHtml;
    };

    // @param {Object} pageInfo - 页面信息对象（可选，如果不提供则使用当前页面信息）
    //   - title: 页面标题
    //   - url: 页面URL
    //   - description: 页面描述（可选）
    proto.createWelcomeMessage = async function (messagesContainer, pageInfo = null, skipAutoHandle = false) {
        // 获取当前会话信息
        const session = this.currentSessionId ? this.sessions[this.currentSessionId] : null;
        
        // 调试日志（仅在开发环境或会话有消息时输出）
        if (!session || (session.messages && session.messages.length > 0)) {
            console.log('[createWelcomeMessage] 创建欢迎消息:', {
                currentSessionId: this.currentSessionId,
                hasSession: !!session,
                messagesCount: session && session.messages ? session.messages.length : 0
            });
        }

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
            if (session) {
                // 如果会话没有 url 对象或者 url 对象为空，就不设置 url
                const sessionUrl = session.url && session.url.trim() ? session.url : null;
                pageInfo = {
                    title: session.pageTitle || document.title || '当前页面',
                    url: sessionUrl || window.location.href,
                    description: session.pageDescription || ''
                };
                // 如果会话没有有效的 url，将 url 设置为空字符串，这样 buildWelcomeCardHtml 就不会显示网址
                if (!sessionUrl) {
                    pageInfo.url = '';
                }
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

        // 使用统一的构建方法生成欢迎卡片 HTML
        const pageInfoHtml = this.buildWelcomeCardHtml(pageInfo, session);

        // 创建欢迎消息元素
        const welcomeMessage = this.createMessageElement('', 'pet');
        welcomeMessage.setAttribute('data-welcome-message', 'true');
        // 将欢迎消息添加到容器最前面（如果容器已有内容，使用 insertBefore，否则使用 appendChild）
        if (messagesContainer.firstChild) {
            messagesContainer.insertBefore(welcomeMessage, messagesContainer.firstChild);
        } else {
            messagesContainer.appendChild(welcomeMessage);
        }

        const messageText = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
        if (messageText) {
            messageText.innerHTML = pageInfoHtml;
            // 保存原始HTML用于后续保存（虽然欢迎消息不会被保存到消息数组中）
            messageText.setAttribute('data-original-text', pageInfoHtml);
            
            // 绑定交互事件
            this.bindWelcomeCardEvents(messageText);
        }

        // 自动处理会话保存和选中（仅在未跳过时执行）
        if (!skipAutoHandle) {
            await this.autoHandleSessionForUrl(pageInfo.url);
        }

        return welcomeMessage;
    };

    // 刷新第一条欢迎消息（当会话信息更新时调用）
    proto.refreshWelcomeMessage = async function () {
        if (!this.chatWindow || !this.currentSessionId) {
            return;
        }

        const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages');
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

        // 使用统一的构建方法生成欢迎卡片 HTML
        const pageInfoHtml = this.buildWelcomeCardHtml(pageInfo, session);

        // 更新欢迎消息的内容
        const messageText = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
        if (messageText) {
            messageText.innerHTML = pageInfoHtml;
            // 更新原始HTML
            messageText.setAttribute('data-original-text', pageInfoHtml);
            
            // 绑定交互事件
            this.bindWelcomeCardEvents(messageText);
        }

        // 自动处理会话保存和选中
        await this.autoHandleSessionForUrl(pageInfo.url);

        console.log('欢迎消息已刷新');
    };

    /**
     * 自动处理会话：根据URL查找或创建会话，并自动选中和锚定位置
     * 这个方法确保在创建欢迎消息时，会话已正确初始化并选中
     * @param {string} url - 页面URL
     */
    proto.autoHandleSessionForUrl = async function (url) {
        if (!url) {
            console.warn('URL为空，跳过自动处理会话');
            return;
        }

        try {
            // 如果当前会话的URL匹配，只需要滚动到位置
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const currentSession = this.sessions[this.currentSessionId];
                if (currentSession.url === url) {
                    // 当前会话已匹配，只需滚动到位置
                    if (typeof this.scrollToSessionItem === 'function') {
                        await this.scrollToSessionItem(this.currentSessionId);
                    }
                    return;
                }
            }

            // 如果当前会话不匹配，调用 initSession 重新初始化
            // initSession 会自动查找或创建匹配的会话，并选中和滚动
            if (typeof this.initSession === 'function') {
                await this.initSession();
            }
        } catch (error) {
            console.error('自动处理会话失败:', error);
        }
    };

    /**
     * 通过会话对象查找对应的 sessionId（辅助函数）
     * @param {Object} targetSession - 目标会话对象
     * @returns {string|null} 对应的 sessionId，如果未找到则返回 null
     */
    proto._findSessionIdBySession = function (targetSession) {
        if (!targetSession) return null;

        // 遍历所有会话，找到匹配的会话对象
        for (const [sessionId, session] of Object.entries(this.sessions)) {
            // 通过对象引用或 key 字段匹配
            if (session === targetSession || (session.key && targetSession.key && session.key === targetSession.key)) {
                return sessionId;
            }
        }
        return null;
    };

    /**
     * 处理基于 URL 的会话：检查当前页面 URL 是否在会话列表中
     * 如果不在，则立即自动新建会话并保存后刷新会话列表
     * 如果存在，则自动选中该会话并锚定到对应会话的位置
     * 
     * 重新设计：直接基于 URL 查找会话，不依赖 sessionId 进行查找
     */
    proto.handleUrlBasedSession = async function () {
        try {
            // 确保会话列表已加载（如果使用后端同步）
            if (this.sessionApi && this.sessionApi.isEnabled()) {
                if (!this.hasLoadedSessionsForChat) {
                    console.log('会话列表未加载，先加载会话列表...');
                    await this.loadSessionsFromBackend(true);
                    this.hasLoadedSessionsForChat = true;
                }
            }

            // 获取当前页面 URL
            const pageInfo = this.getPageInfo();
            const currentUrl = pageInfo.url;

            if (!currentUrl) {
                console.warn('当前页面 URL 为空，跳过 URL 匹配检查');
                return;
            }

            // 确保已加载所有会话
            if (typeof this.loadAllSessions === 'function') {
                await this.loadAllSessions();
            }

            // 确保 sessions 对象已初始化
            if (!this.sessions) {
                this.sessions = {};
            }

            // 首先查找是否存在URL匹配的会话（遍历所有会话）
            let matchedSessionKey = null;
            for (const [key, session] of Object.entries(this.sessions)) {
                if (session && session.url === currentUrl) {
                    matchedSessionKey = key;
                    break;
                }
            }


            // 如果找到了匹配的会话，直接选中
            if (matchedSessionKey) {
                const existingSession = this.sessions[matchedSessionKey];
                if (existingSession) {
                    // 更新会话页面信息
                    if (typeof this.updateSessionPageInfo === 'function') {
                        this.updateSessionPageInfo(matchedSessionKey, pageInfo);
                    }

                    // 自动选中匹配的会话
                    if (typeof this.activateSession === 'function') {
                        await this.activateSession(matchedSessionKey, {
                            saveCurrent: false,
                            updateConsistency: true,
                            updateUI: true
                        });
                    }

                    // 注意：滚动到会话项位置应该在侧边栏更新完成后进行
                    // 这里不立即滚动，由 openChatWindow 在 updateSessionSidebar 后统一处理
                    // 但如果侧边栏已经存在，也可以立即滚动
                    if (this.sessionSidebar && typeof this.scrollToSessionItem === 'function') {
                        // 等待侧边栏更新完成
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await this.scrollToSessionItem(matchedSessionKey);
                    }

                    console.log('找到URL匹配的会话，已自动选中:', matchedSessionKey);
                    return matchedSessionKey;
                }
            } else {
                // 创建新会话：参考 YiWeb 的 handleSessionCreate，由后端生成 key
                try {
                    // 创建会话数据对象（不包含 key，让后端生成）
                    const sessionData = this.createSessionObject(pageInfo);

                    // 获取当前时间戳
                    const now = Date.now();

                    // 构建要发送到后端的会话数据（不包含 key）
                    // 优先使用当前页面 URL，如果没有则使用会话数据中的 URL
                    const sessionDataToSave = {
                        // 不包含 key 字段，让后端生成
                        url: currentUrl || sessionData.url || '',
                        title: sessionData.title || sessionData.pageTitle || '新会话',
                        pageTitle: sessionData.pageTitle || sessionData.title || '',
                        pageDescription: sessionData.pageDescription || '',
                        pageContent: sessionData.pageContent || '',
                        messages: sessionData.messages || [],
                        tags: sessionData.tags || [],
                        createdAt: sessionData.createdAt || now,
                        updatedAt: now,
                        lastAccessTime: now
                    };

                    // 如果启用了后端同步，调用后端 API 创建会话
                    if (this.sessionApi && this.sessionApi.isEnabled()) {
                        // 调用后端 create_document API（不提供 key，让后端生成）
                        const payload = {
                            module_name: 'services.database.data_service',
                            method_name: 'create_document',
                            parameters: {
                                cname: 'sessions',
                                data: sessionDataToSave
                            }
                        };

                        const url = `${this.sessionApi.baseUrl}/`;
                        const response = await this.sessionApi._request(url, {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });

                        if (response && response.success !== false) {
                            // 从响应中提取后端生成的 key
                            let sessionKey = null;

                            // 尝试从不同位置提取 key
                            if (response.data && response.data.key) {
                                sessionKey = response.data.key;
                            } else if (response.data && response.data.data && response.data.data.key) {
                                sessionKey = response.data.data.key;
                            } else if (response.key) {
                                sessionKey = response.key;
                            } else if (response.data && typeof response.data === 'object' && response.data._id) {
                                // 如果后端返回的是 _id，使用 _id 作为 key
                                sessionKey = response.data._id;
                            }

                            if (!sessionKey) {
                                console.warn('[handleUrlBasedSession] 后端响应中未找到 key，尝试从返回的数据中提取');
                                // 如果响应中直接是会话对象，尝试提取 key
                                if (response.data && typeof response.data === 'object') {
                                    sessionKey = response.data.key || response.data._id || response.data.id;
                                }
                            }

                            if (sessionKey) {
                                // 使用后端生成的 key 更新会话数据
                                sessionDataToSave.key = sessionKey;

                                // 创建完整的会话对象
                                const newSession = {
                                    ...sessionDataToSave,
                                    key: sessionKey
                                };

                                // 使用 key 作为 sessionId 存储到本地
                                const sessionId = sessionKey;
                                this.sessions[sessionId] = newSession;

                                // 调用 write-file 接口写入页面上下文（参考 YiWeb 的 handleSessionCreate）
                                if (newSession.pageContent && newSession.pageContent.trim()) {
                                    if (typeof this.writeSessionPageContent === 'function') {
                                        await this.writeSessionPageContent(sessionId);
                                    }
                                }

                                // 保存到本地存储
                                if (typeof this.saveSession === 'function') {
                                    await this.saveSession(sessionId);
                                }

                                // 自动选中新创建的会话
                                if (typeof this.activateSession === 'function') {
                                    await this.activateSession(sessionId, {
                                        saveCurrent: false,
                                        updateConsistency: true,
                                        updateUI: true
                                    });
                                }

                                // 注意：滚动到会话项位置应该在侧边栏更新完成后进行
                                // 这里不立即滚动，由 openChatWindow 在 updateSessionSidebar 后统一处理
                                // 但如果侧边栏已经存在，也可以立即滚动
                                if (this.sessionSidebar && typeof this.scrollToSessionItem === 'function') {
                                    // 等待侧边栏更新完成
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                    await this.scrollToSessionItem(sessionId);
                                }

                                console.log('[handleUrlBasedSession] 已通过后端创建新会话，Key:', sessionKey, 'URL:', currentUrl);
                                return sessionId;
                            } else {
                                console.error('[handleUrlBasedSession] 无法从后端响应中提取 key:', response);
                                throw new Error('后端创建会话成功，但未返回 key');
                            }
                        } else {
                            throw new Error(response?.message || '后端创建会话失败');
                        }
                    } else {
                        // 如果未启用后端同步，使用本地方式创建（生成临时 key）
                        console.warn('[handleUrlBasedSession] 后端同步未启用，使用本地方式创建会话');
                        const tempKey = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        sessionDataToSave.key = tempKey;

                        const sessionId = tempKey;
                        this.sessions[sessionId] = sessionDataToSave;

                        // 保存到本地存储
                        if (typeof this.saveSession === 'function') {
                            await this.saveSession(sessionId);
                        }

                        // 自动选中新创建的会话
                        if (typeof this.activateSession === 'function') {
                            await this.activateSession(sessionId, {
                                saveCurrent: false,
                                updateConsistency: true,
                                updateUI: true
                            });
                        }

                        // 注意：滚动到会话项位置应该在侧边栏更新完成后进行
                        // 这里不立即滚动，由 openChatWindow 在 updateSessionSidebar 后统一处理
                        // 但如果侧边栏已经存在，也可以立即滚动
                        if (this.sessionSidebar && typeof this.scrollToSessionItem === 'function') {
                            // 等待侧边栏更新完成
                            await new Promise(resolve => setTimeout(resolve, 100));
                            await this.scrollToSessionItem(sessionId);
                        }

                        console.log('[handleUrlBasedSession] 已通过本地方式创建新会话，临时 Key:', tempKey, 'URL:', currentUrl);
                        return sessionId;
                    }
                } catch (error) {
                    console.error('[handleUrlBasedSession] 创建新会话失败:', error);
                    // 不抛出错误，避免影响主流程
                    return null;
                }
            }
        } catch (error) {
            console.error('处理基于 URL 的会话失败:', error);
            return null;
        }
    };

    /**
     * 滚动到指定的会话项位置（锚定）
     * @param {string} sessionId - 会话ID
     */
    proto.scrollToSessionItem = async function (sessionId) {
        if (!this.sessionSidebar || !sessionId) {
            return;
        }

        // 等待DOM更新
        await new Promise(resolve => setTimeout(resolve, 200));

        // 查找会话项（只使用 key）
        // 首先尝试直接使用 sessionId 查找（如果 sessionId 就是 key）
        let sessionItem = this.sessionSidebar.querySelector(`[data-session-id="${sessionId}"]`);

        // 如果找不到，尝试从 sessions 中获取 key
        if (!sessionItem && this.sessions[sessionId]) {
            const session = this.sessions[sessionId];
            const sessionKey = session.key;
            if (sessionKey && sessionKey !== sessionId) {
                sessionItem = this.sessionSidebar.querySelector(`[data-session-id="${sessionKey}"]`);
            }
        }

        if (!sessionItem) {
            console.warn('未找到会话项，尝试更新侧边栏后重试，sessionId:', sessionId);
            // 如果找不到，先更新侧边栏
            if (typeof this.updateSessionSidebar === 'function') {
                await this.updateSessionSidebar();
                // 再次等待DOM更新
                await new Promise(resolve => setTimeout(resolve, 300));

                // 再次尝试查找
                sessionItem = this.sessionSidebar.querySelector(`[data-session-id="${sessionId}"]`);
                if (!sessionItem && this.sessions[sessionId]) {
                    const session = this.sessions[sessionId];
                    const sessionKey = session.key;
                    if (sessionKey && sessionKey !== sessionId) {
                        sessionItem = this.sessionSidebar.querySelector(`[data-session-id="${sessionKey}"]`);
                    }
                }

                if (sessionItem) {
                    this._scrollToElement(sessionItem);
                } else {
                    console.warn('更新侧边栏后仍未找到会话项，sessionId:', sessionId);
                }
            }
            return;
        }

        // 滚动到会话项
        this._scrollToElement(sessionItem);
    };

    /**
     * 滚动到指定元素（内部方法）
     * @param {HTMLElement} element - 要滚动到的元素
     */
    proto._scrollToElement = function (element) {
        if (!element) return;

        // 查找可滚动的父容器
        const scrollableContainer = element.closest('.session-sidebar-scrollable-content');
        if (!scrollableContainer) return;

        // 计算元素相对于容器的位置
        const containerRect = scrollableContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // 计算需要滚动的距离
        const scrollTop = scrollableContainer.scrollTop;
        const elementTop = elementRect.top - containerRect.top + scrollTop;
        const elementHeight = elementRect.height;
        const containerHeight = containerRect.height;

        // 计算目标滚动位置（让元素居中显示）
        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

        // 平滑滚动
        scrollableContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
        });

        // 添加高亮效果
        element.classList.add('highlight-session');
        setTimeout(() => {
            element.classList.remove('highlight-session');
        }, 2000);
    };

    // HTML转义辅助方法（防止XSS）
    proto.escapeHtml = function (text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    proto.getCurrentTime = function () {
        const now = new Date();
        return this.formatTimestamp(now.getTime());
    };

    // 格式化时间戳为年月日时分格式
    proto.formatTimestamp = function (timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}年${month}月${day}日 ${hour}:${minute}`;
    };

    // 格式化日期为 YYYY/MM/DD 格式
    proto.formatDate = function (date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            return '';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    };

    // 添加聊天滚动条样式
    proto.addChatScrollbarStyles = function () {
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
            #yi-pet-chat-messages::-webkit-scrollbar {
                width: 8px;
            }

            #yi-pet-chat-messages::-webkit-scrollbar-track {
                background: rgba(241, 241, 241, 0.5);
                border-radius: 4px;
            }

            #yi-pet-chat-messages::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 4px;
                border: 1px solid transparent;
                background-clip: padding-box;
            }

            #yi-pet-chat-messages::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }

            /* Firefox 滚动条样式 */
            #yi-pet-chat-messages {
                scrollbar-width: thin;
                scrollbar-color: #c1c1c1 rgba(241, 241, 241, 0.5);
            }

            /* 确保消息容器可以滚动 */
            #yi-pet-chat-messages {
                overflow-y: auto !important;
                overflow-x: hidden !important;
            }
        `;
        document.head.appendChild(style);
    };

    // 播放聊天动画
    proto.playChatAnimation = function () {
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
    proto.showChatBubble = function () {
        if (!this.pet) return;

        // 创建聊天气泡
        const bubble = document.createElement('div');
        bubble.className = 'pet-chat-bubble';

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
