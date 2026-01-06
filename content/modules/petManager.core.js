// 防止重复声明 PetManager
(function() {
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
        this.sidebarWidth = 200; // 侧边栏宽度（像素）
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
        this.selectedFileNames = new Set(); // 选中的文件名称集合
        this.currentFile = null; // 当前选中的文件

        // 会话API管理器
        this.sessionApi = null;
        this.lastSessionListLoadTime = 0;
        this.SESSION_LIST_RELOAD_INTERVAL = 10000; // 会话列表重新加载间隔（10秒）
        this.isPageFirstLoad = true; // 标记是否是页面首次加载/刷新
        this.skipSessionListRefresh = false; // 标记是否跳过会话列表刷新（prompt调用后使用）
        this.backendSessionIds = new Set(); // 存储后端会话ID集合，用于判断是否显示保存按钮
        this.isChatWindowFirstOpen = true; // 标记是否是第一次打开聊天窗口

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
            this.faqApi = new FaqApiManager('https://api.effiy.cn/mongodb', true);
            console.log('FAQ API管理器已初始化');
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
    _getSessionsFromLocal() {
        // 确保 sessions 对象已初始化
        if (!this.sessions) {
            this.sessions = {};
            return [];
        }

        // 获取所有会话并去重（按 id 去重，保留 updatedAt 最新的）
        const sessionMap = new Map();
        for (const session of Object.values(this.sessions)) {
            if (!session || !session.id) {
                continue;
            }

            const sessionId = session.id;
            const existingSession = sessionMap.get(sessionId);

            if (!existingSession) {
                // 如果不存在，直接添加
                sessionMap.set(sessionId, session);
            } else {
                // 如果已存在，比较 updatedAt，保留更新的版本
                const existingUpdatedAt = existingSession.updatedAt || existingSession.createdAt || 0;
                const currentUpdatedAt = session.updatedAt || session.createdAt || 0;

                if (currentUpdatedAt > existingUpdatedAt) {
                    sessionMap.set(sessionId, session);
                }
            }
        }

        return Array.from(sessionMap.values());
    }

    // 保存标签顺序
    saveTagOrder(tagOrder) {
        try {
            localStorage.setItem('pet_session_tag_order', JSON.stringify(tagOrder));
            this.tagOrder = tagOrder;
        } catch (error) {
            console.warn('保存标签顺序失败:', error);
        }
    }

    // 收集所有会话的标签
    getAllTags() {
        // 使用与updateSessionSidebar相同的过滤逻辑，确保只从当前可见的会话中提取标签
        let allSessions = this._getSessionsFromLocal();

        // 从过滤后的会话中提取标签
        const tagSet = new Set();
        allSessions.forEach(session => {
            if (session.tags && Array.isArray(session.tags)) {
                session.tags.forEach(tag => {
                    if (tag && tag.trim()) {
                        tagSet.add(tag.trim());
                    }
                });
            }
        });

        const allTags = Array.from(tagSet);

        // 如果已保存标签顺序，使用保存的顺序
        if (this.tagOrder && Array.isArray(this.tagOrder)) {
            // 按保存的顺序排序，新标签追加到末尾
            const orderedTags = [];
            const unorderedTags = [];

            // 先添加已排序的标签（按保存的顺序）
            this.tagOrder.forEach(tag => {
                if (allTags.includes(tag)) {
                    orderedTags.push(tag);
                }
            });

            // 添加未排序的新标签（按字母顺序）
            allTags.forEach(tag => {
                if (!this.tagOrder.includes(tag)) {
                    unorderedTags.push(tag);
                }
            });
            unorderedTags.sort();

            return [...orderedTags, ...unorderedTags];
        }

        // 如果没有保存的顺序，使用默认优先标签列表
        const priorityTags = ['chat', '文档', '工具', '工作', '家庭', '娱乐', '日记'];
        const priorityTagSet = new Set(priorityTags);
        const priorityTagList = [];
        const otherTags = [];

        // 先添加存在的优先标签（按顺序）
        priorityTags.forEach(tag => {
            if (allTags.includes(tag)) {
                priorityTagList.push(tag);
            }
        });

        // 添加其他标签（按字母顺序）
        allTags.forEach(tag => {
            if (!priorityTagSet.has(tag)) {
                otherTags.push(tag);
            }
        });
        otherTags.sort();

        // 合并：优先标签在前，其他标签在后
        return [...priorityTagList, ...otherTags];
    }

    // 获取会话的显示标题（用于过滤和显示）
    _getSessionDisplayTitle(session) {
        if (!session) return '未命名会话';

        // 优先使用会话的 pageTitle，如果没有则使用 title（兼容后端可能返回 title 字段的情况）
        let sessionTitle = session.pageTitle || session.title || '未命名会话';

        // 如果是空白会话且标题是默认值，尝试生成更友好的标题
        if (session._isBlankSession || (session.url && session.url.startsWith('blank-session://'))) {
            if (!session.pageTitle || session.pageTitle === '新会话' || session.pageTitle === '未命名会话') {
                // 如果有消息，使用第一条用户消息的前几个字
                if (session.messages && session.messages.length > 0) {
                    const firstUserMessage = session.messages.find(m => m.type === 'user');
                    if (firstUserMessage && firstUserMessage.content) {
                        const content = firstUserMessage.content.trim();
                        const preview = content.length > 30 ? content.substring(0, 30) + '...' : content;
                        sessionTitle = preview;
                    } else {
                        // 没有用户消息，使用创建时间
                        const createDate = new Date(session.createdAt || Date.now());
                        const month = String(createDate.getMonth() + 1).padStart(2, '0');
                        const day = String(createDate.getDate()).padStart(2, '0');
                        const hour = String(createDate.getHours()).padStart(2, '0');
                        const minute = String(createDate.getMinutes()).padStart(2, '0');
                        sessionTitle = `${month}-${day} ${hour}:${minute}`;
                    }
                } else {
                    // 没有消息，使用创建时间
                    const createDate = new Date(session.createdAt || Date.now());
                    const month = String(createDate.getMonth() + 1).padStart(2, '0');
                    const day = String(createDate.getDate()).padStart(2, '0');
                    const hour = String(createDate.getHours()).padStart(2, '0');
                    const minute = String(createDate.getMinutes()).padStart(2, '0');
                    sessionTitle = `${month}-${day} ${hour}:${minute}`;
                }
            }
        }

        return sessionTitle;
    }

    // 清理文件名（移除非法字符）
    _sanitizeFileName(fileName) {
        // 移除或替换Windows/Linux文件名中的非法字符
        return fileName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    }

    // 加载JSZip库（参考loadMermaid的方式）
    async _loadJSZip() {
        // 检查是否已经加载
        if (this.jszipLoaded || this.jszipLoading) {
            return this.jszipLoaded;
        }

        this.jszipLoading = true;

        return new Promise((resolve, reject) => {
            // 检查是否已经在页面上下文中加载
            const checkLoaded = () => {
                return window.__JSZIP_LOADED__ || window.__JSZIP_READY__;
            };

            if (checkLoaded()) {
                this.jszipLoaded = true;
                this.jszipLoading = false;
                console.log('JSZip已在页面上下文中加载');
                resolve(true);
                return;
            }

            // 检查扩展上下文是否有效
            let scriptUrl, loadScriptUrl;
            try {
                // 检查 chrome 对象和 runtime 是否存在
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    throw new Error('扩展上下文无效：chrome.runtime 不可用');
                }

                // 直接尝试获取脚本 URL（不先检查 runtime.id，因为 getURL 更可靠）
                try {
                    scriptUrl = chrome.runtime.getURL('jszip.min.js');
                    loadScriptUrl = chrome.runtime.getURL('load-jszip.js');

                    // 验证 URL 是否有效
                    if (!scriptUrl || !loadScriptUrl) {
                        throw new Error('扩展上下文无效：无法获取脚本 URL');
                    }
                } catch (getUrlError) {
                    const errorMsg = (getUrlError.message || getUrlError.toString() || '').toLowerCase();
                    if (errorMsg.includes('extension context invalidated') ||
                        errorMsg.includes('context invalidated') ||
                        errorMsg.includes('could not establish connection')) {
                        throw new Error('扩展上下文已失效，请刷新页面后重试');
                    }
                    throw new Error('扩展上下文无效：无法获取脚本 URL');
                }
            } catch (error) {
                this.jszipLoading = false;
                const errorMsg = error.message || '扩展上下文无效';
                console.error('获取JSZip脚本URL失败:', error);
                reject(new Error(errorMsg));
                return;
            }

            console.log('尝试在页面上下文中加载 JSZip.js，URL:', scriptUrl);

            // 通过 data 属性传递 URL（避免内联脚本）
            const urlContainer = document.createElement('div');
            urlContainer.id = '__jszip_url_container__';
            urlContainer.style.display = 'none';
            urlContainer.setAttribute('data-jszip-url', scriptUrl);
            (document.head || document.documentElement).appendChild(urlContainer);

            // 加载外部脚本文件（避免 CSP 限制）
            const injectedScript = document.createElement('script');
            injectedScript.src = loadScriptUrl;
            injectedScript.charset = 'UTF-8';
            injectedScript.async = false;

            // 监听页面中的 JSZip 加载事件（在脚本加载前设置）
            const handleJSZipLoaded = () => {
                console.log('[Content] 收到 JSZip 加载完成事件');
                this.jszipLoaded = true;
                this.jszipLoading = false;
                console.log('[Content] JSZip.js 在页面上下文中已加载');
                window.removeEventListener('jszip-loaded', handleJSZipLoaded);
                window.removeEventListener('jszip-error', handleJSZipError);
                resolve(true);
            };

            const handleJSZipError = (event) => {
                console.error('[Content] 收到 JSZip 加载失败事件', event);
                this.jszipLoading = false;
                window.removeEventListener('jszip-loaded', handleJSZipLoaded);
                window.removeEventListener('jszip-error', handleJSZipError);
                const errorMsg = event && event.detail && event.detail.error ? event.detail.error : '页面上下文中的 JSZip.js 加载失败';
                reject(new Error(errorMsg));
            };

            // 监听页面事件（通过注入的事件监听器）
            window.addEventListener('jszip-loaded', handleJSZipLoaded);
            window.addEventListener('jszip-error', handleJSZipError);

            // 注入脚本到页面上下文
            (document.head || document.documentElement).appendChild(injectedScript);

            // 清理注入的脚本
            setTimeout(() => {
                if (injectedScript.parentNode) {
                    injectedScript.parentNode.removeChild(injectedScript);
                }
            }, 1000);
        });
    }

    // 生成context.md内容
    _generateContextMd(session) {
        let content = `# ${session.pageTitle || '未命名会话'}\n\n`;
        content += `**创建时间**: ${new Date(session.createdAt || Date.now()).toLocaleString('zh-CN')}\n\n`;
        content += `**更新时间**: ${new Date(session.updatedAt || session.createdAt || Date.now()).toLocaleString('zh-CN')}\n\n`;
        content += `**URL**: ${session.url || ''}\n\n`;

        if (session.pageDescription) {
            content += `**页面描述**: ${session.pageDescription}\n\n`;
        }

        if (session.tags && session.tags.length > 0) {
            content += `**标签**: ${session.tags.join(', ')}\n\n`;
        }

        if (session.pageContent) {
            content += `## 页面内容\n\n${session.pageContent}\n`;
        }

        return content;
    }

    // 生成chat.md内容
    _generateChatMd(session) {
        let content = `# 聊天记录\n\n`;

        if (!session.messages || session.messages.length === 0) {
            content += `暂无聊天记录。\n`;
            return content;
        }

        session.messages.forEach((message, index) => {
            const role = message.role || 'unknown';
            const text = message.content || message.text || '';
            const timestamp = message.timestamp || message.createdAt || '';

            content += `## 消息 ${index + 1}\n\n`;
            content += `**角色**: ${role}\n\n`;
            if (timestamp) {
                content += `**时间**: ${new Date(timestamp).toLocaleString('zh-CN')}\n\n`;
            }
            content += `**内容**:\n\n${text}\n\n`;
            content += `---\n\n`;
        });

        return content;
    }

    // 解析markdown内容，提取页面信息和聊天记录
    _parseMarkdownContent(markdownContent) {
        const result = {
            pageTitle: '',
            url: '',
            pageDescription: '',
            pageContent: '',
            tags: [],
            messages: [],
            createdAt: null,
            updatedAt: null
        };

        if (!markdownContent || typeof markdownContent !== 'string') {
            return result;
        }

        // 分割内容：页面信息和聊天记录
        const chatRecordIndex = markdownContent.indexOf('# 聊天记录');
        const pageInfoContent = chatRecordIndex >= 0
            ? markdownContent.substring(0, chatRecordIndex).trim()
            : markdownContent.trim();
        const chatContent = chatRecordIndex >= 0
            ? markdownContent.substring(chatRecordIndex).trim()
            : '';

        // 解析页面信息部分
        // 提取标题（第一行的 # 标题）
        const titleMatch = pageInfoContent.match(/^#\s+(.+?)$/m);
        if (titleMatch) {
            result.pageTitle = titleMatch[1].trim();
        }

        // 提取创建时间
        const createdAtMatch = pageInfoContent.match(/\*\*创建时间\*\*:\s*(.+?)$/m);
        if (createdAtMatch) {
            try {
                result.createdAt = new Date(createdAtMatch[1].trim()).getTime();
            } catch (e) {
                // 忽略解析错误
            }
        }

        // 提取更新时间
        const updatedAtMatch = pageInfoContent.match(/\*\*更新时间\*\*:\s*(.+?)$/m);
        if (updatedAtMatch) {
            try {
                result.updatedAt = new Date(updatedAtMatch[1].trim()).getTime();
            } catch (e) {
                // 忽略解析错误
            }
        }

        // 提取URL
        const urlMatch = pageInfoContent.match(/\*\*URL\*\*:\s*(.+?)$/m);
        if (urlMatch) {
            result.url = urlMatch[1].trim();
        }

        // 提取页面描述
        const descMatch = pageInfoContent.match(/\*\*页面描述\*\*:\s*(.+?)$/m);
        if (descMatch) {
            result.pageDescription = descMatch[1].trim();
        }

        // 提取标签
        const tagsMatch = pageInfoContent.match(/\*\*标签\*\*:\s*(.+?)$/m);
        if (tagsMatch) {
            result.tags = tagsMatch[1].split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        // 提取页面内容（## 页面内容 之后的内容）
        const pageContentMatch = pageInfoContent.match(/##\s+页面内容\s*\n\n(.+?)(?:\n\n#|$)/s);
        if (pageContentMatch) {
            result.pageContent = pageContentMatch[1].trim();
        } else {
            // 如果没有明确的页面内容标记，尝试提取所有非元信息的内容
            const lines = pageInfoContent.split('\n');
            let inPageContent = false;
            let pageContentLines = [];
            for (const line of lines) {
                if (line.startsWith('## 页面内容')) {
                    inPageContent = true;
                    continue;
                }
                if (inPageContent && !line.match(/^\*\*/)) {
                    pageContentLines.push(line);
                }
            }
            if (pageContentLines.length > 0) {
                result.pageContent = pageContentLines.join('\n').trim();
            }
        }

        // 解析聊天记录部分
        if (chatContent) {
            // 使用正则表达式匹配每个消息
            const messagePattern = /##\s+消息\s+\d+\s*\n\n\*\*角色\*\*:\s*(.+?)\s*\n\n(?:\*\*时间\*\*:\s*(.+?)\s*\n\n)?\*\*内容\*\*:\s*\n\n(.+?)\n\n---/gs;
            let messageMatch;
            while ((messageMatch = messagePattern.exec(chatContent)) !== null) {
                const role = messageMatch[1].trim();
                const timestamp = messageMatch[2] ? new Date(messageMatch[2].trim()).getTime() : Date.now();
                const content = messageMatch[3].trim();

                // 将角色映射为type（user或pet）
                const type = role.toLowerCase().includes('user') || role.toLowerCase().includes('用户') ? 'user' : 'pet';

                result.messages.push({
                    type: type,
                    role: role,
                    content: content,
                    timestamp: timestamp
                });
            }
        }

        return result;
    }

    // 根据标签和标题查找会话
    _findSessionByTagsAndTitle(tags, title) {
        const allSessions = this._getSessionsFromLocal();

        // 将标签数组转换为字符串用于比较（排序后比较，确保顺序一致）
        const normalizedTags = [...tags].sort().join(',');

        for (const session of allSessions) {
            const sessionTags = session.tags || [];
            const sessionNormalizedTags = [...sessionTags].sort().join(',');

            // 比较标签和标题
            if (sessionNormalizedTags === normalizedTags &&
                session.pageTitle === title) {
                return session;
            }
        }

        return null;
    }

    // 导入会话从ZIP文件
    async importSessionsFromZip(file) {
        try {
            // 显示加载提示
            this.showNotification('正在准备导入...', 'info');

            // 加载JSZip库（在页面上下文中）
            await this._loadJSZip();

            // 读取文件为base64
            const fileReader = new FileReader();
            const fileData = await new Promise((resolve, reject) => {
                fileReader.onload = (e) => resolve(e.target.result);
                fileReader.onerror = (e) => reject(new Error('读取文件失败'));
                fileReader.readAsDataURL(file);
            });

            // 提取base64数据（去掉data:application/zip;base64,前缀）
            const base64Data = fileData.split(',')[1];

            if (!base64Data) {
                throw new Error('无法读取文件数据');
            }

            // 在页面上下文中执行导入逻辑
            this.showNotification('正在解析ZIP文件...', 'info');

            // 根据文件大小动态计算超时时间（最小5分钟，每MB增加1分钟，最大30分钟）
            const fileSizeMB = file.size / (1024 * 1024);
            const baseTimeout = 5 * 60 * 1000; // 5分钟基础超时
            const sizeBasedTimeout = Math.min(fileSizeMB * 60 * 1000, 25 * 60 * 1000); // 每MB增加1分钟，最多25分钟
            const timeoutDuration = Math.max(baseTimeout + sizeBasedTimeout, 5 * 60 * 1000); // 最少5分钟
            const maxTimeout = 30 * 60 * 1000; // 最多30分钟
            const finalTimeout = Math.min(timeoutDuration, maxTimeout);

            console.log(`导入超时时间设置为: ${Math.round(finalTimeout / 1000)}秒 (文件大小: ${fileSizeMB.toFixed(2)}MB)`);

            // 检查扩展上下文是否有效
            let importScriptUrl;
            try {
                // 检查 chrome 对象和 runtime 是否存在
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    throw new Error('扩展上下文无效：chrome.runtime 不可用');
                }

                // 直接尝试获取脚本 URL（不先检查 runtime.id，因为 getURL 更可靠）
                try {
                    importScriptUrl = chrome.runtime.getURL('import-sessions.js');

                    // 验证 URL 是否有效
                    if (!importScriptUrl) {
                        throw new Error('扩展上下文无效：无法获取脚本 URL');
                    }
                } catch (getUrlError) {
                    const errorMsg = (getUrlError.message || getUrlError.toString() || '').toLowerCase();
                    if (errorMsg.includes('extension context invalidated') ||
                        errorMsg.includes('context invalidated') ||
                        errorMsg.includes('could not establish connection')) {
                        throw new Error('扩展上下文已失效，请刷新页面后重试');
                    }
                    throw new Error('扩展上下文无效：无法获取脚本 URL');
                }
            } catch (error) {
                const errorMsg = error.message || '扩展上下文无效';
                console.error('获取导入脚本URL失败:', error);
                this.showNotification('导入失败: ' + errorMsg + '。请刷新页面后重试。', 'error');
                throw new Error(errorMsg);
            }

            return new Promise((resolve, reject) => {
                // 创建数据容器
                const dataContainer = document.createElement('div');
                dataContainer.id = '__jszip_import_data__';
                dataContainer.style.display = 'none';
                dataContainer.setAttribute('data-import', base64Data);
                (document.head || document.documentElement).appendChild(dataContainer);

                // 加载外部导入脚本
                const importScript = document.createElement('script');
                importScript.src = importScriptUrl;
                importScript.charset = 'UTF-8';
                importScript.async = false;

                // 超时定时器引用
                let timeoutTimer = null;

                // 清理函数
                const cleanup = () => {
                    if (timeoutTimer) {
                        clearTimeout(timeoutTimer);
                        timeoutTimer = null;
                    }
                    window.removeEventListener('jszip-import-success', handleSuccess);
                    window.removeEventListener('jszip-import-error', handleError);

                    // 清理DOM元素
                    if (importScript.parentNode) {
                        importScript.parentNode.removeChild(importScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                };

                // 监听导入结果
                const handleSuccess = async (event) => {
                    cleanup();

                    try {
                        const importData = event.detail.importData;
                        if (!importData || importData.length === 0) {
                            throw new Error('没有找到可导入的会话');
                        }

                        this.showNotification(`正在导入 ${importData.length} 个会话...`, 'info');

                        // 处理每个导入的会话
                        let createdCount = 0;
                        let updatedCount = 0;
                        let errorCount = 0;
                        // 记录已处理的会话ID，用于后续同步
                        const processedSessionIds = [];

                        for (let i = 0; i < importData.length; i++) {
                            const item = importData[i];
                            let processedSessionId = null;

                            try {
                                // 解析markdown内容
                                const parsed = this._parseMarkdownContent(item.pageContent);

                                // 使用导入的标签（如果markdown中没有标签，使用目录结构中的标签）
                                let tags = parsed.tags.length > 0 ? parsed.tags : item.tags;

                                // 过滤掉"未分类"标签，根目录和"未分类"目录不需要创建标签
                                tags = tags.filter(tag => tag !== '未分类');

                                // 使用导入的标题（如果markdown中没有标题，使用文件名）
                                const title = parsed.pageTitle || item.title;

                                // 查找是否存在相同的会话（根据标签和标题）
                                const existingSession = this._findSessionByTagsAndTitle(tags, title);

                                if (existingSession) {
                                    // 更新现有会话
                                    const sessionId = existingSession.id;
                                    const session = this.sessions[sessionId];

                                    if (session) {
                                        // 更新会话信息
                                        session.pageTitle = title;
                                        session.pageDescription = parsed.pageDescription || session.pageDescription || '';
                                        // 用新文件里面的内容覆盖原来会话的页面上下文内容
                                        session.pageContent = parsed.pageContent || item.pageContent || '';
                                        session.tags = tags;

                                        // 生成唯一的随机URL（参考手动创建会话的方式）
                                        if (!parsed.url && !session.url) {
                                            const timestamp = Date.now();
                                            const randomStr = Math.random().toString(36).substring(2, 11); // 9位随机字符串
                                            let uniqueUrl = `import-session://${timestamp}-${randomStr}`;

                                            // 确保URL唯一：检查是否已存在相同URL的会话
                                            let urlAttempts = 0;
                                            while (Object.values(this.sessions).some(s => s && s.url === uniqueUrl) && urlAttempts < 10) {
                                                const newTimestamp = Date.now();
                                                const newRandomStr = Math.random().toString(36).substring(2, 11);
                                                uniqueUrl = `import-session://${newTimestamp}-${newRandomStr}`;
                                                urlAttempts++;
                                            }
                                            session.url = uniqueUrl;
                                        } else {
                                            session.url = parsed.url || session.url;
                                        }

                                        // 更新消息（如果导入的内容中有消息）
                                        if (parsed.messages && parsed.messages.length > 0) {
                                            session.messages = parsed.messages.map(msg => ({
                                                type: msg.type,
                                                content: msg.content,
                                                timestamp: msg.timestamp || Date.now()
                                            }));
                                        }

                                        session.updatedAt = parsed.updatedAt || Date.now();

                                        // 确保会话ID正确设置
                                        if (!session.id) {
                                            session.id = sessionId;
                                        }

                                        // 确保更新后的会话被保存到 this.sessions
                                        this.sessions[sessionId] = session;

                                        // 记录已处理的会话ID
                                        processedSessionId = sessionId;

                                        updatedCount++;
                                    }
                                } else {
                                    // 创建新会话
                                    // 生成唯一的会话ID（使用标题和标签生成唯一标识）
                                    const tagsStr = tags.length > 0 ? tags.join('_') : 'no_tags';
                                    const uniqueId = `import_${title}_${tagsStr}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                                    const sessionId = await this.generateSessionId(uniqueId);

                                    // 检查会话ID是否已存在，如果存在则重新生成
                                    let finalSessionId = sessionId;
                                    let attempts = 0;
                                    while (this.sessions[finalSessionId] && attempts < 10) {
                                        const newTagsStr = tags.length > 0 ? tags.join('_') : 'no_tags';
                                        const newUniqueId = `import_${title}_${newTagsStr}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                                        finalSessionId = await this.generateSessionId(newUniqueId);
                                        attempts++;
                                    }

                                    // 生成唯一的随机URL（参考手动创建会话的方式）
                                    let uniqueUrl;
                                    if (!parsed.url) {
                                        const timestamp = Date.now();
                                        const randomStr = Math.random().toString(36).substring(2, 11); // 9位随机字符串
                                        uniqueUrl = `import-session://${timestamp}-${randomStr}`;

                                        // 确保URL唯一：检查是否已存在相同URL的会话
                                        let urlAttempts = 0;
                                        while (Object.values(this.sessions).some(s => s && s.url === uniqueUrl) && urlAttempts < 10) {
                                            const newTimestamp = Date.now();
                                            const newRandomStr = Math.random().toString(36).substring(2, 11);
                                            uniqueUrl = `import-session://${newTimestamp}-${newRandomStr}`;
                                            urlAttempts++;
                                        }
                                    } else {
                                        uniqueUrl = parsed.url;
                                    }

                                    const pageInfo = {
                                        url: uniqueUrl,
                                        title: title,
                                        pageTitle: title,
                                        description: parsed.pageDescription || '',
                                        pageDescription: parsed.pageDescription || '',
                                        // 优先使用解析出的页面内容，如果没有则使用原始导入内容
                                        content: parsed.pageContent || item.pageContent || '',
                                        pageContent: parsed.pageContent || item.pageContent || ''
                                    };

                                    // 使用createSessionObject创建会话对象
                                    const newSession = this.createSessionObject(finalSessionId, pageInfo);
                                    newSession.tags = tags;
                                    newSession.messages = parsed.messages && parsed.messages.length > 0
                                        ? parsed.messages.map(msg => ({
                                            type: msg.type,
                                            content: msg.content,
                                            timestamp: msg.timestamp || Date.now()
                                        }))
                                        : [];
                                    newSession.createdAt = parsed.createdAt || Date.now();
                                    newSession.updatedAt = parsed.updatedAt || Date.now();

                                    // 保存会话到本地
                                    this.sessions[finalSessionId] = newSession;

                                    // 记录已处理的会话ID
                                    processedSessionId = finalSessionId;

                                    createdCount++;
                                }

                                // 将已处理的会话ID添加到数组中
                                if (processedSessionId) {
                                    processedSessionIds.push(processedSessionId);
                                }

                                // 同步到后端（批量处理，每10个会话同步一次）
                                if ((i + 1) % 10 === 0 || (i + 1) === importData.length) {
                                    // 保存所有会话到本地
                                    await this.saveAllSessions(true, false);

                                    // 批量同步到后端
                                    if (this.sessionApi && this.sessionApi.isEnabled()) {
                                        // 使用记录的会话ID进行同步，确保使用更新后的数据
                                        const sessionsToSync = processedSessionIds.slice(Math.max(0, processedSessionIds.length - 10));

                                        // 同步每个会话，确保包含 pageContent
                                        for (const syncSessionId of sessionsToSync) {
                                            try {
                                                // 确保会话存在且包含更新后的 pageContent
                                                const sessionToSync = this.sessions[syncSessionId];
                                                if (sessionToSync) {
                                                    await this.syncSessionToBackend(syncSessionId, true, true);
                                                }
                                            } catch (error) {
                                                console.warn(`同步会话 ${syncSessionId} 失败:`, error);
                                            }
                                        }

                                        // 清空已处理的会话ID列表（只保留最后10个，用于下一批）
                                        if (processedSessionIds.length > 10) {
                                            processedSessionIds.splice(0, processedSessionIds.length - 10);
                                        }
                                    }
                                }

                                // 更新进度提示（每10个会话更新一次）
                                if ((i + 1) % 10 === 0 || (i + 1) === importData.length) {
                                    this.showNotification(`已处理 ${i + 1}/${importData.length} 个会话...`, 'info');
                                }
                            } catch (error) {
                                console.error(`导入会话失败 [${item.title}]:`, error);
                                errorCount++;
                            }
                        }

                        // 刷新会话列表：从后端重新请求会话列表
                        if (this.sessionApi && this.sessionApi.isEnabled()) {
                            try {
                                this.showNotification('正在刷新会话列表...', 'info');
                                // 强制刷新后端会话列表（跳过缓存）
                                await this.loadSessionsFromBackend(true);
                                // 重新加载所有会话（包括本地存储的会话）
                                await this.loadAllSessions();
                                console.log('会话列表已从后端刷新');
                            } catch (error) {
                                console.warn('刷新会话列表失败:', error);
                                // 即使刷新失败，也继续更新UI（使用本地数据）
                            }
                        } else {
                            // 如果没有后端API，只重新加载本地会话
                            await this.loadAllSessions();
                        }

                        // 刷新会话列表UI
                        await this.updateSessionUI({
                            updateSidebar: true
                        });

                        // 显示导入结果
                        let resultMsg = `导入完成：创建 ${createdCount} 个，更新 ${updatedCount} 个`;
                        if (errorCount > 0) {
                            resultMsg += `，失败 ${errorCount} 个`;
                        }
                        this.showNotification(resultMsg, 'success');

                        resolve({
                            created: createdCount,
                            updated: updatedCount,
                            errors: errorCount,
                            total: importData.length
                        });
                    } catch (error) {
                        console.error('处理导入数据失败:', error);
                        reject(error);
                    }
                };

                const handleError = (event) => {
                    cleanup();

                    const errorMsg = event.detail && event.detail.error ? event.detail.error : '导入失败';
                    reject(new Error(errorMsg));
                };

                window.addEventListener('jszip-import-success', handleSuccess);
                window.addEventListener('jszip-import-error', handleError);

                // 注入脚本
                (document.head || document.documentElement).appendChild(importScript);

                // 设置超时（根据文件大小动态调整）
                timeoutTimer = setTimeout(() => {
                    cleanup();
                    const timeoutMinutes = Math.round(finalTimeout / 60000);
                    reject(new Error(`导入超时（已等待 ${timeoutMinutes} 分钟）。如果文件很大，请尝试分批导入较小的文件。`));
                }, finalTimeout);
            });
        } catch (error) {
            console.error('导入会话失败:', error);
            this.showNotification('导入失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 导出会话为ZIP文件（使用页面上下文中的JSZip）
    async exportSessionsToZip() {
        try {
            // 显示加载提示
            this.showNotification('正在准备导出...', 'info');

            // 加载JSZip库（在页面上下文中）
            await this._loadJSZip();

            // 判断当前视图模式
            const sessionList = this.sessionSidebar?.querySelector('.session-list');

            // 总是导出普通会话列表
            let sessions = [];
            sessions = this._getFilteredSessions();

            if (sessions.length === 0) {
                this.showNotification('没有可导出的会话', 'error');
                return;
            }

            // 显示进度提示
            this.showNotification(`正在获取 ${sessions.length} 个会话的完整数据...`, 'info');

            // 遍历每个会话，从后端API获取完整数据（包括页面上下文和聊天消息）
            const exportData = [];
            for (let i = 0; i < sessions.length; i++) {
                const session = sessions[i];
                const sessionId = session.id || session.session_id;

                let fullSessionData = session; // 默认使用本地数据

                // 如果启用了后端同步，尝试从后端获取完整的会话数据
                if (sessionId && this.sessionApi && this.sessionApi.isEnabled()) {
                    try {
                        // 强制刷新，获取最新的完整会话数据
                        const backendSession = await this.sessionApi.getSession(sessionId, true);

                        if (backendSession) {
                            // 合并数据：后端数据优先，但保留本地数据中可能缺失的字段
                            fullSessionData = {
                                ...session, // 先使用本地数据
                                ...backendSession, // 后端数据覆盖（包含完整的 pageContent 和 messages）
                                id: sessionId, // 确保 ID 一致
                            };
                            console.log(`已从后端获取会话 ${sessionId} 的完整数据`);
                        }
                    } catch (error) {
                        console.warn(`获取会话 ${sessionId} 的完整数据失败，使用本地数据:`, error.message);
                        // 如果获取失败，继续使用本地数据
                    }
                }

                // 生成导出数据
                const timestamp = fullSessionData.updatedAt || fullSessionData.createdAt || Date.now();
                const title = this._sanitizeFileName(fullSessionData.pageTitle || '未命名会话');
                const tags = fullSessionData.tags || [];

                // 生成页面上下文内容（合并 context 和 chat）
                const contextMd = this._generateContextMd(fullSessionData);
                const chatMd = this._generateChatMd(fullSessionData);
                const pageContent = contextMd + '\n\n' + chatMd;

                exportData.push({
                    tags: tags,
                    title: title,
                    pageContent: pageContent
                });

                // 更新进度提示（每10个会话更新一次）
                if ((i + 1) % 10 === 0 || (i + 1) === sessions.length) {
                    this.showNotification(`已处理 ${i + 1}/${sessions.length} 个会话...`, 'info');
                }
            }

            // 在页面上下文中执行导出逻辑
            this.showNotification('正在生成ZIP文件...', 'info');

            // 检查扩展上下文是否有效
            let exportScriptUrl;
            try {
                // 检查 chrome 对象和 runtime 是否存在
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    throw new Error('扩展上下文无效：chrome.runtime 不可用');
                }

                // 直接尝试获取脚本 URL（不先检查 runtime.id，因为 getURL 更可靠）
                try {
                    exportScriptUrl = chrome.runtime.getURL('export-sessions.js');

                    // 验证 URL 是否有效
                    if (!exportScriptUrl) {
                        throw new Error('扩展上下文无效：无法获取脚本 URL');
                    }
                } catch (getUrlError) {
                    const errorMsg = (getUrlError.message || getUrlError.toString() || '').toLowerCase();
                    if (errorMsg.includes('extension context invalidated') ||
                        errorMsg.includes('context invalidated') ||
                        errorMsg.includes('could not establish connection')) {
                        throw new Error('扩展上下文已失效，请刷新页面后重试');
                    }
                    throw new Error('扩展上下文无效：无法获取脚本 URL');
                }
            } catch (error) {
                const errorMsg = error.message || '扩展上下文无效';
                console.error('获取导出脚本URL失败:', error);
                this.showNotification('导出失败: ' + errorMsg + '。请刷新页面后重试。', 'error');
                throw new Error(errorMsg);
            }

            // 使用注入外部脚本的方式（避免CSP限制）
            return new Promise((resolve, reject) => {
                // 创建数据容器（通过data属性传递数据，避免内联脚本）
                const dataContainer = document.createElement('div');
                dataContainer.id = '__jszip_export_data__';
                dataContainer.style.display = 'none';
                dataContainer.setAttribute('data-export', JSON.stringify(exportData));
                dataContainer.setAttribute('data-export-type', 'session');
                (document.head || document.documentElement).appendChild(dataContainer);

                // 加载外部导出脚本
                const exportScript = document.createElement('script');
                exportScript.src = exportScriptUrl;
                exportScript.charset = 'UTF-8';
                exportScript.async = false;

                // 监听导出结果
                const handleSuccess = (event) => {
                    window.removeEventListener('jszip-export-success', handleSuccess);
                    window.removeEventListener('jszip-export-error', handleError);
                    // 清理
                    if (exportScript.parentNode) {
                        exportScript.parentNode.removeChild(exportScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                    this.showNotification(`成功导出 ${event.detail.count} 个会话`, 'success');
                    resolve();
                };

                const handleError = (event) => {
                    window.removeEventListener('jszip-export-success', handleSuccess);
                    window.removeEventListener('jszip-export-error', handleError);
                    // 清理
                    if (exportScript.parentNode) {
                        exportScript.parentNode.removeChild(exportScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                    const errorMsg = event.detail && event.detail.error ? event.detail.error : '导出失败';
                    reject(new Error(errorMsg));
                };

                window.addEventListener('jszip-export-success', handleSuccess);
                window.addEventListener('jszip-export-error', handleError);

                // 注入脚本
                (document.head || document.documentElement).appendChild(exportScript);

                // 设置超时
                setTimeout(() => {
                    window.removeEventListener('jszip-export-success', handleSuccess);
                    window.removeEventListener('jszip-export-error', handleError);
                    if (exportScript.parentNode) {
                        exportScript.parentNode.removeChild(exportScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                    reject(new Error('导出超时'));
                }, 30000);
            });
        } catch (error) {
            console.error('导出会话失败:', error);
            throw error;
        }
    }


    // 更新标签过滤器UI
    updateTagFilterUI() {
        if (!this.sessionSidebar) return;

        // 更新反向过滤按钮状态
        const reverseFilterBtn = this.sessionSidebar.querySelector('.tag-filter-reverse');
        if (reverseFilterBtn) {
            reverseFilterBtn.style.color = this.tagFilterReverse ? '#4CAF50' : '#9ca3af';
            reverseFilterBtn.style.opacity = this.tagFilterReverse ? '1' : '0.6';
        }

        // 更新无标签筛选按钮状态
        const noTagsFilterBtn = this.sessionSidebar.querySelector('.tag-filter-no-tags');
        if (noTagsFilterBtn) {
            noTagsFilterBtn.style.color = this.tagFilterNoTags ? '#4CAF50' : '#9ca3af';
            noTagsFilterBtn.style.opacity = this.tagFilterNoTags ? '1' : '0.6';
        }

        // 更新清除按钮显示状态（如果有选中的标签、启用了无标签筛选或有搜索关键词才显示为可用状态）
        const clearFilterBtn = this.sessionSidebar.querySelector('.tag-filter-clear');
        if (clearFilterBtn) {
            const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0;
            const hasSearchKeyword = this.tagFilterSearchKeyword && this.tagFilterSearchKeyword.trim() !== '';
            const hasActiveFilter = hasSelectedTags || this.tagFilterNoTags || hasSearchKeyword;
            clearFilterBtn.style.opacity = hasActiveFilter ? '0.8' : '0.4';
            clearFilterBtn.style.cursor = hasActiveFilter ? 'pointer' : 'default';
        }

        const tagFilterList = this.sessionSidebar.querySelector('.tag-filter-list');
        if (!tagFilterList) return;

        // 清空现有标签
        tagFilterList.innerHTML = '';

        // 获取所有标签
        const allTags = this.getAllTags();

        // 根据搜索关键词过滤标签
        let filteredTags = allTags;
        const searchKeyword = (this.tagFilterSearchKeyword || '').trim().toLowerCase();
        if (searchKeyword) {
            filteredTags = allTags.filter(tag =>
                tag.toLowerCase().includes(searchKeyword)
            );
        }

        if (filteredTags.length === 0) {
            // 如果没有匹配的标签，显示提示信息
            const expandToggleBtn = this.sessionSidebar.querySelector('.tag-filter-expand-btn');
            if (expandToggleBtn) {
                expandToggleBtn.style.display = 'none';
            }
            // 显示"无匹配标签"提示
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = searchKeyword ? '未找到匹配的标签' : '暂无标签';
            emptyMsg.style.cssText = `
                padding: 8px !important;
                text-align: center !important;
                color: #9ca3af !important;
                font-size: 11px !important;
            `;
            tagFilterList.appendChild(emptyMsg);
            return;
        }

        // 确定要显示的标签（根据折叠状态）
        // 确保选中的标签始终显示
        const selectedTags = this.selectedFilterTags || [];
        let visibleTags;
        let hasMoreTags;

        if (this.tagFilterExpanded || searchKeyword) {
            // 展开状态或有搜索关键词时：显示所有过滤后的标签
            visibleTags = filteredTags;
            hasMoreTags = false;
        } else {
            // 折叠状态：显示前N个标签，但确保选中的标签也在其中
            const defaultVisible = filteredTags.slice(0, this.tagFilterVisibleCount);
            const selectedNotInDefault = selectedTags.filter(tag => !defaultVisible.includes(tag));

            // 保持filteredTags的原始顺序，但确保选中的标签也在可见列表中
            const visibleSet = new Set([...defaultVisible, ...selectedNotInDefault]);
            visibleTags = filteredTags.filter(tag => visibleSet.has(tag));
            hasMoreTags = filteredTags.length > visibleTags.length;
        }

        // 更新展开/折叠按钮（有搜索关键词时隐藏）
        const expandToggleBtn = this.sessionSidebar.querySelector('.tag-filter-expand-btn');
        if (expandToggleBtn) {
            if (searchKeyword) {
                // 有搜索关键词时隐藏展开/折叠按钮
                expandToggleBtn.style.display = 'none';
            } else if (hasMoreTags || this.tagFilterExpanded) {
                expandToggleBtn.style.display = 'block';
                if (this.tagFilterExpanded) {
                    expandToggleBtn.innerHTML = '▲';
                    expandToggleBtn.title = '收起标签';
                } else {
                    expandToggleBtn.innerHTML = '▼';
                    expandToggleBtn.title = '展开标签';
                }
            } else {
                expandToggleBtn.style.display = 'none';
            }
        }

        // 计算每个标签对应的会话数量
        const tagCounts = {};
        const allSessions = this._getSessionsFromLocal();
        let noTagsCount = 0; // 没有标签的会话数量

        allSessions.forEach(session => {
            const sessionTags = session.tags || [];
            const hasTags = sessionTags.length > 0 && sessionTags.some(t => t && t.trim());

            if (!hasTags) {
                noTagsCount++;
            } else if (Array.isArray(sessionTags)) {
                sessionTags.forEach(t => {
                    if (t && t.trim()) {
                        const normalizedTag = t.trim();
                        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
                    }
                });
            }
        });

        // 设置标签列表为可拖拽容器
        tagFilterList.style.cssText += `
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
            position: relative !important;
        `;

        // 添加拖拽样式表（如果还没有）
        if (!document.getElementById('tag-drag-styles')) {
            const style = document.createElement('style');
            style.id = 'tag-drag-styles';
            style.textContent = `
                .tag-filter-item {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .tag-filter-item:hover:not(.dragging) {
                    transform: translateY(-1px) !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
                }
                .tag-filter-item.dragging {
                    opacity: 0.5 !important;
                    transform: scale(0.92) rotate(2deg) !important;
                    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
                    cursor: grabbing !important;
                    z-index: 1000 !important;
                }
                .tag-filter-item.drag-over-top {
                    border-top: 3px solid #4CAF50 !important;
                    margin-top: 4px !important;
                    padding-top: 2px !important;
                    animation: pulse-top 0.3s ease !important;
                }
                .tag-filter-item.drag-over-bottom {
                    border-bottom: 3px solid #4CAF50 !important;
                    margin-bottom: 4px !important;
                    padding-bottom: 2px !important;
                    animation: pulse-bottom 0.3s ease !important;
                }
                @keyframes pulse-top {
                    0%, 100% { border-top-width: 3px; margin-top: 4px; }
                    50% { border-top-width: 4px; margin-top: 6px; }
                }
                @keyframes pulse-bottom {
                    0%, 100% { border-bottom-width: 3px; margin-bottom: 4px; }
                    50% { border-bottom-width: 4px; margin-bottom: 6px; }
                }
                .tag-filter-item.drag-hover {
                    background: #f0fdf4 !important;
                    border-color: #86efac !important;
                    transform: scale(1.05) !important;
                }
            `;
            document.head.appendChild(style);
        }

        // 先创建"没有标签"标签按钮（不参与拖拽排序）
        const noTagsBtn = document.createElement('button');
        noTagsBtn.className = 'tag-filter-item tag-filter-no-tags-item';
        noTagsBtn.draggable = false; // 不允许拖拽
        noTagsBtn.dataset.tagName = '__no_tags__';
        noTagsBtn.textContent = `没有标签 (${noTagsCount})`;
        noTagsBtn.title = '点击筛选没有标签的会话';
        const isNoTagsSelected = this.tagFilterNoTags || false;

        noTagsBtn.style.cssText = `
            padding: 4px 10px !important;
            border-radius: 12px !important;
            border: 1.5px solid ${isNoTagsSelected ? '#4CAF50' : '#e5e7eb'} !important;
            background: ${isNoTagsSelected ? '#4CAF50' : '#f9fafb'} !important;
            color: ${isNoTagsSelected ? 'white' : '#6b7280'} !important;
            font-size: 10px !important;
            font-weight: ${isNoTagsSelected ? '500' : '400'} !important;
            cursor: pointer !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            white-space: nowrap !important;
            line-height: 1.4 !important;
            position: relative !important;
            user-select: none !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
        `;

        // 点击事件：切换"没有标签"筛选
        noTagsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 允许反选"没有标签"筛选，即使没有选中其他标签
            this.tagFilterNoTags = !this.tagFilterNoTags;
            this.updateTagFilterUI();
            this.updateSessionSidebar();
        });

        // 鼠标悬停效果
        noTagsBtn.addEventListener('mouseenter', () => {
            if (!isNoTagsSelected) {
                noTagsBtn.style.background = '#f3f4f6';
                noTagsBtn.style.borderColor = '#d1d5db';
            }
        });

        noTagsBtn.addEventListener('mouseleave', () => {
            if (!isNoTagsSelected) {
                noTagsBtn.style.background = '#f9fafb';
                noTagsBtn.style.borderColor = '#e5e7eb';
            }
        });

        tagFilterList.appendChild(noTagsBtn);

        // 创建标签按钮（支持拖拽排序）
        visibleTags.forEach((tag, index) => {
            const tagBtn = document.createElement('button');
            tagBtn.className = 'tag-filter-item';
            tagBtn.draggable = true;
            tagBtn.dataset.tagName = tag;
            const count = tagCounts[tag] || 0;
            tagBtn.textContent = `${tag} (${count})`;
            tagBtn.title = `拖拽调整顺序 | 点击筛选`;
            const isSelected = this.selectedFilterTags && this.selectedFilterTags.includes(tag);

            tagBtn.style.cssText = `
                padding: 4px 10px !important;
                border-radius: 12px !important;
                border: 1.5px solid ${isSelected ? '#4CAF50' : '#e5e7eb'} !important;
                background: ${isSelected ? '#4CAF50' : '#f9fafb'} !important;
                color: ${isSelected ? 'white' : '#6b7280'} !important;
                font-size: 10px !important;
                font-weight: ${isSelected ? '500' : '400'} !important;
                cursor: grab !important;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                white-space: nowrap !important;
                line-height: 1.4 !important;
                position: relative !important;
                user-select: none !important;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
            `;

            // 拖拽开始
            tagBtn.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', tagBtn.outerHTML);
                e.dataTransfer.setData('text/plain', tag);

                // 添加拖拽中的类名（CSS会处理样式）
                tagBtn.classList.add('dragging');

                // 设置自定义拖拽图像
                const dragImage = tagBtn.cloneNode(true);
                dragImage.style.opacity = '0.8';
                dragImage.style.transform = 'rotate(3deg)';
                dragImage.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);

                // 延迟移除拖拽图像
                setTimeout(() => {
                    if (dragImage.parentNode) {
                        dragImage.parentNode.removeChild(dragImage);
                    }
                }, 0);
            });

            // 拖拽结束
            tagBtn.addEventListener('dragend', (e) => {
                tagBtn.classList.remove('dragging');
                tagBtn.style.cursor = 'grab';

                // 移除所有拖拽相关的样式和类名
                document.querySelectorAll('.tag-filter-item').forEach(item => {
                    item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
                    item.style.borderTop = '';
                    item.style.borderBottom = '';
                    item.style.marginTop = '';
                    item.style.marginBottom = '';
                    item.style.paddingTop = '';
                    item.style.paddingBottom = '';
                });
            });

            // 拖拽经过
            tagBtn.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

                // 如果当前元素正在被拖拽，跳过
                if (tagBtn.classList.contains('dragging')) {
                    return;
                }

                const rect = tagBtn.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;

                // 移除所有拖拽指示样式和类名
                document.querySelectorAll('.tag-filter-item').forEach(item => {
                    if (!item.classList.contains('dragging')) {
                        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
                    }
                });

                // 根据鼠标位置显示插入位置指示
                if (e.clientY < midY) {
                    tagBtn.classList.add('drag-over-top');
                    tagBtn.classList.remove('drag-over-bottom');
                } else {
                    tagBtn.classList.add('drag-over-bottom');
                    tagBtn.classList.remove('drag-over-top');
                }

                // 添加悬停效果
                tagBtn.classList.add('drag-hover');
            });

            // 拖拽离开
            tagBtn.addEventListener('dragleave', (e) => {
                // 检查鼠标是否真的离开了元素
                const rect = tagBtn.getBoundingClientRect();
                const x = e.clientX;
                const y = e.clientY;

                if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    tagBtn.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
                }
            });

            // 放置
            tagBtn.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const draggedTag = e.dataTransfer.getData('text/plain');
                const targetTag = tagBtn.dataset.tagName;

                if (draggedTag === targetTag) {
                    return;
                }

                // 获取所有标签（包括不可见的）
                const allTags = this.getAllTags();
                const draggedIndex = allTags.indexOf(draggedTag);
                const targetIndex = allTags.indexOf(targetTag);

                if (draggedIndex === -1 || targetIndex === -1) {
                    return;
                }

                // 计算新的插入位置
                const rect = tagBtn.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                let insertIndex = targetIndex;
                if (e.clientY < midY) {
                    insertIndex = targetIndex;
                } else {
                    insertIndex = targetIndex + 1;
                }

                // 调整插入位置（如果拖拽的元素在目标位置之前，需要减1）
                if (draggedIndex < insertIndex) {
                    insertIndex -= 1;
                }

                // 重新排序标签数组
                const newOrder = [...allTags];
                newOrder.splice(draggedIndex, 1);
                newOrder.splice(insertIndex, 0, draggedTag);

                // 保存新的顺序
                this.saveTagOrder(newOrder);

                // 显示成功提示
                this.showNotification('标签顺序已更新', 'success');

                // 更新UI（添加平滑过渡效果）
                setTimeout(() => {
                    this.updateTagFilterUI();
                }, 100);
            });

            tagBtn.addEventListener('mouseenter', (e) => {
                // 如果正在拖拽，不改变样式
                if (document.querySelector('.tag-filter-item.dragging')) {
                    return;
                }

                if (!isSelected) {
                    tagBtn.style.borderColor = '#4CAF50';
                    tagBtn.style.background = '#f0fdf4';
                    tagBtn.style.color = '#4CAF50';
                } else {
                    tagBtn.style.opacity = '0.95';
                }
            });
            tagBtn.addEventListener('mouseleave', () => {
                // 如果正在拖拽，不改变样式
                if (document.querySelector('.tag-filter-item.dragging')) {
                    return;
                }

                if (!isSelected) {
                    tagBtn.style.borderColor = '#e5e7eb';
                    tagBtn.style.background = '#f9fafb';
                    tagBtn.style.color = '#6b7280';
                } else {
                    tagBtn.style.opacity = '1';
                }
            });
            tagBtn.addEventListener('click', (e) => {
                // 如果是在拖拽过程中点击，不触发选中逻辑
                if (e.detail === 0) {
                    return;
                }

                // 初始化 selectedFilterTags 如果为 undefined
                if (this.selectedFilterTags === undefined) {
                    this.selectedFilterTags = [];
                }
                if (this.tagFilterNoTags === undefined) {
                    this.tagFilterNoTags = false;
                }

                const index = this.selectedFilterTags.indexOf(tag);
                if (index > -1) {
                    // 取消选中：允许取消所有标签，显示所有会话
                    this.selectedFilterTags.splice(index, 1);
                } else {
                    // 选中
                    this.selectedFilterTags.push(tag);
                }

                // 更新所有标签按钮（确保状态一致）
                this.updateTagFilterUI();
                // 更新会话列表（应用过滤）
                this.updateSessionSidebar();
            });

            tagFilterList.appendChild(tagBtn);
        });
    }

    // 创建OSS标签筛选器
    /**
    * 创建日历组件
    * 支持日期区间选择和折叠/展开功能
    */
    // 确保OSS标签管理UI存在




    async updateSessionSidebar(forceRefresh = false, skipBackendRefresh = false) {
        if (!this.sessionSidebar) {
            console.log('会话侧边栏未创建，跳过更新');
            return;
        }

        // 隐藏接口请求列表
        const apiRequestList = this.sessionSidebar.querySelector('.api-request-list');
        if (apiRequestList) {
            apiRequestList.style.display = 'none';
        }

        // 隐藏请求接口标签过滤器（只在请求接口视图中显示）
        const apiRequestTagFilterContainer = this.sessionSidebar.querySelector('.api-request-tag-filter-container');
        if (apiRequestTagFilterContainer) {
            apiRequestTagFilterContainer.style.display = 'none';
        }

        // 显示会话列表相关元素
        const tagFilterContainer = this.sessionSidebar.querySelector('.tag-filter-container');
        const batchToolbar = this.sessionSidebar.querySelector('#batch-toolbar');
        const scrollableContent = this.sessionSidebar.querySelector('.session-sidebar-scrollable-content');
        if (tagFilterContainer) {
            tagFilterContainer.style.display = 'block';
        }
        if (batchToolbar && this.batchMode) {
            batchToolbar.style.display = 'flex';
        }
        if (scrollableContent) {
            scrollableContent.style.display = 'flex';
        }

        // 更新搜索框占位符
        const searchInput = this.sessionSidebar.querySelector('#session-search-input');
        if (searchInput) {
            searchInput.placeholder = '搜索会话...';
        }

        // 不再自动选中标签，默认显示所有会话
        // 如果筛选标签为空，不进行自动选择，保持为空数组以显示所有会话
        // 确保"没有标签"筛选默认不选中
        if (this.tagFilterNoTags === undefined) {
            this.tagFilterNoTags = false;
        }

        // 更新标签过滤器UI
        this.updateTagFilterUI();

        // 更新视图切换按钮状态
        this.applyViewMode();

        const sessionList = this.sessionSidebar.querySelector('.session-list');
        if (!sessionList) {
            console.log('会话列表容器未找到，跳过更新');
            return;
        }
        sessionList.style.display = 'block';

        // 使用_getFilteredSessions获取筛选后的会话列表（与YiH5保持一致）
        let allSessions = this._getFilteredSessions();

        // 清空列表
        sessionList.innerHTML = '';

        console.log('当前会话数量:', allSessions.length);

        if (allSessions.length === 0) {
            // 如果没有会话，显示提示信息
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = `
                padding: 20px !important;
                text-align: center !important;
                color: #9ca3af !important;
                font-size: 12px !important;
            `;
            emptyMsg.textContent = '暂无会话';
            sessionList.appendChild(emptyMsg);
            return;
        }

        // 判断是否有筛选条件（与YiH5保持一致）
        const q = (this.sessionTitleFilter || '').trim();
        const hasFilter = q ||
                         (this.selectedFilterTags && this.selectedFilterTags.length > 0) ||
                         this.tagFilterNoTags ||
                         this.dateRangeFilter;

        // 排序逻辑：收藏的会话 > 无标签的会话 > 其他会话
        const sortedSessions = allSessions.sort((a, b) => {
            // 判断是否为无标签会话
            const aTags = Array.isArray(a.tags) ? a.tags.map((t) => String(t).trim()) : [];
            const bTags = Array.isArray(b.tags) ? b.tags.map((t) => String(t).trim()) : [];
            const aHasNoTags = aTags.length === 0 || !aTags.some((t) => t);
            const bHasNoTags = bTags.length === 0 || !bTags.some((t) => t);

            const aFavorite = a.isFavorite || false;
            const bFavorite = b.isFavorite || false;

            // 第一优先级：收藏状态
            if (aFavorite !== bFavorite) {
                return bFavorite ? 1 : -1;
            }

            // 第二优先级：无标签状态（只在非收藏会话中比较）
            if (!aFavorite && !bFavorite) {
                if (aHasNoTags !== bHasNoTags) {
                    return bHasNoTags ? 1 : -1; // 无标签的排在前面
                }
            }

            if (!hasFilter) {
                // 没有筛选条件：按修改时间倒序排序（最新的在前面）
                const aTime = a.updatedAt || a.lastAccessTime || a.lastActiveAt || a.createdAt || 0;
                const bTime = b.updatedAt || b.lastAccessTime || b.lastActiveAt || b.createdAt || 0;
                if (aTime !== bTime) {
                    return bTime - aTime;
                }
                // 如果时间相同，按会话ID排序（确保完全稳定）
                const aId = a.id || '';
                const bId = b.id || '';
                return aId.localeCompare(bId);
            } else {
                // 有筛选条件：按文件名排序（不区分大小写，支持中文和数字）
                const aTitle = (a.pageTitle || a.title || '').trim();
                const bTitle = (b.pageTitle || b.title || '').trim();
                const titleCompare = aTitle.localeCompare(bTitle, 'zh-CN', { numeric: true, sensitivity: 'base' });
                if (titleCompare !== 0) {
                    return titleCompare;
                }

                // 如果文件名相同，按更新时间排序（最新更新的在前）
                const aTime = a.updatedAt || a.createdAt || 0;
                const bTime = b.updatedAt || b.createdAt || 0;
                if (aTime !== bTime) {
                    return bTime - aTime;
                }

                // 如果更新时间也相同，按会话ID排序（确保完全稳定）
                const aId = a.id || '';
                const bId = b.id || '';
                return aId.localeCompare(bId);
            }
        });

        // 创建会话列表项
        for (let index = 0; index < sortedSessions.length; index++) {
            const session = sortedSessions[index];
            if (!session || !session.id) continue;

            const sessionItem = document.createElement('div');
            sessionItem.className = 'session-item';
            sessionItem.dataset.sessionId = session.id;

            // 添加选中状态类：检查当前会话是否是该会话
            let isActive = false;
            if (session.id === this.currentSessionId) {
                isActive = true;
                sessionItem.classList.add('active');
            }

            // 批量模式下添加选中状态类
            if (this.batchMode && this.selectedSessionIds.has(session.id)) {
                sessionItem.classList.add('selected');
            }

            // 设置会话项的基础样式（参考新闻列表）
            sessionItem.style.cssText = `
                padding: 12px !important;
                margin-bottom: 8px !important;
                background: ${isActive ? '#eff6ff' : '#ffffff'} !important;
                border: 1px solid ${isActive ? '#3b82f6' : '#e5e7eb'} !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                box-shadow: ${isActive ? '0 2px 4px rgba(59, 130, 246, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.05)'} !important;
                position: relative !important;
            `;

            // 创建复选框（仅在批量模式下显示）
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'session-checkbox';
            checkbox.dataset.sessionId = session.id;
            checkbox.checked = this.selectedSessionIds.has(session.id);
            checkbox.style.cssText = `
                width: 16px !important;
                height: 16px !important;
                cursor: pointer !important;
                margin-right: 8px !important;
                flex-shrink: 0 !important;
                display: ${this.batchMode ? 'block' : 'none'} !important;
            `;

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const sessionId = e.target.dataset.sessionId;
                if (e.target.checked) {
                    this.selectedSessionIds.add(sessionId);
                    sessionItem.classList.add('selected');
                } else {
                    this.selectedSessionIds.delete(sessionId);
                    sessionItem.classList.remove('selected');
                }
                this.updateBatchToolbar();
            });

            // 阻止复选框点击事件冒泡
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // 获取完整标题和显示标题（使用统一的辅助函数）
            const fullTitle = this._getSessionDisplayTitle(session);

            // 会话信息容器（参考新闻列表的结构）
            const sessionInfo = document.createElement('div');
            sessionInfo.className = 'session-info';
            sessionInfo.style.cssText = `
                margin-bottom: ${this.batchMode ? '0' : '8px'} !important;
            `;

            // 创建会话项内部容器（包含复选框和内容）
            const itemInner = document.createElement('div');
            itemInner.style.cssText = `
                display: flex !important;
                align-items: flex-start !important;
                width: 100% !important;
                gap: 8px !important;
            `;

            // 添加复选框
            itemInner.appendChild(checkbox);

            // 创建内容包装器
            const contentWrapper = document.createElement('div');
            contentWrapper.style.cssText = `
                flex: 1 !important;
                min-width: 0 !important;
            `;

            // 创建标题行容器（标题和按钮在同一行）
            const titleRow = document.createElement('div');
            titleRow.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 8px !important;
                width: 100% !important;
                margin-bottom: 6px !important;
            `;

            // 创建标题容器（包含图标和标题文本）
            const titleContainer = document.createElement('div');
            titleContainer.style.cssText = `
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                flex: 1 !important;
                min-width: 0 !important;
            `;

            // 标题
            const titleDiv = document.createElement('div');
            titleDiv.className = 'session-title';
            titleDiv.textContent = fullTitle;
            titleDiv.style.cssText = `
                font-size: 14px !important;
                font-weight: 600 !important;
                color: #111827 !important;
                line-height: 1.4 !important;
                display: -webkit-box !important;
                -webkit-line-clamp: 2 !important;
                -webkit-box-orient: vertical !important;
                overflow: hidden !important;
                flex: 1 !important;
                min-width: 0 !important;
            `;
            titleContainer.appendChild(titleDiv);
            titleRow.appendChild(titleContainer);

            // 所有会话都显示编辑标题按钮
            const shouldShowEditBtn = session && session.id;
            let editBtn = null;

            if (shouldShowEditBtn) {
                editBtn = document.createElement('button');
                editBtn.className = 'session-edit-btn';
                editBtn.innerHTML = '✏️';
                editBtn.title = '编辑标题';
                editBtn.style.cssText = `
                    background: none !important;
                    border: none !important;
                    cursor: pointer !important;
                    padding: 2px 4px !important;
                    font-size: 12px !important;
                    opacity: 0.6 !important;
                    transition: opacity 0.2s ease !important;
                    line-height: 1 !important;
                    flex-shrink: 0 !important;
                `;

                // 按钮悬停时增加不透明度
                editBtn.addEventListener('mouseenter', () => {
                    editBtn.style.opacity = '1';
                });
                editBtn.addEventListener('mouseleave', () => {
                    editBtn.style.opacity = '0.6';
                });

                // 阻止编辑按钮点击事件冒泡到 sessionItem
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editSessionTitle(session.id);
                });
            }

            // 创建标签管理按钮
            const tagBtn = document.createElement('button');
            tagBtn.className = 'session-tag-btn';
            tagBtn.innerHTML = '🏷️';
            tagBtn.title = '管理标签';
            tagBtn.style.cssText = `
                background: none !important;
                border: none !important;
                cursor: pointer !important;
                padding: 2px 4px !important;
                font-size: 12px !important;
                opacity: 0.6 !important;
                transition: opacity 0.2s ease !important;
                line-height: 1 !important;
                flex-shrink: 0 !important;
            `;

            // 按钮悬停时增加不透明度
            tagBtn.addEventListener('mouseenter', () => {
                tagBtn.style.opacity = '1';
            });
            tagBtn.addEventListener('mouseleave', () => {
                tagBtn.style.opacity = '0.6';
            });

            // 阻止标签按钮点击事件冒泡到 sessionItem
            tagBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openTagManager(session.id);
            });

            // 创建副本按钮
            const duplicateBtn = document.createElement('button');
            duplicateBtn.className = 'session-duplicate-btn';
            duplicateBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            `;
            duplicateBtn.title = '创建副本';
            duplicateBtn.style.cssText = `
                background: none !important;
                border: none !important;
                cursor: pointer !important;
                padding: 4px !important;
                opacity: 0.6 !important;
                transition: all 0.2s ease !important;
                line-height: 1 !important;
                flex-shrink: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: inherit !important;
                border-radius: 4px !important;
            `;

            // 按钮悬停时增加不透明度和背景色
            duplicateBtn.addEventListener('mouseenter', () => {
                duplicateBtn.style.opacity = '1';
                duplicateBtn.style.background = 'rgba(255, 255, 255, 0.1) !important';
            });
            duplicateBtn.addEventListener('mouseleave', () => {
                duplicateBtn.style.opacity = '0.6';
                duplicateBtn.style.background = 'none !important';
            });

            // 阻止副本按钮点击事件冒泡到 sessionItem
            duplicateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.duplicateSession(session.id);
            });

            // 创建页面上下文按钮
            const contextBtn = document.createElement('button');
            contextBtn.className = 'session-context-btn';
            contextBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            `;
            contextBtn.title = '页面上下文';
            contextBtn.style.cssText = `
                background: none !important;
                border: none !important;
                cursor: pointer !important;
                padding: 4px !important;
                opacity: 0.6 !important;
                transition: all 0.2s ease !important;
                line-height: 1 !important;
                flex-shrink: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: inherit !important;
                border-radius: 4px !important;
            `;

            // 按钮悬停时增加不透明度和背景色
            contextBtn.addEventListener('mouseenter', () => {
                contextBtn.style.opacity = '1';
                contextBtn.style.background = 'rgba(255, 255, 255, 0.1) !important';
            });
            contextBtn.addEventListener('mouseleave', () => {
                contextBtn.style.opacity = '0.6';
                contextBtn.style.background = 'none !important';
            });

            // 阻止页面上下文按钮点击事件冒泡到 sessionItem
            contextBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // 先激活该会话
                if (session.id !== this.currentSessionId) {
                    await this.activateSession(session.id);
                }
                // 确保聊天窗口已打开
                if (!this.chatWindow || !this.isChatOpen) {
                    await this.openChatWindow();
                }
                // 打开页面上下文编辑器
                this.openContextEditor();
            });

            // 创建打开URL按钮（如果URL以https://开头）
            let openUrlBtn = null;
            if (session.url && session.url.startsWith('https://')) {
                openUrlBtn = document.createElement('button');
                openUrlBtn.className = 'session-open-url-btn';
                openUrlBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                `;
                openUrlBtn.title = '在新标签页打开';
                openUrlBtn.style.cssText = `
                    background: none !important;
                    border: none !important;
                    cursor: pointer !important;
                    padding: 4px !important;
                    opacity: 0.6 !important;
                    transition: all 0.2s ease !important;
                    line-height: 1 !important;
                    flex-shrink: 0 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    color: inherit !important;
                    border-radius: 4px !important;
                `;

                // 按钮悬停时增加不透明度和背景色
                openUrlBtn.addEventListener('mouseenter', () => {
                    openUrlBtn.style.opacity = '1';
                    openUrlBtn.style.background = 'rgba(255, 255, 255, 0.1) !important';
                });
                openUrlBtn.addEventListener('mouseleave', () => {
                    openUrlBtn.style.opacity = '0.6';
                    openUrlBtn.style.background = 'none !important';
                });

                // 阻止打开URL按钮点击事件冒泡到 sessionItem
                openUrlBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        // 通过 background script 在新标签页中打开URL
                        const response = await chrome.runtime.sendMessage({
                            action: 'openLinkInNewTab',
                            url: session.url
                        });
                        if (response && response.success) {
                            console.log('URL已在新标签页打开:', session.url);
                        } else {
                            console.error('打开URL失败:', response?.error || '未知错误');
                        }
                    } catch (error) {
                        console.error('打开URL时出错:', error);
                        // 降级方案：使用 window.open
                        window.open(session.url, '_blank');
                    }
                });
            }

            // 创建收藏按钮
            const favoriteBtn = document.createElement('button');
            favoriteBtn.className = 'session-favorite-btn';
            const isFavorite = session.isFavorite || false;
            favoriteBtn.innerHTML = isFavorite ? '❤️' : '🤍';
            favoriteBtn.title = isFavorite ? '取消收藏' : '收藏';
            favoriteBtn.style.cssText = `
                background: none !important;
                border: none !important;
                cursor: pointer !important;
                padding: 2px 4px !important;
                font-size: 14px !important;
                opacity: ${isFavorite ? '1' : '0.6'} !important;
                transition: opacity 0.2s ease, transform 0.2s ease !important;
                line-height: 1 !important;
                flex-shrink: 0 !important;
            `;

            // 按钮悬停时增加不透明度
            favoriteBtn.addEventListener('mouseenter', () => {
                favoriteBtn.style.opacity = '1';
                favoriteBtn.style.transform = 'scale(1.1)';
            });
            favoriteBtn.addEventListener('mouseleave', () => {
                favoriteBtn.style.opacity = isFavorite ? '1' : '0.6';
                favoriteBtn.style.transform = 'scale(1)';
            });

            // 阻止收藏按钮点击事件冒泡到 sessionItem
            favoriteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleSessionFavorite(session.id);
            });

            // 将收藏按钮直接添加到标题行（始终显示）
            titleRow.appendChild(favoriteBtn);

            // 创建按钮容器（在标题行中，但默认隐藏，悬停时显示）
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex !important;
                align-items: center !important;
                gap: 2px !important;
                opacity: 0 !important;
                transition: opacity 0.2s ease !important;
                flex-shrink: 0 !important;
            `;
            // 只有编辑按钮存在时才添加
            if (editBtn) {
                buttonContainer.appendChild(editBtn);
            }
            buttonContainer.appendChild(tagBtn);
            buttonContainer.appendChild(duplicateBtn);
            buttonContainer.appendChild(contextBtn);

            // 将按钮容器添加到标题行
            titleRow.appendChild(buttonContainer);

            // 悬停效果（参考新闻列表）
            sessionItem.addEventListener('mouseenter', () => {
                if (!isActive) {
                    sessionItem.style.background = '#f9fafb !important';
                    sessionItem.style.borderColor = '#d1d5db !important';
                    sessionItem.style.transform = 'translateY(-1px)';
                    sessionItem.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1) !important';
                }
                buttonContainer.style.opacity = '1';
                footerButtonContainer.style.opacity = '1';
            });

            sessionItem.addEventListener('mouseleave', () => {
                if (!isActive) {
                    sessionItem.style.background = '#ffffff !important';
                    sessionItem.style.borderColor = '#e5e7eb !important';
                    sessionItem.style.transform = 'translateY(0)';
                    sessionItem.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05) !important';
                }
                buttonContainer.style.opacity = '0';
                footerButtonContainer.style.opacity = '0.6';
            });

            sessionInfo.appendChild(titleRow);

            // 描述（如果有pageDescription）
            const descriptionText = session.pageDescription && session.pageDescription.trim();
            if (descriptionText) {
                const description = document.createElement('div');
                description.className = 'session-description';
                description.style.cssText = `
                    font-size: 12px !important;
                    color: #6b7280 !important;
                    margin-bottom: 8px !important;
                    line-height: 1.5 !important;
                    display: -webkit-box !important;
                    -webkit-line-clamp: 2 !important;
                    -webkit-box-orient: vertical !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    word-break: break-word !important;
                `;
                description.textContent = descriptionText;
                sessionInfo.appendChild(description);
            }

            // 标签区域（参考新闻列表的标签样式）
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'session-tags';
            tagsContainer.style.cssText = `
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 4px !important;
                margin-bottom: 8px !important;
            `;
            // 如果有标签，显示标签
            const tags = session.tags || [];
            if (tags.length > 0) {
                // 规范化标签（trim处理，与getAllTags保持一致）
                const normalizedTags = tags.map(tag => tag ? tag.trim() : '').filter(tag => tag.length > 0);

                normalizedTags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'session-tag-item';
                    tagElement.textContent = tag;
                    // 根据标签内容生成颜色（使用哈希函数确保相同标签颜色一致）
                    const tagColor = this.getTagColor(tag);
                    tagElement.style.cssText = `
                        display: inline-block !important;
                        padding: 3px 10px !important;
                        background: ${tagColor.background} !important;
                        color: ${tagColor.text} !important;
                        border-radius: 12px !important;
                        font-size: 11px !important;
                        font-weight: 500 !important;
                        border: 1px solid ${tagColor.border} !important;
                        transition: all 0.2s ease !important;
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
                    `;
                    // 添加悬停效果
                    tagElement.addEventListener('mouseenter', () => {
                        tagElement.style.transform = 'translateY(-1px)';
                        tagElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                    });
                    tagElement.addEventListener('mouseleave', () => {
                        tagElement.style.transform = 'translateY(0)';
                        tagElement.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                    });
                    tagsContainer.appendChild(tagElement);
                });
            }
            sessionInfo.appendChild(tagsContainer);

            // 底部信息（时间和操作按钮）
            const footer = document.createElement('div');
            footer.style.cssText = `
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                font-size: 11px !important;
                color: #9ca3af !important;
                margin-top: 8px !important;
            `;

            const time = document.createElement('span');
            // 优先使用 lastAccessTime 或 lastActiveAt，与 YiH5 保持一致
            const sessionTime = session.lastAccessTime || session.lastActiveAt || session.updatedAt || session.createdAt || 0;
            if (sessionTime) {
                const date = new Date(sessionTime);
                // 检查日期是否有效
                if (!isNaN(date.getTime())) {
                    time.textContent = this.formatDate(date);
                } else {
                    time.textContent = '';
                }
            } else {
                time.textContent = '';
            }
            footer.appendChild(time);

            // 操作按钮容器（移动到footer中）
            const footerButtonContainer = document.createElement('div');
            footerButtonContainer.style.cssText = `
                display: flex !important;
                align-items: center !important;
                gap: 4px !important;
                opacity: 0.6 !important;
                transition: opacity 0.2s ease !important;
            `;

            // 编辑按钮（如果存在）
            if (editBtn) {
                footerButtonContainer.appendChild(editBtn);
            }

            // 标签管理按钮
            footerButtonContainer.appendChild(tagBtn);

            // 副本按钮
            footerButtonContainer.appendChild(duplicateBtn);

            // 页面上下文按钮
            footerButtonContainer.appendChild(contextBtn);

            // 打开新tab按钮（如果存在）
            if (openUrlBtn) {
                footerButtonContainer.appendChild(openUrlBtn);
            }

            footer.appendChild(footerButtonContainer);

            sessionInfo.appendChild(footer);

            contentWrapper.appendChild(sessionInfo);
            itemInner.appendChild(contentWrapper);
            sessionItem.appendChild(itemInner);

            // 长按删除相关变量
            let longPressTimer = null;
            let longPressProgressTimer = null;
            let longPressThreshold = 800; // 长按时间阈值（毫秒）
            let isLongPressing = false;
            let hasMoved = false;
            let startX = 0;
            let startY = 0;
            let longPressStartTime = 0;
            const moveThreshold = 10; // 移动阈值，超过此值则取消长按

            // 创建长按进度指示器
            const progressBar = document.createElement('div');
            progressBar.className = 'long-press-progress';
            progressBar.style.cssText = `
                position: absolute !important;
                bottom: 0 !important;
                left: 0 !important;
                height: 3px !important;
                background: rgba(244, 67, 54, 0.8) !important;
                width: 0% !important;
                border-radius: 0 0 8px 8px !important;
                transition: width 0.05s linear !important;
                z-index: 10 !important;
            `;
            sessionItem.appendChild(progressBar);

            // 创建长按提示文本
            const hintText = document.createElement('div');
            hintText.className = 'long-press-hint';
            hintText.textContent = '继续按住以删除';
            hintText.style.cssText = `
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) scale(0) !important;
                background: rgba(244, 67, 54, 0.95) !important;
                color: white !important;
                padding: 6px 12px !important;
                border-radius: 6px !important;
                font-size: 12px !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                z-index: 20 !important;
                opacity: 0 !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
            `;
            sessionItem.appendChild(hintText);

            // 清除长按定时器
            const clearLongPress = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                if (longPressProgressTimer) {
                    clearInterval(longPressProgressTimer);
                    longPressProgressTimer = null;
                }
                if (isLongPressing) {
                    sessionItem.classList.remove('long-pressing', 'long-press-start',
                        'long-press-stage-1', 'long-press-stage-2', 'long-press-stage-3');
                    isLongPressing = false;
                } else {
                    // 即使没有完成长按，也要清除开始状态和阶段状态
                    sessionItem.classList.remove('long-press-start',
                        'long-press-stage-1', 'long-press-stage-2', 'long-press-stage-3');
                }
                hasMoved = false;
                progressBar.style.width = '0%';
                hintText.style.opacity = '0';
                hintText.style.transform = 'translate(-50%, -50%) scale(0)';
                longPressStartTime = 0;
            };

            // 触觉反馈（如果支持）
            const triggerHapticFeedback = () => {
                if ('vibrate' in navigator) {
                    navigator.vibrate(50); // 短震动
                }
            };

            // 开始长按检测
            const startLongPress = (e) => {
                // 如果正在切换会话，忽略
                if (this.isSwitchingSession) {
                    return;
                }

                hasMoved = false;
                startX = e.touches ? e.touches[0].clientX : e.clientX;
                startY = e.touches ? e.touches[0].clientY : e.clientY;
                longPressStartTime = Date.now();

                // 添加开始长按的视觉反馈
                sessionItem.classList.add('long-press-start');

                // 显示提示文本（延迟一点，避免立即显示）
                setTimeout(() => {
                    if (longPressStartTime && !hasMoved) {
                        hintText.style.opacity = '1';
                        hintText.style.transform = 'translate(-50%, -50%) scale(1)';
                    }
                }, 200);

                // 开始进度条动画
                let lastStage = 0;
                const progressInterval = 50; // 每50ms更新一次
                longPressProgressTimer = setInterval(() => {
                    if (hasMoved || !longPressStartTime) {
                        clearInterval(longPressProgressTimer);
                        return;
                    }

                    const elapsed = Date.now() - longPressStartTime;
                    const progress = Math.min((elapsed / longPressThreshold) * 100, 100);
                    progressBar.style.width = progress + '%';

                    // 在不同阶段添加反馈（确保每个阶段只触发一次）
                    if (progress >= 30 && progress < 35 && lastStage < 1) {
                        sessionItem.classList.add('long-press-stage-1');
                        lastStage = 1;
                    } else if (progress >= 60 && progress < 65 && lastStage < 2) {
                        sessionItem.classList.remove('long-press-stage-1');
                        sessionItem.classList.add('long-press-stage-2');
                        lastStage = 2;
                        triggerHapticFeedback(); // 中期震动
                    } else if (progress >= 90 && progress < 95 && lastStage < 3) {
                        sessionItem.classList.remove('long-press-stage-2');
                        sessionItem.classList.add('long-press-stage-3');
                        lastStage = 3;
                        triggerHapticFeedback(); // 接近完成时的震动
                    }

                    if (progress >= 100) {
                        clearInterval(longPressProgressTimer);
                    }
                }, progressInterval);

                longPressTimer = setTimeout(async () => {
                    if (!hasMoved) {
                        isLongPressing = true;
                        sessionItem.classList.add('long-pressing');
                        triggerHapticFeedback(); // 触发删除前的震动

                        // 获取会话标题用于提示
                        const sessionTitle = session?.pageTitle || session.id || '未命名会话';

                        // 确认删除
                        const confirmDelete = confirm(`确定要删除会话"${sessionTitle}"吗？`);
                        if (!confirmDelete) {
                            // 用户取消删除，清除长按状态
                            clearLongPress();
                            return;
                        }

                        // 触发删除（异步执行，删除完成后清除状态）
                        try {
                            await this.deleteSession(session.id, true); // 传入 true 跳过确认弹框
                        } catch (error) {
                            console.error('删除会话失败:', error);
                        } finally {
                            // 清除长按状态
                            clearLongPress();
                        }
                    }
                }, longPressThreshold);
            };

            // 结束长按检测
            const endLongPress = () => {
                clearLongPress();
            };

            // 移动检测（取消长按）
            const handleMove = (e) => {
                const currentX = e.touches ? e.touches[0].clientX : e.clientX;
                const currentY = e.touches ? e.touches[0].clientY : e.clientY;
                const deltaX = Math.abs(currentX - startX);
                const deltaY = Math.abs(currentY - startY);

                if (deltaX > moveThreshold || deltaY > moveThreshold) {
                    hasMoved = true;
                    clearLongPress();
                }
            };

            // 触摸事件（移动设备）
            sessionItem.addEventListener('touchstart', (e) => {
                startLongPress(e);
            }, { passive: true });

            sessionItem.addEventListener('touchmove', (e) => {
                handleMove(e);
            }, { passive: true });

            sessionItem.addEventListener('touchend', () => {
                endLongPress();
            }, { passive: true });

            sessionItem.addEventListener('touchcancel', () => {
                endLongPress();
            }, { passive: true });

            // 鼠标事件（桌面设备）
            sessionItem.addEventListener('mousedown', (e) => {
                startLongPress(e);
            });

            sessionItem.addEventListener('mousemove', (e) => {
                if (longPressTimer) {
                    handleMove(e);
                }
            });

            sessionItem.addEventListener('mouseup', () => {
                endLongPress();
            });

            sessionItem.addEventListener('mouseleave', () => {
                endLongPress();
            });

            // 点击会话项切换到该会话
            sessionItem.addEventListener('click', async (e) => {
                // 如果点击的是复选框，不执行切换操作
                if (e.target.type === 'checkbox' || e.target.closest('.session-checkbox')) {
                    return;
                }

                // 如果正在长按，不执行点击
                if (isLongPressing || hasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                // 如果正在切换，忽略点击
                if (this.isSwitchingSession) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                // 批量模式下，点击切换选中状态
                if (this.batchMode) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                    return;
                }

                // 如果点击的是当前会话，查找并切换到 URL 为 https://effiy.cn/ 的会话
                if (session.id === this.currentSessionId) {
                    // 添加点击反馈
                    sessionItem.classList.add('clicked');

                    // 查找 URL 为 https://effiy.cn/ 的会话
                    const targetUrl = 'https://effiy.cn/';
                    const targetSession = this.findSessionByUrl(targetUrl);

                    if (targetSession && targetSession.id) {
                        // 找到目标会话，切换到该会话
                        sessionItem.style.pointerEvents = 'none';
                        try {
                            await this.switchSession(targetSession.id);
                        } catch (error) {
                            console.error('切换会话失败:', error);
                            sessionItem.classList.remove('switching', 'clicked');
                        } finally {
                            setTimeout(() => {
                                sessionItem.style.pointerEvents = '';
                                sessionItem.classList.remove('clicked');
                            }, 300);
                        }
                    } else {
                        // 未找到目标会话，只添加视觉反馈
                        setTimeout(() => {
                            sessionItem.classList.remove('clicked');
                        }, 150);
                    }
                    return;
                }

                // 立即添加点击反馈
                sessionItem.classList.add('clicked');

                // 防止重复点击：快速禁用
                sessionItem.style.pointerEvents = 'none';

                try {
                    // 切换会话
                    await this.switchSession(session.id);
                } catch (error) {
                    console.error('切换会话失败:', error);
                    // 移除加载状态
                    sessionItem.classList.remove('switching', 'clicked');
                } finally {
                    // 恢复交互（延迟一点，避免过快重复点击）
                    setTimeout(() => {
                        sessionItem.style.pointerEvents = '';
                        sessionItem.classList.remove('clicked');
                    }, 300);
                }
            });

            sessionList.appendChild(sessionItem);
        }

        console.log('会话侧边栏已更新，显示', sortedSessions.length, '个会话');
    }



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
    _getRequestKey(req) {
        if (!req) return null;
        // 只返回"可持久化"的唯一标识（来自后端/API的数据）
        // 规则：优先使用 req.key，其次 _id / id（并同步写回 req.key 以便后续一致使用）
        // 确保返回的 key 是有效的非空字符串
        if (req.key && typeof req.key === 'string' && req.key.trim() !== '') {
            return req.key;
        }
        if (req._id && typeof req._id === 'string' && req._id.trim() !== '') {
            req.key = req._id;
            return req.key;
        }
        if (req.id && typeof req.id === 'string' && req.id.trim() !== '') {
            req.key = req.id;
            return req.key;
        }
        // 非API数据（本地拦截/临时数据）不生成 key，避免重渲染后 key 变化导致"选中丢失/错位"
        return null;
    }

    /**
     * 确保请求有 key 字段（如果没有则生成一个）
     * @param {Object} req - 请求对象
     * @returns {string|null} key 值
     */
    _ensureRequestKey(req) {
        if (!req) return null;
        // 仅为后端/API数据补齐 key；不为本地/临时数据生成 key（避免 key 不稳定）
        // 如果已有 key，直接返回（确保是有效的非空字符串）
        if (req.key && typeof req.key === 'string' && req.key.trim() !== '') {
            return req.key;
        }
        // 如果有 _id，使用 _id 作为 key（确保是有效的非空字符串）
        if (req._id && typeof req._id === 'string' && req._id.trim() !== '') {
            req.key = req._id;
            return req.key;
        }
        // 如果有 id，使用 id 作为 key（确保是有效的非空字符串）
        if (req.id && typeof req.id === 'string' && req.id.trim() !== '') {
            req.key = req.id;
            return req.key;
        }
        return null;
    }


    // 格式化日期为 YYYY-MM-DD（用于新闻API）
    formatDateForNews(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 获取新闻时间戳
    getNewsTime(item) {
        if (!item) {
            return 0;
        }

        // 辅助函数：安全地解析日期
        const parseDate = (dateValue, fieldName) => {
            if (!dateValue) return null;

            // 如果已经是时间戳（数字）
            if (typeof dateValue === 'number') {
                // 检查是否是有效的时间戳（毫秒或秒）
                if (dateValue > 0) {
                    // 如果是秒级时间戳（小于 1970-01-01 的毫秒数），转换为毫秒
                    if (dateValue < 10000000000) {
                        return dateValue * 1000;
                    }
                    return dateValue;
                }
                return null;
            }

            // 如果是 Date 对象
            if (dateValue instanceof Date) {
                const timestamp = dateValue.getTime();
                return isNaN(timestamp) ? null : timestamp;
            }

            // 如果是字符串，尝试解析
            if (typeof dateValue === 'string') {
                // 去除前后空格
                const trimmedValue = dateValue.trim();
                if (!trimmedValue) return null;

                // 首先尝试标准 Date 解析
                let date = new Date(trimmedValue);
                let timestamp = date.getTime();

                // 如果标准解析失败，尝试其他格式
                if (isNaN(timestamp) || timestamp <= 0) {
                    // 尝试多种日期格式
                    const formats = [
                        trimmedValue, // 原始值
                        trimmedValue.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3'), // YYYY-MM-DD -> YYYY/MM/DD
                        trimmedValue.replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3'), // YYYYMMDD -> YYYY/MM/DD
                        trimmedValue.replace(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/, '$1/$2/$3 $4:$5:$6'), // YYYY-MM-DD HH:mm:ss
                        trimmedValue.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1/$2/$3 $4:$5:$6'), // YYYYMMDDHHmmss
                    ];

                    for (const format of formats) {
                        if (format === trimmedValue) continue; // 跳过已尝试的原始值
                        date = new Date(format);
                        timestamp = date.getTime();
                        if (!isNaN(timestamp) && timestamp > 0) {
                            break;
                        }
                    }
                }

                // 检查是否解析成功（无效日期会返回 NaN）
                if (!isNaN(timestamp) && timestamp > 0) {
                    return timestamp;
                } else {
                    // 调试：输出无法解析的日期
                    console.warn(`无法解析日期字段 ${fieldName}:`, dateValue, '类型:', typeof dateValue);
                }
            }

            return null;
        };

        // 按优先级尝试各个字段，优先使用 published
        const timeFields = ['published', 'pubDate', 'publishedAt', 'date', 'created_at', 'createdAt', 'publishDate', 'pub_date', 'publish_date'];

        for (const field of timeFields) {
            if (item[field] !== undefined && item[field] !== null) {
                const timestamp = parseDate(item[field], field);
                if (timestamp !== null && timestamp > 0) {
                    // 只在调试模式下输出（可以通过控制台查看）
                    if (window.DEBUG_NEWS_TIME) {
                        console.log(`成功解析时间字段 ${field}:`, item[field], '->', timestamp, '->', new Date(timestamp).toLocaleString('zh-CN'));
                    }
                    return timestamp;
                }
            }
        }

        // 调试：如果所有字段都找不到，输出新闻项的所有键以便调试（只输出一次）
        if (!this._timeFieldWarningShown) {
            console.warn('未找到有效的时间字段，新闻项可用字段:', Object.keys(item), '示例数据:', item);
            this._timeFieldWarningShown = true;
        }

        return 0;
    }




    // 创建表单组（辅助函数）
    createFormGroup(labelText, inputType, inputClass, placeholder, rows = 1) {
        const group = document.createElement('div');
        group.style.cssText = `margin-bottom: 16px !important;`;

        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.cssText = `
            display: block !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            color: #374151 !important;
            margin-bottom: 8px !important;
        `;

        let input;
        if (inputType === 'textarea') {
            input = document.createElement('textarea');
            input.rows = rows;
        } else {
            input = document.createElement('input');
            input.type = inputType;
        }
        input.className = inputClass;
        input.placeholder = placeholder;
        input.style.cssText = `
            width: 100% !important;
            padding: 10px 12px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            box-sizing: border-box !important;
            transition: border-color 0.2s ease !important;
            font-family: inherit !important;
        `;
        input.addEventListener('focus', () => {
            input.style.borderColor = '#3b82f6';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = '#d1d5db';
        });

        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    // 填充Headers编辑器
    populateHeadersEditor(container, headers) {
        container.innerHTML = '';

        // 添加默认的Content-Type header（如果是POST/PUT等）
        const headerRows = [];
        if (headers && Object.keys(headers).length > 0) {
            Object.entries(headers).forEach(([key, value]) => {
                headerRows.push({ key, value, enabled: true });
            });
        }

        // 如果没有headers，至少添加一行空行
        if (headerRows.length === 0) {
            headerRows.push({ key: '', value: '', enabled: true });
        }

        headerRows.forEach((row, index) => {
            const rowElement = this.createHeaderRow(row.key, row.value, row.enabled, index);
            container.appendChild(rowElement);
        });

        // 添加"添加Header"按钮
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ 添加Header';
        addBtn.style.cssText = `
            width: 100% !important;
            padding: 10px !important;
            border: 1px dashed #d1d5db !important;
            border-top: none !important;
            background: white !important;
            color: #6b7280 !important;
            font-size: 13px !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.background = '#f9fafb';
            addBtn.style.borderColor = '#3b82f6';
            addBtn.style.color = '#3b82f6';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.background = 'white';
            addBtn.style.borderColor = '#d1d5db';
            addBtn.style.color = '#6b7280';
        });
        addBtn.addEventListener('click', () => {
            const newRow = this.createHeaderRow('', '', true, headerRows.length);
            container.insertBefore(newRow, addBtn);
        });
        container.appendChild(addBtn);
    }

    // 创建Header行
    createHeaderRow(key, value, enabled, index) {
        const row = document.createElement('div');
        row.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            padding: 8px !important;
            border-bottom: 1px solid #e5e7eb !important;
            align-items: center !important;
        `;

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'Header名称';
        keyInput.value = key;
        keyInput.style.cssText = `
            flex: 1 !important;
            padding: 6px 8px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-family: 'Monaco', 'Menlo', monospace !important;
        `;

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.placeholder = 'Header值';
        valueInput.value = value;
        valueInput.style.cssText = `
            flex: 2 !important;
            padding: 6px 8px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            font-family: 'Monaco', 'Menlo', monospace !important;
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '✕';
        deleteBtn.style.cssText = `
            padding: 4px 8px !important;
            border: none !important;
            background: #ef4444 !important;
            color: white !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            transition: all 0.2s ease !important;
        `;
        deleteBtn.addEventListener('mouseenter', () => {
            deleteBtn.style.background = '#dc2626';
        });
        deleteBtn.addEventListener('mouseleave', () => {
            deleteBtn.style.background = '#ef4444';
        });
        deleteBtn.addEventListener('click', () => {
            row.remove();
        });

        row.appendChild(keyInput);
        row.appendChild(valueInput);
        row.appendChild(deleteBtn);

        return row;
    }

    // 检测Body类型
    detectBodyType(body) {
        if (!body) return 'none';
        if (typeof body === 'string') {
            try {
                JSON.parse(body);
                return 'json';
            } catch {
                return 'raw';
            }
        }
        if (typeof body === 'object') {
            return 'json';
        }
        return 'none';
    }

    // 更新Body编辑器
    updateBodyEditor(typeSelect, textarea, body) {
        const type = typeSelect.value;

        if (type === 'none') {
            textarea.style.display = 'none';
            textarea.value = '';
        } else {
            textarea.style.display = 'block';

            if (body !== null && body !== undefined) {
                if (type === 'json') {
                    if (typeof body === 'object') {
                        textarea.value = JSON.stringify(body, null, 2);
                    } else if (typeof body === 'string') {
                        try {
                            const parsed = JSON.parse(body);
                            textarea.value = JSON.stringify(parsed, null, 2);
                        } catch {
                            textarea.value = body;
                        }
                    } else {
                        textarea.value = '';
                    }
                } else {
                    textarea.value = typeof body === 'string' ? body : JSON.stringify(body);
                }
            } else {
                if (type === 'json') {
                    textarea.value = '{\n  \n}';
                } else {
                    textarea.value = '';
                }
            }
        }
    }

    // 格式化JSON Body
    formatJsonBody(textarea) {
        if (!textarea) {
            return;
        }

        const currentValue = textarea.value.trim();

        if (!currentValue) {
            // 如果为空，设置为空的JSON对象
            textarea.value = '{\n  \n}';
            return;
        }

        try {
            // 尝试解析JSON
            const parsed = JSON.parse(currentValue);
            // 格式化JSON（使用2个空格缩进）
            const formatted = JSON.stringify(parsed, null, 2);
            textarea.value = formatted;

            // 显示成功提示（可选）
            this.showApiRequestNotification('JSON格式化成功', 'success');
        } catch (error) {
            // JSON格式错误，显示错误提示
            this.showApiRequestNotification('JSON格式错误：' + error.message, 'error');
        }
    }







    // 优化页面上下文内容
    /**
     * 清理和优化文本内容
     * 去除HTML标签、无意义内容，保留核心信息
     * @param {string} text - 待清理的文本
     * @returns {string} 清理后的文本
     */
    _cleanAndOptimizeText(text) {
        if (!text || typeof text !== 'string') return '';

        let cleaned = text;

        // 1. 去除HTML标签（保留代码块中的内容）
        // 先保护代码块
        const codeBlocks = [];
        cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(match);
            return placeholder;
        });

        // 去除所有HTML标签，但保留标签内的文本内容
        cleaned = cleaned.replace(/<[^>]+>/g, '');

        // 恢复代码块
        codeBlocks.forEach((block, index) => {
            cleaned = cleaned.replace(`__CODE_BLOCK_${index}__`, block);
        });

        // 2. 去除HTML实体编码（如 &nbsp; &lt; &gt; 等）
        cleaned = cleaned.replace(/&nbsp;/g, ' ');
        cleaned = cleaned.replace(/&lt;/g, '<');
        cleaned = cleaned.replace(/&gt;/g, '>');
        cleaned = cleaned.replace(/&amp;/g, '&');
        cleaned = cleaned.replace(/&quot;/g, '"');
        cleaned = cleaned.replace(/&#39;/g, "'");
        cleaned = cleaned.replace(/&[a-z]+;/gi, '');

        // 3. 去除无意义的重复内容
        // 去除重复的换行（保留代码块中的）
        const codeBlockPlaceholders = [];
        cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
            const placeholder = `__CODE_${codeBlockPlaceholders.length}__`;
            codeBlockPlaceholders.push(match);
            return placeholder;
        });

        // 去除多个连续换行（保留段落间距）
        cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

        // 恢复代码块
        codeBlockPlaceholders.forEach((block, index) => {
            cleaned = cleaned.replace(`__CODE_${index}__`, block);
        });

        // 4. 去除无意义的空白字符（但保留代码块和列表中的）
        // 保护代码块和列表项
        const protectedBlocks = [];
        cleaned = cleaned.replace(/(```[\s\S]*?```|^[\s]*[-*+]\s+|^\s*\d+\.\s+)/gm, (match) => {
            const placeholder = `__PROTECTED_${protectedBlocks.length}__`;
            protectedBlocks.push(match);
            return placeholder;
        });

        // 合并多个空格为一个（但保留行首缩进）
        cleaned = cleaned.replace(/[ \t]+/g, (match, offset, string) => {
            // 如果是在行首，保留一个空格或制表符
            const lineStart = string.lastIndexOf('\n', offset - 1) + 1;
            if (offset === lineStart) {
                return match.includes('\t') ? '\t' : ' ';
            }
            return ' ';
        });

        // 恢复受保护的内容
        protectedBlocks.forEach((block, index) => {
            cleaned = cleaned.replace(`__PROTECTED_${index}__`, block);
        });

        // 5. 去除无意义的标记和符号
        // 去除多余的Markdown标记（但保留有效的）
        cleaned = cleaned.replace(/\*\*\*\*/g, ''); // 四个星号
        cleaned = cleaned.replace(/^#{7,}\s+/gm, ''); // 超过6级的标题标记

        // 6. 清理首尾空白
        cleaned = cleaned.trim();

        return cleaned;
    }

    async optimizeContext() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;

        const originalText = textarea.value.trim();
        if (!originalText) {
            this.showNotification('请先输入内容', 'warning');
            return;
        }

        // 保存原始文本，用于撤销功能
        if (!textarea.hasAttribute('data-original-text')) {
            textarea.setAttribute('data-original-text', originalText);
        }

        // 获取优化按钮和撤销按钮
        const optimizeBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-optimize-btn') : null;
        const undoBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-undo-btn') : null;
        const originalBtnText = optimizeBtn ? optimizeBtn.textContent : '';

        // 禁用按钮，显示加载状态
        if (optimizeBtn) {
            optimizeBtn.disabled = true;
            optimizeBtn.textContent = '优化中...';
            optimizeBtn.style.opacity = '0.6';
            optimizeBtn.style.cursor = 'not-allowed';
        }

        try {
            // 构建优化提示词（强调保留原文、去除无意义内容、优化HTML标签）
            const systemPrompt = `你是一个专业的文档内容优化专家，擅长：
1. 保留原文的核心信息和完整内容，不丢失重要信息
2. 去除无意义的重复内容、冗余描述和无关信息
3. 优化和清理HTML标签，将HTML内容转换为清晰的Markdown格式
4. 优化文档结构和层次，使其逻辑清晰、层次分明
5. 改进语言表达，使其更加流畅自然、易于理解
6. 提升可读性，优化段落组织和过渡
7. 确保Markdown格式规范美观，标题层级清晰

请优化页面上下文内容，重点保留原文信息，去除无意义内容，优化HTML标签。`;

            const userPrompt = `请优化以下页面上下文内容，要求：

【核心要求】
1. **必须保留原文的所有核心信息和完整内容**，不能丢失重要信息
2. **去除无意义的重复内容、冗余描述、无关信息**（如重复的导航链接、广告文本、无意义的装饰性内容等）
3. **优化HTML标签**：将HTML标签转换为清晰的Markdown格式，去除无用的HTML标签，但保留文本内容
4. **优化文档结构**：使逻辑更清晰、层次更分明
5. **改进语言表达**：使其更加流畅自然
6. **提升可读性**：优化段落组织和过渡
7. **保持Markdown格式有效性**：确保标题层级清晰，段落之间过渡自然

【注意事项】
- 不要添加原文中没有的新内容
- 不要改变原文的核心意思
- 去除HTML标签时，要保留标签内的文本内容
- 去除无意义的导航、广告、重复性内容
- 保持Markdown格式的规范性

原始内容：
${originalText}

请直接返回优化后的Markdown内容，不要包含任何说明文字、引号或其他格式标记。`;

            // 构建请求 payload
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 显示加载动画
            this._showLoadingAnimation();

            // 调用 prompt 接口
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 先获取文本响应，检查是否是SSE格式
            const responseText = await response.text();
            let result;

            // 检查是否包含SSE格式（包含 "data: "）
            if (responseText.includes('data: ')) {
                // 处理SSE流式响应
                const lines = responseText.split('\n');
                let accumulatedData = '';
                let lastValidData = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            // 尝试解析JSON
                            const chunk = JSON.parse(dataStr);

                            // 检查是否完成
                            if (chunk.done === true) {
                                break;
                            }

                            // 累积内容（处理流式内容块）
                            if (chunk.data) {
                                accumulatedData += chunk.data;
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                // Ollama格式
                                accumulatedData += chunk.message.content;
                            } else if (typeof chunk === 'string') {
                                accumulatedData += chunk;
                            }

                            // 保存最后一个有效的数据块（用于提取其他字段如status等）
                            lastValidData = chunk;
                        } catch (e) {
                            // 如果不是JSON，可能是纯文本内容
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                accumulatedData += dataStr;
                            }
                        }
                    }
                }

                // 如果累积了内容，创建结果对象
                if (accumulatedData || lastValidData) {
                    if (lastValidData && lastValidData.status) {
                        // 如果有status字段，保留原有结构，但替换data/content
                        result = {
                            ...lastValidData,
                            data: accumulatedData || lastValidData.data || '',
                            content: accumulatedData || lastValidData.content || ''
                        };
                    } else {
                        result = {
                            data: accumulatedData,
                            content: accumulatedData
                        };
                    }
                } else {
                    // 如果没有累积数据，尝试解析为JSON
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析响应格式');
                    }
                }
            } else {
                // 非SSE格式，直接解析JSON
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    throw new Error(`无法解析响应: ${e.message}`);
                }
            }

            // 隐藏加载动画
            this._hideLoadingAnimation();

            // 解析响应内容
            let optimizedText;
            // 优先检查 status 字段，如果存在且不等于 200，则抛出错误
            if (result.status !== undefined && result.status !== 200) {
                throw new Error(result.msg || result.message || '优化失败');
            }

            // 按优先级提取优化后的文本
            if (result.data) {
                optimizedText = result.data;
            } else if (result.content) {
                optimizedText = result.content;
            } else if (result.message) {
                optimizedText = result.message;
            } else if (typeof result === 'string') {
                optimizedText = result;
            } else if (result.text) {
                optimizedText = result.text;
            } else {
                // 如果所有字段都不存在，尝试从对象中查找可能的文本字段
                const possibleFields = ['output', 'response', 'result', 'answer'];
                for (const field of possibleFields) {
                    if (result[field] && typeof result[field] === 'string') {
                        optimizedText = result[field];
                        break;
                    }
                }

                // 如果仍然找不到，抛出错误
                if (!optimizedText) {
                    console.error('无法解析响应内容，响应对象:', result);
                    throw new Error('无法解析响应内容，请检查服务器响应格式');
                }
            }

            // 去除 think 内容
            optimizedText = this.stripThinkContent(optimizedText);

            // 清理优化后的文本（更彻底的清理）
            optimizedText = optimizedText.trim();

            // 移除可能的引号包裹（支持多种引号类型）
            const quotePairs = [
                ['"', '"'],
                ['"', '"'],
                ['"', '"'],
                ["'", "'"],
                ['`', '`'],
                ['「', '」'],
                ['『', '』']
            ];

            for (const [startQuote, endQuote] of quotePairs) {
                if (optimizedText.startsWith(startQuote) && optimizedText.endsWith(endQuote)) {
                    optimizedText = optimizedText.slice(startQuote.length, -endQuote.length).trim();
                }
            }

            // 移除常见的AI回复前缀（如"优化后的内容："等）
            const prefixes = [
                /^优化后的[内容上下文]：?\s*/i,
                /^以下是优化后的[内容上下文]：?\s*/i,
                /^优化结果：?\s*/i,
                /^优化后的文本：?\s*/i,
                /^优化后的[内容上下文]如下：?\s*/i,
                /^[内容上下文]优化如下：?\s*/i,
                /^以下是[优化后的]?[内容上下文]：?\s*/i,
                /^[内容上下文][已]?优化[结果]?：?\s*/i
            ];

            for (const prefix of prefixes) {
                optimizedText = optimizedText.replace(prefix, '').trim();
            }

            // 使用专门的清理函数去除HTML标签和无意义内容
            optimizedText = this._cleanAndOptimizeText(optimizedText);

            // 验证优化后的文本是否有效
            if (!optimizedText || optimizedText.length < 10) {
                throw new Error('优化后的文本过短，可能优化失败，请重试');
            }

            // 如果优化后的文本与原文完全相同，给出提示
            if (optimizedText === originalText) {
                this.showNotification('优化后的内容与原文相同', 'info');
            }

            // 更新输入框内容
            textarea.value = optimizedText;

            // 保存优化后的文本，用于撤销功能
            textarea.setAttribute('data-optimized-text', optimizedText);

            // 触发 input 事件，确保值被正确更新并更新预览
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // 显示撤销按钮
            if (undoBtn) {
                undoBtn.style.display = 'block';
            }

            // 显示优化完成通知，包含字符数信息
            const charCount = optimizedText.length;
            const originalCharCount = originalText.length;
            const changeInfo = charCount !== originalCharCount
                ? `（${originalCharCount}字 → ${charCount}字）`
                : `（${charCount}字）`;
            this.showNotification(`优化完成 ${changeInfo}`, 'success');
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('优化上下文失败:', error);

            // 提供更详细的错误信息
            let errorMessage = '优化失败，请稍后重试';
            if (error.message) {
                if (error.message.includes('HTTP error')) {
                    errorMessage = '网络请求失败，请检查网络连接';
                } else if (error.message.includes('无法解析')) {
                    errorMessage = '服务器响应格式异常，请稍后重试';
                } else if (error.message.includes('过短')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }

            this.showNotification(errorMessage, 'error');
        } finally {
            // 恢复按钮状态
            if (optimizeBtn) {
                optimizeBtn.disabled = false;
                optimizeBtn.textContent = originalBtnText;
                optimizeBtn.style.opacity = '1';
                optimizeBtn.style.cursor = 'pointer';
            }
        }
    }

    /**
     * 翻译上下文内容
     * @param {string} targetLang - 目标语言 'zh' 或 'en'
     */
    async translateContext(targetLang) {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;

        const originalText = textarea.value.trim();
        if (!originalText) {
            this.showNotification('请先输入内容', 'warning');
            return;
        }

        // 保存原始文本，用于撤销功能
        if (!textarea.hasAttribute('data-original-text')) {
            textarea.setAttribute('data-original-text', originalText);
        }

        // 获取翻译按钮
        const translateZhBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-translate-zh-btn') : null;
        const translateEnBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-translate-en-btn') : null;
        const targetBtn = targetLang === 'zh' ? translateZhBtn : translateEnBtn;
        const originalBtnText = targetBtn ? targetBtn.textContent : '';

        // 禁用按钮，显示加载状态
        if (translateZhBtn) {
            translateZhBtn.disabled = true;
            translateZhBtn.setAttribute('data-translating', 'true');
            if (targetLang === 'zh') {
                translateZhBtn.textContent = '翻译中...';
            }
            translateZhBtn.style.opacity = '0.6';
            translateZhBtn.style.cursor = 'not-allowed';
        }
        if (translateEnBtn) {
            translateEnBtn.disabled = true;
            translateEnBtn.setAttribute('data-translating', 'true');
            if (targetLang === 'en') {
                translateEnBtn.textContent = '翻译中...';
            }
            translateEnBtn.style.opacity = '0.6';
            translateEnBtn.style.cursor = 'not-allowed';
        }

        try {
            // 构建翻译提示词
            const targetLanguage = targetLang === 'zh' ? '中文' : '英文';
            const systemPrompt = `你是一个专业的翻译专家，擅长将各种语言的内容准确、流畅地翻译成${targetLanguage}。请保持原文的格式、结构和语义，确保翻译准确、自然、流畅。`;

            const userPrompt = `请将以下内容翻译成${targetLanguage}，要求：
1. 保持原文的格式和结构（包括Markdown格式）
2. 翻译准确、自然、流畅
3. 保持专业术语的准确性
4. 不要添加任何说明文字、引号或其他格式标记
5. 直接返回翻译后的内容

原文内容：
${originalText}

请直接返回翻译后的${targetLanguage}内容，不要包含任何说明文字、引号或其他格式标记。`;

            // 构建请求 payload
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 显示加载动画
            this._showLoadingAnimation();

            // 调用 prompt 接口
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 先获取文本响应，检查是否是SSE格式
            const responseText = await response.text();
            let result;

            // 检查是否包含SSE格式（包含 "data: "）
            if (responseText.includes('data: ')) {
                // 处理SSE流式响应
                const lines = responseText.split('\n');
                let accumulatedData = '';
                let lastValidData = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            // 尝试解析JSON
                            const chunk = JSON.parse(dataStr);

                            // 检查是否完成
                            if (chunk.done === true) {
                                break;
                            }

                            // 累积内容（处理流式内容块）
                            if (chunk.data) {
                                accumulatedData += chunk.data;
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                // Ollama格式
                                accumulatedData += chunk.message.content;
                            } else if (typeof chunk === 'string') {
                                accumulatedData += chunk;
                            }

                            // 保存最后一个有效的数据块（用于提取其他字段如status等）
                            lastValidData = chunk;
                        } catch (e) {
                            // 如果不是JSON，可能是纯文本内容
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                accumulatedData += dataStr;
                            }
                        }
                    }
                }

                // 如果累积了内容，创建结果对象
                if (accumulatedData || lastValidData) {
                    if (lastValidData && lastValidData.status) {
                        // 如果有status字段，保留原有结构，但替换data/content
                        result = {
                            ...lastValidData,
                            data: accumulatedData || lastValidData.data || '',
                            content: accumulatedData || lastValidData.content || ''
                        };
                    } else {
                        result = {
                            data: accumulatedData,
                            content: accumulatedData
                        };
                    }
                } else {
                    // 如果没有累积数据，尝试解析为JSON
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析响应格式');
                    }
                }
            } else {
                // 非SSE格式，直接解析JSON
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    throw new Error(`无法解析响应: ${e.message}`);
                }
            }

            // 隐藏加载动画
            this._hideLoadingAnimation();

            // 解析响应内容
            let translatedText;
            // 优先检查 status 字段，如果存在且不等于 200，则抛出错误
            if (result.status !== undefined && result.status !== 200) {
                throw new Error(result.msg || result.message || '翻译失败');
            }

            // 按优先级提取翻译后的文本
            if (result.data) {
                translatedText = result.data;
            } else if (result.content) {
                translatedText = result.content;
            } else if (result.message) {
                translatedText = result.message;
            } else if (typeof result === 'string') {
                translatedText = result;
            } else if (result.text) {
                translatedText = result.text;
            } else {
                // 如果所有字段都不存在，尝试从对象中查找可能的文本字段
                const possibleFields = ['output', 'response', 'result', 'answer'];
                for (const field of possibleFields) {
                    if (result[field] && typeof result[field] === 'string') {
                        translatedText = result[field];
                        break;
                    }
                }

                // 如果仍然找不到，抛出错误
                if (!translatedText) {
                    console.error('无法解析响应内容，响应对象:', result);
                    throw new Error('无法解析响应内容，请检查服务器响应格式');
                }
            }

            // 去除 think 内容
            translatedText = this.stripThinkContent(translatedText);

            // 清理翻译后的文本（更彻底的清理）
            translatedText = translatedText.trim();

            // 移除可能的引号包裹（支持多种引号类型）
            const quotePairs = [
                ['"', '"'],
                ['"', '"'],
                ['"', '"'],
                ["'", "'"],
                ['`', '`'],
                ['「', '」'],
                ['『', '』']
            ];

            for (const [startQuote, endQuote] of quotePairs) {
                if (translatedText.startsWith(startQuote) && translatedText.endsWith(endQuote)) {
                    translatedText = translatedText.slice(startQuote.length, -endQuote.length).trim();
                }
            }

            // 移除常见的AI回复前缀
            const prefixes = [
                /^翻译后的[内容上下文]：?\s*/i,
                /^以下是翻译后的[内容上下文]：?\s*/i,
                /^翻译结果：?\s*/i,
                /^翻译后的文本：?\s*/i,
                /^翻译后的[内容上下文]如下：?\s*/i,
                /^[内容上下文]翻译如下：?\s*/i,
                /^以下是翻译成[中文英文]的[内容上下文]：?\s*/i
            ];

            for (const prefix of prefixes) {
                translatedText = translatedText.replace(prefix, '').trim();
            }

            // 清理多余的空白字符（但保留Markdown格式）
            translatedText = translatedText.replace(/\n{4,}/g, '\n\n\n');
            translatedText = translatedText.replace(/[ \t]+/g, ' ');
            translatedText = translatedText.trim();

            // 验证翻译后的文本是否有效
            if (!translatedText || translatedText.length < 10) {
                throw new Error('翻译后的文本过短，可能翻译失败，请重试');
            }

            // 如果翻译后的文本与原文完全相同，给出提示
            if (translatedText === originalText) {
                this.showNotification('翻译后的内容与原文相同，可能已经是目标语言', 'info');
            }

            // 更新输入框内容
            textarea.value = translatedText;

            // 保存翻译后的文本，用于撤销功能
            textarea.setAttribute('data-translated-text', translatedText);

            // 触发 input 事件，确保值被正确更新并更新预览
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // 显示翻译完成通知，包含字符数信息
            const charCount = translatedText.length;
            const originalCharCount = originalText.length;
            const changeInfo = charCount !== originalCharCount
                ? `（${originalCharCount}字 → ${charCount}字）`
                : `（${charCount}字）`;
            this.showNotification(`翻译完成 ${changeInfo}`, 'success');
        } catch (error) {
            // 隐藏加载动画
            this._showLoadingAnimation();
            console.error('翻译上下文失败:', error);

            // 提供更详细的错误信息
            let errorMessage = '翻译失败，请稍后重试';
            if (error.message) {
                if (error.message.includes('HTTP error')) {
                    errorMessage = '网络请求失败，请检查网络连接';
                } else if (error.message.includes('无法解析')) {
                    errorMessage = '服务器响应格式异常，请稍后重试';
                } else if (error.message.includes('过短')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }

            this.showNotification(errorMessage, 'error');
        } finally {
            // 恢复按钮状态
            if (translateZhBtn) {
                translateZhBtn.disabled = false;
                translateZhBtn.removeAttribute('data-translating');
                translateZhBtn.textContent = '🇨🇳 中文';
                translateZhBtn.style.opacity = '1';
                translateZhBtn.style.cursor = 'pointer';
            }
            if (translateEnBtn) {
                translateEnBtn.disabled = false;
                translateEnBtn.removeAttribute('data-translating');
                translateEnBtn.textContent = '🇺🇸 英文';
                translateEnBtn.style.opacity = '1';
                translateEnBtn.style.cursor = 'pointer';
            }
        }
    }

    // 根据标签名称生成颜色（确保相同标签颜色一致）
    getTagColor(tagName) {
        // 预定义的配色方案（柔和的渐变色）
        const colorPalettes = [
            // 蓝色系
            { background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', text: '#0369a1', border: '#7dd3fc' },
            // 绿色系
            { background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', text: '#166534', border: '#86efac' },
            // 紫色系
            { background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', text: '#6b21a8', border: '#c084fc' },
            // 粉色系
            { background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', text: '#9f1239', border: '#f9a8d4' },
            // 橙色系
            { background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', text: '#9a3412', border: '#fdba74' },
            // 青色系
            { background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)', text: '#164e63', border: '#67e8f9' },
            // 红色系
            { background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', text: '#991b1b', border: '#fca5a5' },
            // 黄色系
            { background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)', text: '#854d0e', border: '#fde047' },
            // 靛蓝色系
            { background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', text: '#3730a3', border: '#a5b4fc' },
            // 玫瑰色系
            { background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', text: '#9f1239', border: '#fda4af' }
        ];

        // 使用简单的哈希函数将标签名称映射到颜色索引
        let hash = 0;
        for (let i = 0; i < tagName.length; i++) {
            hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
            hash = hash & hash; // 转换为32位整数
        }

        // 确保索引为正数并在范围内
        const index = Math.abs(hash) % colorPalettes.length;
        return colorPalettes[index];
    }

    // 清除所有选中状态（切换视图时调用）
    clearAllSelections() {
        // 清除当前选中的会话
        this.currentSessionId = null;

        // 清除当前选中的文件
        this.currentFile = null;

        // 清除批量选中的状态
        if (this.selectedSessionIds) {
            this.selectedSessionIds.clear();
        }
        if (this.selectedFileNames) {
            this.selectedFileNames.clear();
        }
        if (this.selectedApiRequestIds) {
            this.selectedApiRequestIds.clear();
        }
        if (this.selectedNewsIds) {
            this.selectedNewsIds.clear();
        }

        // 清除所有 active 类的元素
        if (this.sessionSidebar) {
            // 清除会话项的 active 状态
            const activeSessionItems = this.sessionSidebar.querySelectorAll('.session-item.active');
            activeSessionItems.forEach(item => {
                item.classList.remove('active');
            });

            // 清除文件项的 active 状态
            // OSS文件列表已移除

            // 清除新闻项的 active 状态
            // 新闻列表已移除
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
    applyViewMode() {
        if (!this.sessionSidebar) return;

        const btnSession = this.sessionSidebar.querySelector('#view-toggle-session');

        if (!btnSession) return;

        // 获取当前主题色（用于激活态）
        const currentColor = this.colors[this.colorIndex];
        const currentMainColor = this.getMainColorFromGradient(currentColor);

        // 重置按钮样式
        const resetBtn = (b) => {
            if (!b) return;
            b.style.background = 'transparent';
            b.style.color = '#6b7280';
            b.style.border = 'none';
        };

        // 激活按钮样式
        const activateBtn = (b) => {
            if (!b) return;
            b.style.background = currentMainColor;
            b.style.color = '#fff';
            b.style.border = 'none';
        };

        // 激活当前模式的按钮
        activateBtn(btnSession);
    }

    // 进入批量选择模式
    enterBatchMode() {
        this.batchMode = true;
        if (this.selectedSessionIds) this.selectedSessionIds.clear();
        if (this.selectedFileNames) this.selectedFileNames.clear();

        // 显示批量操作工具栏（带动画）
        const batchToolbar = document.getElementById('batch-toolbar');
        if (batchToolbar) {
            batchToolbar.style.display = 'flex';
            // 使用 requestAnimationFrame 确保样式已应用
            requestAnimationFrame(() => {
                batchToolbar.style.opacity = '1';
                batchToolbar.style.transform = 'translateY(0)';
            });
        }

        // 更新批量模式按钮状态
        const batchModeBtn = this.sessionSidebar.querySelector('span[title="批量选择"], span[title="退出批量选择模式"]');
        if (batchModeBtn) {
            batchModeBtn.classList.add('batch-mode-active');
            batchModeBtn.innerHTML = '☑️ 退出批量';
            batchModeBtn.title = '退出批量选择模式';
            batchModeBtn.style.background = 'linear-gradient(135deg, #10b981, #059669) !important';
            batchModeBtn.style.borderColor = '#059669 !important';
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
        if (this.selectedFileNames) this.selectedFileNames.clear();
        if (this.selectedApiRequestIds) this.selectedApiRequestIds.clear();

        // 隐藏批量操作工具栏（带动画）
        const batchToolbar = document.getElementById('batch-toolbar');
        if (batchToolbar) {
            batchToolbar.style.opacity = '0';
            batchToolbar.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                batchToolbar.style.display = 'none';
            }, 300);
        }

        // 更新批量模式按钮状态
        const batchModeBtn = this.sessionSidebar.querySelector('span[title="退出批量选择模式"], span[title="批量选择"]');
        if (batchModeBtn) {
            batchModeBtn.classList.remove('batch-mode-active');
            batchModeBtn.innerHTML = '☑️ 批量选择';
            batchModeBtn.title = '批量选择';
            batchModeBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5) !important';
            batchModeBtn.style.borderColor = '#4f46e5 !important';
            batchModeBtn.style.transform = 'translateY(0)';
            batchModeBtn.style.boxShadow = 'none !important';
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
    updateBatchToolbar() {
        const selectedCount = document.getElementById('selected-count');
        const batchDeleteBtn = document.getElementById('batch-delete-btn');
        const selectAllBtn = document.getElementById('select-all-btn');

        // 判断当前显示的是会话列表、文件列表、请求接口列表还是新闻列表
        const sessionList = this.sessionSidebar.querySelector('.session-list');

        const count = this.selectedSessionIds.size;

        if (selectedCount) {
            selectedCount.textContent = `已选择 ${count} 个`;

            // 根据选中数量更新样式
            if (count > 0) {
                selectedCount.style.color = '#4338ca';
                selectedCount.style.fontWeight = '600';
            } else {
                selectedCount.style.color = '#6b7280';
                selectedCount.style.fontWeight = '500';
            }
        }

        if (batchDeleteBtn) {
            const hasSelection = count > 0;
            batchDeleteBtn.disabled = !hasSelection;

            if (hasSelection) {
                batchDeleteBtn.style.opacity = '1';
                batchDeleteBtn.style.cursor = 'pointer';
            } else {
                batchDeleteBtn.style.opacity = '0.5';
                batchDeleteBtn.style.cursor = 'not-allowed';
            }
        }

        // 更新全选按钮状态
        if (selectAllBtn) {
            let allSelected = false;
            const filteredSessions = this._getFilteredSessions();
            allSelected = filteredSessions.length > 0 &&
                            filteredSessions.every(session => this.selectedSessionIds.has(session.id));

            if (allSelected) {
                selectAllBtn.textContent = '取消全选';
                selectAllBtn.style.background = '#f3f4f6';
                selectAllBtn.style.color = '#6b7280';
            } else {
                selectAllBtn.textContent = '全选';
                selectAllBtn.style.background = '#ffffff';
                selectAllBtn.style.color = '#374151';
            }
        }
    }

    // 切换全选/取消全选
    toggleSelectAll() {
            // 会话列表模式
            const filteredSessions = this._getFilteredSessions();
            const allSelected = filteredSessions.length > 0 &&
                               filteredSessions.every(session => this.selectedSessionIds.has(session.id));

            if (allSelected) {
                // 取消全选：只取消当前显示的会话
                filteredSessions.forEach(session => {
                    this.selectedSessionIds.delete(session.id);
                });
            } else {
                // 全选：选中所有当前显示的会话
                filteredSessions.forEach(session => {
                    this.selectedSessionIds.add(session.id);
                });
            }

            // 更新所有复选框状态
            const checkboxes = document.querySelectorAll('.session-checkbox');
            checkboxes.forEach(checkbox => {
                const sessionId = checkbox.dataset.sessionId;
                checkbox.checked = this.selectedSessionIds.has(sessionId);

                // 更新会话项的选中状态类
                const sessionItem = checkbox.closest('.session-item');
                if (sessionItem) {
                    if (this.selectedSessionIds.has(sessionId)) {
                        sessionItem.classList.add('selected');
                    } else {
                        sessionItem.classList.remove('selected');
                    }
                }
            });

        // 更新批量工具栏
        this.updateBatchToolbar();
    }

    // 批量删除（支持会话、文件、请求接口和新闻）
    async batchDeleteSessions() {
        const sessionList = this.sessionSidebar.querySelector('.session-list');
            // 批量删除会话
            if (this.selectedSessionIds.size === 0) {
                this.showNotification('请先选择要删除的会话', 'error');
                return;
            }

            const count = this.selectedSessionIds.size;
            const confirmMessage = `确定要删除选中的 ${count} 个会话吗？此操作不可撤销。`;
            if (!confirm(confirmMessage)) {
                return;
            }

            const sessionIds = Array.from(this.selectedSessionIds);

            try {
                // 在删除会话之前，先收集所有会话的 URL，用于更新对应新闻的状态
                // 同时收集会话信息用于删除 aicr 项目文件
                const sessionUrls = [];
                const sessionsToDelete = [];
                sessionIds.forEach(sessionId => {
                    const session = this.sessions[sessionId];
                    if (session) {
                        if (session.url) {
                            sessionUrls.push(session.url);
                        }
                        sessionsToDelete.push({
                            sessionId,
                            unifiedSessionId: session.id || sessionId
                        });
                    }
                });


                // 从本地删除
                sessionIds.forEach(sessionId => {
                    if (this.sessions[sessionId]) {
                        delete this.sessions[sessionId];
                    }
                    // 如果删除的是当前会话，清空当前会话ID
                    if (sessionId === this.currentSessionId) {
                        this.currentSessionId = null;
                        this.hasAutoCreatedSessionForPage = false;
                    }
                });


                // 保存本地更改
                if (this.sessionManager) {
                    // 使用 SessionManager 批量删除
                    for (const sessionId of sessionIds) {
                        await this.sessionManager.deleteSession(sessionId);
                    }
                } else {
                    // 保存到本地存储
                    await this.saveAllSessions(true);
                }

                // 从后端删除（如果启用了后端同步）
                if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                    try {
                        await this.sessionApi.deleteSessions(sessionIds);
                        console.log('批量删除会话已同步到后端:', sessionIds);
                    } catch (error) {
                        console.warn('从后端批量删除会话失败:', error);
                        // 即使后端删除失败，也继续执行，因为本地已删除
                    }
                }

                // 清空选中状态
                this.selectedSessionIds.clear();

                // 退出批量模式
                this.exitBatchMode();

                // 刷新会话列表
                await this.updateSessionSidebar(true);

                // 显示成功通知
                this.showNotification(`已成功删除 ${count} 个会话`, 'success');

            } catch (error) {
                console.error('批量删除会话失败:', error);
                this.showNotification('批量删除会话失败: ' + error.message, 'error');
            }
    }


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

        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // 删除会话前不再自动保存当前会话

        // 从后端删除会话（如果启用了后端同步）
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
                // 确保使用 session.id 作为统一标识
                const unifiedSessionId = session.id || sessionId;

                await this.sessionApi.deleteSession(unifiedSessionId);
                console.log('会话已从后端删除:', unifiedSessionId);
            } catch (error) {
                console.warn('从后端删除会话失败:', error);
                // 即使后端删除失败，也继续本地删除，确保用户界面响应
            }
        }

        // 在删除会话之前，先获取会话的 URL，用于更新对应新闻的状态
        const sessionUrl = session?.url;

        // 从本地删除会话
        delete this.sessions[sessionId];
        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // 删除操作通过后端API完成持久化



        // 删除会话后，重新从接口获取会话列表（强制刷新）
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
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

    // 创建会话副本
    async duplicateSession(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            this.showNotification('会话不存在', 'error');
            return;
        }

        let sourceSession = this.sessions[sessionId];

        try {
            // 如果有 sessionApi，先从后端获取源会话的完整数据（包括页面上下文）
            if (this.sessionApi) {
                try {
                    const fullSessionData = await this.sessionApi.getSession(sessionId);
                    if (fullSessionData) {
                        // 使用后端返回的完整数据，优先使用后端的 pageContent
                        sourceSession = {
                            ...sourceSession,
                            ...fullSessionData,
                            // 确保 pageContent 使用后端返回的值（如果存在）
                            pageContent: fullSessionData.pageContent !== undefined ? fullSessionData.pageContent : sourceSession.pageContent
                        };
                        console.log('已从后端获取源会话完整数据，包含页面上下文');
                    }
                } catch (error) {
                    console.warn('从后端获取源会话详情失败，使用本地数据:', error);
                    // 如果获取失败，继续使用本地数据
                }
            }

            // 生成新的会话ID（基于时间戳和随机数）
            const newSessionId = await this.generateSessionId(`duplicate_${Date.now()}_${Math.random()}`);

            // 生成新的URL（添加副本标识）
            const newUrl = sourceSession.url ? `${sourceSession.url}#duplicate_${Date.now()}` : '';

            // 创建会话副本，复制所有数据，但messages为空数组
            const now = Date.now();
            const duplicatedSession = {
                id: newSessionId,
                url: newUrl,
                pageTitle: sourceSession.pageTitle ? `${sourceSession.pageTitle} (副本)` : '新会话 (副本)',
                pageDescription: sourceSession.pageDescription || '',
                pageContent: sourceSession.pageContent || '',
                messages: [], // messages为空数组
                tags: sourceSession.tags ? [...sourceSession.tags] : [],
                isFavorite: sourceSession.isFavorite !== undefined ? sourceSession.isFavorite : false,
                createdAt: now,
                updatedAt: now,
                lastAccessTime: now
            };

            // 直接调用接口保存副本
            if (this.sessionApi) {
                try {
                    await this.sessionApi.saveSession(duplicatedSession);
                    console.log('会话副本已保存到后端:', newSessionId);

                    // 立即将副本添加到本地sessions，确保即使后端加载失败也能显示
                    this.sessions[newSessionId] = duplicatedSession;

                    // 保存后更新会话列表（从后端重新加载）
                    if (PET_CONFIG.api.syncSessionsToBackend) {
                        try {
                            await this.loadSessionsFromBackend(true);
                        } catch (loadError) {
                            console.warn('从后端加载会话列表失败，使用本地数据:', loadError);
                            // 即使后端加载失败，也保存本地数据并更新UI
                            await this.saveAllSessions(true, false);
                        }
                    } else {
                        // 如果没有启用后端同步，保存本地数据
                        await this.saveAllSessions(true, false);
                    }

                    // 刷新侧边栏UI
                    await this.updateSessionUI({ updateSidebar: true });

                    this.showNotification('会话副本已创建', 'success');
                } catch (error) {
                    console.error('保存会话副本到后端失败:', error);
                    this.showNotification('创建副本失败: ' + error.message, 'error');
                }
            } else {
                // 如果没有sessionApi，只保存到本地
                this.sessions[newSessionId] = duplicatedSession;
                await this.saveAllSessions(true);

                // 更新侧边栏
                await this.updateSessionUI({ updateSidebar: true });

                this.showNotification('会话副本已创建', 'success');
            }
        } catch (error) {
            console.error('创建会话副本失败:', error);
            this.showNotification('创建副本失败: ' + error.message, 'error');
        }
    }

    // 加载侧边栏宽度
    loadSidebarWidth() {
        try {
            chrome.storage.local.get(['sessionSidebarWidth'], (result) => {
                if (result.sessionSidebarWidth && typeof result.sessionSidebarWidth === 'number') {
                    // 验证宽度是否在合理范围内
                    const width = Math.max(150, Math.min(500, result.sessionSidebarWidth));
                    this.sidebarWidth = width;
                    console.log('加载侧边栏宽度:', width);

                    // 如果侧边栏已创建，更新其宽度
                    if (this.sessionSidebar) {
                        this.sessionSidebar.style.setProperty('width', `${width}px`, 'important');
                    }
                }
            });
        } catch (error) {
            console.log('加载侧边栏宽度失败:', error);
        }
    }

    // 保存侧边栏宽度
    saveSidebarWidth() {
        try {
            chrome.storage.local.set({ sessionSidebarWidth: this.sidebarWidth }, () => {
                console.log('保存侧边栏宽度:', this.sidebarWidth);
            });
        } catch (error) {
            console.log('保存侧边栏宽度失败:', error);
        }
    }

    // 加载侧边栏折叠状态
    loadSidebarCollapsed() {
        try {
            chrome.storage.local.get(['sessionSidebarCollapsed'], (result) => {
                if (result.sessionSidebarCollapsed !== undefined) {
                    this.sidebarCollapsed = result.sessionSidebarCollapsed;
                    console.log('加载侧边栏折叠状态:', this.sidebarCollapsed);

                    // 如果侧边栏已创建，应用折叠状态
                    if (this.sessionSidebar) {
                        this.applySidebarCollapsedState();
                    }
                }
            });
        } catch (error) {
            console.log('加载侧边栏折叠状态失败:', error);
        }
    }

    // 保存侧边栏折叠状态
    saveSidebarCollapsed() {
        try {
            chrome.storage.local.set({ sessionSidebarCollapsed: this.sidebarCollapsed }, () => {
                console.log('保存侧边栏折叠状态:', this.sidebarCollapsed);
            });
        } catch (error) {
            console.log('保存侧边栏折叠状态失败:', error);
        }
    }

    // 应用侧边栏折叠状态
    applySidebarCollapsedState() {
        if (!this.sessionSidebar) return;

        if (this.sidebarCollapsed) {
            this.sessionSidebar.style.setProperty('display', 'none', 'important');
        } else {
            this.sessionSidebar.style.setProperty('display', 'flex', 'important');
        }
    }

    // 切换侧边栏折叠状态
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.applySidebarCollapsedState();
        this.saveSidebarCollapsed();

        // 更新折叠按钮图标和位置
        const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.toggle-icon');
            if (icon) {
                // 添加淡出效果
                icon.style.opacity = '0.3';
                icon.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    icon.textContent = this.sidebarCollapsed ? '▶' : '◀';
                    icon.style.opacity = '1';
                    icon.style.transform = 'scale(1)';
                }, 125);
            }
            toggleBtn.title = this.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏';
            // 更新按钮位置：折叠时在左侧边缘，展开时在侧边栏右边缘
            // 使用 translateX(14px) 让按钮完全在侧边栏外面
            if (this.sidebarCollapsed) {
                toggleBtn.style.left = '0px';
            } else {
                toggleBtn.style.left = `${this.sidebarWidth}px`;
            }
            // 确保基础 transform 样式正确（保留scale用于hover效果）
            const currentTransform = toggleBtn.style.transform;
            const baseTransform = 'translateY(-50%) translateX(14px)';
            if (!currentTransform.includes('scale')) {
                toggleBtn.style.transform = baseTransform;
            } else {
                // 如果当前有scale，保留scale值
                const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
                if (scaleMatch) {
                    toggleBtn.style.transform = `${baseTransform} ${scaleMatch[0]}`;
                } else {
                    toggleBtn.style.transform = baseTransform;
                }
            }
        }
    }

    // 加载输入框容器折叠状态
    loadInputContainerCollapsed() {
        try {
            chrome.storage.local.get(['chatInputContainerCollapsed'], (result) => {
                if (result.chatInputContainerCollapsed !== undefined) {
                    this.inputContainerCollapsed = result.chatInputContainerCollapsed;
                    console.log('加载输入框容器折叠状态:', this.inputContainerCollapsed);

                    // 如果输入框容器已创建，应用折叠状态
                    if (this.chatWindow) {
                        this.applyInputContainerCollapsedState();
                    }
                }
            });
        } catch (error) {
            console.log('加载输入框容器折叠状态失败:', error);
        }
    }

    // 保存输入框容器折叠状态
    saveInputContainerCollapsed() {
        try {
            chrome.storage.local.set({ chatInputContainerCollapsed: this.inputContainerCollapsed }, () => {
                console.log('保存输入框容器折叠状态:', this.inputContainerCollapsed);
            });
        } catch (error) {
            console.log('保存输入框容器折叠状态失败:', error);
        }
    }

    // 应用输入框容器折叠状态
    applyInputContainerCollapsedState() {
        if (!this.chatWindow) return;

        const inputContainer = this.chatWindow.querySelector('.chat-input-container');
        if (!inputContainer) return;

        if (this.inputContainerCollapsed) {
            inputContainer.style.setProperty('display', 'none', 'important');
        } else {
            inputContainer.style.setProperty('display', 'flex', 'important');
        }

        // 更新折叠按钮位置
        const toggleBtn = this.chatWindow.querySelector('#input-container-toggle-btn');
        if (toggleBtn) {
            setTimeout(() => {
                const inputHeight = inputContainer.offsetHeight || 160;
                if (this.inputContainerCollapsed) {
                    toggleBtn.style.bottom = '0px';
                } else {
                    toggleBtn.style.bottom = `${inputHeight}px`;
                }
            }, 50);
        }
    }

    // 切换输入框容器折叠状态
    toggleInputContainer() {
        this.inputContainerCollapsed = !this.inputContainerCollapsed;
        this.applyInputContainerCollapsedState();
        this.saveInputContainerCollapsed();

        // 更新折叠按钮图标和位置
        const toggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.toggle-icon');
            if (icon) {
                // 添加淡出效果
                icon.style.opacity = '0.3';
                icon.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    icon.textContent = this.inputContainerCollapsed ? '▲' : '▼';
                    icon.style.opacity = '1';
                    icon.style.transform = 'scale(1)';
                }, 125);
            }
            toggleBtn.title = this.inputContainerCollapsed ? '展开输入框' : '折叠输入框';
            // 更新按钮位置：根据输入框是否折叠调整位置
            const inputContainer = this.chatWindow?.querySelector('.chat-input-container');
            if (inputContainer) {
                if (this.inputContainerCollapsed) {
                    // 输入框折叠时，按钮在底部
                    toggleBtn.style.bottom = '0px';
                } else {
                    // 输入框展开时，按钮在输入框上方
                    const inputHeight = inputContainer.offsetHeight || 160;
                    toggleBtn.style.bottom = `${inputHeight}px`;
                }
            }
            // 确保基础 transform 样式正确（保留scale用于hover效果）
            const currentTransform = toggleBtn.style.transform;
            const baseTransform = 'translateX(-50%) translateY(-8px)';
            if (!currentTransform.includes('scale')) {
                toggleBtn.style.transform = baseTransform;
            } else {
                // 如果当前有scale，保留scale值
                const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
                if (scaleMatch) {
                    toggleBtn.style.transform = `${baseTransform} ${scaleMatch[0]}`;
                } else {
                    toggleBtn.style.transform = baseTransform;
                }
            }
        }
    }

    // 创建侧边栏拖拽调整边框
    createSidebarResizer() {
        if (!this.sessionSidebar) return;

        const resizer = document.createElement('div');
        resizer.className = 'sidebar-resizer';
        resizer.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            right: -4px !important;
            width: 8px !important;
            height: 100% !important;
            cursor: col-resize !important;
            z-index: 10 !important;
            background: transparent !important;
            transition: background 0.2s ease !important;
        `;

        // 鼠标悬停效果
        resizer.addEventListener('mouseenter', () => {
            if (!this.isResizingSidebar) {
                resizer.style.setProperty('background', 'rgba(59, 130, 246, 0.3)', 'important');
            }
        });

        resizer.addEventListener('mouseleave', () => {
            if (!this.isResizingSidebar) {
                resizer.style.setProperty('background', 'transparent', 'important');
            }
        });

        // 拖拽开始
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            this.isResizingSidebar = true;
            resizer.style.setProperty('background', 'rgba(59, 130, 246, 0.5)', 'important');
            resizer.style.setProperty('cursor', 'col-resize', 'important');

            // 记录初始位置和宽度
            const startX = e.clientX;
            const startWidth = this.sidebarWidth;

            // 添加全局样式，禁用文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';

            // 拖拽中
            const handleMouseMove = (e) => {
                if (!this.isResizingSidebar) return;

                const diffX = e.clientX - startX;
                let newWidth = startWidth + diffX;

                // 限制宽度范围
                newWidth = Math.max(150, Math.min(500, newWidth));

                // 更新宽度
                this.sidebarWidth = newWidth;
                if (this.sessionSidebar) {
                    this.sessionSidebar.style.setProperty('width', `${newWidth}px`, 'important');
                }

                // 更新折叠按钮位置（参考输入框折叠按钮的实现方式）
                const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
                if (toggleBtn && !this.sidebarCollapsed) {
                    toggleBtn.style.left = `${newWidth}px`;
                    // 确保 transform 样式正确，按钮完全在外面（保留scale用于hover效果）
                    const currentTransform = toggleBtn.style.transform;
                    const baseTransform = 'translateY(-50%) translateX(14px)';
                    if (!currentTransform.includes('scale')) {
                        toggleBtn.style.transform = baseTransform;
                    } else {
                        const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
                        if (scaleMatch) {
                            toggleBtn.style.transform = `${baseTransform} ${scaleMatch[0]}`;
                        } else {
                            toggleBtn.style.transform = baseTransform;
                        }
                    }
                }
            };

            // 拖拽结束
            const handleMouseUp = () => {
                this.isResizingSidebar = false;
                resizer.style.setProperty('background', 'transparent', 'important');
                resizer.style.setProperty('cursor', 'col-resize', 'important');

                // 恢复全局样式
                document.body.style.userSelect = '';
                document.body.style.cursor = '';

                // 保存宽度
                this.saveSidebarWidth();

                // 移除事件监听器
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            // 添加全局事件监听器
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        this.sessionSidebar.appendChild(resizer);
    }

    formatSessionTime(timestamp) {
        if (!timestamp) return '';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return new Date(timestamp).toLocaleDateString('zh-CN');
    }

    // 编辑会话标题和描述
    async editSessionTitle(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法编辑标题:', sessionId);
            return;
        }

        const session = this.sessions[sessionId];
        const originalTitle = session.pageTitle || '未命名会话';
        const originalDescription = session.pageDescription || '';

        // 打开编辑对话框
        this.openSessionInfoEditor(sessionId, originalTitle, originalDescription);
    }

    // 切换会话收藏状态
    async toggleSessionFavorite(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法切换收藏状态:', sessionId);
            return;
        }

        const session = this.sessions[sessionId];
        const currentFavorite = session.isFavorite || false;
        session.isFavorite = !currentFavorite;
        session.updatedAt = Date.now();

        // 同步到后端
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
                await this.syncSessionToBackend(sessionId, true);
                console.log(`会话 ${sessionId} 收藏状态已更新: ${session.isFavorite}`);
            } catch (error) {
                console.warn('同步收藏状态到后端失败:', error);
            }
        }

        // 更新侧边栏显示
        if (this.sessionSidebar) {
            await this.updateSessionSidebar();
        }
    }

    // 打开会话信息编辑对话框
    openSessionInfoEditor(sessionId, originalTitle, originalDescription) {
        // 确保对话框UI存在
        this.ensureSessionInfoEditorUi();

        const modal = document.body.querySelector('#pet-session-info-editor');
        if (!modal) {
            console.error('会话信息编辑对话框未找到');
            return;
        }

        // 显示对话框
        modal.style.display = 'flex';
        modal.dataset.sessionId = sessionId;

        // 填充当前值
        const titleInput = modal.querySelector('.session-editor-title-input');
        const descriptionInput = modal.querySelector('.session-editor-description-input');
        const updatedAtInput = modal.querySelector('.session-editor-updatedat-input');

        if (titleInput) {
            titleInput.value = originalTitle;
        }
        if (descriptionInput) {
            descriptionInput.value = originalDescription;
        }

        // 填充更新时间，默认是今天
        if (updatedAtInput) {
            const session = this.sessions[sessionId];
            // 优先使用 updatedAt，如果没有则使用当前时间（今天）
            let updatedAt = session.updatedAt || Date.now();

            // 将时间戳转换为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
            const date = new Date(updatedAt);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            updatedAtInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        // 聚焦到标题输入框
        if (titleInput) {
            setTimeout(() => {
                titleInput.focus();
                titleInput.select();
            }, 100);
        }

        // 添加关闭事件
        const closeBtn = modal.querySelector('.session-editor-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeSessionInfoEditor();
        }

        // 添加保存事件
        const saveBtn = modal.querySelector('.session-editor-save');
        if (saveBtn) {
            saveBtn.onclick = () => this.saveSessionInfo(sessionId);
        }

        // 添加取消事件
        const cancelBtn = modal.querySelector('.session-editor-cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeSessionInfoEditor();
        }

        // 添加智能生成标题事件
        const generateTitleBtn = modal.querySelector('.session-editor-generate-title');
        if (generateTitleBtn) {
            generateTitleBtn.onclick = () => this.generateSessionTitle(sessionId);
        }

        // 添加智能生成描述事件
        const generateDescriptionBtn = modal.querySelector('.session-editor-generate-description');
        if (generateDescriptionBtn) {
            generateDescriptionBtn.onclick = () => this.generateSessionDescription(sessionId);
        }

        // 添加智能优化描述事件
        const optimizeDescriptionBtn = modal.querySelector('.session-editor-optimize-description');
        if (optimizeDescriptionBtn) {
            optimizeDescriptionBtn.onclick = () => this.optimizeSessionDescription(sessionId);
        }

        // 添加翻译标题中文事件
        const translateTitleZhBtn = modal.querySelector('.session-editor-translate-title-zh');
        if (translateTitleZhBtn) {
            translateTitleZhBtn.onclick = () => this.translateSessionField('title', titleInput, 'zh');
        }

        // 添加翻译标题英文事件
        const translateTitleEnBtn = modal.querySelector('.session-editor-translate-title-en');
        if (translateTitleEnBtn) {
            translateTitleEnBtn.onclick = () => this.translateSessionField('title', titleInput, 'en');
        }

        // 添加翻译描述中文事件
        const translateDescriptionZhBtn = modal.querySelector('.session-editor-translate-description-zh');
        if (translateDescriptionZhBtn) {
            translateDescriptionZhBtn.onclick = () => this.translateSessionField('description', descriptionInput, 'zh');
        }

        // 添加翻译描述英文事件
        const translateDescriptionEnBtn = modal.querySelector('.session-editor-translate-description-en');
        if (translateDescriptionEnBtn) {
            translateDescriptionEnBtn.onclick = () => this.translateSessionField('description', descriptionInput, 'en');
        }

        // ESC 键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeSessionInfoEditor();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // 确保会话信息编辑对话框UI存在
    ensureSessionInfoEditorUi() {
        if (document.body.querySelector('#pet-session-info-editor')) return;

        const modal = document.createElement('div');
        modal.id = 'pet-session-info-editor';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.5) !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 2147483653 !important;
        `;

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSessionInfoEditor();
            }
        });

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: white !important;
            border-radius: 12px !important;
            padding: 32px !important;
            width: 90% !important;
            max-width: 700px !important;
            max-height: 85vh !important;
            overflow-y: auto !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
            position: relative !important;
            z-index: 2147483654 !important;
        `;

        // 标题
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 24px !important;
        `;

        const title = document.createElement('h3');
        title.textContent = '编辑会话信息';
        title.style.cssText = `
            margin: 0 !important;
            font-size: 20px !important;
            font-weight: 600 !important;
            color: #333 !important;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'session-editor-close';
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none !important;
            border: none !important;
            font-size: 24px !important;
            cursor: pointer !important;
            color: #999 !important;
            padding: 0 !important;
            width: 30px !important;
            height: 30px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 4px !important;
            transition: all 0.2s ease !important;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = '#f0f0f0';
            closeBtn.style.color = '#333';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
            closeBtn.style.color = '#999';
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        // 标题输入区域
        const titleGroup = document.createElement('div');
        titleGroup.style.cssText = `
            margin-bottom: 24px !important;
        `;

        const titleLabel = document.createElement('label');
        titleLabel.textContent = '会话标题';
        titleLabel.style.cssText = `
            display: block !important;
            margin-bottom: 10px !important;
            font-size: 15px !important;
            font-weight: 500 !important;
            color: #333 !important;
        `;

        const titleInputWrapper = document.createElement('div');
        titleInputWrapper.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
        `;

        const titleInput = document.createElement('input');
        titleInput.className = 'session-editor-title-input';
        titleInput.type = 'text';
        titleInput.placeholder = '请输入会话标题';
        titleInput.style.cssText = `
            width: 100% !important;
            padding: 12px 14px !important;
            border: 2px solid #e0e0e0 !important;
            border-radius: 6px !important;
            font-size: 15px !important;
            outline: none !important;
            transition: border-color 0.2s ease !important;
            box-sizing: border-box !important;
        `;

        titleInput.addEventListener('focus', () => {
            titleInput.style.borderColor = '#4CAF50';
        });
        titleInput.addEventListener('blur', () => {
            titleInput.style.borderColor = '#e0e0e0';
        });

        // 按钮容器
        const titleButtonContainer = document.createElement('div');
        titleButtonContainer.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            justify-content: flex-end !important;
        `;

        const generateTitleBtn = document.createElement('button');
        generateTitleBtn.className = 'session-editor-generate-title';
        generateTitleBtn.innerHTML = '✨ 智能生成';
        generateTitleBtn.style.cssText = `
            padding: 12px 16px !important;
            background: #2196F3 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        generateTitleBtn.addEventListener('mouseenter', () => {
            generateTitleBtn.style.background = '#1976D2';
        });
        generateTitleBtn.addEventListener('mouseleave', () => {
            generateTitleBtn.style.background = '#2196F3';
        });

        // 翻译中文按钮
        const translateTitleZhBtn = document.createElement('button');
        translateTitleZhBtn.className = 'session-editor-translate-title-zh';
        translateTitleZhBtn.setAttribute('data-translate-field', 'title');
        translateTitleZhBtn.setAttribute('data-target-lang', 'zh');
        translateTitleZhBtn.innerHTML = '🇨🇳 翻译中文';
        translateTitleZhBtn.style.cssText = `
            padding: 12px 16px !important;
            background: #FF9800 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        translateTitleZhBtn.addEventListener('mouseenter', () => {
            translateTitleZhBtn.style.background = '#F57C00';
        });
        translateTitleZhBtn.addEventListener('mouseleave', () => {
            translateTitleZhBtn.style.background = '#FF9800';
        });

        // 翻译英文按钮
        const translateTitleEnBtn = document.createElement('button');
        translateTitleEnBtn.className = 'session-editor-translate-title-en';
        translateTitleEnBtn.setAttribute('data-translate-field', 'title');
        translateTitleEnBtn.setAttribute('data-target-lang', 'en');
        translateTitleEnBtn.innerHTML = '🇺🇸 翻译英文';
        translateTitleEnBtn.style.cssText = `
            padding: 12px 16px !important;
            background: #9C27B0 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        translateTitleEnBtn.addEventListener('mouseenter', () => {
            translateTitleEnBtn.style.background = '#7B1FA2';
        });
        translateTitleEnBtn.addEventListener('mouseleave', () => {
            translateTitleEnBtn.style.background = '#9C27B0';
        });

        titleButtonContainer.appendChild(generateTitleBtn);
        titleButtonContainer.appendChild(translateTitleZhBtn);
        titleButtonContainer.appendChild(translateTitleEnBtn);

        titleInputWrapper.appendChild(titleInput);
        titleInputWrapper.appendChild(titleButtonContainer);

        titleGroup.appendChild(titleLabel);
        titleGroup.appendChild(titleInputWrapper);

        // 描述输入区域
        const descriptionGroup = document.createElement('div');
        descriptionGroup.style.cssText = `
            margin-bottom: 24px !important;
        `;

        const descriptionLabel = document.createElement('label');
        descriptionLabel.textContent = '网页描述';
        descriptionLabel.style.cssText = `
            display: block !important;
            margin-bottom: 10px !important;
            font-size: 15px !important;
            font-weight: 500 !important;
            color: #333 !important;
        `;

        const descriptionInputWrapper = document.createElement('div');
        descriptionInputWrapper.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
        `;

        const descriptionInput = document.createElement('textarea');
        descriptionInput.className = 'session-editor-description-input';
        descriptionInput.placeholder = '请输入网页描述（可选）';
        descriptionInput.rows = 6;
        descriptionInput.style.cssText = `
            width: 100% !important;
            padding: 12px 14px !important;
            border: 2px solid #e0e0e0 !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            outline: none !important;
            transition: border-color 0.2s ease !important;
            resize: vertical !important;
            font-family: inherit !important;
            box-sizing: border-box !important;
            min-height: 120px !important;
        `;

        descriptionInput.addEventListener('focus', () => {
            descriptionInput.style.borderColor = '#4CAF50';
        });
        descriptionInput.addEventListener('blur', () => {
            descriptionInput.style.borderColor = '#e0e0e0';
        });

        // 按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            justify-content: flex-end !important;
        `;

        const generateDescriptionBtn = document.createElement('button');
        generateDescriptionBtn.className = 'session-editor-generate-description';
        generateDescriptionBtn.innerHTML = '✨ 智能生成描述';
        generateDescriptionBtn.style.cssText = `
            padding: 12px 16px !important;
            background: #2196F3 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        generateDescriptionBtn.addEventListener('mouseenter', () => {
            generateDescriptionBtn.style.background = '#1976D2';
        });
        generateDescriptionBtn.addEventListener('mouseleave', () => {
            generateDescriptionBtn.style.background = '#2196F3';
        });

        const optimizeDescriptionBtn = document.createElement('button');
        optimizeDescriptionBtn.className = 'session-editor-optimize-description';
        optimizeDescriptionBtn.innerHTML = '🚀 智能优化';
        optimizeDescriptionBtn.style.cssText = `
            padding: 12px 16px !important;
            background: #4CAF50 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        optimizeDescriptionBtn.addEventListener('mouseenter', () => {
            optimizeDescriptionBtn.style.background = '#45a049';
        });
        optimizeDescriptionBtn.addEventListener('mouseleave', () => {
            optimizeDescriptionBtn.style.background = '#4CAF50';
        });

        // 翻译中文按钮
        const translateDescriptionZhBtn = document.createElement('button');
        translateDescriptionZhBtn.className = 'session-editor-translate-description-zh';
        translateDescriptionZhBtn.setAttribute('data-translate-field', 'description');
        translateDescriptionZhBtn.setAttribute('data-target-lang', 'zh');
        translateDescriptionZhBtn.innerHTML = '🇨🇳 翻译中文';
        translateDescriptionZhBtn.style.cssText = `
            padding: 12px 16px !important;
            background: #FF9800 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        translateDescriptionZhBtn.addEventListener('mouseenter', () => {
            translateDescriptionZhBtn.style.background = '#F57C00';
        });
        translateDescriptionZhBtn.addEventListener('mouseleave', () => {
            translateDescriptionZhBtn.style.background = '#FF9800';
        });

        // 翻译英文按钮
        const translateDescriptionEnBtn = document.createElement('button');
        translateDescriptionEnBtn.className = 'session-editor-translate-description-en';
        translateDescriptionEnBtn.setAttribute('data-translate-field', 'description');
        translateDescriptionEnBtn.setAttribute('data-target-lang', 'en');
        translateDescriptionEnBtn.innerHTML = '🇺🇸 翻译英文';
        translateDescriptionEnBtn.style.cssText = `
            padding: 12px 16px !important;
            background: #9C27B0 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        translateDescriptionEnBtn.addEventListener('mouseenter', () => {
            translateDescriptionEnBtn.style.background = '#7B1FA2';
        });
        translateDescriptionEnBtn.addEventListener('mouseleave', () => {
            translateDescriptionEnBtn.style.background = '#9C27B0';
        });

        buttonContainer.appendChild(optimizeDescriptionBtn);
        buttonContainer.appendChild(generateDescriptionBtn);
        buttonContainer.appendChild(translateDescriptionZhBtn);
        buttonContainer.appendChild(translateDescriptionEnBtn);

        descriptionInputWrapper.appendChild(descriptionInput);
        descriptionInputWrapper.appendChild(buttonContainer);

        descriptionGroup.appendChild(descriptionLabel);
        descriptionGroup.appendChild(descriptionInputWrapper);

        // 更新时间输入区域
        const updatedAtGroup = document.createElement('div');
        updatedAtGroup.style.cssText = `
            margin-bottom: 24px !important;
        `;

        const updatedAtLabel = document.createElement('label');
        updatedAtLabel.textContent = '更新时间';
        updatedAtLabel.style.cssText = `
            display: block !important;
            margin-bottom: 10px !important;
            font-size: 15px !important;
            font-weight: 500 !important;
            color: #333 !important;
        `;

        const updatedAtInput = document.createElement('input');
        updatedAtInput.className = 'session-editor-updatedat-input';
        updatedAtInput.type = 'datetime-local';
        updatedAtInput.style.cssText = `
            width: 100% !important;
            padding: 12px 14px !important;
            border: 2px solid #e0e0e0 !important;
            border-radius: 6px !important;
            font-size: 15px !important;
            outline: none !important;
            transition: border-color 0.2s ease !important;
            box-sizing: border-box !important;
        `;

        updatedAtInput.addEventListener('focus', () => {
            updatedAtInput.style.borderColor = '#4CAF50';
        });
        updatedAtInput.addEventListener('blur', () => {
            updatedAtInput.style.borderColor = '#e0e0e0';
        });

        updatedAtGroup.appendChild(updatedAtLabel);
        updatedAtGroup.appendChild(updatedAtInput);

        // 按钮区域
        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = `
            display: flex !important;
            gap: 12px !important;
            justify-content: flex-end !important;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'session-editor-cancel';
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 12px 24px !important;
            background: #f5f5f5 !important;
            color: #333 !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 15px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = '#e0e0e0';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = '#f5f5f5';
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'session-editor-save';
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 12px 24px !important;
            background: #4CAF50 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 15px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = '#45a049';
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = '#4CAF50';
        });

        buttonGroup.appendChild(cancelBtn);
        buttonGroup.appendChild(saveBtn);

        // 组装面板
        panel.appendChild(header);
        panel.appendChild(titleGroup);
        panel.appendChild(descriptionGroup);
        panel.appendChild(updatedAtGroup);
        panel.appendChild(buttonGroup);

        // 组装模态框
        modal.appendChild(panel);
        document.body.appendChild(modal);
    }

    // 关闭会话信息编辑对话框
    closeSessionInfoEditor() {
        const modal = document.body.querySelector('#pet-session-info-editor');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 保存会话信息
    async saveSessionInfo(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法保存信息:', sessionId);
            return;
        }

        const modal = document.body.querySelector('#pet-session-info-editor');
        if (!modal) {
            return;
        }

        const titleInput = modal.querySelector('.session-editor-title-input');
        const descriptionInput = modal.querySelector('.session-editor-description-input');
        const updatedAtInput = modal.querySelector('.session-editor-updatedat-input');

        if (!titleInput) {
            console.error('标题输入框未找到');
            return;
        }

        const newTitle = titleInput.value.trim();
        const newDescription = descriptionInput ? descriptionInput.value.trim() : '';

        // 获取更新的时间
        let newUpdatedAt = Date.now();
        if (updatedAtInput && updatedAtInput.value) {
            // 将 datetime-local 格式转换为时间戳
            const dateValue = new Date(updatedAtInput.value);
            if (!isNaN(dateValue.getTime())) {
                newUpdatedAt = dateValue.getTime();
            }
        }

        // 如果标题为空，不进行更新
        if (newTitle === '') {
            alert('会话标题不能为空');
            titleInput.focus();
            return;
        }

        const session = this.sessions[sessionId];
        const originalTitle = session.pageTitle || '未命名会话';
        const originalDescription = session.pageDescription || '';
        const originalUpdatedAt = session.updatedAt || Date.now();

        // 如果标题、描述和更新时间都没有变化，不需要更新
        if (newTitle === originalTitle && newDescription === originalDescription && newUpdatedAt === originalUpdatedAt) {
            this.closeSessionInfoEditor();
            return;
        }

        try {
            // 更新会话信息
            session.pageTitle = newTitle;
            session.pageDescription = newDescription;
            session.updatedAt = newUpdatedAt;

            // 保存会话到本地
            await this.saveAllSessions(false, true);

            // 更新UI显示
            await this.updateSessionSidebar(true);

            // 如果这是当前会话，同时更新聊天窗口标题和第一条消息
            if (sessionId === this.currentSessionId) {
                this.updateChatHeaderTitle();
                // 刷新第一条欢迎消息
                await this.refreshWelcomeMessage();
            }

            console.log('会话信息已更新:', { title: newTitle, description: newDescription });

            // 关闭对话框
            this.closeSessionInfoEditor();
        } catch (error) {
            console.error('更新会话信息失败:', error);
            alert('更新信息失败，请重试');
        }
    }



    // OSS文件编辑功能已移除

    // 获取指定会话的上下文（包含消息历史和页面内容）
    getSessionContext(sessionId) {
        const context = {
            messages: [],
            pageContent: '',
            pageTitle: '',
            pageDescription: '',
            url: '',
            hasHistory: false
        };

        if (!sessionId || !this.sessions[sessionId]) {
            return context;
        }

        const session = this.sessions[sessionId];

        // 获取消息历史（排除欢迎消息和按钮操作生成的消息）
        if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
            context.messages = session.messages.filter(msg => {
                // 只包含用户消息和宠物消息，排除按钮操作生成的消息
                return msg.type === 'user' || msg.type === 'pet';
            });
            context.hasHistory = context.messages.length > 0;
        }

        // 获取页面信息
        if (session.pageContent && session.pageContent.trim()) {
            context.pageContent = session.pageContent.trim();
        }
        if (session.pageTitle) {
            context.pageTitle = session.pageTitle;
        }
        if (session.pageDescription) {
            context.pageDescription = session.pageDescription;
        }
        if (session.url) {
            context.url = session.url;
        }

        return context;
    }

    // 智能生成会话标题
    async generateSessionTitle(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法生成标题:', sessionId);
            return;
        }

        const modal = document.body.querySelector('#pet-session-info-editor');
        if (!modal) {
            return;
        }

        const generateBtn = modal.querySelector('.session-editor-generate-title');
        const titleInput = modal.querySelector('.session-editor-title-input');

        if (!generateBtn || !titleInput) {
            return;
        }

        // 设置按钮为加载状态
        const originalText = generateBtn.innerHTML;
        generateBtn.disabled = true;
        generateBtn.innerHTML = '生成中...';
        generateBtn.style.opacity = '0.6';
        generateBtn.style.cursor = 'not-allowed';

        try {
            // 获取会话上下文
            const context = this.getSessionContext(sessionId);

            // 构建生成标题的 prompt
            let systemPrompt = '你是一个专业的助手，擅长根据会话内容生成简洁、准确的标题。';
            let userPrompt = '请根据以下会话内容，生成一个简洁、准确的标题（不超过20个字）：\n\n';

            // 添加页面信息
            if (context.pageTitle) {
                userPrompt += `页面标题：${context.pageTitle}\n`;
            }
            if (context.url) {
                userPrompt += `页面URL：${context.url}\n`;
            }

            // 添加消息历史
            if (context.messages.length > 0) {
                userPrompt += '\n会话内容：\n';
                context.messages.slice(0, 10).forEach((msg, index) => {
                    const role = msg.type === 'user' ? '用户' : '助手';
                    const content = msg.content.trim();
                    if (content) {
                        userPrompt += `${role}：${content.substring(0, 200)}\n`;
                    }
                });
            } else if (context.pageContent) {
                // 如果没有消息历史，使用页面内容
                userPrompt += '\n页面内容摘要：\n';
                userPrompt += context.pageContent.substring(0, 500);
            }

            userPrompt += '\n\n请直接返回标题，不要包含其他说明文字。';

            // 构建请求 payload
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 调用 prompt 接口
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 先获取响应文本，检查是否是 SSE 格式
            const responseText = await response.text();
            let result;

            try {
                // 检查是否包含 SSE 格式（包含 "data: "）
                if (responseText.includes('data: ')) {
                    // 处理 SSE 格式响应
                    const lines = responseText.split('\n');
                    let accumulatedData = '';
                    let lastValidData = null;

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const dataStr = trimmedLine.substring(6).trim();
                                if (dataStr === '[DONE]' || dataStr === '') {
                                    continue;
                                }

                                // 尝试解析 JSON
                                const chunk = JSON.parse(dataStr);

                                // 检查是否完成
                                if (chunk.done === true) {
                                    break;
                                }

                                // 累积内容
                                if (chunk.content) {
                                    accumulatedData += chunk.content;
                                    lastValidData = chunk;
                                } else if (chunk.data) {
                                    accumulatedData += (typeof chunk.data === 'string' ? chunk.data : chunk.data.content || '');
                                    lastValidData = chunk;
                                } else if (chunk.message && chunk.message.content) {
                                    accumulatedData += chunk.message.content;
                                    lastValidData = chunk;
                                }
                            } catch (e) {
                                console.warn('解析 SSE 数据块失败:', trimmedLine, e);
                            }
                        }
                    }

                    // 如果有累积的内容，使用它
                    if (accumulatedData) {
                        result = { content: accumulatedData, data: accumulatedData };
                    } else if (lastValidData) {
                        result = lastValidData;
                    } else {
                        // 尝试从最后一行提取 JSON
                        const sseMatch = responseText.match(/data:\s*({.+?})/s);
                        if (sseMatch) {
                            result = JSON.parse(sseMatch[1]);
                        } else {
                            throw new Error('无法解析 SSE 响应');
                        }
                    }
                } else {
                    // 普通 JSON 响应
                    result = JSON.parse(responseText);
                }
            } catch (parseError) {
                console.error('解析响应失败:', parseError, '响应内容:', responseText.substring(0, 200));
                throw new Error('解析响应失败: ' + parseError.message);
            }

            // 提取生成的标题（适配不同的响应格式）
            let generatedTitle = '';
            if (result.status === 200 && result.data) {
                // 成功响应，提取 data 字段
                generatedTitle = typeof result.data === 'string' ? result.data.trim() : (result.data.content || '').trim();
            } else if (result && result.content) {
                generatedTitle = result.content.trim();
            } else if (result && result.data && result.data.content) {
                generatedTitle = result.data.content.trim();
            } else if (result && result.message) {
                generatedTitle = result.message.trim();
            } else if (typeof result === 'string') {
                generatedTitle = result.trim();
            }

            // 去除 think 内容
            generatedTitle = this.stripThinkContent(generatedTitle);

            // 清理标题（移除可能的引号、换行等）
            generatedTitle = generatedTitle.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim();

            // 限制长度
            if (generatedTitle.length > 50) {
                generatedTitle = generatedTitle.substring(0, 50);
            }

            if (generatedTitle) {
                titleInput.value = generatedTitle;
                titleInput.focus();
            } else {
                alert('生成标题失败，请重试');
            }
        } catch (error) {
            console.error('生成标题失败:', error);
            alert('生成标题失败：' + error.message);
        } finally {
            // 恢复按钮状态
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalText;
            generateBtn.style.opacity = '1';
            generateBtn.style.cursor = 'pointer';
        }
    }

    // 智能生成会话描述
    async generateSessionDescription(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法生成描述:', sessionId);
            return;
        }

        const modal = document.body.querySelector('#pet-session-info-editor');
        if (!modal) {
            return;
        }

        const generateBtn = modal.querySelector('.session-editor-generate-description');
        const descriptionInput = modal.querySelector('.session-editor-description-input');

        if (!generateBtn || !descriptionInput) {
            return;
        }

        // 设置按钮为加载状态
        const originalText = generateBtn.innerHTML;
        generateBtn.disabled = true;
        generateBtn.innerHTML = '生成中...';
        generateBtn.style.opacity = '0.6';
        generateBtn.style.cursor = 'not-allowed';

        try {
            // 获取会话上下文
            const context = this.getSessionContext(sessionId);

            // 构建生成描述的 prompt
            let systemPrompt = '你是一个专业的助手，擅长根据会话内容生成简洁、准确的网页描述。';
            let userPrompt = '请根据以下会话内容，生成一个简洁、准确的网页描述：\n\n';

            // 添加页面信息
            if (context.pageTitle) {
                userPrompt += `页面标题：${context.pageTitle}\n`;
            }
            if (context.url) {
                userPrompt += `页面URL：${context.url}\n`;
            }

            // 添加消息历史
            if (context.messages.length > 0) {
                userPrompt += '\n会话内容：\n';
                context.messages.slice(0, 15).forEach((msg, index) => {
                    const role = msg.type === 'user' ? '用户' : '助手';
                    const content = msg.content.trim();
                    if (content) {
                        userPrompt += `${role}：${content.substring(0, 300)}\n`;
                    }
                });
            } else if (context.pageContent) {
                // 如果没有消息历史，使用页面内容
                userPrompt += '\n页面内容摘要：\n';
                userPrompt += context.pageContent.substring(0, 1000);
            }

            userPrompt += '\n\n请直接返回描述，不要包含其他说明文字。描述应该简洁明了，概括会话或页面的主要内容。';

            // 构建请求 payload
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 调用 prompt 接口
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 先获取响应文本，检查是否是 SSE 格式
            const responseText = await response.text();
            let result;

            try {
                // 检查是否包含 SSE 格式（包含 "data: "）
                if (responseText.includes('data: ')) {
                    // 处理 SSE 格式响应
                    const lines = responseText.split('\n');
                    let accumulatedData = '';
                    let lastValidData = null;

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const dataStr = trimmedLine.substring(6).trim();
                                if (dataStr === '[DONE]' || dataStr === '') {
                                    continue;
                                }

                                // 尝试解析 JSON
                                const chunk = JSON.parse(dataStr);

                                // 检查是否完成
                                if (chunk.done === true) {
                                    break;
                                }

                                // 累积内容
                                if (chunk.content) {
                                    accumulatedData += chunk.content;
                                    lastValidData = chunk;
                                } else if (chunk.data) {
                                    accumulatedData += (typeof chunk.data === 'string' ? chunk.data : chunk.data.content || '');
                                    lastValidData = chunk;
                                } else if (chunk.message && chunk.message.content) {
                                    accumulatedData += chunk.message.content;
                                    lastValidData = chunk;
                                }
                            } catch (e) {
                                console.warn('解析 SSE 数据块失败:', trimmedLine, e);
                            }
                        }
                    }

                    // 如果有累积的内容，使用它
                    if (accumulatedData) {
                        result = { content: accumulatedData, data: accumulatedData };
                    } else if (lastValidData) {
                        result = lastValidData;
                    } else {
                        // 尝试从最后一行提取 JSON
                        const sseMatch = responseText.match(/data:\s*({.+?})/s);
                        if (sseMatch) {
                            result = JSON.parse(sseMatch[1]);
                        } else {
                            throw new Error('无法解析 SSE 响应');
                        }
                    }
                } else {
                    // 普通 JSON 响应
                    result = JSON.parse(responseText);
                }
            } catch (parseError) {
                console.error('解析响应失败:', parseError, '响应内容:', responseText.substring(0, 200));
                throw new Error('解析响应失败: ' + parseError.message);
            }

            // 提取生成的描述（适配不同的响应格式）
            let generatedDescription = '';
            if (result.status === 200 && result.data) {
                // 成功响应，提取 data 字段
                generatedDescription = typeof result.data === 'string' ? result.data.trim() : (result.data.content || '').trim();
            } else if (result && result.content) {
                generatedDescription = result.content.trim();
            } else if (result && result.data && result.data.content) {
                generatedDescription = result.data.content.trim();
            } else if (result && result.message) {
                generatedDescription = result.message.trim();
            } else if (typeof result === 'string') {
                generatedDescription = result.trim();
            }

            // 去除 think 内容
            generatedDescription = this.stripThinkContent(generatedDescription);

            // 清理描述（移除可能的引号等）
            generatedDescription = generatedDescription.replace(/^["']|["']$/g, '').trim();

            // 不再限制长度，保留完整内容

            if (generatedDescription) {
                descriptionInput.value = generatedDescription;
                descriptionInput.focus();
            } else {
                alert('生成描述失败，请重试');
            }
        } catch (error) {
            console.error('生成描述失败:', error);
            alert('生成描述失败：' + error.message);
        } finally {
            // 恢复按钮状态
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalText;
            generateBtn.style.opacity = '1';
            generateBtn.style.cursor = 'pointer';
        }
    }

    // 智能优化会话描述
    async optimizeSessionDescription(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法优化描述:', sessionId);
            return;
        }

        const modal = document.body.querySelector('#pet-session-info-editor');
        if (!modal) {
            return;
        }

        const optimizeBtn = modal.querySelector('.session-editor-optimize-description');
        const descriptionInput = modal.querySelector('.session-editor-description-input');

        if (!optimizeBtn || !descriptionInput) {
            return;
        }

        // 检查是否有现有描述
        const currentDescription = descriptionInput.value.trim();
        if (!currentDescription) {
            alert('请先输入描述内容，然后再进行优化');
            descriptionInput.focus();
            return;
        }

        // 设置按钮为加载状态
        const originalText = optimizeBtn.innerHTML;
        optimizeBtn.disabled = true;
        optimizeBtn.innerHTML = '优化中...';
        optimizeBtn.style.opacity = '0.6';
        optimizeBtn.style.cursor = 'not-allowed';

        try {
            // 获取会话上下文
            const context = this.getSessionContext(sessionId);

            // 构建优化描述的 prompt
            let systemPrompt = '你是一个专业的助手，擅长优化和润色网页描述，使其更加简洁、准确、吸引人。';
            let userPrompt = '请优化以下网页描述，使其更加简洁、准确、吸引人（50-200字）：\n\n';
            userPrompt += `当前描述：${currentDescription}\n\n`;

            // 添加页面信息以提供上下文
            if (context.pageTitle) {
                userPrompt += `页面标题：${context.pageTitle}\n`;
            }
            if (context.url) {
                userPrompt += `页面URL：${context.url}\n`;
            }

            // 添加消息历史以提供更多上下文
            if (context.messages.length > 0) {
                userPrompt += '\n会话内容（供参考）：\n';
                context.messages.slice(0, 10).forEach((msg, index) => {
                    const role = msg.type === 'user' ? '用户' : '助手';
                    const content = msg.content.trim();
                    if (content) {
                        userPrompt += `${role}：${content.substring(0, 200)}\n`;
                    }
                });
            } else if (context.pageContent) {
                // 如果没有消息历史，使用页面内容
                userPrompt += '\n页面内容摘要（供参考）：\n';
                userPrompt += context.pageContent.substring(0, 800);
            }

            userPrompt += '\n\n请直接返回优化后的描述，不要包含其他说明文字。优化后的描述应该：\n';
            userPrompt += '1. 保持原意不变\n';
            userPrompt += '2. 更加简洁明了\n';
            userPrompt += '3. 语言更加流畅自然\n';
            userPrompt += '4. 突出关键信息';

            // 构建请求 payload
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 调用 prompt 接口
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 先获取响应文本，检查是否是 SSE 格式
            const responseText = await response.text();
            let result;

            try {
                // 检查是否包含 SSE 格式（包含 "data: "）
                if (responseText.includes('data: ')) {
                    // 处理 SSE 格式响应
                    const lines = responseText.split('\n');
                    let accumulatedData = '';
                    let lastValidData = null;

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const dataStr = trimmedLine.substring(6).trim();
                                if (dataStr === '[DONE]' || dataStr === '') {
                                    continue;
                                }

                                // 尝试解析 JSON
                                const chunk = JSON.parse(dataStr);

                                // 检查是否完成
                                if (chunk.done === true) {
                                    break;
                                }

                                // 累积内容
                                if (chunk.content) {
                                    accumulatedData += chunk.content;
                                    lastValidData = chunk;
                                } else if (chunk.data) {
                                    accumulatedData += (typeof chunk.data === 'string' ? chunk.data : chunk.data.content || '');
                                    lastValidData = chunk;
                                } else if (chunk.message && chunk.message.content) {
                                    accumulatedData += chunk.message.content;
                                    lastValidData = chunk;
                                }
                            } catch (e) {
                                console.warn('解析 SSE 数据块失败:', trimmedLine, e);
                            }
                        }
                    }

                    // 如果有累积的内容，使用它
                    if (accumulatedData) {
                        result = { content: accumulatedData, data: accumulatedData };
                    } else if (lastValidData) {
                        result = lastValidData;
                    } else {
                        // 尝试从最后一行提取 JSON
                        const sseMatch = responseText.match(/data:\s*({.+?})/s);
                        if (sseMatch) {
                            result = JSON.parse(sseMatch[1]);
                        } else {
                            throw new Error('无法解析 SSE 响应');
                        }
                    }
                } else {
                    // 普通 JSON 响应
                    result = JSON.parse(responseText);
                }
            } catch (parseError) {
                console.error('解析响应失败:', parseError, '响应内容:', responseText.substring(0, 200));
                throw new Error('解析响应失败: ' + parseError.message);
            }

            // 提取优化后的描述（适配不同的响应格式）
            let optimizedDescription = '';
            if (result.status === 200 && result.data) {
                // 成功响应，提取 data 字段
                optimizedDescription = typeof result.data === 'string' ? result.data.trim() : (result.data.content || '').trim();
            } else if (result && result.content) {
                optimizedDescription = result.content.trim();
            } else if (result && result.data && result.data.content) {
                optimizedDescription = result.data.content.trim();
            } else if (result && result.message) {
                optimizedDescription = result.message.trim();
            } else if (typeof result === 'string') {
                optimizedDescription = result.trim();
            }

            // 清理描述（移除可能的引号等）
            optimizedDescription = optimizedDescription.replace(/^["']|["']$/g, '').trim();

            // 限制长度
            if (optimizedDescription.length > 500) {
                optimizedDescription = optimizedDescription.substring(0, 500);
            }

            if (optimizedDescription) {
                descriptionInput.value = optimizedDescription;
                descriptionInput.focus();
            } else {
                alert('优化描述失败，请重试');
            }
        } catch (error) {
            console.error('优化描述失败:', error);
            alert('优化描述失败：' + error.message);
        } finally {
            // 恢复按钮状态
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = originalText;
            optimizeBtn.style.opacity = '1';
            optimizeBtn.style.cursor = 'pointer';
        }
    }

    // 翻译会话字段（标题或描述）
    async translateSessionField(fieldType, inputElement, targetLanguage) {
        if (!inputElement) return;

        const originalText = inputElement.value.trim();
        if (!originalText) {
            this.showNotification('请先输入内容', 'warning');
            return;
        }

        // 禁用按钮，显示加载状态
        const modal = document.body.querySelector('#pet-session-info-editor');
        const translateBtn = modal ? modal.querySelector(`button[data-translate-field="${fieldType}"][data-target-lang="${targetLanguage}"]`) : null;
        const originalBtnText = translateBtn ? translateBtn.textContent : '';
        if (translateBtn) {
            translateBtn.disabled = true;
            translateBtn.textContent = '翻译中...';
            translateBtn.style.opacity = '0.6';
            translateBtn.style.cursor = 'not-allowed';
        }

        try {
            // 构建翻译提示词
            const languageName = targetLanguage === 'zh' ? '中文' : '英文';
            const systemPrompt = `你是一个专业的翻译专家，擅长准确、流畅地翻译文本。请将用户提供的文本翻译成${languageName}，要求：
1. 保持原文的意思和语气不变
2. 翻译自然流畅，符合${languageName}的表达习惯
3. 保留原文的格式和结构

请直接返回翻译后的文本，不要包含任何说明文字、引号或其他格式标记。`;

            const userPrompt = `请将以下文本翻译成${languageName}：

${originalText}

请直接返回翻译后的文本，不要包含任何说明文字、引号或其他格式标记。`;

            // 构建请求 payload
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 显示加载动画
            this._showLoadingAnimation();

            // 调用 prompt 接口
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 先获取文本响应，检查是否是SSE格式
            const responseText = await response.text();
            let result;

            // 检查是否包含SSE格式（包含 "data: "）
            if (responseText.includes('data: ')) {
                // 处理SSE流式响应
                const lines = responseText.split('\n');
                let accumulatedData = '';
                let lastValidData = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            // 尝试解析JSON
                            const chunk = JSON.parse(dataStr);

                            // 检查是否完成
                            if (chunk.done === true) {
                                break;
                            }

                            // 累积内容（处理流式内容块）
                            if (chunk.data) {
                                accumulatedData += chunk.data;
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                // Ollama格式
                                accumulatedData += chunk.message.content;
                            } else if (typeof chunk === 'string') {
                                accumulatedData += chunk;
                            }

                            // 保存最后一个有效的数据块（用于提取其他字段如status等）
                            lastValidData = chunk;
                        } catch (e) {
                            // 如果不是JSON，可能是纯文本内容
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                accumulatedData += dataStr;
                            }
                        }
                    }
                }

                // 如果累积了内容，创建结果对象
                if (accumulatedData || lastValidData) {
                    if (lastValidData && lastValidData.status) {
                        // 如果有status字段，保留原有结构，但替换data/content
                        result = {
                            ...lastValidData,
                            data: accumulatedData || lastValidData.data || '',
                            content: accumulatedData || lastValidData.content || ''
                        };
                    } else {
                        // 否则创建新的结果对象
                        result = {
                            data: accumulatedData,
                            content: accumulatedData
                        };
                    }
                } else {
                    // 如果无法解析SSE格式，尝试直接解析整个响应
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析响应格式');
                    }
                }
            } else {
                // 非SSE格式，直接解析JSON
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    throw new Error(`无法解析响应: ${e.message}`);
                }
            }

            // 隐藏加载动画
            this._hideLoadingAnimation();

            // 解析响应内容
            let translatedText;
            // 优先检查 status 字段，如果存在且不等于 200，则抛出错误
            if (result.status !== undefined && result.status !== 200) {
                throw new Error(result.msg || result.message || '翻译失败');
            }

            // 按优先级提取翻译后的文本
            if (result.data) {
                translatedText = result.data;
            } else if (result.content) {
                translatedText = result.content;
            } else if (result.message) {
                translatedText = result.message;
            } else if (typeof result === 'string') {
                translatedText = result;
            } else if (result.text) {
                translatedText = result.text;
            } else {
                // 如果所有字段都不存在，尝试从对象中查找可能的文本字段
                const possibleFields = ['output', 'response', 'result', 'answer'];
                for (const field of possibleFields) {
                    if (result[field] && typeof result[field] === 'string') {
                        translatedText = result[field];
                        break;
                    }
                }

                // 如果仍然找不到，抛出错误
                if (!translatedText) {
                    console.error('无法解析响应内容，响应对象:', result);
                    throw new Error('无法解析响应内容，请检查服务器响应格式');
                }
            }

            // 去除 think 内容
            translatedText = this.stripThinkContent(translatedText);

            // 清理翻译后的文本
            translatedText = translatedText.trim();

            // 移除可能的引号包裹（支持多种引号类型）
            const quotePairs = [
                ['"', '"'],
                ['"', '"'],
                ['"', '"'],
                ["'", "'"],
                ['`', '`'],
                ['「', '」'],
                ['『', '』']
            ];

            for (const [startQuote, endQuote] of quotePairs) {
                if (translatedText.startsWith(startQuote) && translatedText.endsWith(endQuote)) {
                    translatedText = translatedText.slice(startQuote.length, -endQuote.length).trim();
                }
            }

            // 移除常见的AI回复前缀
            const prefixes = [
                /^翻译后的[内容文本]：?\s*/i,
                /^以下是翻译后的[内容文本]：?\s*/i,
                /^翻译结果：?\s*/i,
                /^翻译后的文本：?\s*/i,
                /^翻译后的[内容文本]如下：?\s*/i,
                /^[内容文本]翻译如下：?\s*/i
            ];

            for (const prefix of prefixes) {
                translatedText = translatedText.replace(prefix, '').trim();
            }

            // 清理多余的空白字符（但保留格式）
            translatedText = translatedText.replace(/\n{4,}/g, '\n\n\n');
            translatedText = translatedText.replace(/[ \t]+/g, ' ');
            translatedText = translatedText.trim();

            // 验证翻译后的文本是否有效
            if (!translatedText || translatedText.length < 1) {
                throw new Error('翻译后的文本为空，可能翻译失败，请重试');
            }

            // 如果翻译后的文本与原文完全相同，给出提示
            if (translatedText === originalText) {
                this.showNotification('翻译后的内容与原文相同', 'info');
            }

            // 更新输入框内容
            inputElement.value = translatedText;

            // 触发 input 事件，确保值被正确更新
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));

            this.showNotification('翻译完成', 'success');
        } catch (error) {
            console.error('翻译失败:', error);
            this.showNotification('翻译失败：' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            if (translateBtn) {
                translateBtn.disabled = false;
                translateBtn.textContent = originalBtnText;
                translateBtn.style.opacity = '1';
                translateBtn.style.cursor = 'pointer';
            }
            // 隐藏加载动画
            this._hideLoadingAnimation();
        }
    }

    // 打开标签管理弹窗
    openTagManager(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法管理标签:', sessionId);
            return;
        }

        const session = this.sessions[sessionId];
        const currentTags = session.tags || [];

        // 创建标签管理弹窗
        this.ensureTagManagerUi();
        const modal = this.chatWindow?.querySelector('#pet-tag-manager');
        if (!modal) {
            console.error('标签管理弹窗未找到');
            return;
        }

        // 显示弹窗
        modal.style.display = 'flex';
        modal.dataset.sessionId = sessionId;

        // 隐藏折叠按钮（避免在弹框中显示两个折叠按钮）
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';

        // 加载当前标签
        this.loadTagsIntoManager(sessionId, currentTags);

        // 添加关闭事件
        const closeBtn = modal.querySelector('.tag-manager-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeTagManager();
        }

        // 添加保存事件
        const saveBtn = modal.querySelector('.tag-manager-save');
        if (saveBtn) {
            saveBtn.onclick = () => this.saveTags(sessionId);
        }

        // 添加输入框回车事件（兼容中文输入法）
        const tagInput = modal.querySelector('.tag-manager-input');
        if (tagInput) {
            // 确保输入法组合状态已初始化（如果输入框是新创建的）
            if (tagInput._isComposing === undefined) {
                tagInput._isComposing = false;
                tagInput.addEventListener('compositionstart', () => {
                    tagInput._isComposing = true;
                });
                tagInput.addEventListener('compositionend', () => {
                    tagInput._isComposing = false;
                });
            }

            // 添加回车键事件处理（移除旧的监听器，避免重复绑定）
            const existingHandler = tagInput._enterKeyHandler;
            if (existingHandler) {
                tagInput.removeEventListener('keydown', existingHandler);
            }

            const enterKeyHandler = (e) => {
                // 如果在输入法组合过程中，忽略回车键
                if (tagInput._isComposing) {
                    return;
                }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addTagFromInput(sessionId);
                }
            };

            tagInput._enterKeyHandler = enterKeyHandler;
            tagInput.addEventListener('keydown', enterKeyHandler);

            tagInput.focus();
        }

        // ESC 键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeTagManager();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // 确保标签管理UI存在
    ensureTagManagerUi() {
        if (!this.chatWindow) return;
        if (this.chatWindow.querySelector('#pet-tag-manager')) return;

        const modal = document.createElement('div');
        modal.id = 'pet-tag-manager';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.5) !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 10000 !important;
        `;

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTagManager();
            }
        });

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: white !important;
            border-radius: 12px !important;
            padding: 24px !important;
            width: 90% !important;
            max-width: 800px !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
        `;

        // 标题
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 20px !important;
        `;

        const title = document.createElement('h3');
        title.textContent = '管理标签';
        title.style.cssText = `
            margin: 0 !important;
            font-size: 18px !important;
            font-weight: 600 !important;
            color: #333 !important;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tag-manager-close';
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none !important;
            border: none !important;
            font-size: 24px !important;
            cursor: pointer !important;
            color: #999 !important;
            padding: 0 !important;
            width: 30px !important;
            height: 30px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 4px !important;
            transition: all 0.2s ease !important;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = '#f0f0f0';
            closeBtn.style.color = '#333';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
            closeBtn.style.color = '#999';
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        // 输入区域
        const inputGroup = document.createElement('div');
        inputGroup.className = 'tag-manager-input-group';
        inputGroup.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            margin-bottom: 20px !important;
        `;

        const tagInput = document.createElement('input');
        tagInput.className = 'tag-manager-input';
        tagInput.type = 'text';
        tagInput.placeholder = '输入标签名称，按回车添加';
        tagInput.style.cssText = `
            flex: 1 !important;
            padding: 10px 12px !important;
            border: 2px solid #e0e0e0 !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            outline: none !important;
            transition: border-color 0.2s ease !important;
        `;

        // 输入法组合状态跟踪（用于处理中文输入）
        // 将状态存储在输入框元素上，便于后续访问
        tagInput._isComposing = false;
        tagInput.addEventListener('compositionstart', () => {
            tagInput._isComposing = true;
        });
        tagInput.addEventListener('compositionend', () => {
            tagInput._isComposing = false;
        });

        tagInput.addEventListener('focus', () => {
            tagInput.style.borderColor = '#4CAF50';
        });
        tagInput.addEventListener('blur', () => {
            tagInput.style.borderColor = '#e0e0e0';
        });

        const addBtn = document.createElement('button');
        addBtn.textContent = '添加';
        addBtn.style.cssText = `
            padding: 10px 20px !important;
            background: #4CAF50 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
        `;
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.background = '#45a049';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.background = '#4CAF50';
        });
        addBtn.addEventListener('click', () => {
            const sessionId = modal.dataset.sessionId;
            if (sessionId) {
                this.addTagFromInput(sessionId);
            }
        });

        // 智能生成标签按钮
        const smartGenerateBtn = document.createElement('button');
        smartGenerateBtn.className = 'tag-manager-smart-generate';
        smartGenerateBtn.textContent = '✨ 智能生成';
        smartGenerateBtn.style.cssText = `
            padding: 10px 20px !important;
            background: #9C27B0 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
            white-space: nowrap !important;
        `;
        smartGenerateBtn.addEventListener('mouseenter', () => {
            if (!smartGenerateBtn.disabled) {
                smartGenerateBtn.style.background = '#7B1FA2';
            }
        });
        smartGenerateBtn.addEventListener('mouseleave', () => {
            if (!smartGenerateBtn.disabled) {
                smartGenerateBtn.style.background = '#9C27B0';
            }
        });
        smartGenerateBtn.addEventListener('click', () => {
            const sessionId = modal.dataset.sessionId;
            if (sessionId) {
                this.generateSmartTags(sessionId, smartGenerateBtn);
            }
        });

        inputGroup.appendChild(tagInput);
        inputGroup.appendChild(addBtn);
        inputGroup.appendChild(smartGenerateBtn);

        // 快捷标签按钮容器
        const quickTagsContainer = document.createElement('div');
        quickTagsContainer.className = 'tag-manager-quick-tags';
        quickTagsContainer.style.cssText = `
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            margin-bottom: 20px !important;
        `;

        // 快捷标签列表
        const quickTags = ['工具', '开源项目', '家庭', '工作', '娱乐', '文档', '日记'];

        quickTags.forEach(tagName => {
            const quickTagBtn = document.createElement('button');
            quickTagBtn.textContent = tagName;
            quickTagBtn.className = 'tag-manager-quick-tag-btn';
            quickTagBtn.dataset.tagName = tagName;
            quickTagBtn.style.cssText = `
                padding: 6px 12px !important;
                background: #f0f0f0 !important;
                color: #333 !important;
                border: 1px solid #d0d0d0 !important;
                border-radius: 4px !important;
                cursor: pointer !important;
                font-size: 13px !important;
                transition: all 0.2s ease !important;
            `;
            quickTagBtn.addEventListener('mouseenter', () => {
                // 如果标签已添加，不改变样式
                if (quickTagBtn.style.background === 'rgb(76, 175, 80)') {
                    return;
                }
                quickTagBtn.style.background = '#e0e0e0';
                quickTagBtn.style.borderColor = '#4CAF50';
            });
            quickTagBtn.addEventListener('mouseleave', () => {
                // 如果标签已添加，不改变样式
                if (quickTagBtn.style.background === 'rgb(76, 175, 80)') {
                    return;
                }
                quickTagBtn.style.background = '#f0f0f0';
                quickTagBtn.style.borderColor = '#d0d0d0';
            });
            quickTagBtn.addEventListener('click', () => {
                // 如果标签已添加，不执行操作
                if (quickTagBtn.style.cursor === 'not-allowed') {
                    return;
                }
                const sessionId = modal.dataset.sessionId;
                if (sessionId) {
                    this.addQuickTag(sessionId, tagName);
                }
            });
            quickTagsContainer.appendChild(quickTagBtn);
        });

        // 标签列表
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tag-manager-tags';
        tagsContainer.style.cssText = `
            min-height: 100px !important;
            max-height: 300px !important;
            overflow-y: auto !important;
            margin-bottom: 20px !important;
            padding: 12px !important;
            background: #f8f9fa !important;
            border-radius: 6px !important;
        `;

        // 底部按钮
        const footer = document.createElement('div');
        footer.style.cssText = `
            display: flex !important;
            justify-content: flex-end !important;
            gap: 10px !important;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 20px !important;
            background: #f0f0f0 !important;
            color: #333 !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: background 0.2s ease !important;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = '#e0e0e0';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = '#f0f0f0';
        });
        cancelBtn.addEventListener('click', () => this.closeTagManager());

        const saveBtn = document.createElement('button');
        saveBtn.className = 'tag-manager-save';
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 10px 20px !important;
            background: #2196F3 !important;
            color: white !important;
            border: none !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            transition: background 0.2s ease !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = '#1976D2';
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = '#2196F3';
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        panel.appendChild(header);
        panel.appendChild(inputGroup);
        panel.appendChild(quickTagsContainer);
        panel.appendChild(tagsContainer);
        panel.appendChild(footer);
        modal.appendChild(panel);
        this.chatWindow.appendChild(modal);
    }

    // 加载标签到管理器
    loadTagsIntoManager(sessionId, tags) {
        const modal = this.chatWindow?.querySelector('#pet-tag-manager');
        if (!modal) return;

        const tagsContainer = modal.querySelector('.tag-manager-tags');
        if (!tagsContainer) return;

        tagsContainer.innerHTML = '';

        if (!tags || tags.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = '暂无标签';
            emptyMsg.style.cssText = `
                text-align: center !important;
                color: #999 !important;
                padding: 20px !important;
                font-size: 14px !important;
            `;
            tagsContainer.appendChild(emptyMsg);
            return;
        }

        tags.forEach((tag, index) => {
            const tagItem = document.createElement('div');
            tagItem.style.cssText = `
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                background: #4CAF50 !important;
                color: white !important;
                padding: 6px 12px !important;
                border-radius: 20px !important;
                margin: 4px !important;
                font-size: 13px !important;
            `;

            const tagText = document.createElement('span');
            tagText.textContent = tag;

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '✕';
            removeBtn.style.cssText = `
                background: rgba(255, 255, 255, 0.3) !important;
                border: none !important;
                color: white !important;
                width: 18px !important;
                height: 18px !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                font-size: 12px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 0 !important;
                transition: background 0.2s ease !important;
            `;
            removeBtn.addEventListener('mouseenter', () => {
                removeBtn.style.background = 'rgba(255, 255, 255, 0.5)';
            });
            removeBtn.addEventListener('mouseleave', () => {
                removeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
            });
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = modal.dataset.sessionId;
                if (sessionId) {
                    this.removeTag(sessionId, index);
                }
            });

            tagItem.appendChild(tagText);
            tagItem.appendChild(removeBtn);
            tagsContainer.appendChild(tagItem);
        });

        // 更新快捷标签按钮状态
        const quickTagButtons = modal.querySelectorAll('.tag-manager-quick-tag-btn');
        quickTagButtons.forEach(btn => {
            const tagName = btn.dataset.tagName;
            const isAdded = tags && tags.includes(tagName);
            if (isAdded) {
                btn.style.background = '#4CAF50';
                btn.style.color = 'white';
                btn.style.borderColor = '#4CAF50';
                btn.style.opacity = '0.7';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.background = '#f0f0f0';
                btn.style.color = '#333';
                btn.style.borderColor = '#d0d0d0';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
    }

    // 从输入框添加标签
    addTagFromInput(sessionId) {
        const modal = this.chatWindow?.querySelector('#pet-tag-manager');
        if (!modal) return;

        const tagInput = modal.querySelector('.tag-manager-input');
        if (!tagInput) return;

        const tagName = tagInput.value.trim();
        if (!tagName) return;

        const session = this.sessions[sessionId];
        if (!session) return;

        if (!session.tags) {
            session.tags = [];
        }

        // 检查标签是否已存在
        if (session.tags.includes(tagName)) {
            tagInput.value = '';
            tagInput.focus();
            return;
        }

        // 添加标签
        session.tags.push(tagName);
        tagInput.value = '';
        tagInput.focus();

        // 重新加载标签列表
        this.loadTagsIntoManager(sessionId, session.tags);
    }

    // 添加快捷标签
    addQuickTag(sessionId, tagName) {
        const modal = this.chatWindow?.querySelector('#pet-tag-manager');
        if (!modal) return;

        const session = this.sessions[sessionId];
        if (!session) return;

        if (!session.tags) {
            session.tags = [];
        }

        // 检查标签是否已存在
        if (session.tags.includes(tagName)) {
            return;
        }

        // 添加标签
        session.tags.push(tagName);

        // 重新加载标签列表
        this.loadTagsIntoManager(sessionId, session.tags);
    }

    // 删除标签
    removeTag(sessionId, index) {
        const session = this.sessions[sessionId];
        if (!session || !session.tags) return;

        session.tags.splice(index, 1);
        this.loadTagsIntoManager(sessionId, session.tags);
    }

    // 智能生成标签
    async generateSmartTags(sessionId, buttonElement) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法生成标签:', sessionId);
            return;
        }

        const session = this.sessions[sessionId];
        const modal = this.chatWindow?.querySelector('#pet-tag-manager');

        if (!modal) {
            console.error('标签管理弹窗未找到');
            return;
        }

        // 禁用按钮，显示加载状态
        // 临时保存当前会话ID，以便生成标签后恢复
        const originalSessionId = this.currentSessionId;

        if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.style.background = '#ccc';
            buttonElement.style.cursor = 'not-allowed';
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '生成中...';

            try {
                // 收集页面上下文信息
                const pageTitle = session.pageTitle || '当前页面';
                const pageUrl = session.url || window.location.href;
                const pageDescription = session.pageDescription || '';

                // 获取会话消息摘要（取前5条消息作为上下文）
                let messageSummary = '';
                if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
                    const recentMessages = session.messages.slice(0, 5);
                    messageSummary = recentMessages.map((msg, idx) => {
                        const role = msg.role === 'user' ? '用户' : '助手';
                        const content = msg.content || '';
                        // 不再限制每条消息长度，显示完整内容
                        return `${idx + 1}. ${role}: ${content}`;
                    }).join('\n');
                }

                // 构建系统提示词
                const systemPrompt = `你是一个专业的标签生成助手。根据用户提供的页面上下文和会话内容，生成合适的标签。

标签要求：
1. 标签应该简洁明了，每个标签2-6个汉字或3-12个英文字符
2. 标签应该准确反映页面或会话的核心主题
3. 生成3-8个标签
4. 标签之间用逗号分隔
5. 只返回标签，不要返回其他说明文字
6. 如果已有标签，避免生成重复的标签

输出格式示例：技术,编程,前端开发,JavaScript`;

                // 构建用户提示词
                let userPrompt = `页面信息：
- 标题：${pageTitle}
- 网址：${pageUrl}`;

                if (pageDescription) {
                    userPrompt += `\n- 描述：${pageDescription}`;
                }

                if (messageSummary) {
                    userPrompt += `\n\n会话内容摘要：\n${messageSummary}`;
                }

                const currentTags = session.tags || [];
                if (currentTags.length > 0) {
                    userPrompt += `\n\n已有标签：${currentTags.join(', ')}\n请避免生成重复的标签。`;
                }

                userPrompt += `\n\n请根据以上信息生成合适的标签。`;

                // 构建 payload

                // 临时设置会话ID为目标会话ID，确保 prompt 接口使用正确的会话上下文
                this.currentSessionId = sessionId;

                try {
                    const payload = this.buildPromptPayload(
                        systemPrompt,
                        userPrompt,
                        this.currentModel || ((PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) || 'qwen3')
                    );

                    // 确保 payload 中包含正确的会话ID
                    payload.conversation_id = sessionId;

                    // 调用 prompt 接口
                    const response = await fetch(PET_CONFIG.api.promptUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    }

                    // 先读取响应文本，判断是否为流式响应（SSE格式）
                    const responseText = await response.text();
                    let result;

                    // 检查是否包含SSE格式（包含 "data: "）
                    if (responseText.includes('data: ')) {
                        // 处理SSE流式响应
                        const lines = responseText.split('\n');
                        let accumulatedData = '';
                        let lastValidData = null;

                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('data: ')) {
                                try {
                                    const dataStr = trimmedLine.substring(6).trim();
                                    if (dataStr === '[DONE]' || dataStr === '') {
                                        continue;
                                    }

                                    // 尝试解析JSON
                                    const chunk = JSON.parse(dataStr);

                                    // 检查是否完成
                                    if (chunk.done === true) {
                                        break;
                                    }

                                    // 累积内容（处理流式内容块）
                                    if (chunk.data) {
                                        accumulatedData += chunk.data;
                                    } else if (chunk.content) {
                                        accumulatedData += chunk.content;
                                    } else if (chunk.message && chunk.message.content) {
                                        // Ollama格式
                                        accumulatedData += chunk.message.content;
                                    } else if (typeof chunk === 'string') {
                                        accumulatedData += chunk;
                                    }

                                    // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                    lastValidData = chunk;
                                } catch (e) {
                                    // 如果不是JSON，可能是纯文本内容
                                    const dataStr = trimmedLine.substring(6).trim();
                                    if (dataStr && dataStr !== '[DONE]') {
                                        accumulatedData += dataStr;
                                    }
                                }
                            }
                        }

                        // 如果累积了内容，创建结果对象
                        if (accumulatedData || lastValidData) {
                            if (lastValidData && lastValidData.status) {
                                // 如果有status字段，保留原有结构，但替换data/content
                                result = {
                                    ...lastValidData,
                                    data: accumulatedData || lastValidData.data || '',
                                    content: accumulatedData || lastValidData.content || ''
                                };
                            } else {
                                // 否则创建新的结果对象
                                result = {
                                    data: accumulatedData,
                                    content: accumulatedData
                                };
                            }
                        } else {
                            // 如果无法解析SSE格式，尝试直接解析整个响应
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                throw new Error('无法解析响应格式');
                            }
                        }
                    } else {
                        // 非SSE格式，直接解析JSON
                        try {
                            result = JSON.parse(responseText);
                        } catch (e) {
                            // 如果解析失败，尝试查找SSE格式的数据
                            const sseMatch = responseText.match(/data:\s*({.+?})/s);
                            if (sseMatch) {
                                result = JSON.parse(sseMatch[1]);
                            } else {
                                throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                            }
                        }
                    }

                    // 解析返回的标签
                    let generatedTags = [];
                    // 适配响应格式: {status, msg, data, pagination} 或 {content} 或 {response}
                    let content = '';
                    if (result.data) {
                        content = result.data;
                    } else if (result.content) {
                        content = result.content;
                    } else if (result.response) {
                        content = result.response;
                    }

                    if (content) {
                        const trimmedContent = content.trim();

                        // 尝试解析 JSON 格式
                        try {
                            const parsed = JSON.parse(trimmedContent);
                            if (Array.isArray(parsed)) {
                                generatedTags = parsed;
                            } else if (typeof parsed === 'object' && parsed.tags) {
                                generatedTags = Array.isArray(parsed.tags) ? parsed.tags : [];
                            }
                        } catch (e) {
                            // 如果不是 JSON，尝试按逗号分割
                            generatedTags = trimmedContent.split(/[,，、]/).map(tag => tag.trim()).filter(tag => tag.length > 0);
                        }
                    }

                    if (generatedTags.length === 0) {
                        throw new Error('未能生成有效标签，请重试');
                    }

                    // 确保标签数组存在
                    if (!session.tags) {
                        session.tags = [];
                    }

                    // 添加新标签（排除已存在的标签）
                    let addedCount = 0;
                    generatedTags.forEach(tag => {
                        const trimmedTag = tag.trim();
                        if (trimmedTag && !session.tags.includes(trimmedTag)) {
                            session.tags.push(trimmedTag);
                            addedCount++;
                        }
                    });

                    if (addedCount > 0) {
                        // 重新加载标签列表
                        this.loadTagsIntoManager(sessionId, session.tags);
                        console.log(`成功生成并添加 ${addedCount} 个标签:`, generatedTags.filter(tag => session.tags.includes(tag.trim())));
                    } else {
                        console.log('生成的标签都已存在，未添加新标签');
                    }

                } finally {
                    // 恢复原始会话ID
                    this.currentSessionId = originalSessionId;
                }

            } catch (error) {
                console.error('智能生成标签失败:', error);

                // 使用非阻塞的错误提示，避免阻塞弹框交互
                const errorMessage = error.message || '未知错误';
                const errorText = errorMessage.includes('Failed to fetch')
                    ? '网络连接失败，请检查网络后重试'
                    : `生成标签失败：${errorMessage}`;

                // 在弹框内显示错误提示，而不是使用 alert（alert 会阻塞）
                const modal = this.chatWindow?.querySelector('#pet-tag-manager');
                if (modal) {
                    // 移除已存在的错误提示
                    const existingError = modal.querySelector('.tag-error-message');
                    if (existingError) {
                        existingError.remove();
                    }

                    // 创建错误提示元素
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'tag-error-message';
                    errorDiv.textContent = errorText;
                    errorDiv.style.cssText = `
                        padding: 10px 15px !important;
                        margin: 10px 0 !important;
                        background: #ffebee !important;
                        color: #c62828 !important;
                        border: 1px solid #ef5350 !important;
                        border-radius: 6px !important;
                        font-size: 13px !important;
                        animation: fadeIn 0.3s ease !important;
                    `;

                    // 插入到输入组下方
                    const inputGroup = modal.querySelector('.tag-manager-input-group');
                    if (inputGroup && inputGroup.parentNode) {
                        // 插入到输入组和标签容器之间
                        const tagsContainer = modal.querySelector('.tag-manager-tags');
                        if (tagsContainer && tagsContainer.parentNode) {
                            tagsContainer.parentNode.insertBefore(errorDiv, tagsContainer);
                        } else {
                            inputGroup.parentNode.insertBefore(errorDiv, inputGroup.nextSibling);
                        }

                        // 3秒后自动移除错误提示
                        setTimeout(() => {
                            if (errorDiv.parentNode) {
                                errorDiv.style.opacity = '0';
                                errorDiv.style.transition = 'opacity 0.3s ease';
                                setTimeout(() => {
                                    if (errorDiv.parentNode) {
                                        errorDiv.remove();
                                    }
                                }, 300);
                            }
                        }, 3000);
                    }
                } else {
                    // 如果弹框不存在，使用 alert 作为后备方案
                    alert(errorText);
                }
            } finally {
                // 恢复按钮状态
                if (buttonElement) {
                    buttonElement.disabled = false;
                    buttonElement.style.background = '#9C27B0';
                    buttonElement.style.cursor = 'pointer';
                    buttonElement.textContent = '✨ 智能生成';
                }

                // 确保恢复原始会话ID（即使出错）
                if (this.currentSessionId !== originalSessionId) {
                    this.currentSessionId = originalSessionId;
                }

                // 确保弹框本身没有被禁用（防止其他按钮失效）
                const modal = this.chatWindow?.querySelector('#pet-tag-manager');
                if (modal) {
                    modal.style.pointerEvents = 'auto';
                    // 确保所有按钮都是可用的
                    const allButtons = modal.querySelectorAll('button');
                    allButtons.forEach(btn => {
                        if (btn !== buttonElement) {
                            btn.disabled = false;
                            btn.style.pointerEvents = 'auto';
                            btn.style.cursor = 'pointer';
                        }
                    });
                }
            }
        }
    }

    // 保存标签
    async saveTags(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法保存标签:', sessionId);
            return;
        }

        try {
            const session = this.sessions[sessionId];
            // 规范化标签（trim处理，去重，过滤空标签）
            if (session.tags && Array.isArray(session.tags)) {
                const normalizedTags = session.tags
                    .map(tag => tag ? tag.trim() : '')
                    .filter(tag => tag.length > 0);
                // 去重
                session.tags = [...new Set(normalizedTags)];
            }
            session.updatedAt = Date.now();

            // 保存会话到本地
            await this.saveAllSessions(false, true);

            // 立即同步到后端（确保标签被保存）
            if (PET_CONFIG.api.syncSessionsToBackend && this.sessionApi) {
                await this.syncSessionToBackend(sessionId, true);
            }

            // 更新UI显示
            await this.updateSessionSidebar(true);

            // 关闭弹窗（不自动保存，因为已经保存过了）
            const modal = this.chatWindow?.querySelector('#pet-tag-manager');
            if (modal) {
                modal.style.display = 'none';
                const tagInput = modal.querySelector('.tag-manager-input');
                if (tagInput) {
                    tagInput.value = '';
                }
            }

            console.log('标签已保存:', session.tags);
        } catch (error) {
            console.error('保存标签失败:', error);
            alert('保存标签失败，请重试');
        }
    }

    // 关闭标签管理器（自动保存）
    async closeTagManager() {
        const modal = this.chatWindow?.querySelector('#pet-tag-manager');
        if (modal) {
            const sessionId = modal.dataset.sessionId;
            // 关闭前自动保存
            if (sessionId && this.sessions[sessionId]) {
                try {
                    const session = this.sessions[sessionId];
                    // 规范化标签（trim处理，去重，过滤空标签）
                    if (session.tags && Array.isArray(session.tags)) {
                        const normalizedTags = session.tags
                            .map(tag => tag ? tag.trim() : '')
                            .filter(tag => tag.length > 0);
                        // 去重
                        session.tags = [...new Set(normalizedTags)];
                    }
                    session.updatedAt = Date.now();
                    await this.saveAllSessions(false, true);

                    // 立即同步到后端（确保标签被保存）
                    if (PET_CONFIG.api.syncSessionsToBackend && this.sessionApi) {
                        await this.syncSessionToBackend(sessionId, true);
                    }

                    await this.updateSessionSidebar(true);
                } catch (error) {
                    console.error('自动保存标签失败:', error);
                }
            }

            modal.style.display = 'none';

            // 显示折叠按钮
            const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
            const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
            if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
            if (inputToggleBtn) inputToggleBtn.style.display = 'flex';

            const tagInput = modal.querySelector('.tag-manager-input');
            if (tagInput) {
                tagInput.value = '';
            }
        }
    }

    // 确保上下文编辑器 UI 存在
    ensureContextEditorUi() {
        if (!this.chatWindow) return;
        if (document.getElementById('pet-context-editor')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-context-editor';
        // 初始使用顶部不遮住 chat-header 的定位（根据当前 header 高度）
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            top: ${headerH}px !important;
            background: transparent !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
            pointer-events: none !important;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            width: calc(100% - 24px) !important;
            height: calc(100% - 12px) !important;
            margin: 0 12px 12px 12px !important;
            background: #1f1f1f !important;
            color: #fff !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            min-height: 0 !important;
            pointer-events: auto !important;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            background: rgba(255,255,255,0.04) !important;
        `;
        const title = document.createElement('div');
        title.textContent = '页面上下文（Markdown）';
        title.style.cssText = 'font-weight: 600;';
        const headerBtns = document.createElement('div');
        headerBtns.style.cssText = 'display:flex; gap:8px; align-items:center;';
        // 简洁模式切换：并排 / 仅编辑 / 仅预览
        const modeGroup = document.createElement('div');
        modeGroup.style.cssText = `
            display: inline-flex !important;
            gap: 6px !important;
            background: rgba(255,255,255,0.04) !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            padding: 4px !important;
        `;
        const makeModeBtn = (id, label, mode) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.textContent = label;
            btn.style.cssText = `
                padding: 4px 8px !important;
                font-size: 12px !important;
                border-radius: 6px !important;
                border: none !important;
                background: transparent !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
            `;
            btn.addEventListener('click', () => this.setContextMode(mode));
            return btn;
        };
        const btnSplit = makeModeBtn('pet-context-mode-split', '并排', 'split');
        const btnEdit = makeModeBtn('pet-context-mode-edit', '仅编辑', 'edit');
        const btnPreview = makeModeBtn('pet-context-mode-preview', '仅预览', 'preview');
        modeGroup.appendChild(btnSplit);
        modeGroup.appendChild(btnEdit);
        modeGroup.appendChild(btnPreview);
        const closeBtn = document.createElement('button');
        closeBtn.id = 'pet-context-close-btn';
        closeBtn.className = 'chat-toolbar-btn';
        closeBtn.setAttribute('aria-label', '关闭上下文面板 (Esc)');
        closeBtn.setAttribute('title', '关闭 (Esc)');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            width: 28px !important;
            height: 28px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.12)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.04)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        closeBtn.addEventListener('mousedown', () => {
            closeBtn.style.transform = 'scale(0.96)';
        });
        closeBtn.addEventListener('mouseup', () => {
            closeBtn.style.transform = 'scale(1)';
        });
        closeBtn.addEventListener('click', () => this.closeContextEditor());
        headerBtns.appendChild(modeGroup);
        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.id = 'pet-context-copy-btn';
        copyBtn.className = 'chat-toolbar-btn';
        copyBtn.setAttribute('title', '复制内容');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.12)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.04)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        copyBtn.addEventListener('click', () => this.copyContextEditor());

        // 智能优化按钮组
        const optimizeBtnGroup = document.createElement('div');
        optimizeBtnGroup.style.cssText = 'display: flex; gap: 6px; align-items: center;';

        const optimizeBtn = document.createElement('button');
        optimizeBtn.id = 'pet-context-optimize-btn';
        optimizeBtn.textContent = '✨ 智能优化';
        optimizeBtn.setAttribute('title', '智能优化上下文内容');
        optimizeBtn.style.cssText = `
            padding: 4px 12px !important;
            border-radius: 4px !important;
            border: 1px solid rgba(76, 175, 80, 0.3) !important;
            background: rgba(76, 175, 80, 0.15) !important;
            color: #4caf50 !important;
            cursor: pointer !important;
            font-size: 12px !important;
            white-space: nowrap !important;
            transition: all 0.2s !important;
        `;
        optimizeBtn.addEventListener('click', async () => {
            await this.optimizeContext();
        });
        optimizeBtn.addEventListener('mouseenter', () => {
            if (!optimizeBtn.disabled) {
                optimizeBtn.style.background = 'rgba(76, 175, 80, 0.25)';
            }
        });
        optimizeBtn.addEventListener('mouseleave', () => {
            if (!optimizeBtn.disabled) {
                optimizeBtn.style.background = 'rgba(76, 175, 80, 0.15)';
            }
        });

        const undoBtn = document.createElement('button');
        undoBtn.id = 'pet-context-undo-btn';
        undoBtn.textContent = '↶ 撤销';
        undoBtn.setAttribute('title', '撤销优化');
        undoBtn.style.cssText = `
            padding: 4px 12px !important;
            border-radius: 4px !important;
            border: 1px solid rgba(255, 152, 0, 0.3) !important;
            background: rgba(255, 152, 0, 0.15) !important;
            color: #ff9800 !important;
            cursor: pointer !important;
            font-size: 12px !important;
            white-space: nowrap !important;
            display: none !important;
            transition: all 0.2s !important;
        `;
        undoBtn.addEventListener('click', () => {
            const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
            if (textarea) {
                const originalText = textarea.getAttribute('data-original-text');
                if (originalText !== null) {
                    textarea.value = originalText;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    undoBtn.style.display = 'none';
                    this.showNotification('已撤销优化', 'info');
                }
            }
        });
        undoBtn.addEventListener('mouseenter', () => {
            undoBtn.style.background = 'rgba(255, 152, 0, 0.25)';
        });
        undoBtn.addEventListener('mouseleave', () => {
            undoBtn.style.background = 'rgba(255, 152, 0, 0.15)';
        });

        optimizeBtnGroup.appendChild(optimizeBtn);
        optimizeBtnGroup.appendChild(undoBtn);

        // 拉取当前网页上下文按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'pet-context-refresh-btn';
        refreshBtn.className = 'chat-toolbar-btn';
        refreshBtn.setAttribute('title', '拉取当前网页上下文');
        refreshBtn.setAttribute('aria-label', '拉取当前网页上下文');
        refreshBtn.textContent = '刷新';
        refreshBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease, color .12s ease !important;
            outline: none !important;
        `;
        refreshBtn.addEventListener('mouseenter', () => {
            if (!refreshBtn.hasAttribute('data-refreshing')) {
                refreshBtn.style.background = 'rgba(255,255,255,0.12)';
                refreshBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            }
        });
        refreshBtn.addEventListener('mouseleave', () => {
            if (!refreshBtn.hasAttribute('data-refreshing')) {
                refreshBtn.style.background = 'rgba(255,255,255,0.04)';
                refreshBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            }
        });
        refreshBtn.addEventListener('click', async () => {
            if (refreshBtn.hasAttribute('data-refreshing')) return;

            refreshBtn.setAttribute('data-refreshing', 'true');
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '拉取中...';
            refreshBtn.style.opacity = '0.6';
            refreshBtn.style.cursor = 'not-allowed';

            try {
                await this.refreshContextFromPage();

                // 显示成功提示
                refreshBtn.textContent = '✓ 已更新';
                refreshBtn.style.background = 'rgba(76, 175, 80, 0.2)';
                refreshBtn.style.color = '#4caf50';
                refreshBtn.style.borderColor = 'rgba(76, 175, 80, 0.4)';

                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                    refreshBtn.style.background = 'rgba(255,255,255,0.04)';
                    refreshBtn.style.color = '#e5e7eb';
                    refreshBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                    refreshBtn.removeAttribute('data-refreshing');
                    refreshBtn.style.opacity = '1';
                    refreshBtn.style.cursor = 'pointer';
                }, 2000);
            } catch (error) {
                console.error('拉取网页上下文失败:', error);

                // 显示失败提示
                refreshBtn.textContent = '✕ 失败';
                refreshBtn.style.background = 'rgba(244, 67, 54, 0.2)';
                refreshBtn.style.color = '#f44336';
                refreshBtn.style.borderColor = 'rgba(244, 67, 54, 0.4)';

                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                    refreshBtn.style.background = 'rgba(255,255,255,0.04)';
                    refreshBtn.style.color = '#e5e7eb';
                    refreshBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                    refreshBtn.removeAttribute('data-refreshing');
                    refreshBtn.style.opacity = '1';
                    refreshBtn.style.cursor = 'pointer';
                }, 2000);
            }
        });

        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.id = 'pet-context-save-btn';
        saveBtn.className = 'chat-toolbar-btn';
        saveBtn.setAttribute('title', '保存修改 (Ctrl+S / Cmd+S)');
        saveBtn.setAttribute('aria-label', '保存修改');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease, color .12s ease !important;
            outline: none !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            if (!saveBtn.hasAttribute('data-saving')) {
                saveBtn.style.background = 'rgba(255,255,255,0.12)';
                saveBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            }
        });
        saveBtn.addEventListener('mouseleave', () => {
            if (!saveBtn.hasAttribute('data-saving')) {
                saveBtn.style.background = 'rgba(255,255,255,0.04)';
                saveBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            }
        });
        saveBtn.addEventListener('click', async () => {
            if (saveBtn.hasAttribute('data-saving')) return;

            saveBtn.setAttribute('data-saving', 'true');
            const originalText = saveBtn.textContent; // 保存原始文本（应该是"保存"）
            saveBtn.textContent = '保存中...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.cursor = 'not-allowed';

            try {
                const success = await this.saveContextEditor();
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, success, originalText);
            } catch (error) {
                console.error('保存失败:', error);
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, false, originalText);
            } finally {
                // 在状态提示显示2秒后，移除禁用状态
                setTimeout(() => {
                    saveBtn.removeAttribute('data-saving');
                    saveBtn.style.opacity = '1';
                    saveBtn.style.cursor = 'pointer';
                }, 2000);
            }
        });

        // 下载按钮（导出 Markdown）
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'pet-context-download-btn';
        downloadBtn.className = 'chat-toolbar-btn';
        downloadBtn.setAttribute('title', '下载当前上下文为 Markdown (.md)');
        downloadBtn.textContent = '下载';
        downloadBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
        `;
        downloadBtn.addEventListener('click', () => this.downloadContextMarkdown());

        // 翻译按钮组
        const translateBtnGroup = document.createElement('div');
        translateBtnGroup.style.cssText = 'display: flex; gap: 6px; align-items: center;';

        // 翻译成中文按钮
        const translateToZhBtn = document.createElement('button');
        translateToZhBtn.id = 'pet-context-translate-zh-btn';
        translateToZhBtn.className = 'chat-toolbar-btn';
        translateToZhBtn.setAttribute('title', '翻译成中文');
        translateToZhBtn.textContent = '🇨🇳 中文';
        translateToZhBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(33, 150, 243, 0.3) !important;
            background: rgba(33, 150, 243, 0.15) !important;
            color: #2196f3 !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
            white-space: nowrap !important;
        `;
        translateToZhBtn.addEventListener('mouseenter', () => {
            if (!translateToZhBtn.hasAttribute('data-translating')) {
                translateToZhBtn.style.background = 'rgba(33, 150, 243, 0.25)';
                translateToZhBtn.style.borderColor = 'rgba(33, 150, 243, 0.4)';
            }
        });
        translateToZhBtn.addEventListener('mouseleave', () => {
            if (!translateToZhBtn.hasAttribute('data-translating')) {
                translateToZhBtn.style.background = 'rgba(33, 150, 243, 0.15)';
                translateToZhBtn.style.borderColor = 'rgba(33, 150, 243, 0.3)';
            }
        });
        translateToZhBtn.addEventListener('click', async () => {
            await this.translateContext('zh');
        });

        // 翻译成英文按钮
        const translateToEnBtn = document.createElement('button');
        translateToEnBtn.id = 'pet-context-translate-en-btn';
        translateToEnBtn.className = 'chat-toolbar-btn';
        translateToEnBtn.setAttribute('title', '翻译成英文');
        translateToEnBtn.textContent = '🇺🇸 英文';
        translateToEnBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(156, 39, 176, 0.3) !important;
            background: rgba(156, 39, 176, 0.15) !important;
            color: #9c27b0 !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
            white-space: nowrap !important;
        `;
        translateToEnBtn.addEventListener('mouseenter', () => {
            if (!translateToEnBtn.hasAttribute('data-translating')) {
                translateToEnBtn.style.background = 'rgba(156, 39, 176, 0.25)';
                translateToEnBtn.style.borderColor = 'rgba(156, 39, 176, 0.4)';
            }
        });
        translateToEnBtn.addEventListener('mouseleave', () => {
            if (!translateToEnBtn.hasAttribute('data-translating')) {
                translateToEnBtn.style.background = 'rgba(156, 39, 176, 0.15)';
                translateToEnBtn.style.borderColor = 'rgba(156, 39, 176, 0.3)';
            }
        });
        translateToEnBtn.addEventListener('click', async () => {
            await this.translateContext('en');
        });

        translateBtnGroup.appendChild(translateToZhBtn);
        translateBtnGroup.appendChild(translateToEnBtn);

        headerBtns.appendChild(copyBtn);
        headerBtns.appendChild(optimizeBtnGroup);
        headerBtns.appendChild(translateBtnGroup);
        headerBtns.appendChild(refreshBtn);
        headerBtns.appendChild(saveBtn);
        headerBtns.appendChild(downloadBtn);
        headerBtns.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerBtns);

        const body = document.createElement('div');
        body.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            padding: 10px !important;
            gap: 10px !important;
            min-height: 0 !important;
        `;
        const textarea = document.createElement('textarea');
        textarea.id = 'pet-context-editor-textarea';
        textarea.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #121212 !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            outline: none !important;
            resize: none !important;
            white-space: pre-wrap !important;
            min-height: 0 !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        `;
        const preview = document.createElement('div');
        preview.id = 'pet-context-preview';
        preview.className = 'markdown-content'; // 添加 markdown-content 类以应用样式
        preview.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #0e0e0e !important;
            color: #e5e7eb !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            pointer-events: auto !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
        `;
        // 防止滚动事件冒泡到父级，保证自身滚动有效
        preview.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        preview.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
        // 编辑时实时更新预览（防抖）
        textarea.addEventListener('input', () => {
            if (this._contextPreviewTimer) clearTimeout(this._contextPreviewTimer);
            this._contextPreviewTimer = setTimeout(() => {
                this.updateContextPreview();
            }, 150);
        });
        // 同步滚动（比例映射）
        textarea.addEventListener('scroll', () => {
            const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-context-preview') : null;
            if (!previewEl) return;
            const tMax = textarea.scrollHeight - textarea.clientHeight;
            const pMax = previewEl.scrollHeight - previewEl.clientHeight;
            if (tMax > 0 && pMax >= 0) {
                const ratio = textarea.scrollTop / tMax;
                previewEl.scrollTop = ratio * pMax;
            }
        }, { passive: true });
        body.appendChild(textarea);
        body.appendChild(preview);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);
        // 确保聊天窗口容器为定位上下文
        const currentPosition = window.getComputedStyle(this.chatWindow).position;
        if (currentPosition === 'static') {
            this.chatWindow.style.position = 'relative';
        }
        this.chatWindow.appendChild(overlay);
    }

    openContextEditor() {
        this.ensureContextEditorUi();
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null;
        if (!overlay) return;
        overlay.style.display = 'flex';
        // 打开时根据当前 header 高度校正位置
        this.updateContextEditorPosition();
        this.loadContextIntoEditor();
        this.updateContextPreview();
        // 隐藏撤销按钮（打开编辑器时重置状态）
        const undoBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-undo-btn') : null;
        if (undoBtn) {
            undoBtn.style.display = 'none';
        }
        // 默认并排模式
        this._contextPreviewMode = this._contextPreviewMode || 'split';
        this.applyContextPreviewMode();
        // 隐藏折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';
        // 键盘快捷键：Esc 关闭，Ctrl+S / Cmd+S 保存
        this._contextKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeContextEditor();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const saveBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-save-btn') : null;
                if (saveBtn && !saveBtn.hasAttribute('data-saving')) {
                    saveBtn.click();
                }
            }
        };
        document.addEventListener('keydown', this._contextKeydownHandler, { capture: true });
        // 监听窗口尺寸变化，动态更新覆盖层位置
        this._contextResizeHandler = () => this.updateContextEditorPosition();
        window.addEventListener('resize', this._contextResizeHandler, { passive: true });
    }

    closeContextEditor() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor') : null;
        if (overlay) overlay.style.display = 'none';

        // 显示折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
        if (inputToggleBtn) inputToggleBtn.style.display = 'flex';

        if (this._contextKeydownHandler) {
            document.removeEventListener('keydown', this._contextKeydownHandler, { capture: true });
            this._contextKeydownHandler = null;
        }
        if (this._contextResizeHandler) {
            window.removeEventListener('resize', this._contextResizeHandler);
            this._contextResizeHandler = null;
        }
    }

    setContextMode(mode) {
        this._contextPreviewMode = mode; // 'split' | 'edit' | 'preview'
        this.applyContextPreviewMode();
    }

    applyContextPreviewMode() {
        if (!this.chatWindow) return;
        const textarea = this.chatWindow.querySelector('#pet-context-editor-textarea');
        const preview = this.chatWindow.querySelector('#pet-context-preview');
        const btnSplit = this.chatWindow.querySelector('#pet-context-mode-split');
        const btnEdit = this.chatWindow.querySelector('#pet-context-mode-edit');
        const btnPreview = this.chatWindow.querySelector('#pet-context-mode-preview');
        if (!textarea || !preview) return;
        const mode = this._contextPreviewMode;
        const isPreviewOnly = mode === 'preview';
        const isEditOnly = mode === 'edit';
        textarea.style.display = isPreviewOnly ? 'none' : 'block';
        preview.style.display = isEditOnly ? 'none' : 'block';
        textarea.style.width = isEditOnly ? '100%' : (isPreviewOnly ? '0%' : '50%');
        preview.style.width = isPreviewOnly ? '100%' : (isEditOnly ? '0%' : '50%');
        // 激活态样式更简单：当前模式高亮底色
        const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
        const resetBtn = (b) => { if (!b) return; b.style.background = 'transparent'; b.style.color = '#e5e7eb'; b.style.border = 'none'; };
        const activateBtn = (b) => { if (!b) return; b.style.background = currentMainColor; b.style.color = '#fff'; b.style.border = 'none'; };
        resetBtn(btnSplit); resetBtn(btnEdit); resetBtn(btnPreview);
        if (mode === 'split') activateBtn(btnSplit);
        if (mode === 'edit') activateBtn(btnEdit);
        if (mode === 'preview') activateBtn(btnPreview);
    }

    // ========== 消息编辑器（类似上下文编辑器） ==========

    // 确保消息编辑器 UI 存在
    ensureMessageEditorUi() {
        if (!this.chatWindow) return;
        if (document.getElementById('pet-message-editor')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-message-editor';
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            top: ${headerH}px !important;
            background: transparent !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 10002 !important;
            pointer-events: none !important;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            width: calc(100% - 24px) !important;
            height: calc(100% - 12px) !important;
            margin: 0 12px 12px 12px !important;
            background: #1f1f1f !important;
            color: #fff !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            min-height: 0 !important;
            pointer-events: auto !important;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 14px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid rgba(255,255,255,0.08) !important;
            background: rgba(255,255,255,0.04) !important;
        `;
        const title = document.createElement('div');
        title.textContent = '编辑消息';
        title.style.cssText = 'font-weight: 600;';
        const headerBtns = document.createElement('div');
        headerBtns.style.cssText = 'display:flex; gap:8px; align-items:center;';

        // 模式切换：并排 / 仅编辑 / 仅预览
        const modeGroup = document.createElement('div');
        modeGroup.style.cssText = `
            display: inline-flex !important;
            gap: 6px !important;
            background: rgba(255,255,255,0.04) !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            padding: 4px !important;
        `;
        const makeModeBtn = (id, label, mode) => {
            const btn = document.createElement('button');
            btn.id = id;
            btn.textContent = label;
            btn.style.cssText = `
                padding: 4px 8px !important;
                font-size: 12px !important;
                border-radius: 6px !important;
                border: none !important;
                background: transparent !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
            `;
            btn.addEventListener('click', () => this.setMessageEditorMode(mode));
            return btn;
        };
        const btnSplit = makeModeBtn('pet-message-mode-split', '并排', 'split');
        const btnEdit = makeModeBtn('pet-message-mode-edit', '仅编辑', 'edit');
        const btnPreview = makeModeBtn('pet-message-mode-preview', '仅预览', 'preview');
        modeGroup.appendChild(btnSplit);
        modeGroup.appendChild(btnEdit);
        modeGroup.appendChild(btnPreview);

        // 保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.id = 'pet-message-save-btn';
        saveBtn.className = 'chat-toolbar-btn';
        saveBtn.setAttribute('title', '保存修改 (Ctrl+S / Cmd+S)');
        saveBtn.setAttribute('aria-label', '保存修改');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 4px 12px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(76, 175, 80, 0.3) !important;
            color: #4caf50 !important;
            cursor: pointer !important;
        `;
        saveBtn.addEventListener('click', async () => {
            if (saveBtn.hasAttribute('data-saving')) return;

            saveBtn.setAttribute('data-saving', 'true');
            const originalText = saveBtn.textContent; // 保存原始文本（应该是"保存"）
            saveBtn.textContent = '保存中...';
            saveBtn.style.opacity = '0.6';
            saveBtn.style.cursor = 'not-allowed';

            try {
                const success = await this.saveMessageEditor();
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, success, originalText);
            } catch (error) {
                console.error('保存失败:', error);
                // 传递原始文本，确保恢复正确
                this._showSaveStatus(saveBtn, false, originalText);
            } finally {
                // 在状态提示显示2秒后，移除禁用状态
                setTimeout(() => {
                    saveBtn.removeAttribute('data-saving');
                    saveBtn.style.opacity = '1';
                    saveBtn.style.cursor = 'pointer';
                }, 2000);
            }
        });

        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.id = 'pet-message-copy-btn';
        copyBtn.className = 'chat-toolbar-btn';
        copyBtn.setAttribute('title', '复制内容');
        copyBtn.textContent = '复制';
        copyBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.12)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.background = 'rgba(255,255,255,0.04)';
            copyBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        copyBtn.addEventListener('click', () => this.copyMessageEditor());

        // 下载按钮（导出 Markdown）
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'pet-message-download-btn';
        downloadBtn.className = 'chat-toolbar-btn';
        downloadBtn.setAttribute('title', '下载为 Markdown (.md)');
        downloadBtn.textContent = '下载';
        downloadBtn.style.cssText = `
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
        `;
        downloadBtn.addEventListener('click', () => this.downloadMessageMarkdown());

        // 取消/关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.id = 'pet-message-close-btn';
        closeBtn.className = 'chat-toolbar-btn';
        closeBtn.setAttribute('aria-label', '关闭编辑器 (Esc)');
        closeBtn.setAttribute('title', '取消 (Esc)');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            width: 28px !important;
            height: 28px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.04) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: transform .12s ease, background .12s ease, border-color .12s ease !important;
            outline: none !important;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.12)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.25)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.04)';
            closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        closeBtn.addEventListener('click', () => this.closeMessageEditor());

        headerBtns.appendChild(modeGroup);
        headerBtns.appendChild(copyBtn);
        headerBtns.appendChild(downloadBtn);
        headerBtns.appendChild(saveBtn);
        headerBtns.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerBtns);

        const body = document.createElement('div');
        body.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            padding: 10px !important;
            gap: 10px !important;
            min-height: 0 !important;
        `;
        const textarea = document.createElement('textarea');
        textarea.id = 'pet-message-editor-textarea';
        textarea.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #121212 !important;
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            outline: none !important;
            resize: none !important;
            white-space: pre-wrap !important;
            min-height: 0 !important;
            overflow: auto !important;
            -webkit-overflow-scrolling: touch !important;
        `;
        const preview = document.createElement('div');
        preview.id = 'pet-message-preview';
        preview.className = 'markdown-content';
        preview.style.cssText = `
            flex: 1 !important;
            width: 50% !important;
            height: 100% !important;
            background: #0e0e0e !important;
            color: #e5e7eb !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            pointer-events: auto !important;
        `;
        // 防止滚动事件冒泡
        preview.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        preview.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });

        // 编辑时实时更新预览（防抖）
        textarea.addEventListener('input', () => {
            if (this._messagePreviewTimer) clearTimeout(this._messagePreviewTimer);
            this._messagePreviewTimer = setTimeout(() => {
                this.updateMessagePreview();
            }, 150);
        });

        // 同步滚动
        textarea.addEventListener('scroll', () => {
            const previewEl = this.chatWindow ? this.chatWindow.querySelector('#pet-message-preview') : null;
            if (!previewEl) return;
            const tMax = textarea.scrollHeight - textarea.clientHeight;
            const pMax = previewEl.scrollHeight - previewEl.clientHeight;
            if (tMax > 0 && pMax >= 0) {
                const ratio = textarea.scrollTop / tMax;
                previewEl.scrollTop = ratio * pMax;
            }
        }, { passive: true });

        // Ctrl+Enter 保存，Esc 关闭
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveMessageEditor();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeMessageEditor();
            }
        });

        body.appendChild(textarea);
        body.appendChild(preview);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);

        // 确保聊天窗口容器为定位上下文
        const currentPosition = window.getComputedStyle(this.chatWindow).position;
        if (currentPosition === 'static') {
            this.chatWindow.style.position = 'relative';
        }
        this.chatWindow.appendChild(overlay);
    }

    openMessageEditor(messageElement, sender) {
        this.ensureMessageEditorUi();
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        if (!overlay) return;

        // 保存当前编辑的消息元素和发送者
        this._editingMessageElement = messageElement;
        this._editingMessageSender = sender;

        // 获取原始内容
        let originalText = messageElement.getAttribute('data-original-text') || '';
        if (!originalText) {
            originalText = messageElement.innerText || messageElement.textContent || '';
        }

        const textarea = overlay.querySelector('#pet-message-editor-textarea');
        if (textarea) {
            textarea.value = originalText;
        }

        overlay.style.display = 'flex';
        this.updateContextEditorPosition(); // 复用位置更新函数
        this.updateMessagePreview();

        // 隐藏折叠按钮（避免在弹框中显示两个折叠按钮）
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';

        // 默认并排模式
        this._messageEditorMode = this._messageEditorMode || 'split';
        this.applyMessageEditorMode();

        // 键盘快捷键：Esc 关闭，Ctrl+S / Cmd+S 保存
        this._messageKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeMessageEditor();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const saveBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-message-save-btn') : null;
                if (saveBtn && !saveBtn.hasAttribute('data-saving')) {
                    saveBtn.click();
                }
            }
        };
        document.addEventListener('keydown', this._messageKeydownHandler, { capture: true });

        // 监听窗口尺寸变化
        this._messageResizeHandler = () => this.updateContextEditorPosition();
        window.addEventListener('resize', this._messageResizeHandler, { passive: true });

        // 聚焦到文本区域
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
            }
        }, 100);
    }

    closeMessageEditor() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        if (overlay) overlay.style.display = 'none';

        // 显示折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
        if (inputToggleBtn) inputToggleBtn.style.display = 'flex';

        this._editingMessageElement = null;
        this._editingMessageSender = null;

        if (this._messageKeydownHandler) {
            document.removeEventListener('keydown', this._messageKeydownHandler, { capture: true });
            this._messageKeydownHandler = null;
        }
        if (this._messageResizeHandler) {
            window.removeEventListener('resize', this._messageResizeHandler);
            this._messageResizeHandler = null;
        }
        if (this._messagePreviewTimer) {
            clearTimeout(this._messagePreviewTimer);
            this._messagePreviewTimer = null;
        }
    }

    setMessageEditorMode(mode) {
        this._messageEditorMode = mode; // 'split' | 'edit' | 'preview'
        this.applyMessageEditorMode();
    }

    applyMessageEditorMode() {
        if (!this.chatWindow) return;
        const textarea = this.chatWindow.querySelector('#pet-message-editor-textarea');
        const preview = this.chatWindow.querySelector('#pet-message-preview');
        const btnSplit = this.chatWindow.querySelector('#pet-message-mode-split');
        const btnEdit = this.chatWindow.querySelector('#pet-message-mode-edit');
        const btnPreview = this.chatWindow.querySelector('#pet-message-mode-preview');
        if (!textarea || !preview) return;

        const mode = this._messageEditorMode;
        const isPreviewOnly = mode === 'preview';
        const isEditOnly = mode === 'edit';
        textarea.style.display = isPreviewOnly ? 'none' : 'block';
        preview.style.display = isEditOnly ? 'none' : 'block';
        textarea.style.width = isEditOnly ? '100%' : (isPreviewOnly ? '0%' : '50%');
        preview.style.width = isPreviewOnly ? '100%' : (isEditOnly ? '0%' : '50%');

        // 激活态样式
        const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
        const resetBtn = (b) => { if (!b) return; b.style.background = 'transparent'; b.style.color = '#e5e7eb'; b.style.border = 'none'; };
        const activateBtn = (b) => { if (!b) return; b.style.background = currentMainColor; b.style.color = '#fff'; b.style.border = 'none'; };
        resetBtn(btnSplit); resetBtn(btnEdit); resetBtn(btnPreview);
        if (mode === 'split') activateBtn(btnSplit);
        if (mode === 'edit') activateBtn(btnEdit);
        if (mode === 'preview') activateBtn(btnPreview);
    }

    updateMessagePreview() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor-textarea') : null;
        const preview = this.chatWindow ? this.chatWindow.querySelector('#pet-message-preview') : null;
        if (!textarea || !preview) return;

        const markdown = textarea.value || '';
        preview.innerHTML = this.renderMarkdown(markdown);

        // 渲染 mermaid（若有）- 防抖
        if (preview._mermaidTimer) {
            clearTimeout(preview._mermaidTimer);
            preview._mermaidTimer = null;
        }
        preview._mermaidTimer = setTimeout(async () => {
            await this.processMermaidBlocks(preview);
            preview._mermaidTimer = null;
        }, 200);
    }

    async saveMessageEditor() {
        if (!this._editingMessageElement || !this._editingMessageSender) {
            return false;
        }

        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) {
            return false;
        }

        const newText = textarea.value.trim();
        if (!newText) {
            // 如果内容为空，关闭编辑器
            this.closeMessageEditor();
            return false;
        }

        try {
            const messageElement = this._editingMessageElement;
            const sender = this._editingMessageSender;

            // 更新消息内容
            if (sender === 'pet') {
                // 对于宠物消息，使用Markdown渲染
                const oldText = messageElement.getAttribute('data-original-text') || messageElement.textContent || '';
                messageElement.innerHTML = this.renderMarkdown(newText);
                messageElement.classList.add('markdown-content');
                messageElement.setAttribute('data-original-text', newText);

                // 更新会话中对应的消息内容
                if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                    const session = this.sessions[this.currentSessionId];
                    if (session.messages && Array.isArray(session.messages)) {
                        // 找到对应的消息并更新
                        const messageIndex = session.messages.findIndex(msg =>
                            msg.type === 'pet' &&
                            (msg.content === oldText || msg.content.trim() === oldText.trim())
                        );

                        if (messageIndex !== -1) {
                            session.messages[messageIndex].content = newText;
                            session.updatedAt = Date.now();
                            // 异步保存会话
                            await this.saveAllSessions();
                            console.log(`已更新会话 ${this.currentSessionId} 中的消息内容`);
                        }
                    }
                }

                // 处理可能的 Mermaid 图表
                setTimeout(async () => {
                    try {
                        await this.loadMermaid();
                        const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                        if (hasMermaidCode) {
                            await this.processMermaidBlocks(messageElement);
                        }
                    } catch (error) {
                        console.error('处理编辑后的 Mermaid 图表时出错:', error);
                    }
                }, 200);
            } else {
                // 对于用户消息，使用 Markdown 渲染（与 pet 消息一致）
                const oldText = messageElement.getAttribute('data-original-text') || messageElement.textContent || '';
                messageElement.innerHTML = this.renderMarkdown(newText);
                messageElement.classList.add('markdown-content');
                messageElement.setAttribute('data-original-text', newText);

                // 处理可能的 Mermaid 图表
                setTimeout(async () => {
                    try {
                        await this.loadMermaid();
                        const hasMermaidCode = messageElement.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                        if (hasMermaidCode) {
                            await this.processMermaidBlocks(messageElement);
                        }
                    } catch (error) {
                        console.error('处理编辑后的 Mermaid 图表时出错:', error);
                    }
                }, 200);

                // 更新会话中对应的消息内容
                if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                    const session = this.sessions[this.currentSessionId];
                    if (session.messages && Array.isArray(session.messages)) {
                        // 找到对应的消息并更新
                        const messageIndex = session.messages.findIndex(msg =>
                            msg.type === 'user' &&
                            (msg.content === oldText || msg.content.trim() === oldText.trim())
                        );

                        if (messageIndex !== -1) {
                            session.messages[messageIndex].content = newText;
                            session.updatedAt = Date.now();
                            // 异步保存会话
                            await this.saveAllSessions();
                            console.log(`已更新会话 ${this.currentSessionId} 中的用户消息内容`);
                        }
                    }
                }
            }

            messageElement.setAttribute('data-edited', 'true');

            // 保存后不关闭编辑器，允许继续编辑
            // 更新预览
            this.updateMessagePreview();

            return true;
        } catch (error) {
            console.error('保存消息失败:', error);
            return false;
        }
    }

    // 复制消息编辑器内容
    copyMessageEditor() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) return;

        const content = textarea.value || '';
        if (!content.trim()) return;

        // 复制到剪贴板
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            // 显示复制成功反馈
            const copyBtn = overlay ? overlay.querySelector('#pet-message-copy-btn') : null;
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制';
                copyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
                copyBtn.style.color = '#4caf50';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'rgba(255,255,255,0.04)';
                    copyBtn.style.color = '#e5e7eb';
                }, 1500);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }

        document.body.removeChild(textArea);
    }

    // 下载消息编辑器内容为 Markdown
    downloadMessageMarkdown() {
        const overlay = this.chatWindow ? this.chatWindow.querySelector('#pet-message-editor') : null;
        const textarea = overlay ? overlay.querySelector('#pet-message-editor-textarea') : null;
        if (!textarea) return;

        const content = textarea.value || '';
        if (!content.trim()) return;

        // 生成文件名（使用时间戳）
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const filename = `message_${stamp}.md`;

        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                if (a.parentNode) a.parentNode.removeChild(a);
            }, 0);
        } catch (e) {
            console.error('下载失败:', e);
        }
    }

    // 统一获取角色图标（优先自定义，其次按 actionKey 映射，最后兜底）
    getRoleIcon(roleConfig, allConfigs = null) {
        if (!roleConfig) return '🙂';

        // 优先使用配置中的自定义图标
        const icon = roleConfig.icon;
        const custom = icon && typeof icon === 'string' ? icon.trim() : '';
        if (custom) return custom;

        // 如果没有自定义图标，从角色配置列表中查找
        const actionKey = roleConfig.actionKey;
        if (actionKey && allConfigs && Array.isArray(allConfigs)) {
            const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey);
            if (foundConfig && foundConfig.icon && typeof foundConfig.icon === 'string') {
                const foundIcon = foundConfig.icon.trim();
                if (foundIcon) return foundIcon;
            }
        }

        // 如果还是找不到，返回默认图标
        return '🙂';
    }

    // 统一获取角色标签/名称（优先自定义，其次从角色配置列表中查找）
    getRoleLabel(roleConfig, allConfigs = null) {
        if (!roleConfig) return '自定义角色';

        // 优先使用配置中的自定义标签
        if (roleConfig.label && typeof roleConfig.label === 'string') {
            const label = roleConfig.label.trim();
            if (label) return label;
        }

        // 如果没有自定义标签，从角色配置列表中查找
        const actionKey = roleConfig.actionKey;
        if (actionKey && allConfigs && Array.isArray(allConfigs)) {
            const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey);
            if (foundConfig && foundConfig.label && typeof foundConfig.label === 'string') {
                const label = foundConfig.label.trim();
                if (label) return label;
            }
        }

        // 如果还是找不到，使用actionKey作为默认标签
        if (actionKey) {
            return actionKey;
        }

        return '自定义角色';
    }

    // 统一获取角色提示语（用于按钮的 title 属性，支持自定义）
    getRoleTooltip(roleConfig) {
        // 优先使用配置中的自定义提示语
        if (roleConfig && roleConfig.tooltip && typeof roleConfig.tooltip === 'string') {
            const tooltip = roleConfig.tooltip.trim();
            if (tooltip) return tooltip;
        }

        // 如果没有自定义提示语，使用标签作为提示语
        return this.getRoleLabel(roleConfig);
    }

    // 统一获取角色完整信息（图标、标签、提示语等）
    async getRoleInfoForAction(actionKey) {
        try {
            const configs = await this.getRoleConfigs();
            const cfg = Array.isArray(configs) ? configs.find(c => c && c.actionKey === actionKey) : null;

            return {
                icon: this.getRoleIcon(cfg || { actionKey }, configs),
                label: this.getRoleLabel(cfg || { actionKey }, configs),
                tooltip: this.getRoleTooltip(cfg || { actionKey }),
                config: cfg
            };
        } catch (error) {
            console.error('获取角色信息失败:', error);
            // 降级处理
            const fallbackConfig = { actionKey };
            return {
                icon: this.getRoleIcon(fallbackConfig, null),
                label: this.getRoleLabel(fallbackConfig, null),
                tooltip: this.getRoleTooltip(fallbackConfig),
                config: null
            };
        }
    }

    // 根据 actionKey 从角色配置中获取提示语（必须从角色配置中获取 prompt）
    async getRolePromptForAction(actionKey, pageInfo) {
        // 获取角色信息（图标、标签等）
        const roleInfo = await this.getRoleInfoForAction(actionKey);
        const cfg = roleInfo.config;

        // 检查角色配置中是否有 prompt
        if (!cfg || !cfg.prompt || !cfg.prompt.trim()) {
            throw new Error(`角色 ${actionKey} 未配置 prompt，请在角色设置中配置提示词`);
        }

        const pageTitle = pageInfo.title || document.title || '当前页面';
        const pageUrl = pageInfo.url || window.location.href;
        const pageDescription = pageInfo.description || '';
        const pageContent = pageInfo.content || '';

        // 构建 userPrompt
        const userPrompt = `页面标题：${pageTitle}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`;

        return {
            systemPrompt: cfg.prompt.trim(),
            userPrompt: userPrompt,
            label: roleInfo.label,
            icon: roleInfo.icon
        };
    }

    // 通用的流式生成函数，支持动态 systemPrompt 和 userPrompt
    async generateContentStream(systemPrompt, userPrompt, onContent, loadingText = '正在处理...') {
        try {
            console.log('调用大模型生成内容，systemPrompt长度:', systemPrompt ? systemPrompt.length : 0);

            // 使用统一的 payload 构建函数，自动包含会话 ID
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 调用大模型 API（使用流式接口）
            const apiUrl = PET_CONFIG.api.streamPromptUrl;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            // 使用通用的流式响应处理
            return await this.processStreamingResponse(response, onContent);
        } catch (error) {
            console.error('生成内容失败:', error);
            throw error;
        }
    }

    // 将角色设置应用到欢迎消息下方的动作按钮（根据 actionKey 动态更新图标、标题和提示语）
    async applyRoleConfigToActionIcon(iconEl, actionKey) {
        try {
            if (!iconEl || !actionKey) return;

            // 使用统一的角色信息获取函数
            const roleInfo = await this.getRoleInfoForAction(actionKey);

            // 更新按钮的图标、标题和提示语
            iconEl.innerHTML = roleInfo.icon || iconEl.innerHTML;
            iconEl.title = roleInfo.tooltip;
        } catch (_) { /* 忽略展示更新错误 */ }
    }

    // 创建动作按钮（根据角色配置动态创建）
    async createActionButton(actionKey) {
        const button = document.createElement('span');
        button.setAttribute('data-action-key', actionKey);

        // 从角色配置中动态获取图标、标签和提示语
        try {
            const roleInfo = await this.getRoleInfoForAction(actionKey);
            button.innerHTML = roleInfo.icon || '🙂';
            button.title = roleInfo.tooltip;
        } catch (error) {
            // 降级到默认值
            const fallbackInfo = await this.getRoleInfoForAction(actionKey);
            button.innerHTML = fallbackInfo.icon || '🙂';
            button.title = fallbackInfo.tooltip;
        }

        // 统一的按钮样式
        button.style.cssText = `
            padding: 2px !important;
            cursor: pointer !important;
            font-size: 10px !important;
            color: #666 !important;
            font-weight: 300 !important;
            transition: all 0.2s ease !important;
            flex-shrink: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            user-select: none !important;
            width: 18px !important;
            height: 18px !important;
            line-height: 18px !important;
        `;

        return button;
    }

    // 获取按角色设置列表顺序排列的已绑定角色的 actionKey 列表
    // 此方法与 renderRoleSettingsList() 共享相同的顺序逻辑
    async getOrderedBoundRoleKeys() {
        const configsRaw = await this.getRoleConfigs();
        const configs = Array.isArray(configsRaw) ? configsRaw : [];

        // 返回所有有 actionKey 的角色的 actionKey（保持配置中的顺序）
        const orderedKeys = [];
        const seenKeys = new Set();
        for (const config of configs) {
            if (config && config.actionKey && !seenKeys.has(config.actionKey)) {
                orderedKeys.push(config.actionKey);
                seenKeys.add(config.actionKey);
            }
        }

        return orderedKeys;
    }

    // 刷新欢迎消息操作按钮：显示角色列表作为按钮（设置按钮已移动到 chat-request-status-button 后面）
    async refreshWelcomeActionButtons() {
        if (!this.chatWindow) return;
        const container = this.chatWindow.querySelector('#pet-welcome-actions');
        if (!container) return;

        // 重建容器
        container.innerHTML = '';

        // 确保按钮样式容器正确（横向排列）
        container.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
        `;

        // 获取所有角色配置
        const configsRaw = await this.getRoleConfigs();

        // 确保 actionIcons 和 buttonHandlers 已初始化
        if (!this.actionIcons) {
            this.actionIcons = {};
        }
        if (!this.buttonHandlers) {
            this.buttonHandlers = {};
        }
        // 用于存储没有 actionKey 的角色按钮
        if (!this.roleButtonsById) {
            this.roleButtonsById = {};
        }

        // 先显示已绑定按钮的角色（按按钮顺序）
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();

        for (const key of orderedKeys) {
            const config = (configsRaw || []).find(c => c && c.actionKey === key);
            if (config) {
                boundRoleIds.add(config.id);

                // 创建角色按钮
                let button = this.actionIcons[key];
                if (!button) {
                    button = await this.createActionButton(key);
                    this.actionIcons[key] = button;

                    // 创建 processing flag 和 hover 处理
                    const processingFlag = { value: false };
                    this.buttonHandlers[key] = {
                        button,
                        processingFlag,
                        hover: {
                            mouseenter: function() {
                                if (!processingFlag.value) {
                                    this.style.fontSize = '12px';
                                    this.style.color = '#333';
                                    this.style.transform = 'scale(1.1)';
                                }
                            },
                            mouseleave: function() {
                                if (!processingFlag.value) {
                                    this.style.fontSize = '10px';
                                    this.style.color = '#666';
                                    this.style.transform = 'scale(1)';
                                }
                            }
                        }
                    };

                    // 绑定 hover 事件
                    button.addEventListener('mouseenter', this.buttonHandlers[key].hover.mouseenter);
                    button.addEventListener('mouseleave', this.buttonHandlers[key].hover.mouseleave);

                    // 绑定点击事件
                    if (!this.buttonHandlers[key].clickHandler) {
                        const clickHandler = this.createRoleButtonHandler(key, button, this.buttonHandlers[key].processingFlag);
                        button.addEventListener('click', clickHandler);
                        this.buttonHandlers[key].clickHandler = clickHandler;
                    }
                }

                // 更新按钮显示和配置
                button.style.display = 'inline-flex';
                await this.applyRoleConfigToActionIcon(button, key);

                // 如果按钮已经在容器中，不要重复添加
                if (button.parentNode !== container) {
                    container.appendChild(button);
                }
            }
        }

        // 再显示其他角色（没有绑定按钮的角色）作为可点击按钮
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id));
        for (const config of otherRoles) {
            // 创建或复用角色按钮（没有 actionKey，点击时请求 /prompt 接口）
            let button = this.roleButtonsById[config.id];
            if (!button) {
                button = document.createElement('span');
                button.setAttribute('data-role-id', config.id);
                button.style.cssText = `
                    padding: 2px !important;
                    cursor: pointer !important;
                    font-size: 10px !important;
                    color: #666 !important;
                    font-weight: 300 !important;
                    transition: all 0.2s ease !important;
                    flex-shrink: 0 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    user-select: none !important;
                    width: 18px !important;
                    height: 18px !important;
                    line-height: 18px !important;
                `;

                // 添加 hover 效果
                button.addEventListener('mouseenter', function() {
                    this.style.fontSize = '12px';
                    this.style.color = '#333';
                    this.style.transform = 'scale(1.1)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.fontSize = '10px';
                    this.style.color = '#666';
                    this.style.transform = 'scale(1)';
                });

                this.roleButtonsById[config.id] = button;
            }

            // 创建 processing flag 用于防止重复点击
            if (!this.roleButtonsProcessingFlags) {
                this.roleButtonsProcessingFlags = {};
            }
            if (!this.roleButtonsProcessingFlags[config.id]) {
                this.roleButtonsProcessingFlags[config.id] = { value: false };
            }
            const processingFlag = this.roleButtonsProcessingFlags[config.id];

            // 移除旧的点击事件（通过克隆节点来移除所有事件监听器）
            // 只有在按钮已在 DOM 中时才需要替换（移除旧的事件监听器）
            if (button.parentNode) {
                const oldButton = button;
                const newButton = oldButton.cloneNode(true);
                oldButton.parentNode.replaceChild(newButton, oldButton);
                button = newButton;
                this.roleButtonsById[config.id] = button;

                // 重新绑定 hover 效果（因为克隆后事件监听器丢失了）
                button.addEventListener('mouseenter', function() {
                    this.style.fontSize = '12px';
                    this.style.color = '#333';
                    this.style.transform = 'scale(1.1)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.fontSize = '10px';
                    this.style.color = '#666';
                    this.style.transform = 'scale(1)';
                });
            }

            // 点击时请求 /prompt 接口（参考 createRoleButtonHandler 的实现）
            // 对于已存在的按钮，需要先移除旧的点击事件（如果之前绑定过的话）
            // 但由于我们通过克隆来移除，所以这里直接绑定新事件即可
            button.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    // 如果是设置按钮或正在处理中，不执行
                    if (processingFlag.value) return;

                    processingFlag.value = true;
                    const originalIcon = button.innerHTML;
                    const originalTitle = button.title;

                    // 获取消息容器
                    const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                    if (!messagesContainer) {
                        console.error('无法找到消息容器');
                        processingFlag.value = false;
                        button.innerHTML = originalIcon;
                        button.style.opacity = '1';
                        button.style.cursor = 'pointer';
                        return;
                    }

                    // 获取页面信息：优先使用当前会话保存的页面上下文
                    let pageInfo;
                    if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                        const session = this.sessions[this.currentSessionId];
                        pageInfo = {
                            title: session.pageTitle || document.title || '当前页面',
                            url: session.url || window.location.href,
                            description: session.pageDescription || '',
                            content: session.pageContent || '' // 使用会话保存的页面内容
                        };
                    } else {
                        // 如果没有当前会话，使用当前页面信息
                        pageInfo = this.getPageInfo();
                    }

                    // 获取角色配置信息
                    const roleLabel = config.label || '自定义角色';
                    const roleIcon = this.getRoleIcon(config, configsRaw) || '🙂';
                    const systemPrompt = (config.prompt && config.prompt.trim()) ? config.prompt.trim() : '';

                    // 构建基础 userPrompt（页面信息）
                    const pageTitle = pageInfo.title || document.title || '当前页面';
                    const pageUrl = pageInfo.url || window.location.href;
                    const pageDescription = pageInfo.description || '';
                    const pageContent = pageInfo.content || '';
                    let baseUserPrompt = `页面标题：${pageTitle}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`;

                    // 构建包含会话上下文的 fromUser 参数（会使用会话保存的页面上下文）
                    const fromUser = this.buildFromUserWithContext(baseUserPrompt, roleLabel);

                    // 找到按钮所在的消息元素（向上查找包含用户消息的元素）
                    let userMessageDiv = null;
                    let currentElement = button;
                    while (currentElement && currentElement !== messagesContainer) {
                        // 检查当前元素是否包含 user-bubble
                        if (currentElement.querySelector) {
                            const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]');
                            if (userBubble) {
                                userMessageDiv = currentElement;
                                break;
                            }
                        }
                        // 如果当前元素有 data-message-id 属性，也检查它是否包含 user-bubble（消息元素有该属性）
                        if (currentElement.hasAttribute && currentElement.hasAttribute('data-message-id')) {
                            const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]');
                            if (userBubble) {
                                userMessageDiv = currentElement;
                                break;
                            }
                        }
                        currentElement = currentElement.parentElement;
                    }

                    // 创建新的消息（按钮操作生成的消息）
                    const message = this.createMessageElement('', 'pet');
                    message.setAttribute('data-button-action', 'true'); // 标记为按钮操作生成
                    messagesContainer.appendChild(message);
                    const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                    const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

                    // 显示加载动画
                    if (messageAvatar) {
                        messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                    }

                    // 使用角色配置中的图标显示加载文本
                    if (messageText) {
                        messageText.textContent = `${roleIcon} 正在${roleLabel}...`;
                    }

                    try {
                        // 使用 /prompt 接口生成内容（非流式）
                        console.log('调用大模型生成内容，角色:', roleLabel, '页面标题:', pageTitle);

                        // 创建 AbortController 用于终止请求
                        const abortController = new AbortController();
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(abortController);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('loading');
                        }

                        // 设置标志，避免 prompt 调用后触发会话列表刷新接口
                        this.skipSessionListRefresh = true;

                        // 使用统一的 payload 构建函数，自动包含会话 ID
                        // 如果找到了用户消息元素，将其传递给 buildPromptPayload，以便从正确的消息中提取图片
                        const payload = this.buildPromptPayload(
                            systemPrompt,
                            fromUser,
                            { messageDiv: userMessageDiv }
                        );

                        const response = await fetch(PET_CONFIG.api.promptUrl, {
                            method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
                            signal: abortController.signal
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                        }

                        // 先读取响应文本，判断是否为流式响应（SSE格式）
                        const responseText = await response.text();
                        let result;

                        // 检查是否包含SSE格式（包含 "data: "）
                        if (responseText.includes('data: ')) {
                            // 处理SSE流式响应
                            const lines = responseText.split('\n');
                            let accumulatedData = '';
                            let lastValidData = null;

                            for (const line of lines) {
                                const trimmedLine = line.trim();
                                if (trimmedLine.startsWith('data: ')) {
                                    try {
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr === '[DONE]' || dataStr === '') {
                                            continue;
                                        }

                                        // 尝试解析JSON
                                        const chunk = JSON.parse(dataStr);

                                        // 检查是否完成
                                        if (chunk.done === true) {
                                            break;
                                        }

                                        // 累积内容（处理流式内容块）
                                        if (chunk.data) {
                                            accumulatedData += chunk.data;
                                        } else if (chunk.content) {
                                            accumulatedData += chunk.content;
                                        } else if (chunk.message && chunk.message.content) {
                                            // Ollama格式
                                            accumulatedData += chunk.message.content;
                                        } else if (typeof chunk === 'string') {
                                            accumulatedData += chunk;
                                        }

                                        // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                        lastValidData = chunk;
                                    } catch (e) {
                                        // 如果不是JSON，可能是纯文本内容
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr && dataStr !== '[DONE]') {
                                            accumulatedData += dataStr;
                                        }
                                    }
                                }
                            }

                            // 如果累积了内容，创建结果对象
                            if (accumulatedData || lastValidData) {
                                if (lastValidData && lastValidData.status) {
                                    // 如果有status字段，保留原有结构，但替换data/content
                                    result = {
                                        ...lastValidData,
                                        data: accumulatedData || lastValidData.data || '',
                                        content: accumulatedData || lastValidData.content || ''
                                    };
                                } else {
                                    // 否则创建新的结果对象
                                    result = {
                                        data: accumulatedData,
                                        content: accumulatedData
                                    };
                                }
                            } else {
                                // 如果无法解析SSE格式，尝试直接解析整个响应
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    throw new Error('无法解析响应格式');
                                }
                            }
                        } else {
                            // 非SSE格式，直接解析JSON
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                // 如果解析失败，尝试查找SSE格式的数据
                                const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                if (sseMatch) {
                                    result = JSON.parse(sseMatch[1]);
                                } else {
                                    throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                }
                            }
                        }

                        // 适配响应格式: {status, msg, data, pagination}
                        let content = '';

                        // 优先尝试提取内容，不管status值是什么（因为可能有内容但status不是200）
                        if (result.data) {
                            // 提取 data 字段
                            content = result.data;
                        } else if (result.content) {
                            content = result.content;
                        } else if (result.message && result.message.content) {
                            // Ollama格式
                            content = result.message.content;
                        } else if (result.message && typeof result.message === 'string') {
                            content = result.message;
                        } else if (typeof result === 'string') {
                            content = result;
                        } else {
                            // 未知格式，尝试提取可能的文本内容
                            content = JSON.stringify(result);
                        }

                        // 如果提取到了有效内容，直接使用
                        if (content && content.trim()) {
                            // 内容提取成功，继续处理
                        } else if (result.status !== undefined && result.status !== 200) {
                            // 只有在明确status不是200且没有内容时，才认为是错误
                            content = result.msg || '抱歉，服务器返回了错误。';
                            throw new Error(content);
                        } else if (result.msg && !content) {
                            // 如果有错误消息但没有内容，也认为是错误
                            content = result.msg;
                            throw new Error(content);
                        }

                        // 停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }

                        // 显示生成的内容
                        if (messageText) {
                            // 确保内容不为空
                            if (!content || !content.trim()) {
                                content = '抱歉，未能获取到有效内容。';
                            }
                            messageText.innerHTML = this.renderMarkdown(content);
                            // 更新原始文本用于复制功能
                            messageText.setAttribute('data-original-text', content);
                            // 添加复制按钮
                            if (content && content.trim()) {
                                const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                if (copyButtonContainer) {
                                    this.addCopyButton(copyButtonContainer, messageText);
                                }
                                // 添加 try again 按钮（仅当不是第一条消息时）
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }

                                // 添加动作按钮（包括设置按钮）
                                await this.addActionButtonsToMessage(message);

                            }
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }

                        // 立即保存宠物回复到当前会话
                        this.skipSessionListRefresh = true;
                        if (content && content.trim()) {
                            await this.addMessageToSession('pet', content, null, false);
                        }

                        // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                        await this.saveCurrentSession(false, false);

                        // 请求结束后调用 session/save 保存会话到后端
                        if (this.currentSessionId) {
                            if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                                try {
                                    await this.syncSessionToBackend(this.currentSessionId, true);
                                    console.log(`角色按钮操作后，会话 ${this.currentSessionId} 已保存到后端`);
                                } catch (error) {
                                    console.warn('保存会话到后端失败:', error);
                                }
                            } else {
                                console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用');
                            }
                        } else {
                            console.warn('无法保存会话：当前会话 ID 不存在');
                        }

                        button.innerHTML = '✓';
                        button.style.cursor = 'default';
                        button.style.color = '#4caf50';

                        // 2秒后恢复初始状态，允许再次点击
                        setTimeout(() => {
                            button.innerHTML = originalIcon;
                            button.title = originalTitle;
                            button.style.color = '#666';
                            button.style.cursor = 'pointer';
                            button.style.opacity = '1';
                            processingFlag.value = false;
                        }, 2000);

                    } catch (error) {
                        // 检查是否是取消错误
                        const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                        if (!isAbortError) {
                            console.error(`生成${roleLabel}失败:`, error);
                        }

                        // 显示错误消息（取消时不显示）
                        if (!isAbortError && messageText) {
                            const errorMessage = error.message && error.message.includes('HTTP error')
                                ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${roleIcon}`
                                : `抱歉，无法生成"${pageTitle}"的${roleLabel}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${roleIcon}`;
                            messageText.innerHTML = this.renderMarkdown(errorMessage);
                            // 添加 try again 按钮（仅当不是第一条消息时）
                            const petMessages = Array.from(messagesContainer.children).filter(
                                child => child.querySelector('[data-message-type="pet-bubble"]')
                            );
                            if (petMessages.length > 1) {
                                const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                    this.addTryAgainButton(tryAgainContainer, message);
                                }
                            }

                            // 添加动作按钮（包括设置按钮）
                            await this.addActionButtonsToMessage(message);

                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        } else if (isAbortError && message) {
                            // 请求被取消，移除消息
                            message.remove();
                        }

                        if (!isAbortError) {
                            button.innerHTML = '✕';
                            button.style.cursor = 'default';
                            button.style.color = '#f44336';

                            // 1.5秒后恢复初始状态，允许再次点击
                            setTimeout(() => {
                                button.innerHTML = originalIcon;
                                button.title = originalTitle;
                                button.style.color = '#666';
                                button.style.cursor = 'pointer';
                                button.style.opacity = '1';
                                processingFlag.value = false;
                            }, 1500);
                        } else {
                            // 请求被取消，立即恢复状态
                            button.innerHTML = originalIcon;
                            button.title = originalTitle;
                            button.style.color = '#666';
                            button.style.cursor = 'pointer';
                            button.style.opacity = '1';
                            processingFlag.value = false;
                        }
                    } finally {
                        // 确保请求状态总是被更新为空闲状态
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(null);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('idle');
                        }
                        // 确保停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });

            // 更新按钮内容
            const displayIcon = this.getRoleIcon(config, configsRaw);
            button.innerHTML = displayIcon || '🙂';
            button.title = config.label || '(未命名)';

            // 如果按钮已经在容器中，不要重复添加
            if (button.parentNode !== container) {
                container.appendChild(button);
            }
        }

        // 角色设置按钮已移动到 chat-request-status-button 后面，不再添加到欢迎消息容器中

        // 添加企微机器人按钮到欢迎消息
        const robotConfigs = await this.getWeWorkRobotConfigs();
        for (const robotConfig of robotConfigs) {
            if (!robotConfig || !robotConfig.webhookUrl) continue;

            const robotButton = document.createElement('span');
            robotButton.setAttribute('data-robot-id', robotConfig.id);
            robotButton.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 16px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 22px !important;
                height: 22px !important;
                line-height: 22px !important;
            `;

            robotButton.innerHTML = robotConfig.icon || '🤖';
            robotButton.title = robotConfig.name || '企微机器人';

            robotButton.addEventListener('mouseenter', function() {
                this.style.fontSize = '18px';
                this.style.color = '#333';
                this.style.transform = 'scale(1.1)';
            });
            robotButton.addEventListener('mouseleave', function() {
                this.style.fontSize = '16px';
                this.style.color = '#666';
                this.style.transform = 'scale(1)';
            });

            robotButton.addEventListener('click', async (e) => {
                e.stopPropagation();

                // 获取欢迎消息的内容
                const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                if (!messagesContainer) return;

                const welcomeMessage = messagesContainer.querySelector('[data-welcome-message]');
                if (!welcomeMessage) return;

                const messageBubble = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
                let messageContent = '';
                if (messageBubble) {
                    messageContent = messageBubble.getAttribute('data-original-text') ||
                                   messageBubble.innerText ||
                                   messageBubble.textContent || '';
                }

                if (!messageContent || !messageContent.trim()) {
                    this.showNotification('消息内容为空，无法发送', 'error');
                    return;
                }

                const trimmedContent = messageContent.trim();
                const contentLength = trimmedContent.length;

                // 不再检查内容长度限制，允许发送任意长度的消息

                // 显示发送状态
                const originalIcon = robotButton.innerHTML;
                robotButton.innerHTML = '⏳';
                robotButton.style.color = '#2196F3';
                robotButton.style.cursor = 'default';

                try {
                    let finalContent = '';

                    // 检查是否是 markdown 格式
                    if (this.isMarkdownFormat(trimmedContent)) {
                        // 已经是 markdown 格式，直接使用
                        finalContent = trimmedContent;
                        console.log(`[企微机器人] 内容已是 markdown 格式，长度: ${finalContent.length}`);
                    } else {
                        // 不是 markdown 格式，转换为 markdown
                        console.log('[企微机器人] 内容不是 markdown 格式，转换为 markdown...');
                        finalContent = await this.convertToMarkdown(trimmedContent);
                        console.log(`[企微机器人] 转换后长度: ${finalContent.length}`);
                    }

                    // 不再限制消息长度，发送完整内容

                    // 发送到企微机器人
                    await this.sendToWeWorkRobot(robotConfig.webhookUrl, finalContent);
                    robotButton.innerHTML = '✓';
                    robotButton.style.color = '#4caf50';
                    this.showNotification(`已发送到 ${robotConfig.name || '企微机器人'}`, 'success');

                    setTimeout(() => {
                        robotButton.innerHTML = originalIcon;
                        robotButton.style.color = '#666';
                        robotButton.style.cursor = 'pointer';
                    }, 2000);
                } catch (error) {
                    console.error('发送到企微机器人失败:', error);
                    robotButton.innerHTML = '✕';
                    robotButton.style.color = '#f44336';
                    this.showNotification(`发送失败：${error.message || '未知错误'}`, 'error');

                    setTimeout(() => {
                        robotButton.innerHTML = originalIcon;
                        robotButton.style.color = '#666';
                        robotButton.style.cursor = 'pointer';
                    }, 2000);
                }
            });

            container.appendChild(robotButton);
        }
    }

    // 为消息添加动作按钮（复制欢迎消息的按钮，设置按钮已移动到 chat-request-status-button 后面）
    async addActionButtonsToMessage(messageDiv, forceRefresh = false) {
        // 检查是否是欢迎消息，如果是则不添加（因为它已经有按钮了）
        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
        if (!messagesContainer) return;

        // 检查当前消息是否是欢迎消息，如果是则跳过（欢迎消息已经有按钮了）
        const isWelcome = messageDiv.hasAttribute('data-welcome-message');
        if (isWelcome) return;

        // 获取时间容器（需要在早期获取，因为后续逻辑需要使用）
        let timeAndCopyContainer = messageDiv.querySelector('[data-message-time]')?.parentElement?.parentElement;
        // 如果时间容器不存在，可能是消息结构还没准备好，尝试等待一下
        if (!timeAndCopyContainer) {
            // 等待消息结构完全准备好（最多等待500ms）
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                timeAndCopyContainer = messageDiv.querySelector('[data-message-time]')?.parentElement?.parentElement;
                if (timeAndCopyContainer) break;
            }
        }

        // 如果强制刷新，先移除现有按钮容器
        const existingContainer = messageDiv.querySelector('[data-message-actions]');
        const isUserMessage = messageDiv.querySelector('[data-message-type="user-bubble"]');

        // 对于用户消息，如果找不到timeAndCopyContainer，尝试直接从messageDiv查找copyButtonContainer
        let copyButtonContainer = null;
        if (timeAndCopyContainer) {
            copyButtonContainer = timeAndCopyContainer.querySelector('[data-copy-button-container]');
        } else if (isUserMessage) {
            // 用户消息：直接从messageDiv查找copyButtonContainer
            copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
            // 如果找到了copyButtonContainer，尝试找到它的父容器作为timeAndCopyContainer
            if (copyButtonContainer && copyButtonContainer.parentElement) {
                timeAndCopyContainer = copyButtonContainer.parentElement;
            }
        }

        // 如果仍然找不到timeAndCopyContainer（且不是用户消息），则返回
        if (!timeAndCopyContainer && !isUserMessage) {
            console.warn('无法找到消息时间容器，按钮添加失败');
            return;
        }

        // 对于用户消息，如果仍然找不到copyButtonContainer，尝试创建它
        if (isUserMessage && !copyButtonContainer) {
            // 尝试找到用户消息的content容器
            const content = messageDiv.querySelector('div[style*="flex: 1"]') ||
                           messageDiv.querySelector('div:last-child');
            if (content) {
                // 查找是否已有timeAndCopyContainer
                let existingTimeAndCopyContainer = content.querySelector('div[style*="justify-content: space-between"]');
                if (!existingTimeAndCopyContainer) {
                    // 创建timeAndCopyContainer
                    existingTimeAndCopyContainer = document.createElement('div');
                    existingTimeAndCopyContainer.style.cssText = `
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        max-width: 80% !important;
                        width: 100% !important;
                        margin-top: 4px !important;
                        margin-left: auto !important;
                        box-sizing: border-box !important;
                    `;
                    content.appendChild(existingTimeAndCopyContainer);
                }
                timeAndCopyContainer = existingTimeAndCopyContainer;

                // 创建copyButtonContainer
                copyButtonContainer = document.createElement('div');
                copyButtonContainer.setAttribute('data-copy-button-container', 'true');
                copyButtonContainer.style.cssText = 'display: flex;';
                timeAndCopyContainer.insertBefore(copyButtonContainer, timeAndCopyContainer.firstChild);
            }
        }

        if (forceRefresh && existingContainer) {
            // 对于用户消息，如果按钮已经在 copyButtonContainer 内部，需要移除它们
            if (isUserMessage && copyButtonContainer) {
                // 查找所有带有 data-action-key 或其他标识的按钮（角色按钮等）
                // 这些按钮可能是之前添加的，需要移除
                const actionButtons = copyButtonContainer.querySelectorAll('[data-action-key], [data-robot-id]');
                actionButtons.forEach(btn => btn.remove());
            }
            existingContainer.remove();
        } else if (existingContainer) {
            // 如果按钮容器存在但没有按钮（子元素为空），强制刷新
            if (existingContainer.children.length === 0) {
                existingContainer.remove();
                // 继续执行后续逻辑添加按钮
            } else {
                // 对于用户消息，如果按钮容器不在 copyButtonContainer 内部，需要移动
                if (isUserMessage && copyButtonContainer) {
                    // 将按钮移动到 copyButtonContainer 内部
                    while (existingContainer.firstChild) {
                        copyButtonContainer.appendChild(existingContainer.firstChild);
                    }
                    existingContainer.remove();
                    // 确保 copyButtonContainer 使用 flex 布局，保留原有样式
                    if (!copyButtonContainer.style.display || copyButtonContainer.style.display === 'none') {
                        copyButtonContainer.style.display = 'flex';
                    }
                    copyButtonContainer.style.alignItems = 'center';
                    copyButtonContainer.style.gap = '8px';
                } else {
                    // 宠物消息：如果已经有按钮容器且不强制刷新，则需要确保它在编辑按钮之前
                    if (copyButtonContainer && existingContainer.nextSibling !== copyButtonContainer) {
                        // 如果顺序不对，重新插入到正确位置
                        timeAndCopyContainer.insertBefore(existingContainer, copyButtonContainer);
                    }
                }
                return;
            }
        }

        // 获取欢迎消息的按钮容器
        const welcomeActions = this.chatWindow.querySelector('#pet-welcome-actions');
        // 即使 welcomeActions 不存在，也尝试从角色配置创建按钮
        // if (!welcomeActions) return;

        // 创建按钮容器
        const actionsContainer = document.createElement('div');
        actionsContainer.setAttribute('data-message-actions', 'true');

        // 检查是用户消息还是宠物消息，设置不同的样式
        // isUserMessage 已在函数开始处声明
        if (isUserMessage) {
            // 用户消息：按钮容器紧跟在其他按钮后面，不需要左边距
            actionsContainer.style.cssText = `
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                flex-shrink: 0 !important;
                margin-left: 4px !important;
            `;
        } else {
            // 宠物消息：保持原有样式
            actionsContainer.style.cssText = `
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                flex-shrink: 0 !important;
                margin-left: 8px !important;
            `;
        }

        // 获取所有角色配置（用于没有 actionKey 的按钮）
        const configsRaw = await this.getRoleConfigs();

        // 获取已绑定的角色键，用于检查哪些角色已经有按钮
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();
        const configsByActionKey = {};
        const configsById = {};

        for (const config of (configsRaw || [])) {
            if (config && config.id) {
                configsById[config.id] = config;
                if (config.actionKey) {
                    configsByActionKey[config.actionKey] = config;
                    if (orderedKeys.includes(config.actionKey)) {
                        boundRoleIds.add(config.id);
                    }
                }
            }
        }

        // 复制欢迎消息中的所有按钮（包括设置按钮）
        const buttonsToCopy = welcomeActions ? Array.from(welcomeActions.children) : [];
        const copiedButtonIds = new Set(); // 记录已复制的按钮ID

        for (const originalButton of buttonsToCopy) {
            // 创建新按钮（通过克隆并重新绑定事件）
            const newButton = originalButton.cloneNode(true);

            // 如果是设置按钮，绑定点击事件
            if (newButton.innerHTML.trim() === '⚙️' || newButton.innerHTML.trim() === '👤' || newButton.title === '角色设置') {
                newButton.innerHTML = '👤';
                newButton.title = '角色设置';
                newButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openRoleSettingsModal();
                });
                actionsContainer.appendChild(newButton);
                continue;
            } else if (newButton.hasAttribute('data-action-key')) {
                // 如果是角色按钮（有 actionKey），创建使用消息内容的处理函数
                const actionKey = newButton.getAttribute('data-action-key');
                const config = configsByActionKey[actionKey];
                if (config && config.id) {
                    copiedButtonIds.add(config.id);
                }

                // 为消息下的按钮创建特殊的处理函数（使用消息内容而不是页面内容）
                newButton.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    // 获取当前消息的内容（根据消息类型选择正确的元素）
                    let messageBubble = null;
                    if (isUserMessage) {
                        // 用户消息：从 user-bubble 获取内容
                        messageBubble = messageDiv.querySelector('[data-message-type="user-bubble"]');
                    } else {
                        // 宠物消息：从 pet-bubble 获取内容
                        messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    }
                    let messageContent = '';
                    if (messageBubble) {
                        // 优先使用 data-original-text（原始文本），如果没有则使用文本内容
                        messageContent = messageBubble.getAttribute('data-original-text') ||
                                       messageBubble.innerText ||
                                       messageBubble.textContent || '';
                    }

                    // 获取角色信息
                    const pageInfo = this.getPageInfo(); // 保留用于获取角色配置，但不用于 userPrompt
                    let roleInfo;
                    try {
                        roleInfo = await this.getRolePromptForAction(actionKey, pageInfo);
                    } catch (error) {
                        console.error('获取角色信息失败:', error);
                        roleInfo = {
                            systemPrompt: '',
                            userPrompt: '',
                            label: '自定义角色',
                            icon: '🙂'
                        };
                    }

                    // 检查页面上下文开关状态
                    let includeContext = true; // 默认包含上下文
                    const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
                    if (contextSwitch) {
                        includeContext = contextSwitch.checked;
                    }

                    // 构建 fromUser：以当前消息内容为主，包含会话上下文
                    const baseMessageContent = messageContent.trim() || '无内容';
                    let fromUser = baseMessageContent;

                    // 如果没有开启页面上下文，直接使用消息内容
                    if (!includeContext) {
                        fromUser = baseMessageContent;
                    } else {
                    // 获取会话上下文，添加相关的上下文信息
                    const context = this.buildConversationContext();

                    // 如果存在会话历史，在消息内容前添加上下文
                    if (context.hasHistory && context.messages.length > 0) {
                        // 构建消息历史上下文（只包含当前消息之前的历史）
                        let conversationContext = '\n\n## 会话历史：\n\n';
                        context.messages.forEach((msg) => {
                            const role = msg.type === 'user' ? '用户' : '助手';
                            const content = msg.content.trim();
                            if (content && content !== baseMessageContent) { // 排除当前消息本身
                                conversationContext += `${role}：${content}\n\n`;
                            }
                        });
                        // 将上下文放在前面，当前消息内容放在后面
                        fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                    }

                    // 如果有页面内容且角色提示词包含页面内容，也添加页面内容
                    if (context.pageContent && roleInfo.userPrompt && roleInfo.userPrompt.includes('页面内容')) {
                        fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                        }
                    }

                    // 获取消息容器
                    const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                    if (!messagesContainer) {
                        console.error('无法找到消息容器');
                        return;
                    }

                    // 创建新的消息
                    const message = this.createMessageElement('', 'pet');
                    message.setAttribute('data-button-action', 'true');
                    messagesContainer.appendChild(message);
                    const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                    const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

                    // 显示加载动画
                    if (messageAvatar) {
                        messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                    }
                    const loadingIcon = roleInfo.icon || '📖';
                    if (messageText) {
                        messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
                    }

                    try {
                        // 创建 AbortController 用于终止请求
                        const abortController = new AbortController();
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(abortController);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('loading');
                        }

                        // 设置标志，避免 prompt 调用后触发会话列表刷新接口
                        this.skipSessionListRefresh = true;

                        // 使用统一的 payload 构建函数，自动包含会话 ID
                        // 传递 messageDiv，以便从对应的消息对象中获取 imageDataUrl
                        const payload = this.buildPromptPayload(
                            roleInfo.systemPrompt,
                            fromUser,
                            { messageDiv: messageDiv }
                        );

                        const response = await fetch(PET_CONFIG.api.promptUrl, {
                            method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
                            signal: abortController.signal
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                        }

                        // 先读取响应文本，判断是否为流式响应（SSE格式）
                        const responseText = await response.text();
                        let result;

                        // 检查是否包含SSE格式（包含 "data: "）
                        if (responseText.includes('data: ')) {
                            // 处理SSE流式响应
                            const lines = responseText.split('\n');
                            let accumulatedData = '';
                            let lastValidData = null;

                            for (const line of lines) {
                                const trimmedLine = line.trim();
                                if (trimmedLine.startsWith('data: ')) {
                                    try {
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr === '[DONE]' || dataStr === '') {
                                            continue;
                                        }

                                        // 尝试解析JSON
                                        const chunk = JSON.parse(dataStr);

                                        // 检查是否完成
                                        if (chunk.done === true) {
                                            break;
                                        }

                                        // 累积内容（处理流式内容块）
                                        if (chunk.data) {
                                            accumulatedData += chunk.data;
                                        } else if (chunk.content) {
                                            accumulatedData += chunk.content;
                                        } else if (chunk.message && chunk.message.content) {
                                            // Ollama格式
                                            accumulatedData += chunk.message.content;
                                        } else if (typeof chunk === 'string') {
                                            accumulatedData += chunk;
                                        }

                                        // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                        lastValidData = chunk;
                                    } catch (e) {
                                        // 如果不是JSON，可能是纯文本内容
                                        const dataStr = trimmedLine.substring(6).trim();
                                        if (dataStr && dataStr !== '[DONE]') {
                                            accumulatedData += dataStr;
                                        }
                                    }
                                }
                            }

                            // 如果累积了内容，创建结果对象
                            if (accumulatedData || lastValidData) {
                                if (lastValidData && lastValidData.status) {
                                    result = {
                                        ...lastValidData,
                                        data: accumulatedData || lastValidData.data || '',
                                        content: accumulatedData || lastValidData.content || ''
                                    };
                                } else {
                                    result = {
                                        data: accumulatedData,
                                        content: accumulatedData
                                    };
                                }
                            } else {
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    throw new Error('无法解析响应格式');
                                }
                            }
                        } else {
                            // 非SSE格式，直接解析JSON
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                if (sseMatch) {
                                    result = JSON.parse(sseMatch[1]);
                                } else {
                                    throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                }
                            }
                        }

                        // 适配响应格式
                        let content = '';
                        if (result.data) {
                            content = result.data;
                        } else if (result.content) {
                            content = result.content;
                        } else if (result.message && result.message.content) {
                            content = result.message.content;
                        } else if (result.message && typeof result.message === 'string') {
                            content = result.message;
                        } else if (typeof result === 'string') {
                            content = result;
                        } else {
                            content = JSON.stringify(result);
                        }

                        // 如果提取到了有效内容，直接使用
                        if (content && content.trim()) {
                            // 内容提取成功，继续处理
                        } else if (result.status !== undefined && result.status !== 200) {
                            content = result.msg || '抱歉，服务器返回了错误。';
                            throw new Error(content);
                        } else if (result.msg && !content) {
                            content = result.msg;
                            throw new Error(content);
                        }

                        // 停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }

                        // 显示生成的内容
                        if (messageText) {
                            if (!content || !content.trim()) {
                                content = '抱歉，未能获取到有效内容。';
                            }
                            messageText.innerHTML = this.renderMarkdown(content);
                            messageText.setAttribute('data-original-text', content);

                            // 添加复制按钮
                            if (content && content.trim()) {
                                const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                if (copyButtonContainer) {
                                    this.addCopyButton(copyButtonContainer, messageText);
                                }
                                // 添加 try again 按钮（仅当不是第一条消息时）
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }

                                // 添加动作按钮（包括设置按钮）
                                await this.addActionButtonsToMessage(message);

                            }
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }

                        // 立即保存宠物回复到当前会话
                        this.skipSessionListRefresh = true;
                        if (content && content.trim()) {
                            await this.addMessageToSession('pet', content, null, false);
                        }

                        // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                        await this.saveCurrentSession(false, false);

                        // 请求结束后调用 session/save 保存会话到后端
                        if (this.currentSessionId) {
                            if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                                try {
                                    await this.syncSessionToBackend(this.currentSessionId, true);
                                    console.log(`角色按钮操作后，会话 ${this.currentSessionId} 已保存到后端`);
                                } catch (error) {
                                    console.warn('保存会话到后端失败:', error);
                                }
                            } else {
                                console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用');
                            }
                        } else {
                            console.warn('无法保存会话：当前会话 ID 不存在');
                        }
                    } catch (error) {
                        const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                        if (!isAbortError) {
                            console.error(`生成${roleInfo.label}失败:`, error);
                        }

                        // 显示错误消息（取消时不显示）
                        if (!isAbortError && messageText) {
                            const errorMessage = error.message && error.message.includes('HTTP error')
                                ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
                                : `抱歉，无法生成${roleInfo.label}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${loadingIcon}`;
                            messageText.innerHTML = this.renderMarkdown(errorMessage);
                            // 添加 try again 按钮
                            const petMessages = Array.from(messagesContainer.children).filter(
                                child => child.querySelector('[data-message-type="pet-bubble"]')
                            );
                            if (petMessages.length > 1) {
                                const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                    this.addTryAgainButton(tryAgainContainer, message);
                                }
                            }
                            await this.addActionButtonsToMessage(message);
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        } else if (isAbortError && message) {
                            message.remove();
                        }
                    } finally {
                        // 确保请求状态总是被更新为空闲状态
                        if (this.chatWindow && this.chatWindow._setAbortController) {
                            this.chatWindow._setAbortController(null);
                        }
                        if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                            this.chatWindow._updateRequestStatus('idle');
                        }
                        // 确保停止加载动画
                        if (messageAvatar) {
                            messageAvatar.style.animation = '';
                        }
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });
            } else if (newButton.hasAttribute('data-role-id')) {
                // 如果是没有 actionKey 的角色按钮，需要重新创建点击处理函数
                const roleId = newButton.getAttribute('data-role-id');
                copiedButtonIds.add(roleId); // 记录已复制
                const config = configsById[roleId];
                if (config) {
                    // 创建 processing flag
                    if (!this.roleButtonsProcessingFlags) {
                        this.roleButtonsProcessingFlags = {};
                    }
                    if (!this.roleButtonsProcessingFlags[roleId]) {
                        this.roleButtonsProcessingFlags[roleId] = { value: false };
                    }
                    const processingFlag = this.roleButtonsProcessingFlags[roleId];

                    // 重新绑定点击事件（使用与 refreshWelcomeActionButtons 中相同的逻辑）
                    newButton.addEventListener('click', async (e) => {
                        e.stopPropagation();

                        if (processingFlag.value) return;
                        processingFlag.value = true;
                        const originalIcon = newButton.innerHTML;
                        const originalTitle = newButton.title;

                        // 获取当前消息的内容（根据消息类型选择正确的元素）
                        let messageBubble = null;
                        if (isUserMessage) {
                            // 用户消息：从 user-bubble 获取内容
                            messageBubble = messageDiv.querySelector('[data-message-type="user-bubble"]');
                        } else {
                            // 宠物消息：从 pet-bubble 获取内容
                            messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                        }
                        let messageContent = '';
                        if (messageBubble) {
                            // 优先使用 data-original-text（原始文本），如果没有则使用文本内容
                            messageContent = messageBubble.getAttribute('data-original-text') ||
                                           messageBubble.innerText ||
                                           messageBubble.textContent || '';
                        }

                        const roleLabel = config.label || '自定义角色';
                        const roleIcon = this.getRoleIcon(config, configsRaw) || '🙂';
                        const systemPrompt = (config.prompt && config.prompt.trim()) ? config.prompt.trim() : '';

                        // 检查页面上下文开关状态
                        let includeContext = true; // 默认包含上下文
                        const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
                        if (contextSwitch) {
                            includeContext = contextSwitch.checked;
                        }

                        // 构建 fromUser：以当前消息内容为主，包含会话上下文
                        const baseMessageContent = messageContent.trim() || '无内容';
                        let fromUser = baseMessageContent;

                        // 如果没有开启页面上下文，直接使用消息内容
                        if (!includeContext) {
                            fromUser = baseMessageContent;
                        } else {
                        // 获取会话上下文，添加相关的上下文信息
                        const context = this.buildConversationContext();

                        // 如果存在会话历史，在消息内容前添加上下文
                        if (context.hasHistory && context.messages.length > 0) {
                            // 构建消息历史上下文（只包含当前消息之前的历史）
                            let conversationContext = '\n\n## 会话历史：\n\n';
                            context.messages.forEach((msg) => {
                                const role = msg.type === 'user' ? '用户' : '助手';
                                const content = msg.content.trim();
                                if (content && content !== baseMessageContent) { // 排除当前消息本身
                                    conversationContext += `${role}：${content}\n\n`;
                                }
                            });
                            // 将上下文放在前面，当前消息内容放在后面
                            fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                        }

                        // 如果有页面内容，也添加页面内容
                        if (context.pageContent) {
                            fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                            }
                        }

                        // 创建新的消息
                        const message = this.createMessageElement('', 'pet');
                        message.setAttribute('data-button-action', 'true');
                        messagesContainer.appendChild(message);
                        const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                        const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

                        if (messageAvatar) {
                            messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                        }
                        if (messageText) {
                            messageText.textContent = `${roleIcon} 正在${roleLabel}...`;
                        }

                        try {
                            const abortController = new AbortController();

                            // 设置标志，避免 prompt 调用后触发会话列表刷新接口
                            this.skipSessionListRefresh = true;

                            // 使用统一的 payload 构建函数，自动包含会话 ID
                            // 传递 messageDiv，以便从对应的消息对象中获取 imageDataUrl
                            const payload = this.buildPromptPayload(
                                systemPrompt,
                                fromUser,
                                { messageDiv: messageDiv }
                            );

                            const response = await fetch(PET_CONFIG.api.promptUrl, {
                                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
                                signal: abortController.signal
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                            }

                            // 先读取响应文本，判断是否为流式响应（SSE格式）
                            const responseText = await response.text();
                            let result;

                            // 检查是否包含SSE格式（包含 "data: "）
                            if (responseText.includes('data: ')) {
                                // 处理SSE流式响应
                                const lines = responseText.split('\n');
                                let accumulatedData = '';
                                let lastValidData = null;

                                for (const line of lines) {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine.startsWith('data: ')) {
                                        try {
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr === '[DONE]' || dataStr === '') {
                                                continue;
                                            }

                                            // 尝试解析JSON
                                            const chunk = JSON.parse(dataStr);

                                            // 检查是否完成
                                            if (chunk.done === true) {
                                                break;
                                            }

                                            // 累积内容（处理流式内容块）
                                            if (chunk.data) {
                                                accumulatedData += chunk.data;
                                            } else if (chunk.content) {
                                                accumulatedData += chunk.content;
                                            } else if (chunk.message && chunk.message.content) {
                                                // Ollama格式
                                                accumulatedData += chunk.message.content;
                                            } else if (typeof chunk === 'string') {
                                                accumulatedData += chunk;
                                            }

                                            // 保存最后一个有效的数据块（用于提取其他字段如status等）
                                            lastValidData = chunk;
                                        } catch (e) {
                                            // 如果不是JSON，可能是纯文本内容
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr && dataStr !== '[DONE]') {
                                                accumulatedData += dataStr;
                                            }
                                        }
                                    }
                                }

                                // 如果累积了内容，创建结果对象
                                if (accumulatedData || lastValidData) {
                                    if (lastValidData && lastValidData.status) {
                                        // 如果有status字段，保留原有结构，但替换data/content
                                        result = {
                                            ...lastValidData,
                                            data: accumulatedData || lastValidData.data || '',
                                            content: accumulatedData || lastValidData.content || ''
                                        };
                                    } else {
                                        // 否则创建新的结果对象
                                        result = {
                                            data: accumulatedData,
                                            content: accumulatedData
                                        };
                                    }
                                } else {
                                    // 如果无法解析SSE格式，尝试直接解析整个响应
                                    try {
                                        result = JSON.parse(responseText);
                                    } catch (e) {
                                        throw new Error('无法解析响应格式');
                                    }
                                }
                            } else {
                                // 非SSE格式，直接解析JSON
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    // 如果解析失败，尝试查找SSE格式的数据
                                    const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                    if (sseMatch) {
                                        result = JSON.parse(sseMatch[1]);
                                    } else {
                                        throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                    }
                                }
                            }

                            // 适配响应格式: {status, msg, data, pagination}
                            let content = '';

                            // 优先尝试提取内容，不管status值是什么（因为可能有内容但status不是200）
                            if (result.data) {
                                // 提取 data 字段
                                content = result.data;
                            } else if (result.content) {
                                content = result.content;
                            } else if (result.message && result.message.content) {
                                // Ollama格式
                                content = result.message.content;
                            } else if (result.message && typeof result.message === 'string') {
                                content = result.message;
                            } else if (typeof result === 'string') {
                                content = result;
                            } else {
                                // 未知格式，尝试提取可能的文本内容
                                content = JSON.stringify(result);
                            }

                            // 如果提取到了有效内容，直接使用
                            if (content && content.trim()) {
                                // 内容提取成功，继续处理
                            } else if (result.status !== undefined && result.status !== 200) {
                                // 只有在明确status不是200且没有内容时，才认为是错误
                                content = result.msg || '抱歉，服务器返回了错误。';
                                throw new Error(content);
                            } else if (result.msg && !content) {
                                // 如果有错误消息但没有内容，也认为是错误
                                content = result.msg;
                                throw new Error(content);
                            }

                            // 停止加载动画
                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }

                            // 显示生成的内容
                            if (messageText) {
                                // 确保内容不为空
                                if (!content || !content.trim()) {
                                    content = '抱歉，未能获取到有效内容。';
                                }
                                messageText.innerHTML = this.renderMarkdown(content);
                                // 更新原始文本用于复制功能
                                messageText.setAttribute('data-original-text', content);
                                // 添加复制按钮
                                if (content && content.trim()) {
                                    const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                    if (copyButtonContainer) {
                                        this.addCopyButton(copyButtonContainer, messageText);
                                    }
                                    // 添加 try again 按钮（仅当不是第一条消息时）
                                    const petMessages = Array.from(messagesContainer.children).filter(
                                        child => child.querySelector('[data-message-type="pet-bubble"]')
                                    );
                                    if (petMessages.length > 1) {
                                        const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                            this.addTryAgainButton(tryAgainContainer, message);
                                        }
                                    }

                                    // 添加动作按钮（包括设置按钮）
                                    await this.addActionButtonsToMessage(message);
                                }
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }

                            // 立即保存宠物回复到当前会话
                            this.skipSessionListRefresh = true;
                            if (content && content.trim()) {
                                await this.addMessageToSession('pet', content, null, false);
                            }

                            // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                            await this.saveCurrentSession(false, false);

                            // prompt 接口调用后必须触发 session/save
                            if (this.currentSessionId) {
                                if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                                    try {
                                        await this.syncSessionToBackend(this.currentSessionId, true);
                                        console.log(`prompt 接口调用后，会话 ${this.currentSessionId} 已保存到后端`);
                                    } catch (error) {
                                        console.warn('保存会话到后端失败:', error);
                                    }
                                } else {
                                    console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用');
                                }
                            } else {
                                console.warn('无法保存会话：当前会话 ID 不存在');
                            }

                            newButton.innerHTML = '✓';
                            newButton.style.cursor = 'default';
                            newButton.style.color = '#4caf50';

                            // 2秒后恢复初始状态，允许再次点击
                            setTimeout(() => {
                                newButton.innerHTML = originalIcon;
                                newButton.title = originalTitle;
                                newButton.style.color = '#666';
                                newButton.style.cursor = 'pointer';
                                newButton.style.opacity = '1';
                                processingFlag.value = false;
                            }, 2000);

                        } catch (error) {
                            // 检查是否是取消错误
                            const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                            if (!isAbortError) {
                                console.error(`生成${roleLabel}失败:`, error);
                            }

                            // 显示错误消息（取消时不显示）
                            if (!isAbortError && messageText) {
                                const errorMessage = error.message && error.message.includes('HTTP error')
                                    ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${roleIcon}`
                                    : `抱歉，无法生成"${pageTitle}"的${roleLabel}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${roleIcon}`;
                                messageText.innerHTML = this.renderMarkdown(errorMessage);
                                // 添加 try again 按钮（仅当不是第一条消息时）
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }

                                // 添加动作按钮（包括设置按钮）
                                await this.addActionButtonsToMessage(message);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            } else if (isAbortError && message) {
                                // 请求被取消，移除消息
                                message.remove();
                            }

                            if (!isAbortError) {
                                newButton.innerHTML = '✕';
                                newButton.style.cursor = 'default';
                                newButton.style.color = '#f44336';

                                // 1.5秒后恢复初始状态，允许再次点击
                                setTimeout(() => {
                                    newButton.innerHTML = originalIcon;
                                    newButton.title = originalTitle;
                                    newButton.style.color = '#666';
                                    newButton.style.cursor = 'pointer';
                                    newButton.style.opacity = '1';
                                    processingFlag.value = false;
                                }, 1500);
                            } else {
                                // 请求被取消，立即恢复状态
                                newButton.innerHTML = originalIcon;
                                newButton.title = originalTitle;
                                newButton.style.color = '#666';
                                newButton.style.cursor = 'pointer';
                                newButton.style.opacity = '1';
                                processingFlag.value = false;
                            }
                        } finally {
                            // 确保停止加载动画
                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }
                        }
                    });
                }
            }

            actionsContainer.appendChild(newButton);
        }

        // 补充遗漏的角色按钮（确保所有角色按钮都被添加）
        // 首先添加有 actionKey 但可能遗漏的按钮
        for (const key of orderedKeys) {
            const config = configsByActionKey[key];
            if (config && config.id && !copiedButtonIds.has(config.id)) {
                // 这个按钮没有被复制，需要创建
                const button = await this.createActionButton(key);
                if (button) {
                    const clonedButton = button.cloneNode(true);

                    // 重新绑定点击事件（使用消息内容）
                    clonedButton.addEventListener('click', async (e) => {
                        e.stopPropagation();

                        const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                        let messageContent = '';
                        if (messageBubble) {
                            messageContent = messageBubble.getAttribute('data-original-text') ||
                                           messageBubble.innerText ||
                                           messageBubble.textContent || '';
                        }

                        const pageInfo = this.getPageInfo();
                        let roleInfo;
                        try {
                            roleInfo = await this.getRolePromptForAction(key, pageInfo);
                        } catch (error) {
                            console.error('获取角色信息失败:', error);
                            roleInfo = {
                                systemPrompt: '',
                                userPrompt: '',
                                label: '自定义角色',
                                icon: '🙂'
                            };
                        }

                        // 检查页面上下文开关状态
                        let includeContext = true; // 默认包含上下文
                        const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
                        if (contextSwitch) {
                            includeContext = contextSwitch.checked;
                        }

                        // 构建 fromUser：以当前消息内容为主，包含会话上下文
                        const baseMessageContent = messageContent.trim() || '无内容';
                        let fromUser = baseMessageContent;

                        // 如果没有开启页面上下文，直接使用消息内容
                        if (!includeContext) {
                            fromUser = baseMessageContent;
                        } else {
                        // 获取会话上下文，添加相关的上下文信息
                        const context = this.buildConversationContext();

                        // 如果存在会话历史，在消息内容前添加上下文
                        if (context.hasHistory && context.messages.length > 0) {
                            // 构建消息历史上下文（只包含当前消息之前的历史）
                            let conversationContext = '\n\n## 会话历史：\n\n';
                            context.messages.forEach((msg) => {
                                const role = msg.type === 'user' ? '用户' : '助手';
                                const content = msg.content.trim();
                                if (content && content !== baseMessageContent) { // 排除当前消息本身
                                    conversationContext += `${role}：${content}\n\n`;
                                }
                            });
                            // 将上下文放在前面，当前消息内容放在后面
                            fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                        }

                        // 如果有页面内容且角色提示词包含页面内容，也添加页面内容
                        if (context.pageContent && roleInfo.userPrompt && roleInfo.userPrompt.includes('页面内容')) {
                            fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                            }
                        }

                        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                        if (!messagesContainer) {
                            console.error('无法找到消息容器');
                            return;
                        }

                        const message = this.createMessageElement('', 'pet');
                        message.setAttribute('data-button-action', 'true');
                        messagesContainer.appendChild(message);
                        const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                        const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

                        if (messageAvatar) {
                            messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                        }
                        const loadingIcon = roleInfo.icon || '📖';
                        if (messageText) {
                            messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
                        }

                        try {
                            const abortController = new AbortController();
                            if (this.chatWindow && this.chatWindow._setAbortController) {
                                this.chatWindow._setAbortController(abortController);
                            }
                            if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                                this.chatWindow._updateRequestStatus('loading');
                            }

                            // 使用统一的 payload 构建函数，自动包含会话 ID
                            // 传递 messageDiv，以便从对应的消息对象中获取 imageDataUrl
                            const payload = this.buildPromptPayload(
                                roleInfo.systemPrompt,
                                fromUser,
                                { messageDiv: messageDiv }
                            );

                            const response = await fetch(PET_CONFIG.api.promptUrl, {
                                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
                                signal: abortController.signal
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                            }

                            const responseText = await response.text();
                            let result;

                            if (responseText.includes('data: ')) {
                                const lines = responseText.split('\n');
                                let accumulatedData = '';
                                let lastValidData = null;

                                for (const line of lines) {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine.startsWith('data: ')) {
                                        try {
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr === '[DONE]' || dataStr === '') {
                                                continue;
                                            }

                                            const chunk = JSON.parse(dataStr);
                                            if (chunk.done === true) {
                                                break;
                                            }

                                            if (chunk.data) {
                                                accumulatedData += chunk.data;
                                            } else if (chunk.content) {
                                                accumulatedData += chunk.content;
                                            } else if (chunk.message && chunk.message.content) {
                                                accumulatedData += chunk.message.content;
                                            } else if (typeof chunk === 'string') {
                                                accumulatedData += chunk;
                                            }

                                            lastValidData = chunk;
                                        } catch (e) {
                                            const dataStr = trimmedLine.substring(6).trim();
                                            if (dataStr && dataStr !== '[DONE]') {
                                                accumulatedData += dataStr;
                                            }
                                        }
                                    }
                                }

                                if (accumulatedData || lastValidData) {
                                    if (lastValidData && lastValidData.status) {
                                        result = {
                                            ...lastValidData,
                                            data: accumulatedData || lastValidData.data || '',
                                            content: accumulatedData || lastValidData.content || ''
                                        };
                                    } else {
                                        result = {
                                            data: accumulatedData,
                                            content: accumulatedData
                                        };
                                    }
                                } else {
                                    try {
                                        result = JSON.parse(responseText);
                                    } catch (e) {
                                        throw new Error('无法解析响应格式');
                                    }
                                }
                            } else {
                                try {
                                    result = JSON.parse(responseText);
                                } catch (e) {
                                    const sseMatch = responseText.match(/data:\s*({.+?})/s);
                                    if (sseMatch) {
                                        result = JSON.parse(sseMatch[1]);
                                    } else {
                                        throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                                    }
                                }
                            }

                            let content = '';
                            if (result.data) {
                                content = result.data;
                            } else if (result.content) {
                                content = result.content;
                            } else if (result.message && result.message.content) {
                                content = result.message.content;
                            } else if (result.message && typeof result.message === 'string') {
                                content = result.message;
                            } else if (typeof result === 'string') {
                                content = result;
                            } else {
                                content = JSON.stringify(result);
                            }

                            if (content && content.trim()) {
                                // 内容提取成功
                            } else if (result.status !== undefined && result.status !== 200) {
                                content = result.msg || '抱歉，服务器返回了错误。';
                                throw new Error(content);
                            } else if (result.msg && !content) {
                                content = result.msg;
                                throw new Error(content);
                            }

                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }

                            if (messageText) {
                                if (!content || !content.trim()) {
                                    content = '抱歉，未能获取到有效内容。';
                                }
                                messageText.innerHTML = this.renderMarkdown(content);
                                messageText.setAttribute('data-original-text', content);

                                if (content && content.trim()) {
                                    const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                                    if (copyButtonContainer) {
                                        this.addCopyButton(copyButtonContainer, messageText);
                                    }
                                    const petMessages = Array.from(messagesContainer.children).filter(
                                        child => child.querySelector('[data-message-type="pet-bubble"]')
                                    );
                                    if (petMessages.length > 1) {
                                        const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                            this.addTryAgainButton(tryAgainContainer, message);
                                        }
                                    }

                                    await this.addActionButtonsToMessage(message);
                                }
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }

                            // 立即保存宠物回复到当前会话
                            this.skipSessionListRefresh = true;
                            if (content && content.trim()) {
                                await this.addMessageToSession('pet', content, null, false);
                            }

                            // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                            await this.saveCurrentSession(false, false);

                            // prompt 接口调用后必须触发 session/save
                            if (this.currentSessionId) {
                                if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                                    try {
                                        await this.syncSessionToBackend(this.currentSessionId, true);
                                        console.log(`prompt 接口调用后，会话 ${this.currentSessionId} 已保存到后端`);
                                    } catch (error) {
                                        console.warn('保存会话到后端失败:', error);
                                    }
                                } else {
                                    console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用');
                                }
                            } else {
                                console.warn('无法保存会话：当前会话 ID 不存在');
                            }
                        } catch (error) {
                            const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                            if (!isAbortError) {
                                console.error(`生成${roleInfo.label}失败:`, error);
                            }

                            if (!isAbortError && messageText) {
                                const errorMessage = error.message && error.message.includes('HTTP error')
                                    ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
                                    : `抱歉，无法生成${roleInfo.label}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${loadingIcon}`;
                                messageText.innerHTML = this.renderMarkdown(errorMessage);
                                const petMessages = Array.from(messagesContainer.children).filter(
                                    child => child.querySelector('[data-message-type="pet-bubble"]')
                                );
                                if (petMessages.length > 1) {
                                    const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                    if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                        this.addTryAgainButton(tryAgainContainer, message);
                                    }
                                }
                                await this.addActionButtonsToMessage(message);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            } else if (isAbortError && message) {
                                message.remove();
                            }
                        } finally {
                            if (this.chatWindow && this.chatWindow._setAbortController) {
                                this.chatWindow._setAbortController(null);
                            }
                            if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                                this.chatWindow._updateRequestStatus('idle');
                            }
                            if (messageAvatar) {
                                messageAvatar.style.animation = '';
                            }
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                    });

                    actionsContainer.appendChild(clonedButton);
                    copiedButtonIds.add(config.id);
                }
            }
        }

        // 然后添加没有 actionKey 但遗漏的角色按钮
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id) && !copiedButtonIds.has(c.id));
        for (const config of otherRoles) {
            // 创建新的角色按钮（没有 actionKey）
            const button = document.createElement('span');
            button.setAttribute('data-role-id', config.id);
            button.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 16px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 22px !important;
                height: 22px !important;
                line-height: 22px !important;
            `;

            const displayIcon = this.getRoleIcon(config, configsRaw);
            button.innerHTML = displayIcon || '🙂';
            button.title = config.label || '(未命名)';

            // 添加 hover 效果
            button.addEventListener('mouseenter', function() {
                this.style.fontSize = '18px';
                this.style.color = '#333';
                this.style.transform = 'scale(1.1)';
            });
            button.addEventListener('mouseleave', function() {
                this.style.fontSize = '16px';
                this.style.color = '#666';
                this.style.transform = 'scale(1)';
            });

            // 创建 processing flag
            if (!this.roleButtonsProcessingFlags) {
                this.roleButtonsProcessingFlags = {};
            }
            if (!this.roleButtonsProcessingFlags[config.id]) {
                this.roleButtonsProcessingFlags[config.id] = { value: false };
            }
            const processingFlag = this.roleButtonsProcessingFlags[config.id];

            // 绑定点击事件（使用与 refreshWelcomeActionButtons 中相同的逻辑，但使用消息内容）
            button.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (processingFlag.value) return;
                processingFlag.value = true;
                const originalIcon = button.innerHTML;
                const originalTitle = button.title;

                // 获取当前消息的内容（根据消息类型选择正确的元素）
                let messageBubble = null;
                if (isUserMessage) {
                    // 用户消息：从 user-bubble 获取内容
                    messageBubble = messageDiv.querySelector('[data-message-type="user-bubble"]');
                } else {
                    // 宠物消息：从 pet-bubble 获取内容
                    messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                }
                let messageContent = '';
                if (messageBubble) {
                    messageContent = messageBubble.getAttribute('data-original-text') ||
                                   messageBubble.innerText ||
                                   messageBubble.textContent || '';
                }

                const roleLabel = config.label || '自定义角色';
                const roleIcon = this.getRoleIcon(config, configsRaw) || '🙂';
                const systemPrompt = (config.prompt && config.prompt.trim()) ? config.prompt.trim() : '';

                // 检查页面上下文开关状态
                let includeContext = true; // 默认包含上下文
                const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
                if (contextSwitch) {
                    includeContext = contextSwitch.checked;
                }

                // 构建 fromUser：以当前消息内容为主，包含会话上下文
                const baseMessageContent = messageContent.trim() || '无内容';
                let fromUser = baseMessageContent;

                // 如果没有开启页面上下文，直接使用消息内容
                if (!includeContext) {
                    fromUser = baseMessageContent;
                } else {
                // 获取会话上下文，添加相关的上下文信息
                const context = this.buildConversationContext();

                // 如果存在会话历史，在消息内容前添加上下文
                if (context.hasHistory && context.messages.length > 0) {
                    // 构建消息历史上下文（只包含当前消息之前的历史）
                    let conversationContext = '\n\n## 会话历史：\n\n';
                    context.messages.forEach((msg) => {
                        const role = msg.type === 'user' ? '用户' : '助手';
                        const content = msg.content.trim();
                        if (content && content !== baseMessageContent) { // 排除当前消息本身
                            conversationContext += `${role}：${content}\n\n`;
                        }
                    });
                    // 将上下文放在前面，当前消息内容放在后面
                    fromUser = conversationContext + `## 当前需要处理的消息：\n\n${baseMessageContent}`;
                }

                // 如果有页面内容，也添加页面内容
                if (context.pageContent) {
                    fromUser += `\n\n## 页面内容：\n\n${context.pageContent}`;
                    }
                }

                const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                if (!messagesContainer) {
                    console.error('无法找到消息容器');
                    processingFlag.value = false;
                    return;
                }

                const message = this.createMessageElement('', 'pet');
                message.setAttribute('data-button-action', 'true');
                messagesContainer.appendChild(message);
                const messageText = message.querySelector('[data-message-type="pet-bubble"]');
                const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

                if (messageAvatar) {
                    messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
                }
                if (messageText) {
                    messageText.textContent = `${roleIcon} 正在${roleLabel}...`;
                }

                try {
                    const abortController = new AbortController();

                    // 使用统一的 payload 构建函数，自动包含会话 ID
                    // 传递 messageDiv，以便从对应的消息对象中获取 imageDataUrl
                    const payload = this.buildPromptPayload(
                        systemPrompt,
                        fromUser,
                        { messageDiv: messageDiv }
                    );

                    const response = await fetch(PET_CONFIG.api.promptUrl, {
                        method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
                        signal: abortController.signal
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    }

                    const responseText = await response.text();
                    let result;

                    if (responseText.includes('data: ')) {
                        const lines = responseText.split('\n');
                        let accumulatedData = '';
                        let lastValidData = null;

                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('data: ')) {
                                try {
                                    const dataStr = trimmedLine.substring(6).trim();
                                    if (dataStr === '[DONE]' || dataStr === '') {
                                        continue;
                                    }

                                    const chunk = JSON.parse(dataStr);
                                    if (chunk.done === true) {
                                        break;
                                    }

                                    if (chunk.data) {
                                        accumulatedData += chunk.data;
                                    } else if (chunk.content) {
                                        accumulatedData += chunk.content;
                                    } else if (chunk.message && chunk.message.content) {
                                        accumulatedData += chunk.message.content;
                                    } else if (typeof chunk === 'string') {
                                        accumulatedData += chunk;
                                    }

                                    lastValidData = chunk;
                                } catch (e) {
                                    const dataStr = trimmedLine.substring(6).trim();
                                    if (dataStr && dataStr !== '[DONE]') {
                                        accumulatedData += dataStr;
                                    }
                                }
                            }
                        }

                        if (accumulatedData || lastValidData) {
                            if (lastValidData && lastValidData.status) {
                                result = {
                                    ...lastValidData,
                                    data: accumulatedData || lastValidData.data || '',
                                    content: accumulatedData || lastValidData.content || ''
                                };
                            } else {
                                result = {
                                    data: accumulatedData,
                                    content: accumulatedData
                                };
                            }
                        } else {
                            try {
                                result = JSON.parse(responseText);
                            } catch (e) {
                                throw new Error('无法解析响应格式');
                            }
                        }
                    } else {
                        try {
                            result = JSON.parse(responseText);
                        } catch (e) {
                            const sseMatch = responseText.match(/data:\s*({.+?})/s);
                            if (sseMatch) {
                                result = JSON.parse(sseMatch[1]);
                            } else {
                                throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                            }
                        }
                    }

                    let content = '';
                    if (result.data) {
                        content = result.data;
                    } else if (result.content) {
                        content = result.content;
                    } else if (result.message && result.message.content) {
                        content = result.message.content;
                    } else if (result.message && typeof result.message === 'string') {
                        content = result.message;
                    } else if (typeof result === 'string') {
                        content = result;
                    } else {
                        content = JSON.stringify(result);
                    }

                    if (content && content.trim()) {
                        // 内容提取成功
                    } else if (result.status !== undefined && result.status !== 200) {
                        content = result.msg || '抱歉，服务器返回了错误。';
                        throw new Error(content);
                    } else if (result.msg && !content) {
                        content = result.msg;
                        throw new Error(content);
                    }

                    if (messageAvatar) {
                        messageAvatar.style.animation = '';
                    }

                    if (messageText) {
                        if (!content || !content.trim()) {
                            content = '抱歉，未能获取到有效内容。';
                        }
                        messageText.innerHTML = this.renderMarkdown(content);
                        messageText.setAttribute('data-original-text', content);

                        if (content && content.trim()) {
                            const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                            if (copyButtonContainer) {
                                this.addCopyButton(copyButtonContainer, messageText);
                            }
                            const petMessages = Array.from(messagesContainer.children).filter(
                                child => child.querySelector('[data-message-type="pet-bubble"]')
                            );
                            if (petMessages.length > 1) {
                                const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                                if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                    this.addTryAgainButton(tryAgainContainer, message);
                                }
                            }

                            await this.addActionButtonsToMessage(message);
                        }
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }

                    // 立即保存宠物回复到当前会话
                    this.skipSessionListRefresh = true;
                    if (content && content.trim()) {
                        await this.addMessageToSession('pet', content, null, false);
                    }

                    // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                    await this.saveCurrentSession(false, false);

                    // prompt 接口调用后必须触发 session/save
                    if (this.currentSessionId) {
                        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                            try {
                                await this.syncSessionToBackend(this.currentSessionId, true);
                                console.log(`prompt 接口调用后，会话 ${this.currentSessionId} 已保存到后端`);
                            } catch (error) {
                                console.warn('保存会话到后端失败:', error);
                            }
                        } else {
                            console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用');
                        }
                    } else {
                        console.warn('无法保存会话：当前会话 ID 不存在');
                    }

                    button.innerHTML = '✓';
                    button.style.cursor = 'default';
                    button.style.color = '#4caf50';

                    setTimeout(() => {
                        button.innerHTML = originalIcon;
                        button.title = originalTitle;
                        button.style.color = '#666';
                        button.style.cursor = 'pointer';
                        button.style.opacity = '1';
                        processingFlag.value = false;
                    }, 2000);
                } catch (error) {
                    const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                    if (!isAbortError) {
                        console.error(`生成${roleLabel}失败:`, error);
                    }

                    if (!isAbortError && messageText) {
                        const errorMessage = error.message && error.message.includes('HTTP error')
                            ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${roleIcon}`
                            : `抱歉，无法生成${roleLabel}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${roleIcon}`;
                        messageText.innerHTML = this.renderMarkdown(errorMessage);
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, message);
                            }
                        }
                        await this.addActionButtonsToMessage(message);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    } else if (isAbortError && message) {
                        message.remove();
                    }

                    if (!isAbortError) {
                        button.innerHTML = '✕';
                        button.style.cursor = 'default';
                        button.style.color = '#f44336';

                        setTimeout(() => {
                            button.innerHTML = originalIcon;
                            button.title = originalTitle;
                            button.style.color = '#666';
                            button.style.cursor = 'pointer';
                            button.style.opacity = '1';
                            processingFlag.value = false;
                        }, 1500);
                    } else {
                        button.innerHTML = originalIcon;
                        button.title = originalTitle;
                        button.style.color = '#666';
                        button.style.cursor = 'pointer';
                        button.style.opacity = '1';
                        processingFlag.value = false;
                    }
                } finally {
                    if (messageAvatar) {
                        messageAvatar.style.animation = '';
                    }
                }
            });

            actionsContainer.appendChild(button);
        }

        // 添加企微机器人按钮（参考角色按钮去重逻辑）
        const robotConfigs = await this.getWeWorkRobotConfigs();
        // 检查容器中已存在的机器人按钮ID，避免重复添加
        // 需要同时检查 actionsContainer 和 copyButtonContainer（用户消息时按钮会移动到 copyButtonContainer）
        const existingRobotIds = new Set();
        const existingRobotButtons = actionsContainer.querySelectorAll('[data-robot-id]');
        existingRobotButtons.forEach(btn => {
            const robotId = btn.getAttribute('data-robot-id');
            if (robotId) {
                existingRobotIds.add(robotId);
            }
        });
        // 如果是用户消息，还需要检查 copyButtonContainer 中是否已有按钮
        if (isUserMessage && copyButtonContainer) {
            const existingButtonsInCopyContainer = copyButtonContainer.querySelectorAll('[data-robot-id]');
            existingButtonsInCopyContainer.forEach(btn => {
                const robotId = btn.getAttribute('data-robot-id');
                if (robotId) {
                    existingRobotIds.add(robotId);
                }
            });
        }

        for (const robotConfig of robotConfigs) {
            if (!robotConfig || !robotConfig.webhookUrl) continue;

            // 如果已存在相同ID的按钮，跳过（去重）
            if (existingRobotIds.has(robotConfig.id)) {
                continue;
            }

            const robotButton = document.createElement('span');
            robotButton.setAttribute('data-robot-id', robotConfig.id);
            robotButton.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 16px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 22px !important;
                height: 22px !important;
                line-height: 22px !important;
            `;

            robotButton.innerHTML = robotConfig.icon || '🤖';
            robotButton.title = robotConfig.name || '企微机器人';

            robotButton.addEventListener('mouseenter', function() {
                this.style.fontSize = '18px';
                this.style.color = '#333';
                this.style.transform = 'scale(1.1)';
            });
            robotButton.addEventListener('mouseleave', function() {
                this.style.fontSize = '16px';
                this.style.color = '#666';
                this.style.transform = 'scale(1)';
            });

            robotButton.addEventListener('click', async (e) => {
                e.stopPropagation();

                // 获取当前消息的内容（支持用户消息和宠物消息）
                const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]') ||
                                     messageDiv.querySelector('[data-message-type="user-bubble"]');
                let messageContent = '';
                if (messageBubble) {
                    messageContent = messageBubble.getAttribute('data-original-text') ||
                                   messageBubble.innerText ||
                                   messageBubble.textContent || '';
                }

                if (!messageContent || !messageContent.trim()) {
                    this.showNotification('消息内容为空，无法发送', 'error');
                    return;
                }

                const trimmedContent = messageContent.trim();
                const contentLength = trimmedContent.length;

                // 不再检查内容长度限制，允许发送任意长度的消息

                // 显示发送状态
                const originalIcon = robotButton.innerHTML;
                robotButton.innerHTML = '⏳';
                robotButton.style.color = '#2196F3';
                robotButton.style.cursor = 'default';

                try {
                    let finalContent = '';

                    // 检查是否是 markdown 格式
                    if (this.isMarkdownFormat(trimmedContent)) {
                        // 已经是 markdown 格式，直接使用
                        finalContent = trimmedContent;
                        console.log(`[企微机器人] 内容已是 markdown 格式，长度: ${finalContent.length}`);
                    } else {
                        // 不是 markdown 格式，转换为 markdown
                        console.log('[企微机器人] 内容不是 markdown 格式，转换为 markdown...');
                        finalContent = await this.convertToMarkdown(trimmedContent);
                        console.log(`[企微机器人] 转换后长度: ${finalContent.length}`);
                    }

                    // 不再限制消息长度，发送完整内容

                    // 发送到企微机器人
                    await this.sendToWeWorkRobot(robotConfig.webhookUrl, finalContent);
                    robotButton.innerHTML = '✓';
                    robotButton.style.color = '#4caf50';
                    this.showNotification(`已发送到 ${robotConfig.name || '企微机器人'}`, 'success');

                    setTimeout(() => {
                        robotButton.innerHTML = originalIcon;
                        robotButton.style.color = '#666';
                        robotButton.style.cursor = 'pointer';
                    }, 2000);
                } catch (error) {
                    console.error('发送到企微机器人失败:', error);
                    robotButton.innerHTML = '✕';
                    robotButton.style.color = '#f44336';
                    this.showNotification(`发送失败：${error.message || '未知错误'}`, 'error');

                    setTimeout(() => {
                        robotButton.innerHTML = originalIcon;
                        robotButton.style.color = '#666';
                        robotButton.style.cursor = 'pointer';
                    }, 2000);
                }
            });

            actionsContainer.appendChild(robotButton);
        }

        // 企微机器人设置按钮已移动到 chat-request-status-button 后面，不再添加到消息容器中

        // 只有在按钮容器中有按钮时才插入到DOM中
        if (actionsContainer.children.length > 0) {
            // 检查是用户消息还是宠物消息
            // isUserMessage 和 copyButtonContainer 已在函数开始处声明
            const messageTimeWrapper = timeAndCopyContainer.querySelector('[data-message-time]')?.parentElement;

            if (isUserMessage) {
                // 用户消息：将所有按钮（编辑、删除、角色按钮等）都放在 copyButtonContainer 内部
                // 这样所有按钮都会在一起
                if (copyButtonContainer) {
                    // 将 actionsContainer 中的所有按钮移动到 copyButtonContainer 内部
                    // 先移除 actionsContainer 的样式，因为按钮会直接添加到 copyButtonContainer
                    actionsContainer.style.cssText = '';
                    // 将 actionsContainer 中的所有子元素移动到 copyButtonContainer
                    while (actionsContainer.firstChild) {
                        copyButtonContainer.appendChild(actionsContainer.firstChild);
                    }
                    // 移除空的 actionsContainer
                    actionsContainer.remove();
                    // 确保 copyButtonContainer 使用 flex 布局，按钮之间有间距，保留原有样式
                    if (!copyButtonContainer.style.display || copyButtonContainer.style.display === 'none') {
                        copyButtonContainer.style.display = 'flex';
                    }
                    copyButtonContainer.style.alignItems = 'center';
                    copyButtonContainer.style.gap = '8px';
                } else if (messageTimeWrapper) {
                    // 如果没有复制按钮容器，插入到时间包装器之前
                    timeAndCopyContainer.insertBefore(actionsContainer, messageTimeWrapper);
                } else {
                    // 如果都找不到，添加到开头
                    timeAndCopyContainer.insertBefore(actionsContainer, timeAndCopyContainer.firstChild);
                }
            } else {
                // 宠物消息：按钮应该插入到时间包装器之后，复制按钮之前
                if (messageTimeWrapper && messageTimeWrapper.parentNode === timeAndCopyContainer) {
                    if (copyButtonContainer) {
                        // 如果存在复制按钮容器，将按钮插入到它之前
                        timeAndCopyContainer.insertBefore(actionsContainer, copyButtonContainer);
                    } else {
                        // 如果没有复制按钮容器，将按钮插入到时间包装器之后
                        timeAndCopyContainer.insertBefore(actionsContainer, messageTimeWrapper.nextSibling);
                    }
                } else {
                    // 如果找不到 messageTimeWrapper 或者结构不对，尝试找到第一个子元素之后插入
                    const firstChild = timeAndCopyContainer.firstElementChild;
                    if (firstChild && firstChild.nextSibling) {
                        timeAndCopyContainer.insertBefore(actionsContainer, firstChild.nextSibling);
                    } else {
                        // 如果没有合适的插入位置，添加到开头（在第一个子元素之前）
                        if (firstChild) {
                            timeAndCopyContainer.insertBefore(actionsContainer, firstChild);
                        } else {
                            timeAndCopyContainer.appendChild(actionsContainer);
                        }
                    }
                }
            }
        }

        // 添加排序按钮（在动作按钮之后）
        if (copyButtonContainer) {
            this.addSortButtons(copyButtonContainer, messageDiv);
        }
    }

    // 刷新所有消息的动作按钮（在角色设置更新后调用）
    async refreshAllMessageActionButtons() {
        if (!this.chatWindow) return;

        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) return;

        // 查找所有有按钮容器的消息（不包括第一条欢迎消息）
        const allMessages = Array.from(messagesContainer.children).filter(
            child => child.querySelector('[data-message-type="pet-bubble"]')
        );

        // 跳过第一条消息，从第二条开始刷新
        for (let i = 1; i < allMessages.length; i++) {
            const messageDiv = allMessages[i];
            // 强制刷新按钮
            await this.addActionButtonsToMessage(messageDiv, true);
        }
    }

    // 构建会话上下文（包含消息历史和页面内容）
    buildConversationContext() {
        const context = {
            messages: [],
            pageContent: '',
            hasHistory: false
        };

        // 获取当前会话
        if (this.currentSessionId && this.sessions[this.currentSessionId]) {
            const session = this.sessions[this.currentSessionId];

            // 获取消息历史（排除欢迎消息和按钮操作生成的消息）
            if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
                context.messages = session.messages.filter(msg => {
                    // 只包含用户消息和宠物消息，排除按钮操作生成的消息
                    return msg.type === 'user' || msg.type === 'pet';
                });
                context.hasHistory = context.messages.length > 0;
            }

            // 获取页面内容
            if (session.pageContent && session.pageContent.trim()) {
                context.pageContent = session.pageContent.trim();
            }
        }

        return context;
    }

    // 构建包含会话上下文的 fromUser 参数
    buildFromUserWithContext(baseUserPrompt, roleLabel) {
        // 检查页面上下文开关状态
        let includeContext = true; // 默认包含上下文
        const contextSwitch = this.chatWindow ? this.chatWindow.querySelector('#context-switch') : null;
        if (contextSwitch) {
            includeContext = contextSwitch.checked;
        }

        const context = this.buildConversationContext();

        // 如果 baseUserPrompt 已经包含了页面内容，根据开关状态决定是否替换或移除
        let finalBasePrompt = baseUserPrompt;
        if (baseUserPrompt.includes('页面内容（Markdown 格式）：')) {
            if (includeContext && context.pageContent) {
                // 开关打开且有会话页面内容：使用会话保存的页面上下文替换它
                const pageContentMatch = baseUserPrompt.match(/页面内容（Markdown 格式）：\s*\n([\s\S]*?)(?=\n\n|$)/);
                if (pageContentMatch) {
                    // 替换为会话保存的页面内容
                    finalBasePrompt = baseUserPrompt.replace(
                        /页面内容（Markdown 格式）：\s*\n[\s\S]*?(?=\n\n|$)/,
                        `页面内容（Markdown 格式）：\n${context.pageContent}`
                    );
                }
            } else if (!includeContext) {
                // 开关关闭：移除页面内容部分
                finalBasePrompt = baseUserPrompt.replace(
                    /页面内容（Markdown 格式）：\s*\n[\s\S]*?(?=\n\n|$)/,
                    '页面内容（Markdown 格式）：\n无内容（页面上下文已关闭）'
                );
            }
        }

        // 如果没有消息历史，直接使用基础提示词（可能已包含页面内容）
        if (!context.hasHistory) {
            // 如果开关打开、baseUserPrompt 中没有页面内容，但会话有页面内容，添加页面内容
            if (includeContext && context.pageContent && !finalBasePrompt.includes('页面内容（Markdown 格式）：')) {
                const pageContext = '\n\n## 页面内容：\n\n' + context.pageContent;
                return finalBasePrompt + pageContext;
            }
            return finalBasePrompt;
        }

        // 构建消息历史上下文
        let conversationContext = '';
        if (context.messages.length > 0) {
            conversationContext = '\n\n## 会话历史：\n\n';
            context.messages.forEach((msg, index) => {
                const role = msg.type === 'user' ? '用户' : '助手';
                const content = msg.content.trim();
                if (content) {
                    conversationContext += `${role}：${content}\n\n`;
                }
            });
        }

        // 如果开关打开、baseUserPrompt 中没有页面内容，但会话有页面内容，添加页面内容
        let pageContext = '';
        if (includeContext && context.pageContent && !finalBasePrompt.includes('页面内容（Markdown 格式）：')) {
            pageContext = '\n\n## 页面内容：\n\n' + context.pageContent;
        }

        // 组合：基础提示词（已包含会话的页面上下文）+ 会话历史 + 页面内容（如果需要）
        return finalBasePrompt + conversationContext + pageContext;
    }

    // 创建角色按钮点击处理函数（用于有 actionKey 的角色）
    createRoleButtonHandler(actionKey, iconEl, processingFlag) {
        return async () => {
            if (processingFlag.value) return;

            processingFlag.value = true;

            // 获取消息容器
            const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
            if (!messagesContainer) {
                console.error('无法找到消息容器');
                processingFlag.value = false;
                return;
            }

            // 获取页面信息：优先使用当前会话保存的页面上下文
            let pageInfo;
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                pageInfo = {
                    title: session.pageTitle || document.title || '当前页面',
                    url: session.url || window.location.href,
                    description: session.pageDescription || '',
                    content: session.pageContent || '' // 使用会话保存的页面内容
                };
            } else {
                // 如果没有当前会话，使用当前页面信息
                pageInfo = this.getPageInfo();
            }

            // 从角色配置中获取提示语、名称、图标
            let roleInfo;
            try {
                roleInfo = await this.getRolePromptForAction(actionKey, pageInfo);
            } catch (error) {
                console.error('获取角色信息失败:', error);
                roleInfo = {
                    systemPrompt: '',
                    userPrompt: '',
                    label: '自定义角色',
                    icon: '🙂'
                };
            }

            // 构建包含会话上下文的 fromUser 参数（会使用会话保存的页面上下文）
            const fromUser = this.buildFromUserWithContext(roleInfo.userPrompt, roleInfo.label);

            // 找到按钮所在的消息元素（向上查找包含用户消息的元素）
            let userMessageDiv = null;
            let currentElement = iconEl;
            while (currentElement && currentElement !== messagesContainer) {
                // 检查当前元素是否包含 user-bubble
                if (currentElement.querySelector) {
                    const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]');
                    if (userBubble) {
                        userMessageDiv = currentElement;
                        break;
                    }
                }
                // 如果当前元素有 data-message-id 属性，也检查它是否包含 user-bubble（消息元素有该属性）
                if (currentElement.hasAttribute && currentElement.hasAttribute('data-message-id')) {
                    const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]');
                    if (userBubble) {
                        userMessageDiv = currentElement;
                        break;
                    }
                }
                currentElement = currentElement.parentElement;
            }

            // 创建新的消息（按钮操作生成的消息）
            const message = this.createMessageElement('', 'pet');
            message.setAttribute('data-button-action', 'true'); // 标记为按钮操作生成
            messagesContainer.appendChild(message);
            const messageText = message.querySelector('[data-message-type="pet-bubble"]');
            const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

            // 显示加载动画
            if (messageAvatar) {
                messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
            }

            // 使用角色配置中的图标显示加载文本
            const loadingIcon = roleInfo.icon || '📖';
            if (messageText) {
                messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
            }

            try {
                // 使用 /prompt 接口生成内容（非流式）
                console.log('调用大模型生成内容，角色:', roleInfo.label, '页面标题:', pageInfo.title || '当前页面');

                // 创建 AbortController 用于终止请求
                const abortController = new AbortController();

                // 设置标志，避免 prompt 调用后触发会话列表刷新接口
                this.skipSessionListRefresh = true;

                // 使用统一的 payload 构建函数，自动包含会话 ID
                // 如果找到了用户消息元素，将其传递给 buildPromptPayload，以便从正确的消息中提取图片
                const payload = this.buildPromptPayload(
                    roleInfo.systemPrompt,
                    fromUser,
                    { messageDiv: userMessageDiv }
                );

                const response = await fetch(PET_CONFIG.api.promptUrl, {
                    method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload),
                    signal: abortController.signal
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }

                const result = await response.json();

                // 处理后端返回的会话 ID（如果返回了）
                if (result.conversation_id) {
                    const conversationId = result.conversation_id;
                    if (conversationId && !this.currentSessionId) {
                        // 如果当前没有会话 ID，使用后端返回的会话 ID
                        this.currentSessionId = conversationId;
                        console.log('从后端同步会话 ID:', conversationId);
                        // 确保会话存在
                        if (!this.sessions[this.currentSessionId]) {
                            // 创建基础会话对象
                            const pageInfo = this.getPageInfo();
                            const newSession = this.createSessionObject(conversationId, pageInfo);
                            this.sessions[conversationId] = newSession;
                            // 标记当前页面已自动创建会话
                            this.hasAutoCreatedSessionForPage = true;
                            this.currentPageUrl = pageInfo.url;
                        }
                    } else if (conversationId && this.currentSessionId !== conversationId) {
                        // 如果后端返回的会话 ID 与当前不同，记录日志
                        console.log('后端返回的会话 ID 与当前不同:', conversationId, 'vs', this.currentSessionId);
                    }
                }

                // 适配响应格式: {status, msg, data, pagination}
                let content = '';
                if (result.status === 200 && result.data) {
                    // 成功响应，提取 data 字段
                    content = result.data;
                } else if (result.status !== 200) {
                    // API 返回错误，使用 msg 字段
                    content = result.msg || '抱歉，服务器返回了错误。';
                    throw new Error(content);
                } else if (result.content) {
                    content = result.content;
                } else if (result.message) {
                    content = result.message;
                } else if (typeof result === 'string') {
                    content = result;
                } else {
                    // 未知格式，尝试提取可能的文本内容
                    content = JSON.stringify(result);
                }

                // 停止加载动画
                if (messageAvatar) {
                    messageAvatar.style.animation = '';
                }

                // 显示生成的内容
                if (messageText) {
                    // 确保内容不为空
                    if (!content || !content.trim()) {
                        content = '抱歉，未能获取到有效内容。';
                    }
                    messageText.innerHTML = this.renderMarkdown(content);
                    // 更新原始文本用于复制功能
                    messageText.setAttribute('data-original-text', content);
                    // 添加复制按钮
                    if (content && content.trim()) {
                        const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                        if (copyButtonContainer) {
                            this.addCopyButton(copyButtonContainer, messageText);
                        }
                        // 添加 try again 按钮（仅当不是第一条消息时）
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, message);
                            }
                        }
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                // 立即保存宠物回复到当前会话（参考用户输入后的保存逻辑）
                // 设置标志，避免触发会话列表刷新接口（prompt 接口调用完成后会触发 session/save）
                this.skipSessionListRefresh = true;
                if (content && content.trim()) {
                    await this.addMessageToSession('pet', content, null, false);
                }

                // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                await this.saveCurrentSession(false, false);

                // 请求结束后调用 session/save 保存会话到后端
                if (this.currentSessionId) {
                    if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                        try {
                            await this.syncSessionToBackend(this.currentSessionId, true);
                            console.log(`角色按钮操作后，会话 ${this.currentSessionId} 已保存到后端`);
                        } catch (error) {
                            console.warn('保存会话到后端失败:', error);
                        }
                    } else {
                        console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用');
                    }
                } else {
                    console.warn('无法保存会话：当前会话 ID 不存在');
                }

                iconEl.innerHTML = '✓';
                iconEl.style.cursor = 'default';
                iconEl.style.color = '#4caf50';

                // 2秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
                setTimeout(() => {
                    this.applyRoleConfigToActionIcon(iconEl, actionKey);
                    iconEl.style.color = '#666';
                    iconEl.style.cursor = 'pointer';
                    iconEl.style.opacity = '1';
                    processingFlag.value = false;
                }, 2000);

            } catch (error) {
                // 检查是否是取消错误
                const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                if (!isAbortError) {
                    console.error(`生成${roleInfo.label}失败:`, error);
                }

                // 显示错误消息（取消时不显示）
                if (!isAbortError && messageText) {
                    const errorMessage = error.message && error.message.includes('HTTP error')
                        ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
                        : `抱歉，无法生成"${pageInfo.title || '当前页面'}"的${roleInfo.label || '内容'}。${error.message ? `错误信息：${error.message}` : '您可以尝试刷新页面后重试。'}${loadingIcon}`;
                    messageText.innerHTML = this.renderMarkdown(errorMessage);
                    // 添加 try again 按钮（仅当不是第一条消息时）
                    const petMessages = Array.from(messagesContainer.children).filter(
                        child => child.querySelector('[data-message-type="pet-bubble"]')
                    );
                    if (petMessages.length > 1) {
                        const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                            this.addTryAgainButton(tryAgainContainer, message);
                        }
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else if (isAbortError && messageText) {
                    // 请求被取消，移除消息
                    message.remove();
                }

                if (!isAbortError) {
                    iconEl.innerHTML = '✕';
                    iconEl.style.cursor = 'default';
                    iconEl.style.color = '#f44336';

                    // 1.5秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
                    setTimeout(() => {
                        this.applyRoleConfigToActionIcon(iconEl, actionKey);
                        iconEl.style.color = '#666';
                        iconEl.style.cursor = 'pointer';
                        iconEl.style.opacity = '1';
                        processingFlag.value = false;
                    }, 1500);
                } else {
                    // 请求被取消，立即恢复状态
                    this.applyRoleConfigToActionIcon(iconEl, actionKey);
                    iconEl.style.color = '#666';
                    iconEl.style.cursor = 'pointer';
                    iconEl.style.opacity = '1';
                    processingFlag.value = false;
                }
            } finally {
                // 确保停止加载动画
                if (messageAvatar) {
                    messageAvatar.style.animation = '';
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };
    }

    // 已移除 custom-role-shortcuts 功能

    // -------- 角色设置弹框（新增/编辑/删除） --------
    openRoleSettingsModal(editId = null) {
        if (!this.chatWindow) return;
        let overlay = this.chatWindow.querySelector('#pet-role-settings');
        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pet-role-settings';
            const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
            const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
            overlay.style.cssText = `
                position: absolute !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                top: ${headerH}px !important;
                background: transparent !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
                pointer-events: none !important;
            `;

            const panel = document.createElement('div');
            panel.id = 'pet-role-settings-panel';
            panel.style.cssText = `
                width: calc(100% - 24px) !important;
                height: calc(100% - 12px) !important;
                margin: 0 12px 12px 12px !important;
                background: #1f1f1f !important;
                color: #fff !important;
                border-radius: 12px !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                pointer-events: auto !important;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 16px 20px !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                background: rgba(255,255,255,0.04) !important;
                flex-shrink: 0 !important;
            `;
            const title = document.createElement('div');
            title.textContent = '角色设置';
            title.style.cssText = 'font-weight: 600; font-size: 16px; color: #fff;';

            const headerBtns = document.createElement('div');
            headerBtns.style.cssText = 'display:flex; gap:10px; align-items:center;';
            const closeBtn = document.createElement('button');
            closeBtn.id = 'pet-role-settings-close-btn';
            closeBtn.setAttribute('aria-label', '关闭角色设置 (Esc)');
            closeBtn.setAttribute('title', '关闭 (Esc)');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                width: 32px !important;
                height: 32px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                font-size: 16px !important;
                transition: all 0.2s ease !important;
                outline: none !important;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                closeBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                closeBtn.style.color = '#ef4444';
                closeBtn.style.transform = 'translateY(-1px)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'rgba(255,255,255,0.06)';
                closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                closeBtn.style.color = '#e5e7eb';
                closeBtn.style.transform = 'translateY(0)';
            });
            closeBtn.addEventListener('mousedown', () => {
                closeBtn.style.transform = 'scale(0.96)';
            });
            closeBtn.addEventListener('mouseup', () => {
                closeBtn.style.transform = 'scale(1)';
            });
            closeBtn.addEventListener('click', () => this.closeRoleSettingsModal());
            headerBtns.appendChild(closeBtn);
            header.appendChild(title);
            header.appendChild(headerBtns);

            const body = document.createElement('div');
            body.id = 'pet-role-settings-body';
            body.style.cssText = `
                display: flex !important;
                gap: 16px !important;
                padding: 16px 20px !important;
                height: 100% !important;
                min-height: 0 !important;
                overflow: hidden !important;
            `;

            // 左侧：角色列表
            const listContainer = document.createElement('div');
            listContainer.style.cssText = `
                width: 38% !important;
                min-width: 280px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 12px !important;
            `;

            // 新增角色按钮（放在列表顶部）
            const addBtn = document.createElement('button');
            addBtn.textContent = '新增角色';
            addBtn.style.cssText = `
                padding: 8px 16px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
            `;
            addBtn.addEventListener('mouseenter', () => {
                addBtn.style.background = 'rgba(255,255,255,0.12)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                addBtn.style.transform = 'translateY(-1px)';
            });
            addBtn.addEventListener('mouseleave', () => {
                addBtn.style.background = 'rgba(255,255,255,0.06)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                addBtn.style.transform = 'translateY(0)';
            });
            addBtn.addEventListener('click', () => this.renderRoleSettingsForm(null, false));
            listContainer.appendChild(addBtn);

            const list = document.createElement('div');
            list.id = 'pet-role-list';
            list.style.cssText = `
                flex: 1 !important;
                min-height: 0 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 12px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
            `;
            listContainer.appendChild(list);

            // 右侧：表单区
            const form = document.createElement('div');
            form.id = 'pet-role-form';
            form.style.cssText = `
                flex: 1 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                padding: 20px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 16px !important;
            `;

            body.appendChild(listContainer);
            body.appendChild(form);
            panel.appendChild(header);
            panel.appendChild(body);
            overlay.appendChild(panel);
            this.chatWindow.appendChild(overlay);
        }

        overlay.style.display = 'flex';

        // 隐藏折叠按钮（避免在弹框中显示两个折叠按钮）
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';

        // 直接渲染当前配置（不再强制补齐默认项，便于"删除"生效）
        this.renderRoleSettingsList();
        if (editId) {
            this.renderRoleSettingsForm(editId);
        } else {
            this.renderRoleSettingsForm(null, true); // 第二个参数表示显示空白状态
        }
    }

    closeRoleSettingsModal() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-role-settings');
        if (overlay) overlay.style.display = 'none';

        // 显示折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
        if (inputToggleBtn) inputToggleBtn.style.display = 'flex';
    }

    // 打开企微机器人设置模态框
    openWeWorkRobotSettingsModal(editId = null) {
        if (!this.chatWindow) return;
        let overlay = this.chatWindow.querySelector('#pet-wework-robot-settings');
        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pet-wework-robot-settings';
            const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
            const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
            overlay.style.cssText = `
                position: absolute !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                top: ${headerH}px !important;
                background: transparent !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
                pointer-events: none !important;
            `;

            const panel = document.createElement('div');
            panel.id = 'pet-wework-robot-settings-panel';
            panel.style.cssText = `
                width: calc(100% - 24px) !important;
                height: calc(100% - 12px) !important;
                margin: 0 12px 12px 12px !important;
                background: #1f1f1f !important;
                color: #fff !important;
                border-radius: 12px !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                pointer-events: auto !important;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 16px 20px !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                background: rgba(255,255,255,0.04) !important;
                flex-shrink: 0 !important;
            `;
            const title = document.createElement('div');
            title.textContent = '企微机器人设置';
            title.style.cssText = 'font-weight: 600; font-size: 16px; color: #fff;';

            const headerBtns = document.createElement('div');
            headerBtns.style.cssText = 'display:flex; gap:10px; align-items:center;';
            const closeBtn = document.createElement('button');
            closeBtn.id = 'pet-wework-robot-settings-close-btn';
            closeBtn.setAttribute('aria-label', '关闭企微机器人设置 (Esc)');
            closeBtn.setAttribute('title', '关闭 (Esc)');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                width: 32px !important;
                height: 32px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                font-size: 16px !important;
                transition: all 0.2s ease !important;
                outline: none !important;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                closeBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                closeBtn.style.color = '#ef4444';
                closeBtn.style.transform = 'translateY(-1px)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'rgba(255,255,255,0.06)';
                closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                closeBtn.style.color = '#e5e7eb';
                closeBtn.style.transform = 'translateY(0)';
            });
            closeBtn.addEventListener('mousedown', () => {
                closeBtn.style.transform = 'scale(0.96)';
            });
            closeBtn.addEventListener('mouseup', () => {
                closeBtn.style.transform = 'scale(1)';
            });
            closeBtn.addEventListener('click', () => this.closeWeWorkRobotSettingsModal());
            headerBtns.appendChild(closeBtn);
            header.appendChild(title);
            header.appendChild(headerBtns);

            const body = document.createElement('div');
            body.id = 'pet-wework-robot-settings-body';
            body.style.cssText = `
                display: flex !important;
                gap: 16px !important;
                padding: 16px 20px !important;
                height: 100% !important;
                min-height: 0 !important;
                overflow: hidden !important;
            `;

            // 左侧：机器人列表
            const listContainer = document.createElement('div');
            listContainer.style.cssText = `
                width: 38% !important;
                min-width: 280px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 12px !important;
            `;

            // 新增机器人按钮
            const addBtn = document.createElement('button');
            addBtn.textContent = '新增机器人';
            addBtn.style.cssText = `
                padding: 8px 16px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
            `;
            addBtn.addEventListener('mouseenter', () => {
                addBtn.style.background = 'rgba(255,255,255,0.12)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                addBtn.style.transform = 'translateY(-1px)';
            });
            addBtn.addEventListener('mouseleave', () => {
                addBtn.style.background = 'rgba(255,255,255,0.06)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                addBtn.style.transform = 'translateY(0)';
            });
            addBtn.addEventListener('click', () => this.renderWeWorkRobotSettingsForm(null, false));
            listContainer.appendChild(addBtn);

            const list = document.createElement('div');
            list.id = 'pet-wework-robot-list';
            list.style.cssText = `
                flex: 1 !important;
                min-height: 0 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 12px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
            `;
            listContainer.appendChild(list);

            // 右侧：表单区
            const form = document.createElement('div');
            form.id = 'pet-wework-robot-form';
            form.style.cssText = `
                flex: 1 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                padding: 20px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 16px !important;
            `;

            body.appendChild(listContainer);
            body.appendChild(form);
            panel.appendChild(header);
            panel.appendChild(body);
            overlay.appendChild(panel);
            this.chatWindow.appendChild(overlay);
        }

        overlay.style.display = 'flex';

        // 隐藏折叠按钮（避免在弹框中显示两个折叠按钮）
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';

        this.renderWeWorkRobotSettingsList();
        if (editId) {
            this.renderWeWorkRobotSettingsForm(editId);
        } else {
            this.renderWeWorkRobotSettingsForm(null, true);
        }
    }

    closeWeWorkRobotSettingsModal() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-wework-robot-settings');
        if (overlay) overlay.style.display = 'none';

        // 显示折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
        if (inputToggleBtn) inputToggleBtn.style.display = 'flex';
    }

    async renderWeWorkRobotSettingsList() {
        if (!this.chatWindow) return;
        const list = this.chatWindow.querySelector('#pet-wework-robot-list');
        if (!list) return;
        const configs = await this.getWeWorkRobotConfigs();
        list.innerHTML = '';

        configs.forEach((config) => {
            const row = this.createWeWorkRobotListItem(config);
            list.appendChild(row);
        });

        if (list.children.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = '暂无可编辑机器人。点击"新增机器人"开始创建';
            empty.style.cssText = 'color: #64748b; font-size: 13px; padding: 24px 12px; text-align: center; line-height: 1.5;';
            list.appendChild(empty);
        }
    }

    createWeWorkRobotListItem(config) {
        const row = document.createElement('div');
        row.style.cssText = `
            display:flex !important;
            align-items:center !important;
            justify-content: space-between !important;
            gap: 12px !important;
            padding: 12px !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            background: rgba(255,255,255,0.02) !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
        `;
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.borderColor = 'rgba(255,255,255,0.15)';
            row.style.transform = 'translateX(2px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'rgba(255,255,255,0.02)';
            row.style.borderColor = 'rgba(255,255,255,0.08)';
            row.style.transform = 'translateX(0)';
        });
        const info = document.createElement('div');
        info.style.cssText = 'display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;';
        const name = document.createElement('div');
        name.textContent = `${config.icon || '🤖'} ${config.name || '(未命名)'}`;
        name.style.cssText = 'font-weight: 600; font-size: 13px; color: #fff; line-height: 1.4; word-break: break-word;';
        info.appendChild(name);

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:6px; flex-shrink:0;';
        const edit = document.createElement('button');
        edit.textContent = '编辑';
        edit.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        edit.addEventListener('mouseenter', () => {
            edit.style.background = 'rgba(59, 130, 246, 0.15)';
            edit.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            edit.style.color = '#60a5fa';
            edit.style.transform = 'translateY(-1px)';
        });
        edit.addEventListener('mouseleave', () => {
            edit.style.background = 'rgba(255,255,255,0.06)';
            edit.style.borderColor = 'rgba(255,255,255,0.15)';
            edit.style.color = '#e5e7eb';
            edit.style.transform = 'translateY(0)';
        });
        edit.addEventListener('click', () => this.renderWeWorkRobotSettingsForm(config.id));
        const del = document.createElement('button');
        del.textContent = '删除';
        del.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        del.addEventListener('mouseenter', () => {
            del.style.background = 'rgba(239, 68, 68, 0.15)';
            del.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            del.style.color = '#f87171';
            del.style.transform = 'translateY(-1px)';
        });
        del.addEventListener('mouseleave', () => {
            del.style.background = 'rgba(255,255,255,0.06)';
            del.style.borderColor = 'rgba(255,255,255,0.15)';
            del.style.color = '#e5e7eb';
            del.style.transform = 'translateY(0)';
        });
        del.addEventListener('click', async () => {
            const next = (await this.getWeWorkRobotConfigs()).filter(x => x.id !== config.id);
            await this.setWeWorkRobotConfigs(next);
            this.renderWeWorkRobotSettingsList();
            this.renderWeWorkRobotSettingsForm(null, true);
        });
        btns.appendChild(edit);
        btns.appendChild(del);

        row.appendChild(info);
        row.appendChild(btns);
        row.addEventListener('click', () => this.renderWeWorkRobotSettingsForm(config.id));
        return row;
    }

    async renderWeWorkRobotSettingsForm(editId = null, showEmptyState = false) {
        if (!this.chatWindow) return;
        const form = this.chatWindow.querySelector('#pet-wework-robot-form');
        if (!form) return;
        const configsAll = await this.getWeWorkRobotConfigs();
        const current = editId ? (configsAll || []).find(c => c && c.id === editId) : null;

        form.innerHTML = '';

        if (showEmptyState && !editId && !current) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                height: 100% !important;
                padding: 40px 20px !important;
                text-align: center !important;
            `;

            const icon = document.createElement('div');
            icon.textContent = '🤖';
            icon.style.cssText = `
                font-size: 64px !important;
                margin-bottom: 20px !important;
                opacity: 0.6 !important;
            `;

            const title = document.createElement('div');
            title.textContent = '选择一个机器人开始编辑';
            title.style.cssText = `
                font-weight: 600 !important;
                font-size: 16px !important;
                color: #e5e7eb !important;
                margin-bottom: 8px !important;
            `;

            const desc = document.createElement('div');
            desc.textContent = '从左侧列表选择机器人进行编辑，或点击"新增机器人"创建新机器人';
            desc.style.cssText = `
                font-size: 13px !important;
                color: #94a3b8 !important;
                line-height: 1.6 !important;
                max-width: 320px !important;
            `;

            const actionBtn = document.createElement('button');
            actionBtn.textContent = '新增机器人';
            actionBtn.style.cssText = `
                margin-top: 24px !important;
                padding: 10px 24px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 8px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
            `;
            actionBtn.addEventListener('mouseenter', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.12)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                actionBtn.style.transform = 'translateY(-2px)';
            });
            actionBtn.addEventListener('mouseleave', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.06)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                actionBtn.style.transform = 'translateY(0)';
            });
            actionBtn.addEventListener('click', () => {
                this.renderWeWorkRobotSettingsForm(null, false);
            });

            emptyState.appendChild(icon);
            emptyState.appendChild(title);
            emptyState.appendChild(desc);
            emptyState.appendChild(actionBtn);
            form.appendChild(emptyState);
            return;
        }

        const title = document.createElement('div');
        title.textContent = current ? '编辑机器人' : '新增机器人';
        title.style.cssText = 'font-weight: 600; font-size: 18px; color: #fff; margin-bottom: 4px;';

        const row = (labelText, inputEl) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
            const lab = document.createElement('label');
            lab.textContent = labelText;
            lab.style.cssText = 'font-size: 13px; font-weight: 500; color: #cbd5e1;';
            wrap.appendChild(lab);
            wrap.appendChild(inputEl);
            return wrap;
        };

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = current?.name || '';
        nameInput.placeholder = '机器人名称，如：通知机器人';
        nameInput.style.cssText = `
            padding: 10px 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
        `;
        nameInput.addEventListener('focus', () => {
            nameInput.style.borderColor = 'rgba(255,255,255,0.25)';
            nameInput.style.background = '#1a1a1a';
        });
        nameInput.addEventListener('blur', () => {
            nameInput.style.borderColor = 'rgba(255,255,255,0.12)';
            nameInput.style.background = '#121212';
        });

        const iconInput = document.createElement('input');
        iconInput.type = 'text';
        iconInput.value = current?.icon || '🤖';
        iconInput.placeholder = '图标（Emoji）';
        iconInput.style.cssText = `
            padding: 10px 12px !important;
            width: 80px !important;
            text-align: center !important;
            font-size: 18px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            transition: all 0.2s ease !important;
        `;
        iconInput.addEventListener('focus', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.25)';
            iconInput.style.background = '#1a1a1a';
        });
        iconInput.addEventListener('blur', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.12)';
            iconInput.style.background = '#121212';
        });

        const webhookInput = document.createElement('input');
        webhookInput.type = 'text';
        webhookInput.value = current?.webhookUrl || '';
        webhookInput.placeholder = 'Webhook地址，如：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx';
        webhookInput.style.cssText = `
            padding: 10px 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
        `;
        webhookInput.addEventListener('focus', () => {
            webhookInput.style.borderColor = 'rgba(255,255,255,0.25)';
            webhookInput.style.background = '#1a1a1a';
        });
        webhookInput.addEventListener('blur', () => {
            webhookInput.style.borderColor = 'rgba(255,255,255,0.12)';
            webhookInput.style.background = '#121212';
        });

        const helpText = document.createElement('div');
        helpText.innerHTML = '💡 获取Webhook地址：<a href="https://developer.work.weixin.qq.com/document/path/91770" target="_blank" style="color: #60a5fa; text-decoration: underline;">查看企微机器人文档</a>';
        helpText.style.cssText = 'font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: -8px;';

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(34, 197, 94, 0.3) !important;
            background: rgba(34, 197, 94, 0.15) !important;
            color: #4ade80 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.25)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
            saveBtn.style.transform = 'translateY(-1px)';
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.15)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            saveBtn.style.transform = 'translateY(0)';
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.12)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            cancelBtn.style.transform = 'translateY(-1px)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.06)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            cancelBtn.style.transform = 'translateY(0)';
        });

        saveBtn.addEventListener('click', async () => {
            const originalText = saveBtn.textContent;
            const isLoading = saveBtn.dataset.loading === 'true';
            if (isLoading) return;

            saveBtn.dataset.loading = 'true';
            saveBtn.textContent = '保存中...';
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.style.cursor = 'not-allowed';

            try {
                if (!webhookInput.value.trim()) {
                    throw new Error('Webhook地址不能为空');
                }

                const next = {
                    id: current?.id || ('robot_' + Math.random().toString(36).slice(2, 10)),
                    name: nameInput.value.trim() || '未命名机器人',
                    icon: iconInput.value.trim() || '🤖',
                    webhookUrl: webhookInput.value.trim(),
                };

                const arr = await this.getWeWorkRobotConfigs();

                const idx = arr.findIndex(x => x.id === next.id);
                const isEdit = idx >= 0;
                if (isEdit) {
                    arr[idx] = next;
                } else {
                    arr.push(next);
                }

                await this.setWeWorkRobotConfigs(arr);

                await new Promise(resolve => setTimeout(resolve, 300));

                this.renderWeWorkRobotSettingsList();
                this.renderWeWorkRobotSettingsForm(null, true);

                const successMessage = isEdit ? `✅ 机器人 "${next.name}" 已更新` : `✅ 机器人 "${next.name}" 已创建`;
                this.showNotification(successMessage, 'success');

            } catch (error) {
                console.error('保存企微机器人设置失败:', error);
                this.showNotification(`❌ 保存失败：${error.message || '未知错误'}`, 'error');
            } finally {
                saveBtn.dataset.loading = 'false';
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.renderWeWorkRobotSettingsForm(null, true);
        });

        form.appendChild(title);
        form.appendChild(row('机器人名称', nameInput));
        form.appendChild(row('图标', iconInput));
        form.appendChild(row('Webhook地址', webhookInput));
        form.appendChild(helpText);
        form.appendChild(btns);
        btns.appendChild(saveBtn);
        btns.appendChild(cancelBtn);
    }

    async getRoleConfigs() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['roleConfigs'], (result) => {
                resolve(Array.isArray(result.roleConfigs) ? result.roleConfigs : []);
            });
        });
    }

    async setRoleConfigs(configs) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ roleConfigs: configs }, () => resolve(true));
        });
    }

    // 企微机器人配置存储和读取
    async getWeWorkRobotConfigs() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['weWorkRobotConfigs'], (result) => {
                resolve(Array.isArray(result.weWorkRobotConfigs) ? result.weWorkRobotConfigs : []);
            });
        });
    }

    async setWeWorkRobotConfigs(configs) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ weWorkRobotConfigs: configs }, () => resolve(true));
        });
    }

    // 判断内容是否是 markdown 格式
    isMarkdownFormat(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // 检查常见的 markdown 语法特征
        const markdownPatterns = [
            /^#{1,6}\s+.+/m,                    // 标题 (# 标题)
            /\*\*[^*]+\*\*/,                    // 加粗 (**text**)
            /\*[^*]+\*/,                        // 斜体 (*text*)
            /\[.+\]\(.+\)/,                     // 链接 ([text](url))
            /`[^`]+`/,                          // 行内代码 (`code`)
            /```[\s\S]*?```/,                    // 代码块 (```code```)
            /^>\s+.+/m,                          // 引用 (> text)
            /^[-*+]\s+.+/m,                      // 无序列表 (- item)
            /^\d+\.\s+.+/m,                      // 有序列表 (1. item)
            /\[.+\]:\s*https?:\/\/.+/,          // 链接定义
            /<font\s+color=["'](info|comment|warning)["']>.+<\/font>/i, // 企微颜色标签
        ];

        // 如果匹配到任何一个 markdown 模式，认为是 markdown 格式
        return markdownPatterns.some(pattern => pattern.test(content));
    }

    // 调用 prompt 接口将内容转换为 markdown 格式
    async convertToMarkdown(content) {
        try {
            const systemPrompt = '你是一个专业的文本格式化助手。请将用户提供的内容转换为适合企业微信机器人的 markdown 格式。要求：\n1. 保持原意不变\n2. 使用合适的 markdown 语法（标题、加粗、列表等）\n3. 确保格式清晰易读\n4. 如果内容已经是 markdown 格式，直接返回原内容\n5. 输出纯 markdown 文本，不要添加任何解释';

            const userPrompt = `请将以下内容转换为 markdown 格式：\n\n${content}`;

            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            let result;

            // 处理流式响应
            if (responseText.includes('data: ')) {
                const lines = responseText.split('\n');
                let accumulatedData = '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            const chunk = JSON.parse(dataStr);
                            if (chunk.done === true) {
                                break;
                            }

                            if (chunk.data) {
                                accumulatedData += chunk.data;
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                accumulatedData += chunk.message.content;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }

                result = accumulatedData || content;
            } else {
                // 处理非流式响应
                try {
                    const jsonResult = JSON.parse(responseText);
                    if (jsonResult.status === 200 && jsonResult.data) {
                        result = jsonResult.data;
                    } else if (jsonResult.content) {
                        result = jsonResult.content;
                    } else if (jsonResult.message) {
                        result = jsonResult.message;
                    } else {
                        result = content; // 如果无法解析，使用原内容
                    }
                } catch (e) {
                    result = content; // 如果解析失败，使用原内容
                }
            }

            // 如果转换结果为空，使用原内容
            return (result && result.trim()) ? result.trim() : content;
        } catch (error) {
            console.error('转换为 markdown 失败:', error);
            // 转换失败时返回原内容
            return content;
        }
    }

    // 处理消息内容，通过 prompt 接口处理并返回 md 格式
    async processMessageForRobot(messageContent) {
        try {
            // 构建 system prompt，要求返回精简的 md 格式且严格不超过 4096 字符
            const systemPrompt = `你是一个内容精简专家。请将用户提供的消息内容进行**大幅精简和压缩**，并以 Markdown 格式返回。

**核心要求（必须严格遵守）：**
1. **长度限制是硬性要求**：最终输出内容（包括所有 Markdown 语法字符和表情符号）必须严格控制在 4096 字符以内，这是企业微信机器人的限制，超过会导致发送失败
2. **优先保留核心信息**：只保留最关键、最重要的信息，删除所有冗余、重复、次要的内容
3. **使用紧凑格式**：
   - 优先使用列表（有序/无序）而非段落
   - 使用标题层级（##、###）组织内容
   - 使用**加粗**突出关键点，避免冗长描述
   - 删除不必要的空行和装饰性内容
4. **精简策略**：
   - 合并相似内容，去除重复表达
   - 用关键词和短语替代完整句子
   - 删除示例、详细解释等非核心内容
   - 如果原内容过长，只保留摘要和要点
5. **格式要求**：
   - 如果原内容已经是 Markdown，大幅精简后保持格式
   - 如果原内容不是 Markdown，转换为精简的 Markdown 格式
   - 使用简洁的 Markdown 语法，避免复杂的嵌套结构
6. **表情符号使用（重要）**：
   - **适度使用表情符号**，让内容更生动有趣、更容易记忆
   - 在标题、关键点、重要信息处使用合适的表情符号
   - 常用表情符号语义映射：
     * 📋 报告/文档/总结
     * 📝 笔记/记录/要点
     * 💡 想法/建议/提示
     * 🔑 关键/核心/重点
     * ⚠️ 注意/警告/风险
     * ✅ 完成/成功/优势
     * ❌ 错误/问题/缺点
     * 📊 数据/统计/图表
     * 🎯 目标/目的/方向
     * 🚀 趋势/发展/提升
     * ⭐ 重要/亮点/推荐
     * 🔍 分析/研究/探索
     * 💬 观点/评论/讨论
     * 📌 标记/强调/固定
     * 🎉 庆祝/成就/好消息
     * 📈 增长/上升/积极
     * 📉 下降/减少/消极
     * 🔥 热门/紧急/重要
     * 💰 财务/成本/价值
     * 🎓 学习/教育/知识
     * ⏰ 时间/期限/计划
     * 🏆 成就/优秀/排名
     * 🌟 亮点/特色/突出
   - 表情符号使用原则：
     * 每个标题或关键点使用 1-2 个相关表情符号
     * 不要过度使用，保持内容简洁
     * 表情符号应该增强语义，而不是装饰

**重要提醒**：如果原内容很长，必须进行**大幅压缩**，只保留核心要点。宁可内容简短，也绝不能超过 4096 字符限制。表情符号的使用要适度，不能影响内容的精简。

请直接返回精简后的 Markdown 内容，不要添加任何说明文字、前缀或后缀。`;

            // 构建 userPrompt，添加精简和表情符号提示
            const userPrompt = `请将以下内容**大幅精简和压缩**为 Markdown 格式，确保最终输出严格控制在 4096 字符以内。

**要求**：
- 使用合适的表情符号让内容更生动有趣、更容易记忆
- 在标题、关键点、重要信息处添加相关表情符号
- 保持内容精简，表情符号要适度使用

内容：

${messageContent}`;

            // 构建 payload
            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 调用 prompt 接口
            const response = await fetch(PET_CONFIG.api.promptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            // 读取响应文本
            const responseText = await response.text();
            let result;

            // 检查是否包含SSE格式（包含 "data: "）
            if (responseText.includes('data: ')) {
                // 处理SSE流式响应
                const lines = responseText.split('\n');
                let accumulatedData = '';
                let lastValidData = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            // 尝试解析JSON
                            const chunk = JSON.parse(dataStr);

                            // 检查是否完成
                            if (chunk.done === true) {
                                break;
                            }

                            // 累积内容（处理流式内容块）
                            if (chunk.data) {
                                accumulatedData += chunk.data;
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                // Ollama格式
                                accumulatedData += chunk.message.content;
                            } else if (typeof chunk === 'string') {
                                accumulatedData += chunk;
                            }

                            // 保存最后一个有效的数据块
                            lastValidData = chunk;
                        } catch (e) {
                            // 如果不是JSON，可能是纯文本内容
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                accumulatedData += dataStr;
                            }
                        }
                    }
                }

                // 如果累积了内容，创建结果对象
                if (accumulatedData || lastValidData) {
                    if (lastValidData && lastValidData.status) {
                        result = {
                            ...lastValidData,
                            data: accumulatedData || lastValidData.data || '',
                            content: accumulatedData || lastValidData.content || ''
                        };
                    } else {
                        result = {
                            data: accumulatedData,
                            content: accumulatedData
                        };
                    }
                } else {
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析响应格式');
                    }
                }
            } else {
                // 非SSE格式，直接解析JSON
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    const sseMatch = responseText.match(/data:\s*({.+?})/s);
                    if (sseMatch) {
                        result = JSON.parse(sseMatch[1]);
                    } else {
                        throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                    }
                }
            }

            // 适配响应格式
            let content = '';
            if (result.data) {
                content = result.data;
            } else if (result.content) {
                content = result.content;
            } else if (result.message && result.message.content) {
                content = result.message.content;
            } else if (result.message && typeof result.message === 'string') {
                content = result.message;
            } else if (typeof result === 'string') {
                content = result;
            } else {
                content = JSON.stringify(result);
            }

            // 如果提取到了有效内容，去除 markdown 代码块标记
            if (content && content.trim()) {
                let cleanedContent = content.trim();

                // 去除开头的 ```markdown 或 ``` 标记
                cleanedContent = cleanedContent.replace(/^```(?:markdown)?\s*/i, '');

                // 去除结尾的 ``` 标记
                cleanedContent = cleanedContent.replace(/\s*```\s*$/, '');

                return cleanedContent.trim();
            } else if (result.status !== undefined && result.status !== 200) {
                const errorMsg = result.msg || '抱歉，服务器返回了错误。';
                throw new Error(errorMsg);
            } else if (result.msg && !content) {
                throw new Error(result.msg);
            } else {
                throw new Error('无法获取有效内容');
            }
        } catch (error) {
            console.error('处理消息内容失败:', error);
            throw error;
        }
    }

    // 限制 Markdown 内容长度，确保不超过指定字数
    limitMarkdownLength(content, maxLength) {
        // 不再限制内容长度，直接返回完整内容
        if (!content || typeof content !== 'string') {
            return '';
        }
        return content;
    }

    // 发送消息到企微机器人（通过 background script 避免 CORS 问题）
    async sendToWeWorkRobot(webhookUrl, content) {
        try {
            // 参数验证
            if (!webhookUrl || typeof webhookUrl !== 'string') {
                throw new Error('webhookUrl 参数无效');
            }

            if (!content || typeof content !== 'string') {
                throw new Error('content 参数无效');
            }

            // 检查内容是否是 markdown 格式
            let markdownContent = content;

            if (!this.isMarkdownFormat(content)) {
                // 如果不是 markdown 格式，先转换为 markdown
                console.log('[企微机器人] 内容不是 markdown 格式，正在转换为 markdown...');
                markdownContent = await this.convertToMarkdown(content);
                console.log(`[企微机器人] 转换后长度: ${markdownContent.length}`);
            }

            // 不再限制消息长度，发送完整内容

            // 通过 background script 发送请求，避免 CORS 问题
            const response = await chrome.runtime.sendMessage({
                action: 'sendToWeWorkRobot',
                webhookUrl: webhookUrl,
                content: markdownContent
            });

            if (!response || !response.success) {
                throw new Error(response?.error || '发送失败');
            }

            return response.result;
        } catch (error) {
            console.error('发送到企微机器人失败:', error);
            throw error;
        }
    }

    // 读取内置角色定义并转为默认配置（从已有配置中获取label、icon和prompt，如果没有则使用默认值）
    buildDefaultRoleConfigsFromBuiltins(existingConfigs = null) {
        const keys = ['summary', 'mindmap', 'flashcard', 'report', 'bestPractice'];
        const includeChartsMap = {
            summary: false,
            mindmap: true,
            flashcard: false,
            report: true,
            bestPractice: true
        };
        const arr = [];
        keys.forEach(k => {
            // 从已有配置中查找对应的label、icon和prompt
            let label = k; // 默认使用actionKey
            let icon = ''; // 默认icon为空，由用户配置
            let prompt = ''; // 默认prompt为空，由用户配置
            if (existingConfigs && Array.isArray(existingConfigs)) {
                const existing = existingConfigs.find(c => c && c.actionKey === k);
                if (existing) {
                    if (existing.label && typeof existing.label === 'string') {
                        const trimmedLabel = existing.label.trim();
                        if (trimmedLabel) {
                            label = trimmedLabel;
                        }
                    }
                    if (existing.icon && typeof existing.icon === 'string') {
                        const trimmedIcon = existing.icon.trim();
                        if (trimmedIcon) {
                            icon = trimmedIcon;
                        }
                    }
                    if (existing.prompt && typeof existing.prompt === 'string') {
                        const trimmedPrompt = existing.prompt.trim();
                        if (trimmedPrompt) {
                            prompt = trimmedPrompt;
                        }
                    }
                }
            }
            arr.push({
                id: 'builtin_' + k,
                label: label,
                actionKey: k,
                icon: icon,
                includeCharts: includeChartsMap[k] || false,
                prompt: prompt
            });
        });
        return arr;
    }

    // 确保默认角色已存在（仅在为空或缺少时补齐）
    async ensureDefaultRoleConfigs() {
        const existing = await this.getRoleConfigs();
        const defaults = this.buildDefaultRoleConfigsFromBuiltins(existing);
        if (!existing || existing.length === 0) {
            await this.setRoleConfigs(defaults);
            return true;
        }
        // 补齐缺失的内置项
        const haveKeys = new Set(existing.map(c => c.actionKey));
        let updated = false;
        defaults.forEach(d => {
            if (!haveKeys.has(d.actionKey)) {
                existing.push({
                    id: d.id,
                    label: d.label,
                    actionKey: d.actionKey,
                    icon: d.icon,
                    includeCharts: d.includeCharts,
                    prompt: d.prompt
                });
                updated = true;
            }
        });
        // 回填缺失图标（老数据兼容）
        for (const c of existing) {
            if ((!c.icon || !String(c.icon).trim()) && c.actionKey) {
                c.icon = this.getRoleIcon(c, existing);
                updated = true;
            }
        }
        if (updated) {
            await this.setRoleConfigs(existing);
        }
        return true;
    }

    async renderRoleSettingsList() {
        if (!this.chatWindow) return;
        const list = this.chatWindow.querySelector('#pet-role-list');
        if (!list) return;
        const configsRaw = await this.getRoleConfigs();
        list.innerHTML = '';

        // 先显示已绑定按钮的角色（按按钮顺序）
        // 使用 getOrderedBoundRoleKeys() 确保与 refreshWelcomeActionButtons() 顺序一致
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();
        for (const key of orderedKeys) {
            const config = (configsRaw || []).find(c => c && c.actionKey === key);
            if (config) {
                boundRoleIds.add(config.id);
                // 使用统一的角色信息获取函数获取标签
                const roleInfo = await this.getRoleInfoForAction(key);
                const row = this.createRoleListItem(config, roleInfo.label, configsRaw);
                list.appendChild(row);
            }
        }

        // 再显示其他角色（没有绑定按钮的角色）
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id));
        if (otherRoles.length > 0) {
            // 如果有已绑定的角色，添加分隔线
            if (orderedKeys.length > 0) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0; border-radius: 1px;';
                list.appendChild(separator);
            }

            otherRoles.forEach((config) => {
                const row = this.createRoleListItem(config, '', configsRaw);
                list.appendChild(row);
            });
        }

        // 如果没有任何角色
        if (list.children.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = '暂无可编辑角色。点击"新增角色"开始创建';
            empty.style.cssText = 'color: #64748b; font-size: 13px; padding: 24px 12px; text-align: center; line-height: 1.5;';
            list.appendChild(empty);
        }
    }

    // 创建角色列表项
    createRoleListItem(c, buttonLabel, allConfigs = null) {
        const row = document.createElement('div');
        row.style.cssText = `
            display:flex !important;
            align-items:center !important;
            justify-content: space-between !important;
            gap: 12px !important;
            padding: 12px !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            background: rgba(255,255,255,0.02) !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
        `;
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.borderColor = 'rgba(255,255,255,0.15)';
            row.style.transform = 'translateX(2px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'rgba(255,255,255,0.02)';
            row.style.borderColor = 'rgba(255,255,255,0.08)';
            row.style.transform = 'translateX(0)';
        });
        const info = document.createElement('div');
        info.style.cssText = 'display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;';
        const name = document.createElement('div');
        const displayIcon = this.getRoleIcon(c, allConfigs);
        name.textContent = `${displayIcon ? (displayIcon + ' ') : ''}${c.label || '(未命名)'}`;
        name.style.cssText = 'font-weight: 600; font-size: 13px; color: #fff; line-height: 1.4; word-break: break-word;';
        info.appendChild(name);
        if (buttonLabel && buttonLabel.trim()) {
            const sub = document.createElement('div');
            sub.textContent = buttonLabel;
            sub.style.cssText = 'color: #94a3b8; font-size: 11px; line-height: 1.3;';
            info.appendChild(sub);
        }

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:6px; flex-shrink:0;';
        const edit = document.createElement('button');
        edit.textContent = '编辑';
        edit.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        edit.addEventListener('mouseenter', () => {
            edit.style.background = 'rgba(59, 130, 246, 0.15)';
            edit.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            edit.style.color = '#60a5fa';
            edit.style.transform = 'translateY(-1px)';
        });
        edit.addEventListener('mouseleave', () => {
            edit.style.background = 'rgba(255,255,255,0.06)';
            edit.style.borderColor = 'rgba(255,255,255,0.15)';
            edit.style.color = '#e5e7eb';
            edit.style.transform = 'translateY(0)';
        });
        edit.addEventListener('click', () => this.renderRoleSettingsForm(c.id));
        const del = document.createElement('button');
        del.textContent = '删除';
        del.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        del.addEventListener('mouseenter', () => {
            del.style.background = 'rgba(239, 68, 68, 0.15)';
            del.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            del.style.color = '#f87171';
            del.style.transform = 'translateY(-1px)';
        });
        del.addEventListener('mouseleave', () => {
            del.style.background = 'rgba(255,255,255,0.06)';
            del.style.borderColor = 'rgba(255,255,255,0.15)';
            del.style.color = '#e5e7eb';
            del.style.transform = 'translateY(0)';
        });
        del.addEventListener('click', async () => {
            const next = (await this.getRoleConfigs()).filter(x => x.id !== c.id);
            await this.setRoleConfigs(next);
            this.renderRoleSettingsList();
            this.renderRoleSettingsForm(null, true); // 显示空白状态
            // 同步刷新欢迎消息下的动作按钮
            await this.refreshWelcomeActionButtons();
            // 刷新所有消息下的按钮
            await this.refreshAllMessageActionButtons();
        });
        btns.appendChild(edit);
        btns.appendChild(del);

        row.appendChild(info);
        row.appendChild(btns);
        return row;
    }

    async renderRoleSettingsForm(editId = null, showEmptyState = false) {
        if (!this.chatWindow) return;
        const form = this.chatWindow.querySelector('#pet-role-form');
        if (!form) return;
        const configsAll = await this.getRoleConfigs();
        // 用于查找已绑定按钮的角色列表（用于检查占用情况）
        const configs = (configsAll || []).filter(c => c && c.actionKey);
        // 当前编辑的角色（从所有角色中查找）
        const current = editId ? (configsAll || []).find(c => c && c.id === editId) : null;

        form.innerHTML = '';

        // 如果显示空白状态（没有选中角色且不是主动新增）
        if (showEmptyState && !editId && !current) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                height: 100% !important;
                padding: 40px 20px !important;
                text-align: center !important;
            `;

            const icon = document.createElement('div');
            icon.textContent = '👤';
            icon.style.cssText = `
                font-size: 64px !important;
                margin-bottom: 20px !important;
                opacity: 0.6 !important;
            `;

            const title = document.createElement('div');
            title.textContent = '选择一个角色开始编辑';
            title.style.cssText = `
                font-weight: 600 !important;
                font-size: 16px !important;
                color: #e5e7eb !important;
                margin-bottom: 8px !important;
            `;

            const desc = document.createElement('div');
            desc.textContent = '从左侧列表选择角色进行编辑，或点击"新增角色"创建新角色';
            desc.style.cssText = `
                font-size: 13px !important;
                color: #94a3b8 !important;
                line-height: 1.6 !important;
                max-width: 320px !important;
            `;

            const actionBtn = document.createElement('button');
            actionBtn.textContent = '新增角色';
            actionBtn.style.cssText = `
                margin-top: 24px !important;
                padding: 10px 24px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 8px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
            `;
            actionBtn.addEventListener('mouseenter', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.12)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                actionBtn.style.transform = 'translateY(-2px)';
            });
            actionBtn.addEventListener('mouseleave', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.06)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                actionBtn.style.transform = 'translateY(0)';
            });
            actionBtn.addEventListener('click', () => {
                this.renderRoleSettingsForm(null, false); // 显示新增表单
            });

            emptyState.appendChild(icon);
            emptyState.appendChild(title);
            emptyState.appendChild(desc);
            emptyState.appendChild(actionBtn);
            form.appendChild(emptyState);
            return;
        }

        const title = document.createElement('div');
        title.textContent = current ? '编辑角色' : '新增角色';
        title.style.cssText = 'font-weight: 600; font-size: 18px; color: #fff; margin-bottom: 4px;';

        const row = (labelText, inputEl) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
            const lab = document.createElement('label');
            lab.textContent = labelText;
            lab.style.cssText = 'font-size: 13px; font-weight: 500; color: #cbd5e1;';
            wrap.appendChild(lab);
            wrap.appendChild(inputEl);
            return wrap;
        };

        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = current?.label || '';
        nameInput.placeholder = '角色名称，如：会议纪要摘要';
        nameInput.style.cssText = `
            padding: 10px 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
        `;
        nameInput.addEventListener('focus', () => {
            nameInput.style.borderColor = 'rgba(255,255,255,0.25)';
            nameInput.style.background = '#1a1a1a';
        });
        nameInput.addEventListener('blur', () => {
            nameInput.style.borderColor = 'rgba(255,255,255,0.12)';
            nameInput.style.background = '#121212';
        });

        // 角色图标（可用 Emoji 或短文本）
        const iconInput = document.createElement('input');
        iconInput.type = 'text';
        iconInput.value = current?.icon || '';
        iconInput.placeholder = '图标（Emoji 或短文本，如：📝 / AI）';
        // 取消 maxLength，避免多码点 Emoji 被截断
        iconInput.style.cssText = `
            padding: 10px 12px !important;
            width: 80px !important;
            text-align: center !important;
            font-size: 18px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            transition: all 0.2s ease !important;
        `;
        iconInput.addEventListener('focus', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.25)';
            iconInput.style.background = '#1a1a1a';
        });
        iconInput.addEventListener('blur', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.12)';
            iconInput.style.background = '#121212';
        });

        // 图标预览与快捷选择
        const iconRow = document.createElement('div');
        iconRow.style.cssText = 'display:flex; align-items:center; gap:12px;';
        const iconPreview = document.createElement('div');
        iconPreview.textContent = iconInput.value || '🙂';
        iconPreview.style.cssText = `
            width: 48px !important;
            height: 48px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 10px !important;
            background: #121212 !important;
            color: #e5e7eb !important;
            font-size: 24px !important;
            flex-shrink: 0 !important;
        `;
        const emojiQuick = document.createElement('div');
        emojiQuick.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; margin-top: 4px;';
        const commonEmojis = ['📝','🧠','📚','📌','✅','💡','🔍','📄','🗂️','⭐'];
        commonEmojis.forEach(e => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = e;
            b.style.cssText = `
                width: 36px !important;
                height: 36px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.04) !important;
                color: #e5e7eb !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-size: 18px !important;
                transition: all 0.2s ease !important;
            `;
            b.addEventListener('mouseenter', () => {
                b.style.background = 'rgba(255,255,255,0.12)';
                b.style.borderColor = 'rgba(255,255,255,0.3)';
                b.style.transform = 'scale(1.1)';
            });
            b.addEventListener('mouseleave', () => {
                b.style.background = 'rgba(255,255,255,0.04)';
                b.style.borderColor = 'rgba(255,255,255,0.15)';
                b.style.transform = 'scale(1)';
            });
            b.addEventListener('click', () => {
                iconInput.value = e;
                iconPreview.textContent = e || '🙂';
            });
            emojiQuick.appendChild(b);
        });
        iconInput.addEventListener('input', () => {
            iconPreview.textContent = iconInput.value || '🙂';
        });

        // 去除“对应功能”下拉框

        // 已移除“生成内容包含图表（如 Mermaid）”选项

        const promptArea = document.createElement('textarea');
        promptArea.rows = 16;
        promptArea.placeholder = '提示语（可选）：为该角色的生成提供风格/结构指导';
        promptArea.value = current?.prompt || '';
        promptArea.style.cssText = `
            padding: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            resize: vertical !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            line-height: 1.5 !important;
            font-family: inherit !important;
            transition: all 0.2s ease !important;
            min-height: 200px !important;
        `;
        promptArea.addEventListener('focus', () => {
            promptArea.style.borderColor = 'rgba(255,255,255,0.25)';
            promptArea.style.background = '#1a1a1a';
        });
        promptArea.addEventListener('blur', () => {
            promptArea.style.borderColor = 'rgba(255,255,255,0.12)';
            promptArea.style.background = '#121212';
        });

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(34, 197, 94, 0.3) !important;
            background: rgba(34, 197, 94, 0.15) !important;
            color: #4ade80 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.25)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
            saveBtn.style.transform = 'translateY(-1px)';
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.15)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            saveBtn.style.transform = 'translateY(0)';
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.12)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            cancelBtn.style.transform = 'translateY(-1px)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.06)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            cancelBtn.style.transform = 'translateY(0)';
        });

        // 提取首个“可见字符”的简易函数（优先保留完整 Emoji）
        const getSafeIcon = (raw) => {
            try {
                if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
                    const it = seg.segment(raw);
                    const first = it[Symbol.iterator]().next();
                    return first && first.value ? first.value.segment : raw.trim();
                }
            } catch (_) {}
            return raw.trim();
        };

        saveBtn.addEventListener('click', async () => {
            // 保存按钮加载状态
            const originalText = saveBtn.textContent;
            const isLoading = saveBtn.dataset.loading === 'true';
            if (isLoading) return; // 防止重复点击

            // 设置加载状态
            saveBtn.dataset.loading = 'true';
            saveBtn.textContent = '保存中...';
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.style.cursor = 'not-allowed';

            // 保存加载状态样式（如果还没有）
            if (!document.getElementById('role-save-loading-styles')) {
                const loadingStyle = document.createElement('style');
                loadingStyle.id = 'role-save-loading-styles';
                loadingStyle.textContent = `
                    @keyframes roleSavePulse {
                        0%, 100% { opacity: 0.7; }
                        50% { opacity: 1; }
                    }
                    button[data-loading="true"] {
                        animation: roleSavePulse 1.5s ease-in-out infinite !important;
                    }
                `;
                document.head.appendChild(loadingStyle);
            }

            try {
                const next = {
                    id: current?.id || ('r_' + Math.random().toString(36).slice(2, 10)),
                    label: nameInput.value.trim() || '未命名角色',
                    actionKey: current?.actionKey || '',
                    includeCharts: current?.includeCharts ?? false,
                    icon: (iconInput.value.trim() === '' ? (current?.icon || '') : getSafeIcon(iconInput.value)),
                    prompt: promptArea.value.trim(),
                };

                const arr = await this.getRoleConfigs();

                // 更新或添加角色
                const idx = arr.findIndex(x => x.id === next.id);
                const isEdit = idx >= 0;
                if (isEdit) {
                    arr[idx] = next;
                } else {
                    arr.push(next);
                }

                await this.setRoleConfigs(arr);

                // 短暂延迟以提供更好的视觉反馈
                await new Promise(resolve => setTimeout(resolve, 300));

                // 刷新界面
                this.renderRoleSettingsList();
                this.renderRoleSettingsForm(null, true); // 显示空白状态
                // 同步刷新欢迎消息下的动作按钮
                await this.refreshWelcomeActionButtons();
                // 刷新所有消息下的按钮
                await this.refreshAllMessageActionButtons();

                // 显示成功提示
                const successMessage = isEdit ? `✅ 角色 "${next.label}" 已更新` : `✅ 角色 "${next.label}" 已创建`;
                this.showNotification(successMessage, 'success');

            } catch (error) {
                console.error('保存角色设置失败:', error);
                this.showNotification(`❌ 保存失败：${error.message || '未知错误'}`, 'error');
            } finally {
                // 恢复按钮状态
                saveBtn.dataset.loading = 'false';
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.renderRoleSettingsForm(null, true); // 显示空白状态
        });

        form.appendChild(title);
        form.appendChild(row('角色名称', nameInput));
        // 图标设置区：预览 + 输入 + 快选
        const iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
        const iconLabel = document.createElement('label');
        iconLabel.textContent = '图标';
        iconLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: #cbd5e1;';
        const iconRowOuter = document.createElement('div');
        iconRowOuter.style.cssText = 'display:flex; align-items:center; gap:10px;';
        iconRowOuter.appendChild(iconPreview);
        iconRowOuter.appendChild(iconInput);
        iconWrap.appendChild(iconLabel);
        iconWrap.appendChild(iconRowOuter);
        iconWrap.appendChild(emojiQuick);
        form.appendChild(iconWrap);
        form.appendChild(row('提示语', promptArea));
        form.appendChild(btns);
        btns.appendChild(saveBtn);
        btns.appendChild(cancelBtn);
    }

    // 动态更新上下文覆盖层的位置与尺寸，避免遮挡 chat-header
    updateContextEditorPosition() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-context-editor');
        if (!overlay) return;
        const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
        const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
        overlay.style.top = headerH + 'px';
        overlay.style.left = '0px';
        overlay.style.right = '0px';
        overlay.style.bottom = '0px';
    }

    /**
     * 从当前网页拉取上下文并更新编辑器
     * @returns {Promise<void>}
     */
    async refreshContextFromPage() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) {
            throw new Error('未找到上下文编辑器');
        }

        try {
            // 获取当前网页渲染后的 HTML 内容并转换为 Markdown
            const pageContent = this.getRenderedHTMLAsMarkdown();

            // 更新编辑器内容
            textarea.value = pageContent || '';

            // 更新预览
            this.updateContextPreview();

            // 如果当前有会话，也更新会话中的页面内容
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const pageTitle = document.title || '当前页面';
                const session = this.sessions[this.currentSessionId];
                session.pageContent = pageContent;
                session.pageTitle = pageTitle;
                // 更新会话时间戳，确保保存逻辑识别到变化
                session.updatedAt = Date.now();
                session.lastAccessTime = Date.now();
                // 静默保存，不显示提示（同步到后端）
                this.saveAllSessions(true, true).catch(err => {
                    console.error('自动保存更新的上下文失败:', err);
                });
            }
        } catch (error) {
            console.error('拉取网页上下文失败:', error);
            throw error;
        }
    }

    /**
     * 获取当前网页渲染后的 HTML 内容并转换为 Markdown
     * 该方法专门用于刷新按钮功能，确保获取最新的渲染内容
     */
    getRenderedHTMLAsMarkdown() {
        try {
            // 检查 Turndown 是否可用
            if (typeof TurndownService === 'undefined') {
                console.warn('Turndown 未加载，返回纯文本内容');
                return this.getFullPageText();
            }

            // 定义需要排除的选择器
            const excludeSelectors = [
                'script', 'style', 'noscript', 'iframe', 'embed', 'object',
                'svg', 'canvas', 'video', 'audio',
                '.ad', '.advertisement', '.ads', '.advertisement-container',
                '[class*="ad-"]', '[class*="banner"]', '[class*="promo"]',
                '[id*="ad-"]', '[id*="banner"]', '[id*="promo"]',
                'nav', 'header', 'footer', 'aside',
                '.sidebar', '.menu', '.navigation', '.navbar', '.nav',
                '.header', '.footer', '.comment', '.comments', '.social-share',
                '.related-posts', '.related', '.widget', '.sidebar-widget',
                // 排除插件相关元素
                `#${(typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ids) ? PET_CONFIG.constants.ids.assistantElement : 'chat-assistant-element'}`, '[id^="pet-"]', '[class*="pet-"]',
                '[id*="pet-chat"]', '[class*="pet-chat"]',
                '[id*="pet-context"]', '[class*="pet-context"]',
                '[id*="pet-faq"]', '[class*="pet-faq"]',
                '[id*="pet-api"]', '[class*="pet-api"]',
                '[id*="pet-session"]', '[class*="pet-session"]'
            ];

            // 定义主要正文内容选择器（优先级从高到低）
            const contentSelectors = [
                'article',
                'main',
                '[role="main"]',
                '[role="article"]',
                '.post-content', '.entry-content', '.article-content',
                '.post-body', '.article-body', '.text-content',
                '.content', '.main-content', '.page-content',
                '.article', '.blog-post', '.entry', '.post',
                '#content', '#main-content', '#main',
                '.content-area', '.content-wrapper',
                '.text-wrapper', '.text-container'
            ];

            // 尝试从主要内容区域获取渲染后的 HTML
            let mainContent = null;
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim().length > 100) {
                    mainContent = element;
                    break;
                }
            }

            // 如果没有找到主要内容区域，使用 body（但排除导航、侧边栏等）
            if (!mainContent) {
                mainContent = document.body;
            }

            // 深度克隆内容，保留所有渲染后的属性和状态
            const cloned = mainContent.cloneNode(true);

            // 移除不需要的元素
            excludeSelectors.forEach(sel => {
                try {
                    const elements = cloned.querySelectorAll(sel);
                    elements.forEach(el => {
                        if (el && el.parentNode) {
                            el.parentNode.removeChild(el);
                        }
                    });
                } catch (e) {
                    console.warn('移除元素失败:', sel, e);
                }
            });

            // 配置 Turndown 服务
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                hr: '---',
                bulletListMarker: '-',
                codeBlockStyle: 'fenced',
                fence: '```',
                emDelimiter: '_',
                strongDelimiter: '**',
                linkStyle: 'inlined',
                linkReferenceStyle: 'full',
                preformattedCode: true
            });

            // 添加自定义规则，更好地处理特殊元素
            turndownService.addRule('preserveLineBreaks', {
                filter: ['br'],
                replacement: () => '\n'
            });

            // 转换为 Markdown
            let markdown = turndownService.turndown(cloned);

            // 清理多余的空行（保留双空行用于段落分隔）
            markdown = markdown
                .replace(/\n{4,}/g, '\n\n\n')  // 最多保留三个换行（两个空行）
                .trim();

            // 如果 Markdown 内容太短或为空，尝试获取纯文本
            if (!markdown || markdown.trim().length < 50) {
                console.warn('Markdown 内容过短，尝试获取纯文本');
                const textContent = cloned.textContent || cloned.innerText || '';
                return textContent.trim();
            }

            return markdown;
        } catch (error) {
            console.error('将渲染后的 HTML 转换为 Markdown 时出错:', error);
            // 出错时返回纯文本
            return this.getFullPageText();
        }
    }

    /**
     * 处理手动保存会话（从欢迎消息按钮触发）
     * @param {HTMLElement} button - 保存按钮元素
     */
    async handleManualSaveSession(button) {
        if (!this.currentSessionId) {
            console.warn('当前没有活动会话');
            this._showManualSaveStatus(button, false);
            return;
        }

        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在');
            this._showManualSaveStatus(button, false);
            return;
        }

        // 获取按钮元素
        const iconEl = button.querySelector('.save-btn-icon');
        const textEl = button.querySelector('.save-btn-text');
        const loaderEl = button.querySelector('.save-btn-loader');

        try {
            // 设置 loading 状态
            button.disabled = true;
            button.classList.add('loading');
            // 隐藏图标和文本，显示 loader
            if (iconEl) {
                iconEl.style.opacity = '0';
                iconEl.style.display = 'none';
            }
            if (textEl) {
                textEl.style.opacity = '0';
                textEl.textContent = '保存中...';
            }
            if (loaderEl) {
                loaderEl.style.display = 'block';
            }

            const session = this.sessions[this.currentSessionId];

            // 获取当前页面内容并更新到会话
            const pageContent = this.getPageContentAsMarkdown();
            session.pageContent = pageContent || '';

            // 更新页面信息（确保信息是最新的）
            // 优先保留会话的 pageTitle（如果已有有效标题），避免覆盖从后端加载的标题
            const pageInfo = this.getPageInfo();
            const currentPageTitle = pageInfo.title || pageInfo.pageTitle || document.title || '当前页面';
            const sessionPageTitle = session.pageTitle || session.title || '';
            const isDefaultTitle = !sessionPageTitle ||
                                  sessionPageTitle.trim() === '' ||
                                  sessionPageTitle === '未命名会话' ||
                                  sessionPageTitle === '新会话' ||
                                  sessionPageTitle === '未命名页面' ||
                                  sessionPageTitle === '当前页面';

            // 只有当标题是默认值时才更新，否则保留原有标题
            session.pageTitle = isDefaultTitle ? currentPageTitle : sessionPageTitle;
            session.pageDescription = pageInfo.description || session.pageDescription || '';
            session.url = pageInfo.url || session.url || window.location.href;

            // 更新会话时间戳
            session.updatedAt = Date.now();
            session.lastAccessTime = Date.now();

            // 先保存到本地存储
            await this.saveAllSessions(true, true);

            // 手动保存时，同步到后端并包含 pageContent 字段
            await this.syncSessionToBackend(this.currentSessionId, true, true);

            // 将会话ID添加到后端会话ID集合中（表示已保存到后端）
            // 注意：必须在刷新欢迎消息之前添加，确保 isSessionInBackendList 能正确检查
            this.backendSessionIds.add(this.currentSessionId);

            // 确保会话ID已添加到集合中（防止异步问题）
            if (!this.backendSessionIds.has(this.currentSessionId)) {
                this.backendSessionIds.add(this.currentSessionId);
            }

            // 刷新欢迎消息以隐藏保存按钮（因为现在已存在于后端列表中）
            await this.refreshWelcomeMessage();

            // 显示成功状态
            this._showManualSaveStatus(button, true);

            console.log('会话已手动保存:', this.currentSessionId);
        } catch (error) {
            console.error('手动保存会话失败:', error);
            this._showManualSaveStatus(button, false);
        }
    }

    /**
     * 显示手动保存按钮的状态
     * @param {HTMLElement} button - 按钮元素
     * @param {boolean} success - 是否成功
     */
    _showManualSaveStatus(button, success) {
        const iconEl = button.querySelector('.save-btn-icon');
        const textEl = button.querySelector('.save-btn-text');
        const loaderEl = button.querySelector('.save-btn-loader');

        // 移除 loading 状态
        button.classList.remove('loading');
        if (loaderEl) loaderEl.style.display = 'none';

        if (success) {
            // 成功状态
            button.classList.add('success');
            button.classList.remove('error');
            if (iconEl) {
                iconEl.textContent = '✓';
                iconEl.style.display = 'inline-flex';
            }
            if (textEl) textEl.textContent = '已保存';
        } else {
            // 失败状态
            button.classList.add('error');
            button.classList.remove('success');
            if (iconEl) {
                iconEl.textContent = '✕';
                iconEl.style.display = 'inline-flex';
            }
            if (textEl) textEl.textContent = '保存失败';
        }

        // 2.5秒后恢复按钮状态
        setTimeout(() => {
            button.disabled = false;
            button.classList.remove('success', 'error');
            if (iconEl) {
                iconEl.textContent = '💾';
                iconEl.style.display = 'inline-flex';
            }
            if (textEl) textEl.textContent = '保存会话';
        }, 2500);
    }

    /**
     * 保存页面上下文编辑器内容到会话
     * @returns {Promise<boolean>} 保存是否成功
     */
    async saveContextEditor() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) {
            console.warn('未找到上下文编辑器');
            return false;
        }

        if (!this.currentSessionId) {
            console.warn('当前没有活动会话');
            return false;
        }

        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在');
            return false;
        }

        try {
            const editedContent = textarea.value || '';
            const session = this.sessions[this.currentSessionId];

            // 更新页面内容
            session.pageContent = editedContent;
            // 更新会话时间戳，确保保存逻辑识别到变化
            session.updatedAt = Date.now();
            session.lastAccessTime = Date.now();

            // 如果页面标题还没有设置，同时更新页面标题
            if (!session.pageTitle || session.pageTitle === '当前页面') {
                session.pageTitle = document.title || '当前页面';
            }

            // 异步保存到存储（同步到后端）
            await this.saveAllSessions(true, true);

            // 手动保存页面上下文时，需要同步到后端并包含 pageContent 字段
            await this.syncSessionToBackend(this.currentSessionId, true, true);

            console.log('页面上下文已保存到会话:', this.currentSessionId);
            return true;
        } catch (error) {
            console.error('保存页面上下文失败:', error);
            return false;
        }
    }

    /**
     * 显示保存状态提示
     * @param {HTMLElement} button - 保存按钮元素
     * @param {boolean} success - 是否成功
     * @param {string} originalText - 原始按钮文本（可选，默认使用 '保存'）
     */
    _showSaveStatus(button, success, originalText = '保存') {
        const originalBackground = button.style.background;
        const originalColor = button.style.color;

        if (success) {
            button.textContent = '✓ 已保存';
            button.style.background = 'rgba(76, 175, 80, 0.2)';
            button.style.color = '#4caf50';
            button.style.borderColor = 'rgba(76, 175, 80, 0.4)';
        } else {
            button.textContent = '✕ 保存失败';
            button.style.background = 'rgba(244, 67, 54, 0.2)';
            button.style.color = '#f44336';
            button.style.borderColor = 'rgba(244, 67, 54, 0.4)';
        }

        // 2秒后恢复原状态
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalBackground;
            button.style.color = originalColor;
            button.style.borderColor = 'rgba(255,255,255,0.15)';
        }, 2000);
    }

    // 复制页面上下文编辑器内容
    copyContextEditor() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;

        const content = textarea.value || '';
        if (!content.trim()) return;

        // 复制到剪贴板
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            // 显示复制成功反馈
            const copyBtn = this.chatWindow ? this.chatWindow.querySelector('#pet-context-copy-btn') : null;
            if (copyBtn) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制';
                copyBtn.style.background = 'rgba(76, 175, 80, 0.3)';
                copyBtn.style.color = '#4caf50';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'rgba(255,255,255,0.04)';
                    copyBtn.style.color = '#e5e7eb';
                }, 1500);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }

        document.body.removeChild(textArea);
    }

    downloadContextMarkdown() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;
        const content = textarea.value || '';
        const title = (document.title || 'page').replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        const filename = `${title}_${stamp}.md`;
        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                if (a.parentNode) a.parentNode.removeChild(a);
            }, 0);
        } catch (e) {
            // 忽略下载错误
        }
    }


    loadContextIntoEditor() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        if (!textarea) return;
        try {
            // 优先使用会话保存的页面内容
            let md = '';
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                // 如果会话的pageContent字段为空，则弹框内容也为空
                md = (session.pageContent && session.pageContent.trim() !== '') ? session.pageContent : '';
            } else {
                md = this.getPageContentAsMarkdown();
            }
            textarea.value = md || '';
        } catch (e) {
            textarea.value = '获取页面上下文失败。';
        }
    }

    updateContextPreview() {
        const textarea = this.chatWindow ? this.chatWindow.querySelector('#pet-context-editor-textarea') : null;
        const preview = this.chatWindow ? this.chatWindow.querySelector('#pet-context-preview') : null;
        if (!textarea || !preview) return;
        const markdown = textarea.value || '';
        // 使用已存在的 Markdown 渲染
        preview.innerHTML = this.renderMarkdown(markdown);
        // 渲染 mermaid（若有）- 防抖，避免频繁触发
        if (preview._mermaidTimer) {
            clearTimeout(preview._mermaidTimer);
            preview._mermaidTimer = null;
        }
        preview._mermaidTimer = setTimeout(async () => {
            await this.processMermaidBlocks(preview);
            preview._mermaidTimer = null;
        }, 200);
    }

    // 初始化聊天滚动功能
    initializeChatScroll() {
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
            }, { passive: true });
        }
    }

    // 更新聊天窗口中的模型选择器显示

    // 创建聊天窗口
    async createChatWindow() {
        // 注意：chatWindowState 已在 openChatWindow() 中初始化

        // 创建聊天窗口容器
        this.chatWindow = document.createElement('div');
        this.chatWindow.id = 'pet-chat-window';
        this.updateChatWindowStyle();

        // 根据宠物颜色获取当前主题色调
        const currentColor = this.colors[this.colorIndex];
        // 提取主色调作为边框颜色
        const getMainColor = (gradient) => {
            const match = gradient.match(/#[0-9a-fA-F]{6}/);
            return match ? match[0] : '#3b82f6';
        };
        const mainColor = getMainColor(currentColor);

        // 创建聊天头部（拖拽区域）- 使用宠物颜色主题
        const chatHeader = document.createElement('div');
        chatHeader.className = 'chat-header';
        chatHeader.style.cssText = `
            background: ${currentColor} !important;
            color: white !important;
            padding: 15px 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            cursor: move !important;
            user-select: none !important;
            border-radius: 16px 16px 0 0 !important;
            transition: background 0.2s ease !important;
        `;

        // 添加拖拽提示
        chatHeader.title = '拖拽移动窗口 | 双击全屏';

        const headerTitle = document.createElement('div');
        headerTitle.className = 'chat-header-title';
        headerTitle.id = 'pet-chat-header-title';
        headerTitle.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        `;

        // 创建标题内容
        const titleContent = document.createElement('div');
        titleContent.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
        `;
        titleContent.innerHTML = `
            <span style="font-size: 20px;">💕</span>
            <span id="pet-chat-header-title-text" style="font-weight: 600; font-size: 16px;">与我聊天</span>
        `;
        headerTitle.appendChild(titleContent);

        // 创建折叠侧边栏按钮（将放在侧边栏右侧垂直居中位置，参考输入框折叠按钮的样式）
        let toggleSidebarBtn = document.createElement('button');
        toggleSidebarBtn.id = 'sidebar-toggle-btn';
        toggleSidebarBtn.innerHTML = '<span class="toggle-icon">◀</span>';
        toggleSidebarBtn.title = '折叠侧边栏';
        toggleSidebarBtn.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            transform: translateY(-50%) translateX(14px) !important;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85)) !important;
            border: 1px solid rgba(229, 231, 235, 0.8) !important;
            color: #374151 !important;
            font-size: 14px !important;
            cursor: pointer !important;
            padding: 0 !important;
            border-radius: 50% !important;
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            z-index: 5 !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            opacity: 0.9 !important;
        `;
        const sidebarIcon = toggleSidebarBtn.querySelector('.toggle-icon');
        if (sidebarIcon) {
            sidebarIcon.style.cssText = `
                display: inline-block !important;
                transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            `;
        }
        toggleSidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，避免触发拖拽
            // 添加点击动画反馈
            toggleSidebarBtn.style.transform = 'translateY(-50%) translateX(14px) scale(0.9)';
            setTimeout(() => {
                toggleSidebarBtn.style.transform = 'translateY(-50%) translateX(14px) scale(1)';
            }, 150);
            this.toggleSidebar();
        });
        toggleSidebarBtn.addEventListener('mouseenter', () => {
            toggleSidebarBtn.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(249, 250, 251, 0.95))';
            toggleSidebarBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
            toggleSidebarBtn.style.transform = 'translateY(-50%) translateX(14px) scale(1.1)';
            toggleSidebarBtn.style.opacity = '1';
            if (sidebarIcon) {
                sidebarIcon.style.transform = 'scale(1.15)';
            }
        });
        toggleSidebarBtn.addEventListener('mouseleave', () => {
            toggleSidebarBtn.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))';
            toggleSidebarBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)';
            toggleSidebarBtn.style.transform = 'translateY(-50%) translateX(14px) scale(1)';
            toggleSidebarBtn.style.opacity = '0.9';
            if (sidebarIcon) {
                sidebarIcon.style.transform = 'scale(1)';
            }
        });
        toggleSidebarBtn.addEventListener('mousedown', () => {
            toggleSidebarBtn.style.transform = 'translateY(-50%) translateX(14px) scale(0.95)';
        });
        toggleSidebarBtn.addEventListener('mouseup', () => {
            toggleSidebarBtn.style.transform = 'translateY(-50%) translateX(14px) scale(1.1)';
        });

        // 创建折叠输入框容器按钮（将放在输入框上方水平居中位置）
        let toggleInputContainerBtn = document.createElement('button');
        toggleInputContainerBtn.id = 'input-container-toggle-btn';
        toggleInputContainerBtn.innerHTML = '<span class="toggle-icon">▼</span>';
        toggleInputContainerBtn.title = '折叠输入框';
        toggleInputContainerBtn.style.cssText = `
            position: absolute !important;
            bottom: 100% !important;
            left: 50% !important;
            transform: translateX(-50%) translateY(-8px) !important;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85)) !important;
            border: 1px solid rgba(229, 231, 235, 0.8) !important;
            color: #374151 !important;
            font-size: 14px !important;
            cursor: pointer !important;
            padding: 0 !important;
            border-radius: 50% !important;
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            z-index: 5 !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            opacity: 0.9 !important;
        `;
        const inputIcon = toggleInputContainerBtn.querySelector('.toggle-icon');
        if (inputIcon) {
            inputIcon.style.cssText = `
                display: inline-block !important;
                transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            `;
        }
        toggleInputContainerBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，避免触发拖拽
            // 添加点击动画反馈
            toggleInputContainerBtn.style.transform = 'translateX(-50%) translateY(-8px) scale(0.9)';
            setTimeout(() => {
                toggleInputContainerBtn.style.transform = 'translateX(-50%) translateY(-8px) scale(1)';
            }, 150);
            this.toggleInputContainer();
        });
        toggleInputContainerBtn.addEventListener('mouseenter', () => {
            toggleInputContainerBtn.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(249, 250, 251, 0.95))';
            toggleInputContainerBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
            toggleInputContainerBtn.style.transform = 'translateX(-50%) translateY(-8px) scale(1.1)';
            toggleInputContainerBtn.style.opacity = '1';
            if (inputIcon) {
                inputIcon.style.transform = 'scale(1.15)';
            }
        });
        toggleInputContainerBtn.addEventListener('mouseleave', () => {
            toggleInputContainerBtn.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))';
            toggleInputContainerBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)';
            toggleInputContainerBtn.style.transform = 'translateX(-50%) translateY(-8px) scale(1)';
            toggleInputContainerBtn.style.opacity = '0.9';
            if (inputIcon) {
                inputIcon.style.transform = 'scale(1)';
            }
        });
        toggleInputContainerBtn.addEventListener('mousedown', () => {
            toggleInputContainerBtn.style.transform = 'translateX(-50%) translateY(-8px) scale(0.95)';
        });
        toggleInputContainerBtn.addEventListener('mouseup', () => {
            toggleInputContainerBtn.style.transform = 'translateX(-50%) translateY(-8px) scale(1.1)';
        });

        // 创建按钮容器（用于放置 authBtn、refreshBtn 和 closeBtn）
        const headerButtons = document.createElement('div');
        headerButtons.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
        `;

        // 创建 API 鉴权按钮
        const authBtn = document.createElement('button');
        authBtn.id = 'pet-chat-auth-btn';
        authBtn.className = 'pet-chat-header-btn';
        authBtn.setAttribute('aria-label', 'API 鉴权');
        authBtn.setAttribute('title', 'API 鉴权（X-Token）');
        authBtn.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; fill: currentColor;">
                <path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V8a3 3 0 0 0-6 0v2Zm3 4a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1Z"/>
            </svg>
        `;
        authBtn.style.cssText = `
            background: none !important;
            border: none !important;
            color: white !important;
            font-size: 18px !important;
            cursor: pointer !important;
            padding: 5px !important;
            border-radius: 10px !important;
            width: 36px !important;
            height: 36px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.3s ease !important;
        `;
        authBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAuth();
        });
        authBtn.addEventListener('mouseenter', () => {
            authBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        authBtn.addEventListener('mouseleave', () => {
            authBtn.style.background = 'none';
        });

        // 创建刷新按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'pet-chat-refresh-btn';
        refreshBtn.className = 'pet-chat-header-btn pet-chat-refresh-btn';
        refreshBtn.setAttribute('aria-label', '刷新');
        refreshBtn.setAttribute('title', '刷新');
        refreshBtn.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; fill: currentColor;">
                <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 19 12c0-1.93-.78-3.68-2.05-4.95Z"/>
            </svg>
        `;
        refreshBtn.style.cssText = `
            background: none !important;
            border: none !important;
            color: white !important;
            font-size: 18px !important;
            cursor: pointer !important;
            padding: 5px !important;
            border-radius: 10px !important;
            width: 36px !important;
            height: 36px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.3s ease !important;
        `;
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.manualRefresh();
        });
        refreshBtn.addEventListener('mouseenter', () => {
            refreshBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        refreshBtn.addEventListener('mouseleave', () => {
            refreshBtn.style.background = 'none';
        });

        // 创建关闭按钮（保持在右侧）
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none !important;
            border: none !important;
            color: white !important;
            font-size: 18px !important;
            cursor: pointer !important;
            padding: 5px !important;
            border-radius: 50% !important;
            width: 30px !important;
            height: 30px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.3s ease !important;
        `;
        closeBtn.addEventListener('click', () => this.closeChatWindow());
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });

        // 将按钮添加到按钮容器
        headerButtons.appendChild(authBtn);
        headerButtons.appendChild(refreshBtn);
        headerButtons.appendChild(closeBtn);

        chatHeader.appendChild(headerTitle);
        chatHeader.appendChild(headerButtons);

        // 创建主内容容器（包含侧边栏和消息区域）
        const mainContentContainer = document.createElement('div');
        mainContentContainer.style.cssText = `
            display: flex !important;
            flex: 1 !important;
            overflow: hidden !important;
            background: linear-gradient(135deg, #f8f9fa, #ffffff) !important;
            position: relative !important;
        `;

        // 创建会话侧边栏
        // 加载保存的侧边栏宽度和折叠状态
        this.loadSidebarWidth();
        this.loadSidebarCollapsed();
        // 加载输入框容器折叠状态
        this.loadInputContainerCollapsed();
        // 加载日历折叠状态
        this.loadCalendarCollapsed();

        this.sessionSidebar = document.createElement('div');
        this.sessionSidebar.className = 'session-sidebar';
        this.sessionSidebar.style.cssText = `
            width: ${this.sidebarWidth}px !important;
            min-width: 150px !important;
            max-width: 500px !important;
            background: white !important;
            border-right: 1px solid #e5e7eb !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            position: relative !important;
            resize: none !important;
        `;

        // 侧边栏标题容器
        const sidebarHeader = document.createElement('div');
        sidebarHeader.style.cssText = `
            padding: 12px 15px !important;
            border-bottom: 1px solid #e5e7eb !important;
            background: #f9fafb !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
        `;

        // 第一行：搜索输入框和OSS切换按钮
        const firstRow = document.createElement('div');
        firstRow.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            width: 100% !important;
        `;

        // 第二行：其他操作按钮
        const secondRow = document.createElement('div');
        secondRow.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            width: 100% !important;
            flex-wrap: wrap !important;
        `;

        // 创建左侧按钮组（批量、导出、导入）
        const leftButtonGroup = document.createElement('div');
        leftButtonGroup.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            flex: 1 !important;
        `;

        // 创建搜索输入框容器（带图标和清除按钮）
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = `
            position: relative !important;
            flex: 1 !important;
            display: flex !important;
            align-items: center !important;
        `;

        // 搜索图标
        const searchIcon = document.createElement('span');
        searchIcon.textContent = '🔍';
        searchIcon.style.cssText = `
            position: absolute !important;
            left: 10px !important;
            font-size: 14px !important;
            pointer-events: none !important;
            z-index: 1 !important;
            opacity: 0.5 !important;
            transition: opacity 0.2s ease !important;
        `;

        // 创建搜索输入框
        const sidebarTitle = document.createElement('input');
        sidebarTitle.type = 'text';
        sidebarTitle.placeholder = '搜索会话...';
        sidebarTitle.value = this.sessionTitleFilter || '';
        sidebarTitle.id = 'session-search-input';
        sidebarTitle.style.cssText = `
            width: 100% !important;
            font-weight: 400 !important;
            font-size: 13px !important;
            color: #374151 !important;
            padding: 8px 32px 8px 32px !important;
            border: 1.5px solid #e5e7eb !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            outline: none !important;
            transition: all 0.2s ease !important;
            box-sizing: border-box !important;
        `;

        // 添加占位符样式（通过动态样式表）
        if (!document.getElementById('session-search-placeholder-style')) {
            const style = document.createElement('style');
            style.id = 'session-search-placeholder-style';
            style.textContent = `
                #session-search-input::placeholder {
                    color: #9ca3af !important;
                    opacity: 1 !important;
                }
                #session-search-input:focus::placeholder {
                    color: #d1d5db !important;
                }
            `;
            document.head.appendChild(style);
        }

        // 清除按钮
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '✕';
        clearBtn.type = 'button';
        clearBtn.style.cssText = `
            position: absolute !important;
            right: 6px !important;
            width: 20px !important;
            height: 20px !important;
            border: none !important;
            background: #e5e7eb !important;
            color: #6b7280 !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 12px !important;
            padding: 0 !important;
            transition: all 0.2s ease !important;
            z-index: 2 !important;
            line-height: 1 !important;
        `;

        // 更新清除按钮显示状态
        const updateClearButton = () => {
            if (sidebarTitle.value.trim() !== '') {
                clearBtn.style.display = 'flex';
                searchIcon.style.opacity = '0.3';
            } else {
                clearBtn.style.display = 'none';
                searchIcon.style.opacity = '0.5';
            }
        };

        // 初始状态
        updateClearButton();

        // 清除按钮点击事件
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebarTitle.value = '';
            this.sessionTitleFilter = '';
            updateClearButton();
            // 根据当前模式决定更新哪个列表
            if (this.apiRequestListVisible) {
                // 已移除：API请求列表视图功能
            } else {
                this.updateSessionSidebar();
            }
            sidebarTitle.focus();
        });

        // 清除按钮悬停效果
        clearBtn.addEventListener('mouseenter', () => {
            clearBtn.style.background = '#d1d5db';
            clearBtn.style.transform = 'scale(1.1)';
        });
        clearBtn.addEventListener('mouseleave', () => {
            clearBtn.style.background = '#e5e7eb';
            clearBtn.style.transform = 'scale(1)';
        });

        // 输入框聚焦和失焦样式
        sidebarTitle.addEventListener('focus', () => {
            sidebarTitle.style.borderColor = mainColor;
            sidebarTitle.style.boxShadow = `0 0 0 3px ${mainColor}22`;
            searchIcon.style.opacity = '0.7';
        });
        sidebarTitle.addEventListener('blur', () => {
            sidebarTitle.style.borderColor = '#e5e7eb';
            sidebarTitle.style.boxShadow = 'none';
            searchIcon.style.opacity = sidebarTitle.value.trim() !== '' ? '0.3' : '0.5';
        });

        // 输入框输入事件，实时过滤会话列表或OSS文件列表（添加防抖）
        let searchDebounceTimer = null;
        sidebarTitle.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            this.sessionTitleFilter = value;
            updateClearButton();

            // 清除之前的定时器
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }

            // 防抖处理：300ms后执行过滤
            searchDebounceTimer = setTimeout(() => {
                // 根据当前模式决定更新哪个列表
                this.updateSessionSidebar();
            }, 300);
        });

        // 阻止输入框事件冒泡，避免触发其他操作
        sidebarTitle.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 键盘快捷键：ESC清除输入
        sidebarTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebarTitle.value.trim() !== '') {
                sidebarTitle.value = '';
                this.sessionTitleFilter = '';
                updateClearButton();
                // 根据当前模式决定更新哪个列表
                if (this.apiRequestListVisible) {
                    // 已移除：API请求列表视图功能
                } else {
                    this.updateSessionSidebar();
                }
                e.stopPropagation();
            }
        });

        // 组装搜索容器
        searchContainer.appendChild(searchIcon);
        searchContainer.appendChild(sidebarTitle);
        searchContainer.appendChild(clearBtn);

        // 创建批量模式按钮
        const batchModeBtn = document.createElement('span');
        batchModeBtn.innerHTML = '☑️ 批量选择';
        batchModeBtn.title = '批量选择';
        batchModeBtn.style.cssText = `
            padding: 4px 10px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            color: white !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            user-select: none !important;
            border-radius: 4px !important;
            background: linear-gradient(135deg, #6366f1, #4f46e5) !important;
            border: 1px solid #4f46e5 !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
        `;

        // 批量模式按钮悬停效果
        batchModeBtn.addEventListener('mouseenter', function() {
            if (this.classList.contains('batch-mode-active')) {
                this.style.background = 'linear-gradient(135deg, #059669, #047857) !important';
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3) !important';
            } else {
                this.style.background = 'linear-gradient(135deg, #4f46e5, #4338ca) !important';
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3) !important';
            }
        });
        batchModeBtn.addEventListener('mouseleave', function() {
            if (this.classList.contains('batch-mode-active')) {
                this.style.background = 'linear-gradient(135deg, #10b981, #059669) !important';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none !important';
            } else {
                this.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5) !important';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none !important';
            }
        });

        // 批量模式按钮点击事件
        batchModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.batchMode) {
                this.exitBatchMode();
            } else {
                this.enterBatchMode();
            }
        });

        // 创建导出按钮
        const exportBtn = document.createElement('span');
        exportBtn.innerHTML = '⬇️ 导出';
        exportBtn.title = '导出会话';
        exportBtn.style.cssText = `
            padding: 4px 10px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            color: white !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            user-select: none !important;
            border-radius: 4px !important;
            background: linear-gradient(135deg, #2196F3, #1976D2) !important;
            border: 1px solid #1976D2 !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
        `;

        // 导出按钮悬停效果
        exportBtn.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, #1976D2, #1565C0) !important';
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3) !important';
        });
        exportBtn.addEventListener('mouseleave', function() {
            this.style.background = 'linear-gradient(135deg, #2196F3, #1976D2) !important';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none !important';
        });

        // 导出按钮点击事件
        exportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 禁用按钮，防止重复点击
            exportBtn.style.pointerEvents = 'none';
            exportBtn.style.opacity = '0.6';
            exportBtn.style.cursor = 'wait';

            try {
                await this.exportSessionsToZip();
            } catch (error) {
                console.error('导出会话失败:', error);
                this.showNotification('导出会话失败: ' + error.message, 'error');
            } finally {
                // 恢复按钮状态
                setTimeout(() => {
                    exportBtn.style.pointerEvents = 'auto';
                    exportBtn.style.opacity = '1';
                    exportBtn.style.cursor = 'pointer';
                }, 500);
            }
        });

        // 创建添加新会话按钮
        const addSessionBtn = document.createElement('button');
        addSessionBtn.innerHTML = '➕ 新建';
        addSessionBtn.title = '新建';
        addSessionBtn.style.cssText = `
            padding: 4px 10px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            color: white !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            user-select: none !important;
            border-radius: 4px !important;
            background: linear-gradient(135deg, #667eea, #764ba2) !important;
            border: 1px solid #764ba2 !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
        `;

        // 按钮悬停效果
        addSessionBtn.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, #764ba2, #6a3d9a) !important';
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 2px 8px rgba(118, 75, 162, 0.3) !important';
        });
        addSessionBtn.addEventListener('mouseleave', function() {
            this.style.background = 'linear-gradient(135deg, #667eea, #764ba2) !important';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none !important';
        });

        // 按钮点击事件：创建空白新会话
        addSessionBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 禁用按钮，防止重复点击
            addSessionBtn.disabled = true;
            addSessionBtn.style.opacity = '0.6';
            addSessionBtn.style.cursor = 'wait';

            try {
                await this.createBlankSession();
            } catch (error) {
                console.error('创建新会话失败:', error);
                this.showNotification('创建新会话失败', 'error');
            } finally {
                // 恢复按钮状态
                setTimeout(() => {
                    addSessionBtn.disabled = false;
                    addSessionBtn.style.opacity = '1';
                    addSessionBtn.style.cursor = 'pointer';
                }, 500);
            }
        });

        // 创建导入按钮
        const importBtn = document.createElement('span');
        importBtn.innerHTML = '⬆️ 导入';
        importBtn.title = '导入会话';
        importBtn.style.cssText = `
            padding: 4px 10px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            color: white !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            user-select: none !important;
            border-radius: 4px !important;
            background: linear-gradient(135deg, #4CAF50, #45a049) !important;
            border: 1px solid #45a049 !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
        `;

        // 导入按钮悬停效果
        importBtn.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, #45a049, #3d8b40) !important';
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3) !important';
        });
        importBtn.addEventListener('mouseleave', function() {
            this.style.background = 'linear-gradient(135deg, #4CAF50, #45a049) !important';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none !important';
        });

        // 导入按钮点击事件
        importBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 创建文件输入元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.zip';
            fileInput.style.display = 'none';

            fileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    return;
                }

                // 禁用按钮，防止重复点击
                importBtn.style.pointerEvents = 'none';
                importBtn.style.opacity = '0.6';
                importBtn.style.cursor = 'wait';

                try {
                    await this.importSessionsFromZip(file);
                } catch (error) {
                    console.error('导入会话失败:', error);
                    this.showNotification('导入会话失败: ' + error.message, 'error');
                } finally {
                    // 恢复按钮状态
                    setTimeout(() => {
                        importBtn.style.pointerEvents = 'auto';
                        importBtn.style.opacity = '1';
                        importBtn.style.cursor = 'pointer';
                    }, 500);

                    // 清理文件输入
                    if (fileInput.parentNode) {
                        fileInput.parentNode.removeChild(fileInput);
                    }
                }
            });

            // 添加到页面并触发点击
            document.body.appendChild(fileInput);
            fileInput.click();
        });

        // 第一行：搜索输入框
        firstRow.appendChild(searchContainer);

        // 组装左侧按钮组
        leftButtonGroup.appendChild(batchModeBtn);
        leftButtonGroup.appendChild(exportBtn);
        leftButtonGroup.appendChild(importBtn);

        // 第二行：左侧按钮组 + 右侧新建按钮
        secondRow.appendChild(leftButtonGroup);
        secondRow.appendChild(addSessionBtn);

        // 组装侧边栏标题
        // 创建日历组件（在搜索输入框上方）
        const calendarContainer = this.createCalendarComponent();
        sidebarHeader.appendChild(calendarContainer);

        sidebarHeader.appendChild(firstRow);
        sidebarHeader.appendChild(secondRow);
        this.sessionSidebar.appendChild(sidebarHeader);

        // 初始化视图切换按钮状态
        this.applyViewMode();

        // 创建批量操作工具栏容器（初始隐藏）
        const batchToolbar = document.createElement('div');
        batchToolbar.id = 'batch-toolbar';
        batchToolbar.style.cssText = `
            padding: 8px 12px !important;
            border-bottom: 1px solid #e5e7eb !important;
            background: #f9fafb !important;
            display: none !important;
            align-items: center !important;
            gap: 8px !important;
            flex-wrap: wrap !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            opacity: 0 !important;
            transform: translateY(-10px) !important;
        `;
        // 选中数量显示
        const selectedCount = document.createElement('span');
        selectedCount.id = 'selected-count';
        selectedCount.textContent = '已选择 0 个';
        selectedCount.style.cssText = `
            font-size: 12px !important;
            font-weight: 500 !important;
            color: #6b7280 !important;
            flex: 1 !important;
            padding: 2px 8px !important;
            background: transparent !important;
            border-radius: 4px !important;
            transition: color 0.2s ease !important;
            text-align: left !important;
        `;

        // 全选按钮
        const selectAllBtn = document.createElement('button');
        selectAllBtn.id = 'select-all-btn';
        selectAllBtn.textContent = '全选';
        selectAllBtn.style.cssText = `
            padding: 4px 10px !important;
            border-radius: 4px !important;
            background: #ffffff !important;
            color: #374151 !important;
            border: 1px solid #e5e7eb !important;
            cursor: pointer !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;

        selectAllBtn.addEventListener('mouseenter', () => {
            selectAllBtn.style.background = '#f9fafb';
            selectAllBtn.style.borderColor = '#d1d5db';
        });

        selectAllBtn.addEventListener('mouseleave', () => {
            selectAllBtn.style.background = '#ffffff';
            selectAllBtn.style.borderColor = '#e5e7eb';
        });

        // 全选按钮点击事件
        selectAllBtn.addEventListener('click', () => {
            this.toggleSelectAll();
        });

        // 批量删除按钮
        const batchDeleteBtn = document.createElement('button');
        batchDeleteBtn.id = 'batch-delete-btn';
        batchDeleteBtn.style.cssText = `
            padding: 4px 10px !important;
            cursor: pointer !important;
            font-size: 12px !important;
            color: white !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            user-select: none !important;
            border-radius: 4px !important;
            background: linear-gradient(135deg, #ef4444, #dc2626) !important;
            border: 1px solid #dc2626 !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
            position: relative !important;
            overflow: hidden !important;
        `;

        // 添加加载状态指示器
        const deleteLoader = document.createElement('span');
        deleteLoader.className = 'delete-loader';
        deleteLoader.style.cssText = `
            display: none !important;
            width: 14px !important;
            height: 14px !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
            border-top-color: white !important;
            border-radius: 50% !important;
            animation: spin 0.8s linear infinite !important;
        `;

        // 按钮文本
        const deleteIcon = document.createElement('span');
        deleteIcon.textContent = '🗑️';
        deleteIcon.style.cssText = 'font-size: 12px !important;';

        const deleteText = document.createElement('span');
        deleteText.textContent = '删除';

        batchDeleteBtn.appendChild(deleteLoader);
        batchDeleteBtn.appendChild(deleteIcon);
        batchDeleteBtn.appendChild(deleteText);

        // 添加加载动画样式
        if (!document.getElementById('delete-loader-style')) {
            const style = document.createElement('style');
            style.id = 'delete-loader-style';
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        batchDeleteBtn.addEventListener('mouseenter', function() {
            if (!this.disabled) {
                this.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c) !important';
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3) !important';
            }
        });
        batchDeleteBtn.addEventListener('mouseleave', function() {
            if (!this.disabled) {
                this.style.background = 'linear-gradient(135deg, #ef4444, #dc2626) !important';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none !important';
            }
        });

        // 取消批量模式按钮
        const cancelBatchBtn = document.createElement('button');
        cancelBatchBtn.innerHTML = '<span style="margin-right: 3px;">✕</span>取消';
        cancelBatchBtn.style.cssText = `
            padding: 4px 10px !important;
            border-radius: 4px !important;
            background: #ffffff !important;
            color: #6b7280 !important;
            border: 1px solid #e5e7eb !important;
            cursor: pointer !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease !important;
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;

        cancelBatchBtn.addEventListener('mouseenter', () => {
            cancelBatchBtn.style.background = '#f9fafb';
            cancelBatchBtn.style.borderColor = '#d1d5db';
            cancelBatchBtn.style.color = '#374151';
        });
        cancelBatchBtn.addEventListener('mouseleave', () => {
            cancelBatchBtn.style.background = '#ffffff';
            cancelBatchBtn.style.borderColor = '#e5e7eb';
            cancelBatchBtn.style.color = '#6b7280';
        });
        // 批量删除按钮事件
        batchDeleteBtn.addEventListener('click', async () => {
            if (batchDeleteBtn.disabled) return;

            // 显示加载状态
            const loader = batchDeleteBtn.querySelector('.delete-loader');
            const spans = batchDeleteBtn.querySelectorAll('span:not(.delete-loader)');
            const deleteIcon = spans[0];
            const deleteText = spans[1];

            if (loader) {
                loader.style.display = 'block';
            }
            if (deleteIcon) {
                deleteIcon.style.display = 'none';
            }
            if (deleteText) {
                deleteText.textContent = '删除中...';
            }

            batchDeleteBtn.disabled = true;
            batchDeleteBtn.style.opacity = '0.7';

            try {
                await this.batchDeleteSessions();
            } finally {
                // 隐藏加载状态
                if (loader) {
                    loader.style.display = 'none';
                }
                if (deleteIcon) {
                    deleteIcon.style.display = 'inline';
                }
            if (deleteText) {
                deleteText.textContent = '删除';
            }
                batchDeleteBtn.disabled = false;
                batchDeleteBtn.style.opacity = '1';
            }
        });

        // 取消批量模式按钮事件
        cancelBatchBtn.addEventListener('click', () => {
            this.exitBatchMode();
        });

        batchToolbar.appendChild(selectedCount);
        batchToolbar.appendChild(selectAllBtn);
        batchToolbar.appendChild(batchDeleteBtn);
        batchToolbar.appendChild(cancelBatchBtn);
        this.sessionSidebar.appendChild(batchToolbar);

        // 标签过滤器容器
        const tagFilterContainer = document.createElement('div');
        tagFilterContainer.className = 'tag-filter-container';
        tagFilterContainer.style.cssText = `
            padding: 8px 12px !important;
            border-bottom: 1px solid #e5e7eb !important;
            background: #ffffff !important;
            overflow: visible !important;
            flex-shrink: 0 !important;
        `;

        // 过滤器标题行（包含搜索输入框和操作按钮）
        const filterHeader = document.createElement('div');
        filterHeader.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
        `;

        // 右侧操作区（清除按钮）
        const filterActions = document.createElement('div');
        filterActions.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
        `;

        // 反向过滤开关
        const reverseFilterBtn = document.createElement('button');
        reverseFilterBtn.className = 'tag-filter-reverse';
        reverseFilterBtn.title = '反向过滤';
        reverseFilterBtn.innerHTML = '⇄';
        reverseFilterBtn.style.cssText = `
            font-size: 12px !important;
            color: ${this.tagFilterReverse ? '#4CAF50' : '#9ca3af'} !important;
            background: none !important;
            border: none !important;
            cursor: pointer !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            transition: all 0.2s ease !important;
            line-height: 1 !important;
            opacity: ${this.tagFilterReverse ? '1' : '0.6'} !important;
        `;
        reverseFilterBtn.addEventListener('mouseenter', () => {
            reverseFilterBtn.style.opacity = '1';
            reverseFilterBtn.style.background = '#f3f4f6';
        });
        reverseFilterBtn.addEventListener('mouseleave', () => {
            if (!this.tagFilterReverse) {
                reverseFilterBtn.style.opacity = '0.6';
            }
            reverseFilterBtn.style.background = 'none';
        });
        reverseFilterBtn.addEventListener('click', () => {
            this.tagFilterReverse = !this.tagFilterReverse;
            reverseFilterBtn.style.color = this.tagFilterReverse ? '#4CAF50' : '#9ca3af';
            reverseFilterBtn.style.opacity = this.tagFilterReverse ? '1' : '0.6';
            this.updateTagFilterUI();
            this.updateSessionSidebar();
        });

        // 无标签筛选开关（简化版，使用图标）
        const noTagsFilterBtn = document.createElement('button');
        noTagsFilterBtn.className = 'tag-filter-no-tags';
        noTagsFilterBtn.title = '筛选无标签';
        noTagsFilterBtn.innerHTML = '∅';
        noTagsFilterBtn.style.cssText = `
            font-size: 12px !important;
            color: ${this.tagFilterNoTags ? '#4CAF50' : '#9ca3af'} !important;
            background: none !important;
            border: none !important;
            cursor: pointer !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            transition: all 0.2s ease !important;
            line-height: 1 !important;
            opacity: ${this.tagFilterNoTags ? '1' : '0.6'} !important;
        `;
        noTagsFilterBtn.addEventListener('mouseenter', () => {
            noTagsFilterBtn.style.opacity = '1';
            noTagsFilterBtn.style.background = '#f3f4f6';
        });
        noTagsFilterBtn.addEventListener('mouseleave', () => {
            if (!this.tagFilterNoTags) {
                noTagsFilterBtn.style.opacity = '0.6';
            }
            noTagsFilterBtn.style.background = 'none';
        });
        noTagsFilterBtn.addEventListener('click', () => {
            this.tagFilterNoTags = !this.tagFilterNoTags;
            noTagsFilterBtn.style.color = this.tagFilterNoTags ? '#4CAF50' : '#9ca3af';
            noTagsFilterBtn.style.opacity = this.tagFilterNoTags ? '1' : '0.6';
            this.updateTagFilterUI();
            this.updateSessionSidebar();
        });

        // 展开/收起按钮（类似筛选无标签按钮的样式）
        const expandToggleBtn = document.createElement('button');
        expandToggleBtn.className = 'tag-filter-expand-btn';
        expandToggleBtn.title = '展开标签';
        expandToggleBtn.innerHTML = '▼';
        expandToggleBtn.style.cssText = `
            font-size: 10px !important;
            color: #9ca3af !important;
            background: none !important;
            border: none !important;
            cursor: pointer !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            transition: all 0.2s ease !important;
            line-height: 1 !important;
            opacity: 0.6 !important;
            display: none !important;
        `;
        expandToggleBtn.addEventListener('mouseenter', () => {
            expandToggleBtn.style.opacity = '1';
            expandToggleBtn.style.background = '#f3f4f6';
        });
        expandToggleBtn.addEventListener('mouseleave', () => {
            expandToggleBtn.style.opacity = '0.6';
            expandToggleBtn.style.background = 'none';
        });
        expandToggleBtn.addEventListener('click', () => {
            this.tagFilterExpanded = !this.tagFilterExpanded;
            this.updateTagFilterUI();
        });

        // 清除按钮（简化版）
        const clearFilterBtn = document.createElement('button');
        clearFilterBtn.className = 'tag-filter-clear';
        clearFilterBtn.textContent = '×';
        clearFilterBtn.title = '清除筛选';
        clearFilterBtn.style.cssText = `
            font-size: 16px !important;
            color: #9ca3af !important;
            background: none !important;
            border: none !important;
            cursor: pointer !important;
            padding: 0 !important;
            width: 18px !important;
            height: 18px !important;
            line-height: 1 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 3px !important;
            transition: all 0.2s ease !important;
            opacity: 0.6 !important;
        `;
        clearFilterBtn.addEventListener('mouseenter', () => {
            const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0;
            const hasSearchKeyword = this.tagFilterSearchKeyword && this.tagFilterSearchKeyword.trim() !== '';
            const hasActiveFilter = hasSelectedTags || this.tagFilterNoTags || hasSearchKeyword;
            if (hasActiveFilter) {
                clearFilterBtn.style.color = '#ef4444';
                clearFilterBtn.style.opacity = '1';
                clearFilterBtn.style.background = '#fee2e2';
            } else {
                clearFilterBtn.style.opacity = '0.4';
            }
        });
        clearFilterBtn.addEventListener('mouseleave', () => {
            const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0;
            const hasSearchKeyword = this.tagFilterSearchKeyword && this.tagFilterSearchKeyword.trim() !== '';
            const hasActiveFilter = hasSelectedTags || this.tagFilterNoTags || hasSearchKeyword;
            clearFilterBtn.style.color = '#9ca3af';
            clearFilterBtn.style.opacity = hasActiveFilter ? '0.8' : '0.4';
            clearFilterBtn.style.background = 'none';
        });
        clearFilterBtn.addEventListener('click', () => {
            const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0;
            const hasSearchKeyword = this.tagFilterSearchKeyword && this.tagFilterSearchKeyword.trim() !== '';
            const hasActiveFilter = hasSelectedTags || this.tagFilterNoTags || hasSearchKeyword;
            if (hasActiveFilter) {
                // 清除筛选时，恢复默认状态：不选中任何标签，显示所有会话
                this.selectedFilterTags = [];
                this.tagFilterNoTags = false; // 默认不选中"没有标签"筛选
                this.tagFilterSearchKeyword = '';
                // 更新搜索输入框的值和清除按钮状态
                const tagSearchInput = this.sessionSidebar.querySelector('.tag-filter-search');
                const tagSearchClearBtn = this.sessionSidebar.querySelector('.tag-filter-search-clear');
                if (tagSearchInput) {
                    tagSearchInput.value = '';
                }
                if (tagSearchClearBtn) {
                    tagSearchClearBtn.style.display = 'none';
                }
                const tagSearchIcon = this.sessionSidebar.querySelector('.tag-filter-search-container span');
                if (tagSearchIcon && tagSearchIcon.textContent === '🔍') {
                    tagSearchIcon.style.opacity = '0.5';
                }
                this.updateTagFilterUI();
                this.updateSessionSidebar();
            }
        });

        filterActions.appendChild(reverseFilterBtn);
        filterActions.appendChild(noTagsFilterBtn);
        filterActions.appendChild(expandToggleBtn);
        filterActions.appendChild(clearFilterBtn);

        // 创建标签搜索输入框容器（带图标和清除按钮）
        const tagSearchContainer = document.createElement('div');
        tagSearchContainer.className = 'tag-filter-search-container';
        tagSearchContainer.style.cssText = `
            position: relative !important;
            flex: 1 !important;
            display: flex !important;
            align-items: center !important;
        `;

        // 搜索图标
        const tagSearchIcon = document.createElement('span');
        tagSearchIcon.textContent = '🔍';
        tagSearchIcon.style.cssText = `
            position: absolute !important;
            left: 8px !important;
            font-size: 12px !important;
            pointer-events: none !important;
            z-index: 1 !important;
            opacity: 0.5 !important;
            transition: opacity 0.2s ease !important;
        `;

        // 标签搜索输入框
        const tagSearchInput = document.createElement('input');
        tagSearchInput.className = 'tag-filter-search';
        tagSearchInput.type = 'text';
        tagSearchInput.placeholder = '搜索标签...';
        tagSearchInput.value = this.tagFilterSearchKeyword || '';
        tagSearchInput.style.cssText = `
            width: 100% !important;
            font-weight: 400 !important;
            font-size: 12px !important;
            color: #374151 !important;
            padding: 4px 24px 4px 24px !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            background: #ffffff !important;
            outline: none !important;
            transition: all 0.2s ease !important;
            box-sizing: border-box !important;
            height: 24px !important;
        `;

        // 添加占位符样式
        if (!document.getElementById('tag-search-placeholder-style')) {
            const style = document.createElement('style');
            style.id = 'tag-search-placeholder-style';
            style.textContent = `
                .tag-filter-search::placeholder {
                    color: #9ca3af !important;
                    opacity: 1 !important;
                }
                .tag-filter-search:focus::placeholder {
                    color: #d1d5db !important;
                }
            `;
            document.head.appendChild(style);
        }

        // 清除按钮（位于输入框右侧）
        const tagSearchClearBtn = document.createElement('button');
        tagSearchClearBtn.innerHTML = '✕';
        tagSearchClearBtn.type = 'button';
        tagSearchClearBtn.className = 'tag-filter-search-clear';
        tagSearchClearBtn.style.cssText = `
            position: absolute !important;
            right: 4px !important;
            width: 16px !important;
            height: 16px !important;
            border: none !important;
            background: #e5e7eb !important;
            color: #6b7280 !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 10px !important;
            padding: 0 !important;
            transition: all 0.2s ease !important;
            z-index: 2 !important;
            line-height: 1 !important;
        `;

        // 更新清除按钮显示状态
        const updateTagSearchClearButton = () => {
            if (tagSearchInput.value.trim() !== '') {
                tagSearchClearBtn.style.display = 'flex';
                tagSearchIcon.style.opacity = '0.3';
            } else {
                tagSearchClearBtn.style.display = 'none';
                tagSearchIcon.style.opacity = '0.5';
            }
        };

        // 初始状态
        updateTagSearchClearButton();

        // 清除按钮点击事件
        tagSearchClearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tagSearchInput.value = '';
            this.tagFilterSearchKeyword = '';
            updateTagSearchClearButton();
            this.updateTagFilterUI();
            tagSearchInput.focus();
        });

        // 清除按钮悬停效果
        tagSearchClearBtn.addEventListener('mouseenter', () => {
            tagSearchClearBtn.style.background = '#d1d5db';
            tagSearchClearBtn.style.transform = 'scale(1.15)';
        });
        tagSearchClearBtn.addEventListener('mouseleave', () => {
            tagSearchClearBtn.style.background = '#e5e7eb';
            tagSearchClearBtn.style.transform = 'scale(1)';
        });

        // 输入框聚焦和失焦样式
        tagSearchInput.addEventListener('focus', () => {
            tagSearchInput.style.borderColor = mainColor;
            tagSearchInput.style.boxShadow = `0 0 0 2px ${mainColor}22`;
            tagSearchIcon.style.opacity = '0.7';
        });
        tagSearchInput.addEventListener('blur', () => {
            tagSearchInput.style.borderColor = '#e5e7eb';
            tagSearchInput.style.boxShadow = 'none';
            tagSearchIcon.style.opacity = tagSearchInput.value.trim() !== '' ? '0.3' : '0.5';
        });

        // 输入框输入事件，实时过滤标签（添加防抖）
        let tagSearchDebounceTimer = null;
        tagSearchInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            this.tagFilterSearchKeyword = value;
            updateTagSearchClearButton();

            // 清除之前的定时器
            if (tagSearchDebounceTimer) {
                clearTimeout(tagSearchDebounceTimer);
            }

            // 防抖处理：300ms后执行过滤
            tagSearchDebounceTimer = setTimeout(() => {
                this.updateTagFilterUI();
            }, 300);
        });

        // 阻止输入框事件冒泡
        tagSearchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 键盘快捷键：ESC清除输入
        tagSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && tagSearchInput.value.trim() !== '') {
                tagSearchInput.value = '';
                this.tagFilterSearchKeyword = '';
                updateTagSearchClearButton();
                this.updateTagFilterUI();
                e.stopPropagation();
            }
        });

        // 组装搜索容器
        tagSearchContainer.appendChild(tagSearchIcon);
        tagSearchContainer.appendChild(tagSearchInput);
        tagSearchContainer.appendChild(tagSearchClearBtn);

        // 将搜索容器和操作按钮添加到标题行
        filterHeader.appendChild(tagSearchContainer);
        filterHeader.appendChild(filterActions);

        // 标签列表容器
        const tagFilterList = document.createElement('div');
        tagFilterList.className = 'tag-filter-list';
        tagFilterList.style.cssText = `
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 4px !important;
            overflow: visible !important;
        `;

        tagFilterContainer.appendChild(filterHeader);
        tagFilterContainer.appendChild(tagFilterList);

        // 初始化标签过滤器状态：默认不选中任何标签，显示所有会话
        if (this.selectedFilterTags === undefined) {
            this.selectedFilterTags = [];
        }
        if (this.tagFilterNoTags === undefined) {
            this.tagFilterNoTags = false;
        }
        if (this.tagFilterExpanded === undefined) {
            this.tagFilterExpanded = false;
        }

        // 创建共同的滚动容器（包含标签列表和会话列表）
        const scrollableContent = document.createElement('div');
        scrollableContent.className = 'session-sidebar-scrollable-content';
        scrollableContent.style.cssText = `
            flex: 1 !important;
            overflow-y: auto !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
        `;
        // 隐藏滚动条但保持滚动功能
        if (!document.getElementById('hide-scrollbar-style')) {
            const hideScrollbarStyle = document.createElement('style');
            hideScrollbarStyle.id = 'hide-scrollbar-style';
            hideScrollbarStyle.textContent = `
                .session-sidebar-scrollable-content::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                }
                .session-sidebar-scrollable-content {
                    -ms-overflow-style: none !important;
                    scrollbar-width: none !important;
                }
            `;
            document.head.appendChild(hideScrollbarStyle);
        }

        // 会话列表容器（移除独立滚动）
        const sessionList = document.createElement('div');
        sessionList.className = 'session-list';
        sessionList.style.cssText = `
            flex: 1 !important;
            overflow: visible !important;
            padding: 8px 8px 220px 8px !important;
            scroll-padding-bottom: 20px !important;
            box-sizing: border-box !important;
        `;

        // 添加会话列表样式
        if (!document.getElementById('session-sidebar-styles')) {
            const style = document.createElement('style');
            style.id = 'session-sidebar-styles';
            style.textContent = `
                .session-item {
                    padding: 12px !important;
                    margin-bottom: 8px !important;
                    border-radius: 8px !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    position: relative !important;
                    user-select: none !important;
                }
                .session-item:hover:not(.switching):not(.active) {
                    background: #f9fafb !important;
                    border-color: #d1d5db !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
                }
                .session-item.active {
                    background: #eff6ff !important;
                    border-color: #3b82f6 !important;
                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2) !important;
                }
                .session-item.clicked {
                    transform: scale(0.97) translateX(2px) !important;
                    background: ${mainColor}25 !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
                }
                .session-item.switching {
                    cursor: wait !important;
                    opacity: 0.8 !important;
                    pointer-events: none !important;
                    position: relative !important;
                    background: ${mainColor}10 !important;
                    border-color: ${mainColor}40 !important;
                }
                .session-item.switching::after {
                    content: '' !important;
                    position: absolute !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    width: 16px !important;
                    height: 16px !important;
                    border: 2px solid ${mainColor} !important;
                    border-top-color: transparent !important;
                    border-radius: 50% !important;
                    animation: session-switching-spin 0.6s linear infinite !important;
                }
                @keyframes session-switching-spin {
                    0% { transform: translate(-50%, -50%) rotate(0deg) !important; }
                    100% { transform: translate(-50%, -50%) rotate(360deg) !important; }
                }
                .session-item.long-press-start {
                    background: rgba(244, 67, 54, 0.08) !important;
                    border-color: rgba(244, 67, 54, 0.3) !important;
                    transform: scale(0.99) !important;
                    transition: all 0.2s ease !important;
                }
                .session-item.long-press-stage-1 {
                    background: rgba(244, 67, 54, 0.12) !important;
                    border-color: rgba(244, 67, 54, 0.4) !important;
                    transform: scale(0.985) !important;
                    box-shadow: 0 2px 8px rgba(244, 67, 54, 0.2) !important;
                }
                .session-item.long-press-stage-2 {
                    background: rgba(244, 67, 54, 0.18) !important;
                    border-color: rgba(244, 67, 54, 0.6) !important;
                    transform: scale(0.975) !important;
                    box-shadow: 0 3px 10px rgba(244, 67, 54, 0.3) !important;
                }
                .session-item.long-press-stage-3 {
                    background: rgba(244, 67, 54, 0.22) !important;
                    border-color: rgba(244, 67, 54, 0.7) !important;
                    transform: scale(0.97) !important;
                    box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4) !important;
                }
                .session-item.long-pressing {
                    background: rgba(244, 67, 54, 0.25) !important;
                    border-color: rgba(244, 67, 54, 0.8) !important;
                    transform: scale(0.96) !important;
                    box-shadow: 0 6px 16px rgba(244, 67, 54, 0.5) !important;
                    animation: long-press-pulse 0.6s ease-in-out infinite !important;
                }
                @keyframes long-press-pulse {
                    0%, 100% {
                        box-shadow: 0 6px 16px rgba(244, 67, 54, 0.5) !important;
                    }
                    50% {
                        box-shadow: 0 6px 20px rgba(244, 67, 54, 0.7) !important;
                    }
                }
                .session-title {
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    color: #374151 !important;
                    margin-bottom: 4px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                    max-width: 100% !important;
                }
                .session-item.active .session-title {
                    color: ${mainColor} !important;
                    font-weight: 600 !important;
                }
                .session-meta {
                    font-size: 11px !important;
                    color: #9ca3af !important;
                }
                .session-item.active .session-meta {
                    color: ${mainColor} !important;
                }
                .session-item.new-session-highlight {
                    animation: new-session-highlight 1.5s ease-out !important;
                }
                @keyframes new-session-highlight {
                    0% {
                        background: ${mainColor}30 !important;
                        transform: scale(1.02) !important;
                    }
                    50% {
                        background: ${mainColor}20 !important;
                    }
                    100% {
                        background: ${mainColor}15 !important;
                        transform: scale(1) !important;
                    }
                }
                .session-list .session-item:last-child {
                    margin-bottom: 0 !important;
                }
                .session-list::after {
                    content: '' !important;
                    display: block !important;
                    height: 20px !important;
                    flex-shrink: 0 !important;
                }
                /* OSS文件列表样式已移除 */
            `;
            document.head.appendChild(style);
        }

        this.sessionSidebar.appendChild(sidebarHeader);
        // 将标签列表和会话列表都放入滚动容器
        scrollableContent.appendChild(tagFilterContainer);
        scrollableContent.appendChild(sessionList);
        this.sessionSidebar.appendChild(scrollableContent);

        // 在所有内容添加完成后，创建拖拽调整边框（确保在最上层）
        this.createSidebarResizer();

        // 创建右侧内容容器（包含消息区域和输入框）
        const rightContentContainer = document.createElement('div');
        rightContentContainer.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            position: relative !important;
        `;

        // 创建消息区域
        const messagesContainer = document.createElement('div');
        messagesContainer.id = 'pet-chat-messages';
        messagesContainer.style.cssText = `
            flex: 1 !important;
            padding: 20px !important;
            padding-bottom: 20px !important;
            overflow-y: auto !important;
            background: linear-gradient(135deg, #f8f9fa, #ffffff) !important;
            position: relative !important;
            min-height: 200px !important;
            user-select: text !important;
        `;

        // 将消息区域添加到右侧容器
        rightContentContainer.appendChild(messagesContainer);

        // 将侧边栏和右侧内容容器添加到主容器
        mainContentContainer.appendChild(this.sessionSidebar);
        mainContentContainer.appendChild(rightContentContainer);

        // 将侧边栏折叠按钮添加到主容器（定位在侧边栏右侧）
        // 确保按钮存在：如果找不到，使用之前创建的按钮变量
        if (!toggleSidebarBtn) {
            toggleSidebarBtn = this.chatWindow.querySelector('#sidebar-toggle-btn');
        }
        if (toggleSidebarBtn && mainContentContainer) {
            // 更新按钮定位函数（参考输入框折叠按钮的实现方式）
            const updateSidebarToggleBtnPosition = () => {
                // 根据折叠状态设置按钮位置：折叠时在左侧边缘，展开时在侧边栏右边缘
                // 使用 translateX(14px) 让按钮完全在侧边栏外面
                const buttonLeft = this.sidebarCollapsed ? '0px' : `${this.sidebarWidth}px`;
                toggleSidebarBtn.style.left = buttonLeft;
            };

            // 设置按钮基础样式（参考输入框折叠按钮）
            toggleSidebarBtn.style.cssText = `
                position: absolute !important;
                top: 50% !important;
                transform: translateY(-50%) translateX(14px) !important;
                background: rgba(255, 255, 255, 0.9) !important;
                border: 1px solid #e5e7eb !important;
                color: #374151 !important;
                font-size: 14px !important;
                cursor: pointer !important;
                padding: 0 !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.3s ease !important;
                z-index: 10001 !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
            `;

            // 确保按钮没有被重复添加
            if (!toggleSidebarBtn.parentNode) {
                mainContentContainer.appendChild(toggleSidebarBtn);
            } else if (toggleSidebarBtn.parentNode !== mainContentContainer) {
                // 如果按钮在其他位置，先移除再添加
                toggleSidebarBtn.parentNode.removeChild(toggleSidebarBtn);
                mainContentContainer.appendChild(toggleSidebarBtn);
            }

            // 延迟更新位置，确保侧边栏已渲染
            setTimeout(() => {
                updateSidebarToggleBtnPosition();
            }, 100);

            // 监听侧边栏宽度变化（使用ResizeObserver）
            if (window.ResizeObserver && this.sessionSidebar) {
                const resizeObserver = new ResizeObserver(() => {
                    updateSidebarToggleBtnPosition();
                });
                resizeObserver.observe(this.sessionSidebar);
            }
        }

        // 应用侧边栏折叠状态
        this.applySidebarCollapsedState();

        // 更新折叠按钮图标（根据当前状态）
        if (toggleSidebarBtn) {
            const icon = toggleSidebarBtn.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = this.sidebarCollapsed ? '▶' : '◀';
            }
            toggleSidebarBtn.title = this.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏';
        }

        // 统一的 AbortController，用于终止所有正在进行的请求
        let currentAbortController = null;

        // 动态更新底部padding（现在输入框在 flex 布局中，不再需要动态调整 padding）
        const updatePaddingBottom = () => {
            // 输入框现在在 flex 布局中，消息区域会自动调整，不需要额外的 padding
            // 保留此函数以保持兼容性，但不再需要执行任何操作
            if (!this.chatWindow) return;
            const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
            if (messagesContainer) {
                // 只需要保持基本的底部 padding
                messagesContainer.style.paddingBottom = '20px';
            }
        };

        // 初始化按钮相关的对象（保留以避免其他地方出错）
        this.actionIcons = {};
        this.buttonHandlers = {};

        // 创建欢迎消息（使用统一方法）
        const welcomeMessage = await this.createWelcomeMessage(messagesContainer);

        // 将按钮添加到消息容器中，和时间戳同一行
        setTimeout(() => {
            const messageTime = welcomeMessage?.querySelector('[data-message-time="true"]');
            if (messageTime) {
                // 修改时间戳容器为 flex 布局
                messageTime.style.cssText = `
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    font-size: 11px !important;
                    color: #999 !important;
                    margin-top: 4px !important;
                    max-width: 100% !important;
                    width: 100% !important;
                `;

                // 创建时间文本容器
                const timeText = document.createElement('span');
                timeText.style.cssText = 'flex: 1 !important; min-width: 0 !important;';
                timeText.textContent = this.getCurrentTime();

                // 将原有内容替换为 flex 布局的内容
                messageTime.innerHTML = '';
                messageTime.appendChild(timeText);
                const actionsGroup = document.createElement('div');
                actionsGroup.id = 'pet-welcome-actions';
                actionsGroup.style.cssText = `
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-shrink: 0 !important;
                `;

                // 把 actionsGroup 放到一个相对定位容器里，以便菜单定位
                const actionsWrapper = document.createElement('div');
                actionsWrapper.style.cssText = `
                    position: relative !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                `;

                actionsWrapper.appendChild(actionsGroup);
                messageTime.appendChild(actionsWrapper);

                // 根据角色设置动态创建按钮（与角色设置列表保持一致）
                // refreshWelcomeActionButtons() 会从角色配置中获取列表，并确保设置按钮始终在最后
                this.refreshWelcomeActionButtons();
            }
        }, 100);

        // 播放宠物欢迎动画
        this.playChatAnimation();

        // 创建输入区域 - 使用宠物颜色主题
        const inputContainer = document.createElement('div');
        inputContainer.className = 'chat-input-container';
        inputContainer.style.cssText = `
            flex-shrink: 0 !important;
            padding: 20px !important;
            background: white !important;
            border-top: 1px solid #e5e7eb !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            border-radius: 0 !important;
            z-index: ${PET_CONFIG.ui.zIndex.inputContainer} !important;
        `;

        // 创建顶部工具栏（左侧按钮和右侧状态）
        const topToolbar = document.createElement('div');
        topToolbar.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 8px !important;
        `;

        // 左侧按钮组
        const inputLeftButtonGroup = document.createElement('div');
        inputLeftButtonGroup.style.cssText = `
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        `;

        // 创建 @ 按钮（使用宠物颜色主题）
        const mentionButton = document.createElement('button');
        mentionButton.innerHTML = '@';
        mentionButton.title = '提及';
        mentionButton.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 16px !important;
            font-weight: 500 !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;
        mentionButton.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            mentionButton.style.background = currentMainColor;
            mentionButton.style.color = 'white';
            mentionButton.style.borderColor = currentMainColor;
        });
        mentionButton.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            mentionButton.style.background = 'white';
            mentionButton.style.color = currentMainColor;
            mentionButton.style.borderColor = currentMainColor;
        });

        // 创建图片上传按钮（使用宠物颜色主题）
        const imageUploadButton = document.createElement('button');
        imageUploadButton.innerHTML = '📷';
        imageUploadButton.className = 'chat-image-upload-button';
        imageUploadButton.title = '上传图片';
        imageUploadButton.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 16px !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;

        imageUploadButton.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            imageUploadButton.style.background = currentMainColor;
            imageUploadButton.style.color = 'white';
            imageUploadButton.style.borderColor = currentMainColor;
        });
        imageUploadButton.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            imageUploadButton.style.background = 'white';
            imageUploadButton.style.color = currentMainColor;
            imageUploadButton.style.borderColor = currentMainColor;
        });

        // 创建隐藏的文件输入
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imageDataUrl = event.target.result;
                    this.sendImageMessage(imageDataUrl);
                };
                reader.readAsDataURL(file);
            }
            fileInput.value = '';
        });

        imageUploadButton.addEventListener('click', () => {
            fileInput.click();
        });

        // 右侧状态组
        const rightStatusGroup = document.createElement('div');
        rightStatusGroup.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            align-items: center !important;
        `;

        // 创建页面上下文开关（扁平化简约设计）
        const contextSwitchContainer = document.createElement('div');
        contextSwitchContainer.className = 'context-switch-container';
        contextSwitchContainer.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            gap: 10px !important;
            padding: 4px 0 !important;
            cursor: pointer !important;
            user-select: none !important;
            transition: opacity 0.2s ease !important;
        `;
        contextSwitchContainer.title = '开启/关闭页面上下文，帮助AI理解当前页面内容';

        // 创建标签（简约字体）
        const contextSwitchLabel = document.createElement('span');
        contextSwitchLabel.textContent = '页面上下文';
        contextSwitchLabel.style.cssText = `
            font-size: 12px !important;
            font-weight: 400 !important;
            color: #64748b !important;
            white-space: nowrap !important;
            transition: color 0.2s ease !important;
            letter-spacing: 0.3px !important;
        `;

        // 创建扁平化开关容器
        const switchWrapper = document.createElement('div');
        switchWrapper.style.cssText = `
            position: relative !important;
            width: 40px !important;
            height: 20px !important;
            border-radius: 10px !important;
            background: #cbd5e1 !important;
            transition: background-color 0.2s ease !important;
            cursor: pointer !important;
        `;

        // 创建扁平化开关滑块
        const switchThumb = document.createElement('div');
        switchThumb.style.cssText = `
            position: absolute !important;
            top: 2px !important;
            left: 2px !important;
            width: 16px !important;
            height: 16px !important;
            border-radius: 50% !important;
            background: #ffffff !important;
            transition: transform 0.2s ease !important;
            transform: translateX(0) !important;
        `;

        // 隐藏原生checkbox，但保留功能
        const contextSwitch = document.createElement('input');
        contextSwitch.type = 'checkbox';
        contextSwitch.id = 'context-switch';
        contextSwitch.checked = true; // 默认开启
        contextSwitch.style.cssText = `
            position: absolute !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            margin: 0 !important;
            pointer-events: none !important;
        `;

        // 更新开关状态的函数（扁平化风格）
        const updateSwitchState = (isChecked) => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            if (isChecked) {
                switchWrapper.style.background = currentMainColor;
                switchThumb.style.transform = 'translateX(20px)';
                contextSwitchLabel.style.color = currentMainColor;
            } else {
                switchWrapper.style.background = '#cbd5e1';
                switchThumb.style.transform = 'translateX(0)';
                contextSwitchLabel.style.color = '#64748b';
            }
        };

        // 初始状态
        updateSwitchState(contextSwitch.checked);

        // 组装开关
        switchWrapper.appendChild(switchThumb);
        contextSwitchContainer.appendChild(contextSwitchLabel);
        contextSwitchContainer.appendChild(switchWrapper);
        contextSwitchContainer.appendChild(contextSwitch);

        // 简约悬停效果（扁平化）
        contextSwitchContainer.addEventListener('mouseenter', () => {
            contextSwitchContainer.style.opacity = '0.8';
        });

        contextSwitchContainer.addEventListener('mouseleave', () => {
            contextSwitchContainer.style.opacity = '1';
        });

        // 点击整个容器切换开关
        contextSwitchContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            contextSwitch.checked = !contextSwitch.checked;
            updateSwitchState(contextSwitch.checked);
            contextSwitch.dispatchEvent(new Event('change'));
        });

        // 从存储中读取开关状态
        chrome.storage.local.get(['contextSwitchEnabled'], (result) => {
            if (result.contextSwitchEnabled !== undefined) {
                contextSwitch.checked = result.contextSwitchEnabled;
                updateSwitchState(contextSwitch.checked);
            }
        });

        // 监听开关状态变化并保存
        contextSwitch.addEventListener('change', () => {
            updateSwitchState(contextSwitch.checked);
            chrome.storage.local.set({ contextSwitchEnabled: contextSwitch.checked });
        });

        // 监听颜色变化，更新开关颜色
        const updateSwitchColor = () => {
            if (contextSwitch.checked) {
                updateSwitchState(true);
            }
        };

        // 存储更新函数以便在其他地方调用
        contextSwitchContainer.updateColor = updateSwitchColor;

        inputLeftButtonGroup.appendChild(mentionButton);
        inputLeftButtonGroup.appendChild(imageUploadButton);

        // 创建请求状态按钮（使用宠物颜色主题）
        const requestStatusButton = document.createElement('button');
        requestStatusButton.className = 'chat-request-status-button';
        requestStatusButton.innerHTML = '⏹️';
        requestStatusButton.title = '请求状态：空闲';
        requestStatusButton.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 16px !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 0.5 !important;
            pointer-events: none !important;
        `;

        // 更新请求状态按钮的函数（使用上面定义的 currentAbortController）
        const updateRequestStatus = (status) => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            if (status === 'idle') {
                // 空闲状态
                requestStatusButton.innerHTML = '⏹️';
                requestStatusButton.title = '请求状态：空闲';
                requestStatusButton.style.opacity = '0.5';
                requestStatusButton.style.pointerEvents = 'none';
                requestStatusButton.disabled = true;
                requestStatusButton.style.background = 'white';
                requestStatusButton.style.color = currentMainColor;
            } else if (status === 'loading') {
                // 请求进行中
                requestStatusButton.innerHTML = '⏸️';
                requestStatusButton.title = '点击终止请求';
                requestStatusButton.style.opacity = '1';
                requestStatusButton.style.pointerEvents = 'auto';
                requestStatusButton.disabled = false;
                requestStatusButton.style.background = '#fee2e2';
                requestStatusButton.style.color = '#dc2626';
                requestStatusButton.style.borderColor = '#dc2626';
            } else if (status === 'stopping') {
                // 正在终止
                requestStatusButton.innerHTML = '⏹️';
                requestStatusButton.title = '正在终止请求...';
                requestStatusButton.style.opacity = '0.7';
                requestStatusButton.style.pointerEvents = 'none';
                requestStatusButton.disabled = true;
            }
        };

        // 终止请求的处理函数
        const abortRequest = () => {
            // 获取当前的 AbortController（可能在其他作用域中）
            const controller = currentAbortController || (this.chatWindow && this.chatWindow._currentAbortController ? this.chatWindow._currentAbortController() : null);

            if (controller) {
                updateRequestStatus('stopping');
                controller.abort();

                // 清除 AbortController 引用
                currentAbortController = null;
                if (this.chatWindow && this.chatWindow._setAbortController) {
                    this.chatWindow._setAbortController(null);
                }

                // 清理打字指示器
                const typingIndicator = messagesContainer.querySelector('[data-typing-indicator="true"]');
                if (typingIndicator) {
                    typingIndicator.remove();
                }

                // 显示取消提示
                this.showNotification('请求已取消', 'info');

                // 延迟恢复空闲状态
                setTimeout(() => {
                    updateRequestStatus('idle');
                }, 500);
            }
        };

        requestStatusButton.addEventListener('mouseenter', () => {
            if (!requestStatusButton.disabled && requestStatusButton.title.includes('终止')) {
                requestStatusButton.style.background = '#dc2626';
                requestStatusButton.style.color = 'white';
                requestStatusButton.style.borderColor = '#dc2626';
            }
        });
        requestStatusButton.addEventListener('mouseleave', () => {
            if (!requestStatusButton.disabled && requestStatusButton.title.includes('终止')) {
                requestStatusButton.style.background = '#fee2e2';
                requestStatusButton.style.color = '#dc2626';
                requestStatusButton.style.borderColor = '#dc2626';
            }
        });

        // 点击按钮终止请求
        requestStatusButton.addEventListener('click', abortRequest);

        // 添加企微机器人设置按钮
        let robotSettingsButton = this.robotSettingsButton;
        if (!robotSettingsButton) {
            robotSettingsButton = document.createElement('span');
            robotSettingsButton.innerHTML = '🤖';
            robotSettingsButton.title = '企微机器人设置';
            robotSettingsButton.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 18px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 24px !important;
                height: 24px !important;
                line-height: 24px !important;
            `;
            robotSettingsButton.addEventListener('mouseenter', function() {
                this.style.color = '#10b981';
                this.style.transform = 'scale(1.1)';
            });
            robotSettingsButton.addEventListener('mouseleave', function() {
                this.style.color = '#666';
                this.style.transform = 'scale(1)';
            });
            robotSettingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openWeWorkRobotSettingsModal();
            });
            this.robotSettingsButton = robotSettingsButton;
        }

        // 添加企微机器人设置按钮
        // 如果企微机器人设置按钮已经在其他容器中，先移除它
        if (robotSettingsButton.parentNode && robotSettingsButton.parentNode !== rightStatusGroup) {
            robotSettingsButton.parentNode.removeChild(robotSettingsButton);
        }

        // 添加角色设置按钮
        let settingsButton = this.settingsButton;
        if (!settingsButton) {
            settingsButton = document.createElement('span');
            settingsButton.innerHTML = '👤';
            settingsButton.title = '角色设置';
            settingsButton.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 18px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 24px !important;
                height: 24px !important;
                line-height: 24px !important;
            `;
            settingsButton.addEventListener('mouseenter', function() {
                this.style.color = '#2196F3';
                this.style.transform = 'scale(1.1)';
            });
            settingsButton.addEventListener('mouseleave', function() {
                this.style.color = '#666';
                this.style.transform = 'scale(1)';
            });
            settingsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openRoleSettingsModal();
            });
            this.settingsButton = settingsButton;
        }

        // 如果设置按钮已经在其他容器中，先移除它
        if (settingsButton.parentNode && settingsButton.parentNode !== rightStatusGroup) {
            settingsButton.parentNode.removeChild(settingsButton);
        }

        // 按顺序将三个按钮添加到 rightStatusGroup（在页面上下文开关之前）
        // 1. 请求状态按钮
        if (requestStatusButton.parentNode !== rightStatusGroup) {
            rightStatusGroup.appendChild(requestStatusButton);
        }
        // 2. 企微机器人设置按钮
        if (robotSettingsButton.parentNode !== rightStatusGroup) {
            rightStatusGroup.appendChild(robotSettingsButton);
        }
        // 3. 角色设置按钮
        if (settingsButton.parentNode !== rightStatusGroup) {
            rightStatusGroup.appendChild(settingsButton);
        }

        // 4. 最后添加页面上下文开关
        rightStatusGroup.appendChild(contextSwitchContainer);

        // 添加：页面上下文预览/编辑按钮
        const contextBtn = document.createElement('button');
        contextBtn.className = 'chat-toolbar-btn';
        contextBtn.setAttribute('title', '预览/编辑页面上下文');
        contextBtn.textContent = '📝 上下文';
        contextBtn.style.cssText = `
            padding: 6px 10px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 12px !important;
            font-weight: 500 !important;
        `;
        contextBtn.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            contextBtn.style.background = currentMainColor;
            contextBtn.style.color = 'white';
            contextBtn.style.borderColor = currentMainColor;
        });
        contextBtn.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            contextBtn.style.background = 'white';
            contextBtn.style.color = currentMainColor;
            contextBtn.style.borderColor = currentMainColor;
        });
        contextBtn.addEventListener('click', () => this.openContextEditor());
        inputLeftButtonGroup.appendChild(contextBtn);

        // ===== 创建常见问题按钮 =====
        const faqBtn = document.createElement('button');
        faqBtn.innerHTML = '💡 常见问题';
        faqBtn.title = '常见问题';
        faqBtn.style.cssText = `
            padding: 6px 10px !important;
            border-radius: 6px !important;
            background: white !important;
            color: ${mainColor} !important;
            border: 1px solid ${mainColor} !important;
            cursor: pointer !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            transition: all 0.2s ease !important;
        `;

        faqBtn.addEventListener('mouseenter', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            faqBtn.style.background = currentMainColor;
            faqBtn.style.color = 'white';
            faqBtn.style.borderColor = currentMainColor;
        });

        faqBtn.addEventListener('mouseleave', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            faqBtn.style.background = 'white';
            faqBtn.style.color = currentMainColor;
            faqBtn.style.borderColor = currentMainColor;
        });

        faqBtn.addEventListener('click', () => this.openFaqManager());
        inputLeftButtonGroup.appendChild(faqBtn);
        // 已移除自定义角色快捷入口

        topToolbar.appendChild(inputLeftButtonGroup);
        topToolbar.appendChild(rightStatusGroup);
        inputContainer.appendChild(topToolbar);
        // ===== 常见问题按钮结束 =====

        // 创建输入框容器（暗色主题）
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = `
            display: flex !important;
            gap: 8px !important;
            align-items: flex-end !important;
            position: relative !important;
            width: 100% !important;
        `;

        const messageInput = document.createElement('textarea');
        messageInput.placeholder = '输入消息... (Enter发送, Shift+Enter换行)';
        // 不设置 maxLength，允许无限制输入
        // messageInput.maxLength = PET_CONFIG.chatWindow.input.maxLength;
        messageInput.className = 'chat-message-input';
        messageInput.rows = 2; // 初始2行
        messageInput.style.cssText = `
            flex: 1 !important;
            width: 100% !important;
            padding: 12px 16px !important;
            border: 2px solid ${mainColor} !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 400 !important;
            color: #1f2937 !important;
            background: #f9fafb !important;
            outline: none !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            resize: none !important;
            min-height: 60px !important;
            max-height: 200px !important;
            overflow-y: auto !important;
            line-height: 1.5 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        `;


        // 设置placeholder和滚动条样式
        const style = document.createElement('style');
        style.textContent = `
            .chat-message-input::placeholder {
                color: #888888 !important;
                opacity: 1 !important;
                font-size: 14px !important;
                font-weight: 400 !important;
            }
            .chat-message-input::-webkit-input-placeholder {
                color: #9ca3af !important;
                opacity: 1 !important;
                font-size: 14px !important;
            }
            .chat-message-input::-moz-placeholder {
                color: #9ca3af !important;
                opacity: 1 !important;
                font-size: 14px !important;
            }
            .chat-message-input:-ms-input-placeholder {
                color: #9ca3af !important;
                opacity: 1 !important;
                font-size: 14px !important;
            }
            .chat-message-input::-webkit-scrollbar {
                width: 4px !important;
            }
            .chat-message-input::-webkit-scrollbar-track {
                background: #1e1e1e !important;
            }
            .chat-message-input::-webkit-scrollbar-thumb {
                background: #555555 !important;
                border-radius: 2px !important;
            }
            .chat-message-input::-webkit-scrollbar-thumb:hover {
                background: #666666 !important;
            }
        `;
        document.head.appendChild(style);

        // 自动调整高度和输入时的视觉反馈
        const updateInputState = () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            const hasContent = messageInput.value.trim().length > 0;
            if (hasContent) {
                messageInput.style.borderColor = currentMainColor;
                messageInput.style.background = '#ffffff';
            } else {
                messageInput.style.borderColor = currentMainColor;
                messageInput.style.background = '#f9fafb';
            }
        };

        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            const newHeight = Math.max(60, messageInput.scrollHeight);
            messageInput.style.height = newHeight + 'px';
            updateInputState();
            // 更新消息容器的底部padding
            setTimeout(() => {
                const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
                if (inputContainer && messagesContainer) {
                    const inputHeight = inputContainer.offsetHeight || 160;
                    messagesContainer.style.paddingBottom = (inputHeight + 20) + 'px';
                    // 滚动到底部
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 0);
        });

        // 将颜色转换为rgba用于阴影
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        const shadowColor = hexToRgba(mainColor, 0.1);

        messageInput.addEventListener('focus', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            messageInput.style.borderColor = currentMainColor;
            messageInput.style.background = '#ffffff';
            const currentShadowColor = currentMainColor.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16)).join(',');
            messageInput.style.boxShadow = `0 0 0 3px rgba(${currentShadowColor}, 0.1)`;
        });

        messageInput.addEventListener('blur', () => {
            const currentMainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
            if (messageInput.value.length === 0) {
                messageInput.style.borderColor = currentMainColor;
                messageInput.style.background = '#f9fafb';
            }
            messageInput.style.boxShadow = 'none';
        });

        // 添加粘贴图片支持
        messageInput.addEventListener('paste', async (e) => {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const imageDataUrl = event.target.result;
                        this.sendImageMessage(imageDataUrl);
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        });

        // 发送消息功能（调用 session/save 接口）
        const sendMessage = async () => {
            const message = messageInput.value.trim();
            if (!message) return;

            // 确保有当前会话（如果没有，先初始化会话）
            if (!this.currentSessionId) {
                await this.initSession();
                // 更新聊天窗口标题
                this.updateChatHeaderTitle();
            }

            // 添加用户消息
            const userMessage = this.createMessageElement(message, 'user');
            messagesContainer.appendChild(userMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // 添加用户消息到会话（注意：已移除自动保存，仅在 prompt 接口调用后保存）
            await this.addMessageToSession('user', message, null, false);

            // 为用户消息添加操作按钮（包括机器人按钮）
            await this.addActionButtonsToMessage(userMessage);

            // 为用户消息添加删除、编辑和重新发送按钮
            const userBubble = userMessage.querySelector('[data-message-type="user-bubble"]');
            const copyButtonContainer = userMessage.querySelector('[data-copy-button-container]');
            if (copyButtonContainer && userBubble) {
                // 检查是否已经添加过这些按钮（通过检查是否有删除按钮）
                if (!copyButtonContainer.querySelector('.delete-button')) {
                    this.addDeleteButtonForUserMessage(copyButtonContainer, userBubble);
                }
                // 添加排序按钮
                this.addSortButtons(copyButtonContainer, userMessage);
            }

            // 清空输入框并重置高度
            messageInput.value = '';
            messageInput.style.height = '';
            // 强制重排以确保高度被正确重置
            void messageInput.offsetHeight;
            messageInput.style.height = '60px';

            // 更新输入状态
            updateInputState();

            // 调用 session/save 保存会话到后端
            try {
                // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                await this.saveCurrentSession(false, false);

                // 调用 session/save 接口保存会话
                if (this.currentSessionId && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                    await this.syncSessionToBackend(this.currentSessionId, true);
                    console.log('会话已保存到后端:', this.currentSessionId);
                } else {
                    console.warn('无法保存会话：缺少会话ID、API管理器或同步配置');
                }
            } catch (error) {
                console.error('保存会话失败:', error);
                // 显示错误提示（可选）
                const errorMessage = this.createMessageElement('保存会话时发生错误，请稍后再试。😔', 'pet');
                messagesContainer.appendChild(errorMessage);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // 更新状态为空闲
            currentAbortController = null;
            if (this.chatWindow && this.chatWindow._setAbortController) {
                this.chatWindow._setAbortController(null);
            }
            if (this.chatWindow && this.chatWindow._updateRequestStatus) {
                this.chatWindow._updateRequestStatus('idle');
            } else {
                updateRequestStatus('idle');
            }
        };

        // 中文输入法状态跟踪
        let isComposing = false;
        let compositionEndTime = 0;
        const COMPOSITION_END_DELAY = 100; // 组合输入结束后延迟处理回车键的时间（毫秒）

        // 监听输入法组合开始事件（中文输入法开始输入）
        messageInput.addEventListener('compositionstart', () => {
            isComposing = true;
            compositionEndTime = 0;
        });

        // 监听输入法组合更新事件（输入法正在输入）
        messageInput.addEventListener('compositionupdate', () => {
            isComposing = true;
            compositionEndTime = 0;
        });

        // 监听输入法组合结束事件（中文输入法输入完成）
        messageInput.addEventListener('compositionend', (e) => {
            isComposing = false;
            // 记录组合输入结束的时间，用于后续判断
            compositionEndTime = Date.now();
        });

        // 键盘事件处理：Enter发送，Shift+Enter换行，ESC清除
        messageInput.addEventListener('keydown', (e) => {
            // 检查是否正在使用中文输入法组合输入
            if (e.isComposing) {
                // 如果正在组合输入，不处理回车键，让输入法正常处理
                return;
            }

            // 检查自定义的 isComposing 状态
            if (isComposing) {
                return;
            }

            // 检查是否刚刚结束组合输入（防止组合输入刚结束时误触发）
            // 如果组合输入结束时间距离现在不到 COMPOSITION_END_DELAY 毫秒，且按的是回车键，则不处理
            if (e.key === 'Enter' && compositionEndTime > 0) {
                const timeSinceCompositionEnd = Date.now() - compositionEndTime;
                if (timeSinceCompositionEnd < COMPOSITION_END_DELAY) {
                    // 组合输入刚结束，这次回车键可能是用来确认输入法选择，不发送消息
                    return;
                }
            }

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
                // 发送消息后重置组合输入结束时间
                compositionEndTime = 0;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                messageInput.value = '';
                messageInput.style.height = '';
                messageInput.style.height = '60px';
                updateInputState();
                messageInput.blur();
            }
        });

        inputWrapper.appendChild(messageInput);
        inputContainer.appendChild(inputWrapper);

        // 创建底部工具栏
        const bottomToolbar = document.createElement('div');
        bottomToolbar.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-top: 8px !important;
            width: 100% !important;
        `;

        // 左侧：预留空间（已移除模型选择器）
        const leftBottomGroup = document.createElement('div');
        leftBottomGroup.style.cssText = `
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        `;
        // 不再添加模型选择器，保留容器以保持布局
        bottomToolbar.appendChild(leftBottomGroup);

        // 右侧：预留空间（按钮已移动到顶部工具栏）
        const rightBottomGroup = document.createElement('div');
        rightBottomGroup.style.cssText = `
            display: flex !important;
            gap: 6px !important;
            align-items: center !important;
        `;
        // 不再添加按钮，保留容器以保持布局
        bottomToolbar.appendChild(rightBottomGroup);
        inputContainer.appendChild(bottomToolbar);

        // 将文件输入添加到容器
        inputContainer.appendChild(fileInput);

        // 将 currentAbortController 和 updateRequestStatus 暴露给外部函数使用
        // 通过存储到 chatWindow 对象的方式，让角色按钮也能访问
        this.chatWindow._currentAbortController = () => currentAbortController;
        this.chatWindow._setAbortController = (controller) => { currentAbortController = controller; };
        this.chatWindow._updateRequestStatus = updateRequestStatus;

        // 确保上下文编辑器 UI 预创建（隐藏）
        this.ensureContextEditorUi();
        // 确保消息编辑器 UI 预创建（隐藏）
        this.ensureMessageEditorUi();

        // 创建四个缩放手柄（四个角）
        const createResizeHandle = (position) => {
            const handle = document.createElement('div');
			handle.className = `resize-handle resize-handle-${position}`;

            let styles = `
                position: absolute !important;
				width: 20px !important;
				height: 20px !important;
                background: linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%) !important;
                z-index: ${PET_CONFIG.ui.zIndex.resizeHandle} !important;
                transition: background 0.2s ease !important;
            `;

            // 根据位置设置样式
            switch(position) {
                case 'top-left':
                    styles += `
                        top: 0 !important;
                        left: 0 !important;
                        cursor: nw-resize !important;
                        border-radius: 16px 0 0 0 !important;
                    `;
                    break;
                case 'top-right':
                    styles += `
                        top: 0 !important;
                        right: 0 !important;
                        cursor: ne-resize !important;
                        border-radius: 0 16px 0 0 !important;
                    `;
                    break;
                case 'bottom-left':
                    styles += `
                        bottom: 0 !important;
                        left: 0 !important;
                        cursor: sw-resize !important;
                        border-radius: 0 0 0 16px !important;
                    `;
                    break;
                case 'bottom-right':
                    styles += `
                        bottom: 0 !important;
                        right: 0 !important;
                        cursor: nw-resize !important;
                        border-radius: 0 0 16px 0 !important;
                    `;
                    break;
				case 'left':
					styles += `
						top: 20px !important;
						bottom: 20px !important;
						left: 0 !important;
						width: 8px !important;
						height: auto !important;
						cursor: ew-resize !important;
						background: transparent !important;
					`;
					break;
				case 'right':
					styles += `
						top: 20px !important;
						bottom: 20px !important;
						right: 0 !important;
						width: 8px !important;
						height: auto !important;
						cursor: ew-resize !important;
						background: transparent !important;
					`;
					break;
				case 'bottom':
					styles += `
						left: 20px !important;
						right: 20px !important;
						bottom: 0 !important;
						height: 8px !important;
						width: auto !important;
						cursor: ns-resize !important;
						background: transparent !important;
					`;
					break;
                case 'top':
                    styles += `
                        left: 20px !important;
                        right: 20px !important;
                        top: 0 !important;
                        height: 8px !important;
                        width: auto !important;
                        cursor: ns-resize !important;
                        background: transparent !important;
                    `;
                    break;
            }

            handle.style.cssText = styles;
            handle.title = '拖拽调整大小';
            return handle;
        };

		// 创建四个角的缩放手柄
        const resizeHandleTL = createResizeHandle('top-left');
        const resizeHandleTR = createResizeHandle('top-right');
        const resizeHandleBL = createResizeHandle('bottom-left');
        const resizeHandleBR = createResizeHandle('bottom-right');
		// 创建边缘缩放手柄（左、右、下）
		const resizeHandleL = createResizeHandle('left');
		const resizeHandleR = createResizeHandle('right');
		const resizeHandleB = createResizeHandle('bottom');
		const resizeHandleT = createResizeHandle('top');

        // 将输入容器添加到右侧内容容器（在消息区域下方）
        rightContentContainer.appendChild(inputContainer);

        // 组装聊天窗口
        this.chatWindow.appendChild(chatHeader);
        this.chatWindow.appendChild(mainContentContainer);

        // 将输入框折叠按钮添加到右侧内容容器（定位在输入框容器上方）
        // 如果按钮还没有被添加到 DOM，则通过 querySelector 查找
        if (!toggleInputContainerBtn.parentNode) {
            const existingBtn = this.chatWindow.querySelector('#input-container-toggle-btn');
            if (existingBtn) {
                toggleInputContainerBtn = existingBtn;
            }
        }
        if (toggleInputContainerBtn && rightContentContainer) {
            // 更新按钮定位，相对于右侧内容容器
            const updateInputToggleBtnPosition = () => {
                const inputHeight = inputContainer.offsetHeight || 160;
                if (this.inputContainerCollapsed) {
                    toggleInputContainerBtn.style.bottom = '0px';
                } else {
                    toggleInputContainerBtn.style.bottom = `${inputHeight}px`;
                }
            };

            toggleInputContainerBtn.style.cssText = `
                position: absolute !important;
                left: 50% !important;
                transform: translateX(-50%) translateY(-8px) !important;
                background: rgba(255, 255, 255, 0.9) !important;
                border: 1px solid #e5e7eb !important;
                color: #374151 !important;
                font-size: 14px !important;
                cursor: pointer !important;
                padding: 0 !important;
                border-radius: 50% !important;
                width: 28px !important;
                height: 28px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.3s ease !important;
                z-index: 10001 !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
            `;
            rightContentContainer.appendChild(toggleInputContainerBtn);

            // 延迟更新位置，确保输入框已渲染
            setTimeout(() => {
                updateInputToggleBtnPosition();
            }, 100);

            // 监听输入框高度变化（使用ResizeObserver）
            if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(() => {
                    updateInputToggleBtnPosition();
                });
                resizeObserver.observe(inputContainer);
            }
        }
		this.chatWindow.appendChild(resizeHandleTL);
		this.chatWindow.appendChild(resizeHandleTR);
		this.chatWindow.appendChild(resizeHandleBL);
		this.chatWindow.appendChild(resizeHandleBR);
		this.chatWindow.appendChild(resizeHandleL);
		this.chatWindow.appendChild(resizeHandleR);
		this.chatWindow.appendChild(resizeHandleB);
		this.chatWindow.appendChild(resizeHandleT);

        // 添加到页面
        document.body.appendChild(this.chatWindow);

        // 应用输入框容器折叠状态
        this.applyInputContainerCollapsedState();

        // 更新输入框折叠按钮图标（根据当前状态）
        const inputToggleBtn = this.chatWindow.querySelector('#input-container-toggle-btn');
        if (inputToggleBtn) {
            const icon = inputToggleBtn.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = this.inputContainerCollapsed ? '▲' : '▼';
            }
            inputToggleBtn.title = this.inputContainerCollapsed ? '展开输入框' : '折叠输入框';
        }

        // 添加拖拽和缩放功能
        this.addChatWindowInteractions();

        // 添加滚动条样式
        this.addChatScrollbarStyles();

        // 初始化滚动功能
        this.initializeChatScroll();

        // 初始化模型选择器显示

        // 初始化消息容器的底部padding
        this.updateMessagesPaddingBottom = updatePaddingBottom;
        setTimeout(() => this.updateMessagesPaddingBottom(), 50);

        // 加载所有会话数据（确保会话数据已加载）
        await this.loadAllSessions();

        // 更新会话侧边栏（显示所有会话）
        await this.updateSessionSidebar();

        // 加载会话消息
        await this.loadSessionMessages();

        // 监听角色配置变化，自动刷新按钮列表
        if (!this.roleConfigChangeListener) {
            this.roleConfigChangeListener = async (changes, namespace) => {
                if (namespace === 'local' && changes.roleConfigs) {
                    // 角色配置发生变化，自动刷新欢迎消息下的按钮列表
                    await this.refreshWelcomeActionButtons();
                    // 刷新所有消息下的按钮
                    await this.refreshAllMessageActionButtons();
                }
            };
            chrome.storage.onChanged.addListener(this.roleConfigChangeListener);
        }
    }

    // 更新消息容器的底部padding（公共方法）
    updateMessagesPaddingBottom() {
        if (!this.chatWindow) return;
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (messagesContainer) {
            // 输入框现在在 flex 布局中，消息区域会自动调整，只需要保持基本的底部 padding
            messagesContainer.style.paddingBottom = '20px';
            // 确保内容完全可见，滚动到底部
            setTimeout(() => {
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 0);
        }
    }

    // 更新聊天窗口样式
    updateChatWindowStyle() {
        if (!this.chatWindow || !this.chatWindowState) return;

        const { x, y, width, height, isFullscreen } = this.chatWindowState;

        if (isFullscreen) {
            // 全屏模式：铺满整个视口
            this.chatWindow.style.cssText = `
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: white !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                z-index: ${PET_CONFIG.ui.zIndex.chatWindow} !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                resize: none !important;
            `;
        } else {
            // 正常模式：使用保存的位置和大小
            this.chatWindow.style.cssText = `
                position: fixed !important;
                left: ${x}px !important;
                top: ${y}px !important;
                width: ${width}px !important;
                height: ${height}px !important;
                background: white !important;
                border-radius: 16px !important;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
                z-index: ${PET_CONFIG.ui.zIndex.chatWindow} !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                resize: none !important;
            `;
        }
    }

    // 切换全屏模式
    toggleFullscreen() {
        if (!this.chatWindow || !this.chatWindowState) return;

        if (this.chatWindowState.isFullscreen) {
            // 退出全屏：恢复原始状态
            if (this.chatWindowState.originalState) {
                this.chatWindowState.x = this.chatWindowState.originalState.x;
                this.chatWindowState.y = this.chatWindowState.originalState.y;
                this.chatWindowState.width = this.chatWindowState.originalState.width;
                this.chatWindowState.height = this.chatWindowState.originalState.height;
                this.chatWindowState.originalState = null;
            }
            this.chatWindowState.isFullscreen = false;
        } else {
            // 进入全屏：保存当前状态
            this.chatWindowState.originalState = {
                x: this.chatWindowState.x,
                y: this.chatWindowState.y,
                width: this.chatWindowState.width,
                height: this.chatWindowState.height
            };
            this.chatWindowState.isFullscreen = true;
        }

        // 更新窗口样式
        this.updateChatWindowStyle();

        // 更新头部提示文本和样式
        const header = this.chatWindow.querySelector('.chat-header');
        if (header) {
            if (this.chatWindowState.isFullscreen) {
                header.title = '双击退出全屏';
                header.style.setProperty('border-radius', '0', 'important');
            } else {
                header.title = '拖拽移动窗口 | 双击全屏';
                header.style.setProperty('border-radius', '16px 16px 0 0', 'important');
            }
        }

        // 重新初始化滚动功能
        this.initializeChatScroll();

        // 更新消息容器的底部padding
        this.updateMessagesPaddingBottom();
    }

    // 从渐变色中提取主色调
    getMainColorFromGradient(gradient) {
        const match = gradient.match(/#[0-9a-fA-F]{6}/);
        return match ? match[0] : '#3b82f6';
    }

    // 更新聊天窗口标题（显示当前会话名称）
    updateChatHeaderTitle() {
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
    }

    // 更新聊天窗口颜色（跟随宠物颜色）
    updateChatWindowColor() {
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
    }

    // 添加聊天窗口交互功能
    addChatWindowInteractions() {
        if (!this.chatWindow) return;

        const header = this.chatWindow.querySelector('.chat-header');
        const resizeHandles = this.chatWindow.querySelectorAll('.resize-handle');

        // 拖拽功能
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return; // 忽略按钮点击
                if (this.chatWindowState.isFullscreen) return; // 全屏模式下禁用拖拽

                this.chatWindowState.isDragging = true;
                this.chatWindowState.dragStart = {
                    x: e.clientX - this.chatWindowState.x,
                    y: e.clientY - this.chatWindowState.y
                };

                header.style.cursor = 'grabbing';
                e.preventDefault();
            });

            // 双击全屏功能
            header.addEventListener('dblclick', (e) => {
                if (e.target.closest('button')) return; // 忽略按钮双击
                e.preventDefault();
                e.stopPropagation();
                this.toggleFullscreen();
            });
        }

        // 缩放功能 - 为每个缩放手柄添加事件监听
        resizeHandles.forEach((resizeHandle) => {
            resizeHandle.addEventListener('mousedown', (e) => {
                if (this.chatWindowState.isFullscreen) return; // 全屏模式下禁用缩放
                this.chatWindowState.isResizing = true;

                // 根据手柄位置确定缩放类型
                if (resizeHandle.classList.contains('resize-handle-top-left')) {
                    this.chatWindowState.resizeType = 'top-left';
                } else if (resizeHandle.classList.contains('resize-handle-top-right')) {
                    this.chatWindowState.resizeType = 'top-right';
                } else if (resizeHandle.classList.contains('resize-handle-bottom-left')) {
                    this.chatWindowState.resizeType = 'bottom-left';
                } else if (resizeHandle.classList.contains('resize-handle-bottom-right')) {
                    this.chatWindowState.resizeType = 'bottom-right';
				} else if (resizeHandle.classList.contains('resize-handle-left')) {
					this.chatWindowState.resizeType = 'left';
				} else if (resizeHandle.classList.contains('resize-handle-right')) {
					this.chatWindowState.resizeType = 'right';
				} else if (resizeHandle.classList.contains('resize-handle-bottom')) {
					this.chatWindowState.resizeType = 'bottom';
                } else if (resizeHandle.classList.contains('resize-handle-top')) {
                    this.chatWindowState.resizeType = 'top';
                }

                this.chatWindowState.resizeStart = {
                    x: e.clientX,
                    y: e.clientY,
                    width: this.chatWindowState.width,
                    height: this.chatWindowState.height,
                    startX: this.chatWindowState.x,
                    startY: this.chatWindowState.y
                };

                // 添加缩放时的视觉反馈
                this.chatWindow.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)';
                // 使用宠物的主色调
                const currentColor = this.colors[this.colorIndex];
                const getMainColor = (gradient) => {
                    const match = gradient.match(/#[0-9a-fA-F]{6}/);
                    return match ? match[0] : '#ff6b6b';
                };
                const mainColor = getMainColor(currentColor);
                resizeHandle.style.background = `linear-gradient(-45deg, transparent 30%, ${mainColor} 30%, ${mainColor} 70%, transparent 70%)`;

                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 全局鼠标移动事件
        document.addEventListener('mousemove', (e) => {
            if (this.chatWindowState.isDragging) {
                const newX = e.clientX - this.chatWindowState.dragStart.x;
                const newY = e.clientY - this.chatWindowState.dragStart.y;

                // 边界检查
                this.chatWindowState.x = Math.max(0, Math.min(window.innerWidth - this.chatWindowState.width, newX));
                this.chatWindowState.y = Math.max(0, Math.min(window.innerHeight - this.chatWindowState.height, newY));

                // 添加拖拽时的视觉反馈
                this.chatWindow.style.transform = 'scale(1.02)';
                this.chatWindow.style.boxShadow = '0 25px 50px rgba(0,0,0,0.4)';

                this.updateChatWindowStyle();
            }

            if (this.chatWindowState.isResizing) {
                const deltaX = e.clientX - this.chatWindowState.resizeStart.x;
                const deltaY = e.clientY - this.chatWindowState.resizeStart.y;

                const resizeType = this.chatWindowState.resizeType;
                let newWidth, newHeight, newX, newY;

				// 根据不同的缩放类型计算新的宽度、高度和位置
                switch(resizeType) {
                    case 'bottom-right':
                        // 右下角：调整宽度和高度
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width + deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height + deltaY));
                        newX = this.chatWindowState.resizeStart.startX;
                        newY = this.chatWindowState.resizeStart.startY;
                        break;

                    case 'bottom-left':
                        // 左下角：调整宽度（负方向）和高度，同时移动x位置
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width - deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height + deltaY));
                        newX = Math.max(0, this.chatWindowState.resizeStart.startX + deltaX);
                        newY = this.chatWindowState.resizeStart.startY;
                        break;

                    case 'top-right':
                        // 右上角：调整宽度和高度（负方向），同时移动y位置
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width + deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height - deltaY));
                        newX = this.chatWindowState.resizeStart.startX;
                        newY = Math.max(0, this.chatWindowState.resizeStart.startY + deltaY);
                        break;

                    case 'top-left':
                        // 左上角：调整宽度和高度（负方向），同时移动x和y位置
                        newWidth = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.resizeStart.width - deltaX));
                        newHeight = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.resizeStart.height - deltaY));
                        newX = Math.max(0, this.chatWindowState.resizeStart.startX + deltaX);
                        newY = Math.max(0, this.chatWindowState.resizeStart.startY + deltaY);
                        break;

					case 'left':
						// 左边：调整宽度（负方向），同时移动x位置
						newWidth = Math.max(
							PET_CONFIG.chatWindow.sizeLimits.minWidth,
							Math.min(
								PET_CONFIG.chatWindow.sizeLimits.maxWidth,
								this.chatWindowState.resizeStart.width - deltaX
							)
						);
						newHeight = this.chatWindowState.resizeStart.height;
						newX = Math.max(0, this.chatWindowState.resizeStart.startX + deltaX);
						newY = this.chatWindowState.resizeStart.startY;
						break;

					case 'right':
						// 右边：调整宽度（正方向）
						newWidth = Math.max(
							PET_CONFIG.chatWindow.sizeLimits.minWidth,
							Math.min(
								PET_CONFIG.chatWindow.sizeLimits.maxWidth,
								this.chatWindowState.resizeStart.width + deltaX
							)
						);
						newHeight = this.chatWindowState.resizeStart.height;
						newX = this.chatWindowState.resizeStart.startX;
						newY = this.chatWindowState.resizeStart.startY;
						break;

					case 'bottom':
						// 下边：仅调整高度（正方向）
						newWidth = this.chatWindowState.resizeStart.width;
						newHeight = Math.max(
							PET_CONFIG.chatWindow.sizeLimits.minHeight,
							Math.min(
								PET_CONFIG.chatWindow.sizeLimits.maxHeight,
								this.chatWindowState.resizeStart.height + deltaY
							)
						);
						newX = this.chatWindowState.resizeStart.startX;
						newY = this.chatWindowState.resizeStart.startY;
						break;

                    case 'top':
                        // 上边：仅调整高度（负方向），同时移动y位置
                        newWidth = this.chatWindowState.resizeStart.width;
                        newHeight = Math.max(
                            PET_CONFIG.chatWindow.sizeLimits.minHeight,
                            Math.min(
                                PET_CONFIG.chatWindow.sizeLimits.maxHeight,
                                this.chatWindowState.resizeStart.height - deltaY
                            )
                        );
                        newX = this.chatWindowState.resizeStart.startX;
                        newY = Math.max(0, this.chatWindowState.resizeStart.startY + deltaY);
                        break;

                    default:
                        return;
                }

                // 边界检查，确保窗口不超出屏幕
                const maxX = window.innerWidth - newWidth;
                const maxY = window.innerHeight - newHeight;

                if (newX + newWidth > window.innerWidth) {
                    newX = Math.max(0, maxX);
                }

                if (newY + newHeight > window.innerHeight) {
                    newY = Math.max(0, maxY);
                }

                this.chatWindowState.width = newWidth;
                this.chatWindowState.height = newHeight;
                this.chatWindowState.x = newX;
                this.chatWindowState.y = newY;

                this.updateChatWindowStyle();
            }
        });

        // 全局鼠标释放事件
        document.addEventListener('mouseup', () => {
            if (this.chatWindowState.isDragging) {
                this.chatWindowState.isDragging = false;
                if (header) {
                    header.style.cursor = 'move';
                }
                // 恢复正常的视觉样式
                this.chatWindow.style.transform = 'scale(1)';
                this.chatWindow.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
                this.saveChatWindowState();
            }

            if (this.chatWindowState.isResizing) {
                this.chatWindowState.isResizing = false;

                // 恢复所有缩放手柄的样式
                const allResizeHandles = this.chatWindow.querySelectorAll('.resize-handle');
                allResizeHandles.forEach(handle => {
                    handle.style.background = 'linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%)';
                });

                // 恢复窗口阴影
                this.chatWindow.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';

                // 重新初始化滚动功能
                this.initializeChatScroll();

                // 更新消息容器的底部padding
                this.updateMessagesPaddingBottom();

                this.saveChatWindowState();
            }
        });

        // 悬停效果 - 为所有缩放手柄添加悬停效果
        resizeHandles.forEach((resizeHandle) => {
            resizeHandle.addEventListener('mouseenter', () => {
                if (!this.chatWindowState.isResizing) {
                    resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #999 30%, #999 70%, transparent 70%)';
                    resizeHandle.style.transform = 'scale(1.1)';
                }
            });

            resizeHandle.addEventListener('mouseleave', () => {
                if (!this.chatWindowState.isResizing) {
                    resizeHandle.style.background = 'linear-gradient(-45deg, transparent 30%, #ccc 30%, #ccc 70%, transparent 70%)';
                    resizeHandle.style.transform = 'scale(1)';
                }
            });
        });
    }

    // 保存聊天窗口状态
    saveChatWindowState() {
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
    loadChatWindowState(callback) {
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
    loadChatWindowStateFromLocalStorage() {
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
    restoreChatWindowState(state) {
        this.chatWindowState = {
            ...this.chatWindowState,
            ...state,
            isDragging: false,
            isResizing: false,
            resizeType: 'bottom-right' // 默认缩放类型
        };

        // 验证位置和大小
        this.chatWindowState.width = Math.max(PET_CONFIG.chatWindow.sizeLimits.minWidth, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxWidth, this.chatWindowState.width));
        this.chatWindowState.height = Math.max(PET_CONFIG.chatWindow.sizeLimits.minHeight, Math.min(PET_CONFIG.chatWindow.sizeLimits.maxHeight, this.chatWindowState.height));
        this.chatWindowState.x = Math.max(0, Math.min(window.innerWidth - this.chatWindowState.width, this.chatWindowState.x));
        this.chatWindowState.y = Math.max(0, Math.min(window.innerHeight - this.chatWindowState.height, this.chatWindowState.y));

        console.log('聊天窗口状态已恢复:', this.chatWindowState);
    }

    // 加载 Mermaid.js (CDN)
    async loadMermaid() {
        if (this.mermaidLoaded || this.mermaidLoading) {
            return this.mermaidLoaded;
        }

        this.mermaidLoading = true;

        return new Promise((resolve, reject) => {
            // 检查是否已经加载（从 content_scripts 自动加载或之前动态加载）
            const mermaidLib = (typeof mermaid !== 'undefined') ? mermaid :
                              (typeof window !== 'undefined' && window.mermaid) ? window.mermaid : null;

            if (mermaidLib && typeof mermaidLib.initialize === 'function') {
                try {
                    // 初始化 mermaid
                    mermaidLib.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        flowchart: {
                            useMaxWidth: true,
                            htmlLabels: true
                        }
                    });
                    this.mermaidLoaded = true;
                    this.mermaidLoading = false;
                    console.log('Mermaid.js 已加载并初始化');
                    resolve(true);
                    return;
                } catch (error) {
                    console.error('初始化 Mermaid 失败:', error);
                    this.mermaidLoading = false;
                    reject(error);
                    return;
                }
            }

            // 使用注入脚本在页面上下文中加载 mermaid
            // 这样可以确保 mermaid 在页面的 window 对象中可用
            const scriptUrl = chrome.runtime.getURL('mermaid.min.js');
            const loadScriptUrl = chrome.runtime.getURL('load-mermaid.js');
            console.log('尝试在页面上下文中加载 Mermaid.js，URL:', scriptUrl);

            // 通过 data 属性传递 URL（避免内联脚本）
            // 注：我们仍然需要通过页面上下文传递 URL，使用隐藏的 data 属性
            const urlContainer = document.createElement('div');
            urlContainer.id = '__mermaid_url_container__';
            urlContainer.style.display = 'none';
            urlContainer.setAttribute('data-mermaid-url', scriptUrl);
            (document.head || document.documentElement).appendChild(urlContainer);

            // 修改 load-mermaid.js 以从 data 属性读取 URL
            // 但更简单的方法是在 load-mermaid.js 中直接使用 chrome.runtime.getURL
            // 因为 load-mermaid.js 在页面上下文中执行，无法直接访问 chrome API
            // 所以我们需要通过 data 属性传递

            // 加载外部脚本文件（避免 CSP 限制）
            const injectedScript = document.createElement('script');
            injectedScript.src = loadScriptUrl;
            injectedScript.charset = 'UTF-8';
            injectedScript.async = false;

            // 监听页面中的 mermaid 加载事件（在脚本加载前设置）
            const handleMermaidLoaded = () => {
                console.log('[Content] 收到 Mermaid 加载完成事件');
                // Mermaid 已经在页面上下文中加载（通过 load-mermaid.js）
                // 由于 content script 的隔离环境，我们无法直接访问页面的 window.mermaid
                // 但我们知道它已经加载，可以通过外部脚本执行渲染
                this.mermaidLoaded = true;
                this.mermaidLoading = false;
                console.log('[Content] Mermaid.js 在页面上下文中已加载');
                window.removeEventListener('mermaid-loaded', handleMermaidLoaded);
                window.removeEventListener('mermaid-error', handleMermaidError);
                resolve(true);
            };

            const handleMermaidError = () => {
                console.error('[Content] 收到 Mermaid 加载失败事件');
                this.mermaidLoading = false;
                window.removeEventListener('mermaid-loaded', handleMermaidLoaded);
                window.removeEventListener('mermaid-error', handleMermaidError);
                reject(new Error('页面上下文中的 Mermaid.js 加载失败'));
            };

            // 监听页面事件（通过注入的事件监听器）
            window.addEventListener('mermaid-loaded', handleMermaidLoaded);
            window.addEventListener('mermaid-error', handleMermaidError);

            // 注入脚本到页面上下文
            (document.head || document.documentElement).appendChild(injectedScript);

            // 清理注入的脚本
            setTimeout(() => {
                if (injectedScript.parentNode) {
                    injectedScript.parentNode.removeChild(injectedScript);
                }
            }, 1000);
        });
    }

    // 处理 Markdown 中的 Mermaid 代码块
    async processMermaidBlocks(container) {
        if (!container) return;

        // 检查是否需要加载 mermaid - 更全面的选择器
        const mermaidBlocks = container.querySelectorAll('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');

        if (mermaidBlocks.length === 0) return;

        // 过滤掉已经处理过的块
        const unprocessedBlocks = Array.from(mermaidBlocks).filter(block => {
            // 检查是否已经是mermaid div或被标记为已处理
            const preElement = block.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
                // 如果父元素的下一个兄弟元素是mermaid div，说明已经处理过
                const nextSibling = preElement.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('mermaid')) {
                    return false;
                }
                // 检查是否有处理标记
                if (block.classList.contains('mermaid-processed')) {
                    return false;
                }
            }
            return true;
        });

        if (unprocessedBlocks.length === 0) return;

        // 加载 mermaid（如果需要）
        const mermaidAvailable = await this.loadMermaid().catch(() => false);
        if (!mermaidAvailable) {
            console.warn('Mermaid.js 未加载，无法渲染图表');
            return;
        }

        // 处理每个未处理的 mermaid 代码块
        unprocessedBlocks.forEach((codeBlock, index) => {
            const preElement = codeBlock.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
                const mermaidId = `mermaid-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
                const mermaidContent = codeBlock.textContent || codeBlock.innerText || '';

                if (!mermaidContent.trim()) {
                    return; // 跳过空内容
                }

                // 创建 mermaid 容器
                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';
                mermaidDiv.id = mermaidId;
                mermaidDiv.textContent = mermaidContent;
                // 保存源代码以便后续复制功能使用
                mermaidDiv.setAttribute('data-mermaid-source', mermaidContent);
                mermaidDiv.style.cssText = `
                    background: rgba(255, 255, 255, 0.1) !important;
                    padding: 15px !important;
                    border-radius: 8px !important;
                    margin: 15px 0 !important;
                    overflow-x: auto !important;
                    min-height: 100px !important;
                `;

                // 标记为已处理
                codeBlock.classList.add('mermaid-processed');

                // 替换代码块
                try {
                    preElement.parentNode.replaceChild(mermaidDiv, preElement);

                    // 渲染 mermaid 图表 - 使用页面上下文中的 mermaid
                    // 因为 mermaid 在页面上下文中，我们需要通过注入脚本执行渲染
                    // 通过 data 属性传递渲染 ID（避免内联脚本）
                    // 为每个 mermaid 块使用唯一的容器 ID，避免冲突
                    const renderIdContainer = document.createElement('div');
                    renderIdContainer.id = `__mermaid_render_id_container__${mermaidId}`;
                    renderIdContainer.style.display = 'none';
                    renderIdContainer.setAttribute('data-mermaid-id', mermaidId);
                    // 确保容器在页面上下文中（不是在 content script 的隔离 DOM）
                    (document.head || document.documentElement).appendChild(renderIdContainer);

                    // 监听渲染结果（在加载脚本之前设置）
                    const handleRender = (event) => {
                        if (event.detail.id === mermaidId) {
                            window.removeEventListener('mermaid-rendered', handleRender);
                            if (!event.detail.success) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'mermaid-error';
                                errorDiv.style.cssText = `
                                    background: rgba(255, 0, 0, 0.1) !important;
                                    padding: 10px !important;
                                    border-radius: 5px !important;
                                    color: #ff6b6b !important;
                                    font-size: 12px !important;
                                    margin: 10px 0 !important;
                                `;
                                errorDiv.innerHTML = `
                                    <div>❌ Mermaid 图表渲染失败</div>
                                    <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                                `;
                                if (mermaidDiv.parentNode) {
                                    mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                                }
                            } else {
                                // 渲染成功，添加复制和下载按钮
                                setTimeout(() => {
                                    this.addMermaidActions(mermaidDiv, event.detail.svgContent || '', mermaidContent);
                                }, 100);
                            }
                            // 清理 ID 容器
                            if (renderIdContainer.parentNode) {
                                renderIdContainer.parentNode.removeChild(renderIdContainer);
                            }
                        }
                    };
                    window.addEventListener('mermaid-rendered', handleRender);

                    // 延迟加载渲染脚本，确保 mermaid div 已经添加到 DOM 且事件监听器已设置
                    // 增加延迟时间，确保 DOM 完全更新
                    setTimeout(() => {
                        // 再次检查 mermaid div 是否存在（确保 DOM 已更新）
                        const checkDiv = document.getElementById(mermaidId);
                        if (!checkDiv) {
                            console.warn('[ProcessMermaid] mermaid div 尚未准备好，延迟渲染:', mermaidId);
                            // 如果还没准备好，再等一会
                            setTimeout(() => {
                                const renderScript = document.createElement('script');
                                renderScript.src = chrome.runtime.getURL('render-mermaid.js');
                                renderScript.charset = 'UTF-8';
                                renderScript.async = false;
                                document.documentElement.appendChild(renderScript);

                                setTimeout(() => {
                                    if (renderScript.parentNode) {
                                        renderScript.parentNode.removeChild(renderScript);
                                    }
                                }, 3000);
                            }, 150);
                            return;
                        }

                        // 加载外部渲染脚本（避免 CSP 限制）
                        const renderScript = document.createElement('script');
                        renderScript.src = chrome.runtime.getURL('render-mermaid.js');
                        renderScript.charset = 'UTF-8';
                        renderScript.async = false;

                        // 注入渲染脚本到页面上下文
                        document.documentElement.appendChild(renderScript);

                        // 清理脚本（渲染完成后）
                        setTimeout(() => {
                            if (renderScript.parentNode) {
                                renderScript.parentNode.removeChild(renderScript);
                            }
                        }, 3000);
                    }, 200);
                } catch (error) {
                    console.error('替换 Mermaid 代码块时出错:', error);
                    // 出错时显示错误信息，但保留原始代码
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'mermaid-error';
                    errorDiv.style.cssText = `
                        background: rgba(255, 0, 0, 0.1) !important;
                        padding: 10px !important;
                        border-radius: 5px !important;
                        color: #ff6b6b !important;
                        font-size: 12px !important;
                        margin: 10px 0 !important;
                    `;
                    errorDiv.innerHTML = `
                        <div>❌ Mermaid 图表渲染失败</div>
                        <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                    `;
                    if (mermaidDiv.parentNode) {
                        mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                    }
                }
            }
        });
    }

    // 渲染 Markdown 为 HTML（保持同步以兼容现有代码）
    renderMarkdown(markdown) {
        if (!markdown) return '';

        try {
            // 检查 marked 是否可用
            if (typeof marked !== 'undefined') {
                // 配置 marked 以增强安全性
                marked.setOptions({
                    breaks: true, // 支持换行
                    gfm: true, // GitHub Flavored Markdown
                    sanitize: false // 允许 HTML，但我们会通过 DOMPurify 或其他方式处理
                });
                return marked.parse(markdown);
            } else {
                // 如果 marked 不可用，返回转义的纯文本
                return this.escapeHtml(markdown);
            }
        } catch (error) {
            console.error('渲染 Markdown 失败:', error);
            return this.escapeHtml(markdown);
        }
    }

    // 渲染 Markdown 并处理 Mermaid（完整流程）
    async renderMarkdownWithMermaid(markdown, container) {
        // 先渲染 Markdown
        const html = this.renderMarkdown(markdown);

        // 如果提供了容器，处理其中的 Mermaid 代码块
        if (container) {
            // 需要等待 DOM 更新后再处理
            setTimeout(async () => {
                await this.processMermaidBlocks(container);
            }, 100);
        }

        return html;
    }

    // HTML 转义辅助函数
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    // 为 Mermaid 图表添加复制和下载按钮
    addMermaidActions(mermaidDiv, svgContent, mermaidSourceCode) {
        if (!mermaidDiv) return;

        // 检查是否已经添加了按钮
        if (mermaidDiv.querySelector('.mermaid-actions')) {
            return;
        }

        // 创建按钮容器
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'mermaid-actions';
        actionsContainer.style.cssText = `
            position: absolute !important;
            top: 10px !important;
            right: 10px !important;
            display: flex !important;
            gap: 8px !important;
            z-index: 10 !important;
            opacity: 0 !important;
            transition: opacity 0.2s ease !important;
        `;

        // 确保 mermaid div 有相对定位
        const currentPosition = window.getComputedStyle(mermaidDiv).position;
        if (currentPosition === 'static') {
            mermaidDiv.style.position = 'relative';
        }

        // 创建复制按钮
        const copyButton = document.createElement('button');
        copyButton.className = 'mermaid-copy-button';
        copyButton.title = '复制 Mermaid 代码';
        copyButton.innerHTML = '📋';
        copyButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建下载 SVG 按钮
        const downloadButton = document.createElement('button');
        downloadButton.className = 'mermaid-download-button';
        downloadButton.title = '下载 SVG';
        downloadButton.innerHTML = '💾';
        downloadButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建下载 PNG 按钮
        const downloadPngButton = document.createElement('button');
        downloadPngButton.className = 'mermaid-download-png-button';
        downloadPngButton.title = '下载 PNG';
        downloadPngButton.innerHTML = '🖼️';
        downloadPngButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建编辑按钮（在新标签页打开 Mermaid Live Editor）
        const editButton = document.createElement('button');
        editButton.className = 'mermaid-edit-button';
        editButton.title = '在 Mermaid Live Editor 中打开';
        editButton.innerHTML = '✏️';
        editButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 获取 SVG 内容的辅助函数
        const getSvgContent = () => {
            return new Promise((resolve) => {
                // 首先尝试使用事件传递的内容
                if (svgContent) {
                    resolve(svgContent);
                    return;
                }

                // 尝试从 DOM 获取（content script 可以直接访问 DOM）
                const svgElement = mermaidDiv.querySelector('svg');
                if (svgElement) {
                    try {
                        const clone = svgElement.cloneNode(true);
                        if (!clone.getAttribute('xmlns')) {
                            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        }
                        const svgString = new XMLSerializer().serializeToString(clone);
                        resolve(svgString);
                        return;
                    } catch (error) {
                        console.warn('通过 DOM 获取 SVG 失败，尝试注入脚本:', error);
                    }
                }

                // 如果都失败，通过注入脚本从页面上下文获取
                const script = document.createElement('script');
                script.textContent = `
                    (function() {
                        const mermaidDiv = document.getElementById('${mermaidDiv.id}');
                        if (mermaidDiv) {
                            const svgElement = mermaidDiv.querySelector('svg');
                            if (svgElement) {
                                const clone = svgElement.cloneNode(true);
                                if (!clone.getAttribute('xmlns')) {
                                    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                                }
                                const svgString = new XMLSerializer().serializeToString(clone);
                                window.postMessage({
                                    type: 'mermaid-svg-content',
                                    id: '${mermaidDiv.id}',
                                    svgContent: svgString
                                }, '*');
                            }
                        }
                    })();
                `;
                document.documentElement.appendChild(script);

                const messageHandler = (event) => {
                    if (event.data && event.data.type === 'mermaid-svg-content' && event.data.id === mermaidDiv.id) {
                        window.removeEventListener('message', messageHandler);
                        document.documentElement.removeChild(script);
                        resolve(event.data.svgContent || '');
                    }
                };
                window.addEventListener('message', messageHandler);

                // 超时处理
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    if (script.parentNode) {
                        document.documentElement.removeChild(script);
                    }
                    resolve('');
                }, 1000);
            });
        };

        // 复制按钮点击事件 - 复制 Mermaid 源代码
        copyButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                // 优先使用传入的参数，其次从 data 属性获取
                let codeToCopy = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || '';

                if (codeToCopy) {
                    await navigator.clipboard.writeText(codeToCopy);
                    // 显示成功提示
                    copyButton.innerHTML = '✓';
                    copyButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    setTimeout(() => {
                        copyButton.innerHTML = '📋';
                        copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 Mermaid 源代码');
                }
            } catch (error) {
                console.error('复制 Mermaid 代码失败:', error);
                copyButton.innerHTML = '✗';
                copyButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                setTimeout(() => {
                    copyButton.innerHTML = '📋';
                    copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 下载 SVG 按钮点击事件
        downloadButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                const svg = await getSvgContent();

                if (svg) {
                    // 创建 Blob 并下载
                    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `mermaid-diagram-${Date.now()}.svg`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    // 显示成功提示
                    downloadButton.innerHTML = '✓';
                    downloadButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    setTimeout(() => {
                        downloadButton.innerHTML = '💾';
                        downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 SVG 内容');
                }
            } catch (error) {
                console.error('下载 SVG 失败:', error);
                downloadButton.innerHTML = '✗';
                downloadButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                setTimeout(() => {
                    downloadButton.innerHTML = '💾';
                    downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 将 SVG 转换为 PNG 的辅助函数
        const svgToPng = (svgString) => {
            return new Promise((resolve, reject) => {
                // 方法1: 优先尝试直接从 DOM 中的 SVG 元素绘制（最可靠，已渲染好的元素）
                const svgElementInDom = mermaidDiv.querySelector('svg');
                if (svgElementInDom) {
                    try {
                        // 获取 SVG 的实际尺寸
                        const bbox = svgElementInDom.getBBox();
                        let width = bbox.width || 800;
                        let height = bbox.height || 600;

                        // 如果 bbox 无效，尝试从属性获取
                        if (width <= 0 || height <= 0) {
                            width = parseFloat(svgElementInDom.getAttribute('width')) ||
                                   parseFloat(svgElementInDom.getAttribute('viewBox')?.split(/\s+/)[2]) || 800;
                            height = parseFloat(svgElementInDom.getAttribute('height')) ||
                                    parseFloat(svgElementInDom.getAttribute('viewBox')?.split(/\s+/)[3]) || 600;
                        }

                        // 确保宽高有效
                        if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
                            width = 800;
                            height = 600;
                        }

                        // 创建 Canvas
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const scale = 2; // 提高清晰度

                        canvas.width = width * scale;
                        canvas.height = height * scale;

                        // 设置白色背景
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // 将 SVG 序列化为字符串并创建 data URI
                        const clone = svgElementInDom.cloneNode(true);
                        if (!clone.getAttribute('xmlns')) {
                            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        }
                        // 确保有明确的宽高
                        if (!clone.getAttribute('width')) {
                            clone.setAttribute('width', width.toString());
                        }
                        if (!clone.getAttribute('height')) {
                            clone.setAttribute('height', height.toString());
                        }

                        const clonedSvgString = new XMLSerializer().serializeToString(clone);
                        const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clonedSvgString);

                        // 创建图片并绘制
                        const img = new Image();
                        img.onload = () => {
                            try {
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                canvas.toBlob((blob) => {
                                    if (blob) {
                                        resolve(blob);
                                    } else {
                                        // 如果 DOM 方法失败，回退到字符串方法
                                        tryStringMethod(svgString, width, height, resolve, reject);
                                    }
                                }, 'image/png');
                            } catch (error) {
                                // 如果 DOM 方法失败，回退到字符串方法
                                tryStringMethod(svgString, width, height, resolve, reject);
                            }
                        };
                        img.onerror = () => {
                            // 如果 DOM 方法失败，回退到字符串方法
                            tryStringMethod(svgString, width, height, resolve, reject);
                        };
                        img.src = svgDataUri;
                        return; // 成功启动 DOM 方法，退出
                    } catch (error) {
                        // DOM 方法出错，继续尝试字符串方法
                        console.warn('从 DOM 绘制 SVG 失败，尝试字符串方法:', error);
                    }
                }

                // 方法2: 使用 SVG 字符串（备选方案）
                tryStringMethod(svgString, null, null, resolve, reject);
            });

            // 辅助函数：尝试使用 SVG 字符串方法
            function tryStringMethod(svgString, preferredWidth, preferredHeight, resolve, reject) {
                try {
                    // 确保 SVG 字符串不为空
                    if (!svgString || typeof svgString !== 'string') {
                        reject(new Error('SVG 内容为空或无效'));
                        return;
                    }

                    // 解析 SVG 字符串以获取尺寸信息
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');

                    // 检查解析错误
                    const parserError = svgDoc.querySelector('parsererror');
                    if (parserError) {
                        reject(new Error('SVG 格式错误: ' + parserError.textContent));
                        return;
                    }

                    const svgElement = svgDoc.documentElement;

                    // 确保 SVG 有正确的命名空间
                    if (!svgElement.getAttribute('xmlns')) {
                        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    }

                    // 获取 SVG 的宽高
                    let width = preferredWidth || svgElement.getAttribute('width');
                    let height = preferredHeight || svgElement.getAttribute('height');

                    // 如果没有明确的宽高，尝试从 viewBox 获取
                    if (!width || !height) {
                        const viewBox = svgElement.getAttribute('viewBox');
                        if (viewBox) {
                            const parts = viewBox.split(/\s+/);
                            if (parts.length >= 4) {
                                width = parts[2];
                                height = parts[3];
                            }
                        }
                    }

                    // 如果还是没有，使用默认值或从实际渲染的元素获取
                    if (!width || !height || width === '0' || height === '0') {
                        const svgElementInDom = mermaidDiv.querySelector('svg');
                        if (svgElementInDom) {
                            try {
                                const bbox = svgElementInDom.getBBox();
                                width = bbox.width || '800';
                                height = bbox.height || '600';
                            } catch (e) {
                                width = '800';
                                height = '600';
                            }
                        } else {
                            width = '800';
                            height = '600';
                        }
                    }

                    // 移除单位（px, em 等），只保留数字
                    width = parseFloat(width) || 800;
                    height = parseFloat(height) || 600;

                    // 确保宽高有效
                    if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
                        width = 800;
                        height = 600;
                    }

                    // 重新序列化 SVG，确保格式正确
                    const serializer = new XMLSerializer();
                    let finalSvgString = serializer.serializeToString(svgElement);

                    // 如果 SVG 没有明确的宽高，在加载前设置
                    if (!svgElement.getAttribute('width') || !svgElement.getAttribute('height')) {
                        finalSvgString = finalSvgString.replace(
                            /<svg([^>]*)>/,
                            `<svg$1 width="${width}" height="${height}">`
                        );
                    }

                    // 使用 data URI
                    const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(finalSvgString);

                    const img = new Image();
                    img.crossOrigin = 'anonymous';

                    // 设置超时处理
                    const timeout = setTimeout(() => {
                        reject(new Error('加载 SVG 超时'));
                    }, 10000); // 10秒超时

                    img.onload = () => {
                        clearTimeout(timeout);
                        try {
                            // 创建 Canvas
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');

                            // 设置 Canvas 尺寸（可以设置缩放比例，默认 2x 提高清晰度）
                            const scale = 2;
                            // 使用实际图片尺寸或解析的尺寸
                            const finalWidth = (img.width && img.width > 0) ? img.width : width;
                            const finalHeight = (img.height && img.height > 0) ? img.height : height;

                            canvas.width = finalWidth * scale;
                            canvas.height = finalHeight * scale;

                            // 设置白色背景（PNG 需要背景色）
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);

                            // 绘制图片到 Canvas
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                            // 转换为 PNG
                            canvas.toBlob((blob) => {
                                if (blob) {
                                    resolve(blob);
                                } else {
                                    reject(new Error('Canvas 转换失败'));
                                }
                            }, 'image/png');
                        } catch (error) {
                            reject(new Error('处理图片时出错: ' + error.message));
                        }
                    };

                    img.onerror = () => {
                        clearTimeout(timeout);
                        // 最后尝试使用 Blob URL
                        try {
                            const svgBlob = new Blob([finalSvgString], { type: 'image/svg+xml;charset=utf-8' });
                            const svgUrl = URL.createObjectURL(svgBlob);

                            const img2 = new Image();
                            img2.crossOrigin = 'anonymous';

                            const timeout2 = setTimeout(() => {
                                URL.revokeObjectURL(svgUrl);
                                reject(new Error('加载 SVG 超时（使用 Blob URL）'));
                            }, 10000);

                            img2.onload = () => {
                                clearTimeout(timeout2);
                                try {
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');
                                    const scale = 2;
                                    const finalWidth = (img2.width && img2.width > 0) ? img2.width : width;
                                    const finalHeight = (img2.height && img2.height > 0) ? img2.height : height;

                                    canvas.width = finalWidth * scale;
                                    canvas.height = finalHeight * scale;

                                    ctx.fillStyle = '#ffffff';
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                    ctx.drawImage(img2, 0, 0, canvas.width, canvas.height);

                                    canvas.toBlob((blob) => {
                                        URL.revokeObjectURL(svgUrl);
                                        if (blob) {
                                            resolve(blob);
                                        } else {
                                            reject(new Error('Canvas 转换失败'));
                                        }
                                    }, 'image/png');
                                } catch (error) {
                                    URL.revokeObjectURL(svgUrl);
                                    reject(new Error('处理图片时出错: ' + error.message));
                                }
                            };

                            img2.onerror = () => {
                                clearTimeout(timeout2);
                                URL.revokeObjectURL(svgUrl);
                                reject(new Error('加载 SVG 图片失败：可能是 SVG 格式问题或包含无法加载的外部资源。请确保 SVG 不包含外部图片链接。'));
                            };

                            img2.src = svgUrl;
                        } catch (error) {
                            reject(new Error('加载 SVG 图片失败: ' + error.message));
                        }
                    };

                    img.src = svgDataUri;
                } catch (error) {
                    reject(new Error('处理 SVG 时出错: ' + error.message));
                }
            }
        };

        // 下载 PNG 按钮点击事件
        downloadPngButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                const svg = await getSvgContent();

                if (svg) {
                    // 显示加载状态
                    downloadPngButton.innerHTML = '⏳';
                    downloadPngButton.style.cursor = 'wait';

                    // 转换为 PNG
                    const pngBlob = await svgToPng(svg);

                    // 创建下载链接
                    const url = URL.createObjectURL(pngBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `mermaid-diagram-${Date.now()}.png`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    // 显示成功提示
                    downloadPngButton.innerHTML = '✓';
                    downloadPngButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    downloadPngButton.style.cursor = 'pointer';
                    setTimeout(() => {
                        downloadPngButton.innerHTML = '🖼️';
                        downloadPngButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 SVG 内容');
                }
            } catch (error) {
                console.error('下载 PNG 失败:', error);
                downloadPngButton.innerHTML = '✗';
                downloadPngButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                downloadPngButton.style.cursor = 'pointer';
                setTimeout(() => {
                    downloadPngButton.innerHTML = '🖼️';
                    downloadPngButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 编辑按钮点击事件 - 在新标签页打开 Mermaid Live Editor
        editButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                // 获取 Mermaid 源代码
                const codeToEdit = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || '';

                if (!codeToEdit || !codeToEdit.trim()) {
                    // 如果没有源代码，直接打开编辑器
                    window.open('https://mermaid.live/edit', '_blank');
                    return;
                }

                // 显示加载状态
                const originalHTML = editButton.innerHTML;
                editButton.innerHTML = '⏳';
                editButton.style.cursor = 'wait';

                // 同时使用多种方式传递代码，提高成功率
                let urlOpened = false;
                let clipboardSuccess = false;

                // 方式1: 优先将代码复制到剪贴板（最可靠的方式）
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(codeToEdit);
                        clipboardSuccess = true;
                        console.log('代码已复制到剪贴板');
                    }
                } catch (clipboardError) {
                    console.warn('复制到剪贴板失败，尝试 fallback 方法:', clipboardError);
                    // 如果 Clipboard API 失败，尝试使用 fallback 方法
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = codeToEdit;
                        textArea.style.position = 'fixed';
                        textArea.style.opacity = '0';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        if (successful) {
                            clipboardSuccess = true;
                            console.log('代码已通过 fallback 方法复制到剪贴板');
                        }
                    } catch (fallbackError) {
                        console.error('Fallback 复制方法也失败:', fallbackError);
                    }
                }

                // 方式2: 尝试通过 URL 传递代码（多种格式尝试）
                const urlFormats = [];

                // 格式1: state 参数（JSON 对象 base64 编码）
                try {
                    const stateObj = {
                        code: codeToEdit,
                        mermaid: { theme: 'default' }
                    };
                    const stateJson = JSON.stringify(stateObj);
                    const stateBase64 = btoa(unescape(encodeURIComponent(stateJson)));
                    urlFormats.push(`https://mermaid.live/edit#state/${stateBase64}`);
                } catch (e) {
                    console.warn('生成 state 格式 URL 失败:', e);
                }

                // 格式2: code 参数（代码直接 base64 编码）
                try {
                    const codeBase64 = btoa(unescape(encodeURIComponent(codeToEdit)));
                    urlFormats.push(`https://mermaid.live/edit#code/${codeBase64}`);
                } catch (e) {
                    console.warn('生成 code 格式 URL 失败:', e);
                }

                // 格式3: 查询参数方式
                try {
                    const encodedCode = encodeURIComponent(codeToEdit);
                    urlFormats.push(`https://mermaid.live/edit?code=${encodedCode}`);
                } catch (e) {
                    console.warn('生成查询参数 URL 失败:', e);
                }

                // 尝试打开编辑器（使用多种 URL 格式）
                for (const editorUrl of urlFormats) {
                    try {
                        const newWindow = window.open(editorUrl, '_blank');
                        if (newWindow) {
                            urlOpened = true;
                            console.log('Mermaid Live Editor 已打开，尝试通过 URL 传递代码');
                            break; // 成功打开后就停止尝试
                        }
                    } catch (error) {
                        console.warn('打开编辑器失败，尝试下一个 URL 格式:', error);
                    }
                }

                // 如果所有 URL 格式都失败，尝试使用基础 URL
                if (!urlOpened) {
                    try {
                        const newWindow = window.open('https://mermaid.live/edit', '_blank');
                        urlOpened = !!newWindow;
                        if (urlOpened) {
                            console.log('Mermaid Live Editor 已打开（代码已在剪贴板中）');
                        }
                    } catch (error) {
                        console.error('打开编辑器窗口失败:', error);
                    }
                }


                // 显示成功提示
                setTimeout(() => {
                    // 根据结果显示不同的提示
                    let tipMessage = '';
                    if (clipboardSuccess && urlOpened) {
                        tipMessage = '✓ 编辑器已打开，代码已复制到剪贴板';
                    } else if (clipboardSuccess) {
                        tipMessage = '✓ 代码已复制到剪贴板，请在新打开的编辑器中粘贴';
                    } else if (urlOpened) {
                        tipMessage = '✓ 编辑器已打开';
                    } else {
                        tipMessage = '⚠️ 编辑器已打开，请手动复制代码';
                    }

                    // 更新按钮状态
                    if (clipboardSuccess || urlOpened) {
                        editButton.innerHTML = '✓';
                        editButton.style.background = clipboardSuccess ? 'rgba(76, 175, 80, 0.3) !important' : 'rgba(255, 193, 7, 0.3) !important';
                    }

                    // 创建临时提示（仅在成功复制或打开时显示）
                    if (clipboardSuccess || urlOpened) {
                        const tip = document.createElement('div');
                        tip.textContent = tipMessage;
                        tip.style.cssText = `
                            position: fixed !important;
                            top: 50% !important;
                            left: 50% !important;
                            transform: translate(-50%, -50%) !important;
                            background: rgba(0, 0, 0, 0.85) !important;
                            color: white !important;
                            padding: 14px 28px !important;
                            border-radius: 8px !important;
                            font-size: 14px !important;
                            z-index: 10000 !important;
                            pointer-events: none !important;
                            animation: fadeInOut 2.5s ease-in-out !important;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                            max-width: 90% !important;
                            text-align: center !important;
                            word-wrap: break-word !important;
                        `;

                        // 添加动画样式（如果还没有）
                        if (!document.getElementById('mermaid-tip-styles')) {
                            const style = document.createElement('style');
                            style.id = 'mermaid-tip-styles';
                            style.textContent = `
                                @keyframes fadeInOut {
                                    0%, 100% { opacity: 0; transform: translate(-50%, -50%) translateY(-10px); }
                                    10%, 90% { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
                                }
                            `;
                            document.head.appendChild(style);
                        }

                        document.body.appendChild(tip);
                        setTimeout(() => {
                            if (tip.parentNode) {
                                tip.parentNode.removeChild(tip);
                            }
                        }, 2500);
                    }

                    // 恢复按钮状态
                    setTimeout(() => {
                        editButton.innerHTML = originalHTML;
                        editButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                        editButton.style.cursor = 'pointer';
                    }, 2000);
                }, 100);

            } catch (error) {
                console.error('打开 Mermaid Live Editor 失败:', error);
                // 出错时仍尝试打开编辑器
                try {
                    window.open('https://mermaid.live/edit', '_blank');
                } catch (openError) {
                    console.error('无法打开编辑器窗口:', openError);
                }
                // 恢复按钮状态
                setTimeout(() => {
                    editButton.innerHTML = '✏️';
                    editButton.style.cursor = 'pointer';
                }, 1000);
            }
        });

        // 创建全屏按钮
        const fullscreenButton = document.createElement('button');
        fullscreenButton.className = 'mermaid-fullscreen-button';
        fullscreenButton.title = '全屏查看';
        fullscreenButton.innerHTML = '⛶';
        fullscreenButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 全屏按钮点击事件
        fullscreenButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.openMermaidFullscreen(mermaidDiv, mermaidSourceCode);
        });

        // 悬停显示按钮
        mermaidDiv.addEventListener('mouseenter', () => {
            actionsContainer.style.opacity = '1';
        });
        mermaidDiv.addEventListener('mouseleave', () => {
            actionsContainer.style.opacity = '0';
        });

        actionsContainer.appendChild(copyButton);
        actionsContainer.appendChild(downloadButton);
        actionsContainer.appendChild(downloadPngButton);
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(fullscreenButton);
        mermaidDiv.appendChild(actionsContainer);

        // 按钮悬停效果
        copyButton.addEventListener('mouseenter', () => {
            copyButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            copyButton.style.transform = 'scale(1.1)';
            copyButton.style.opacity = '1';
        });
        copyButton.addEventListener('mouseleave', () => {
            copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            copyButton.style.transform = 'scale(1)';
            copyButton.style.opacity = '0.8';
        });

        downloadButton.addEventListener('mouseenter', () => {
            downloadButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            downloadButton.style.transform = 'scale(1.1)';
            downloadButton.style.opacity = '1';
        });
        downloadButton.addEventListener('mouseleave', () => {
            downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            downloadButton.style.transform = 'scale(1)';
            downloadButton.style.opacity = '0.8';
        });

        downloadPngButton.addEventListener('mouseenter', () => {
            downloadPngButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            downloadPngButton.style.transform = 'scale(1.1)';
            downloadPngButton.style.opacity = '1';
        });
        downloadPngButton.addEventListener('mouseleave', () => {
            downloadPngButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            downloadPngButton.style.transform = 'scale(1)';
            downloadPngButton.style.opacity = '0.8';
        });

        editButton.addEventListener('mouseenter', () => {
            editButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            editButton.style.transform = 'scale(1.1)';
            editButton.style.opacity = '1';
        });
        editButton.addEventListener('mouseleave', () => {
            editButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            editButton.style.transform = 'scale(1)';
            editButton.style.opacity = '0.8';
        });

        fullscreenButton.addEventListener('mouseenter', () => {
            fullscreenButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            fullscreenButton.style.transform = 'scale(1.1)';
            fullscreenButton.style.opacity = '1';
        });
        fullscreenButton.addEventListener('mouseleave', () => {
            fullscreenButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            fullscreenButton.style.transform = 'scale(1)';
            fullscreenButton.style.opacity = '0.8';
        });
    }

    // 打开 Mermaid 图表全屏查看
    openMermaidFullscreen(mermaidDiv, mermaidSourceCode) {
        // 检查是否已经存在全屏容器
        const existingFullscreen = document.getElementById('mermaid-fullscreen-container');
        if (existingFullscreen) {
            existingFullscreen.remove();
        }

        // 获取聊天窗口
        const chatWindow = document.getElementById('pet-chat-window');
        if (!chatWindow) {
            console.error('找不到聊天窗口');
            return;
        }

        // 获取聊天窗口的位置和尺寸
        const chatRect = chatWindow.getBoundingClientRect();

        // 创建全屏容器
        const fullscreenContainer = document.createElement('div');
        fullscreenContainer.id = 'mermaid-fullscreen-container';
        // 使用比聊天窗口更高的 z-index（聊天窗口是 2147483648）
        const fullscreenZIndex = 2147483649;
        fullscreenContainer.style.cssText = `
            position: fixed !important;
            top: ${chatRect.top}px !important;
            left: ${chatRect.left}px !important;
            width: ${chatRect.width}px !important;
            height: ${chatRect.height}px !important;
            background: rgba(0, 0, 0, 0.95) !important;
            z-index: ${fullscreenZIndex} !important;
            display: flex !important;
            flex-direction: column !important;
            border-radius: 8px !important;
            overflow: hidden !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
        `;

        // 创建头部栏（包含关闭按钮）
        const headerBar = document.createElement('div');
        headerBar.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 10px 15px !important;
            background: rgba(255, 255, 255, 0.1) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            flex-shrink: 0 !important;
        `;

        const title = document.createElement('div');
        title.textContent = 'Mermaid 图表全屏查看';
        title.style.cssText = `
            color: white !important;
            font-size: 14px !important;
            font-weight: 500 !important;
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.title = '关闭全屏';
        closeButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            color: white !important;
            font-size: 18px !important;
            cursor: pointer !important;
            width: 28px !important;
            height: 28px !important;
            border-radius: 4px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
        `;
        closeButton.addEventListener('click', () => {
            fullscreenContainer.remove();
        });
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
        });

        headerBar.appendChild(title);
        headerBar.appendChild(closeButton);

        // 创建内容区域
        const contentArea = document.createElement('div');
        contentArea.style.cssText = `
            flex: 1 !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: stretch !important;
            justify-content: stretch !important;
            padding: 0 !important;
            position: relative !important;
        `;

        // 克隆 mermaid 图表
        const clonedMermaid = mermaidDiv.cloneNode(true);
        clonedMermaid.style.cssText = `
            width: 100% !important;
            height: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            background: rgba(255, 255, 255, 0.1) !important;
            padding: 20px !important;
            border-radius: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
        `;

        // 移除克隆元素中的操作按钮
        const clonedActions = clonedMermaid.querySelector('.mermaid-actions');
        if (clonedActions) {
            clonedActions.remove();
        }

        // 调整 SVG 样式使其自适应
        const adjustSvgSize = () => {
            const svg = clonedMermaid.querySelector('svg');
            if (svg) {
                svg.style.cssText = `
                    width: 100% !important;
                    height: 100% !important;
                    max-width: 100% !important;
                    max-height: 100% !important;
                `;
                // 确保 SVG 有 viewBox 属性以便自适应
                if (!svg.getAttribute('viewBox') && svg.getAttribute('width') && svg.getAttribute('height')) {
                    const width = svg.getAttribute('width');
                    const height = svg.getAttribute('height');
                    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
                    svg.removeAttribute('width');
                    svg.removeAttribute('height');
                }
            }
        };

        contentArea.appendChild(clonedMermaid);

        // 组装全屏容器
        fullscreenContainer.appendChild(headerBar);
        fullscreenContainer.appendChild(contentArea);

        // 添加到页面
        document.body.appendChild(fullscreenContainer);

        // 添加四个角的拖拽调整大小功能
        this.addResizeHandles(fullscreenContainer, chatWindow);

        // 重新渲染 mermaid（如果需要）
        const clonedMermaidId = clonedMermaid.id || `mermaid-fullscreen-${Date.now()}`;
        clonedMermaid.id = clonedMermaidId;

        // 如果克隆的图表还没有渲染，需要重新渲染
        if (!clonedMermaid.querySelector('svg')) {
            const mermaidContent = mermaidSourceCode || clonedMermaid.getAttribute('data-mermaid-source') || clonedMermaid.textContent || '';
            if (mermaidContent.trim()) {
                clonedMermaid.textContent = mermaidContent;
                clonedMermaid.className = 'mermaid';

                // 使用注入脚本重新渲染
                const renderIdContainer = document.createElement('div');
                renderIdContainer.id = `__mermaid_render_id_container__${clonedMermaidId}`;
                renderIdContainer.setAttribute('data-mermaid-id', clonedMermaidId);
                renderIdContainer.style.display = 'none';
                document.body.appendChild(renderIdContainer);

                const handleRender = (event) => {
                    if (event.detail.id === clonedMermaidId) {
                        window.removeEventListener('mermaid-rendered', handleRender);
                        renderIdContainer.remove();
                        // 渲染完成后调整 SVG 大小
                        setTimeout(() => {
                            adjustSvgSize();
                        }, 100);
                    }
                };
                window.addEventListener('mermaid-rendered', handleRender);

                setTimeout(() => {
                    const renderScript = document.createElement('script');
                    renderScript.src = chrome.runtime.getURL('render-mermaid.js');
                    renderScript.onload = () => {
                        if (renderScript.parentNode) {
                            renderScript.parentNode.removeChild(renderScript);
                        }
                    };
                    document.documentElement.appendChild(renderScript);
                }, 100);
            }
        } else {
            // 如果已经有 SVG，立即调整大小
            setTimeout(() => {
                adjustSvgSize();
            }, 100);
        }

        // 监听窗口大小变化和容器大小变化，自适应调整图表
        const resizeObserver = new ResizeObserver(() => {
            adjustSvgSize();
        });
        resizeObserver.observe(fullscreenContainer);
        resizeObserver.observe(contentArea);

        // 当全屏容器被移除时，清理观察者
        const originalRemove = fullscreenContainer.remove.bind(fullscreenContainer);
        fullscreenContainer.remove = function() {
            resizeObserver.disconnect();
            originalRemove();
        };
    }

    // 添加四个角的拖拽调整大小功能
    addResizeHandles(container, chatWindow) {
        const handles = ['nw', 'ne', 'sw', 'se']; // 四个角：左上、右上、左下、右下
        const handleSize = 12;
        let isResizing = false;
        let resizeHandle = null;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        let startLeft = 0;
        let startTop = 0;

        handles.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-handle-${position}`;
            handle.style.cssText = `
                position: absolute !important;
                width: ${handleSize}px !important;
                height: ${handleSize}px !important;
                background: rgba(255, 255, 255, 0.3) !important;
                border: 2px solid rgba(255, 255, 255, 0.6) !important;
                border-radius: 2px !important;
                cursor: ${this.getResizeCursor(position)} !important;
                z-index: 1000 !important;
                transition: all 0.2s ease !important;
            `;

            // 设置位置
            switch(position) {
                case 'nw': // 左上
                    handle.style.top = '0';
                    handle.style.left = '0';
                    break;
                case 'ne': // 右上
                    handle.style.top = '0';
                    handle.style.right = '0';
                    break;
                case 'sw': // 左下
                    handle.style.bottom = '0';
                    handle.style.left = '0';
                    break;
                case 'se': // 右下
                    handle.style.bottom = '0';
                    handle.style.right = '0';
                    break;
            }

            // 鼠标悬停效果
            handle.addEventListener('mouseenter', () => {
                handle.style.background = 'rgba(255, 255, 255, 0.5) !important';
                handle.style.borderColor = 'rgba(255, 255, 255, 0.9) !important';
                handle.style.transform = 'scale(1.2)';
            });
            handle.addEventListener('mouseleave', () => {
                if (!isResizing) {
                    handle.style.background = 'rgba(255, 255, 255, 0.3) !important';
                    handle.style.borderColor = 'rgba(255, 255, 255, 0.6) !important';
                    handle.style.transform = 'scale(1)';
                }
            });

            // 鼠标按下开始调整大小
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                resizeHandle = position;
                startX = e.clientX;
                startY = e.clientY;
                const rect = container.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                startLeft = rect.left;
                startTop = rect.top;

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });

            container.appendChild(handle);
        });

        const handleMouseMove = (e) => {
            if (!isResizing || !resizeHandle) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const chatRect = chatWindow.getBoundingClientRect();
            const minWidth = 300;
            const minHeight = 200;
            const maxWidth = window.innerWidth;
            const maxHeight = window.innerHeight;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            switch(resizeHandle) {
                case 'nw': // 左上角
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
                    newLeft = startLeft + (startWidth - newWidth);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'ne': // 右上角
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'sw': // 左下角
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
                    newLeft = startLeft + (startWidth - newWidth);
                    break;
                case 'se': // 右下角
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
                    break;
            }

            // 确保不超出窗口边界
            newLeft = Math.max(0, Math.min(window.innerWidth - newWidth, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - newHeight, newTop));

            container.style.width = `${newWidth}px`;
            container.style.height = `${newHeight}px`;
            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;

            // 调整大小后，触发图表自适应（ResizeObserver 会自动处理，这里可以添加防抖优化）
        };

        const handleMouseUp = () => {
            isResizing = false;
            resizeHandle = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }

    // 获取调整大小的光标样式
    getResizeCursor(position) {
        switch(position) {
            case 'nw': return 'nw-resize';
            case 'ne': return 'ne-resize';
            case 'sw': return 'sw-resize';
            case 'se': return 'se-resize';
            default: return 'default';
        }
    }

    // 创建消息元素
    createMessageElement(text, sender, imageDataUrl = null, timestamp = null) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            display: flex !important;
            margin-bottom: 15px !important;
            animation: messageSlideIn 0.3s ease-out !important;
        `;

        if (sender === 'user') {
            messageDiv.style.flexDirection = 'row-reverse';
        }

        // 获取宠物颜色用于宠物消息
        const currentColor = this.colors[this.colorIndex];

        const avatar = document.createElement('div');
        avatar.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 16px !important;
            margin-right: 10px !important;
            flex-shrink: 0 !important;
            background: ${sender === 'user' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : currentColor} !important;
        `;
        avatar.textContent = sender === 'user' ? '👤' : '🐾';
        // 添加标识以便后续更新
        if (sender === 'pet') {
            avatar.setAttribute('data-message-type', 'pet-avatar');
        }

        if (sender === 'user') {
            avatar.style.marginRight = '0';
            avatar.style.marginLeft = '10px';
        }

        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1 !important;
            min-width: 0 !important;
        `;

        const messageText = document.createElement('div');
        messageText.style.cssText = `
            background: ${sender === 'user' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : currentColor} !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 12px !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
            word-wrap: break-word !important;
            position: relative !important;
            max-width: 80% !important;
            width: 100% !important;
            margin-left: ${sender === 'user' ? 'auto' : '0'} !important;
            user-select: text !important;
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            overflow: hidden !important;
        `;

        // 为宠物消息和用户消息添加 Markdown 样式
        if (sender === 'pet' || sender === 'user') {
            messageText.classList.add('markdown-content');
        }

        // 添加标识以便后续更新
        if (sender === 'pet') {
            messageText.setAttribute('data-message-type', 'pet-bubble');
        } else {
            messageText.setAttribute('data-message-type', 'user-bubble');
        }

        // 为消息保存原始文本用于复制和编辑功能
        if (text) {
            if (sender === 'pet') {
                messageText.setAttribute('data-original-text', text);
            } else {
                // 用户消息也保存原始文本，用于编辑功能
                messageText.setAttribute('data-original-text', text);
            }
        }

        if (sender === 'user') {
            messageText.style.borderBottomRightRadius = '4px';
        } else {
            messageText.style.borderBottomLeftRadius = '4px';
        }

        // 如果包含图片，添加图片元素
        if (imageDataUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
                margin-bottom: ${text ? '8px' : '0'} !important;
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
            messageText.appendChild(imageContainer);
        }

        // 如果有文本，添加文本（支持 Markdown 渲染）
        if (text) {
            if (sender === 'pet') {
                // 对于宠物消息，使用 Markdown 渲染
                const displayText = this.renderMarkdown(text);
                if (imageDataUrl) {
                    // 如果已经添加了图片，则追加文本
                    const textSpan = document.createElement('span');
                    textSpan.innerHTML = displayText;
                    messageText.appendChild(textSpan);
                } else {
                    messageText.innerHTML = displayText;
                    // 对于宠物消息，处理可能的 Mermaid 图表
                    if (!messageText.hasAttribute('data-mermaid-processing')) {
                        messageText.setAttribute('data-mermaid-processing', 'true');
                        setTimeout(async () => {
                            await this.processMermaidBlocks(messageText);
                            messageText.removeAttribute('data-mermaid-processing');
                        }, 100);
                    }
                }
            } else {
                // 对于用户消息，使用 Markdown 渲染（与 pet 消息一致）
                const displayText = this.renderMarkdown(text);
                if (imageDataUrl) {
                    // 如果已经添加了图片，则追加文本
                    const textSpan = document.createElement('span');
                    textSpan.innerHTML = displayText;
                    messageText.appendChild(textSpan);
                } else {
                    messageText.innerHTML = displayText;
                }
                // 处理可能的 Mermaid 图表
                if (!messageText.hasAttribute('data-mermaid-processing')) {
                    messageText.setAttribute('data-mermaid-processing', 'true');
                    setTimeout(async () => {
                        try {
                            await this.loadMermaid();
                            const hasMermaidCode = messageText.querySelector('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
                            if (hasMermaidCode) {
                                await this.processMermaidBlocks(messageText);
                            }
                        } catch (error) {
                            console.error('处理用户消息的 Mermaid 图表时出错:', error);
                        }
                        messageText.removeAttribute('data-mermaid-processing');
                    }, 100);
                }
            }
        } else if (imageDataUrl) {
            // 如果没有文本只有图片，保持容器为空
            messageText.style.padding = '0';
        }

        const messageTime = document.createElement('div');
        messageTime.setAttribute('data-message-time', 'true');
        messageTime.style.cssText = `
            font-size: 11px !important;
            color: #999 !important;
            margin-top: 4px !important;
        `;
        // 如果有时间戳，使用时间戳；否则使用当前时间
        messageTime.textContent = timestamp ? this.formatTimestamp(timestamp) : this.getCurrentTime();

        content.appendChild(messageText);

        // 为宠物消息创建时间和复制按钮的容器
        if (sender === 'pet') {
            const timeAndCopyContainer = document.createElement('div');
            timeAndCopyContainer.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                max-width: calc(80% + 36px) !important;
                width: 100% !important;
                margin-top: 4px !important;
            `;

            const messageTimeWrapper = document.createElement('div');
            messageTimeWrapper.style.cssText = 'flex: 1;';
            messageTimeWrapper.appendChild(messageTime);
            timeAndCopyContainer.appendChild(messageTimeWrapper);

            const copyButtonContainer = document.createElement('div');
            copyButtonContainer.setAttribute('data-copy-button-container', 'true');
            copyButtonContainer.style.cssText = 'display: none; margin-left: 8px;';
            timeAndCopyContainer.appendChild(copyButtonContainer);

            // 添加 try again 按钮容器
            const tryAgainButtonContainer = document.createElement('div');
            tryAgainButtonContainer.setAttribute('data-try-again-button-container', 'true');
            tryAgainButtonContainer.style.cssText = 'display: none; margin-left: 8px; align-items: center;';
            timeAndCopyContainer.appendChild(tryAgainButtonContainer);

            content.appendChild(timeAndCopyContainer);

            // 如果已经有文本，立即添加复制按钮
            if (text && text.trim()) {
                this.addCopyButton(copyButtonContainer, messageText);
            }

            // 为宠物消息添加导出图片按钮
            this.addExportButtonForMessage(copyButtonContainer, messageDiv, 'pet');

            // 为消息元素添加标识，用于后续判断是否是第一个消息
            messageDiv.setAttribute('data-message-id', Date.now().toString());
        } else {
            // 用户消息创建时间和删除按钮的容器（与气泡宽度对齐）
            const timeAndCopyContainer = document.createElement('div');
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

            const messageTimeWrapper = document.createElement('div');
            messageTimeWrapper.style.cssText = `
                margin: 0 !important;
                padding: 0 !important;
                display: flex !important;
                align-items: flex-start !important;
            `;
            messageTime.style.cssText = `
                font-size: 11px !important;
                color: #999 !important;
                margin: 0 !important;
                padding: 0 !important;
            `;
            messageTimeWrapper.appendChild(messageTime);

            const copyButtonContainer = document.createElement('div');
            copyButtonContainer.setAttribute('data-copy-button-container', 'true');
            copyButtonContainer.style.cssText = 'display: flex;';
            timeAndCopyContainer.appendChild(copyButtonContainer);
            timeAndCopyContainer.appendChild(messageTimeWrapper);

            content.appendChild(timeAndCopyContainer);

            // 为用户消息添加复制按钮（包括复制和删除按钮）
            if (text && text.trim()) {
                this.addCopyButton(copyButtonContainer, messageText);
            }

            // 为用户消息添加删除、编辑和重新发送按钮
            this.addDeleteButtonForUserMessage(copyButtonContainer, messageText);

            // 为用户消息添加导出图片按钮（在编辑按钮后面）
            this.addExportButtonForMessage(copyButtonContainer, messageDiv, 'user');

            // 同步时间容器与气泡的宽度和位置，确保精确对齐
            const syncTimeContainerAlignment = () => {
                // 使用双重 requestAnimationFrame 确保 DOM 完全渲染
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const bubbleRect = messageText.getBoundingClientRect();
                        const containerRect = timeAndCopyContainer.getBoundingClientRect();

                        // 同步宽度：直接使用气泡的实际宽度
                        if (bubbleRect.width > 0) {
                            timeAndCopyContainer.style.width = `${bubbleRect.width}px`;
                            timeAndCopyContainer.style.maxWidth = `${bubbleRect.width}px`;
                        }

                        // 重新获取容器位置以检查对齐
                        const updatedContainerRect = timeAndCopyContainer.getBoundingClientRect();

                        // 检查并修正左边缘对齐（允许1px的误差）
                        if (Math.abs(bubbleRect.left - updatedContainerRect.left) > 1) {
                            // 计算相对于父容器的偏移
                            const contentRect = content.getBoundingClientRect();
                            const bubbleOffset = bubbleRect.left - contentRect.left;
                            const containerOffset = updatedContainerRect.left - contentRect.left;

                            // 计算需要的 margin-left 调整
                            const marginDiff = bubbleOffset - containerOffset;

                            // 获取当前计算后的 margin-left 值（即使 CSS 是 auto，计算值也是像素）
                            const computedStyle = window.getComputedStyle(timeAndCopyContainer);
                            const computedMarginLeft = computedStyle.marginLeft;
                            const numericMargin = parseFloat(computedMarginLeft) || 0;

                            // 应用修正后的 margin-left
                            timeAndCopyContainer.style.marginLeft = `${numericMargin + marginDiff}px`;
                        }
                    });
                });
            };

            // 立即同步一次
            syncTimeContainerAlignment();

            // 监听气泡大小变化，自动重新同步
            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(() => {
                    syncTimeContainerAlignment();
                });
                resizeObserver.observe(messageText);

                // 将 observer 保存到元素上，以便后续清理（如果需要）
                messageText._timeContainerObserver = resizeObserver;
            }

            // 延迟再次同步，确保所有内容都已渲染
            setTimeout(syncTimeContainerAlignment, 100);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        return messageDiv;
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
        exportBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 50% !important;
            width: 22px !important;
            height: 22px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            color: currentColor !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            flex-shrink: 0 !important;
            margin-left: 4px !important;
            padding: 0 !important;
        `;

        // 悬停效果
        exportBtn.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(59, 130, 246, 0.3) !important';
            this.style.transform = 'scale(1.1)';
            this.style.opacity = '1';
        });

        exportBtn.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, 0.2) !important';
            this.style.transform = 'scale(1)';
            this.style.opacity = '0.8';
        });

        // 点击事件
        exportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 调用导出函数
            if (window.exportSingleMessageToPNG) {
                await window.exportSingleMessageToPNG(messageDiv, messageType);
            } else {
                console.error('导出函数未加载');
                this.showNotification('导出功能未加载，请刷新页面后重试', 'error');
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
        messageDiv.style.cssText = `
            display: flex !important;
            margin-bottom: 15px !important;
            animation: messageSlideIn 0.3s ease-out !important;
        `;

        const avatar = document.createElement('div');
        avatar.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 16px !important;
            margin-right: 10px !important;
            flex-shrink: 0 !important;
            background: ${currentColor} !important;
            animation: petTyping 1.2s ease-in-out infinite !important;
        `;
        avatar.textContent = indicatorIcon;
        avatar.setAttribute('data-message-type', 'pet-avatar');

        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1 !important;
            min-width: 0 !important;
        `;

        const messageText = document.createElement('div');
        messageText.style.cssText = `
            background: ${currentColor} !important;
            color: white !important;
            padding: 12px 16px !important;
            border-radius: 12px !important;
            border-bottom-left-radius: 4px !important;
            font-size: 14px !important;
            line-height: 1.6 !important;
            max-width: 80% !important;
        `;
        messageText.setAttribute('data-message-type', 'pet-bubble');
        messageText.textContent = '💭 正在思考中...';

        const messageTime = document.createElement('div');
        messageTime.style.cssText = `
            font-size: 11px !important;
            color: #999 !important;
            margin-top: 4px !important;
            text-align: left !important;
        `;

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

        // 创建复制按钮
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '📋';
        copyButton.setAttribute('title', '复制消息');

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
                    copyButton.style.color = '#4caf50';
                    setTimeout(() => {
                        copyButton.innerHTML = originalHTML;
                        copyButton.style.color = '';
                    }, 1000);
                } else {
                    // 降级方案：使用传统的复制方法
                    const textArea = document.createElement('textarea');
                    textArea.value = messageContent.trim();
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    this.showNotification('已复制到剪贴板', 'success');

                    // 临时改变按钮图标，表示复制成功
                    const originalHTML = copyButton.innerHTML;
                    copyButton.innerHTML = '✓';
                    copyButton.style.color = '#4caf50';
                    setTimeout(() => {
                        copyButton.innerHTML = originalHTML;
                        copyButton.style.color = '';
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
            // 创建删除按钮
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '🗑️';
            deleteButton.setAttribute('title', '删除消息');

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

            // 创建编辑按钮（用户消息和宠物消息都显示）
            const editButton = document.createElement('button');
            editButton.className = 'edit-button';
            editButton.innerHTML = '✏️';
            editButton.setAttribute('title', '编辑消息');

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

        container.style.display = 'flex';
        container.style.gap = '8px';
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
        sortUpButton.className = 'sort-up-button';
        sortUpButton.innerHTML = '⬆️';
        sortUpButton.setAttribute('title', '上移消息');
        sortUpButton.style.cssText = `
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            padding: 4px 8px !important;
            opacity: ${currentIndex > 0 ? '0.7' : '0.3'} !important;
            transition: opacity 0.2s ease, transform 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 14px !important;
            min-width: 24px !important;
            min-height: 24px !important;
            pointer-events: ${currentIndex > 0 ? 'auto' : 'none'} !important;
        `;

        // 悬停效果
        sortUpButton.addEventListener('mouseenter', () => {
            if (currentIndex > 0) {
                sortUpButton.style.opacity = '1';
                sortUpButton.style.transform = 'scale(1.1)';
            }
        });
        sortUpButton.addEventListener('mouseleave', () => {
            if (currentIndex > 0) {
                sortUpButton.style.opacity = '0.7';
                sortUpButton.style.transform = 'scale(1)';
            }
        });

        // 点击上移
        sortUpButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (currentIndex > 0) {
                await this.moveMessageUp(messageDiv, currentIndex);
            }
        });

        // 创建下移按钮
        const sortDownButton = document.createElement('button');
        sortDownButton.className = 'sort-down-button';
        sortDownButton.innerHTML = '⬇️';
        sortDownButton.setAttribute('title', '下移消息');
        sortDownButton.style.cssText = `
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            padding: 4px 8px !important;
            opacity: ${currentIndex < allMessages.length - 1 ? '0.7' : '0.3'} !important;
            transition: opacity 0.2s ease, transform 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 14px !important;
            min-width: 24px !important;
            min-height: 24px !important;
            pointer-events: ${currentIndex < allMessages.length - 1 ? 'auto' : 'none'} !important;
        `;

        // 悬停效果
        sortDownButton.addEventListener('mouseenter', () => {
            if (currentIndex < allMessages.length - 1) {
                sortDownButton.style.opacity = '1';
                sortDownButton.style.transform = 'scale(1.1)';
            }
        });
        sortDownButton.addEventListener('mouseleave', () => {
            if (currentIndex < allMessages.length - 1) {
                sortDownButton.style.opacity = '0.7';
                sortDownButton.style.transform = 'scale(1)';
            }
        });

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
                sortUpButton.style.opacity = canMoveUp ? '0.7' : '0.3';
                sortUpButton.style.pointerEvents = canMoveUp ? 'auto' : 'none';
            }

            if (sortDownButton) {
                const canMoveDown = index < allMessages.length - 1;
                sortDownButton.style.opacity = canMoveDown ? '0.7' : '0.3';
                sortDownButton.style.pointerEvents = canMoveDown ? 'auto' : 'none';
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
                </svg>`,
                opacity: '0.7',
                cursor: 'pointer',
                color: ''
            },
            loading: {
                icon: this._getWaitingIcon(),
                opacity: '0.6',
                cursor: 'not-allowed',
                color: ''
            },
            success: {
                icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`,
                opacity: '0.7',
                cursor: 'pointer',
                color: '#4caf50'
            },
            error: {
                icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`,
                opacity: '0.7',
                cursor: 'pointer',
                color: '#f44336'
            }
        };

        const buttonState = states[state] || states.idle;
        button.innerHTML = buttonState.icon;
        button.style.opacity = buttonState.opacity;
        button.style.cursor = buttonState.cursor;
        button.style.color = buttonState.color;
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
     * @returns {Function} 内容更新回调函数
     */
    _createStreamContentCallback(messageBubble, messagesContainer) {
        let fullContent = '';

        return (chunk, accumulatedContent) => {
            fullContent = accumulatedContent;
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
        messageBubble.innerHTML = this.renderMarkdown(`${waitingIcon} 正在重新生成回复...`);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 创建流式内容更新回调
        const onStreamContent = this._createStreamContentCallback(messageBubble, messagesContainer);

        // 创建 AbortController 用于终止请求
        const abortController = new AbortController();
        this._updateRequestStatus('loading', abortController);

        try {
            // 调用 API 重新生成
            const reply = await this.generatePetResponseStream(userMessageText, onStreamContent, abortController);

            // 确保最终内容被显示（流式更新可能已经完成，但再次确认）
            if (reply && reply.trim()) {
                messageBubble.innerHTML = this.renderMarkdown(reply);
                messageBubble.setAttribute('data-original-text', reply);
                setTimeout(async () => {
                    await this.processMermaidBlocks(messageBubble);
                }, 100);
            }

            // 更新复制按钮
            const copyButtonContainer = messageDiv.querySelector('[data-copy-button-container]');
            if (copyButtonContainer && reply && reply.trim()) {
                this.addCopyButton(copyButtonContainer, messageBubble);
            }

            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            return reply;
        } finally {
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
    addTryAgainButton(container, messageDiv) {
        // 如果已经添加过，就不再添加
        if (container.querySelector('.try-again-button')) {
            return;
        }

        // 如果是按钮操作生成的消息，不添加 try again 按钮
        if (messageDiv.hasAttribute('data-button-action')) {
            return;
        }

        const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
        if (!messagesContainer) {
            return;
        }

        // 创建重新生成按钮
        const tryAgainButton = document.createElement('button');
        tryAgainButton.className = 'try-again-button';
        tryAgainButton.setAttribute('title', '重新生成回复');
        tryAgainButton.setAttribute('aria-label', '重新生成回复');
        tryAgainButton.style.cssText = `
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            padding: 4px 8px !important;
            opacity: 0.7 !important;
            transition: opacity 0.2s ease, color 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: currentColor !important;
        `;

        // 初始化按钮状态
        this._updateTryAgainButtonState(tryAgainButton, 'idle');

        // 悬停效果
        tryAgainButton.addEventListener('mouseenter', () => {
            if (!tryAgainButton.hasAttribute('data-retrying')) {
                tryAgainButton.style.opacity = '1';
            }
        });
        tryAgainButton.addEventListener('mouseleave', () => {
            if (!tryAgainButton.hasAttribute('data-retrying')) {
                tryAgainButton.style.opacity = '0.7';
            }
        });

        // 点击重新生成
        tryAgainButton.addEventListener('click', async (e) => {
            e.stopPropagation();

            // 防止重复点击
            if (tryAgainButton.hasAttribute('data-retrying')) {
                return;
            }

            tryAgainButton.setAttribute('data-retrying', 'true');
            this._updateTryAgainButtonState(tryAgainButton, 'loading');

            try {
                // 查找对应的用户消息
                const userMessageText = this._findUserMessageForRetry(messageDiv, messagesContainer);

                if (!userMessageText) {
                    // 如果找不到用户消息，可能是通过按钮触发的操作
                    console.warn('未找到对应的用户消息，无法重新生成回复');

                    const messageBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
                    if (messageBubble) {
                        const originalText = messageBubble.getAttribute('data-original-text') ||
                                           messageBubble.textContent ||
                                           '此消息无法重新生成';
                        messageBubble.innerHTML = this.renderMarkdown(
                            `${originalText}\n\n💡 **提示**：此消息可能是通过按钮操作生成的，无法重新生成。`
                        );
                    }

                    this._updateTryAgainButtonState(tryAgainButton, 'idle');
                    tryAgainButton.removeAttribute('data-retrying');
                    return;
                }

                // 执行重新生成
                await this._retryGenerateResponse(messageDiv, userMessageText, messagesContainer);

                // 显示成功状态
                this._updateTryAgainButtonState(tryAgainButton, 'success');

                // 1.5秒后恢复为初始状态
                setTimeout(() => {
                    this._updateTryAgainButtonState(tryAgainButton, 'idle');
                    tryAgainButton.removeAttribute('data-retrying');
                }, 1500);

            } catch (error) {
                // 处理错误
                const isAbortError = this._handleRetryError(messageDiv, error);

                if (!isAbortError) {
                    // 显示错误状态
                    this._updateTryAgainButtonState(tryAgainButton, 'error');

                    // 1.5秒后恢复为初始状态
                    setTimeout(() => {
                        this._updateTryAgainButtonState(tryAgainButton, 'idle');
                        tryAgainButton.removeAttribute('data-retrying');
                    }, 1500);
                } else {
                    // 请求被取消，直接恢复状态
                    this._updateTryAgainButtonState(tryAgainButton, 'idle');
                    tryAgainButton.removeAttribute('data-retrying');
                }
            }
        });

        container.appendChild(tryAgainButton);
        container.style.display = 'flex';
        container.style.gap = '8px';

        // 确保容器可见
        if (container.style.display === 'none') {
            container.style.display = 'flex';
        }
    }

    // 为用户消息添加删除和编辑按钮
    addDeleteButtonForUserMessage(container, messageTextElement) {
        // 如果已经添加过，就不再添加
        if (container.querySelector('.delete-button') &&
            container.querySelector('.edit-button') &&
            container.querySelector('.resend-button')) {
            return;
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '🗑️';
        deleteButton.setAttribute('title', '删除消息');

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
                                    if (this.currentSessionId && this.sessionManager && this.sessionManager.enableBackendSync) {
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
                                            if (this.currentSessionId && this.sessionManager && this.sessionManager.enableBackendSync) {
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
        resendButton.className = 'resend-button';
        // 使用 SVG 图标替代 emoji，更专业美观
        resendButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
        `;
        resendButton.setAttribute('title', '重新发送 prompt 请求');

        // 设置按钮样式（与 try again 按钮保持一致）
        resendButton.style.cssText = `
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            padding: 4px 8px !important;
            opacity: 0.7 !important;
            transition: opacity 0.2s ease, color 0.2s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: currentColor !important;
            min-width: 24px !important;
            min-height: 24px !important;
        `;

        // 悬停效果
        resendButton.addEventListener('mouseenter', () => {
            resendButton.style.opacity = '1';
        });
        resendButton.addEventListener('mouseleave', () => {
            resendButton.style.opacity = '0.7';
        });

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
                while (currentMessage && !currentMessage.style.cssText.includes('margin-bottom: 15px')) {
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
                resendButton.style.opacity = '0.6';
                resendButton.style.cursor = 'not-allowed';
                resendButton.style.color = '';

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
                resendButton.style.color = '#4caf50';

                setTimeout(() => {
                    resendButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                            <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                    `;
                    resendButton.style.color = '';
                    resendButton.style.opacity = '0.7';
                    resendButton.style.cursor = 'pointer';
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
                resendButton.style.color = '#f44336';

                setTimeout(() => {
                    resendButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                            <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                    `;
                    resendButton.style.color = '';
                    resendButton.style.opacity = '0.7';
                    resendButton.style.cursor = 'pointer';
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
        textarea.style.cssText = `
            width: 100% !important;
            min-height: 80px !important;
            max-height: 400px !important;
            padding: 12px 16px !important;
            border: 2px solid rgba(255, 255, 255, 0.5) !important;
            border-radius: 8px !important;
            background: rgba(255, 255, 255, 0.2) !important;
            color: white !important;
            font-size: 14px !important;
            font-family: inherit !important;
            line-height: 1.6 !important;
            resize: vertical !important;
            outline: none !important;
            box-sizing: border-box !important;
            overflow-y: auto !important;
        `;
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

    // 发送图片消息
    async sendImageMessage(imageDataUrl) {
        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) return;

        // 确保有当前会话（如果没有，先初始化会话）
        if (!this.currentSessionId) {
            await this.initSession();
            // 更新聊天窗口标题
            this.updateChatHeaderTitle();
        }

        // 添加用户消息（带图片）
        const userMessage = this.createMessageElement('', 'user', imageDataUrl);
        messagesContainer.appendChild(userMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 添加用户消息到会话（注意：已移除自动保存，仅在保存时同步）
        await this.addMessageToSession('user', '', null, false, imageDataUrl);

        // 为用户消息添加操作按钮（包括机器人按钮）
        await this.addActionButtonsToMessage(userMessage);

        // 为用户消息添加删除、编辑和重新发送按钮
        const userBubble = userMessage.querySelector('[data-message-type="user-bubble"]');
        const copyButtonContainer = userMessage.querySelector('[data-copy-button-container]');
        if (copyButtonContainer && userBubble) {
            // 检查是否已经添加过这些按钮（通过检查是否有删除按钮）
            if (!copyButtonContainer.querySelector('.delete-button')) {
                this.addDeleteButtonForUserMessage(copyButtonContainer, userBubble);
            }
            // 添加排序按钮
            this.addSortButtons(copyButtonContainer, userMessage);
        }

        // 调用 session/save 保存会话到后端
        try {
            // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
            await this.saveCurrentSession(false, false);

            // 调用 session/save 接口保存会话
            // 传入 processImages: true，表示需要处理图片上传
            if (this.currentSessionId && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                await this.syncSessionToBackend(this.currentSessionId, true, false);
                console.log('图片消息会话已保存到后端:', this.currentSessionId);

                // 保存成功后，通过会话接口刷新该会话内容
                try {
                    const refreshedSession = await this.sessionApi.getSession(this.currentSessionId, true);
                    if (refreshedSession && this.sessions[this.currentSessionId]) {
                        // 更新本地会话数据，保留本地的最新消息（可能包含未同步的数据）
                        const localSession = this.sessions[this.currentSessionId];
                        // 统一处理 pageTitle：优先使用 pageTitle，如果没有则使用 title
                        const refreshedPageTitle = refreshedSession.pageTitle || refreshedSession.title || '';
                        this.sessions[this.currentSessionId] = {
                            ...refreshedSession,
                            id: this.currentSessionId,
                            // 如果本地消息更新，保留本地消息
                            messages: localSession.messages?.length > refreshedSession.messages?.length
                                ? localSession.messages
                                : refreshedSession.messages,
                            // 优先保留本地的 pageContent（如果本地有内容）
                            pageContent: (localSession.pageContent && localSession.pageContent.trim() !== '')
                                ? localSession.pageContent
                                : (refreshedSession.pageContent || localSession.pageContent || ''),
                            // 优先保留本地的 pageTitle（如果本地有内容），否则使用后端的
                            pageTitle: (localSession.pageTitle && localSession.pageTitle.trim() !== '')
                                ? localSession.pageTitle
                                : refreshedPageTitle,

                        };
                        console.log('会话内容已从后端刷新:', this.currentSessionId);
                    }
                } catch (refreshError) {
                    console.warn('刷新会话内容失败:', refreshError);
                    // 刷新失败不影响主流程，只记录警告
                }
            } else {
                console.warn('无法保存会话：缺少会话ID、API管理器或同步配置');
            }
        } catch (error) {
            console.error('保存图片消息会话失败:', error);
            // 显示错误提示（可选）
            const errorMessage = this.createMessageElement('保存会话时发生错误，请稍后再试。😔', 'pet');
            messagesContainer.appendChild(errorMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // 图片消息不再自动回复
    }

    // 显示图片预览
    // @param {string} imageUrl - 图片URL或DataURL
    // @param {string} fileName - 文件名（可选）
    showImagePreview(imageUrl, fileName = '') {
        // 如果已有预览弹窗，先关闭
        const existingModal = document.querySelector('.image-preview-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'image-preview-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.95) !important;
            z-index: 2147483650 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            animation: fadeIn 0.3s ease-out !important;
        `;

        // 添加fadeIn动画
        if (!document.getElementById('image-preview-fade-style')) {
            const style = document.createElement('style');
            style.id = 'image-preview-fade-style';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: relative !important;
            max-width: 95% !important;
            max-height: 90% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;

        // 创建加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.style.cssText = `
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 40px !important;
            height: 40px !important;
            border: 3px solid rgba(255, 255, 255, 0.3) !important;
            border-top-color: #fff !important;
            border-radius: 50% !important;
            animation: spin 0.8s linear infinite !important;
        `;

        // 添加spin动画
        if (!document.getElementById('image-preview-spin-style')) {
            const style = document.createElement('style');
            style.id = 'image-preview-spin-style';
            style.textContent = `
                @keyframes spin {
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        imageContainer.appendChild(loadingIndicator);

        const img = document.createElement('img');
        img.style.cssText = `
            max-width: 100% !important;
            max-height: 85vh !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease !important;
            object-fit: contain !important;
        `;
        img.alt = fileName || '图片预览';

        // 图片加载成功
        img.onload = () => {
            loadingIndicator.style.display = 'none';
            img.style.opacity = '1';
        };

        // 图片加载失败
        img.onerror = () => {
            loadingIndicator.style.display = 'none';
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = `
                color: white !important;
                text-align: center !important;
                padding: 20px !important;
                font-size: 16px !important;
            `;
            errorMsg.textContent = '图片加载失败';
            imageContainer.appendChild(errorMsg);
        };

        // 直接使用OSS文件的原始地址进行预览
        img.src = imageUrl;
        imageContainer.appendChild(img);

        // 创建标题栏（显示文件名）
        let titleBar = null;
        if (fileName) {
            titleBar = document.createElement('div');
            titleBar.style.cssText = `
                position: absolute !important;
                top: 20px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: rgba(0, 0, 0, 0.6) !important;
                color: white !important;
                padding: 8px 16px !important;
                border-radius: 20px !important;
                font-size: 14px !important;
                max-width: 80% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                backdrop-filter: blur(10px) !important;
            `;
            titleBar.textContent = fileName;
            modal.appendChild(titleBar);
        }

        // 创建按钮容器（下载和关闭按钮）
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            position: absolute !important;
            top: 20px !important;
            right: 20px !important;
            display: flex !important;
            gap: 12px !important;
            align-items: center !important;
        `;

        // 创建下载按钮（仅当有文件名时显示）
        let downloadBtn = null;
        if (fileName) {
            downloadBtn = document.createElement('button');
            downloadBtn.innerHTML = '⬇️';
            downloadBtn.title = '下载文件';
            downloadBtn.style.cssText = `
                background: rgba(255, 255, 255, 0.15) !important;
                color: white !important;
                border: none !important;
                width: 44px !important;
                height: 44px !important;
                border-radius: 50% !important;
                font-size: 20px !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                backdrop-filter: blur(10px) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                line-height: 1 !important;
            `;
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 通用下载逻辑
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = fileName || 'image.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

            downloadBtn.addEventListener('mouseenter', () => {
                downloadBtn.style.background = 'rgba(255, 255, 255, 0.25)';
                downloadBtn.style.transform = 'scale(1.1)';
            });

            downloadBtn.addEventListener('mouseleave', () => {
                downloadBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                downloadBtn.style.transform = 'scale(1)';
            });

            buttonContainer.appendChild(downloadBtn);
        }

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.15) !important;
            color: white !important;
            border: none !important;
            width: 44px !important;
            height: 44px !important;
            border-radius: 50% !important;
            font-size: 24px !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            backdrop-filter: blur(10px) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            line-height: 1 !important;
        `;
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.25)';
            closeBtn.style.transform = 'scale(1.1)';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            closeBtn.style.transform = 'scale(1)';
        });

        buttonContainer.appendChild(closeBtn);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // 按ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        modal.appendChild(imageContainer);
        modal.appendChild(buttonContainer);
        document.body.appendChild(modal);
    }

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

    // 截图/权限相关逻辑已拆分到 `content/petManager.screenshot.js`

} // 结束 PetManager 类

        // 将 PetManager 赋值给 window，防止重复声明
        window.PetManager = PetManager;
    } catch (error) {
        console.error('[PetManager.core] 初始化失败:', error);
        console.error('[PetManager.core] 错误堆栈:', error.stack);
        // 即使出错也尝试创建一个基本的 PetManager 类，避免后续代码完全失败
        if (typeof window !== 'undefined' && typeof window.PetManager === 'undefined') {
            window.PetManager = class PetManager {
                constructor() {
                    console.error('[PetManager] 使用降级版本，某些功能可能不可用');
                }
            };
        }
    }
})(); // 结束立即执行函数

