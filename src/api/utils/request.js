/**
 * HTTP请求客户端
 * 提供统一的请求发送、超时控制、取消请求等功能
 */

(function (root) {
class RequestClient {
    constructor(options = {}) {
        this.defaultOptions = {
            timeout: options.timeout || 30000,
            mode: options.mode || 'cors',
            credentials: options.credentials || 'omit',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        this.abortControllers = new Map();
        this.activeRequests = new Set();
    }
    
    /**
     * 发送请求
     */
    async request(options = {}) {
        const mergedHeaders = {
            ...(this.defaultOptions.headers || {}),
            ...(options.headers || {})
        };
        
        const config = { ...this.defaultOptions, ...options, headers: mergedHeaders };
        const { timeout, abortKey, signal: externalSignal, url, params, data, baseUrl, ...fetchOptions } = config;
        
        if (!url) {
            throw new Error('请求缺少 url');
        }
        
        let signal = externalSignal;
        
        // 创建中止控制器
        if (abortKey) {
            this.abort(abortKey);
            const controller = new AbortController();
            this.abortControllers.set(abortKey, controller);
            signal = controller.signal;
        }
        
        const controller = new AbortController();
        if (signal) {
            try {
                if (signal.aborted) {
                    controller.abort();
                } else if (typeof signal.addEventListener === 'function') {
                    signal.addEventListener('abort', () => {
                        controller.abort();
                    }, { once: true });
                }
            } catch (_) {}
        }
        
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
            const timer = setTimeout(() => {
                controller.abort();
                reject(new Error(`请求超时：${timeout}ms`));
            }, timeout);
            controller.signal._timer = timer;
        });
        
        const finalUrl = this._buildUrlWithParams(url, params);
        const requestInit = this._buildFetchOptions({ ...fetchOptions, data });
        
        // 发送请求
        const fetchPromise = this._fetchWithRetry(finalUrl, { ...requestInit, signal: controller.signal });
        
        try {
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            clearTimeout(controller.signal._timer);
            
            if (abortKey) {
                this.abortControllers.delete(abortKey);
            }
            
            return response;
        } catch (error) {
            clearTimeout(controller.signal._timer);
            
            if (abortKey) {
                this.abortControllers.delete(abortKey);
            }
            
            throw error;
        }
    }
    
    /**
     * 带重试机制的fetch
     */
    async _fetchWithRetry(url, options, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 1000;
        
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await this._parseResponse(response);
        } catch (error) {
            if (retryCount < maxRetries && this._shouldRetry(error)) {
                await this._delay(retryDelay * Math.pow(2, retryCount));
                return this._fetchWithRetry(url, options, retryCount + 1);
            }
            
            throw error;
        }
    }
    
    /**
     * 解析响应
     */
    async _parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            // 检查业务错误码
            if (data.code !== undefined && data.code !== 0) {
                throw new Error(data.message || `请求失败 (code=${data.code})`);
            }
            
            return data.data !== undefined ? data.data : data;
        }
        
        if (contentType && contentType.includes('text/')) {
            return await response.text();
        }
        
        return await response.blob();
    }
    
    /**
     * 是否应该重试
     */
    _shouldRetry(error) {
        // 网络错误重试
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            return true;
        }
        
        // 超时重试
        if (error.name === 'AbortError') {
            return true;
        }
        
        return false;
    }
    
    /**
     * 延迟
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 取消请求
     */
    abort(abortKey) {
        if (!abortKey) return;
        
        const controller = this.abortControllers.get(abortKey);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(abortKey);
        }
    }
    
    /**
     * GET请求
     */
    async get(url, params = {}, options = {}) {
        return this.request({
            url,
            method: 'GET',
            params,
            ...options
        });
    }
    
    /**
     * POST请求
     */
    async post(url, data = {}, options = {}) {
        return this.request({
            url,
            method: 'POST',
            data,
            ...options
        });
    }
    
    /**
     * PUT请求
     */
    async put(url, data = {}, options = {}) {
        return this.request({
            url,
            method: 'PUT',
            data,
            ...options
        });
    }
    
    /**
     * DELETE请求
     */
    async delete(url, options = {}) {
        return this.request({
            url,
            method: 'DELETE',
            ...options
        });
    }
    
    _buildFetchOptions(options = {}) {
        const { data, ...fetchOptions } = options;
        const method = (fetchOptions.method || 'GET').toUpperCase();
        
        const headers = { ...(fetchOptions.headers || {}) };
        let body = fetchOptions.body;
        
        if (body === undefined && data !== undefined && method !== 'GET' && method !== 'HEAD') {
            if (data instanceof FormData) {
                body = data;
                if (headers['Content-Type']) {
                    delete headers['Content-Type'];
                }
            } else if (typeof data === 'string' || data instanceof Blob || data instanceof ArrayBuffer) {
                body = data;
            } else {
                body = JSON.stringify(data);
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }
            }
        }
        
        return { ...fetchOptions, headers, body };
    }
    
    _buildUrlWithParams(url, params) {
        if (!params || typeof params !== 'object' || Object.keys(params).length === 0) {
            return url;
        }
        
        try {
            const u = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    u.searchParams.append(key, String(value));
                }
            });
            return u.toString();
        } catch (_) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            });
            const qs = searchParams.toString();
            if (!qs) return url;
            return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
        }
    }
    
    /**
     * 销毁客户端
     */
    destroy() {
        this.abortControllers.forEach(controller => controller.abort());
        this.abortControllers.clear();
    }
}

/**
 * 创建请求客户端
 */
function createRequestClient(options = {}) {
    return new RequestClient(options);
}

/**
 * 默认请求客户端实例
 */
const requestClient = createRequestClient();

root.RequestClient = RequestClient;
root.createRequestClient = createRequestClient;
root.requestClient = requestClient;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
