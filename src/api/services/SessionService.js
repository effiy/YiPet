/**
 * 会话服务
 * 提供会话相关的API操作，包括CRUD、搜索、批量操作等
 */

(function (root) {
class SessionService extends ApiManager {
    constructor(baseUrl, options = {}) {
        super(baseUrl, {
            ...options,
            logger: {
                ...options.logger,
                prefix: '[SessionService]'
            }
        });
        
        // 批量保存配置
        this.saveQueue = new Map(); // sessionId -> sessionData
        this.saveTimer = null;
        this.saveBatchSize = options.saveBatchSize || 5;
        this.saveInterval = options.saveInterval || 2000;
        
        // 统计信息
        this.stats = {
            ...this.stats,
            saveCount: 0,
            queueSize: 0
        };
    }
    
    /**
     * 获取会话列表
     */
    async getSessionsList(options = {}) {
        try {
            const params = {
                cname: 'sessions',
                limit: options.limit || 10000,
                sort: { updatedAt: -1 },
                ...options.filter
            };
            
            const url = buildDatabaseUrl(this.baseUrl, 'query_documents', params);
            const result = await this.get(url);
            
            return result && Array.isArray(result.list) ? result.list : [];
        } catch (error) {
            this.logger.warn('获取会话列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 获取单个会话
     */
    async getSession(sessionKey) {
        if (!sessionKey) {
            return null;
        }
        
        try {
            const params = {
                cname: 'sessions',
                filter: { key: sessionKey },
                limit: 1
            };
            
            const url = buildDatabaseUrl(this.baseUrl, 'query_documents', params);
            const result = await this.get(url);
            const list = result && Array.isArray(result.list) ? result.list : [];
            
            return list.length > 0 ? list[0] : null;
        } catch (error) {
            this.logger.warn(`获取会话 ${sessionKey} 失败:`, error.message);
            return null;
        }
    }
    
    /**
     * 创建会话
     */
    async createSession(sessionData) {
        if (!sessionData || typeof sessionData !== 'object') {
            throw new Error('会话数据无效');
        }
        
        const normalized = this._normalizeSessionData(sessionData);
        
        const payload = {
            module_name: 'services.database.data_service',
            method_name: 'create_document',
            parameters: {
                cname: 'sessions',
                data: normalized
            }
        };
        
        const result = await this.post('/', payload);
        
        return {
            success: true,
            data: result
        };
    }
    
    /**
     * 保存会话（立即保存）
     */
    async saveSession(sessionData) {
        if (!sessionData || !sessionData.key) {
            throw new Error('会话数据无效：缺少 key 字段');
        }
        
        const sessionKey = sessionData.key;
        
        try {
            const normalized = this._normalizeSessionData(sessionData);
            
            // 检查会话是否存在
            const existingSession = await this.getSession(sessionKey);
            
            let result;
            if (existingSession) {
                // 更新会话
                const payload = {
                    module_name: 'services.database.data_service',
                    method_name: 'update_document',
                    parameters: {
                        cname: 'sessions',
                        key: sessionKey,
                        data: normalized
                    }
                };
                
                result = await this.post('/', payload);
                this.logger.info(`更新会话 (Key: ${sessionKey})`);
            } else {
                // 创建新会话
                result = await this.createSession(normalized);
                this.logger.info(`创建会话 (Key: ${sessionKey})`);
            }
            
            this.stats.saveCount++;
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            this.logger.error('保存会话失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 批量保存会话（添加到队列）
     */
    queueSave(sessionData) {
        if (!sessionData || !sessionData.key) {
            this.logger.warn('queueSave: sessionData 缺少 key 字段，跳过');
            return;
        }
        
        // 添加到队列
        this.saveQueue.set(sessionData.key, {
            ...sessionData,
            queuedAt: Date.now()
        });
        
        // 启动批量保存定时器
        if (!this.saveTimer) {
            this.saveTimer = setTimeout(() => {
                this._processSaveQueue();
            }, this.saveInterval);
        }
    }
    
    /**
     * 处理保存队列
     */
    async _processSaveQueue() {
        if (this.saveQueue.size === 0) {
            this.saveTimer = null;
            return;
        }
        
        this.saveTimer = null;
        
        // 获取待保存的会话
        const sessionsToSave = Array.from(this.saveQueue.values())
            .slice(0, this.saveBatchSize);
        
        const sessionKeys = sessionsToSave.map(s => s.key).filter(Boolean);
        
        // 从队列中移除
        sessionKeys.forEach(key => this.saveQueue.delete(key));
        
        // 批量保存
        const savePromises = sessionsToSave.map(sessionData => 
            this.saveSession(sessionData).catch(error => {
                this.logger.warn(`批量保存会话 ${sessionData.key} 失败:`, error.message);
                
                // 保存失败时重新加入队列（限制重试次数）
                if (sessionData.key && (!sessionData.retryCount || sessionData.retryCount < 3)) {
                    this.saveQueue.set(sessionData.key, {
                        ...sessionData,
                        retryCount: (sessionData.retryCount || 0) + 1
                    });
                }
                
                return null;
            })
        );
        
        await Promise.all(savePromises);
        
        // 如果队列还有数据，继续处理
        if (this.saveQueue.size > 0) {
            this.saveTimer = setTimeout(() => {
                this._processSaveQueue();
            }, this.saveInterval);
        }
    }
    
    /**
     * 立即处理所有待保存的会话
     */
    async flushSaveQueue() {
        // 清空定时器
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        
        // 处理所有待保存的会话
        while (this.saveQueue.size > 0) {
            await this._processSaveQueue();
        }
    }
    
    /**
     * 删除会话
     */
    async deleteSession(sessionKey) {
        if (!sessionKey) {
            throw new Error('会话 Key 无效');
        }
        
        try {
            const payload = {
                module_name: 'services.database.data_service',
                method_name: 'delete_document',
                parameters: {
                    cname: 'sessions',
                    key: sessionKey
                }
            };
            
            const result = await this.post('/', payload);
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            this.logger.error('删除会话失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 批量删除会话
     */
    async deleteSessions(sessionKeys) {
        if (!sessionKeys || !Array.isArray(sessionKeys) || sessionKeys.length === 0) {
            throw new Error('会话 Key 列表无效');
        }
        
        try {
            const deletePromises = sessionKeys.map(key => this.deleteSession(key));
            await Promise.all(deletePromises);
            
            return {
                success: true,
                data: { deletedCount: sessionKeys.length }
            };
        } catch (error) {
            this.logger.error('批量删除会话失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 搜索会话
     */
    async searchSessions(query, options = {}) {
        if (!query) {
            return [];
        }
        
        try {
            const resolvedOptions = typeof options === 'number' ? { limit: options } : (options || {});
            const params = {
                cname: 'sessions',
                filter: {
                    '$or': [
                        { 'title': { '$regex': query, '$options': 'i' } },
                        { 'content': { '$regex': query, '$options': 'i' } }
                    ]
                },
                limit: resolvedOptions.limit || 10,
                ...resolvedOptions.filter
            };
            
            const url = buildDatabaseUrl(this.baseUrl, 'query_documents', params);
            const result = await this.get(url);
            
            return result && Array.isArray(result.list) ? result.list : [];
        } catch (error) {
            this.logger.warn('搜索会话失败:', error.message);
            return [];
        }
    }
    
    async _request(url, options = {}) {
        return this.request(url, options);
    }
    
    /**
     * 规范化会话数据
     */
    _normalizeSessionData(sessionData) {
        const normalized = {
            key: String(sessionData.key || ''),
            url: String(sessionData.url || ''),
            title: String(sessionData.title || ''),
            pageDescription: String(sessionData.pageDescription || ''),
            messages: Array.isArray(sessionData.messages) ? sessionData.messages : [],
            tags: Array.isArray(sessionData.tags) ? sessionData.tags : [],
            isFavorite: sessionData.isFavorite !== undefined ? Boolean(sessionData.isFavorite) : false,
            createdAt: this._normalizeTimestamp(sessionData.createdAt),
            updatedAt: this._normalizeTimestamp(sessionData.updatedAt),
            lastAccessTime: this._normalizeTimestamp(sessionData.lastAccessTime)
        };
        
        // 特殊会话处理
        const isAicrSession = normalized.url.startsWith('aicr-session://') || 
                             normalized.pageDescription.includes('文件：');
        
        if (!isAicrSession) {
            normalized.pageContent = String(sessionData.pageContent || '');
        }
        
        return normalized;
    }
    
    /**
     * 规范化时间戳
     */
    _normalizeTimestamp(timestamp) {
        if (!timestamp) {
            return Date.now();
        }
        
        if (typeof timestamp === 'number') {
            return timestamp;
        }
        
        if (typeof timestamp === 'string') {
            const parsed = parseInt(timestamp, 10);
            return isNaN(parsed) ? Date.now() : parsed;
        }
        
        if (timestamp instanceof Date) {
            return timestamp.getTime();
        }
        
        return Date.now();
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...super.getStats(),
            saveCount: this.stats.saveCount,
            queueSize: this.saveQueue.size
        };
    }
    
    /**
     * 销毁服务
     */
    destroy() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        
        this.saveQueue.clear();
        super.destroy();
    }
}

root.SessionService = SessionService;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
