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
        
        // 请求去重：存储 { promise, timestamp, timeoutId }
        this.pendingRequests = new Map();
        
        // 请求超时配置（30秒）
        this.requestTimeout = 30000;
        
        // 清理定时器：定期清理过期的pending请求
        this._cleanupTimer = null;
        this._cleanupInterval = 60000; // 每60秒清理一次
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            errorCount: 0,
            duplicateRequests: 0, // 去重统计
        };
        
        // 加载动画计数器
        this.activeRequestCount = 0;
        
        // 启动清理定时器
        this._startCleanupTimer();
    }
    
    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled && !!this.baseUrl;
    }
    
    /**
     * 规范化对象（排序键，确保相同对象生成相同的字符串）
     * @param {*} obj - 要规范化的对象
     * @returns {string} 规范化后的字符串
     */
    _normalizeObject(obj) {
        if (obj === null || obj === undefined) {
            return '';
        }
        
        // 如果是字符串，尝试解析为JSON
        if (typeof obj === 'string') {
            try {
                obj = JSON.parse(obj);
            } catch (e) {
                // 如果不是JSON，直接返回
                return obj;
            }
        }
        
        // 如果是对象，递归排序键
        if (typeof obj === 'object') {
            if (Array.isArray(obj)) {
                return JSON.stringify(obj.map(item => this._normalizeObject(item)));
            }
            
            // 检查是否是普通对象（排除Date、RegExp等特殊对象）
            if (obj.constructor && obj.constructor !== Object && !Array.isArray(obj)) {
                // 特殊对象类型，转换为字符串
                try {
                    return JSON.stringify(obj);
                } catch (e) {
                    return String(obj);
                }
            }
            
            // 对象：排序键后序列化
            try {
                const sortedKeys = Object.keys(obj).sort();
                const normalized = {};
                for (const key of sortedKeys) {
                    normalized[key] = this._normalizeObject(obj[key]);
                }
                return JSON.stringify(normalized);
            } catch (e) {
                // 如果Object.keys失败，尝试直接序列化
                try {
                    return JSON.stringify(obj);
                } catch (e2) {
                    return String(obj);
                }
            }
        }
        
        return String(obj);
    }
    
    /**
     * 创建请求key用于去重（优化版：处理对象顺序问题）
     * @param {string} method - 请求方法
     * @param {string} url - 请求URL
     * @param {*} body - 请求体
     * @returns {string} 请求唯一标识
     */
    _getRequestKey(method, url, body) {
        const methodUpper = (method || 'GET').toUpperCase();
        const normalizedBody = body ? this._normalizeObject(body) : '';
        return `${methodUpper}:${url}:${normalizedBody}`;
    }
    
    /**
     * 启动清理定时器（清理过期的pending请求）
     */
    _startCleanupTimer() {
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
        }
        
        this._cleanupTimer = setInterval(() => {
            this._cleanupExpiredRequests();
        }, this._cleanupInterval);
    }
    
    /**
     * 清理过期的pending请求
     */
    _cleanupExpiredRequests() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, requestInfo] of this.pendingRequests.entries()) {
            // 如果请求超过超时时间，标记为过期
            if (now - requestInfo.timestamp > this.requestTimeout) {
                expiredKeys.push(key);
            }
        }
        
        // 清理过期请求
        for (const key of expiredKeys) {
            const requestInfo = this.pendingRequests.get(key);
            if (requestInfo && requestInfo.timeoutId) {
                clearTimeout(requestInfo.timeoutId);
            }
            this.pendingRequests.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            console.debug(`[ApiRequestApiManager] 清理了 ${expiredKeys.length} 个过期的pending请求`);
        }
    }
    
    /**
     * 销毁管理器（清理资源）
     */
    destroy() {
        // 清理定时器
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
            this._cleanupTimer = null;
        }
        
        // 清理所有pending请求的timeout
        for (const [key, requestInfo] of this.pendingRequests.entries()) {
            if (requestInfo && requestInfo.timeoutId) {
                clearTimeout(requestInfo.timeoutId);
            }
        }
        
        // 清空pending请求
        this.pendingRequests.clear();
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
     * 执行请求（带去重，优化版）
     */
    async _request(url, options = {}) {
        if (!this.isEnabled()) {
            throw new Error('请求接口 API管理器未启用');
        }
        
        const requestKey = this._getRequestKey(options.method || 'GET', url, options.body);
        
        // 检查是否有正在进行的相同请求
        const existingRequest = this.pendingRequests.get(requestKey);
        if (existingRequest && existingRequest.promise) {
            // 统计去重请求
            this.stats.duplicateRequests++;
            console.debug(`[ApiRequestApiManager] 检测到重复请求，复用已有请求: ${requestKey}`);
            return await existingRequest.promise;
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
                        ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
                    },
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                const result = await response.json();
                
                // 从pending中移除
                this._removePendingRequest(requestKey);
                
                return result;
            } catch (error) {
                this.stats.errorCount++;
                // 从pending中移除
                this._removePendingRequest(requestKey);
                throw error;
            } finally {
                // 隐藏加载动画
                this._hideLoadingAnimation();
            }
        })();
        
        // 创建超时清理
        const timeoutId = setTimeout(() => {
            // 如果请求超时，清理pending请求
            if (this.pendingRequests.has(requestKey)) {
                console.warn(`[ApiRequestApiManager] 请求超时，清理pending请求: ${requestKey}`);
                this._removePendingRequest(requestKey);
            }
        }, this.requestTimeout);
        
        // 保存到pending中（包含promise、时间戳和timeoutId）
        this.pendingRequests.set(requestKey, {
            promise: requestPromise,
            timestamp: Date.now(),
            timeoutId: timeoutId
        });
        
        return requestPromise;
    }
    
    /**
     * 移除pending请求（清理资源）
     * @param {string} requestKey - 请求key
     */
    _removePendingRequest(requestKey) {
        const requestInfo = this.pendingRequests.get(requestKey);
        if (requestInfo) {
            // 清理超时定时器
            if (requestInfo.timeoutId) {
                clearTimeout(requestInfo.timeoutId);
            }
            // 从Map中移除
            this.pendingRequests.delete(requestKey);
        }
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
                // 保存成功后，调用刷新接口刷新请求接口列表
                try {
                    await this.getApiRequests();
                } catch (refreshError) {
                    // 刷新失败不影响保存操作，静默处理
                    console.debug('刷新请求接口列表失败:', refreshError.message);
                }
                
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
            // 默认只拉取“列表所需”的轻量字段，避免一次性传输 responseText/responseBody 等大字段
            // 需要详情时通过 getApiRequestDetail() 单条拉取
            const excludeFields = encodeURIComponent('headers,body,responseHeaders,responseText,responseBody,curl');
            const url = `${this.baseUrl}/?cname=${this.cname}&pageNum=1&pageSize=200&orderBy=timestamp&orderType=desc&excludeFields=${excludeFields}`;
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
                // 标记为轻量列表数据（展开时可按需拉取详情）
                apiRequest._lite = true;
                return apiRequest;
            });
        } catch (error) {
            console.warn('获取请求接口列表失败:', error.message);
            return [];
        }
    }

    /**
     * 获取单条请求接口详情（完整字段）
     * @param {string} key - 请求接口 key（优先使用 key）
     * @returns {Promise<Object|null>}
     */
    async getApiRequestDetail(key) {
        if (!key) return null;
        try {
            const url = `${this.baseUrl}/detail?cname=${this.cname}&id=${encodeURIComponent(key)}`;
            const result = await this._request(url, { method: 'GET' });

            // 兼容后端返回格式：RespOk -> {data:{...}} / 直接对象
            if (result && result.data) {
                return result.data;
            }
            return result || null;
        } catch (error) {
            console.warn('获取请求接口详情失败:', error.message);
            return null;
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = ApiRequestApiManager;
} else {
    window.ApiRequestApiManager = ApiRequestApiManager;
}


