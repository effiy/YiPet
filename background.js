/**
 * Chrome扩展后台脚本
 * 处理扩展的安装、更新和消息传递
 */

// 扩展安装时的处理
chrome.runtime.onInstalled.addListener((details) => {
    console.log('可拖拽小宠物扩展已安装');
    
    // 设置默认配置
    chrome.storage.sync.set({
        petSettings: {
            size: 60,
            color: 0,
            visible: false,
            autoStart: true
        },
        petGlobalState: {
            visible: false,
            color: 0,
            size: 60,
            timestamp: Date.now()
        }
    });
    
    // 如果是更新，显示更新通知
    if (details.reason === 'update') {
        console.log('扩展已更新到版本:', chrome.runtime.getManifest().version);
    }
});

// 处理来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background收到消息:', request);
    
    switch (request.action) {
        case 'getExtensionInfo':
            sendResponse({
                version: chrome.runtime.getManifest().version,
                name: chrome.runtime.getManifest().name
            });
            break;
            
        case 'openOptionsPage':
            chrome.runtime.openOptionsPage();
            sendResponse({ success: true });
            break;
            
        case 'getActiveTab':
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                sendResponse({ tab: tabs[0] });
            });
            return true; // 保持消息通道开放
            
        case 'injectPet':
            const tabId = request.tabId || sender.tab.id;
            console.log('注入宠物到标签页:', tabId);
            injectPetToTab(tabId);
            sendResponse({ success: true });
            break;
            
        case 'removePet':
            removePetFromTab(sender.tab.id);
            sendResponse({ success: true });
            break;
            
        case 'captureVisibleTab':
            // 处理截图请求
            console.log('处理截图请求');
            
            // 首先检查权限
            chrome.permissions.contains({
                permissions: ['activeTab']
            }, (hasPermission) => {
                console.log('Background权限检查结果:', hasPermission);
                
                if (!hasPermission) {
                    console.error('缺少activeTab权限，尝试请求权限...');
                    
                    // 尝试请求权限
                    chrome.permissions.request({
                        permissions: ['activeTab']
                    }, (granted) => {
                        console.log('Background权限请求结果:', granted);
                        
                        if (granted) {
                            // 权限请求成功，继续截图流程
                            performScreenshot(sendResponse);
                        } else {
                            console.error('权限请求被拒绝');
                            sendResponse({ 
                                success: false, 
                                error: '权限请求被拒绝，请手动在扩展管理页面中启用权限' 
                            });
                        }
                    });
                } else {
                    // 权限已存在，直接截图
                    performScreenshot(sendResponse);
                }
            });
            return true; // 保持消息通道开放
            
        case 'checkPermissions':
            // 检查权限状态
            chrome.permissions.getAll((permissions) => {
                console.log('所有权限:', permissions);
                sendResponse({ 
                    success: true, 
                    permissions: permissions 
                });
            });
            return true;
            
        case 'forwardToContentScript':
            // 转发消息到content script
            console.log('转发消息到content script:', request.tabId, request.message);
            chrome.tabs.sendMessage(request.tabId, request.message, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('转发消息失败:', chrome.runtime.lastError.message);
                    // 如果content script未加载，尝试直接注入
                    if (chrome.runtime.lastError.message.includes('Could not establish connection')) {
                        console.log('尝试直接注入content script...');
                        injectContentScript(request.tabId).then(() => {
                            // 重新尝试发送消息
                            setTimeout(() => {
                                chrome.tabs.sendMessage(request.tabId, request.message, (retryResponse) => {
                                    if (chrome.runtime.lastError) {
                                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                                    } else {
                                        sendResponse(retryResponse);
                                    }
                                });
                            }, 1000);
                        });
                        return;
                    }
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('转发消息成功:', response);
                    sendResponse(response);
                }
            });
            return true; // 保持消息通道开放
            
        case 'sendToWeWorkRobot':
            // 通过 background script 发送消息到企微机器人（避免 CORS 问题）
            console.log('发送消息到企微机器人:', request.webhookUrl);
            sendToWeWorkRobot(request.webhookUrl, request.content)
                .then((result) => {
                    sendResponse({ success: true, result: result });
                })
                .catch((error) => {
                    console.error('发送到企微机器人失败:', error);
                    sendResponse({ success: false, error: error.message || '发送失败' });
                });
            return true; // 保持消息通道开放
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// 标签页更新时的处理
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('标签页更新:', tabId, changeInfo.status, tab.url);
    
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        console.log('页面加载完成，检查是否需要注入宠物');
        
        // 检查是否需要自动注入宠物
        chrome.storage.sync.get(['petSettings'], (result) => {
            const settings = result.petSettings || { autoStart: true, visible: false };
            console.log('宠物设置:', settings);
            
            if (settings.autoStart && settings.visible !== false) {
                // 延迟注入，确保页面完全加载
                setTimeout(() => {
                    console.log('自动注入宠物到标签页:', tabId);
                    injectPetToTab(tabId);
                }, 1000); // 减少延迟时间
            } else {
                console.log('自动注入已禁用或宠物不可见');
            }
        });
    } else {
        console.log('跳过注入:', {
            status: changeInfo.status,
            url: tab.url,
            isChromePage: tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))
        });
    }
});

