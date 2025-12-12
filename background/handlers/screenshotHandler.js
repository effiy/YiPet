/**
 * 截图相关消息处理器
 * 处理标签页截图功能
 */

/**
 * 处理截图请求
 * 检查权限后执行截图操作
 */
function handleCaptureVisibleTab(sendResponse) {
    console.log('处理截图请求');
    
    // 检查是否已有activeTab权限
    chrome.permissions.contains({
        permissions: ['activeTab']
    }, (hasPermission) => {
        console.log('Background权限检查结果:', hasPermission);
        
        if (!hasPermission) {
            // 如果没有权限，尝试请求权限
            console.error('缺少activeTab权限，尝试请求权限...');
            chrome.permissions.request({
                permissions: ['activeTab']
            }, (granted) => {
                console.log('Background权限请求结果:', granted);
                if (granted) {
                    captureTabScreenshot(sendResponse);
                } else {
                    console.error('权限请求被拒绝');
                    sendResponse({ 
                        success: false, 
                        error: '权限请求被拒绝，请手动在扩展管理页面中启用权限' 
                    });
                }
            });
        } else {
            // 已有权限，直接执行截图
            captureTabScreenshot(sendResponse);
        }
    });
}

/**
 * 执行标签页截图（内部函数，供 handleCaptureVisibleTab 调用）
 */
function captureTabScreenshot(sendResponse) {
    // 检查是否有活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
            console.error('没有找到活动标签页');
            sendResponse({ 
                success: false, 
                error: '没有找到活动标签页' 
            });
            return;
        }
        
        const activeTab = tabs[0];
        console.log('活动标签页:', activeTab.id, activeTab.url);
        
        // 检查标签页URL是否允许截图
        if (CONSTANTS.URLS.isSystemPage(activeTab.url)) {
            console.error('无法截取系统页面:', activeTab.url);
            sendResponse({ 
                success: false, 
                error: '无法截取系统页面，请在其他网页中使用截图功能' 
            });
            return;
        }
        
        // 使用captureVisibleTab API截图
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error('截图失败:', chrome.runtime.lastError.message);
                
                let errorMessage = chrome.runtime.lastError.message;
                
                // 提供更友好的错误信息
                if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
                    errorMessage = '权限不足，请重新加载扩展或手动授予权限';
                } else if (errorMessage.includes('not allowed')) {
                    errorMessage = '当前页面不允许截图，请在其他网页中尝试';
                } else if (errorMessage.includes('timeout')) {
                    errorMessage = '截图超时，请重试';
                }
                
                sendResponse({ success: false, error: errorMessage });
            } else if (dataUrl) {
                console.log('截图成功，数据长度:', dataUrl.length);
                sendResponse({ success: true, dataUrl: dataUrl });
            } else {
                console.error('截图返回空数据');
                sendResponse({ success: false, error: '截图返回空数据' });
            }
        });
    });
}

/**
 * 处理检查权限请求
 */
function handleCheckPermissions(sendResponse) {
    chrome.permissions.getAll((permissions) => {
        console.log('所有权限:', permissions);
        sendResponse({ 
            success: true, 
            permissions: permissions 
        });
    });
}

// 导出处理器
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        handleCaptureVisibleTab,
        handleCheckPermissions
    };
} else {
    if (typeof self !== "undefined") {
        self.ScreenshotHandler = {
            handleCaptureVisibleTab,
            handleCheckPermissions
        };
    }
}

