/**
 * 统一错误处理工具类
 * 
 * 功能说明：
 * - 提供统一的错误处理和用户提示机制
 * - 自动显示错误通知（可选）
 * - 检查特定类型的错误（上下文失效、配额错误等）
 * - 安全执行异步操作，自动捕获错误
 * 
 * 使用示例：
 * ```javascript
 * // 安全执行异步操作
 * const result = await ErrorHandler.safeExecute(async () => {
 *     return await someAsyncOperation();
 * }, { showNotification: true });
 * 
 * // 检查是否是上下文失效错误
 * if (ErrorHandler.isContextInvalidated(error)) {
 *     // 处理上下文失效
 * }
 * ```
 */

class ErrorHandler {
    /**
     * 处理操作错误
     * @param {Error|string} error - 错误对象或错误消息
     * @param {Object} options - 选项 {showNotification, fallback}
     * @returns {Object} 错误信息对象
     */
    static handle(error, options = {}) {
        const showNotification = options.showNotification !== false;
        const fallback = options.fallback || CONSTANTS.ERROR_MESSAGES.OPERATION_FAILED;

        let errorMessage = fallback;
        
        if (error instanceof Error) {
            errorMessage = error.message || fallback;
            console.error('操作错误:', error);
        } else if (typeof error === 'string') {
            errorMessage = error;
            console.error('操作错误:', errorMessage);
        }

        if (showNotification && typeof window !== 'undefined' && window.showNotification) {
            window.showNotification(errorMessage, 'error');
        }

        return {
            success: false,
            error: errorMessage,
            originalError: error
        };
    }

    /**
     * 安全执行异步操作（带错误处理）
     * @param {Function} asyncFn - 异步函数
     * @param {Object} options - 选项
     * @returns {Promise<Object>} 结果对象 {success, data, error}
     */
    static async safeExecute(asyncFn, options = {}) {
        try {
            const data = await asyncFn();
            return { success: true, data };
        } catch (error) {
            return this.handle(error, options);
        }
    }

    /**
     * 检查是否是扩展上下文失效错误
     * @param {Error|Object} error - 错误对象
     * @returns {boolean} 是否是上下文失效错误
     */
    static isContextInvalidated(error) {
        if (!error) return false;
        const errorMsg = (error.message || error.toString() || '').toLowerCase();
        return errorMsg.includes('extension context invalidated') ||
               errorMsg.includes('context invalidated') ||
               errorMsg.includes('the message port closed');
    }

    /**
     * 检查是否是配额错误
     * @param {Error|Object} error - 错误对象
     * @returns {boolean} 是否是配额错误
     */
    static isQuotaError(error) {
        if (!error) return false;
        const errorMsg = (error.message || error.toString() || '').toLowerCase();
        return errorMsg.includes('quota_bytes') ||
               errorMsg.includes('quota exceeded') ||
               errorMsg.includes('max_write_operations');
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = ErrorHandler;
} else if (typeof self !== "undefined") {
    // Service Worker / Web Worker 环境
    self.ErrorHandler = ErrorHandler;
    if (typeof globalThis !== "undefined") {
        globalThis.ErrorHandler = ErrorHandler;
    }
} else if (typeof window !== "undefined") {
    // 浏览器环境
    window.ErrorHandler = ErrorHandler;
} else {
    // 最后兜底
    try {
        globalThis.ErrorHandler = ErrorHandler;
    } catch (e) {
        this.ErrorHandler = ErrorHandler;
    }
}

