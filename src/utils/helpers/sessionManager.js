/**
 * 会话管理器
 * 统一管理前端会话的创建、保存、加载、同步等功能
 * 提供清晰的 API 接口，与后端 SessionService 对接
 */

class SessionManager {
    constructor(options = {}) {
        // 配置选项
        this.sessionApi = options.sessionApi || null; // SessionApiManager 实例
        this.enableBackendSync = options.enableBackendSync || false; // 是否启用后端同步

        this.deleteAicrProjectFilesCallback = options.deleteAicrProjectFilesCallback || null; // 删除 aicr 项目文件的回调函数（可选）
        
        // 会话数据
        this.sessions = {}; // 存储所有会话，key为sessionId，value为会话数据
        this.currentSessionId = null; // 当前激活的会话ID
        
        // 页面状态
        this.currentPageUrl = null; // 当前页面URL
        this.hasAutoCreatedSessionForPage = false; // 当前页面是否已自动创建会话
        
        // 同步和保存优化
        this.lastSessionSaveTime = 0; // 上次保存会话的时间
        this.sessionUpdateTimer = null; // 会话更新防抖定时器
        this.pendingSessionUpdate = false; // 是否有待处理的会话更新
        this.SESSION_UPDATE_DEBOUNCE = options.debounceTime || 300; // 会话更新防抖时间（毫秒）
        this.SESSION_SAVE_THROTTLE = options.throttleTime || 1000; // 会话保存节流时间（毫秒）
        
        // 会话列表加载控制
        this.lastSessionListLoadTime = 0;
        this.SESSION_LIST_RELOAD_INTERVAL = options.reloadInterval || 10000; // 会话列表重新加载间隔
        
        // 初始化
        this._initialized = false;
    }
    
    /**
     * 初始化会话管理器
     */
    async initialize() {
        if (this._initialized) {
            return;
        }
        
        // 如果启用后端同步，加载后端会话
        if (this.enableBackendSync && this.sessionApi) {
            await this.loadBackendSessions();
        }
        
        this._initialized = true;
    }
    
