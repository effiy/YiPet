/**
 * 重试机制工具类
 * 提供统一的自动重试、错误恢复和渐进式降级功能
 * author: liangliang
 */

import { logError, logWarn, logInfo } from './log.js';
import { handleError } from './error.js';

/**
 * 重试配置选项
 * @typedef {Object} RetryOptions
 * @property {number} maxRetries - 最大重试次数，默认3次
 * @property {number} initialDelay - 初始延迟时间（毫秒），默认500ms
 * @property {number} maxDelay - 最大延迟时间（毫秒），默认5000ms
 * @property {number} backoffMultiplier - 退避倍数，默认2（指数退避）
 * @property {Function} shouldRetry - 判断是否应该重试的函数，默认所有错误都重试
 * @property {Function} onRetry - 重试前的回调函数
 * @property {Function} onSuccess - 成功后的回调函数
 * @property {Function} onFailure - 最终失败后的回调函数
 */

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    shouldRetry: (error, attempt) => true,
    onRetry: null,
    onSuccess: null,
    onFailure: null
};

/**
 * 计算延迟时间（指数退避）
 * @param {number} attempt - 当前尝试次数（从0开始）
 * @param {RetryOptions} options - 重试配置
 * @returns {number} 延迟时间（毫秒）
 */
function calculateDelay(attempt, options) {
    const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
    return Math.min(delay, options.maxDelay);
}

/**
 * 延迟执行
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行器
 * @param {Function} fn - 要执行的异步函数
 * @param {RetryOptions} options - 重试配置选项
 * @param {string} context - 执行上下文（用于日志）
 * @returns {Promise<any>} 函数执行结果
 */
export async function retryAsync(fn, options = {}, context = '') {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const result = await fn(attempt);
            
            // 成功后回调
            if (attempt > 0 && config.onSuccess) {
                try {
                    config.onSuccess(result, attempt);
                } catch (callbackError) {
                    logWarn(`[Retry] 成功回调执行失败: ${callbackError.message}`);
                }
            }
            
            if (attempt > 0) {
                logInfo(`[Retry] ${context} 在第 ${attempt + 1} 次尝试后成功`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            
            // 判断是否应该重试
            const shouldRetry = attempt < config.maxRetries && 
                               config.shouldRetry(error, attempt);
            
            if (!shouldRetry) {
                logWarn(`[Retry] ${context} 不再重试: ${error.message}`);
                break;
            }
            
            // 计算延迟时间
            const delay = calculateDelay(attempt, config);
            
            logWarn(`[Retry] ${context} 第 ${attempt + 1} 次尝试失败: ${error.message}，${delay}ms 后重试...`);
            
            // 重试前回调
            if (config.onRetry) {
                try {
                    config.onRetry(error, attempt + 1, delay);
                } catch (callbackError) {
                    logWarn(`[Retry] 重试回调执行失败: ${callbackError.message}`);
                }
            }
            
            // 等待后重试
            await sleep(delay);
        }
    }
    
    // 最终失败回调
    if (config.onFailure) {
        try {
            config.onFailure(lastError, config.maxRetries + 1);
        } catch (callbackError) {
            logWarn(`[Retry] 失败回调执行失败: ${callbackError.message}`);
        }
    }
    
    // 记录错误
    handleError(lastError, `${context} (重试 ${config.maxRetries + 1} 次后失败)`);
    
    throw lastError;
}

/**
 * 带重试的同步函数执行器
 * @param {Function} fn - 要执行的函数
 * @param {RetryOptions} options - 重试配置选项
 * @param {string} context - 执行上下文（用于日志）
 * @returns {any} 函数执行结果
 */
export function retry(fn, options = {}, context = '') {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const result = fn(attempt);
            
            // 成功后回调
            if (attempt > 0 && config.onSuccess) {
                try {
                    config.onSuccess(result, attempt);
                } catch (callbackError) {
                    logWarn(`[Retry] 成功回调执行失败: ${callbackError.message}`);
                }
            }
            
            if (attempt > 0) {
                logInfo(`[Retry] ${context} 在第 ${attempt + 1} 次尝试后成功`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            
            // 判断是否应该重试
            const shouldRetry = attempt < config.maxRetries && 
                               config.shouldRetry(error, attempt);
            
            if (!shouldRetry) {
                logWarn(`[Retry] ${context} 不再重试: ${error.message}`);
                break;
            }
            
            logWarn(`[Retry] ${context} 第 ${attempt + 1} 次尝试失败: ${error.message}，立即重试...`);
            
            // 重试前回调
            if (config.onRetry) {
                try {
                    config.onRetry(error, attempt + 1, 0);
                } catch (callbackError) {
                    logWarn(`[Retry] 重试回调执行失败: ${callbackError.message}`);
                }
            }
        }
    }
    
    // 最终失败回调
    if (config.onFailure) {
        try {
            config.onFailure(lastError, config.maxRetries + 1);
        } catch (callbackError) {
            logWarn(`[Retry] 失败回调执行失败: ${callbackError.message}`);
        }
    }
    
    // 记录错误
    handleError(lastError, `${context} (重试 ${config.maxRetries + 1} 次后失败)`);
    
    throw lastError;
}

/**
 * 创建重试配置预设
 */
export const RetryPresets = {
    /**
     * 快速重试（适合网络请求）
     */
    fast: {
        maxRetries: 2,
        initialDelay: 200,
        maxDelay: 1000,
        backoffMultiplier: 2
    },
    
    /**
     * 标准重试（适合一般操作）
     */
    standard: {
        maxRetries: 3,
        initialDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 2
    },
    
    /**
     * 慢速重试（适合资源加载）
     */
    slow: {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 1.5
    },
    
    /**
     * 初始化重试（适合初始化操作）
     */
    initialization: {
        maxRetries: 3,
        initialDelay: 500,
        maxDelay: 3000,
        backoffMultiplier: 2,
        shouldRetry: (error) => {
            // 对于某些特定错误不重试
            const noRetryMessages = ['权限不足', '未授权', '已取消'];
            return !noRetryMessages.some(msg => error.message?.includes(msg));
        }
    }
};

// 在全局作用域中暴露（用于非模块环境）
if (typeof window !== 'undefined') {
    window.retryAsync = retryAsync;
    window.retry = retry;
    window.RetryPresets = RetryPresets;
}
