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
     * 获取默认兜底错误文案（避免对 CONSTANTS 的隐式强依赖导致运行时异常）
     * @returns {string}
     */
    static getDefaultFallback() {
        try {
            const cfg = (typeof globalThis !== 'undefined' && globalThis.PET_CONFIG && globalThis.PET_CONFIG.constants) ? globalThis.PET_CONFIG.constants : null;
            const msg = cfg && cfg.ERROR_MESSAGES && cfg.ERROR_MESSAGES.OPERATION_FAILED;
            return typeof msg === 'string' && msg.trim() ? msg : '操作失败';
        } catch (e) {
            return '操作失败';
        }
    }

    /**
     * 处理操作错误
     * @param {Error|string} error - 错误对象或错误消息
     * @param {Object} options - 选项 {showNotification, fallback}
     * @returns {Object} 错误信息对象
     */
    static handle(error, options = {}) {
        const showNotification = options.showNotification !== false;
        const fallback = options.fallback || this.getDefaultFallback();
        const normalized = this.normalize(error, { fallback });
        if (showNotification && typeof globalThis !== 'undefined' && typeof globalThis['showNotification'] === 'function') {
            const msg = normalized.hint ? `${normalized.message}（${normalized.hint}）` : normalized.message;
            globalThis['showNotification'](msg, normalized.severity === 'error' ? 'error' : 'warn');
        }
        return {
            success: false,
            code: normalized.code,
            error: normalized.message,
            hint: normalized.hint,
            severity: normalized.severity,
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
    static CODES = {
        SYS_CONTEXT_INVALIDATED: { code: 'E_SYS_001', message: '扩展上下文失效', hint: '请刷新页面或重新打开标签', severity: 'error' },
        STORAGE_QUOTA_EXCEEDED: { code: 'E_STORAGE_001', message: '存储配额超限', hint: '请清理历史或降低写入频率', severity: 'warn' },
        NET_NETWORK_ERROR: { code: 'E_NET_001', message: '网络异常', hint: '请检查网络连接或稍后重试', severity: 'error' },
        AUTH_UNAUTHORIZED: { code: 'E_AUTH_401', message: '未授权或登录失效', hint: '请重新登录或设置有效凭证', severity: 'warn' },
        AUTH_FORBIDDEN: { code: 'E_AUTH_403', message: '无访问权限', hint: '请检查权限或联系管理员', severity: 'warn' },
        API_BAD_REQUEST: { code: 'E_API_400', message: '请求参数错误', hint: '请检查输入数据', severity: 'warn' },
        API_NOT_FOUND: { code: 'E_API_404', message: '接口或资源不存在', hint: '请确认接口地址', severity: 'warn' },
        API_SERVER_ERROR: { code: 'E_API_5XX', message: '服务端错误', hint: '请稍后重试或联系支持', severity: 'error' },
        UNKNOWN: { code: 'E_UNKNOWN', message: '操作失败', hint: '', severity: 'error' }
    };
    static fromStatus(status) {
        if (status === 400) return this.CODES.API_BAD_REQUEST;
        if (status === 401) return this.CODES.AUTH_UNAUTHORIZED;
        if (status === 403) return this.CODES.AUTH_FORBIDDEN;
        if (status === 404) return this.CODES.API_NOT_FOUND;
        if (status >= 500) return this.CODES.API_SERVER_ERROR;
        return null;
    }
    static normalize(error, { fallback } = {}) {
        try {
            const fb = typeof fallback === 'string' && fallback.trim() ? fallback : this.getDefaultFallback();
            if (!error) {
                const base = this.CODES.UNKNOWN;
                return { code: base.code, message: fb, hint: base.hint, severity: base.severity };
            }
            if (this.isContextInvalidated(error)) {
                const base = this.CODES.SYS_CONTEXT_INVALIDATED;
                return { code: base.code, message: base.message, hint: base.hint, severity: base.severity };
            }
            if (this.isQuotaError(error)) {
                const base = this.CODES.STORAGE_QUOTA_EXCEEDED;
                return { code: base.code, message: base.message, hint: base.hint, severity: base.severity };
            }
            const status = (error.status || (error.response && error.response.status) || (error.statusCode));
            if (typeof status === 'number') {
                const base = this.fromStatus(status) || this.CODES.UNKNOWN;
                const message = (error.message || (error.response && error.response.statusText) || base.message || fb);
                return { code: base.code, message, hint: base.hint, severity: base.severity };
            }
            const codeField = (error.code || (error.response && error.response.data && error.response.data.code));
            if (typeof codeField === 'string') {
                const upper = codeField.toUpperCase();
                const known = Object.values(this.CODES).find(c => c.code === upper);
                if (known) {
                    const message = error.message || (error.response && error.response.data && error.response.data.message) || known.message || fb;
                    return { code: known.code, message, hint: known.hint, severity: known.severity };
                }
                const message = error.message || (error.response && error.response.data && error.response.data.message) || fb;
                return { code: upper, message, hint: '', severity: 'error' };
            }
            if (error instanceof Error) {
                const msg = error.message || fb;
                if (/network/i.test(msg)) {
                    const base = this.CODES.NET_NETWORK_ERROR;
                    return { code: base.code, message: base.message, hint: base.hint, severity: base.severity };
                }
                return { code: this.CODES.UNKNOWN.code, message: msg, hint: '', severity: 'error' };
            }
            if (typeof error === 'string') {
                const msg = error;
                return { code: this.CODES.UNKNOWN.code, message: msg, hint: '', severity: 'error' };
            }
            const msg = (error.message || fb);
            return { code: this.CODES.UNKNOWN.code, message: msg, hint: '', severity: 'error' };
        } catch (_) {
            const base = this.CODES.UNKNOWN;
            return { code: base.code, message: fallback || base.message, hint: base.hint, severity: base.severity };
        }
    }
    static create(code, message, meta = {}) {
        const err = new Error(message || '');
        err.code = code;
        err.meta = meta;
        return err;
    }
    static async safeExecute(asyncFn, options = {}) {
        try {
            const data = await asyncFn();
            return { success: true, data };
        } catch (error) {
            const handled = this.handle(error, options);
            return handled;
        }
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