    /**
     * 生成 UUID v4 格式的 key
     * @returns {string} UUID 格式的字符串
     */
    _generateUUID() {
        // 生成 UUID v4 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 生成会话ID（基于URL的MD5哈希）
     * @param {string} url - 页面URL（可选）
     * @returns {Promise<string>} 会话ID（32位MD5十六进制字符串）
     */
    async generateSessionId(url) {
        // 确保md5函数可用
        const md5Func = typeof md5 !== 'undefined' ? md5 : 
                       (typeof window !== 'undefined' && window.md5) ? window.md5 : null;
        
        if (!md5Func) {
            console.error('MD5函数未找到，请确保已加载md5.js');
            // 降级方案：如果MD5不可用，使用简单的哈希生成32位十六进制字符串
            // 如果URL为空，生成一个唯一字符串作为哈希输入
            const input = url || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // 使用简单的哈希作为备用（但这不是真正的MD5）
            let hash = 0;
            for (let i = 0; i < input.length; i++) {
                const char = input.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            // 生成32位十六进制字符串（填充到32位）
            const hex = Math.abs(hash).toString(16).padStart(32, '0');
            return hex.substring(0, 32);
        }
        
        if (!url) {
            // 如果没有URL，生成基于时间戳和随机数的唯一字符串，然后计算MD5
            const input = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            return md5Func(input);
        }
        
        // 使用MD5对URL进行哈希
        return md5Func(url);
    }
    
    /**
     * 从会话ID提取项目ID和文件路径
     * 格式：{projectId}_{filePath}（文件路径中的特殊字符替换为下划线）
     * @param {string} sessionId - 会话ID
     * @returns {Object|null} {projectId, filePath} 或 null
     */
    _extractAicrInfo(sessionId) {
        if (!sessionId || typeof sessionId !== 'string') {
            return null;
        }
        
        // 检查是否包含下划线（格式：{projectId}_{filePath}）
        if (!sessionId.includes('_')) {
            return null;
        }
        
        const parts = sessionId.split('_');
        
        if (parts.length < 1) {
            return null;
        }
        
        const projectId = parts[0];
        const filePathParts = parts.slice(1);
        
        // 将下划线还原为斜杠，恢复文件路径
        const filePath = filePathParts.length > 0 ? filePathParts.join('/') : null;
        
        return { projectId, filePath };
    }
    
    /**
     * 从文件路径提取标签（目录路径）
     * 与 YiWeb aicr 的 sessionSyncService.js 保持一致
     * @param {string} filePath - 文件路径
     * @returns {Array<string>} 标签数组
     */
    _extractTagsFromPath(filePath) {
        if (!filePath) return [];
        
        const parts = filePath.split('/').filter(p => p && p.trim());
        if (parts.length <= 1) return [];
        
        // 移除文件名，只保留目录路径作为标签
        const dirs = parts.slice(0, -1);
        return dirs;
    }
    
    /**
     * 规范化时间戳（转换为毫秒数）
     * 与 YiWeb aicr 的 sessionSyncService.js 保持一致
     * @param {string|number|Date} timestamp - 时间戳
     * @returns {number} 毫秒数
     */
    _normalizeTimestamp(timestamp) {
        if (!timestamp) return Date.now();
        if (typeof timestamp === 'number') return timestamp;
        if (typeof timestamp === 'string') {
            // 尝试解析 ISO 字符串
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date.getTime();
            }
            // 尝试解析为数字
            const num = parseInt(timestamp, 10);
            if (!isNaN(num)) return num;
        }
        return Date.now();
    }
    
    /**
     * 规范化消息数组（确保格式统一）
     * 与 YiWeb aicr 的 sessionSyncService.js 保持一致
     * @param {Array} messages - 消息数组
     * @returns {Array} 规范化后的消息数组
     */
    _normalizeMessages(messages) {
        if (!Array.isArray(messages)) return [];
        
        return messages.map(msg => {
            // 如果已经是标准格式，直接返回
            if (msg.type && typeof msg.content === 'string' && typeof msg.timestamp === 'number') {
                return {
                    type: msg.type,
                    content: String(msg.content || '').trim(),
                    timestamp: Number(msg.timestamp),
                    imageDataUrl: msg.imageDataUrl || undefined
                };
            }
            
            // 否则转换为标准格式
            const type = this._normalizeRole(msg);
            const content = this._normalizeText(msg);
            const timestamp = this._normalizeTimestamp(msg.timestamp || msg.ts);
            
            return {
                type: type,
                content: content,
                timestamp: timestamp,
                imageDataUrl: msg.imageDataUrl || msg.image || undefined
            };
        }).filter(msg => msg.content); // 过滤空内容
    }
    
    /**
     * 规范化角色类型（与 YiPet 保持一致）
     * @param {Object} msg - 消息对象
     * @returns {string} 'user' 或 'pet'
     */
    _normalizeRole(msg) {
        const author = String(msg.author || '').toLowerCase();
        const role = String(msg.role || msg.type || '').toLowerCase();
        
        // 判断是否为用户消息
        if (role === 'user' || role === 'me' || author.includes('用户') || author.includes('user')) {
            return 'user';
        }
        // 判断是否为 AI 消息
        if (role === 'pet' || role === 'assistant' || role === 'bot' || role === 'ai' || 
            author.includes('AI') || author.includes('助手') || author.includes('assistant')) {
            return 'pet';
        }
        // 默认根据 author 判断
        return author.includes('AI') ? 'pet' : 'user';
    }
    
    /**
     * 规范化文本内容（与 YiPet 保持一致）
     * @param {Object} msg - 消息对象
     * @returns {string} 规范化后的文本内容
     */
    _normalizeText(msg) {
        return String(msg.content || msg.text || msg.message || '').trim();
    }
    
    /**
     * 获取会话标签（支持 aicr 目录映射）
     * @param {string} sessionId - 会话ID
     * @param {Object} pageInfo - 页面信息（可选）
     * @returns {Array<string>} 标签数组
     */
    _getSessionTags(sessionId, pageInfo = {}) {
        // 如果 pageInfo 中提供了标签，优先使用
        if (pageInfo.tags && Array.isArray(pageInfo.tags) && pageInfo.tags.length > 0) {
            return pageInfo.tags;
        }
        
        // 检查是否是项目会话（格式：{projectId}_{filePath}）
        const aicrInfo = this._extractAicrInfo(sessionId);
        if (aicrInfo && aicrInfo.filePath) {
            // 从文件路径提取标签
            const tags = this._extractTagsFromPath(aicrInfo.filePath);
            // 如果标签为空，使用项目ID作为标签（与 YiWeb aicr 保持一致）
            if (tags.length === 0 && aicrInfo.projectId) {
                return [aicrInfo.projectId];
            }
            return tags;
        }
        
        // 默认标签
        return ['chat'];
    }
    
    /**
     * 创建会话对象
     * 使用 UUID 格式的 key 作为主要标识符
     */
    createSession(sessionId, pageInfo = {}) {
        const now = Date.now();
        const tags = this._getSessionTags(sessionId, pageInfo);
        
        const rawTitle = pageInfo.title || document.title || '';
        let title = rawTitle || '新会话';
        
        // 辅助函数：如果字符串不为空且没有 .md 后缀，则添加后缀
        const addMdSuffix = (str) => {
            if (!str || !str.trim()) return str;
            return str.trim().endsWith('.md') ? str.trim() : str.trim() + '.md';
        };
        
        if (title) {
            title = addMdSuffix(title);
        } else {
            // 如果 title 为空，设置为 "新会话.md"
            title = '新会话.md';
        }
        
        return {
            key: this._generateUUID(), // 生成 UUID 格式的 key
            url: pageInfo.url || window.location.href,
            title: title, // 会话标题（与 YiWeb 保持一致）
            // 兼容 pageInfo 中可能只有 description 字段而没有 pageDescription 字段的情况
            pageDescription: pageInfo.pageDescription || pageInfo.description || '',
            // 兼容 pageInfo 中可能只有 content 字段而没有 pageContent 字段的情况
            pageContent: pageInfo.pageContent || pageInfo.content || '',
            messages: [],
            tags: tags,
            createdAt: now,
            updatedAt: now,
            lastAccessTime: now
        };
    }
    
    /**
     * 获取页面信息
     */
    getPageInfo() {
        return {
            url: window.location.href,
            title: document.title,
            pageDescription: this._extractPageDescription(),
            pageContent: this._extractPageContent()
        };
    }
    
    /**
     * 提取页面描述
     */
    _extractPageDescription() {
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            return metaDescription.getAttribute('content') || '';
        }
        return '';
    }
    
