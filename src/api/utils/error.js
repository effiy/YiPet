/**
 * 错误处理工具类
 * 提供统一的错误处理、分类、格式化等功能
 */

(function (root) {
class APIError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', details = null) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.details = details;
        this.timestamp = Date.now();
    }
}

class NetworkError extends APIError {
    constructor(message, details = null) {
        super(message, 'NETWORK_ERROR', details);
        this.name = 'NetworkError';
    }
}

class TimeoutError extends APIError {
    constructor(message, timeout = 0, details = null) {
        super(message, 'TIMEOUT_ERROR', details);
        this.name = 'TimeoutError';
        this.timeout = timeout;
    }
}

class AuthError extends APIError {
    constructor(message, details = null) {
        super(message, 'AUTH_ERROR', details);
        this.name = 'AuthError';
    }
}

class ValidationError extends APIError {
    constructor(message, fields = {}, details = null) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
        this.fields = fields;
    }
}

class RateLimitError extends APIError {
    constructor(message, retryAfter = 0, details = null) {
        super(message, 'RATE_LIMIT_ERROR', details);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

/**
 * 错误处理器
 */
class ErrorHandler {
    constructor(options = {}) {
        this.options = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            onError: options.onError || null,
            ...options
        };
    }
    
    /**
     * 处理错误
     */
    async handle(error, context = {}) {
        const categorizedError = this.categorize(error);
        
        // 记录错误
        console.error(`[API Error] ${categorizedError.name}: ${categorizedError.message}`, {
            error: categorizedError,
            context,
            stack: categorizedError.stack
        });
        
        // 执行自定义错误处理
        if (this.options.onError) {
            try {
                await this.options.onError(categorizedError, context);
            } catch (handlerError) {
                console.error('自定义错误处理器失败:', handlerError);
            }
        }
        
        // 重试逻辑
        if (this._shouldRetry(categorizedError, context)) {
            return this._retry(error, context);
        }
        
        return categorizedError;
    }
    
    /**
     * 分类错误
     */
    categorize(error) {
        // 已经是APIError类型
        if (error instanceof APIError) {
            return error;
        }
        
        // 网络错误
        if (this.isNetworkError(error)) {
            return new NetworkError(
                error.message || '网络请求失败',
                { originalError: error }
            );
        }
        
        // 超时错误
        if (this.isTimeoutError(error)) {
            return new TimeoutError(
                error.message || '请求超时',
                error.timeout || 0,
                { originalError: error }
            );
        }
        
        // 认证错误
        if (this.isAuthError(error)) {
            return new AuthError(
                error.message || '认证失败',
                { originalError: error }
            );
        }
        
        // 验证错误
        if (this.isValidationError(error)) {
            return new ValidationError(
                error.message || '数据验证失败',
                error.fields || {},
                { originalError: error }
            );
        }
        
        // 限流错误
        if (this.isRateLimitError(error)) {
            return new RateLimitError(
                error.message || '请求过于频繁',
                error.retryAfter || 0,
                { originalError: error }
            );
        }
        
        // 默认API错误
        return new APIError(
            error.message || '未知错误',
            'UNKNOWN_ERROR',
            { originalError: error }
        );
    }
    
    /**
     * 是否是网络错误
     */
    isNetworkError(error) {
        if (!error) return false;
        
        // Fetch API 网络错误
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            return true;
        }
        
        // 网络状态错误
        if (error.message && (
            error.message.includes('NetworkError') ||
            error.message.includes('net::ERR_') ||
            error.message.includes('ECONNREFUSED')
        )) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 是否是超时错误
     */
    isTimeoutError(error) {
        if (!error) return false;
        
        // AbortError 通常是超时导致的
        if (error.name === 'AbortError') {
            return true;
        }
        
        // 超时相关消息
        if (error.message && (
            error.message.includes('timeout') ||
            error.message.includes('Timeout') ||
            error.message.includes('ETIMEDOUT')
        )) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 是否是认证错误
     */
    isAuthError(error) {
        if (!error) return false;
        
        // HTTP 401/403
        if (error.status === 401 || error.status === 403) {
            return true;
        }
        
        // 认证相关消息
        if (error.message && (
            error.message.includes('Unauthorized') ||
            error.message.includes('Forbidden') ||
            error.message.includes('认证') ||
            error.message.includes('授权')
        )) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 是否是验证错误
     */
    isValidationError(error) {
        if (!error) return false;
        
        // HTTP 400/422
        if (error.status === 400 || error.status === 422) {
            return true;
        }
        
        // 验证相关消息
        if (error.message && (
            error.message.includes('Validation') ||
            error.message.includes('验证') ||
            error.message.includes('无效')
        )) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 是否是限流错误
     */
    isRateLimitError(error) {
        if (!error) return false;
        
        // HTTP 429
        if (error.status === 429) {
            return true;
        }
        
        // 限流相关消息
        if (error.message && (
            error.message.includes('Rate limit') ||
            error.message.includes('Too Many Requests') ||
            error.message.includes('限流')
        )) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 是否应该重试
     */
    _shouldRetry(error, context) {
        const retryCount = context.retryCount || 0;
        
        // 超过最大重试次数
        if (retryCount >= this.options.maxRetries) {
            return false;
        }
        
        // 网络错误重试
        if (error instanceof NetworkError) {
            return true;
        }
        
        // 超时错误重试
        if (error instanceof TimeoutError) {
            return true;
        }
        
        // 限流错误等待后重试
        if (error instanceof RateLimitError && error.retryAfter > 0) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 重试请求
     */
    async _retry(originalError, context) {
        const retryCount = (context.retryCount || 0) + 1;
        const delay = this._getRetryDelay(originalError, retryCount);
        
        console.log(`[API Retry] 第 ${retryCount} 次重试，延迟 ${delay}ms`);
        
        await this._delay(delay);
        
        // 这里应该重新执行原始请求，但目前只是返回错误
        // 在实际使用中，需要在更高层实现重试逻辑
        return new APIError(
            `请求重试失败 (${retryCount}/${this.options.maxRetries})`,
            'RETRY_FAILED',
            { originalError, retryCount }
        );
    }
    
    /**
     * 获取重试延迟
     */
    _getRetryDelay(error, retryCount) {
        if (error instanceof RateLimitError && error.retryAfter > 0) {
            return error.retryAfter * 1000;
        }
        
        return this.options.retryDelay * Math.pow(2, retryCount - 1);
    }
    
    /**
     * 延迟
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

root.APIError = APIError;
root.NetworkError = NetworkError;
root.TimeoutError = TimeoutError;
root.AuthError = AuthError;
root.ValidationError = ValidationError;
root.RateLimitError = RateLimitError;
root.ErrorHandler = ErrorHandler;

function createError(message, code = 'UNKNOWN_ERROR', details = null) {
    return new APIError(message, code, details);
}

function formatError(error) {
    if (error instanceof APIError) {
        return {
            name: error.name,
            message: error.message,
            code: error.code,
            details: error.details,
            timestamp: error.timestamp
        };
    }
    
    return {
        name: error.name || 'Error',
        message: error.message || 'Unknown error',
        code: 'UNKNOWN_ERROR',
        details: null,
        timestamp: Date.now()
    };
}

let globalErrorHandler = null;

function setGlobalErrorHandler(handler) {
    globalErrorHandler = handler;
}

function getGlobalErrorHandler() {
    return globalErrorHandler;
}

root.createError = createError;
root.formatError = formatError;
root.setGlobalErrorHandler = setGlobalErrorHandler;
root.getGlobalErrorHandler = getGlobalErrorHandler;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
