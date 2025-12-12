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
            const MAX_LENGTH = CONSTANTS.API.MAX_WEWORK_CONTENT_LENGTH;
            
            // 参数验证
            if (!webhookUrl || typeof webhookUrl !== 'string') {
                throw new Error('webhookUrl 参数无效');
            }
            
            if (!content || typeof content !== 'string') {
                throw new Error('content 参数无效');
            }
            
            // 最终长度检查：确保不超过限制（这是最后一道防线）
            let finalContent = content;
            const contentLength = finalContent.length;
            
            if (contentLength > MAX_LENGTH) {
                console.warn(`[企微机器人] 内容长度 ${contentLength} 超过限制 ${MAX_LENGTH}，进行截断`);
                // 在最后一个合适的断点处截断，避免截断 Markdown 语法
                let truncated = finalContent.substring(0, MAX_LENGTH);
                
                // 尝试在最后一个换行符处截断
                const lastNewline = truncated.lastIndexOf('\n');
                if (lastNewline > MAX_LENGTH - CONSTANTS.API.MAX_WEWORK_CONTENT_TRUNCATE_MARGIN) {
                    truncated = truncated.substring(0, lastNewline);
                }
                
                finalContent = truncated;
                console.log(`[企微机器人] 截断后长度: ${finalContent.length}`);
            }
            
            // 再次验证长度（双重保险）
            if (finalContent.length > MAX_LENGTH) {
                console.error(`[企微机器人] 截断后仍然超过限制: ${finalContent.length} > ${MAX_LENGTH}`);
                finalContent = finalContent.substring(0, MAX_LENGTH);
            }
            
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

