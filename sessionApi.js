/**
 * 会话API管理器
 * 统一管理所有会话相关的后端API调用
 * 提供缓存、去重、批量保存、重试等功能
 */

class SessionApiManager {
    constructor(baseUrl, enabled = true) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        
        // 请求缓存
        this.cache = {
            sessionsList: null,
            sessionsListTimestamp: 0,
            sessionsMap: new Map(), // 单个会话的缓存
            CACHE_DURATION: 30000, // 缓存30秒
        };
        
        // 请求队列
        this.saveQueue = new Map(); // sessionId -> sessionData
        this.saveTimer = null;
        this.saveBatchSize = 5; // 每批最多保存5个会话
        this.saveInterval = 2000; // 每2秒处理一次批量保存
        
        // 请求去重
        this.pendingRequests = new Map(); // 去重用
        
        // 重试配置
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000, // 1秒
        };
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            saveCount: 0,
            errorCount: 0,
        };
    }
    
    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled && !!this.baseUrl;
    }
    
    /**
     * 创建请求key用于去重
     */
    _getRequestKey(method, url, body) {
        const bodyStr = body ? JSON.stringify(body) : '';
        return `${method}:${url}:${bodyStr}`;
    }
    
    /**
     * 执行请求（带重试和去重）
     */
    async _request(url, options = {}, retryCount = 0) {
        if (!this.isEnabled()) {
            throw new Error('API管理器未启用');
        }
        
        const requestKey = this._getRequestKey(options.method || 'GET', url, options.body);
        
        // 检查是否有正在进行的相同请求
        if (this.pendingRequests.has(requestKey)) {
            return await this.pendingRequests.get(requestKey);
        }
        
        // 创建请求Promise
        const requestPromise = (async () => {
            try {
                this.stats.totalRequests++;
                
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers,
                    },
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                const result = await response.json();
                
                // 从pending中移除
                this.pendingRequests.delete(requestKey);
                
                return result;
            } catch (error) {
                // 从pending中移除
                this.pendingRequests.delete(requestKey);
                
                // 重试逻辑
                if (retryCount < this.retryConfig.maxRetries) {
                    console.warn(`请求失败，${this.retryConfig.retryDelay}ms后重试 (${retryCount + 1}/${this.retryConfig.maxRetries}):`, error.message);
                    await new Promise(resolve => setTimeout(resolve, this.retryConfig.retryDelay * (retryCount + 1)));
                    return this._request(url, options, retryCount + 1);
                }
                
                this.stats.errorCount++;
                throw error;
            }
        })();
        
        // 保存到pending中
        this.pendingRequests.set(requestKey, requestPromise);
        
        return requestPromise;
    }
    
    /**
     * 获取会话列表（带缓存）
     * @param {Object} options - 查询选项
     * @param {boolean} options.forceRefresh - 强制刷新缓存
     * @param {number} options.limit - 限制数量
     * @param {number} options.skip - 跳过数量
     * @returns {Promise<Array>} 会话列表
     */
    async getSessionsList(options = {}) {
        const { forceRefresh = false, limit = 50, skip = 0 } = options;
        const now = Date.now();
        
        // 检查缓存
        if (!forceRefresh && 
            this.cache.sessionsList && 
            (now - this.cache.sessionsListTimestamp) < this.cache.CACHE_DURATION) {
            this.stats.cacheHits++;
            return this.cache.sessionsList;
        }
        
        this.stats.cacheMisses++;
        
        try {
            const url = `${this.baseUrl}/session/?limit=${limit}&skip=${skip}`;
            const result = await this._request(url, { method: 'GET' });
            
            if (result.success && Array.isArray(result.sessions)) {
                // 更新缓存
                this.cache.sessionsList = result.sessions;
                this.cache.sessionsListTimestamp = now;
                
                return result.sessions;
            } else {
                throw new Error('返回数据格式错误');
            }
        } catch (error) {
            console.warn('获取会话列表失败:', error.message);
            // 如果请求失败，返回缓存的数据（如果有）
            if (this.cache.sessionsList) {
                console.log('使用缓存的会话列表');
                return this.cache.sessionsList;
            }
            throw error;
        }
    }
    
    /**
     * 获取单个会话（带缓存）
     * @param {string} sessionId - 会话ID
     * @param {boolean} forceRefresh - 强制刷新缓存
     * @returns {Promise<Object>} 会话数据
     */
    async getSession(sessionId, forceRefresh = false) {
        const cacheKey = `session:${sessionId}`;
        const cached = this.cache.sessionsMap.get(cacheKey);
        
        // 检查缓存
        if (!forceRefresh && cached && cached.timestamp) {
            const now = Date.now();
            if ((now - cached.timestamp) < this.cache.CACHE_DURATION) {
                this.stats.cacheHits++;
                return cached.data;
            }
        }
        
        this.stats.cacheMisses++;
        
        try {
            const url = `${this.baseUrl}/session/${encodeURIComponent(sessionId)}`;
            const result = await this._request(url, { method: 'GET' });
            
            if (result.success && result.data) {
                // 更新缓存
                this.cache.sessionsMap.set(cacheKey, {
                    data: result.data,
                    timestamp: Date.now(),
                });
                
                return result.data;
            } else {
                throw new Error('返回数据格式错误');
            }
        } catch (error) {
            console.warn(`获取会话 ${sessionId} 失败:`, error.message);
            // 如果请求失败，返回缓存的数据（如果有）
            if (cached && cached.data) {
                console.log(`使用缓存的会话数据: ${sessionId}`);
                return cached.data;
            }
            throw error;
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
        
        try {
            const url = `${this.baseUrl}/session/save`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(sessionData),
            });
            
            if (result.success) {
                this.stats.saveCount++;
                
                // 更新缓存
                const sessionId = result.data?.session_id || result.data?.id || sessionData.id;
                
                // 如果返回了完整会话数据，使用返回的数据更新缓存
                if (result.data?.session) {
                    this.cache.sessionsMap.set(`session:${sessionId}`, {
                        data: result.data.session,
                        timestamp: Date.now(),
                    });
                } else {
                    // 否则使用传入的数据
                    this.cache.sessionsMap.set(`session:${sessionId}`, {
                        data: { ...sessionData, id: sessionId },
                        timestamp: Date.now(),
                    });
                }
                
                // 清除列表缓存，因为列表可能已变化
                this.cache.sessionsList = null;
                this.cache.sessionsListTimestamp = 0;
                
                return result;
            } else {
                throw new Error(result.message || '保存失败');
            }
        } catch (error) {
            console.error('保存会话失败:', error);
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
            const url = `${this.baseUrl}/session/${encodeURIComponent(sessionId)}`;
            const result = await this._request(url, {
                method: 'DELETE',
            });
            
            if (result.success) {
                // 从缓存中删除
                this.cache.sessionsMap.delete(`session:${sessionId}`);
                
                // 清除列表缓存，因为列表可能已变化
                this.cache.sessionsList = null;
                this.cache.sessionsListTimestamp = 0;
                
                return result;
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('删除会话失败:', error);
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
            const url = `${this.baseUrl}/session/search`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify({ query, limit }),
            });
            
            if (result.success && Array.isArray(result.sessions)) {
                return result.sessions;
            } else {
                throw new Error('返回数据格式错误');
            }
        } catch (error) {
            console.warn('搜索会话失败:', error.message);
            return [];
        }
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.sessionsList = null;
        this.cache.sessionsListTimestamp = 0;
        this.cache.sessionsMap.clear();
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            queueSize: this.saveQueue.size,
            cacheSize: this.cache.sessionsMap.size,
            pendingRequests: this.pendingRequests.size,
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            saveCount: 0,
            errorCount: 0,
        };
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = SessionApiManager;
} else {
    window.SessionApiManager = SessionApiManager;
}

