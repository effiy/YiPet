/**
 * HTTP请求客户端
 * 提供统一的请求发送、超时控制、取消请求等功能
 */

export class RequestClient {
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
        const config = { ...this.defaultOptions, ...options };
        const { timeout, abortKey, signal: externalSignal, ...fetchOptions } = config;
        
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
        
        // 发送请求
        const fetchPromise = this._fetchWithRetry(config.url, {
            ...fetchOptions,
            signal: controller.signal
        });
        
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
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });
        
        const fullUrl = searchParams.toString() 
            ? `${url}?${searchParams.toString()}` 
            : url;
        
        return this.request({
            url: fullUrl,
            method: 'GET',
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
            data: JSON.stringify(data),
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
            data: JSON.stringify(data),
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
export function createRequestClient(options = {}) {
    return new RequestClient(options);
}

/**
 * 默认请求客户端实例
 */
export const requestClient = createRequestClient();