    /**
     * 提取页面内容（简化版，可以后续扩展）
     */
    _extractPageContent() {
        // 提取主要内容，避免提取过多数据
        const body = document.body;
        if (!body) return '';
        
        // 尝试提取主要文本内容
        const mainContent = body.innerText || body.textContent || '';
        // 限制长度，避免存储过多数据
        return mainContent.substring(0, 50000); // 最多50KB
    }
    
    /**
     * 从后端加载会话
     * 注意：已移除 getSessionsList 调用，只在第一次页面加载时调用（由 content.js 的 loadSessionsFromBackend 处理）
     */
    async loadBackendSessions(forceRefresh = false) {
        // 不再调用后端接口，只在第一次页面加载时调用
        // 第一次页面加载时的调用已在 content.js 的 loadSessionsFromBackend 中处理
        return;
    }
    
    /**
     * 同步会话到后端
     */
    async syncSessionToBackend(sessionId, immediate = false, includePageContent = false) {
        if (!this.sessionApi || !this.enableBackendSync) {
            return;
        }
        
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('会话不存在，无法同步:', sessionId);
            return;
        }
        
        try {
            const pageInfo = this.getPageInfo();
            // 获取标签（支持项目目录映射）
            let tags = session.tags || [];
            if (!Array.isArray(tags) || tags.length === 0) {
                // 如果标签为空，尝试从 URL 提取（针对项目会话）
                tags = this._getSessionTags(session.url || '', pageInfo);
            }
            
            // 规范化会话数据（与 YiWeb aicr 的 sessionSyncService.js 保持一致）
            // 必须使用 key，如果没有则生成一个 UUID 格式的 key
            let sessionKey = session.key;
            if (!sessionKey || typeof sessionKey !== 'string') {
                // 生成 UUID v4 格式的 key
                sessionKey = this._generateUUID();
                // 更新会话对象中的 key
                session.key = sessionKey;
            }
            
            const sessionData = {
                key: String(sessionKey), // 必须包含 key
                url: String(session.url || ''),
                title: String(session.title || ''),
                pageDescription: String(session.pageDescription || ''),
                pageContent: String(session.pageContent || ''),
                messages: this._normalizeMessages(session.messages || []),
                tags: Array.isArray(tags) ? tags : [],
                isFavorite: session.isFavorite !== undefined ? Boolean(session.isFavorite) : false,
                createdAt: this._normalizeTimestamp(session.createdAt),
                updatedAt: this._normalizeTimestamp(session.updatedAt),
                lastAccessTime: this._normalizeTimestamp(session.lastAccessTime)
            };
            
            // 只有在手动保存页面上下文时才包含 pageContent 字段
            if (includePageContent) {
                sessionData.pageContent = session.pageContent || '';
            }
            
            if (immediate) {
                await this.sessionApi.saveSession(sessionData);
                console.log(`会话 ${sessionKey} 已立即同步到后端`);
            } else {
                this.sessionApi.queueSave(sessionData);
                console.log(`会话 ${sessionKey} 已加入同步队列`);
            }
        } catch (error) {
            console.warn('同步会话到后端失败:', error);
        }
    }
    
    /**
     * 初始化或恢复会话（基于当前页面URL）
     * 自动处理会话的查找、创建和激活
     * @returns {Promise<string>} 会话ID
     */
    async initSession() {
        await this.initialize();
        
        const pageInfo = this.getPageInfo();
        const currentUrl = pageInfo.url;
        
        // 检查是否是同一页面且已有会话
        if (this._isSamePageSession(currentUrl)) {
            return this.currentSessionId;
        }
        
        // 处理新页面的情况
        if (this.currentPageUrl !== currentUrl) {
            this.currentPageUrl = currentUrl;
            this.hasAutoCreatedSessionForPage = false;
        }
        
        // 生成基于URL的会话ID
        const sessionId = await this.generateSessionId(currentUrl);
        
        // 查找或创建会话
        const existingSession = this.sessions[sessionId];
        if (existingSession) {
            // 恢复已有会话
            await this._restoreExistingSession(sessionId, pageInfo);
        } else {
            // 创建新会话
            await this._createNewSession(sessionId, pageInfo);
        }
        
        // 激活会话
        this.currentSessionId = sessionId;
        this.hasAutoCreatedSessionForPage = true;
        
        return sessionId;
    }
    
    /**
     * 检查是否是同一页面的已有会话
     * @private
     */
    _isSamePageSession(currentUrl) {
        if (this.currentPageUrl === currentUrl && 
            this.hasAutoCreatedSessionForPage && 
            this.currentSessionId &&
            this.sessions[this.currentSessionId]) {
            
            // 更新访问时间（节流，每分钟最多更新一次）
            const session = this.sessions[this.currentSessionId];
            const now = Date.now();
            if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
                session.lastAccessTime = now;
                // 异步更新，不阻塞返回
                this.saveSession(this.currentSessionId).catch(err => {
                    console.warn('更新会话访问时间失败:', err);
                });
            }
            return true;
        }
        return false;
    }
    
    /**
     * 恢复已有会话
     * @private
     */
    async _restoreExistingSession(sessionId, pageInfo) {
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('会话不存在，无法恢复:', sessionId);
            return;
        }
        
        // 确保会话有 key
        if (!session.key) {
            session.key = this._generateUUID();
        }
        
        // 如果会话标签为空，尝试从 URL 提取（针对项目会话）
        if (!session.tags || !Array.isArray(session.tags) || session.tags.length === 0) {
            session.tags = this._getSessionTags(session.url || '', pageInfo);
        }
        
        // 更新会话页面信息
        this.updateSessionPageInfo(sessionId, pageInfo);
        await this.saveSession(sessionId);
        console.log('找到基于URL的已有会话，已自动恢复:', session.key);
    }
    
    /**
     * 创建新会话
     * @private
     */
    async _createNewSession(sessionId, pageInfo) {
        const newSession = this.createSession(sessionId, pageInfo);
        
        // 使用 sessionId 作为存储键（基于 URL 的标识符）
        this.sessions[sessionId] = newSession;
        
        await this.saveSession(sessionId);
        console.log('使用URL作为会话ID，已自动创建新会话:', newSession.key, 'URL:', pageInfo.url);
    }
    
    /**
     * 获取会话
     */
    getSession(sessionId) {
        return this.sessions[sessionId] || null;
    }
    
    /**
     * 获取当前会话
     */
    getCurrentSession() {
        if (!this.currentSessionId) {
            return null;
        }
        return this.getSession(this.currentSessionId);
    }
    
    /**
     * 获取所有会话列表（已去重）
     * 确保每个会话ID只出现一次，保留最新的版本
     * @returns {Array} 去重后的会话列表
     */
    getAllSessions() {
        // 按 session.id 去重，保留 updatedAt 最新的版本
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
        
        // 转换为数组，收藏的会话优先显示在最前面，然后按文件名排序
        return Array.from(sessionMap.values()).sort((a, b) => {
            const aFavorite = a.isFavorite || false;
            const bFavorite = b.isFavorite || false;
            
            // 如果收藏状态不同，收藏的排在前面
            if (aFavorite !== bFavorite) {
                return bFavorite ? 1 : -1;
            }
            
            // 如果收藏状态相同，按文件名排序（不区分大小写，支持中文和数字）
            const aTitle = String(a.title || '').trim();
            const bTitle = String(b.title || '').trim();
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
            
            // 如果更新时间也相同，按 key 排序（确保完全稳定）
            const aKey = a.key || '';
            const bKey = b.key || '';
            return aKey.localeCompare(bKey);
        });
    }
    
    /**
     * 创建新会话
     * @param {string} customSessionId - 自定义会话ID（可选）
     * @param {Object} pageInfo - 页面信息（可选）
     * @returns {Promise<string>} 会话ID
     */
    async createNewSession(customSessionId = null, pageInfo = null) {
        await this.initialize();
        
        // 生成或使用提供的会话ID
        const info = pageInfo || this.getPageInfo();
        const sessionId = customSessionId || await this.generateSessionId(info.url);
        
        // 使用统一的创建逻辑
        await this._createNewSession(sessionId, info);
        
        return sessionId;
    }
    
    /**
     * 复制会话（创建会话副本）
     * @param {string} sourceSessionId - 源会话ID
     * @param {Object} sourceSessionData - 可选的源会话数据（如果提供，将使用此数据而不是从 sessions 中读取）
     * @returns {Promise<string>} 新会话ID
     */
    async duplicateSession(sourceSessionId, sourceSessionData = null) {
        await this.initialize();
        
        // 如果提供了源会话数据，使用它；否则从 sessions 中读取
        let sourceSession = sourceSessionData || this.sessions[sourceSessionId];
        if (!sourceSession) {
            throw new Error('源会话不存在');
        }

        
        // 如果启用后端同步且有 sessionApi，先从后端获取源会话的完整数据（包括页面上下文）
        if (this.enableBackendSync && this.sessionApi) {
            try {
                const fullSessionData = await this.sessionApi.getSession(sourceSessionId);
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
        const newSessionId = await this.generateSessionId();
        
        // 创建会话副本，复制所有数据
        const now = Date.now();
        const duplicatedSession = {
            id: newSessionId,
            url: sourceSession.url || '',
            title: sourceSession.title
                ? `${sourceSession.title} (副本)`
                : '新会话 (副本)',
            pageDescription: sourceSession.pageDescription || '',
            pageContent: sourceSession.pageContent || '',
            messages: sourceSession.messages ? JSON.parse(JSON.stringify(sourceSession.messages)) : [],
            tags: sourceSession.tags ? [...sourceSession.tags] : [],
            isFavorite: sourceSession.isFavorite !== undefined ? sourceSession.isFavorite : false,
            createdAt: now,
            updatedAt: now,
            lastAccessTime: now
        };
        
        // 保存新会话
        this.sessions[newSessionId] = duplicatedSession;
        await this.saveSession(newSessionId, true);
        
        // 如果启用后端同步，同步到后端（包含页面上下文）
        if (this.enableBackendSync && this.sessionApi) {
            await this.syncSessionToBackend(newSessionId, true, true);
        }
        
        return newSessionId;
    }
    
    /**
     * 更新会话页面信息
     */
    updateSessionPageInfo(sessionId, pageInfo = null) {
        const session = this.sessions[sessionId];
        if (!session) {
            return false;
        }
        
        const info = pageInfo || this.getPageInfo();
        const now = Date.now();
        
        session.url = info.url || session.url;
        const newTitle = info.title || '';
        const currentTitle = session.title || '';
        const isDefaultTitle = !currentTitle ||
                              currentTitle.trim() === '' ||
                              currentTitle === '未命名会话' ||
                              currentTitle === '新会话' ||
                              currentTitle === '未命名页面' ||
                              currentTitle === '当前页面';
        
        // 只有当新标题有效且（当前标题是默认值或新标题与当前标题不同）时才更新
        if (newTitle && newTitle.trim() !== '' && (isDefaultTitle || newTitle !== currentTitle)) {
            session.title = newTitle;
        }
        // 兼容 pageInfo 中可能只有 description 字段而没有 pageDescription 字段的情况
        session.pageDescription = info.pageDescription || info.description || session.pageDescription;
        // 兼容 pageInfo 中可能只有 content 字段而没有 pageContent 字段的情况
        session.pageContent = info.pageContent || info.content || session.pageContent;
        session.lastAccessTime = now;
        
        return true;
    }
    
    /**
     * 更新会话标题
     */
    updateSessionTitle(sessionId, title) {
        const session = this.sessions[sessionId];
        if (!session) {
            return false;
        }
        
        session.title = title;
        session.updatedAt = Date.now();
        return true;
    }
    
    /**
     * 添加消息到会话
     */
    async addMessage(sessionId, message) {
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('会话不存在，无法添加消息:', sessionId);
            return false;
        }
        
        if (!session.messages) {
            session.messages = [];
        }
        
        session.messages.push(message);
        session.updatedAt = Date.now();
        
        await this.saveSession(sessionId);
        
        return true;
    }
    
    /**
     * 更新会话中的消息
     */
    async updateMessage(sessionId, messageIndex, message) {
        const session = this.sessions[sessionId];
        if (!session || !session.messages) {
            return false;
        }
        
        if (messageIndex >= 0 && messageIndex < session.messages.length) {
            session.messages[messageIndex] = message;
            session.updatedAt = Date.now();
            await this.saveSession(sessionId);
            return true;
        }
        
        return false;
    }
    
    /**
     * 保存会话（本地 + 后端同步）
     * 统一处理会话保存逻辑，包括时间戳更新、本地存储和后端同步
     * @param {string} sessionId - 会话ID
     * @param {boolean} force - 是否强制立即保存（跳过防抖节流）
     * @returns {Promise<boolean>} 是否保存成功
     */
    async saveSession(sessionId, force = false) {
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('会话不存在，无法保存:', sessionId);
            return false;
        }
        
        // 更新更新时间（除非是强制保存且提供了更新时间）
        if (!force) {
            session.updatedAt = Date.now();
        }
        
        try {
            // 同步到后端（当前会话或强制保存时才同步）
            if (sessionId === this.currentSessionId || force) {
                await this.syncSessionToBackend(sessionId, force);
            }
            
            return true;
        } catch (error) {
            console.error('保存会话失败:', error);
            return false;
        }
    }
    
    /**
     * 激活会话（切换到指定会话）
     */
    async activateSession(sessionId) {
        if (!this.sessions[sessionId]) {
            console.warn('会话不存在，无法激活:', sessionId);
            return false;
        }
        
        // 保存当前会话（如果存在）
        if (this.currentSessionId && this.currentSessionId !== sessionId) {
            await this.saveSession(this.currentSessionId);
        }
        
        // 激活新会话
        this.currentSessionId = sessionId;
        const session = this.sessions[sessionId];
        session.lastAccessTime = Date.now();
        
        // 更新页面信息
        this.updateSessionPageInfo(sessionId);
        await this.saveSession(sessionId);
        
        return true;
    }
    
    /**
     * 删除会话
     * @param {string} sessionId - 会话ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteSession(sessionId) {
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('会话不存在，无法删除:', sessionId);
            return false;
        }
        
        // 使用 sessionId 作为标识符（基于 URL 的标识符）
        
        // 处理 aicr 项目文件删除（在删除会话之前）
        if (this.deleteAicrProjectFilesCallback && typeof this.deleteAicrProjectFilesCallback === 'function') {
            try {
                await this.deleteAicrProjectFilesCallback(sessionId);
            } catch (error) {
                // 删除项目文件失败不影响删除会话的结果
                console.warn('删除 aicr 项目文件失败:', error);
            }
        }
        
        // 如果是当前会话，清空当前会话ID
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
            this.hasAutoCreatedSessionForPage = false;
        }
        

        
        // 从本地删除
        delete this.sessions[sessionId];
        // 如果 unifiedSessionId 不同，也删除那个键
        if (unifiedSessionId !== sessionId && this.sessions[unifiedSessionId]) {
            delete this.sessions[unifiedSessionId];
        }
        

        
        // 从后端删除
        if (this.sessionApi && this.enableBackendSync) {
            try {
                await this.sessionApi.deleteSession(unifiedSessionId);
                console.log('会话已从后端删除:', unifiedSessionId);
            } catch (error) {
                console.warn('从后端删除会话失败:', error);
                // 即使后端删除失败，也返回成功，因为本地已删除
            }
        }
        
        return true;
    }
    
    /**
     * 搜索会话
     */
    async searchSessions(query, limit = 10) {
        if (!query) {
            return [];
        }
        
        // 先从本地搜索
        const localResults = this.getAllSessions().filter(session => {
            const searchText = `${session.title || ''} ${session.url}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        }).slice(0, limit);
        
        // 如果启用后端同步，也从后端搜索
        if (this.sessionApi && this.enableBackendSync) {
            try {
                const backendResults = await this.sessionApi.searchSessions(query, limit);
                // 合并结果，去重
                const resultMap = new Map();
                localResults.forEach(s => resultMap.set(s.id, s));
                backendResults.forEach(s => {
                    if (!resultMap.has(s.id) || (s.updatedAt || 0) > (resultMap.get(s.id).updatedAt || 0)) {
                        resultMap.set(s.id, s);
                    }
                });
                return Array.from(resultMap.values()).slice(0, limit);
            } catch (error) {
                console.warn('后端搜索会话失败:', error);
            }
        }
        
        return localResults;
    }
    
    /**
     * 刷新会话列表（从后端重新加载）
     */
    async refreshSessions() {
        if (this.sessionApi && this.enableBackendSync) {
            await this.loadBackendSessions(true);
        }
    }
    
    /**
     * 清空所有会话
     */
    async clearAllSessions() {
        this.sessions = {};
        this.currentSessionId = null;
        this.hasAutoCreatedSessionForPage = false;
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = SessionManager;
} else {
    window.SessionManager = SessionManager;
}
