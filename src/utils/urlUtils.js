/**
 * URL工具类
 * 
 * 功能说明：
 * - 提供统一的URL检查和处理功能
 * - 检查系统页面和扩展页面
 * - 规范化URL格式
 * 
 * 使用示例：
 * ```javascript
 * // 检查是否是系统页面
 * if (UrlUtils.isSystemPage(url)) {
 *     return; // 跳过系统页面
 * }
 * ```
 */

class UrlUtils {
    /**
     * 检查URL是否是系统页面（不应注入脚本）
     * @param {string} url - 要检查的URL
     * @returns {boolean} 是否是系统页面
     */
    static isSystemPage(url) {
        if (!url || typeof url !== 'string') return false;
        
        // 使用常量中定义的URL前缀
        if (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.URLS && PET_CONFIG.constants.URLS.isSystemPage) {
            return PET_CONFIG.constants.URLS.isSystemPage(url);
        }
        
        // 降级实现（如果常量不可用）
        return url.startsWith('chrome://') ||
               url.startsWith('chrome-extension://') ||
               url.startsWith('moz-extension://') ||
               url.startsWith('about:');
    }
    
    /**
     * 检查URL是否是扩展相关请求
     * @param {string} url - 要检查的URL
     * @returns {boolean} 是否是扩展请求
     */
    static isExtensionRequest(url) {
        if (!url || typeof url !== 'string') return false;
        
        // 降级实现
        const extensionUrlPatterns = [
            /^chrome-extension:\/\//i,
            /^chrome:\/\//i,
            /^moz-extension:\/\//i,
            /api\.effiy\.cn/i
        ];
        
        return extensionUrlPatterns.some(pattern => pattern.test(url));
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = UrlUtils;
} else {
    window.UrlUtils = UrlUtils;
}
