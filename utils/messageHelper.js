/**
 * 消息通信工具类
 * 
 * 功能说明：
 * - 统一处理与content script和background script的通信
 * - 提供自动重试机制，提高通信可靠性
 * - 统一错误处理，简化调用代码
 * 
 * 使用示例：
 * ```javascript
 * // 发送消息到content script（带重试）
 * const response = await MessageHelper.sendToContentScript(tabId, { action: 'getStatus' });
 * 
 * // 检查content script是否就绪
 * const isReady = await MessageHelper.checkContentScriptReady(tabId);
 * ```
 */

class MessageHelper {
    /**
     * 发送消息到content script（带重试机制）
     * @param {number} tabId - 标签页ID
     * @param {Object} message - 消息对象
     * @param {Object} options - 选项 {maxRetries, initialDelay}
     * @returns {Promise<Object|null>} 响应结果
     */
    static async sendToContentScript(tabId, message, options = {}) {
        const maxRetries = options.maxRetries || CONSTANTS.RETRY.MAX_RETRIES;
        const initialDelay = options.initialDelay || CONSTANTS.RETRY.INITIAL_DELAY;

        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`发送消息到content script (尝试 ${i + 1}/${maxRetries}):`, message);

                const response = await chrome.runtime.sendMessage({
                    action: 'forwardToContentScript',
                    tabId: tabId,
                    message: message
                });

                console.log('收到响应:', response);
                return response;
            } catch (error) {
                console.log(`通信失败 (尝试 ${i + 1}/${maxRetries}):`, error.message);

                if (i === maxRetries - 1) {
                    console.error('所有通信尝试都失败了');
                    return null;
                }

                // 指数退避
                const delay = initialDelay * (i + 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }

    /**
     * 发送消息到background script
     * @param {Object} message - 消息对象
     * @returns {Promise<Object|null>} 响应结果
     */
    static async sendToBackground(message) {
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error('发送消息到background失败:', error);
            return null;
        }
    }

    /**
     * 检查content script是否就绪
     * @param {number} tabId - 标签页ID
     * @returns {Promise<boolean>} 是否就绪
     */
    static async checkContentScriptReady(tabId) {
        try {
            const response = await this.sendToContentScript(tabId, { action: 'ping' });
            return response !== null;
        } catch (error) {
            console.log('Content script 未响应:', error);
            return false;
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = MessageHelper;
} else {
    window.MessageHelper = MessageHelper;
}

