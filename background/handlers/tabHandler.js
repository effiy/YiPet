/**
 * 标签页相关消息处理器
 * 处理标签页相关的操作
 */

/**
 * 处理在新标签页打开链接请求
 */
function handleOpenLinkInNewTab(request, sendResponse) {
    if (!request.url) {
        sendResponse({ success: false, error: 'URL参数缺失' });
        return;
    }
    
    try {
        chrome.tabs.create({ url: request.url }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('打开链接失败:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log('链接已在新标签页打开:', request.url);
                sendResponse({ success: true, tabId: tab.id });
            }
        });
    } catch (error) {
        console.error('打开链接异常:', error);
        sendResponse({ success: false, error: error.message || '打开链接失败' });
    }
}

// 导出处理器
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        handleOpenLinkInNewTab
    };
} else {
    if (typeof self !== "undefined") {
        self.TabHandler = {
            handleOpenLinkInNewTab
        };
    }
}


