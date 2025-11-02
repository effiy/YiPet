/**
 * SessionManager 集成示例
 * 展示如何在 PetManager 中使用新的 SessionManager
 * 
 * 注意：这是示例代码，需要根据实际的 content.js 进行调整
 */

// 在 PetManager 的 constructor 中添加 SessionManager
class PetManager {
    constructor() {
        // ... 原有代码 ...
        
        // 会话管理相关属性 - 替换原有逻辑
        // 移除: this.currentSessionId = null;
        // 移除: this.sessions = {};
        // 移除: this.sessionApi = null;
        
        // 新增: SessionManager 实例（延迟初始化）
        this.sessionManager = null;
        
        this.init();
    }

    async init() {
        console.log('初始化宠物管理器');
        
        // 初始化 SessionManager
        await this.initSessionManager();
        
        // ... 原有代码 ...
        
        // 初始化会话：等待页面加载完成后1秒再创建新会话
        this.initSessionWithDelay();
        
        // ... 原有代码 ...
    }
    
    /**
     * 初始化 SessionManager
     */
    async initSessionManager() {
        // 检查 SessionManager 和 SessionApiManager 是否可用
        if (typeof SessionManager === 'undefined') {
            console.warn('SessionManager 未加载');
            return;
        }
        
        // 初始化 SessionApiManager（如果启用后端同步）
        let sessionApi = null;
        if (typeof SessionApiManager !== 'undefined' && PET_CONFIG.api.syncSessionsToBackend) {
            sessionApi = new SessionApiManager(
                PET_CONFIG.api.yiaiBaseUrl,
                PET_CONFIG.api.syncSessionsToBackend
            );
            console.log('会话API管理器已初始化');
        }
        
        // 初始化 SessionManager
        this.sessionManager = new SessionManager({
            sessionApi: sessionApi,
            enableBackendSync: PET_CONFIG.api.syncSessionsToBackend || false,
            storageKey: 'petChatSessions',
            debounceTime: 300,
            throttleTime: 1000,
            reloadInterval: 10000
        });
        
        // 初始化会话管理器
        await this.sessionManager.initialize();
        console.log('SessionManager 已初始化');
    }
    
    /**
     * 获取当前会话ID（兼容性方法）
     */
    get currentSessionId() {
        return this.sessionManager ? this.sessionManager.currentSessionId : null;
    }
    
    /**
     * 设置当前会话ID（兼容性方法）
     */
    set currentSessionId(value) {
        if (this.sessionManager) {
            this.sessionManager.currentSessionId = value;
        }
    }
    
    /**
     * 获取会话（兼容性方法）
     */
    getSession(sessionId) {
        if (this.sessionManager) {
            return this.sessionManager.getSession(sessionId);
        }
        return null;
    }
    
    /**
     * 初始化或恢复会话（使用 SessionManager）
     */
    async initSession() {
        if (!this.sessionManager) {
            await this.initSessionManager();
        }
        
        await this.sessionManager.initSession();
        // currentSessionId 会自动更新
        console.log('会话已初始化:', this.currentSessionId);
    }
    
    /**
     * 加载所有会话（使用 SessionManager）
     */
    async loadAllSessions() {
        if (!this.sessionManager) {
            await this.initSessionManager();
        }
        
        // SessionManager 会在 initialize() 时自动加载
        // 如果需要强制刷新，可以调用：
        await this.sessionManager.refreshSessions();
    }
    
    /**
     * 保存所有会话（使用 SessionManager）
     */
    async saveAllSessions(force = false) {
        if (!this.sessionManager || !this.currentSessionId) {
            return;
        }
        
        await this.sessionManager.saveSession(this.currentSessionId, force);
    }
    
    /**
     * 添加消息到当前会话（使用 SessionManager）
     */
    async addMessageToCurrentSession(message) {
        if (!this.sessionManager || !this.currentSessionId) {
            console.warn('会话管理器未初始化或当前无会话');
            return false;
        }
        
        return await this.sessionManager.addMessage(this.currentSessionId, message);
    }
    
