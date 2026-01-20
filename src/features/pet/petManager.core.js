// 防止重复声明 PetManager
(function () {
    'use strict';
    try {
        if (typeof window.PetManager !== 'undefined') {
            return; // 如果已经存在，直接返回
        }

        // 检查必要的依赖
        if (typeof window === 'undefined') {
            console.error('[PetManager.core] window 对象未定义');
            return;
        }

        if (typeof PET_CONFIG === 'undefined') {
            console.warn('[PetManager.core] PET_CONFIG 未定义，将使用默认值');
        }

        class PetManager extends LoadingAnimationMixin {
            constructor() {
                super();
                this.pet = null;
                this.isVisible = PET_CONFIG.pet.defaultVisible;
                this.colorIndex = PET_CONFIG.pet.defaultColorIndex;
                this.size = PET_CONFIG.pet.defaultSize;
                this.position = getPetDefaultPosition();
                this.role = '教师'; // 默认角色为教师
                this.chatWindow = null;
                this.isChatOpen = false;
                this.currentModel = (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3';

                this.colors = PET_CONFIG.pet.colors;
                this.mermaidLoaded = false;
                this.mermaidLoading = false;
                this.jszipLoaded = false;
                this.jszipLoading = false;

                // 会话管理相关属性
                this.currentSessionId = null;
                this.sessions = {}; // 存储所有会话，key为sessionId，value为会话数据
                this.sessionSidebar = null; // 会话侧边栏元素
                this.isSwitchingSession = false; // 是否正在切换会话（防抖标志）
                this.currentPageUrl = null; // 当前页面URL，用于判断是否为新页面
                this.hasAutoCreatedSessionForPage = false; // 当前页面是否已经自动创建了会话
                this.sessionInitPending = false; // 会话初始化是否正在进行中
                this.sidebarWidth = 500; // 侧边栏宽度（像素）
                this.isResizingSidebar = false; // 是否正在调整侧边栏宽度
                this.sidebarCollapsed = false; // 侧边栏是否折叠
                this.inputContainerCollapsed = false; // 输入框容器是否折叠

                // 会话更新优化相关
                this.sessionUpdateTimer = null; // 会话更新防抖定时器
                this.pendingSessionUpdate = false; // 是否有待处理的会话更新
                this.lastSessionSaveTime = 0; // 上次保存会话的时间
                this.SESSION_UPDATE_DEBOUNCE = 300; // 会话更新防抖时间（毫秒）
                this.SESSION_SAVE_THROTTLE = 1000; // 会话保存节流时间（毫秒）

                // 标签过滤相关
                this.selectedFilterTags = []; // 选中的过滤标签（会话，默认不选中任何标签）
                this.tagFilterReverse = false; // 是否反向过滤会话
                this.tagFilterNoTags = false; // 是否筛选无标签的会话（默认不选中）
                this.tagFilterExpanded = false; // 标签列表是否展开（会话）
                this.tagFilterVisibleCount = 8; // 折叠时显示的标签数量（会话）
                this.tagFilterSearchKeyword = ''; // 标签搜索关键词
                this.tagOrder = null; // 标签顺序（从localStorage加载）

                this.sessionTitleFilter = ''; // 会话标题搜索过滤关键词
                this.dateRangeFilter = null; // 日期区间过滤 { startDate: Date, endDate: Date } 或 null，支持只选择结束日期来筛选结束日期之前的记录
                this.calendarCollapsed = true; // 日历是否折叠
                this.calendarMonth = null; // 当前显示的日历月份

                // 批量操作相关
                this.batchMode = false; // 是否处于批量选择模式
                this.selectedSessionIds = new Set(); // 选中的会话ID集合


                // 会话API管理器
                this.sessionApi = null;
                this.lastSessionListLoadTime = 0;
                this.SESSION_LIST_RELOAD_INTERVAL = 10000; // 会话列表重新加载间隔（10秒）
                this.isPageFirstLoad = true; // 标记是否是页面首次加载/刷新
                this.skipSessionListRefresh = false; // 标记是否跳过会话列表刷新（prompt调用后使用）
                this.isChatWindowFirstOpen = true; // 标记是否是第一次打开聊天窗口
                this.hasLoadedSessionsForChat = false; // 当前聊天周期是否已加载过会话列表

                // FAQ API管理器
                this.faqApi = null;

                // 状态保存节流相关
                this.lastStateSaveTime = 0; // 上次保存状态的时间
                this.STATE_SAVE_THROTTLE = 2000; // 状态保存节流时间（毫秒），避免超过chrome.storage.sync的写入限制
                this.stateSaveTimer = null; // 状态保存防抖定时器
                this.pendingStateUpdate = null; // 待保存的状态数据
                this.useLocalStorage = false; // 是否使用localStorage作为降级方案（当遇到配额错误时）

                // 加载动画计数器
                this.activeRequestCount = 0;

                this.init();
            }




            async init() {
                // 加载标签顺序
                this.loadTagOrder();
                console.log('初始化宠物管理器');

                // 初始化会话API管理器
                if (typeof SessionApiManager !== 'undefined' && PET_CONFIG.api.syncSessionsToBackend) {
                    this.sessionApi = new SessionApiManager(
                        PET_CONFIG.api.yiaiBaseUrl,
                        PET_CONFIG.api.syncSessionsToBackend
                    );
                    console.log('会话API管理器已初始化');
                } else {
                    console.log('会话API管理器未启用');
                }

                // 初始化FAQ API管理器
                if (typeof FaqApiManager !== 'undefined') {
                    const faqApiUrl = PET_CONFIG?.api?.faqApiUrl || 'http://localhost:8000';
                    this.faqApi = new FaqApiManager(faqApiUrl, true);
                    console.log('FAQ API管理器已初始化，URL:', faqApiUrl);
                } else {
                    console.log('FAQ API管理器未启用');
                }

                this.loadState(); // 加载保存的状态
                this.setupMessageListener();
                this.createPet();

                // 延迟检查并更新宠物显示状态，确保状态加载完成后样式正确
                setTimeout(() => {
                    if (this.pet) {
                        console.log('延迟检查：更新宠物样式，可见性:', this.isVisible);
                        this.updatePetStyle();
                        // 如果宠物已创建但还没有添加到页面，尝试再次添加
                        if (!this.pet.parentNode) {
                            console.log('延迟检查：宠物未添加到页面，尝试重新添加');
                            this.addPetToPage();
                        }
                    }
                }, 500);

                // 启动定期同步，确保状态一致性
                this.startPeriodicSync();

                // 添加键盘快捷键支持
                this.setupKeyboardShortcuts();

                // 初始化会话：等待页面加载完成后1秒再创建新会话
                this.initSessionWithDelay();

                // 监听页面标题变化，以便在标题改变时更新会话
                this.setupTitleChangeListener();

                // 监听URL变化，以便在URL改变时创建新会话（支持单页应用）
                this.setupUrlChangeListener();

                // 注意：已移除多页面会话列表同步逻辑，多页面之间的会话互相独立
            }







            // 清理资源
            cleanup() {
                console.log('清理宠物管理器资源...');

                // 停止定期同步
                this.stopPeriodicSync();

                // 移除键盘快捷键监听器
                if (this._keyboardShortcutHandler) {
                    window.removeEventListener('keydown', this._keyboardShortcutHandler, true);
                    document.removeEventListener('keydown', this._keyboardShortcutHandler, true);
                    this._keyboardShortcutHandler = null;
                }

                // 移除宠物
                this.removePet();

                // 关闭聊天窗口
                if (this.chatWindow) {
                    this.closeChatWindow();
                }

                // 清理截图预览
                this.closeScreenshotPreview();

                console.log('资源清理完成');
            }

            // 从本地 sessions 对象获取会话列表（辅助函数）

            // 保存标签顺序

            // 获取会话的显示标题（用于过滤和显示）





            // 创建日历组件
            /**
            * 创建日历组件
            * 支持日期区间选择和折叠/展开功能
            */

            // 更新接口请求列表侧边栏
            /**
             * 获取过滤后的接口请求列表（统一过滤逻辑）
             * @returns {Array} 过滤后的请求列表
             */
            /**
             * 获取请求的唯一标识（使用 key 字段）
             * @param {Object} req - 请求对象
             * @returns {string|null} 唯一标识（key 字段）
             */

            // 优化页面上下文内容
            /**
             * 清理和优化文本内容
             * 去除HTML标签、无意义内容，保留核心信息
             * @param {string} text - 待清理的文本
             * @returns {string} 清理后的文本
             */

            // 根据标签名称生成颜色（确保相同标签颜色一致）

            // 清除所有选中状态（切换视图时调用）
            clearAllSelections() {
                // 清除当前选中的会话
                this.currentSessionId = null;

                // 清除批量选中的状态
                if (this.selectedSessionIds) {
                    this.selectedSessionIds.clear();
                }
                if (this.selectedApiRequestIds) {
                    this.selectedApiRequestIds.clear();
                }

                // 清除所有 active 类的元素
                if (this.sessionSidebar) {
                    // 清除会话项的 active 状态
                    const activeSessionItems = this.sessionSidebar.querySelectorAll('.session-item.active');
                    activeSessionItems.forEach(item => {
                        item.classList.remove('active');
                    });
                }

                console.log('已清除所有选中状态');
            }

            // 清空聊天会话内容
            clearChatMessages() {
                if (!this.chatWindow || !this.isChatOpen) {
                    return;
                }

                const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                    console.log('已清空聊天会话内容');
                }
            }

            // 设置视图模式（会话列表）
            async setViewMode(mode) {
                // 强制使用会话视图，忽略传入的 mode 参数

                // 切换视图前，清除所有选中状态
                this.clearAllSelections();

                // 切换视图时，清空聊天会话内容
                this.clearChatMessages();

                // 默认会话视图
                await this.updateSessionSidebar();
                // 确保视图模式状态与列表数据一致
                this.applyViewMode();
            }

            // 应用视图模式样式（参考上下文弹框的applyContextPreviewMode）

            // 进入批量选择模式
            enterBatchMode() {
                this.batchMode = true;
                if (this.selectedSessionIds) this.selectedSessionIds.clear();

                // 显示批量操作工具栏（参考 YiWeb：直接显示，不需要动画）
                const batchToolbar = document.getElementById('batch-toolbar');
                if (batchToolbar) {
                    batchToolbar.style.display = 'flex';
                }

                // 更新批量模式按钮状态
                const batchModeBtn = this.sessionSidebar.querySelector('.session-action-btn--batch');
                if (batchModeBtn) {
                    batchModeBtn.classList.add('active');
                    batchModeBtn.classList.remove('batch-mode-btn-inactive');
                    batchModeBtn.classList.remove('batch-mode-btn-active');
                    batchModeBtn.innerHTML = '☑️ 退出批量';
                    batchModeBtn.title = '退出批量选择模式';
                }

                // 更新会话列表，显示复选框
                const sessionList = this.sessionSidebar.querySelector('.session-list');
                if (sessionList && sessionList.style.display !== 'none') {
                    this.updateSessionSidebar();
                }

                // 更新批量工具栏状态
                setTimeout(() => {
                    this.updateBatchToolbar();
                }, 100);

                // 显示通知
                this.showNotification('已进入批量选择模式', 'info');
            }

            // 退出批量选择模式
            exitBatchMode() {
                this.batchMode = false;
                if (this.selectedSessionIds) this.selectedSessionIds.clear();
                if (this.selectedApiRequestIds) this.selectedApiRequestIds.clear();

                // 隐藏批量操作工具栏（参考 YiWeb：直接隐藏）
                const batchToolbar = document.getElementById('batch-toolbar');
                if (batchToolbar) {
                    batchToolbar.style.display = 'none';
                }

                // 更新批量模式按钮状态
                const batchModeBtn = this.sessionSidebar.querySelector('.session-action-btn--batch');
                if (batchModeBtn) {
                    batchModeBtn.classList.remove('active');
                    batchModeBtn.classList.remove('batch-mode-btn-active');
                    batchModeBtn.classList.remove('batch-mode-btn-inactive');
                    batchModeBtn.innerHTML = '☑️ 批量';
                    batchModeBtn.title = '批量选择';
                }
                // 更新会话列表，隐藏复选框
                const sessionList = this.sessionSidebar.querySelector('.session-list');
                if (sessionList && sessionList.style.display !== 'none') {
                    this.updateSessionSidebar();
                }

                // 显示通知
                this.showNotification('已退出批量选择模式', 'info');
            }

            // 更新批量操作工具栏

            // 删除会话
            async deleteSession(sessionId, skipConfirm = false) {
                if (!sessionId || !this.sessions[sessionId]) return;

                // 获取会话标题用于提示
                const session = this.sessions[sessionId];
                const sessionTitle = session?.pageTitle || sessionId || '未命名会话';

                // 确认删除（如果未跳过确认）
                if (!skipConfirm) {
                    const confirmDelete = confirm(`确定要删除会话"${sessionTitle}"吗？`);
                    if (!confirmDelete) return;
                }

                // 记录是否删除的是当前会话
                const isCurrentSession = sessionId === this.currentSessionId;

                // 从选中集合中移除
                if (this.selectedSessionIds && this.selectedSessionIds.has(sessionId)) {
                    this.selectedSessionIds.delete(sessionId);
                    if (typeof this.updateBatchToolbar === 'function') {
                        this.updateBatchToolbar();
                    }
                }

                // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
                // 删除会话前不再自动保存当前会话

                // 从后端删除会话（如果启用了后端同步）
                if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                    try {
                        // 确保使用 session.key 作为统一标识
                        const unifiedSessionId = session.key || sessionId;

                        await this.sessionApi.deleteSession(unifiedSessionId);
                        console.log('会话已从后端删除:', unifiedSessionId);
                    } catch (error) {
                        console.warn('从后端删除会话失败:', error);
                        // 即使后端删除失败，也继续本地删除，确保用户界面响应
                    }
                }



                // 从本地删除会话
                delete this.sessions[sessionId];
                // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
                // 删除操作通过后端API完成持久化

                // 删除会话后，重新从接口获取会话列表（强制刷新）
                if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend && this.isChatOpen) {
                    try {
                        await this.loadSessionsFromBackend(true);
                        console.log('会话列表已从后端刷新');
                    } catch (error) {
                        console.warn('刷新会话列表失败:', error);
                    }
                }

                // 如果删除的是当前会话，切换到其他会话或清空
                if (isCurrentSession) {
                    // 查找最新的其他会话
                    const otherSessions = Object.values(this.sessions);

                    if (otherSessions.length > 0) {
                        // 切换到最近访问的会话（使用 lastAccessTime，更符合"最新使用"的概念）
                        // 如果没有 lastAccessTime，则使用 createdAt 作为备选
                        const latestSession = otherSessions.sort((a, b) => {
                            const aTime = a.lastAccessTime || a.createdAt || 0;
                            const bTime = b.lastAccessTime || b.createdAt || 0;
                            return bTime - aTime; // 最近访问的在前
                        })[0];

                        await this.activateSession(latestSession.id, {
                            saveCurrent: false, // 已经在前面保存了
                            updateUI: true,
                            syncToBackend: false // 删除会话后的自动切换不调用 session/save 接口
                        });
                    } else {
                        // 没有其他会话，清空当前会话
                        this.currentSessionId = null;
                        this.hasAutoCreatedSessionForPage = false;

                        // 清空消息显示
                        if (this.chatWindow && this.isChatOpen) {
                            const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
                            if (messagesContainer) {
                                messagesContainer.innerHTML = '';
                            }
                        }
                    }
                }

                // 更新侧边栏
                await this.updateSessionUI({ updateSidebar: true });

                console.log('会话已删除:', sessionId);
            }

            // 打开会话信息编辑对话框

            // 打开标签管理弹窗

            // 确保上下文编辑器 UI 存在

            // ========== 消息编辑器（类似上下文编辑器） ==========

            // 确保消息编辑器 UI 存在











            // 角色配置相关方法已移至 petManager.roles.js
            // 企微机器人相关方法已移至 petManager.robot.js






            // 处理 Markdown 中的 Mermaid 代码块
            createMessageElement(text, sender, imageDataUrl = null, timestamp = null) {
                // 与 YiWeb 保持完全一致的消息结构
                const messageDiv = document.createElement('div');
                messageDiv.className = 'pet-chat-message';
                if (sender === 'user') {
                    messageDiv.classList.add('is-user');
                } else {
                    messageDiv.classList.add('is-pet');
                }

                // 设置消息索引和时间戳（用于后续操作，与 YiWeb 保持一致）
                if (timestamp) {
                    messageDiv.setAttribute('data-chat-timestamp', timestamp.toString());
                } else {
                    // 如果没有提供时间戳，使用当前时间
                    messageDiv.setAttribute('data-chat-timestamp', Date.now().toString());
                }
                messageDiv.setAttribute('data-chat-type', sender === 'pet' ? 'pet' : 'user');
                
                // 设置消息索引（将在添加到容器时设置）
                // messageDiv.setAttribute('data-chat-idx', idx.toString());

                // 创建消息气泡容器（与 YiWeb 一致）
                const bubble = document.createElement('div');
                bubble.className = 'pet-chat-bubble';
                
                // 添加标识以便后续更新
                if (sender === 'pet') {
                    bubble.setAttribute('data-message-type', 'pet-bubble');
                } else {
                    bubble.setAttribute('data-message-type', 'user-bubble');
                }

                // 为消息保存原始文本用于复制和编辑功能
                if (text) {
                    bubble.setAttribute('data-original-text', text);
                }

                // 添加图片（与 YiWeb 一致）
                if (imageDataUrl) {
                    // 支持多图片（imageDataUrls）和单图片（imageDataUrl）
                    const images = Array.isArray(imageDataUrl) ? imageDataUrl : [imageDataUrl];
                    if (images.length > 1) {
                        const imageContainer = document.createElement('div');
                        imageContainer.className = 'pet-chat-images';
                        images.forEach((imgSrc) => {
                            const img = document.createElement('img');
                            img.src = imgSrc;
                            img.className = 'pet-chat-image';
                            img.alt = '图片消息';
                            img.addEventListener('click', () => {
                                this.showImagePreview(imgSrc);
                            });
                            imageContainer.appendChild(img);
                        });
                        bubble.appendChild(imageContainer);
                    } else if (images.length === 1) {
                        const img = document.createElement('img');
                        img.src = images[0];
                        img.className = 'pet-chat-image';
                        img.alt = '图片消息';
                        img.addEventListener('click', () => {
                            this.showImagePreview(images[0]);
                        });
                        bubble.appendChild(img);
                    }
                }

                // 添加文本内容（与 YiWeb 一致）
                if (text && text.trim()) {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'pet-chat-content md-preview-body';
                    
                    // 渲染 Markdown
                    const displayText = this.renderMarkdown(text);
                    contentDiv.innerHTML = displayText;
                    
                    bubble.appendChild(contentDiv);
                    
                    // 处理 Mermaid 图表（异步处理，不阻塞渲染）
                    if (!bubble.hasAttribute('data-mermaid-processing')) {
                        bubble.setAttribute('data-mermaid-processing', 'true');
                        setTimeout(async () => {
                            try {
                                await this.loadMermaid();
                                const hasMermaidCode = contentDiv.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                                if (hasMermaidCode) {
                                    await this.processMermaidBlocks(contentDiv);
                                }
                            } catch (error) {
                                console.error('处理 Mermaid 图表时出错:', error);
                            }
                            bubble.removeAttribute('data-mermaid-processing');
                        }, 100);
                    }
                } else if (!imageDataUrl) {
                    // 如果没有文本也没有图片，显示占位符（仅在流式生成时，与 YiWeb 一致）
                    const typingDiv = document.createElement('div');
                    typingDiv.className = 'pet-chat-typing';
                    typingDiv.setAttribute('aria-label', '生成中');
                    typingDiv.textContent = '...';
                    bubble.appendChild(typingDiv);
                }

                // 创建元数据容器（与 YiWeb 一致）
                const meta = document.createElement('div');
                meta.className = 'pet-chat-meta';

                // 创建操作按钮容器
                const metaActions = document.createElement('div');
                metaActions.className = 'pet-chat-meta-actions';
                metaActions.setAttribute('data-copy-button-container', 'true');
                meta.appendChild(metaActions);

                // 创建时间元素
                const messageTime = document.createElement('time');
                messageTime.className = 'pet-chat-time';
                const timeText = timestamp ? this.formatTimestamp(timestamp) : this.getCurrentTime();
                messageTime.textContent = timeText;
                if (timestamp) {
                    messageTime.setAttribute('datetime', new Date(timestamp).toISOString());
                }
                meta.appendChild(messageTime);

                // 将元数据添加到气泡
                bubble.appendChild(meta);

                // 将气泡添加到消息容器
                messageDiv.appendChild(bubble);

                // 为消息添加操作按钮（延迟添加，确保 DOM 已渲染）
                setTimeout(() => {
                    this.addMessageActionButtons(messageDiv, bubble, sender, text);
                }, 0);

                return messageDiv;
            }

            // 添加与 YiWeb 一致的消息操作按钮
            addMessageActionButtons(messageDiv, bubble, sender, text) {
                if (!messageDiv || !bubble) return;

                const meta = bubble.querySelector('.pet-chat-meta');
                if (!meta) return;

                const metaActions = meta.querySelector('.pet-chat-meta-actions');
                if (!metaActions) return;

                // 如果已经有按钮，不再重复添加
                if (metaActions.children.length > 0) return;

                const isPet = sender === 'pet';
                const hasContent = text && text.trim();

                // 1. 复制按钮（有内容时显示）
                if (hasContent) {
                    const copyBtn = document.createElement('button');
                    copyBtn.type = 'button';
                    copyBtn.className = 'pet-chat-meta-btn';
                    copyBtn.setAttribute('aria-label', '复制消息');
                    copyBtn.setAttribute('title', '复制');
                    copyBtn.textContent = '复制';
                    
                    copyBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            const content = bubble.getAttribute('data-original-text') || text || '';
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                await navigator.clipboard.writeText(content.trim());
                                copyBtn.textContent = '已复制';
                                setTimeout(() => {
                                    copyBtn.textContent = '复制';
                                }, 1200);
                                if (this.showNotification) {
                                    this.showNotification('已复制到剪贴板', 'success');
                                }
                            } else {
                                const textArea = document.createElement('textarea');
                                textArea.value = content.trim();
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-9999px';
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                                copyBtn.textContent = '已复制';
                                setTimeout(() => {
                                    copyBtn.textContent = '复制';
                                }, 1200);
                                if (this.showNotification) {
                                    this.showNotification('已复制到剪贴板', 'success');
                                }
                            }
                        } catch (error) {
                            console.error('复制失败:', error);
                            if (this.showNotification) {
                                this.showNotification('复制失败，请重试', 'error');
                            }
                        }
                    });
                    metaActions.appendChild(copyBtn);
                }

                // 2. 微信机器人按钮容器（仅宠物消息且有内容时显示）
                let robotButtonsContainer = null;
                if (isPet && hasContent) {
                    // 创建一个容器用于放置机器人按钮，确保按钮顺序正确
                    robotButtonsContainer = document.createElement('span');
                    robotButtonsContainer.style.display = 'inline-flex';
                    robotButtonsContainer.style.gap = '8px';
                    metaActions.appendChild(robotButtonsContainer);

                    // 异步添加机器人按钮
                    (async () => {
                        try {
                            const robotConfigs = await this.getWeWorkRobotConfigs();
                            if (Array.isArray(robotConfigs) && robotConfigs.length > 0 && robotButtonsContainer) {
                                for (const robotConfig of robotConfigs) {
                                    if (!robotConfig || !robotConfig.webhookUrl) continue;

                                    const robotBtn = document.createElement('button');
                                    robotBtn.type = 'button';
                                    robotBtn.className = 'pet-chat-meta-btn';
                                    robotBtn.setAttribute('aria-label', `发送到机器人：${robotConfig.name || '机器人'}`);
                                    robotBtn.setAttribute('title', `发送到：${robotConfig.name || '机器人'}`);
                                    robotBtn.textContent = robotConfig.name || '机器人';

                                    robotBtn.addEventListener('click', async (e) => {
                                        e.stopPropagation();
                                        
                                        const messageContent = bubble.getAttribute('data-original-text') || text || '';
                                        if (!messageContent || !messageContent.trim()) {
                                            if (this.showNotification) {
                                                this.showNotification('消息内容为空，无法发送', 'error');
                                            }
                                            return;
                                        }

                                        const trimmedContent = messageContent.trim();
                                        const originalText = robotBtn.textContent;
                                        robotBtn.textContent = '发送中...';
                                        robotBtn.disabled = true;

                                        try {
                                            // 处理消息内容（精简和转换为 Markdown）
                                            let finalContent = '';
                                            if (this.processMessageForRobot) {
                                                // 使用 processMessageForRobot 方法处理消息（精简和转换为 Markdown）
                                                finalContent = await this.processMessageForRobot(trimmedContent);
                                            } else if (this.convertToMarkdown) {
                                                // 降级方案：只转换为 Markdown，不精简
                                                finalContent = await this.convertToMarkdown(trimmedContent);
                                            } else {
                                                // 最后降级方案：直接使用原内容
                                                finalContent = trimmedContent;
                                            }

                                            // 发送到机器人
                                            await this.sendToWeWorkRobot(robotConfig.webhookUrl, finalContent);
                                            
                                            if (this.showNotification) {
                                                this.showNotification(`已发送到 ${robotConfig.name || '机器人'}`, 'success');
                                            }
                                            
                                            robotBtn.textContent = '已发送';
                                            setTimeout(() => {
                                                robotBtn.textContent = originalText;
                                                robotBtn.disabled = false;
                                            }, 2000);
                                        } catch (error) {
                                            console.error('发送到机器人失败:', error);
                                            if (this.showNotification) {
                                                this.showNotification(`发送失败：${error.message || '未知错误'}`, 'error');
                                            }
                                            robotBtn.textContent = originalText;
                                            robotBtn.disabled = false;
                                        }
                                    });

                                    robotButtonsContainer.appendChild(robotBtn);
                                }
                            }
                        } catch (error) {
                            console.error('获取机器人配置失败:', error);
                        }
                    })();
                }

                // 3. 编辑按钮（所有消息都显示）
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'pet-chat-meta-btn';
                editBtn.setAttribute('aria-label', '编辑消息');
                editBtn.setAttribute('title', '编辑');
                editBtn.textContent = '✏️';
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.openMessageEditor) {
                        this.openMessageEditor(bubble, sender);
                    }
                });
                metaActions.appendChild(editBtn);

                // 4. 重新发送按钮（仅用户消息）
                if (!isPet) {
                    const resendBtn = document.createElement('button');
                    resendBtn.type = 'button';
                    resendBtn.className = 'pet-chat-meta-btn';
                    resendBtn.setAttribute('aria-label', '重新发送');
                    resendBtn.setAttribute('title', '重新发送');
                    resendBtn.textContent = '📨';
                    resendBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (this.resendMessage) {
                            await this.resendMessage(messageDiv);
                        }
                    });
                    metaActions.appendChild(resendBtn);
                }

                // 5. 上移按钮
                const moveUpBtn = document.createElement('button');
                moveUpBtn.type = 'button';
                moveUpBtn.className = 'pet-chat-meta-btn';
                moveUpBtn.setAttribute('aria-label', '上移消息');
                moveUpBtn.setAttribute('title', '上移');
                moveUpBtn.textContent = '⬆️';
                moveUpBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                    if (messagesContainer && this.moveMessageUp) {
                        const allMessages = Array.from(messagesContainer.children).filter(msg =>
                            !msg.hasAttribute('data-welcome-message')
                        );
                        const currentIndex = allMessages.indexOf(messageDiv);
                        if (currentIndex > 0) {
                            await this.moveMessageUp(messageDiv, currentIndex);
                        }
                    }
                });
                metaActions.appendChild(moveUpBtn);

                // 6. 下移按钮
                const moveDownBtn = document.createElement('button');
                moveDownBtn.type = 'button';
                moveDownBtn.className = 'pet-chat-meta-btn';
                moveDownBtn.setAttribute('aria-label', '下移消息');
                moveDownBtn.setAttribute('title', '下移');
                moveDownBtn.textContent = '⬇️';
                moveDownBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                    if (messagesContainer && this.moveMessageDown) {
                        const allMessages = Array.from(messagesContainer.children).filter(msg =>
                            !msg.hasAttribute('data-welcome-message')
                        );
                        const currentIndex = allMessages.indexOf(messageDiv);
                        if (currentIndex >= 0 && currentIndex < allMessages.length - 1) {
                            await this.moveMessageDown(messageDiv, currentIndex);
                        }
                    }
                });
                metaActions.appendChild(moveDownBtn);

                // 7. 重新生成按钮（仅宠物消息）
                if (isPet) {
                    const regenerateBtn = document.createElement('button');
                    regenerateBtn.type = 'button';
                    regenerateBtn.className = 'pet-chat-meta-btn';
                    regenerateBtn.setAttribute('aria-label', '重新生成回复');
                    regenerateBtn.setAttribute('title', '重新生成');
                    regenerateBtn.textContent = '重新生成';
                    regenerateBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (this.regenerateMessage) {
                            await this.regenerateMessage(messageDiv);
                        }
                    });
                    metaActions.appendChild(regenerateBtn);
                }

                // 8. 删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'pet-chat-meta-btn';
                deleteBtn.setAttribute('aria-label', '删除消息');
                deleteBtn.setAttribute('title', '删除');
                deleteBtn.textContent = '🗑️';
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('确定删除这条消息吗？')) {
                        if (this.deleteMessage) {
                            await this.deleteMessage(messageDiv);
                        }
                    }
                });
                metaActions.appendChild(deleteBtn);
            }

            // 删除消息（与 YiWeb 一致）
            async deleteMessage(messageDiv) {
                if (!messageDiv || !this.currentSessionId) return;
                
                const session = this.sessions[this.currentSessionId];
                if (!session || !session.messages) return;

                const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                if (!messagesContainer) return;

                const allMessages = Array.from(messagesContainer.children).filter(msg =>
                    !msg.hasAttribute('data-welcome-message')
                );
                const index = allMessages.indexOf(messageDiv);
                
                if (index < 0 || index >= session.messages.length) return;

                // 删除消息（如果是用户消息，同时删除对应的宠物回复）
                const target = session.messages[index];
                const next = session.messages[index + 1];
                if (target && target.type !== 'pet' && next && next.type === 'pet') {
                    session.messages.splice(index, 2);
                } else {
                    session.messages.splice(index, 1);
                }

                session.updatedAt = Date.now();

                // 动画删除消息
                messageDiv.style.transition = 'opacity 0.3s ease';
                messageDiv.style.opacity = '0';
                setTimeout(() => {
                    messageDiv.remove();
                    // 保存会话
                    this.saveCurrentSession().then(() => {
                        if (this.syncSessionToBackend) {
                            this.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                                console.error('删除消息后同步到后端失败:', err);
                            });
                        }
                    }).catch(err => {
                        console.error('删除消息后保存会话失败:', err);
                    });
                }, 300);
            }

            // 重新发送消息（仅用户消息）
            async resendMessage(messageDiv) {
                if (!messageDiv || !this.currentSessionId) return;
                
                const session = this.sessions[this.currentSessionId];
                if (!session || !session.messages) return;

                const bubble = messageDiv.querySelector('.pet-chat-bubble');
                if (!bubble) return;

                const content = bubble.getAttribute('data-original-text') || '';
                const imageDataUrl = bubble.querySelector('.pet-chat-image')?.src || null;

                // 重新发送消息
                if (this.sendMessage) {
                    await this.sendMessage(content, imageDataUrl);
                }
            }

            // 重新生成消息（仅宠物消息）
            async regenerateMessage(messageDiv) {
                if (!messageDiv || !this.currentSessionId) return;
                
                const session = this.sessions[this.currentSessionId];
                if (!session || !session.messages) return;

                const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                if (!messagesContainer) return;

                const allMessages = Array.from(messagesContainer.children).filter(msg =>
                    !msg.hasAttribute('data-welcome-message')
                );
                const index = allMessages.indexOf(messageDiv);
                
                if (index < 0 || index >= session.messages.length) return;

                // 找到对应的用户消息
                let userMessageIndex = index - 1;
                while (userMessageIndex >= 0 && session.messages[userMessageIndex].type === 'pet') {
                    userMessageIndex--;
                }

                if (userMessageIndex < 0) return;

                const userMessage = session.messages[userMessageIndex];
                const userContent = userMessage.content || '';
                const userImageDataUrl = userMessage.imageDataUrl || null;

                // 删除当前的宠物回复
                session.messages.splice(index, 1);
                messageDiv.remove();

                // 重新发送用户消息以生成新的回复
                if (this.sendMessage) {
                    await this.sendMessage(userContent, userImageDataUrl);
                }
            }

            // 为消息添加导出图片按钮
            addExportButtonForMessage(buttonContainer, messageDiv, messageType) {
                if (!buttonContainer || !messageDiv) {
                    return;
                }

                // 检查是否已经存在导出按钮
                if (buttonContainer.querySelector('.export-message-button')) {
                    return;
                }

                // 创建导出按钮
                const exportBtn = document.createElement('button');
                exportBtn.className = 'export-message-button';
                // 使用 SVG 图标替代 emoji，更专业美观
                exportBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
                exportBtn.title = '导出消息为图片';
                // 与 YiWeb 保持一致，同时保持向后兼容
                exportBtn.className = 'pet-chat-meta-btn chat-message-action-btn';

                // 点击事件
                exportBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // 调用导出函数
                    if (window.exportSingleMessageToPNG) {
                        await window.exportSingleMessageToPNG(messageDiv, messageType);
                    } else {
                        console.error('导出函数未加载');
                        const exportError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
                            ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
                            : '导出功能未加载';
                        this.showNotification(exportError, 'error');
                    }
                });

                // 将按钮添加到容器中（在编辑按钮后面）
                buttonContainer.appendChild(exportBtn);
            }

            // 创建打字指示器（有趣的等待动画）
            createTypingIndicator() {
                const currentColor = this.colors[this.colorIndex];

                // 获取第一个聊天下面第一个按钮的图标
                let indicatorIcon = '🐾'; // 默认图标
                if (this.chatWindow) {
                    const welcomeActions = this.chatWindow.querySelector('#pet-welcome-actions');
                    if (welcomeActions) {
                        const firstButton = welcomeActions.querySelector('[data-action-key]');
                        if (firstButton && firstButton.innerHTML) {
                            indicatorIcon = firstButton.innerHTML.trim();
                        }
                    }
                }

                const messageDiv = document.createElement('div');
                messageDiv.setAttribute('data-typing-indicator', 'true');
                messageDiv.className = 'chat-message';

                const avatar = document.createElement('div');
                avatar.className = 'chat-message-typing-avatar';
                avatar.style.setProperty('background', currentColor, 'important');

                avatar.textContent = indicatorIcon;
                avatar.setAttribute('data-message-type', 'pet-avatar');

                const content = document.createElement('div');
                content.className = 'chat-message-content';

                const messageText = document.createElement('div');
                messageText.className = 'chat-message-typing-bubble';
                messageText.style.setProperty('background', currentColor, 'important');

                messageText.setAttribute('data-message-type', 'pet-bubble');
                messageText.textContent = '💭 正在思考中...';

                const messageTime = document.createElement('div');
                messageTime.className = 'chat-message-typing-time';

                content.appendChild(messageText);
                content.appendChild(messageTime);
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(content);

                return messageDiv;
            }

            // 添加复制按钮的辅助方法
            addCopyButton(container, messageTextElement) {
                // 如果已经有复制按钮，就不再添加
                if (container.querySelector('.copy-button')) {
                    return;
                }

                // 检查是否已经有编辑按钮（说明之前已经添加过其他按钮）
                const hasEditButton = container.querySelector('.edit-button');
                const hasDeleteButton = container.querySelector('.delete-button');

                // 创建复制按钮 - 与 YiWeb 保持一致
                const copyButton = document.createElement('button');
                // 与 YiWeb 保持一致，同时保持向后兼容
                copyButton.className = 'pet-chat-meta-btn copy-button';
                copyButton.innerHTML = '📋';
                copyButton.setAttribute('title', '复制消息');
                copyButton.setAttribute('aria-label', '复制消息');

                // 点击复制
                copyButton.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    try {
                        // 获取消息的原始文本内容
                        // 首先尝试从传入的元素获取
                        let messageContent = messageTextElement.getAttribute('data-original-text') ||
                            messageTextElement.innerText ||
                            messageTextElement.textContent || '';

                        // 如果获取不到内容，尝试从消息容器中查找气泡元素
                        if (!messageContent || !messageContent.trim()) {
                            const messageDiv = container.closest('[style*="margin-bottom: 15px"]') ||
                                container.closest('[data-message-type]')?.parentElement ||
                                container.parentElement?.parentElement;

                            if (messageDiv) {
                                const petBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                                const userBubble = messageDiv.querySelector('[data-message-type="user-bubble"]');
                                const messageBubble = petBubble || userBubble;

                                if (messageBubble) {
                                    messageContent = messageBubble.getAttribute('data-original-text') ||
                                        messageBubble.innerText ||
                                        messageBubble.textContent || '';
                                }
                            }
                        }

                        if (!messageContent || !messageContent.trim()) {
                            this.showNotification('消息内容为空，无法复制', 'error');
                            return;
                        }

                        // 使用 Clipboard API 复制文本
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(messageContent.trim());
                            this.showNotification('已复制到剪贴板', 'success');

                            // 临时改变按钮图标，表示复制成功
                            const originalHTML = copyButton.innerHTML;
                            copyButton.innerHTML = '✓';
                            copyButton.classList.add('copy-button-success');
                            setTimeout(() => {
                                copyButton.innerHTML = originalHTML;
                                copyButton.classList.remove('copy-button-success');
                            }, 1000);
                        } else {
                            // 降级方案：使用传统的复制方法
                            const textArea = document.createElement('textarea');
                            textArea.value = messageContent.trim();
                            textArea.className = 'clipboard-textarea-hidden';
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            this.showNotification('已复制到剪贴板', 'success');

                            // 临时改变按钮图标，表示复制成功
                            const originalHTML = copyButton.innerHTML;
                            copyButton.innerHTML = '✓';
                            copyButton.classList.add('copy-button-success');
                            setTimeout(() => {
                                copyButton.innerHTML = originalHTML;
                                copyButton.classList.remove('copy-button-success');
                            }, 1000);
                        }
                    } catch (error) {
                        console.error('复制失败:', error);
                        this.showNotification('复制失败，请重试', 'error');
                    }
                });

                // 创建编辑按钮（仅对宠物消息显示）
                const isPetMessage = messageTextElement.closest('[data-message-type="pet-bubble"]');

                // 如果已经有编辑和删除按钮，只添加复制按钮
                if (hasEditButton && hasDeleteButton) {
                    // 在编辑按钮之前插入复制按钮
                    container.insertBefore(copyButton, hasEditButton);
                } else {
                    // 如果没有其他按钮，创建完整的按钮组
                    // 创建删除按钮 - 与 YiWeb 保持一致
                    const deleteButton = document.createElement('button');
                    // 与 YiWeb 保持一致，同时保持向后兼容
                    deleteButton.className = 'pet-chat-meta-btn delete-button';
                    deleteButton.innerHTML = '🗑️';
                    deleteButton.setAttribute('title', '删除消息');
                    deleteButton.setAttribute('aria-label', '删除消息');

                    // 点击删除
                    deleteButton.addEventListener('click', async (e) => {
                        e.stopPropagation();

                        // 防止重复点击
                        if (deleteButton.disabled || deleteButton.dataset.deleting === 'true') {
                            return;
                        }

                        // 确认删除
                        if (!confirm('确定要删除这条消息吗？')) {
                            return;
                        }

                        // 标记为正在删除
                        deleteButton.disabled = true;
                        deleteButton.dataset.deleting = 'true';
                        const originalHTML = deleteButton.innerHTML;
                        deleteButton.innerHTML = '...';
                        deleteButton.classList.add('delete-button-deleting');

                        try {
                            // 找到包含删除按钮容器的消息元素
                            // 通过查找包含 data-message-type 属性的父元素来定位消息元素
                            // 同时确保找到的是包含头像的完整消息容器（messageDiv）
                            let currentMessage = container.parentElement;
                            let foundMessageDiv = null;

                            while (currentMessage &&
                                currentMessage !== document.body &&
                                currentMessage !== document.documentElement) {
                                // 检查是否包含消息气泡
                                const hasBubble = currentMessage.querySelector('[data-message-type="user-bubble"]') ||
                                    currentMessage.querySelector('[data-message-type="pet-bubble"]');

                                if (hasBubble) {
                                    // 检查是否包含头像（通过检查子元素中是否有包含 👤 或 🐾 的元素）
                                    // messageDiv 的结构：messageDiv > avatar + content
                                    // avatar 是 messageDiv 的直接子元素，包含 👤 或 🐾
                                    const children = Array.from(currentMessage.children);
                                    const hasAvatar = children.some(child => {
                                        const text = child.textContent || '';
                                        return text.includes('👤') || text.includes('🐾');
                                    });

                                    // 如果同时包含气泡和头像，说明找到了完整的 messageDiv
                                    if (hasAvatar) {
                                        foundMessageDiv = currentMessage;
                                        break;
                                    }
                                }

                                currentMessage = currentMessage.parentElement;
                            }

                            // 如果没找到包含头像的 messageDiv，回退到只包含气泡的元素
                            if (!foundMessageDiv && currentMessage) {
                                // 继续向上查找，找到包含头像的父元素
                                let parentElement = currentMessage.parentElement;
                                while (parentElement &&
                                    parentElement !== document.body &&
                                    parentElement !== document.documentElement) {
                                    const children = Array.from(parentElement.children);
                                    const hasAvatar = children.some(child => {
                                        const text = child.textContent || '';
                                        return text.includes('👤') || text.includes('🐾');
                                    });
                                    const hasBubble = parentElement.querySelector('[data-message-type="user-bubble"]') ||
                                        parentElement.querySelector('[data-message-type="pet-bubble"]');
                                    if (hasAvatar && hasBubble) {
                                        foundMessageDiv = parentElement;
                                        break;
                                    }
                                    parentElement = parentElement.parentElement;
                                }
                            }

                            currentMessage = foundMessageDiv || currentMessage;

                            if (!currentMessage) {
                                console.warn('无法找到消息元素');
                                // 恢复按钮状态
                                deleteButton.disabled = false;
                                deleteButton.dataset.deleting = 'false';
                                deleteButton.innerHTML = originalHTML;
                                deleteButton.style.opacity = '';
                                return;
                            }

                            // 从会话中删除对应的消息
                            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                                const session = this.sessions[this.currentSessionId];
                                if (session.messages && Array.isArray(session.messages)) {
                                    // 使用改进的消息匹配方法
                                    const messageResult = this.findMessageObjectByDiv(currentMessage);

                                    if (messageResult && messageResult.index !== undefined && messageResult.index >= 0) {
                                        // 从本地会话中删除消息
                                        session.messages.splice(messageResult.index, 1);
                                        session.updatedAt = Date.now();

                                        console.log(`已从会话 ${this.currentSessionId} 中删除消息，剩余 ${session.messages.length} 条消息`);

                                        // 动画删除消息
                                        currentMessage.style.transition = 'opacity 0.3s ease';
                                        currentMessage.style.opacity = '0';
                                        setTimeout(() => {
                                            currentMessage.remove();
                                            // 删除后保存会话并同步到后端（确保数据同步）
                                            this.saveCurrentSession().then(() => {
                                                // 同步到后端，调用 /session/save 接口
                                                if (this.currentSessionId) {
                                                    this.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                                                        console.error('删除消息后同步到后端失败:', err);
                                                    });
                                                }
                                            }).catch(err => {
                                                console.error('删除消息后保存会话失败:', err);
                                            });
                                        }, 300);
                                    } else {
                                        console.warn('无法找到对应的消息对象，尝试通过DOM索引删除');
                                        // 如果找不到消息对象，尝试通过DOM索引来删除
                                        const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                                        if (messagesContainer) {
                                            const allMessageDivs = Array.from(messagesContainer.children).filter(div => {
                                                return !div.hasAttribute('data-welcome-message') &&
                                                    (div.querySelector('[data-message-type="user-bubble"]') ||
                                                        div.querySelector('[data-message-type="pet-bubble"]'));
                                            });
                                            const domIndex = allMessageDivs.indexOf(currentMessage);
                                            if (domIndex >= 0 && domIndex < session.messages.length) {
                                                // 通过DOM索引删除消息
                                                session.messages.splice(domIndex, 1);
                                                session.updatedAt = Date.now();
                                                console.log(`已通过DOM索引从会话 ${this.currentSessionId} 中删除消息，剩余 ${session.messages.length} 条消息`);

                                                // 动画删除消息
                                                currentMessage.classList.add('chat-message--fading-out');
                                                setTimeout(() => {
                                                    currentMessage.remove();
                                                    // 删除后保存会话并同步到后端（确保数据同步）
                                                    this.saveCurrentSession().then(() => {
                                                        // 同步到后端，调用 /session/save 接口
                                                        if (this.currentSessionId) {
                                                            this.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                                                                console.error('删除消息后同步到后端失败:', err);
                                                            });
                                                        }
                                                    }).catch(err => {
                                                        console.error('删除消息后保存会话失败:', err);
                                                    });
                                                }, 300);
                                            } else {
                                                // 即使找不到消息对象，也尝试删除DOM元素
                                                currentMessage.classList.add('chat-message--fading-out');
                                                setTimeout(() => {
                                                    currentMessage.remove();
                                                }, 300);
                                            }
                                        } else {
                                            // 即使找不到消息对象，也尝试删除DOM元素
                                            currentMessage.classList.add('chat-message--fading-out');
                                            setTimeout(() => {
                                                currentMessage.remove();
                                            }, 300);
                                        }
                                    }
                                }
                            } else {
                                // 如果没有会话，直接删除DOM元素
                                currentMessage.classList.add('chat-message--fading-out');
                                setTimeout(() => {
                                    currentMessage.remove();
                                }, 300);
                            }
                        } catch (error) {
                            console.error('删除消息时发生错误:', error);
                        } finally {
                            // 恢复按钮状态
                            if (deleteButton.isConnected) {
                                deleteButton.disabled = false;
                                deleteButton.dataset.deleting = 'false';
                                deleteButton.innerHTML = originalHTML;
                                deleteButton.classList.remove('delete-button-deleting');
                            }
                        }
                    });

                    // 创建编辑按钮（用户消息和宠物消息都显示）- 与 YiWeb 保持一致
                    const editButton = document.createElement('button');
                    // 与 YiWeb 保持一致，同时保持向后兼容
                    editButton.className = 'pet-chat-meta-btn edit-button';
                    editButton.innerHTML = '✏️';
                    editButton.setAttribute('title', '编辑消息');
                    editButton.setAttribute('aria-label', '编辑消息');

                    // 点击编辑 - 打开弹窗编辑器
                    editButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const messageType = isPetMessage ? 'pet' : 'user';
                        this.openMessageEditor(messageTextElement, messageType);
                    });

                    // 清空容器并添加所有按钮
                    container.innerHTML = '';
                    container.appendChild(copyButton);
                    container.appendChild(editButton);
                    container.appendChild(deleteButton);
                }

                container.classList.add('chat-message-buttons-container');
            }

            // 添加排序按钮（上移和下移）
            addSortButtons(container, messageDiv) {
                // 如果已经有排序按钮，就不再添加
                if (container.querySelector('.sort-up-button') || container.querySelector('.sort-down-button')) {
                    return;
                }

                const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                if (!messagesContainer) return;

                // 获取所有消息元素（排除欢迎消息）
                const allMessages = Array.from(messagesContainer.children).filter(msg =>
                    !msg.hasAttribute('data-welcome-message')
                );
                const currentIndex = allMessages.indexOf(messageDiv);

                // 创建上移按钮
                const sortUpButton = document.createElement('button');
                sortUpButton.className = 'sort-up-button chat-message-sort-btn';
                if (currentIndex <= 0) {
                    sortUpButton.classList.add('chat-message-sort-btn--disabled');
                }
                sortUpButton.innerHTML = '⬆️';
                sortUpButton.setAttribute('title', '上移消息');

                // 点击上移
                sortUpButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (currentIndex > 0) {
                        await this.moveMessageUp(messageDiv, currentIndex);
                    }
                });

                // 创建下移按钮
                const sortDownButton = document.createElement('button');
                sortDownButton.className = 'sort-down-button chat-message-sort-btn';
                if (currentIndex >= allMessages.length - 1) {
                    sortDownButton.classList.add('chat-message-sort-btn--disabled');
                }
                sortDownButton.innerHTML = '⬇️';
                sortDownButton.setAttribute('title', '下移消息');

                // 点击下移
                sortDownButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (currentIndex < allMessages.length - 1) {
                        await this.moveMessageDown(messageDiv, currentIndex);
                    }
                });

                // 将排序按钮添加到容器中（在复制按钮之前）
                const copyButton = container.querySelector('.copy-button');
                if (copyButton) {
                    container.insertBefore(sortUpButton, copyButton);
                    container.insertBefore(sortDownButton, copyButton);
                } else {
                    // 如果没有复制按钮，直接添加到容器末尾
                    container.appendChild(sortUpButton);
                    container.appendChild(sortDownButton);
                }
            }

            // 上移消息
            async moveMessageUp(messageDiv, currentIndex) {
                const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                if (!messagesContainer || !this.currentSessionId) return;

                // 获取所有消息元素（排除欢迎消息）
                const allMessages = Array.from(messagesContainer.children).filter(msg =>
                    !msg.hasAttribute('data-welcome-message')
                );

                if (currentIndex <= 0 || currentIndex >= allMessages.length) return;

                const previousMessage = allMessages[currentIndex - 1];

                // 在DOM中交换位置
                messageDiv.style.transition = 'transform 0.3s ease';
                previousMessage.style.transition = 'transform 0.3s ease';

                // 使用 insertBefore 交换位置
                messagesContainer.insertBefore(messageDiv, previousMessage);

                // 更新会话中的消息顺序
                const session = this.sessions[this.currentSessionId];
                if (session && session.messages && Array.isArray(session.messages)) {
                    // 交换数组中的位置
                    const temp = session.messages[currentIndex];
                    session.messages[currentIndex] = session.messages[currentIndex - 1];
                    session.messages[currentIndex - 1] = temp;

                    session.updatedAt = Date.now();

                    // 保存会话
                    await this.saveAllSessions();

                    // 同步到后端
                    if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                        await this.syncSessionToBackend(this.currentSessionId, true);
                    }

                    // 更新所有消息的排序按钮状态
                    setTimeout(() => {
                        this.updateAllSortButtons();
                    }, 100);
                }
            }

            // 下移消息
            async moveMessageDown(messageDiv, currentIndex) {
                const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                if (!messagesContainer || !this.currentSessionId) return;

                // 获取所有消息元素（排除欢迎消息）
                const allMessages = Array.from(messagesContainer.children).filter(msg =>
                    !msg.hasAttribute('data-welcome-message')
                );

                if (currentIndex < 0 || currentIndex >= allMessages.length - 1) return;

                const nextMessage = allMessages[currentIndex + 1];

                // 在DOM中交换位置
                messageDiv.style.transition = 'transform 0.3s ease';
                nextMessage.style.transition = 'transform 0.3s ease';

                // 使用 insertBefore 交换位置（将当前消息插入到下一个消息之后）
                // 先移除当前消息，然后插入到下一个消息之后
                messageDiv.remove();
                if (nextMessage.nextSibling) {
                    messagesContainer.insertBefore(messageDiv, nextMessage.nextSibling);
                } else {
                    messagesContainer.appendChild(messageDiv);
                }

                // 更新会话中的消息顺序
                const session = this.sessions[this.currentSessionId];
                if (session && session.messages && Array.isArray(session.messages)) {
                    // 交换数组中的位置
                    const temp = session.messages[currentIndex];
                    session.messages[currentIndex] = session.messages[currentIndex + 1];
                    session.messages[currentIndex + 1] = temp;

                    session.updatedAt = Date.now();

                    // 保存会话
                    await this.saveAllSessions();

                    // 同步到后端
                    if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                        await this.syncSessionToBackend(this.currentSessionId, true);
                    }

                    // 更新所有消息的排序按钮状态
                    setTimeout(() => {
                        this.updateAllSortButtons();
                    }, 100);
                }
            }

            // 更新所有消息的排序按钮状态
            updateAllSortButtons() {
                const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                if (!messagesContainer) return;

                // 获取所有消息元素（排除欢迎消息）
                const allMessages = Array.from(messagesContainer.children).filter(msg =>
                    !msg.hasAttribute('data-welcome-message')
                );

                allMessages.forEach((messageDiv, index) => {
                    const copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
                    if (!copyButtonContainer) return;

                    const sortUpButton = copyButtonContainer.querySelector('.sort-up-button');
                    const sortDownButton = copyButtonContainer.querySelector('.sort-down-button');

                    if (sortUpButton) {
                        const canMoveUp = index > 0;
                        if (canMoveUp) {
                            sortUpButton.classList.remove('chat-message-sort-btn--disabled');
                        } else {
                            sortUpButton.classList.add('chat-message-sort-btn--disabled');
                        }
                    }

                    if (sortDownButton) {
                        const canMoveDown = index < allMessages.length - 1;
                        if (canMoveDown) {
                            sortDownButton.classList.remove('chat-message-sort-btn--disabled');
                        } else {
                            sortDownButton.classList.add('chat-message-sort-btn--disabled');
                        }
                    }
                });
            }

            /**
             * 查找与宠物消息对应的用户消息
             * @param {HTMLElement} messageDiv - 宠物消息元素
             * @param {HTMLElement} messagesContainer - 消息容器
             * @returns {string|null} 用户消息文本，如果未找到则返回 null
             */
            _findUserMessageForRetry(messageDiv, messagesContainer) {
                const allMessages = Array.from(messagesContainer.children);
                const currentIndex = allMessages.indexOf(messageDiv);

                if (currentIndex === -1) {
                    throw new Error('当前消息不在消息容器中');
                }

                // 向前遍历所有消息，找到最近的用户消息
                for (let i = currentIndex - 1; i >= 0; i--) {
                    const messageElement = allMessages[i];
                    const userBubble = messageElement.querySelector('[data-message-type="user-bubble"]');

                    if (userBubble) {
                        // 优先使用 data-original-text，如果没有则使用文本内容
                        const userMessageText = userBubble.getAttribute('data-original-text') ||
                            userBubble.textContent ||
                            userBubble.innerText;

                        if (userMessageText && userMessageText.trim()) {
                            return userMessageText.trim();
                        }
                    }
                }

                return null;
            }

            /**
             * 获取等待图标（从欢迎动作按钮中获取）
             * @returns {string} 等待图标
             */
            _getWaitingIcon() {
                if (this.chatWindow) {
                    const welcomeActions = this.chatWindow.querySelector('#pet-welcome-actions');
                    if (welcomeActions) {
                        const firstButton = welcomeActions.querySelector('[data-action-key]');
                        if (firstButton && firstButton.innerHTML) {
                            return firstButton.innerHTML.trim();
                        }
                    }
                }
                return '⏳'; // 默认图标
            }

            /**
             * 更新重新生成按钮的状态
             * @param {HTMLElement} button - 按钮元素
             * @param {string} state - 状态: 'idle' | 'loading' | 'success' | 'error'
             */
            _updateTryAgainButtonState(button, state) {
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

                // 移除所有状态类
                button.classList.remove('try-again-button--loading', 'try-again-button--success', 'try-again-button--error');

                // 添加当前状态类
                if (state !== 'idle') {
                    button.classList.add(`try-again-button--${state}`);
                }

                // 清理可能存在的内联样式
                button.style.opacity = '';
                button.style.cursor = '';
                button.style.color = '';
            }

            /**
             * 更新请求状态（loading/idle）
             * @param {string} status - 状态: 'loading' | 'idle'
             * @param {AbortController|null} abortController - 中止控制器
             */
            _updateRequestStatus(status, abortController = null) {
                if (this.chatWindow) {
                    if (this.chatWindow._setAbortController) {
                        this.chatWindow._setAbortController(abortController);
                    }
                    if (this.chatWindow._updateRequestStatus) {
                        this.chatWindow._updateRequestStatus(status);
                    }
                }
            }

            /**
             * 创建流式内容更新回调
             * @param {HTMLElement} messageBubble - 消息气泡元素
             * @param {HTMLElement} messagesContainer - 消息容器
             * @param {HTMLElement} messageDiv - 消息容器元素（可选，用于添加 is-streaming 类）
             * @returns {Function} 内容更新回调函数
             */
            _createStreamContentCallback(messageBubble, messagesContainer, messageDiv = null) {
                let fullContent = '';

                // 添加流式消息状态类（与 YiWeb 保持一致）
                if (messageDiv) {
                    messageDiv.classList.add('is-streaming');
                }

                return (chunk, accumulatedContent) => {
                    fullContent = accumulatedContent;
                    
                    // 确保内容容器存在且具有正确的类名（与 YiWeb 保持一致）
                    let contentDiv = messageBubble.querySelector('.pet-chat-content');
                    if (!contentDiv) {
                        // 如果不存在，创建内容容器
                        contentDiv = document.createElement('div');
                        contentDiv.className = 'pet-chat-content md-preview-body pet-chat-content-streaming';
                        // 移除现有的 typing 指示器
                        const typingDiv = messageBubble.querySelector('.pet-chat-typing');
                        if (typingDiv) {
                            typingDiv.remove();
                        }
                        messageBubble.appendChild(contentDiv);
                    } else {
                        // 确保有 streaming 类
                        if (!contentDiv.classList.contains('pet-chat-content-streaming')) {
                            contentDiv.classList.add('pet-chat-content-streaming');
                        }
                    }
                    
                    // 更新内容
                    contentDiv.innerHTML = this.renderMarkdown(fullContent);
                    messageBubble.setAttribute('data-original-text', fullContent);

                    // 处理可能的 Mermaid 图表
                    if (messageBubble._mermaidTimeout) {
                        clearTimeout(messageBubble._mermaidTimeout);
                    }
                    messageBubble._mermaidTimeout = setTimeout(async () => {
                        try {
                            await this.loadMermaid();
                            const hasMermaidCode = contentDiv.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                            if (hasMermaidCode) {
                                await this.processMermaidBlocks(contentDiv);
                            }
                        } catch (error) {
                            console.error('处理 Mermaid 图表时出错:', error);
                        }
                        messageBubble._mermaidTimeout = null;
                    }, 500);

                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                    return fullContent;
                };
            }

            /**
             * 执行重新生成回复的核心逻辑
             * @param {HTMLElement} messageDiv - 宠物消息元素
             * @param {string} userMessageText - 用户消息文本
             * @param {HTMLElement} messagesContainer - 消息容器
             * @returns {Promise<string>} 生成的回复内容
             */
            async _retryGenerateResponse(messageDiv, userMessageText, messagesContainer) {
                const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                if (!messageBubble) {
                    throw new Error('未找到消息气泡');
                }

                const waitingIcon = this._getWaitingIcon();
                // 清除现有内容，准备重新生成
                const contentDiv = messageBubble.querySelector('.pet-chat-content');
                if (contentDiv) {
                    contentDiv.innerHTML = this.renderMarkdown(`${waitingIcon} 正在重新生成回复...`);
                } else {
                    messageBubble.innerHTML = this.renderMarkdown(`${waitingIcon} 正在重新生成回复...`);
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // 创建流式内容更新回调（传入 messageDiv 以支持 is-streaming 类）
                const onStreamContent = this._createStreamContentCallback(messageBubble, messagesContainer, messageDiv);

                // 创建 AbortController 用于终止请求
                const abortController = new AbortController();
                this._updateRequestStatus('loading', abortController);

                try {
                    // 调用 API 重新生成
                    const reply = await this.generatePetResponseStream(userMessageText, onStreamContent, abortController);

                    // 移除流式消息状态类（与 YiWeb 保持一致）
                    messageDiv.classList.remove('is-streaming');
                    const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
                    if (finalContentDiv) {
                        finalContentDiv.classList.remove('pet-chat-content-streaming');
                    }

                    // 确保最终内容被显示（流式更新可能已经完成，但再次确认）
                    if (reply && reply.trim()) {
                        const finalDiv = messageBubble.querySelector('.pet-chat-content');
                        if (finalDiv) {
                            finalDiv.innerHTML = this.renderMarkdown(reply);
                        } else {
                            messageBubble.innerHTML = this.renderMarkdown(reply);
                        }
                        messageBubble.setAttribute('data-original-text', reply);
                        setTimeout(async () => {
                            const targetDiv = messageBubble.querySelector('.pet-chat-content') || messageBubble;
                            await this.processMermaidBlocks(targetDiv);
                        }, 100);
                    }

                    // 更新复制按钮
                    const copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
                    if (copyButtonContainer && reply && reply.trim()) {
                        this.addCopyButton(copyButtonContainer, messageBubble);
                    }

                    messagesContainer.scrollTop = messagesContainer.scrollHeight;

                    return reply;
                } catch (error) {
                    // 移除流式消息状态类（确保即使出错也能清理）
                    messageDiv.classList.remove('is-streaming');
                    const errorContentDiv = messageBubble.querySelector('.pet-chat-content');
                    if (errorContentDiv) {
                        errorContentDiv.classList.remove('pet-chat-content-streaming');
                    }
                    throw error;
                } finally {
                    // 确保移除流式状态类
                    messageDiv.classList.remove('is-streaming');
                    const finalContentDiv = messageBubble.querySelector('.pet-chat-content');
                    if (finalContentDiv) {
                        finalContentDiv.classList.remove('pet-chat-content-streaming');
                    }
                    this._updateRequestStatus('idle', null);
                }
            }

            /**
             * 处理重新生成失败的情况
             * @param {HTMLElement} messageDiv - 宠物消息元素
             * @param {Error} error - 错误对象
             */
            _handleRetryError(messageDiv, error) {
                const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                if (!isAbortError) {
                    console.error('重新生成回复失败:', error);

                    const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        const originalText = messageBubble.getAttribute('data-original-text') ||
                            '抱歉，重新生成失败，请稍后重试。';
                        messageBubble.innerHTML = this.renderMarkdown(originalText);
                    }
                }

                return isAbortError;
            }

            /**
             * 为宠物消息添加重新生成按钮
             * @param {HTMLElement} container - 按钮容器
             * @param {HTMLElement} messageDiv - 宠物消息元素
             */

            // 为用户消息添加删除和编辑按钮
            addDeleteButtonForUserMessage(container, messageTextElement) {
                // 如果已经添加过，就不再添加
                if (container.querySelector('.delete-button') &&
                    container.querySelector('.edit-button') &&
                    container.querySelector('.resend-button')) {
                    return;
                }

                const deleteButton = document.createElement('button');
                // 与 YiWeb 保持一致，同时保持向后兼容
                deleteButton.className = 'pet-chat-meta-btn delete-button';
                deleteButton.innerHTML = '🗑️';
                deleteButton.setAttribute('title', '删除消息');
                deleteButton.setAttribute('aria-label', '删除消息');

                // 点击删除
                deleteButton.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    // 防止重复点击
                    if (deleteButton.disabled || deleteButton.dataset.deleting === 'true') {
                        return;
                    }

                    // 确认删除
                    if (!confirm('确定要删除这条消息吗？')) {
                        return;
                    }

                    // 标记为正在删除
                    deleteButton.disabled = true;
                    deleteButton.dataset.deleting = 'true';
                    const originalHTML = deleteButton.innerHTML;
                    deleteButton.innerHTML = '...';
                    deleteButton.style.opacity = '0.5';

                    try {
                        // 找到包含删除按钮容器的消息元素
                        // 通过查找包含 data-message-type 属性的父元素来定位消息元素
                        // 同时确保找到的是包含头像的完整消息容器（messageDiv）
                        let currentMessage = container.parentElement;
                        let foundMessageDiv = null;

                        while (currentMessage &&
                            currentMessage !== document.body &&
                            currentMessage !== document.documentElement) {
                            // 检查是否包含消息气泡
                            const hasBubble = currentMessage.querySelector('[data-message-type="user-bubble"]') ||
                                currentMessage.querySelector('[data-message-type="pet-bubble"]');

                            if (hasBubble) {
                                // 检查是否包含头像（通过检查子元素中是否有包含 👤 或 🐾 的元素）
                                // messageDiv 的结构：messageDiv > avatar + content
                                // avatar 是 messageDiv 的直接子元素，包含 👤 或 🐾
                                const children = Array.from(currentMessage.children);
                                const hasAvatar = children.some(child => {
                                    const text = child.textContent || '';
                                    return text.includes('👤') || text.includes('🐾');
                                });

                                // 如果同时包含气泡和头像，说明找到了完整的 messageDiv
                                if (hasAvatar) {
                                    foundMessageDiv = currentMessage;
                                    break;
                                }
                            }

                            currentMessage = currentMessage.parentElement;
                        }

                        // 如果没找到包含头像的 messageDiv，回退到只包含气泡的元素
                        if (!foundMessageDiv && currentMessage) {
                            // 继续向上查找，找到包含头像的父元素
                            let parentElement = currentMessage.parentElement;
                            while (parentElement &&
                                parentElement !== document.body &&
                                parentElement !== document.documentElement) {
                                const children = Array.from(parentElement.children);
                                const hasAvatar = children.some(child => {
                                    const text = child.textContent || '';
                                    return text.includes('👤') || text.includes('🐾');
                                });
                                const hasBubble = parentElement.querySelector('[data-message-type="user-bubble"]') ||
                                    parentElement.querySelector('[data-message-type="pet-bubble"]');
                                if (hasAvatar && hasBubble) {
                                    foundMessageDiv = parentElement;
                                    break;
                                }
                                parentElement = parentElement.parentElement;
                            }
                        }

                        currentMessage = foundMessageDiv || currentMessage;

                        if (!currentMessage) {
                            console.warn('无法找到消息元素');
                            // 恢复按钮状态
                            deleteButton.disabled = false;
                            deleteButton.dataset.deleting = 'false';
                            deleteButton.innerHTML = originalHTML;
                            deleteButton.style.opacity = '';
                            return;
                        }

                        // 从会话中删除对应的消息
                        if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                            const session = this.sessions[this.currentSessionId];
                            if (session.messages && Array.isArray(session.messages)) {
                                // 使用改进的消息匹配方法
                                const messageResult = this.findMessageObjectByDiv(currentMessage);

                                if (messageResult && messageResult.index !== undefined && messageResult.index >= 0) {
                                    // 从本地会话中删除消息
                                    session.messages.splice(messageResult.index, 1);
                                    session.updatedAt = Date.now();

                                    console.log(`已从会话 ${this.currentSessionId} 中删除消息，剩余 ${session.messages.length} 条消息`);

                                    // 动画删除消息
                                    currentMessage.style.transition = 'opacity 0.3s ease';
                                    currentMessage.style.opacity = '0';
                                    setTimeout(() => {
                                        currentMessage.remove();
                                        // 删除后保存会话并同步到后端（确保数据同步）
                                        this.saveCurrentSession().then(() => {
                                            // 同步到后端
                                            if (this.isChatOpen && this.currentSessionId && this.sessionManager && this.sessionManager.enableBackendSync) {
                                                this.sessionManager.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                                                    console.error('删除消息后同步到后端失败:', err);
                                                });
                                            }
                                        }).catch(err => {
                                            console.error('删除消息后保存会话失败:', err);
                                        });
                                    }, 300);
                                } else {
                                    console.warn('无法找到对应的消息对象，尝试通过DOM索引删除');
                                    // 如果找不到消息对象，尝试通过DOM索引来删除
                                    const messagesContainer = this.chatWindow?.querySelector('#pet-chat-messages');
                                    if (messagesContainer) {
                                        const allMessageDivs = Array.from(messagesContainer.children).filter(div => {
                                            return !div.hasAttribute('data-welcome-message') &&
                                                (div.querySelector('[data-message-type="user-bubble"]') ||
                                                    div.querySelector('[data-message-type="pet-bubble"]'));
                                        });
                                        const domIndex = allMessageDivs.indexOf(currentMessage);
                                        if (domIndex >= 0 && domIndex < session.messages.length) {
                                            // 通过DOM索引删除消息
                                            session.messages.splice(domIndex, 1);
                                            session.updatedAt = Date.now();
                                            console.log(`已通过DOM索引从会话 ${this.currentSessionId} 中删除消息，剩余 ${session.messages.length} 条消息`);

                                            // 动画删除消息
                                            currentMessage.style.transition = 'opacity 0.3s ease';
                                            currentMessage.style.opacity = '0';
                                            setTimeout(() => {
                                                currentMessage.remove();
                                                // 删除后保存会话并同步到后端（确保数据同步）
                                                this.saveCurrentSession().then(() => {
                                                    // 同步到后端
                                                    if (this.isChatOpen && this.currentSessionId && this.sessionManager && this.sessionManager.enableBackendSync) {
                                                        this.sessionManager.syncSessionToBackend(this.currentSessionId, true).catch(err => {
                                                            console.error('删除消息后同步到后端失败:', err);
                                                        });
                                                    }
                                                }).catch(err => {
                                                    console.error('删除消息后保存会话失败:', err);
                                                });
                                            }, 300);
                                        } else {
                                            // 即使找不到消息对象，也尝试删除DOM元素
                                            currentMessage.style.transition = 'opacity 0.3s ease';
                                            currentMessage.style.opacity = '0';
                                            setTimeout(() => {
                                                currentMessage.remove();
                                            }, 300);
                                        }
                                    } else {
                                        // 即使找不到消息对象，也尝试删除DOM元素
                                        currentMessage.style.transition = 'opacity 0.3s ease';
                                        currentMessage.style.opacity = '0';
                                        setTimeout(() => {
                                            currentMessage.remove();
                                        }, 300);
                                    }
                                }
                            }
                        } else {
                            // 如果没有会话，直接删除DOM元素
                            currentMessage.style.transition = 'opacity 0.3s ease';
                            currentMessage.style.opacity = '0';
                            setTimeout(() => {
                                currentMessage.remove();
                            }, 300);
                        }
                    } catch (error) {
                        console.error('删除消息时发生错误:', error);
                    } finally {
                        // 恢复按钮状态
                        if (deleteButton.isConnected) {
                            deleteButton.disabled = false;
                            deleteButton.dataset.deleting = 'false';
                            deleteButton.innerHTML = originalHTML;
                            deleteButton.style.opacity = '';
                        }
                    }
                });

                // 创建编辑按钮
                const editButton = document.createElement('button');
                editButton.className = 'edit-button';
                editButton.innerHTML = '✏️';
                editButton.setAttribute('title', '编辑消息');

                // 点击编辑 - 打开弹窗编辑器（类似上下文编辑器，与宠物消息保持一致）
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (messageTextElement) {
                        this.openMessageEditor(messageTextElement, 'user');
                    }
                });

                // 创建重新发送按钮
                const resendButton = document.createElement('button');
                // 与 YiWeb 保持一致，同时保持向后兼容
                resendButton.className = 'pet-chat-meta-btn resend-button';
                // 使用 SVG 图标替代 emoji，更专业美观
                resendButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
        `;
                resendButton.setAttribute('title', '重新发送 prompt 请求');
                // 与 YiWeb 保持一致，同时保持向后兼容
                resendButton.className = 'pet-chat-meta-btn resend-button chat-message-resend-btn';

                // 悬停效果 (handled by CSS)

                // 点击重新发送
                let isResending = false;
                resendButton.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    if (isResending) return;
                    isResending = true;

                    try {
                        // 获取用户消息的原始文本
                        let userMessageText = messageTextElement.getAttribute('data-original-text');
                        if (!userMessageText) {
                            userMessageText = messageTextElement.textContent || messageTextElement.innerText || '';
                        }

                        if (!userMessageText || !userMessageText.trim()) {
                            console.warn('无法获取用户消息内容');
                            isResending = false;
                            return;
                        }

                        // 获取消息容器
                        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                        if (!messagesContainer) {
                            console.warn('无法找到消息容器');
                            isResending = false;
                            return;
                        }

                        // 找到当前用户消息元素
                        let currentMessage = container.parentElement;
                        while (currentMessage && !currentMessage.classList.contains('chat-message')) {
                            currentMessage = currentMessage.parentElement;
                        }

                        if (!currentMessage) {
                            console.warn('无法找到当前消息元素');
                            isResending = false;
                            return;
                        }

                        // 更新按钮状态
                        resendButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416" opacity="0.3">
                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                `;
                        resendButton.classList.add('chat-message-resend-btn--loading');

                        // 创建打字指示器
                        const typingIndicator = this.createTypingIndicator();

                        // 在当前用户消息之后插入打字指示器
                        if (currentMessage.nextSibling) {
                            messagesContainer.insertBefore(typingIndicator, currentMessage.nextSibling);
                        } else {
                            messagesContainer.appendChild(typingIndicator);
                        }
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;

                        // 生成回复
                        let fullContent = '';
                        const messageBubble = typingIndicator.querySelector('[data-message-type="pet-bubble"]');

                        const onStreamContent = (chunk, accumulatedContent) => {
                            fullContent = accumulatedContent;
                            if (messageBubble) {
                                messageBubble.innerHTML = this.renderMarkdown(fullContent);
                                messageBubble.setAttribute('data-original-text', fullContent);

                                // 处理可能的 Mermaid 图表
                                if (messageBubble._mermaidTimeout) {
                                    clearTimeout(messageBubble._mermaidTimeout);
                                }
                                messageBubble._mermaidTimeout = setTimeout(async () => {
                                    await this.processMermaidBlocks(messageBubble);
                                    messageBubble._mermaidTimeout = null;
                                }, 500);

                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }
                        };

                        // 创建 AbortController 用于终止请求
                        const abortController = new AbortController();
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(abortController);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('loading');
                        }

                        // 调用 API 生成回复
                        const reply = await this.generatePetResponseStream(userMessageText.trim(), onStreamContent, abortController);

                        // 移除打字指示器，创建正式的消息元素
                        typingIndicator.remove();

                        // 创建正式的宠物消息
                        const petMessage = this.createMessageElement(reply, 'pet');
                        if (currentMessage.nextSibling) {
                            messagesContainer.insertBefore(petMessage, currentMessage.nextSibling);
                        } else {
                            messagesContainer.appendChild(petMessage);
                        }

                        // 确保最终内容被显示
                        const finalMessageBubble = petMessage.querySelector('[data-message-type="pet-bubble"]');
                        if (finalMessageBubble && fullContent !== reply) {
                            finalMessageBubble.innerHTML = this.renderMarkdown(reply);
                            finalMessageBubble.setAttribute('data-original-text', reply);
                            setTimeout(async () => {
                                await this.processMermaidBlocks(finalMessageBubble);
                            }, 100);
                        }

                        // 添加复制按钮等操作按钮
                        const copyButtonContainer = petMessage.querySelector('[data-copy-button-container]');
                        if (copyButtonContainer && reply && reply.trim()) {
                            this.addCopyButton(copyButtonContainer, finalMessageBubble);
                        }

                        // 添加排序按钮
                        if (copyButtonContainer) {
                            this.addSortButtons(copyButtonContainer, petMessage);
                        }

                        // 添加重试按钮
                        const tryAgainButtonContainer = petMessage.querySelector('[data-try-again-button-container]');
                        if (tryAgainButtonContainer) {
                            this.addTryAgainButton(tryAgainButtonContainer, petMessage);
                        }

                        // 添加消息到会话
                        if (this.currentSessionId && reply && reply.trim()) {
                            await this.addMessageToSession('pet', reply, null, true);

                            // 调用 session/save 保存会话到后端
                            if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                                await this.syncSessionToBackend(this.currentSessionId, true);
                            }
                        }

                        messagesContainer.scrollTop = messagesContainer.scrollHeight;

                        // 更新状态为空闲
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(null);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('idle');
                        }

                        // 恢复按钮状态
                        resendButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                        <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                        resendButton.classList.remove('chat-message-resend-btn--loading');
                        resendButton.classList.add('chat-message-resend-btn--success');

                        setTimeout(() => {
                            resendButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                            <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                    `;
                            resendButton.classList.remove('chat-message-resend-btn--success', 'chat-message-resend-btn--loading');
                            isResending = false;
                        }, 1500);

                    } catch (error) {
                        // 检查是否是取消错误
                        const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                        if (!isAbortError) {
                            console.error('重新发送 prompt 请求失败:', error);
                        }

                        // 更新状态为空闲
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(null);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('idle');
                        }

                        // 恢复按钮状态
                        resendButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                `;
                        resendButton.classList.remove('chat-message-resend-btn--loading');
                        resendButton.classList.add('chat-message-resend-btn--error');

                        setTimeout(() => {
                            resendButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                            <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                    `;
                            resendButton.classList.remove('chat-message-resend-btn--error', 'chat-message-resend-btn--loading');
                            isResending = false;
                        }, 1500);
                    }
                });

                // 只添加缺失的按钮，不清空容器（保留已有的复制按钮等）
                if (!container.querySelector('.edit-button')) {
                    container.appendChild(editButton);
                }
                if (!container.querySelector('.resend-button')) {
                    container.appendChild(resendButton);
                }
                if (!container.querySelector('.delete-button')) {
                    container.appendChild(deleteButton);
                }
                container.style.display = 'flex';
                container.style.gap = '8px';
            }

            // 启用消息编辑功能
            enableMessageEdit(messageElement, editButton, sender) {
                // 保存原始内容 - 优先从data-original-text获取（保留原始格式），如果没有则从元素内容获取
                let originalText = messageElement.getAttribute('data-original-text') || '';

                // 如果data-original-text为空，则从元素内容中提取
                if (!originalText) {
                    if (sender === 'pet') {
                        // 对于宠物消息，从innerText获取（去掉Markdown格式）
                        originalText = messageElement.innerText || messageElement.textContent || '';
                    } else {
                        // 对于用户消息，直接获取文本内容
                        originalText = messageElement.innerText || messageElement.textContent || '';
                    }
                }

                // 保存原始HTML（如果存在）
                const originalHTML = messageElement.innerHTML;

                // 保存到data属性
                messageElement.setAttribute('data-original-content', originalHTML);
                messageElement.setAttribute('data-editing', 'true');

                // 创建文本输入框
                const textarea = document.createElement('textarea');
                textarea.value = originalText;
                textarea.className = 'chat-message-edit-textarea';
                textarea.setAttribute('placeholder', '编辑消息内容...');

                // 替换消息内容为输入框
                messageElement.innerHTML = '';
                messageElement.appendChild(textarea);

                // 自动调整高度以适应内容
                const adjustHeight = () => {
                    textarea.style.height = 'auto';
                    const scrollHeight = textarea.scrollHeight;
                    const minHeight = 80;
                    const maxHeight = 400;
                    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
                    textarea.style.height = newHeight + 'px';
                };

                // 初始调整高度
                setTimeout(() => {
                    adjustHeight();
                    textarea.focus();
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                }, 10);

                // 更新编辑按钮状态
                editButton.setAttribute('data-editing', 'true');
                editButton.innerHTML = '💾';
                editButton.setAttribute('title', '保存编辑');

                // 添加回车保存功能（Ctrl+Enter或Cmd+Enter）
                textarea.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        this.saveMessageEdit(messageElement, editButton, sender);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        this.cancelMessageEdit(messageElement, editButton, sender);
                    }
                });

                // 自动调整高度（输入时实时调整）
                textarea.addEventListener('input', () => {
                    textarea.style.height = 'auto';
                    const scrollHeight = textarea.scrollHeight;
                    const minHeight = 80;
                    const maxHeight = 400;
                    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
                    textarea.style.height = newHeight + 'px';

                    // 如果内容超过最大高度，显示滚动条
                    if (scrollHeight > maxHeight) {
                        textarea.style.overflowY = 'auto';
                    } else {
                        textarea.style.overflowY = 'hidden';
                    }
                });
            }

            // 保存消息编辑
            saveMessageEdit(messageElement, editButton, sender) {
                const textarea = messageElement.querySelector('textarea');
                if (!textarea) return;

                const newText = textarea.value.trim();

                if (!newText) {
                    // 如果内容为空，取消编辑
                    this.cancelMessageEdit(messageElement, editButton, sender);
                    return;
                }

                // 更新消息内容
                if (sender === 'pet') {
                    // 对于宠物消息，使用Markdown渲染
                    messageElement.innerHTML = this.renderMarkdown(newText);
                    messageElement.classList.add('markdown-content');
                    // 更新原始文本
                    messageElement.setAttribute('data-original-text', newText);
                    // 处理可能的 Mermaid 图表 - 使用更可靠的方式
                    // 先等待DOM更新完成，然后处理mermaid
                    setTimeout(async () => {
                        try {
                            // 确保 mermaid 已加载
                            await this.loadMermaid();
                            // 再次检查 DOM 是否已更新
                            const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                            if (hasMermaidCode) {
                                // 处理 mermaid 图表
                                await this.processMermaidBlocks(messageElement);
                            }
                        } catch (error) {
                            console.error('处理编辑后的 Mermaid 图表时出错:', error);
                        }
                    }, 200);
                } else {
                    // 对于用户消息，也支持 Markdown 和 Mermaid 预览
                    // 检查是否包含 markdown 语法（简单检测）
                    const hasMarkdown = /[#*_`\[\]()!]|```/.test(newText);

                    if (hasMarkdown) {
                        // 使用 Markdown 渲染
                        messageElement.innerHTML = this.renderMarkdown(newText);
                        messageElement.classList.add('markdown-content');
                        // 更新原始文本
                        messageElement.setAttribute('data-original-text', newText);
                        // 处理可能的 Mermaid 图表
                        setTimeout(async () => {
                            try {
                                // 确保 mermaid 已加载
                                await this.loadMermaid();
                                // 再次检查 DOM 是否已更新
                                const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                                if (hasMermaidCode) {
                                    // 处理 mermaid 图表
                                    await this.processMermaidBlocks(messageElement);
                                }
                            } catch (error) {
                                console.error('处理编辑后的 Mermaid 图表时出错:', error);
                            }
                        }, 200);
                    } else {
                        // 纯文本，不使用 Markdown
                        messageElement.textContent = newText;
                        // 更新原始文本，以便再次编辑时可以获取
                        messageElement.setAttribute('data-original-text', newText);
                    }
                }

                // 恢复编辑状态
                messageElement.removeAttribute('data-editing');
                messageElement.setAttribute('data-edited', 'true');

                // 更新编辑按钮状态
                editButton.setAttribute('data-editing', 'false');
                editButton.innerHTML = '✏️';
                editButton.setAttribute('title', '编辑消息');
            }

            // 取消消息编辑
            cancelMessageEdit(messageElement, editButton, sender) {
                const originalHTML = messageElement.getAttribute('data-original-content');

                if (originalHTML) {
                    messageElement.innerHTML = originalHTML;
                }

                // 恢复编辑状态
                messageElement.removeAttribute('data-editing');

                // 更新编辑按钮状态
                editButton.setAttribute('data-editing', 'false');
                editButton.innerHTML = '✏️';
                editButton.setAttribute('title', '编辑消息');
            }

            // 媒体处理功能已迁移至 petManager.media.js

            // 获取当前时间
            // 获取页面图标URL（辅助方法）
            getPageIconUrl() {
                let iconUrl = '';
                const linkTags = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
                if (linkTags.length > 0) {
                    iconUrl = linkTags[0].href;
                    if (!iconUrl.startsWith('http')) {
                        iconUrl = new URL(iconUrl, window.location.origin).href;
                    }
                }
                if (!iconUrl) {
                    iconUrl = '/favicon.ico';
                    if (!iconUrl.startsWith('http')) {
                        iconUrl = new URL(iconUrl, window.location.origin).href;
                    }
                }
                return iconUrl;
            }

        } // 结束 PetManager 类

        // 将 PetManager 赋值给 window，防止重复声明
        window.PetManager = PetManager;
    } catch (error) {
        console.error('[PetManager.core] 初始化失败:', error);
        console.error('[PetManager.core] 错误堆栈:', error.stack);

        // 即使出错也尝试创建一个降级的 PetManager 类，避免后续代码完全失败
        if (typeof window !== 'undefined' && typeof window.PetManager === 'undefined') {
            window.PetManager = class PetManagerFallback {
                constructor() {
                    console.warn('[PetManager] 使用降级版本，某些功能可能不可用');
                    this.isFallback = true;
                }

                // 提供基本的降级方法
                showNotification(message, type = 'info') {
                    console.log(`[PetManager降级] ${type}: ${message}`);
                }

                // 提供空方法避免调用错误
                openChatWindow() {
                    console.warn('[PetManager降级] openChatWindow 不可用');
                    return Promise.resolve({ success: false, error: 'PetManager未完全初始化' });
                }
            };

            // 尝试在后台重试初始化（不阻塞用户）
            if (typeof setTimeout !== 'undefined') {
                setTimeout(() => {
                    console.log('[PetManager] 尝试后台重试初始化...');
                    try {
                        // 重新执行初始化逻辑（简化版）
                        // 这里可以添加重试逻辑
                    } catch (retryError) {
                        console.warn('[PetManager] 后台重试失败:', retryError);
                    }
                }, 2000);
            }
        }
    }
})(); // 结束立即执行函数
