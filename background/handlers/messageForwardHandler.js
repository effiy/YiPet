/**
 * 消息转发处理器
 * 处理转发消息到content script的操作
 */

/**
 * 处理转发消息到content script请求
 */
function handleForwardToContentScript(request, sendResponse) {
    console.log('转发消息到content script:', request.tabId, request.message);
    
    chrome.tabs.sendMessage(request.tabId, request.message, (response) => {
        if (chrome.runtime.lastError) {
            console.log('转发消息失败:', chrome.runtime.lastError.message);
            
            if (chrome.runtime.lastError.message.includes('Could not establish connection')) {
                console.log('尝试直接注入content script...');
                
                // 使用注入服务
                const injectService = typeof self !== 'undefined' && self.InjectionService 
                    ? self.InjectionService 
                    : null;
                
                const injectFn = injectService 
                    ? (tabId) => injectService.injectContentScript(tabId)
                    : (typeof injectContentScript === 'function' ? injectContentScript : null);
                
                if (injectFn) {
                    injectFn(request.tabId).then(() => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(request.tabId, request.message, (retryResponse) => {
                                if (chrome.runtime.lastError) {
                                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                                } else {
                                    sendResponse(retryResponse);
                                }
                            });
                        }, CONSTANTS.TIMING.INJECT_PET_DELAY);
                    });
                } else {
                    console.error('无法注入content script：InjectionService 未加载且 injectContentScript 函数不存在');
                    sendResponse({ success: false, error: '无法注入content script' });
                }
                return;
            }
            
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
            console.log('转发消息成功:', response);
            sendResponse(response);
        }
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

