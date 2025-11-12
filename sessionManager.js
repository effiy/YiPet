/**
 * 会话管理器
 * 统一管理前端会话的创建、保存、加载、同步等功能
 * 提供清晰的 API 接口，与后端 SessionService 对接
 */

class SessionManager {
    constructor(options = {}) {
        // 配置选项
        this.sessionApi = options.sessionApi || null; // SessionApiManager 实例
        this.storageKey = options.storageKey || 'petSessions'; // 本地存储键
        this.enableBackendSync = options.enableBackendSync || false; // 是否启用后端同步
        
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
        
        // 加载本地存储的会话
        await this.loadLocalSessions();
        
        // 如果启用后端同步，加载后端会话
        if (this.enableBackendSync && this.sessionApi) {
            await this.loadBackendSessions();
        }
        
        this._initialized = true;
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
     * 创建会话对象
     */
    createSession(sessionId, pageInfo = {}) {
        const now = Date.now();
        return {
            id: sessionId,
            url: pageInfo.url || window.location.href,
            pageTitle: pageInfo.pageTitle || pageInfo.title || document.title || '',
            pageDescription: pageInfo.pageDescription || '',
            pageContent: pageInfo.pageContent || '',
            messages: [],
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
            pageTitle: document.title,
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
     * 从本地存储加载会话
     */
    async loadLocalSessions() {
        return new Promise(async (resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                // 使用StorageHelper处理错误
                if (typeof window.StorageHelper !== 'undefined') {
                    const stored = await window.StorageHelper.get(this.storageKey);
                    this.sessions = stored || {};
                    resolve();
                } else {
                    // 降级到原始方法
                    try {
                        // 检查chrome.storage是否可用
                        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime || !chrome.runtime.id) {
                            throw new Error('Extension context invalidated');
                        }
                        chrome.storage.local.get([this.storageKey], (result) => {
                            if (chrome.runtime.lastError) {
                                const error = chrome.runtime.lastError;
                                const errorMsg = error.message || error.toString();
                                if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
                                    console.warn('扩展上下文已失效，从localStorage加载');
                                } else {
                                    console.warn('从chrome.storage.local加载失败，尝试localStorage:', errorMsg);
                                }
                                try {
                                    const stored = localStorage.getItem(this.storageKey);
                                    this.sessions = stored ? JSON.parse(stored) : {};
                                } catch (localError) {
                                    console.error('从localStorage加载也失败:', localError);
                                    this.sessions = {};
                                }
                            } else {
                                this.sessions = result[this.storageKey] || {};
                            }
                            resolve();
                        });
                    } catch (error) {
                        const errorMsg = error.message || error.toString();
                        if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
                            console.warn('扩展上下文已失效，从localStorage加载');
                        } else {
                            console.warn('chrome.storage不可用，从localStorage加载:', errorMsg);
                        }
                        try {
                            const stored = localStorage.getItem(this.storageKey);
                            this.sessions = stored ? JSON.parse(stored) : {};
                        } catch (localError) {
                            console.error('从localStorage加载也失败:', localError);
                            this.sessions = {};
                        }
                        resolve();
                    }
                }
            } else {
                // 非 Chrome 环境
                // 使用 localStorage
                try {
                    const stored = localStorage.getItem(this.storageKey);
                    if (stored) {
                        this.sessions = JSON.parse(stored);
                    } else {
                        this.sessions = {};
                    }
                } catch (error) {
                    console.error('加载本地会话失败:', error);
                    this.sessions = {};
                }
                resolve();
            }
        });
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
     * 保存会话到本地存储
     */
    async saveLocalSessions(force = false) {
        const now = Date.now();
        
        // 如果不在强制模式下，且距离上次保存时间太短，则延迟保存
        if (!force && (now - this.lastSessionSaveTime) < this.SESSION_SAVE_THROTTLE) {
            this.pendingSessionUpdate = true;
            
            if (this.sessionUpdateTimer) {
                clearTimeout(this.sessionUpdateTimer);
            }
            
            return new Promise((resolve) => {
                this.sessionUpdateTimer = setTimeout(async () => {
                    this.pendingSessionUpdate = false;
                    await this._doSaveLocalSessions();
                    resolve();
                }, this.SESSION_SAVE_THROTTLE - (now - this.lastSessionSaveTime));
            });
        }
        
        // 立即保存
        this.pendingSessionUpdate = false;
        if (this.sessionUpdateTimer) {
            clearTimeout(this.sessionUpdateTimer);
            this.sessionUpdateTimer = null;
        }
        return await this._doSaveLocalSessions();
    }
    
