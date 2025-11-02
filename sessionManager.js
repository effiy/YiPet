/**
 * 会话管理器
 * 统一管理前端会话的创建、保存、加载、同步等功能
 * 提供清晰的 API 接口，与后端 SessionService 对接
 */

class SessionManager {
    constructor(options = {}) {
        // 配置选项
        this.sessionApi = options.sessionApi || null; // SessionApiManager 实例
        this.storageKey = options.storageKey || 'petChatSessions'; // 本地存储键
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
     * 生成会话ID（基于URL的哈希或UUID）
     * @param {string} url - 页面URL（可选）
     * @returns {Promise<string>} 会话ID
     */
    async generateSessionId(url) {
        if (!url) {
            // 如果没有URL，生成基于时间戳的会话ID
            return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // 使用 Web Crypto API 生成 SHA-256 哈希（如果可用）
        if (window.crypto && window.crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(url);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                return hashHex.substring(0, 32); // 使用前32个字符作为会话ID
            } catch (error) {
                console.warn('使用 Web Crypto API 生成会话ID失败，使用备用方法:', error);
            }
        }
        
        // 备用方法：简单的字符串哈希
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            const char = url.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * 创建会话对象
     */
    createSession(sessionId, pageInfo = {}) {
        const now = Date.now();
        return {
            id: sessionId,
            url: pageInfo.url || window.location.href,
            title: pageInfo.title || document.title || '',
            pageTitle: pageInfo.pageTitle || document.title || '',
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
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get([this.storageKey], (result) => {
                    if (result[this.storageKey]) {
                        this.sessions = result[this.storageKey];
                    } else {
                        this.sessions = {};
                    }
                    resolve();
                });
            } else {
                // 非 Chrome 环境，使用 localStorage
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
     */
    async loadBackendSessions(forceRefresh = false) {
        if (!this.sessionApi || !this.enableBackendSync) {
            return;
        }
        
        try {
            const now = Date.now();
            // 检查是否需要重新加载
            if (!forceRefresh && (now - this.lastSessionListLoadTime) < this.SESSION_LIST_RELOAD_INTERVAL) {
                return;
            }
            
            this.lastSessionListLoadTime = now;
            const backendSessions = await this.sessionApi.getSessionsList({ forceRefresh });
            
            // 合并后端会话到本地会话（以后端数据为准）
            for (const backendSession of backendSessions) {
                const sessionId = backendSession.id;
                if (!sessionId) continue;
                
                const localSession = this.sessions[sessionId];
                if (!localSession) {
                    // 本地没有，直接使用后端数据
                    this.sessions[sessionId] = backendSession;
                } else {
                    // 比较更新时间，使用更新的版本
                    const localUpdatedAt = localSession.updatedAt || 0;
                    const backendUpdatedAt = backendSession.updatedAt || 0;
                    
                    if (backendUpdatedAt >= localUpdatedAt) {
                        // 后端更新，使用后端数据（但保留本地未同步的字段）
                        this.sessions[sessionId] = {
                            ...localSession,
                            ...backendSession,
                            // 保留本地的 messages（如果后端没有或更旧）
                            messages: backendSession.messages && backendSession.messages.length > 0
                                ? backendSession.messages
                                : localSession.messages
                        };
                    }
                }
            }
        } catch (error) {
            console.warn('从后端加载会话失败:', error);
        }
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
        
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ [this.storageKey]: this.sessions }, () => {
                    resolve();
                });
            } else {
                // 非 Chrome 环境，使用 localStorage
                try {
                    localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
                    resolve();
                } catch (error) {
                    console.error('保存本地会话失败:', error);
                    resolve();
                }
            }
        });
    }
    
    /**
     * 同步会话到后端
     */
    async syncSessionToBackend(sessionId, immediate = false) {
        if (!this.sessionApi || !this.enableBackendSync) {
            return;
        }
        
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('会话不存在，无法同步:', sessionId);
            return;
        }
        
        try {
            const sessionData = {
                id: session.id || sessionId,
                url: session.url || '',
                title: session.title || '',
                pageTitle: session.pageTitle || '',
                pageDescription: session.pageDescription || '',
                pageContent: session.pageContent || '',
                messages: session.messages || [],
                createdAt: session.createdAt || Date.now(),
                updatedAt: session.updatedAt || Date.now(),
                lastAccessTime: session.lastAccessTime || Date.now()
            };
            
            if (immediate) {
                await this.sessionApi.saveSession(sessionData);
                console.log(`会话 ${sessionId} 已立即同步到后端`);
            } else {
                this.sessionApi.queueSave(sessionId, sessionData);
                console.log(`会话 ${sessionId} 已加入同步队列`);
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
        this.sessions[sessionId] = newSession;
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
     * 获取所有会话列表
     */
    getAllSessions() {
        return Object.values(this.sessions).sort((a, b) => {
            const aTime = a.updatedAt || a.createdAt || 0;
            const bTime = b.updatedAt || b.createdAt || 0;
            return bTime - aTime;
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
     * 删除会话中的消息
     */
    async deleteMessage(sessionId, messageIndex) {
        const session = this.sessions[sessionId];
        if (!session || !session.messages) {
            return false;
        }
        
        if (messageIndex >= 0 && messageIndex < session.messages.length) {
            session.messages.splice(messageIndex, 1);
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
     */
    async deleteSession(sessionId) {
        if (!this.sessions[sessionId]) {
            return false;
        }
        
        // 如果是当前会话，清空当前会话ID
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
            this.hasAutoCreatedSessionForPage = false;
        }
        
        // 从本地删除
        delete this.sessions[sessionId];
        await this.saveLocalSessions(true);
        
        // 从后端删除
        if (this.sessionApi && this.enableBackendSync) {
            try {
                await this.sessionApi.deleteSession(sessionId);
            } catch (error) {
                console.warn('从后端删除会话失败:', error);
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
            const searchText = `${session.title} ${session.pageTitle} ${session.url}`.toLowerCase();
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

