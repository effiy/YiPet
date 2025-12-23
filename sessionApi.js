/**
 * 会话API管理器
 * 统一管理所有会话相关的后端API调用
 * 提供缓存、去重、批量保存等功能
 */

class SessionApiManager {
    constructor(baseUrl, enabled = true) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        
        // 请求队列
        this.saveQueue = new Map(); // sessionId -> sessionData
        this.saveTimer = null;
        this.saveBatchSize = 5; // 每批最多保存5个会话
        this.saveInterval = 2000; // 每2秒处理一次批量保存
        
        // 请求去重
        this.pendingRequests = new Map(); // 去重用
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            saveCount: 0,
            errorCount: 0,
        };
        
        // 加载动画计数器
        this.activeRequestCount = 0;
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
     * 显示加载动画
     */
    _showLoadingAnimation() {
        this.activeRequestCount++;
        if (this.activeRequestCount === 1 && typeof window !== 'undefined' && window.petLoadingAnimation) {
            window.petLoadingAnimation.show();
        }
    }
    
    /**
     * 隐藏加载动画
     */
    _hideLoadingAnimation() {
        this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
        if (this.activeRequestCount === 0 && typeof window !== 'undefined' && window.petLoadingAnimation) {
            window.petLoadingAnimation.hide();
        }
    }
    
    /**
     * 执行请求（带去重）
     */
    async _request(url, options = {}) {
        if (!this.isEnabled()) {
            throw new Error('API管理器未启用');
        }
        
        const requestKey = this._getRequestKey(options.method || 'GET', url, options.body);
        
        // 检查是否有正在进行的相同请求
        if (this.pendingRequests.has(requestKey)) {
            return await this.pendingRequests.get(requestKey);
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        // 创建请求Promise
        const requestPromise = (async () => {
            try {
                this.stats.totalRequests++;
                
                // 获取 API Token（优先从 chrome.storage，支持跨 tab 和跨域共享）
                const getApiToken = async () => {
                    try {
                        // 优先使用 TokenUtils（如果可用）
                        if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiToken) {
                            return await TokenUtils.getApiToken();
                        }
                        // 降级方案：从 localStorage 获取
                        const token = localStorage.getItem('YiPet.apiToken.v1');
                        return token ? String(token).trim() : '';
                    } catch (error) {
                        return '';
                    }
                };

                // 检查并确保 token 已设置
                let token = await getApiToken();
                if (!token && typeof TokenUtils !== 'undefined' && TokenUtils.ensureTokenSet) {
                    const hasToken = await TokenUtils.ensureTokenSet();
                    if (hasToken) {
                        token = await getApiToken();
                    }
                }

                const authHeaders = token ? { 'X-Token': token } : {};

                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders,
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
                
                // 隐藏加载动画
                this._hideLoadingAnimation();
                
                return result;
            } catch (error) {
                // 从pending中移除
                this.pendingRequests.delete(requestKey);
                
                // 隐藏加载动画
                this._hideLoadingAnimation();
                
                this.stats.errorCount++;
                throw error;
            }
        })();
        
        // 保存到pending中
        this.pendingRequests.set(requestKey, requestPromise);
        
        return requestPromise;
    }
    
    /**
     * 获取会话列表
     * @param {Object} options - 查询选项
     * @returns {Promise<Array>} 会话列表
     */
    async getSessionsList(options = {}) {
        try {
            const url = `${this.baseUrl}/session/`;
            const result = await this._request(url, { method: 'GET' });
            
            // 兼容不同的返回格式（与 YiH5 保持一致）
            if (Array.isArray(result)) {
                return result;
            } else if (result && Array.isArray(result.sessions)) {
                return result.sessions;
            } else if (result && Array.isArray(result.data)) {
                return result.data;
            } else if (result && result.data && Array.isArray(result.data.sessions)) {
                return result.data.sessions;
            } else {
                console.warn('获取会话列表：返回数据格式异常', result);
                return [];
            }
        } catch (error) {
            console.warn('获取会话列表失败:', error.message);
            // 返回空数组而不是抛出错误，避免影响主流程
            return [];
        }
    }
    
    /**
     * 获取单个会话
     * @param {string} sessionId - 会话ID
     * @returns {Promise<Object>} 会话数据
     */
    async getSession(sessionId) {
        try {
            const url = `${this.baseUrl}/session/${encodeURIComponent(sessionId)}`;
            const result = await this._request(url, { method: 'GET' });
            
            if (result.success && result.data) {
                return result.data;
            } else {
                throw new Error('返回数据格式错误');
            }
        } catch (error) {
            console.warn(`获取会话 ${sessionId} 失败:`, error.message);
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
        
        const sessionId = sessionData.id;
        
        try {
            // 调用 session/save API 保存会话
            const url = `${this.baseUrl}/session/save`;
            const result = await this._request(url, {
                method: 'POST',
                body: JSON.stringify(sessionData),
            });
            
            this.stats.saveCount++;
            
            // 返回结果（适配不同的响应格式）
            if (result.success && result.data) {
                return result;
            } else if (result.data) {
                return {
                    success: true,
                    data: result.data
                };
            } else {
                return {
                    success: true,
                    data: {
                        id: sessionId,
                        session_id: sessionId,
                        session: sessionData
                    }
                };
            }
        } catch (error) {
            console.warn('保存会话到后端失败:', error.message);
            throw error;
            return {
                success: true,
                data: {
                    id: sessionId,
                    session_id: sessionId,
                    session: sessionData
                }
            };
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
     * 批量删除会话
     * @param {Array<string>} sessionIds - 会话ID数组
     * @returns {Promise<Object>} 删除结果
     */
    async deleteSessions(sessionIds) {
        if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
            throw new Error('会话ID列表无效');
        }
        
        try {
            const url = `${this.baseUrl}/session/batch/delete`;
            const result = await this._request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_ids: sessionIds
                })
            });
            
            if (result.success) {
                return result;
            } else {
                throw new Error(result.message || '批量删除失败');
            }
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
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            queueSize: this.saveQueue.size,
            pendingRequests: this.pendingRequests.size,
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
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