// 直接注入content script
async function injectContentScript(tabId) {
    try {
        console.log('直接注入content script到标签页:', tabId);
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
        console.log('Content script 注入成功');
        return true;
    } catch (error) {
        console.log('Content script 注入失败:', error);
        return false;
    }
}

// 向指定标签页注入宠物
function injectPetToTab(tabId) {
    console.log('尝试注入宠物到标签页:', tabId);
    chrome.tabs.sendMessage(tabId, { action: 'initPet' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('无法注入宠物到标签页:', chrome.runtime.lastError.message);
            // 如果content script还没有加载，尝试重新注入
            if (chrome.runtime.lastError.message.includes('Could not establish connection')) {
                console.log('Content script 可能未加载，尝试重新注入...');
                injectContentScript(tabId).then(() => {
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, { action: 'initPet' }, (retryResponse) => {
                            if (chrome.runtime.lastError) {
                                console.log('重试注入失败:', chrome.runtime.lastError.message);
                            } else {
                                console.log('重试注入成功');
                            }
                        });
                    }, 1000);
                });
            }
        } else {
            console.log('宠物注入成功:', response);
        }
    });
}

// 从指定标签页移除宠物
function removePetFromTab(tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'removePet' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('无法从标签页移除宠物:', chrome.runtime.lastError.message);
        }
    });
}

// 获取所有活动标签页
function getAllTabs() {
    return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
            resolve(tabs);
        });
    });
}

// 在所有标签页中执行操作
async function executeInAllTabs(action, data = {}) {
    const tabs = await getAllTabs();
    const promises = tabs.map(tab => {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action, ...data }, (response) => {
                resolve({ tabId: tab.id, success: !chrome.runtime.lastError });
            });
        });
    });
    
    return Promise.all(promises);
}

// 执行截图的方法
function performScreenshot(sendResponse) {
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
        if (activeTab.url.startsWith('chrome://') || 
            activeTab.url.startsWith('chrome-extension://') ||
            activeTab.url.startsWith('moz-extension://') ||
            activeTab.url.startsWith('about:')) {
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
                console.error('错误详情:', chrome.runtime.lastError);
                
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

// 扩展图标点击时的处理
chrome.action.onClicked.addListener((tab) => {
    // 切换宠物的显示/隐藏状态
    chrome.tabs.sendMessage(tab.id, { action: 'toggleVisibility' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('无法切换宠物状态:', chrome.runtime.lastError.message);
        }
    });
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.petSettings) {
            console.log('宠物设置已更新');
            
            // 通知所有标签页设置已更新
            executeInAllTabs('settingsUpdated', changes.petSettings.newValue);
        }
        
        if (changes.petGlobalState) {
            console.log('宠物全局状态已更新');
            
            // 通知所有标签页全局状态已更新
            executeInAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
            
            // 立即同步到所有活动标签页
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'globalStateUpdated',
                            data: changes.petGlobalState.newValue
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.log('同步状态到标签页失败:', tab.id, chrome.runtime.lastError.message);
                            }
                        });
                    }
                });
            });
        }
    }
});

// 处理键盘快捷键
try {
    if (chrome && chrome.commands && typeof chrome.commands.onCommand === 'object' && chrome.commands.onCommand.addListener) {
        chrome.commands.onCommand.addListener((command) => {
            try {
                switch (command) {
                    case 'toggle-pet':
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs && tabs[0]) {
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleVisibility' });
                            }
                        });
                        break;
                        
                    case 'change-color':
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs && tabs[0]) {
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'changeColor' });
                            }
                        });
                        break;
                        
                    case 'reset-position':
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs && tabs[0]) {
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'resetPosition' });
                            }
                        });
                        break;
                }
            } catch (error) {
                console.error('处理键盘命令时出错:', error);
            }
        });
        console.log('键盘快捷键已注册');
    } else {
        console.warn('chrome.commands API 不可用，键盘快捷键功能将被禁用');
    }
} catch (error) {
    console.error('注册键盘快捷键时出错:', error);
}

// 定期清理无效的存储数据
setInterval(() => {
    chrome.storage.local.get(null, (items) => {
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        Object.keys(items).forEach(key => {
            if (key.startsWith('petPosition_') && items[key].timestamp < oneWeekAgo) {
                chrome.storage.local.remove(key);
            }
        });
    });
}, 24 * 60 * 60 * 1000); // 每天执行一次

// 错误处理
chrome.runtime.onSuspend.addListener(() => {
    console.log('扩展即将被挂起');
});

// 发送消息到企微机器人
async function sendToWeWorkRobot(webhookUrl, content) {
    try {
        // 企微机器人 markdown.content 的最大长度限制为 4096
        const MAX_LENGTH = 4096;
        
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
            if (lastNewline > MAX_LENGTH - 100) {
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

// 导出函数供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        injectPetToTab,
        removePetFromTab,
        executeInAllTabs,
        sendToWeWorkRobot
    };
}




