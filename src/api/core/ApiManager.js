/**
 * API管理器基类
 * 提供统一的请求处理、错误处理、重试机制等功能
 */

(function (root) {
class ApiManager {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.enabled = options.enabled !== false;
        
        // 请求客户端
        this.client = new RequestClient({
            timeout: options.timeout || 30000,
            baseUrl: baseUrl,
            ...options.clientOptions
        });
        
        // 错误处理器
        this.errorHandler = new ErrorHandler(options.errorHandler);
        
        // 日志器
        this.logger = new Logger(options.logger || {});
        
        // Token管理器
        this.tokenManager = new TokenManager();
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            successRequests: 0,
            errorRequests: 0,
            retryRequests: 0
        };
        
        // 请求拦截器
        this.requestInterceptors = [];
        
        // 响应拦截器
        this.responseInterceptors = [];
        
        this._setupDefaultInterceptors();
    }
    
    /**
     * 设置默认拦截器
     */
    _setupDefaultInterceptors() {
        // Token拦截器
        this.addRequestInterceptor(async (config) => {
            const token = await this.tokenManager.getToken();
            if (token) {
                config.headers = {
                    ...config.headers,
                    'X-Token': token
                };
            }
            return config;
        });
        
        // 日志拦截器
        this.addRequestInterceptor(async (config) => {
            this.logger.logRequest(config);
            return config;
        });
        
        this.addResponseInterceptor(async (response) => {
            this.logger.logResponse(response);
            return response;
        });
    }
    
    /**
     * 添加请求拦截器
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    
    /**
     * 添加响应拦截器
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    
    /**
     * 执行请求拦截器链
     */
    async _executeRequestInterceptors(config) {
        let result = { ...config };
        for (const interceptor of this.requestInterceptors) {
            result = await interceptor(result);
        }
        return result;
    }
    
    /**
     * 执行响应拦截器链
     */
    async _executeResponseInterceptors(response) {
        let result = response;
        for (const interceptor of this.responseInterceptors) {
            result = await interceptor(result);
        }
        return result;
    }
    
    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled && !!this.baseUrl;
    }
    
    /**
     * 发送请求
     */
    async request(endpoint, options = {}) {
        if (!this.isEnabled()) {
            throw new Error(`${this.constructor.name}未启用`);
        }
        
        this.stats.totalRequests++;
        
        try {
            // 构建完整URL
            const url = this._buildUrl(endpoint, options.params);
            
            // 执行请求拦截器
            const config = await this._executeRequestInterceptors({
                url,
                ...options
            });
            
            // 发送请求
            const response = await this.client.request(config);
            
            // 执行响应拦截器
            const processedResponse = await this._executeResponseInterceptors(response);
            
            this.stats.successRequests++;
            
            return processedResponse;
        } catch (error) {
            this.stats.errorRequests++;
            
            // 错误处理
            const handledError = await this.errorHandler.handle(error, {
                endpoint,
                options,
                retryCount: 0
            });
            
            throw handledError;
        }
    }
    
    /**
     * GET请求
     */
    async get(endpoint, params = {}, options = {}) {
        return this.request(endpoint, {
            method: 'GET',
            params,
            ...options
        });
    }
    
    /**
     * POST请求
     */
    async post(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            method: 'POST',
            data,
            ...options
        });
    }
    
    /**
     * PUT请求
     */
    async put(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            data,
            ...options
        });
    }
    
    /**
     * DELETE请求
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            method: 'DELETE',
            ...options
        });
    }
    
    /**
     * 构建完整URL
     */
    _buildUrl(endpoint, params = {}) {
        const url = new URL(endpoint, this.baseUrl);
        
        if (params && Object.keys(params).length > 0) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            });
        }
        
        return url.toString();
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalRequests > 0 
                ? (this.stats.successRequests / this.stats.totalRequests * 100).toFixed(2)
                : 0
        };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successRequests: 0,
            errorRequests: 0,
            retryRequests: 0
        };
    }
    
    /**
     * 销毁管理器
     */
    destroy() {
        this.client.destroy();
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }
}

root.ApiManager = ApiManager;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
