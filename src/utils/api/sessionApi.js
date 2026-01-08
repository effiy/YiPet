/**
 * 会话API管理器
 * 统一管理所有会话相关的后端API调用
 * 提供缓存、去重、批量保存等功能
 */

class SessionApiManager extends BaseApiManager {
    constructor(baseUrl, enabled = true) {
        super(baseUrl, enabled);
        
        // 请求队列
        this.saveQueue = new Map(); // sessionId -> sessionData
        this.saveTimer = null;
        this.saveBatchSize = 5; // 每批最多保存5个会话
        this.saveInterval = 2000; // 每2秒处理一次批量保存
        
        // 扩展统计信息
        this.stats.saveCount = 0;
    }

    /**
     * 构建通用API URL
     * @param {string} methodName - 方法名
     * @param {Object} parameters - 参数
     * @returns {string} 构建好的URL
     */
    _buildGenericApiUrl(methodName, parameters) {
        const queryParams = new URLSearchParams({
            module_name: 'services.database.data_service',
            method_name: methodName,
            parameters: JSON.stringify(parameters)
        });
        return `${this.baseUrl}/?${queryParams.toString()}`;
    }
    
    /**
     * 获取会话列表
     * @param {Object} options - 查询选项
     * @returns {Promise<Array>} 会话列表
     */
    async getSessionsList(options = {}) {
        try {
            const params = {
                cname: 'sessions',
                limit: options.limit || 100,
                sort: { updatedAt: -1 }
            };
            const url = this._buildGenericApiUrl('query_documents', params);
            const result = await this._request(url, { method: 'GET' });
            
            // 兼容不同的返回格式
            if (Array.isArray(result)) {
                return result;
            }
            if (result && Array.isArray(result.data)) {
                return result.data;
            }
            if (result && result.data && Array.isArray(result.data.sessions)) {
                return result.data.sessions;
            }
            if (result && result.data && Array.isArray(result.data.documents)) {
                return result.data.documents;
            }
            if (result && result.data && result.data.list && Array.isArray(result.data.list)) {
                return result.data.list;
            }
            if (result && Array.isArray(result.documents)) {
                return result.documents;
            }
            if (result && result.documents && result.documents.list && Array.isArray(result.documents.list)) {
                return result.documents.list;
            }
            if (result && result.result && Array.isArray(result.result)) {
                return result.result;
            }
            if (result && result.data && result.data.result && Array.isArray(result.data.result)) {
                return result.data.result;
            }
            console.warn('获取会话列表：返回数据格式异常', result);
            return [];
        } catch (error) {
            console.warn('获取会话列表失败:', error.message);
            // 返回空数组而不是抛出错误，避免影响主流程
            return [];
        }
    }
    
    /**
     * 获取单个会话
     * @param {string} sessionId - 会话ID
     * @returns {Promise<Object|null>} 会话数据，如果不存在则返回 null
     */
    async getSession(sessionId) {
        try {
            const params = {
                cname: 'sessions',
                filter: { session_id: sessionId },
                limit: 1
            };
            const url = this._buildGenericApiUrl('query_documents', params);
            const result = await this._request(url, { method: 'GET' });
            
            let session = null;
            if (Array.isArray(result) && result.length > 0) {
                session = result[0];
            } else if (result && Array.isArray(result.data) && result.data.length > 0) {
                session = result.data[0];
            } else if (result && result.data && Array.isArray(result.data.documents) && result.data.documents.length > 0) {
                session = result.data.documents[0];
            }
            
            return session;
        } catch (error) {
            console.warn(`获取会话 ${sessionId} 失败:`, error.message);
            return null;
        }
    }
    
