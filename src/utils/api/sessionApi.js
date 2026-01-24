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
                limit: options.limit || 10000,
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
     * 使用 key 查询会话
     * @param {string} sessionKey - 会话 Key (UUID)
     * @returns {Promise<Object|null>} 会话数据，如果不存在则返回 null
     */
    async getSession(sessionKey) {
        if (!sessionKey) {
            return null;
        }
        
        try {
            const keyParams = {
                cname: 'sessions',
                filter: { key: sessionKey },
                limit: 1
            };
            const keyUrl = this._buildGenericApiUrl('query_documents', keyParams);
            const keyResult = await this._request(keyUrl, { method: 'GET' });
            
            // 解析查询结果
            let session = null;
            if (Array.isArray(keyResult) && keyResult.length > 0) {
                session = keyResult[0];
            } else if (keyResult && Array.isArray(keyResult.data) && keyResult.data.length > 0) {
                session = keyResult.data[0];
            } else if (keyResult && keyResult.data && Array.isArray(keyResult.data.list) && keyResult.data.list.length > 0) {
                session = keyResult.data.list[0];
            } else if (keyResult && keyResult.data && Array.isArray(keyResult.data.documents) && keyResult.data.documents.length > 0) {
                session = keyResult.data.documents[0];
            }
            
            return session;
        } catch (error) {
            console.warn(`获取会话 ${sessionKey} 失败:`, error.message);
            return null;
        }
    }
    
    /**
     * 保存单个会话（立即保存）
     * 参考 YiWeb 的 sessionSyncService.js 实现
     * 完全使用 key 作为标识符，不使用 id
     * @param {Object} sessionData - 会话数据（必须包含 key 字段）
     * @returns {Promise<Object>} 保存结果
     */
    async saveSession(sessionData) {
        if (!sessionData) {
            throw new Error('会话数据无效');
        }
        
        // 必须使用 key，如果没有 key 则抛出错误
        const sessionKey = sessionData.key;
        if (!sessionKey || typeof sessionKey !== 'string') {
            throw new Error('会话数据无效：缺少 key 字段');
        }
        
        try {
            // 规范化会话数据（与 YiWeb 保持一致）
            // 注意：data 中必须包含 key 字段
            const normalized = {
                key: String(sessionKey), // data 中必须包含 key
                url: String(sessionData.url || ''),
                title: String(sessionData.title || ''),
                pageDescription: String(sessionData.pageDescription || ''),
                pageContent: String(sessionData.pageContent || ''),
                messages: Array.isArray(sessionData.messages) ? sessionData.messages : [],
                tags: Array.isArray(sessionData.tags) ? sessionData.tags : [],
                isFavorite: sessionData.isFavorite !== undefined ? Boolean(sessionData.isFavorite) : false,
                createdAt: this._normalizeTimestamp(sessionData.createdAt),
                updatedAt: this._normalizeTimestamp(sessionData.updatedAt),
                lastAccessTime: this._normalizeTimestamp(sessionData.lastAccessTime)
            };

            // 检查会话是否存在（通过 key 查询）
            let existingSession = null;
            try {
                const checkParams = {
                    cname: 'sessions',
                    filter: { key: sessionKey },
                    limit: 1
                };
                const checkUrl = this._buildGenericApiUrl('query_documents', checkParams);
                const checkResponse = await this._request(checkUrl, { method: 'GET' });
                
                // 解析查询结果
                if (Array.isArray(checkResponse) && checkResponse.length > 0) {
                    existingSession = checkResponse[0];
                } else if (checkResponse && Array.isArray(checkResponse.data) && checkResponse.data.length > 0) {
                    existingSession = checkResponse.data[0];
                } else if (checkResponse && checkResponse.data && Array.isArray(checkResponse.data.list) && checkResponse.data.list.length > 0) {
                    existingSession = checkResponse.data.list[0];
                } else if (checkResponse && checkResponse.data && Array.isArray(checkResponse.data.documents) && checkResponse.data.documents.length > 0) {
                    existingSession = checkResponse.data.documents[0];
                }
            } catch (error) {
                console.warn('查询会话失败:', error);
            }

            let result;
            if (existingSession) {
                // 更新会话：使用 update_document 和 key 参数
                // data 中必须包含 key 字段
                const payload = {
                    module_name: 'services.database.data_service',
                    method_name: 'update_document',
                    parameters: {
                        cname: 'sessions',
                        key: sessionKey, // parameters 中的 key
                        data: normalized // data 中也必须包含 key
                    }
                };
                
                // 使用 POST 请求发送 payload
                const url = `${this.baseUrl}/`;
                result = await this._request(url, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                console.log(`[SessionApi] 更新会话 (Key: ${sessionKey})`);
            } else {
                // 创建新会话：使用 create_document
                const payload = {
                    module_name: 'services.database.data_service',
                    method_name: 'create_document',
                    parameters: {
                        cname: 'sessions',
                        data: normalized // 包含 key
                    }
                };
                
                // 使用 POST 请求发送 payload
                const url = `${this.baseUrl}/`;
                result = await this._request(url, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                
                console.log(`[SessionApi] 创建会话 (Key: ${sessionKey})`);
            }
            
            this.stats.saveCount++;
            
            // 返回结果
            if (result && result.success !== false) {
                return {
                    success: true,
                    data: result.data || result
                };
            } else {
                throw new Error(result?.message || '保存会话失败');
            }
        } catch (error) {
            console.warn('保存会话到后端失败:', error.message);
            throw error;
        }
    }

    /**
     * 规范化时间戳
     * @param {number|string|Date} timestamp - 时间戳
     * @returns {number} 规范化后的时间戳
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
     * 批量保存会话（添加到队列）
     * @param {Object} sessionData - 会话数据（必须包含 key 字段）
     */
    queueSave(sessionData) {
        if (!sessionData) {
            return;
        }
        
        // 确保 sessionData 有 key 字段
        if (!sessionData.key) {
            console.warn('queueSave: sessionData 缺少 key 字段，跳过');
            return;
        }
        
        // 添加到队列（如果已存在则更新）
        // 使用 sessionData.key 作为队列键，确保唯一性
        this.saveQueue.set(sessionData.key, {
            ...sessionData,
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
        const sessionKeys = sessionsToSave.map(s => s.key).filter(Boolean);
        
        // 从队列中移除
        sessionKeys.forEach(key => this.saveQueue.delete(key));
        
        // 批量保存
        const savePromises = sessionsToSave.map(sessionData => 
            this.saveSession(sessionData).catch(error => {
                console.warn(`批量保存会话 ${sessionData.key} 失败:`, error.message);
                // 保存失败时重新加入队列（限制重试次数）
                if (sessionData.key && (!sessionData.retryCount || sessionData.retryCount < 3)) {
                    this.saveQueue.set(sessionData.key, {
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
     * 使用 key 删除会话（参考 YiWeb 实现）
     * @param {string} sessionKey - 会话 Key (UUID)
     * @returns {Promise<Object>} 删除结果
     */
    async deleteSession(sessionKey) {
        if (!sessionKey) {
            throw new Error('会话 Key 无效');
        }
        
        try {
            // 使用 delete_document（单数）和 key 参数
            const payload = {
                module_name: 'services.database.data_service',
                method_name: 'delete_document',
                parameters: {
                    cname: 'sessions',
                    key: sessionKey
                }
            };
            
            const url = `${this.baseUrl}/`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(payload)
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
     * @param {Array<string>} sessionKeys - 会话 Key 数组 (UUID)
     * @returns {Promise<Object>} 删除结果
     */
    async deleteSessions(sessionKeys) {
        if (!sessionKeys || !Array.isArray(sessionKeys) || sessionKeys.length === 0) {
            throw new Error('会话 Key 列表无效');
        }
        
        try {
            // 批量删除：使用 key 数组
            const deletePromises = sessionKeys.map(key => this.deleteSession(key));
            await Promise.all(deletePromises);
            
            return {
                success: true,
                data: { deletedCount: sessionKeys.length }
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