    /**
     * 执行本地保存操作
     */
    async _doSaveLocalSessions() {
        this.lastSessionSaveTime = Date.now();
        
        return new Promise(async (resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                // 使用StorageHelper处理配额错误
                if (typeof window.StorageHelper !== 'undefined') {
                    const result = await window.StorageHelper.set(this.storageKey, this.sessions);
                    if (!result.success) {
                        console.error('保存本地会话失败:', result.error);
                    }
                    resolve();
                } else {
                    // 降级到原始方法
                    try {
                        // 检查chrome.storage是否可用
                        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime || !chrome.runtime.id) {
                            throw new Error('Extension context invalidated');
                        }
                        chrome.storage.local.set({ [this.storageKey]: this.sessions }, async () => {
                            if (chrome.runtime.lastError) {
                                const error = chrome.runtime.lastError;
                                const errorMsg = error.message || error.toString();
                                if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
                                    console.warn('扩展上下文已失效，降级到localStorage');
                                } else {
                                    console.error('保存本地会话失败:', errorMsg);
                                }
                                // 降级到localStorage
                                try {
                                    localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
                                } catch (localError) {
                                    console.error('保存到localStorage也失败:', localError);
                                }
                            }
                            resolve();
                        });
                    } catch (error) {
                        const errorMsg = error.message || error.toString();
                        if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
                            console.warn('扩展上下文已失效，降级到localStorage');
                        } else {
                            console.error('chrome.storage不可用，降级到localStorage:', errorMsg);
                        }
                        try {
                            localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
                        } catch (localError) {
                            console.error('保存到localStorage也失败:', localError);
                        }
                        resolve();
                    }
                }
            } else {
                // 非 Chrome 环境
                // 使用 localStorage
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
                } catch (error) {
                    console.error('保存本地会话失败:', error);
                }
                resolve();
            }
        });
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
            // 确保使用 session.id 或 sessionId 作为统一标识
            const unifiedSessionId = session.id || sessionId;
            
            // 确保会话的 id 字段与存储键一致
            if (session.id !== sessionId && session.id) {
                // 如果 id 不一致，更新存储键
                delete this.sessions[sessionId];
                this.sessions[unifiedSessionId] = session;
            }
            
            const sessionData = {
                id: unifiedSessionId,
                url: session.url || '',
                pageTitle: session.pageTitle || '',
                pageDescription: session.pageDescription || '',
                messages: session.messages || [],
                tags: session.tags || [],
                createdAt: session.createdAt || Date.now(),
                updatedAt: session.updatedAt || Date.now(),
                lastAccessTime: session.lastAccessTime || Date.now()
            };
            
            // 只有在手动保存页面上下文时才包含 pageContent 字段
            if (includePageContent) {
                sessionData.pageContent = session.pageContent || '';
            }
            
            if (immediate) {
                await this.sessionApi.saveSession(sessionData);
                console.log(`会话 ${unifiedSessionId} 已立即同步到后端`);
            } else {
                this.sessionApi.queueSave(unifiedSessionId, sessionData);
                console.log(`会话 ${unifiedSessionId} 已加入同步队列`);
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
        // 确保使用 session.id 作为键
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('会话不存在，无法恢复:', sessionId);
            return;
        }
        
        // 确保 session.id 与存储键一致（统一标识）
        if (!session.id || session.id !== sessionId) {
            session.id = sessionId;
        }
        
        // 更新会话页面信息
        this.updateSessionPageInfo(sessionId, pageInfo);
        await this.saveSession(sessionId);
        console.log('找到基于URL的已有会话，已自动恢复:', sessionId);
    }
    
    /**
     * 创建新会话
     * @private
     */
    async _createNewSession(sessionId, pageInfo) {
        const newSession = this.createSession(sessionId, pageInfo);
        
        // 确保使用 session.id 作为统一的键
        this.sessions[sessionId] = newSession;
        
        // 确保 session.id 与存储键一致
        if (newSession.id !== sessionId) {
            newSession.id = sessionId;
        }
        
        await this.saveSession(sessionId);
        console.log('使用URL作为会话ID，已自动创建新会话:', sessionId, 'URL:', pageInfo.url);
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
        
        // 转换为数组并按文件名排序
        return Array.from(sessionMap.values()).sort((a, b) => {
            // 获取会话的显示标题（文件名）
            const aTitle = (a.pageTitle || '').trim();
            const bTitle = (b.pageTitle || '').trim();
            
            // 按文件名排序（不区分大小写，支持中文和数字）
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
        session.pageTitle = info.pageTitle || session.pageTitle;
        session.pageDescription = info.pageDescription || session.pageDescription;
        session.pageContent = info.pageContent || session.pageContent;
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
        
        session.pageTitle = title;
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
            // 保存到本地存储
            await this.saveLocalSessions(force);
            
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
        
        // 确保使用统一的会话ID（session.id 或 sessionId）
        const unifiedSessionId = session.id || sessionId;
        
        // 如果是当前会话，清空当前会话ID
        if (this.currentSessionId === sessionId || this.currentSessionId === unifiedSessionId) {
            this.currentSessionId = null;
            this.hasAutoCreatedSessionForPage = false;
        }
        
        // 从本地删除
        delete this.sessions[sessionId];
        // 如果 unifiedSessionId 不同，也删除那个键
        if (unifiedSessionId !== sessionId && this.sessions[unifiedSessionId]) {
            delete this.sessions[unifiedSessionId];
        }
        await this.saveLocalSessions(true);
        
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
            const searchText = `${session.pageTitle} ${session.url}`.toLowerCase();
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
            await this.saveLocalSessions(true);
        }
    }
    
    /**
     * 清空所有会话
     */
    async clearAllSessions() {
        this.sessions = {};
        this.currentSessionId = null;
        this.hasAutoCreatedSessionForPage = false;
        await this.saveLocalSessions(true);
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = SessionManager;
} else {
    window.SessionManager = SessionManager;
}



