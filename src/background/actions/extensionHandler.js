/**
 * 扩展相关消息处理器
 * 处理扩展信息、选项页面等基础功能
 */

/**
 * 处理获取扩展信息请求
 */
function handleGetExtensionInfo(sendResponse) {
    sendResponse({
        version: chrome.runtime.getManifest().version,
        name: chrome.runtime.getManifest().name
    });
}

/**
 * 处理打开选项页面请求
 */
function handleOpenOptionsPage(sendResponse) {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
}

/**
 * 处理获取活动标签页请求
 */
function handleGetActiveTab(sendResponse) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse({ tab: tabs[0] });
    });
}

// 导出处理器
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        handleGetExtensionInfo,
        handleOpenOptionsPage,
        handleGetActiveTab
    };
} else {
    if (typeof self !== "undefined") {
        self.ExtensionHandler = {
            handleGetExtensionInfo,
            handleOpenOptionsPage,
            handleGetActiveTab
        };
    }
}
