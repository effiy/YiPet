/**
 * 请求接口 API 管理器
 * 统一管理请求接口的后端API调用
 * 使用 https://api.effiy.cn/mongodb/?cname=apis
 */

class ApiRequestApiManager {
    constructor(baseUrl = 'https://api.effiy.cn/mongodb', enabled = true) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        this.cname = 'apis';
        
        // 请求去重
        this.pendingRequests = new Map();
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
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
            throw new Error('请求接口 API管理器未启用');
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
                this.stats.errorCount++;
                // 从pending中移除
                this.pendingRequests.delete(requestKey);
                throw error;
            } finally {
                // 隐藏加载动画
                this._hideLoadingAnimation();
            }
        })();
        
        // 保存到pending中
        this.pendingRequests.set(requestKey, requestPromise);
        
        return requestPromise;
    }
    
    /**
     * 保存请求接口（创建或更新）
     * @param {Object} apiRequestData - 请求接口数据
     * @returns {Promise<Object>} 保存结果
     */
    async saveApiRequest(apiRequestData) {
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            
            // 如果有key，使用PUT更新；否则使用POST创建
            const method = apiRequestData.key ? 'PUT' : 'POST';
            
            const result = await this._request(url, {
                method: method,
                body: JSON.stringify(apiRequestData),
            });
            
            // 处理响应格式
            if (result.code === 200) {
                return {
                    success: true,
                    data: result.data || apiRequestData
                };
            } else {
                throw new Error(result.msg || result.message || '保存失败');
            }
        } catch (error) {
            console.warn('保存请求接口失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 删除请求接口
     * @param {Object} apiRequestData - 请求接口数据（需要包含key或url）
     * @returns {Promise<Object>} 删除结果
     */
    async deleteApiRequest(apiRequestData) {
        try {
            const key = apiRequestData.key;
            const url = apiRequestData.url;
            
            if (!key && !url) {
                throw new Error('请求接口缺少key或url字段，无法删除');
            }
            
            let apiUrl = `${this.baseUrl}/?cname=${this.cname}`;
            if (key) {
                apiUrl += `&key=${encodeURIComponent(key)}`;
            } else if (url) {
                apiUrl += `&url=${encodeURIComponent(url)}`;
            }
            
            const result = await this._request(apiUrl, {
                method: 'DELETE',
            });
            
            // 处理响应格式
            if (result.code === 200 || result.status === 200 || result.success === true) {
                return {
                    success: true,
                    data: result.data
                };
            } else {
                throw new Error(result.msg || result.message || '删除失败');
            }
        } catch (error) {
            console.warn('删除请求接口失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 获取所有请求接口
     * @returns {Promise<Array>} 请求接口列表
     */
    async getApiRequests() {
        try {
            const url = `${this.baseUrl}/?cname=${this.cname}`;
            const result = await this._request(url, { method: 'GET' });
            
            // 处理响应格式，数据在 result.data.list 里面
            let apiRequests = [];
            if (result && result.data && Array.isArray(result.data.list)) {
                apiRequests = result.data.list;
            } else if (Array.isArray(result)) {
                apiRequests = result;
            } else {
                console.warn('请求接口 API返回格式异常:', result);
                return [];
            }
            
            // 统一处理ID字段：将 id 转换为 _id（如果存在）
            return apiRequests.map(apiRequest => {
                if (apiRequest.id && !apiRequest._id) {
                    apiRequest._id = apiRequest.id;
                }
                // 确保 tags 字段存在
                if (!apiRequest.tags || !Array.isArray(apiRequest.tags)) {
                    apiRequest.tags = [];
                }
                return apiRequest;
            });
        } catch (error) {
            console.warn('获取请求接口列表失败:', error.message);
            return [];
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = ApiRequestApiManager;
} else {
    window.ApiRequestApiManager = ApiRequestApiManager;
}

