/**
 * 请求工具类
 * 
 * 功能说明：
 * - 提供URL规范化功能（移除query和hash）
 * - 检查是否是扩展相关请求（用于过滤）
 * - 格式化请求头和请求体
 * - 生成curl命令字符串（用于调试）
 * 
 * 使用示例：
 * ```javascript
 * // 检查是否是扩展请求
 * if (RequestUtils.isExtensionRequest(url)) {
 *     return; // 跳过扩展请求
 * }
 * 
 * // 规范化URL
 * const normalized = RequestUtils.normalizeUrl('https://example.com/path?query=1#hash');
 * // 结果: 'https://example.com/path'
 * 
 * // 生成curl命令
 * const curl = RequestUtils.generateCurl(url, 'POST', headers, body);
 * ```
 */

class RequestUtils {
    /**
     * 扩展相关的URL模式（用于过滤）
     */
    /**
     * 检查是否是扩展请求
     * @param {string} url - 请求URL
     * @returns {boolean} 是否是扩展请求
     */
    static isExtensionRequest(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        for (const pattern of this.EXTENSION_URL_PATTERNS) {
            if (pattern.test(url)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 规范化URL（移除hash和query参数，用于匹配）
     * @param {string} url - 原始URL
     * @returns {string} 规范化后的URL
     */
    static normalizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        try {
            const urlObj = new URL(url);
            return `${urlObj.origin}${urlObj.pathname}`;
        } catch (e) {
            // 如果URL解析失败，尝试简单处理
            const hashIndex = url.indexOf('#');
            const queryIndex = url.indexOf('?');
            let endIndex = url.length;
            if (hashIndex !== -1) {
                endIndex = Math.min(endIndex, hashIndex);
            }
            if (queryIndex !== -1) {
                endIndex = Math.min(endIndex, queryIndex);
            }
            return url.substring(0, endIndex);
        }
    }

    /**
     * 格式化请求头
     * @param {Headers|Object|Array} headers - 请求头
     * @returns {Object} 格式化后的请求头对象
     */
    static formatHeaders(headers) {
        if (!headers) return {};
        
        if (headers instanceof Headers) {
            const result = {};
            headers.forEach((value, key) => {
                result[key] = value;
            });
            return result;
        }
        
        if (Array.isArray(headers)) {
            const result = {};
            headers.forEach(header => {
                result[header.name] = header.value;
            });
            return result;
        }
        
        if (typeof headers === 'object') {
            return { ...headers };
        }
        
        return {};
    }

    /**
     * 格式化请求体
     * @param {*} body - 请求体
     * @returns {*} 格式化后的请求体
     */
    static formatBody(body) {
        if (!body) return null;
        
        if (typeof body === 'string') {
            try {
                // 尝试解析为JSON
                return JSON.parse(body);
            } catch (e) {
                return body;
            }
        }
        
        if (body instanceof FormData) {
            const result = {};
            body.forEach((value, key) => {
                result[key] = value;
            });
            return result;
        }
        
        if (body instanceof URLSearchParams) {
            const result = {};
            body.forEach((value, key) => {
                result[key] = value;
            });
            return result;
        }
        
        return body;
    }

    /**
     * 生成 curl 命令
     * @param {string} url - 请求URL
     * @param {string} method - 请求方法
     * @param {Object} headers - 请求头
     * @param {*} body - 请求体
     * @returns {string} curl命令字符串
     */
    static generateCurl(url, method, headers, body) {
        let curl = `curl -X ${method}`;
        
        // 添加请求头
        if (headers && typeof headers === 'object') {
            Object.entries(headers).forEach(([key, value]) => {
                curl += ` \\\n  -H "${key}: ${value}"`;
            });
        }
        
        // 添加请求体
        if (body) {
            if (typeof body === 'string') {
                curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
            } else if (typeof body === 'object') {
                curl += ` \\\n  -d '${JSON.stringify(body).replace(/'/g, "\\'")}'`;
            }
        }
        
        curl += ` \\\n  "${url}"`;
        return curl;
    }
}

// 静态属性：避免使用 class fields 语法，提升兼容性（尤其是某些扩展运行环境/打包配置）
RequestUtils.EXTENSION_URL_PATTERNS = [
    /^chrome-extension:\/\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
    /api\.effiy\.cn/i, // 扩展使用的API域名
];

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = RequestUtils;
} else if (typeof self !== "undefined") {
    // Service Worker / Web Worker 环境
    self.RequestUtils = RequestUtils;
    if (typeof globalThis !== "undefined") {
        globalThis.RequestUtils = RequestUtils;
    }
} else if (typeof window !== "undefined") {
    // 浏览器环境
    window.RequestUtils = RequestUtils;
} else {
    // 最后兜底
    try {
        globalThis.RequestUtils = RequestUtils;
    } catch (e) {
        this.RequestUtils = RequestUtils;
    }
}

