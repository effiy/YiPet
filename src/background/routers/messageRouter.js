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
        // 包装 sendResponse：记录是否已经响应，避免 Promise 处理器重复响应
        let responded = false;
        const safeSendResponse = (payload) => {
            if (responded) return;
            responded = true;
            try {
                sendResponse(payload);
            } catch (e) {
                // sendResponse 本身失败时，避免再次抛错导致 service worker 崩溃
                try { console.error('sendResponse 调用失败:', e); } catch (_) {}
            }
        };
        
        try {
            const result = handler(request, sender, safeSendResponse);
            
            // 如果是异步操作，返回true保持消息通道开放
            if (isAsync) {
                return true;
            }
            
            // 兼容：处理器如果返回 Promise，也应保持通道开放并在 resolve/reject 后响应
            if (result && typeof result.then === 'function') {
                result.then((resolved) => {
                    if (resolved !== undefined) {
                        safeSendResponse(resolved);
                    }
                }).catch((error) => {
                    try {
                        console.error(`处理消息失败 (${action}):`, error);
                    } catch (_) {}
                    // 尝试使用统一错误处理器（如果存在）
                    try {
                        const ErrorHandler = (typeof self !== 'undefined' && self.GlobalAccessor) 
                            ? self.GlobalAccessor.getErrorHandler()
                            : ((typeof self !== 'undefined' && self.ErrorHandler) ? self.ErrorHandler : null);
                        if (ErrorHandler && typeof ErrorHandler.handle === 'function') {
                            const handled = ErrorHandler.handle(error, { showNotification: false, fallback: 'Handler execution failed' });
                            safeSendResponse({ success: false, error: handled.error || 'Handler execution failed' });
                            return;
                        }
                    } catch (_) {}
                    safeSendResponse({ success: false, error: (error && error.message) ? error.message : 'Handler execution failed' });
                });
                return true;
            }

            // 如果处理器返回了值，自动发送响应
            if (result !== undefined) {
                safeSendResponse(result);
            }
        } catch (error) {
            console.error(`处理消息失败 (${action}):`, error);
            // 尝试使用统一错误处理器（如果存在）
            try {
                const ErrorHandler = (typeof self !== 'undefined' && self.GlobalAccessor) 
                    ? self.GlobalAccessor.getErrorHandler()
                    : ((typeof self !== 'undefined' && self.ErrorHandler) ? self.ErrorHandler : null);
                if (ErrorHandler && typeof ErrorHandler.handle === 'function') {
                    const handled = ErrorHandler.handle(error, { showNotification: false, fallback: 'Handler execution failed' });
                    safeSendResponse({ success: false, error: handled.error || 'Handler execution failed' });
                    return;
                }
            } catch (_) {}
            safeSendResponse({ 
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

