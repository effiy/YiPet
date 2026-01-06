/**
 * 兼容层：保留旧的 `YiPet/errorHandler.js` 导出形态（{ ErrorHandler, globalErrorHandler }），
 * 但实际实现统一委托给 `YiPet/utils/errorHandler.js`，避免项目内出现两套 ErrorHandler 逻辑。
 */

// 优先使用 utils 版（提供 ErrorHandler.safeExecute / isContextInvalidated 等静态能力）
let ErrorHandler;
try {
    if (typeof require !== 'undefined') {
        ErrorHandler = require('./utils/errorHandler.js');
    }
} catch (e) {
    // ignore
}
if (!ErrorHandler) {
    // 浏览器环境：优先 globalThis / window 上的 ErrorHandler（可能由 utils/errorHandler.js 注入）
    try {
        ErrorHandler = (typeof globalThis !== 'undefined' && globalThis.ErrorHandler) ? globalThis.ErrorHandler : null;
    } catch (e) {
        ErrorHandler = null;
    }
}

// 提供与旧实现一致的全局错误处理器（实例 API：registerErrorCallback / handleError）
const globalErrorHandler = (() => {
    const registeredErrorCallbacks = [];

    const buildErrorInfo = (error, context = '') => ({
        message: error?.message || error?.toString?.() || '未知错误',
        stack: error?.stack,
        context,
        timestamp: Date.now(),
    });

    const notifyCallbacks = (errorInfo) => {
        registeredErrorCallbacks.forEach((cb) => {
            try {
                cb(errorInfo);
            } catch (e) {
                // 静默处理回调错误（避免二次错误放大）
                console.error('错误回调执行失败:', e);
            }
        });
    };

    return {
        registerErrorCallback(callback) {
            if (typeof callback === 'function') {
                registeredErrorCallbacks.push(callback);
            }
        },

        handleError(error, context = '') {
            const errorInfo = buildErrorInfo(error, context);
            notifyCallbacks(errorInfo);

            // 统一交给 utils ErrorHandler 处理（若存在），否则退回到 console
            try {
                if (ErrorHandler && typeof ErrorHandler.handle === 'function') {
                    const handled = ErrorHandler.handle(error, { showNotification: false, fallback: errorInfo.message });
                    errorInfo.code = handled.code;
                    errorInfo.severity = handled.severity;
                    errorInfo.hint = handled.hint;
                } else {
                    if (context) {
                        console.error(`[${context}]`, errorInfo.message, error);
                    } else {
                        console.error(errorInfo.message, error);
                    }
                }
            } catch (e) {
                // 兜底：绝不因为错误处理器本身报错而中断
                try {
                    console.error(errorInfo.message, error);
                } catch (_) {}
            }

            return errorInfo;
        },
    };
})();

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

