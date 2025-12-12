/**
 * 错误处理工具类
 * 统一处理错误，提供一致的错误处理机制
 */

class ErrorHandler {
    constructor() {
        this.registeredErrorCallbacks = [];
    }
    
    /**
     * 注册错误回调
     */
    registerErrorCallback(callback) {
        if (typeof callback === 'function') {
            this.registeredErrorCallbacks.push(callback);
        }
    }
    
    /**
     * 处理错误
     */
    handleError(error, context = '') {
        const errorInfo = {
            message: error?.message || error?.toString() || '未知错误',
            stack: error?.stack,
            context: context,
            timestamp: Date.now()
        };
        
        // 调用所有注册的回调
        this.registeredErrorCallbacks.forEach(callback => {
            try {
                callback(errorInfo);
            } catch (e) {
                // 静默处理回调错误
                console.error('错误回调执行失败:', e);
            }
        });
        
        // 默认错误处理：输出到控制台
        if (context) {
            console.error(`[${context}]`, errorInfo.message, error);
        } else {
            console.error(errorInfo.message, error);
        }
        
        return errorInfo;
    }
    
    /**
     * 安全执行函数（自动捕获错误）
     */
    async executeSafely(fn, context = '', defaultValue = null) {
        try {
            return await fn();
        } catch (error) {
            this.handleError(error, context);
            return defaultValue;
        }
    }
    
    /**
     * 安全执行同步函数（自动捕获错误）
     */
    executeSafelySync(fn, context = '', defaultValue = null) {
        try {
            return fn();
        } catch (error) {
            this.handleError(error, context);
            return defaultValue;
        }
    }
    
    /**
     * 包装异步函数，自动处理错误
     */
    wrapAsyncFunction(fn, context = '') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error, context);
                throw error;
            }
        };
    }
    
    /**
     * 包装同步函数，自动处理错误
     */
    wrapSyncFunction(fn, context = '') {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError(error, context);
                throw error;
            }
        };
    }
}

// 创建全局错误处理器实例
const globalErrorHandler = new ErrorHandler();

// 全局错误监听
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        globalErrorHandler.handleError(event.error, 'GlobalError');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        globalErrorHandler.handleError(event.reason, 'UnhandledRejection');
    });
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = { ErrorHandler, globalErrorHandler };
} else {
    window.ErrorHandler = ErrorHandler;
    window.globalErrorHandler = globalErrorHandler;
}

