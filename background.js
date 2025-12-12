/**
 * Chrome扩展后台脚本
 * 处理扩展的安装、更新和消息传递
 */

// 引入公共工具（如果可用）
let RequestUtils;
if (typeof window !== 'undefined' && window.RequestUtils) {
    RequestUtils = window.RequestUtils;
} else if (typeof require !== 'undefined') {
    try {
        RequestUtils = require('./utils/requestUtils.js');
    } catch (e) {
        // 如果无法加载，使用本地实现
        RequestUtils = null;
    }
}

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

// 消息处理函数（拆分后的各个处理函数）
function handleGetExtensionInfoRequest(sendResponse) {
    sendResponse({
        version: chrome.runtime.getManifest().version,
        name: chrome.runtime.getManifest().name
    });
}

function handleOpenOptionsPageRequest(sendResponse) {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
}

function handleGetActiveTabRequest(sendResponse) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse({ tab: tabs[0] });
    });
}

function handleInjectPetRequest(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab.id;
    console.log('注入宠物到标签页:', tabId);
    injectPetToTab(tabId);
    sendResponse({ success: true });
}

function handleRemovePetRequest(sender, sendResponse) {
    removePetFromTab(sender.tab.id);
    sendResponse({ success: true });
}

function handleCaptureVisibleTabRequest(sendResponse) {
    console.log('处理截图请求');
    
    chrome.permissions.contains({
        permissions: ['activeTab']
    }, (hasPermission) => {
        console.log('Background权限检查结果:', hasPermission);
        
        if (!hasPermission) {
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
            captureTabScreenshot(sendResponse);
        }
    });
}

function handleCheckPermissionsRequest(sendResponse) {
    chrome.permissions.getAll((permissions) => {
        console.log('所有权限:', permissions);
        sendResponse({ 
            success: true, 
            permissions: permissions 
        });
    });
}