    /**
     * 保存单个会话（立即保存）
     * @param {Object} sessionData - 会话数据
     * @returns {Promise<Object>} 保存结果
     */
    async saveSession(sessionData) {
        if (!sessionData || !sessionData.id) {
            throw new Error('会话数据无效');
        }
        
        const sessionId = sessionData.id;
        
        try {
            // 使用 update_documents 进行 upsert
            const params = {
                cname: 'sessions',
                filter: { session_id: sessionId },
                update: { '$set': sessionData },
                upsert: true
            };
            
            const url = this._buildGenericApiUrl('update_documents', params);
            const result = await this._request(url, {
                method: 'POST' // 使用 POST 避免 URL 过长（取决于后端支持）
            });
            
            this.stats.saveCount++;
            
            // 返回结果
            return {
                success: true,
                data: result.data || result
            };
        } catch (error) {
            console.warn('保存会话到后端失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 批量保存会话（添加到队列）
     * @param {string} sessionId - 会话ID
     * @param {Object} sessionData - 会话数据
     */
    queueSave(sessionId, sessionData) {
        if (!sessionId || !sessionData) {
            return;
        }
        
        // 添加到队列（如果已存在则更新）
        this.saveQueue.set(sessionId, {
            ...sessionData,
            id: sessionId,
            queuedAt: Date.now(),
        });
        
        // 启动批量保存定时器（如果还没启动）
        if (!this.saveTimer) {
            this.saveTimer = setTimeout(() => {
                this._processSaveQueue();
            }, this.saveInterval);
        }
    }
    
    /**
     * 处理保存队列（批量保存）
     */
    async _processSaveQueue() {
        if (this.saveQueue.size === 0) {
            this.saveTimer = null;
            return;
        }
        
        // 清空定时器
        this.saveTimer = null;
        
        // 获取待保存的会话（最多batchSize个）
        const sessionsToSave = Array.from(this.saveQueue.values())
            .slice(0, this.saveBatchSize);
        const sessionIds = sessionsToSave.map(s => s.id);
        
        // 从队列中移除
        sessionIds.forEach(id => this.saveQueue.delete(id));
        
        // 批量保存
        const savePromises = sessionsToSave.map(sessionData => 
            this.saveSession(sessionData).catch(error => {
                console.warn(`批量保存会话 ${sessionData.id} 失败:`, error.message);
                // 保存失败时重新加入队列（限制重试次数）
                if (!sessionData.retryCount || sessionData.retryCount < 3) {
                    this.saveQueue.set(sessionData.id, {
                        ...sessionData,
                        retryCount: (sessionData.retryCount || 0) + 1,
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
     * @param {string} sessionId - 会话ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteSession(sessionId) {
        if (!sessionId) {
            throw new Error('会话ID无效');
        }
        
        try {
            const params = {
                cname: 'sessions',
                filter: { session_id: sessionId }
            };
            const url = this._buildGenericApiUrl('delete_documents', params);
            const result = await this._request(url, {
                method: 'POST'
            });
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('删除会话失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量删除会话
     * @param {Array<string>} sessionIds - 会话ID数组
     * @returns {Promise<Object>} 删除结果
     */
    async deleteSessions(sessionIds) {
        if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
            throw new Error('会话ID列表无效');
        }
        
        try {
            const params = {
                cname: 'sessions',
                filter: { session_id: { '$in': sessionIds } }
            };
            const url = this._buildGenericApiUrl('delete_documents', params);
            const result = await this._request(url, {
                method: 'POST'
            });
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('批量删除会话失败:', error);
            throw error;
        }
    }
    
    /**
     * 搜索会话
     * @param {string} query - 搜索关键词
     * @param {number} limit - 返回数量限制
     * @returns {Promise<Array>} 搜索结果
     */
    async searchSessions(query, limit = 10) {
        if (!query) {
            return [];
        }
        
        try {
            // 使用正则模糊匹配标题或内容（假设字段为 title 和 content）
            const params = {
                cname: 'sessions',
                filter: {
                    '$or': [
                        { 'title': { '$regex': query, '$options': 'i' } },
                        { 'content': { '$regex': query, '$options': 'i' } }
                    ]
                },
                limit: limit
            };
            
            const url = this._buildGenericApiUrl('query_documents', params);
            const result = await this._request(url, { method: 'GET' });
            
            if (Array.isArray(result)) {
                return result;
            } else if (result && Array.isArray(result.data)) {
                return result.data;
            } else if (result && result.sessions) { // 兼容旧格式返回
                 return result.sessions;
            } else {
                return [];
            }
        } catch (error) {
            console.warn('搜索会话失败:', error.message);
            return [];
        }
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...super.getStats(),
            saveCount: this.stats.saveCount,
            queueSize: this.saveQueue.size,
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        super.resetStats();
        this.stats.saveCount = 0;
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = SessionApiManager;
} else {
    window.SessionApiManager = SessionApiManager;
}
