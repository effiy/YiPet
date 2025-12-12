/**
 * 消息路由模块
 * 
 * 功能说明：
 * - 统一管理所有消息路由
 * - 将消息action映射到对应的处理器
 * - 支持同步和异步消息处理
 */

/**
 * 消息路由器类
 */
class MessageRouter {
    constructor() {
        // 消息处理器映射表：action -> handler函数
        this.handlers = new Map();
        
        // 异步操作列表（需要保持消息通道开放）
        this.asyncActions = new Set();
    }

    /**
     * 注册消息处理器
     * @param {string} action - 消息action
     * @param {Function} handler - 处理函数 (request, sender, sendResponse) => void
     * @param {boolean} isAsync - 是否是异步操作（需要返回true保持通道开放）
     */
    register(action, handler, isAsync = false) {
        this.handlers.set(action, { handler, isAsync });
        if (isAsync) {
            this.asyncActions.add(action);
        }
    }

    /**
     * 处理消息
     * @param {Object} request - 请求对象
     * @param {Object} sender - 发送者信息
     * @param {Function} sendResponse - 响应回调函数
     * @returns {boolean|undefined} 如果是异步操作返回true
     */
    handle(request, sender, sendResponse) {
        const action = request.action;
        
        if (!action) {
            sendResponse({ success: false, error: 'Missing action' });
            return;
        }

        const handlerInfo = this.handlers.get(action);
        
        if (!handlerInfo) {
            console.warn(`未知的action: ${action}`);
            sendResponse({ success: false, error: `Unknown action: ${action}` });
            return;
        }

        const { handler, isAsync } = handlerInfo;
        
        try {
            const result = handler(request, sender, sendResponse);
            
            // 如果是异步操作，返回true保持消息通道开放
            if (isAsync) {
                return true;
            }
            
            // 如果处理器返回了值，自动发送响应
            if (result !== undefined) {
                sendResponse(result);
            }
        } catch (error) {
            console.error(`处理消息失败 (${action}):`, error);
            sendResponse({ 
                success: false, 
                error: error.message || 'Handler execution failed' 
            });
        }
    }
}

// 导出单例
if (typeof module !== "undefined" && module.exports) {
    module.exports = MessageRouter;
} else {
    // Service Worker 环境
    if (typeof self !== "undefined") {
        self.MessageRouter = MessageRouter;
    }
}