function handleForwardToContentScriptRequest(request, sendResponse) {
    console.log('转发消息到content script:', request.tabId, request.message);
    chrome.tabs.sendMessage(request.tabId, request.message, (response) => {
        if (chrome.runtime.lastError) {
            console.log('转发消息失败:', chrome.runtime.lastError.message);
            if (chrome.runtime.lastError.message.includes('Could not establish connection')) {
                console.log('尝试直接注入content script...');
                injectContentScript(request.tabId).then(() => {
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
}

function handleSendToWeWorkRobotRequest(request, sendResponse) {
    console.log('发送消息到企微机器人:', request.webhookUrl);
    sendMessageToWeWorkRobot(request.webhookUrl, request.content)
        .then((result) => {
            sendResponse({ success: true, result: result });
        })
        .catch((error) => {
            console.error('发送到企微机器人失败:', error);
            sendResponse({ success: false, error: error.message || '发送失败' });
        });
}

function handleOpenLinkInNewTabRequest(request, sendResponse) {
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

// 处理来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background收到消息:', request);
    
    const actionHandlers = {
        'getExtensionInfo': () => handleGetExtensionInfoRequest(sendResponse),
        'openOptionsPage': () => handleOpenOptionsPageRequest(sendResponse),
        'getActiveTab': () => {
            handleGetActiveTabRequest(sendResponse);
            return true; // 保持消息通道开放
        },
        'injectPet': () => handleInjectPetRequest(request, sender, sendResponse),
        'removePet': () => handleRemovePetRequest(sender, sendResponse),
        'captureVisibleTab': () => {
            handleCaptureVisibleTabRequest(sendResponse);
            return true; // 保持消息通道开放
        },
        'checkPermissions': () => {
            handleCheckPermissionsRequest(sendResponse);
            return true; // 保持消息通道开放
        },
        'forwardToContentScript': () => {
            handleForwardToContentScriptRequest(request, sendResponse);
            return true; // 保持消息通道开放
        },
        'sendToWeWorkRobot': () => {
            handleSendToWeWorkRobotRequest(request, sendResponse);
            return true; // 保持消息通道开放
        },
        'openLinkInNewTab': () => {
            handleOpenLinkInNewTabRequest(request, sendResponse);
            return true; // 保持消息通道开放
        }
    };
    
    const handler = actionHandlers[request.action];
    if (handler) {
        return handler();
    } else {
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

// 获取所有浏览器标签页
function getAllBrowserTabs() {
    return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
            resolve(tabs);
        });
    });
}

// 在所有标签页中执行操作
async function executeActionInAllTabs(action, data = {}) {
    const tabs = await getAllBrowserTabs();
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
    // 监听 local 存储的变化（新版本使用 local 避免写入配额限制）
    if (namespace === 'local') {
        if (changes.petSettings) {
            console.log('宠物设置已更新');
            
            // 通知所有标签页设置已更新
            executeActionInAllTabs('settingsUpdated', changes.petSettings.newValue);
        }
        
        if (changes.petGlobalState) {
            console.log('宠物全局状态已更新');
            
            // 通知所有标签页全局状态已更新
            executeActionInAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
            
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
    
    // 兼容旧版本的 sync 存储
    if (namespace === 'sync') {
        if (changes.petSettings) {
            console.log('宠物设置已更新（sync）');
            executeActionInAllTabs('settingsUpdated', changes.petSettings.newValue);
        }
        
        if (changes.petGlobalState) {
            console.log('宠物全局状态已更新（sync，兼容旧版本）');
            executeActionInAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
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
async function sendMessageToWeWorkRobot(webhookUrl, content) {
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

/**
 * 接口请求监控管理器（Background）
 * 使用 webRequest API 监控所有标签页的网络请求
 */

// 存储所有标签页的请求数据
let globalApiRequests = [];
const MAX_REQUESTS = 1000; // 最大请求记录数

// 去重索引：使用 Map 存储请求的唯一标识，提高查找效率
// key: `${method}:${normalizedUrl}:${timestampRange}`，value: 请求在数组中的索引
const requestIndexMap = new Map();

// 使用公共工具函数（如果可用，否则使用本地实现）
const isExtensionRequest = RequestUtils ? RequestUtils.isExtensionRequest : function(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    const extensionUrlPatterns = [
        /^chrome-extension:\/\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
        /api\.effiy\.cn/i,
    ];
    for (const pattern of extensionUrlPatterns) {
        if (pattern.test(url)) {
            return true;
        }
    }
    return false;
};

const normalizeUrl = RequestUtils ? RequestUtils.normalizeUrl : function(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }
    try {
        const urlObj = new URL(url);
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch (e) {
        const hashIndex = url.indexOf('#');
        const queryIndex = url.indexOf('?');
        let endIndex = url.length;
        if (hashIndex !== -1) {
            endIndex = Math.min(endIndex, hashIndex);
        }
        if (queryIndex !== -1) {
            endIndex = Math.min(endIndex, queryIndex);
        }
        return url.substring(0, endIndex);
    }
};

const formatHeaders = RequestUtils ? RequestUtils.formatHeaders : function(headers) {
    if (!headers) return {};
    if (Array.isArray(headers)) {
        const result = {};
        headers.forEach(header => {
            result[header.name] = header.value;
        });
        return result;
    }
    if (typeof headers === 'object') {
        return { ...headers };
    }
    return {};
};

const generateCurl = RequestUtils ? RequestUtils.generateCurl : function(url, method, headers, body) {
    let curl = `curl -X ${method}`;
    
    if (headers && typeof headers === 'object') {
        Object.entries(headers).forEach(([key, value]) => {
            curl += ` \\\n  -H "${key}: ${value}"`;
        });
    }
    
    if (body) {
        if (typeof body === 'string') {
            curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
        } else if (typeof body === 'object') {
            curl += ` \\\n  -d '${JSON.stringify(body).replace(/'/g, "\\'")}'`;
        }
    }
    
    curl += ` \\\n  "${url}"`;
    return curl;
};

/**
 * 生成请求的唯一标识符（用于去重）
 * @param {Object} request - 请求对象
 * @returns {string} 唯一标识符
 */
function generateRequestKey(request) {
    if (!request || !request.url || !request.method) {
        return null;
    }
    
    // 规范化URL（移除query参数和hash，用于去重）
    const normalizedUrl = normalizeUrl(request.url);
    const method = (request.method || 'GET').toUpperCase();
    
    // 对于相同URL和方法的请求，如果时间戳在5秒内，视为重复请求
    // 将时间戳向下取整到5秒区间，这样5秒内的相同请求会有相同的key
    const timestamp = request.timestamp || Date.now();
    const timeWindow = 5000; // 5秒时间窗口
    const timeRange = Math.floor(timestamp / timeWindow);
    
    return `${method}:${normalizedUrl}:${timeRange}`;
}

/**
 * 重建请求索引（当数组发生变化时调用）
 */
function rebuildRequestIndex(requests) {
    requestIndexMap.clear();
    
    // 重新建立索引
    for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        if (request) {
            const key = generateRequestKey(request);
            if (key) {
                // 如果key已存在，保留索引较小的（更早的请求）
                if (!requestIndexMap.has(key)) {
                    requestIndexMap.set(key, i);
                }
            }
        }
    }
}

/**
 * 合并请求到列表（去重）
 * @param {Array} requests - 现有请求列表
 * @param {Object} newRequest - 新请求
 * @returns {Array} 去重后的请求列表
 */
function mergeRequestIntoList(requests, newRequest) {
    // 验证请求对象是否有效
    if (!newRequest || typeof newRequest !== 'object' || !newRequest.url || !newRequest.method) {
        return requests;
    }
    
    // 生成请求的唯一标识符
    const requestKey = generateRequestKey(newRequest);
    if (!requestKey) {
        return requests;
    }
    
    // 使用 Map 索引快速查找是否已存在相同请求
    const existingIndex = requestIndexMap.get(requestKey);
    
    if (existingIndex !== undefined && existingIndex < requests.length) {
        // 已存在相同请求，检查是否需要更新（保留最新的请求）
        const existingRequest = requests[existingIndex];
        if (existingRequest && existingRequest.timestamp < newRequest.timestamp) {
            // 新请求时间戳更大，更新为最新请求
            requests[existingIndex] = newRequest;
        }
        // 如果新请求时间戳更小或相等，保留原有请求，不更新
        return requests;
    }
    
    // 不存在相同请求，添加新请求
    const newIndex = requests.length;
    requests.push(newRequest);
    
    // 更新索引
    requestIndexMap.set(requestKey, newIndex);
    
    // 限制总请求数量
    if (requests.length > MAX_REQUESTS) {
        // 移除最旧的请求
        requests.shift();
        
        // 重建索引（因为数组索引发生了变化）
        rebuildRequestIndex(requests);
    }
    
    return requests;
}

/**
 * 记录请求到存储（带去重功能）
 */
async function recordRequestToStorage(request) {
    try {
        // 过滤扩展请求
        if (isExtensionRequest(request.url)) {
            return;
        }
        
        // 获取当前存储的请求列表
        const result = await chrome.storage.local.get(['apiRequests']);
        let requests = result.apiRequests || [];
        
        // 如果索引为空，先重建索引
        if (requestIndexMap.size === 0 && requests.length > 0) {
            rebuildRequestIndex(requests);
        }
        
        // 合并新请求（自动去重）
        requests = mergeRequestIntoList(requests, request);
        
        // 保存到存储
        await chrome.storage.local.set({ apiRequests: requests });
        
        // 更新全局变量
        globalApiRequests = requests;
        
        // 通知所有标签页有新请求
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'apiRequestRecorded',
                        request: request
                    }).catch(() => {
                        // 忽略错误（content script 可能未加载）
                    });
                }
            });
        });
        
        console.log('[Background] 接口请求已记录:', {
            url: request.url,
            method: request.method,
            status: request.status,
            tabId: request.tabId,
            totalRequests: requests.length,
            uniqueRequests: requestIndexMap.size
        });
    } catch (error) {
        console.error('[Background] 记录请求失败:', error);
    }
}

// 存储请求开始信息（用于关联请求和响应）
const requestStartInfo = new Map();

/**
 * 监听请求开始
 * 只监控 fetch 和 xhr 类型的网络请求
 */
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // 过滤扩展请求
        if (isExtensionRequest(details.url)) {
            return;
        }
        
        // 只监控 fetch 和 xhr 类型的请求
        if (details.type !== 'xmlhttprequest' && details.type !== 'fetch') {
            return;
        }
        
        const requestId = details.requestId;
        const startTime = Date.now();
        
        // 获取请求方法
        const method = details.method || 'GET';
        
        // 获取请求体（如果有，且是 POST/PUT/PATCH 等）
        let requestBody = null;
        if (details.requestBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            if (details.requestBody.formData) {
                requestBody = details.requestBody.formData;
            } else if (details.requestBody.raw) {
                // 对于原始数据，我们无法直接读取，只能标记
                requestBody = '[Binary Data]';
            }
        }
        
        // 存储请求开始信息
        requestStartInfo.set(requestId, {
            url: details.url,
            method: method,
            tabId: details.tabId,
            frameId: details.frameId,
            type: details.type,
            startTime: startTime,
            requestBody: requestBody,
            requestHeaders: details.requestHeaders || []
        });
    },
    { urls: ['<all_urls>'] },
    ['requestBody']
);

/**
 * 定期清理过期的请求开始信息（防止内存泄漏）
 * 已禁用：只保留从API获取的请求接口列表，不再监控本地请求
 */
setInterval(() => {
    const now = Date.now();
    const timeout = 60000; // 60秒超时
    
    for (const [requestId, info] of requestStartInfo.entries()) {
        if (now - info.startTime > timeout) {
            requestStartInfo.delete(requestId);
        }
    }
}, 30000); // 每30秒清理一次

// 导出函数供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        injectPetToTab,
        removePetFromTab,
        executeActionInAllTabs,
        sendMessageToWeWorkRobot
    };
}









