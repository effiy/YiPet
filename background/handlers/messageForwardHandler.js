/**
 * 消息转发处理器
 * 处理转发消息到content script的操作
 */

/**
 * 处理转发消息到content script请求
 */
function handleForwardToContentScript(request, sendResponse) {
    console.log('转发消息到content script:', request.tabId, request.message);
    
    const injectionService = typeof self !== 'undefined' ? self.InjectionService : null;
    if (injectionService && typeof injectionService.sendMessageToTabWithAutoInject === 'function') {
        injectionService.sendMessageToTabWithAutoInject(request.tabId, request.message).then((result) => {
            if (!result.ok) {
                sendResponse({ success: false, error: result.error || '转发消息失败' });
                return;
            }
            console.log('转发消息成功:', result.response);
            sendResponse(result.response);
        });
        return;
    }

    // 降级：没有 InjectionService 时，直接发送一次
    chrome.tabs.sendMessage(request.tabId, request.message, (response) => {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
        }
        sendResponse(response);
    });
}

// 导出处理器
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        handleForwardToContentScript
    };
} else {
    if (typeof self !== "undefined") {
        self.MessageForwardHandler = {
            handleForwardToContentScript
        };
    }
}