    /**
     * 激活会话（切换到指定会话）
     */
    async activateSession(sessionId, options = {}) {
        if (!this.sessionManager) {
            await this.initSessionManager();
        }
        
        await this.sessionManager.activateSession(sessionId);
        
        // 更新UI
        if (options.updateUI !== false) {
            await this.updateSessionUI({ updateSidebar: true });
        }
        
        // 加载会话消息到聊天窗口
        await this.loadSessionMessages();
    }
    
    /**
     * 加载当前会话的消息到聊天窗口
     */
    async loadSessionMessages() {
        if (!this.sessionManager || !this.currentSessionId) {
            return;
        }
        
        const session = this.sessionManager.getCurrentSession();
        if (!session || !session.messages) {
            return;
        }
        
        // 清空聊天窗口
        if (this.chatWindow) {
            const messagesContainer = this.chatWindow.querySelector('.chat-messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
        }
        
        // 渲染消息
        for (const message of session.messages) {
            await this.renderMessage(message);
        }
    }
    
    /**
     * 删除会话（使用 SessionManager）
     */
    async deleteSession(sessionId) {
        if (!this.sessionManager) {
            return false;
        }
        
        const isCurrent = sessionId === this.currentSessionId;
        await this.sessionManager.deleteSession(sessionId);
        
        // 如果删除的是当前会话，清空聊天窗口
        if (isCurrent) {
            if (this.chatWindow) {
                const messagesContainer = this.chatWindow.querySelector('.chat-messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = '';
                }
            }
        }
        
        // 更新UI
        await this.updateSessionUI({ updateSidebar: true });
        
        return true;
    }
    
    /**
     * 获取所有会话列表（使用 SessionManager）
     */
    getAllSessions() {
        if (!this.sessionManager) {
            return [];
        }
        return this.sessionManager.getAllSessions();
    }
    
    /**
     * 更新会话页面信息（使用 SessionManager）
     */
    updateSessionPageInfo(sessionId, pageInfo = null) {
        if (!this.sessionManager) {
            return false;
        }
        return this.sessionManager.updateSessionPageInfo(sessionId, pageInfo);
    }
    
    /**
     * 更新会话标题（使用 SessionManager）
     */
    async updateSessionTitle(sessionId, title) {
        if (!this.sessionManager) {
            return false;
        }
        
        this.sessionManager.updateSessionTitle(sessionId, title);
        await this.sessionManager.saveSession(sessionId);
        
        // 更新UI
        await this.updateSessionUI({ updateSidebar: true, updateTitle: true });
        
        return true;
    }
    
    /**
     * 搜索会话（使用 SessionManager）
     */
    async searchSessions(query, limit = 10) {
        if (!this.sessionManager) {
            return [];
        }
        return await this.sessionManager.searchSessions(query, limit);
    }
    
    /**
     * 创建新会话（使用 SessionManager）
     */
    async createNewSession(customSessionId = null, pageInfo = null) {
        if (!this.sessionManager) {
            await this.initSessionManager();
        }
        
        const sessionId = await this.sessionManager.createNewSession(customSessionId, pageInfo);
        
        // 激活新会话
        await this.sessionManager.activateSession(sessionId);
        
        // 更新UI
        await this.updateSessionUI({ updateSidebar: true });
        
        return sessionId;
    }
    
    /**
     * 同步会话到后端（使用 SessionManager）
     */
    async syncSessionToBackend(sessionId, immediate = false) {
        if (!this.sessionManager) {
            return;
        }
        await this.sessionManager.syncSessionToBackend(sessionId, immediate);
    }
    
    /**
     * 获取页面信息（用于更新会话）
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
     * 提取页面内容（简化版）
     */
    _extractPageContent() {
        const body = document.body;
        if (!body) return '';
        
        const mainContent = body.innerText || body.textContent || '';
        return mainContent.substring(0, 50000); // 最多50KB
    }
    
    // ... 其他原有方法保持不变 ...
}

