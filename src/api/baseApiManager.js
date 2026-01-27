/**
 * API管理器基类
 * 提供统一的请求处理、去重、加载动画等功能
 * 所有API管理器应继承此类
 */

class BaseApiManager {
    constructor(baseUrl, enabled = true, options = {}) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
        
        // 请求去重：存储 { promise, timestamp, timeoutId }
        this.pendingRequests = new Map();
        
        // 请求超时配置（默认30秒）
        this.requestTimeout = options.requestTimeout || 30000;
        
        // 清理定时器：定期清理过期的pending请求
        this._cleanupTimer = null;
        this._cleanupInterval = options.cleanupInterval || 60000; // 每60秒清理一次
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            errorCount: 0,
            duplicateRequests: 0,
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
     * 创建请求key用于去重
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
     * 启动清理定时器
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
            if (now - requestInfo.timestamp > this.requestTimeout) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            const requestInfo = this.pendingRequests.get(key);
            if (requestInfo && requestInfo.timeoutId) {
                clearTimeout(requestInfo.timeoutId);
            }
            this.pendingRequests.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            console.debug(`[${this.constructor.name}] 清理了 ${expiredKeys.length} 个过期的pending请求`);
        }
    }
    
    /**
     * 销毁管理器（清理资源）
     */
    destroy() {
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
            this._cleanupTimer = null;
        }
        
        for (const [key, requestInfo] of this.pendingRequests.entries()) {
            if (requestInfo && requestInfo.timeoutId) {
                clearTimeout(requestInfo.timeoutId);
            }
        }
        
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
     * 获取 API Token
     * @returns {Promise<string>} Token字符串
     */
    async _getApiToken() {
        try {
            if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiToken) {
                return await TokenUtils.getApiToken();
            }
            return '';
        } catch (error) {
            return '';
        }
    }
    
    /**
     * 确保Token已设置
     * @returns {Promise<string>} Token字符串
     */
    async _ensureToken() {
        let token = await this._getApiToken();
        if (!token && typeof TokenUtils !== 'undefined' && TokenUtils.ensureTokenSet) {
            const hasToken = await TokenUtils.ensureTokenSet();
            if (hasToken) {
                token = await this._getApiToken();
            }
        }
        return token;
    }
    
    /**
     * 移除pending请求（清理资源）
     * @param {string} requestKey - 请求key
     */
    _removePendingRequest(requestKey) {
        const requestInfo = this.pendingRequests.get(requestKey);
        if (requestInfo) {
            if (requestInfo.timeoutId) {
                clearTimeout(requestInfo.timeoutId);
            }
            this.pendingRequests.delete(requestKey);
        }
    }
    
    /**
     * 执行请求（带去重，优化版）
     * @param {string} url - 请求URL
     * @param {Object} options - 请求选项
     * @returns {Promise<any>} 请求结果
     */
    async _request(url, options = {}) {
        if (!this.isEnabled()) {
            throw new Error(`${this.constructor.name}未启用`);
        }
        
        const requestKey = this._getRequestKey(options.method || 'GET', url, options.body);
        
        // 检查是否有正在进行的相同请求
        const existingRequest = this.pendingRequests.get(requestKey);
        if (existingRequest && existingRequest.promise) {
            this.stats.duplicateRequests++;
            console.debug(`[${this.constructor.name}] 检测到重复请求，复用已有请求: ${requestKey}`);
            return await existingRequest.promise;
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        // 创建请求Promise
        const requestPromise = (async () => {
            try {
                this.stats.totalRequests++;
                
                // 获取Token
                const token = await this._ensureToken();
                const authHeaders = token ? { 'X-Token': token } : {};
                
                // 合并headers
                const headers = {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                    ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
                };
                
                const response = await fetch(url, {
                    ...options,
                    headers,
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const responseText = await response.text();
                let result;
                try {
                    result = responseText ? JSON.parse(responseText) : null;
                } catch (e) {
                    throw new Error(`响应不是有效的 JSON: ${responseText}`);
                }

                if (!result || typeof result !== 'object' || Array.isArray(result)) {
                    throw new Error('响应格式错误：期望为对象');
                }

                if (!Object.prototype.hasOwnProperty.call(result, 'code')) {
                    throw new Error('响应格式错误：缺少 code');
                }

                if (result.code !== 0) {
                    throw new Error(result.message || `请求失败 (code=${result.code})`);
                }
                
                const data = Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : undefined;
                
                // 从pending中移除
                this._removePendingRequest(requestKey);

                return data;
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
            if (this.pendingRequests.has(requestKey)) {
                console.warn(`[${this.constructor.name}] 请求超时，清理pending请求: ${requestKey}`);
                this._removePendingRequest(requestKey);
            }
        }, this.requestTimeout);
        
        // 保存到pending中
        this.pendingRequests.set(requestKey, {
            promise: requestPromise,
            timestamp: Date.now(),
            timeoutId: timeoutId
        });
        
        return requestPromise;
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            pendingRequests: this.pendingRequests.size,
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            errorCount: 0,
            duplicateRequests: 0,
        };
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = BaseApiManager;
} else {
    window.BaseApiManager = BaseApiManager;
}
