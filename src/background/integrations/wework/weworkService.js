/**
 * 企微机器人服务
 * 统一管理企微机器人消息发送逻辑
 */

class WeWorkService {
    /**
     * 发送消息到企微机器人
     * @param {string} webhookUrl - 企微机器人webhook地址
     * @param {string} content - 消息内容（Markdown格式）
     * @returns {Promise<Object>} 发送结果
     */
    async sendMessage(webhookUrl, content) {
        try {
            // 企微机器人 markdown.content 的最大长度限制
            const MAX_LENGTH = (typeof self !== 'undefined' && self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.API) ? self.PET_CONFIG.constants.API.MAX_WEWORK_CONTENT_LENGTH : 4096;
            
            // 参数验证
            if (!webhookUrl || typeof webhookUrl !== 'string') {
                throw new Error('webhookUrl 参数无效');
            }
            
            if (!content || typeof content !== 'string') {
                throw new Error('content 参数无效');
            }
            
            // 不再限制消息长度，发送完整内容
            let finalContent = content;
            
            // 根据企微机器人文档，发送 markdown 消息
            const payload = {
                msgtype: "markdown",
                markdown: {
                    content: finalContent
                }
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            if (result.errcode !== 0) {
                throw new Error(result.errmsg || '发送失败');
            }

            return result;
        } catch (error) {
            console.error('发送到企微机器人失败:', error);
            throw error;
        }
    }
}

// 导出单例
if (typeof module !== "undefined" && module.exports) {
    module.exports = WeWorkService;
} else {
    if (typeof self !== "undefined") {
        self.WeWorkService = new WeWorkService();
    }
}
