/**
 * Chrome扩展后台脚本
 * 
 * 功能说明：
 * - 处理扩展的安装、更新和生命周期管理
 * - 管理消息传递（popup <-> background <-> content script）
 * - 监控网络请求（API请求记录）
 * - 处理标签页注入和宠物初始化
 * - 提供截图、权限检查等系统级功能
 */

// ==================== 工具类引入 ====================

/**
 * 加载常量定义文件
 * Service Worker 需要使用 importScripts 来加载其他文件
 */
try {
    importScripts('constants.js');
} catch (e) {
    console.error('无法加载 constants.js:', e);
    // 如果加载失败，定义最小化的 CONSTANTS 对象以避免错误
    if (typeof CONSTANTS === 'undefined') {
        // 在 service worker 中，直接赋值给全局作用域
        self.CONSTANTS = {
            TIMING: {
                INJECT_PET_DELAY: 1000,
                REQUEST_DEDUP_WINDOW: 5000,
                REQUEST_CLEANUP_INTERVAL: 30000,
                REQUEST_CLEANUP_TIMEOUT: 60000,
                STORAGE_CLEANUP_INTERVAL: 86400000,
                STORAGE_CLEANUP_AGE: 604800000
            },
            STORAGE: {
                MAX_REQUESTS: 1000
            },
            URLS: {
                CHROME_PROTOCOL: 'chrome://',
                CHROME_EXTENSION_PROTOCOL: 'chrome-extension://',
                MOZ_EXTENSION_PROTOCOL: 'moz-extension://',
                ABOUT_PROTOCOL: 'about:',
                isSystemPage: function(url) {
                    if (!url || typeof url !== 'string') return false;
                    return url.startsWith(this.CHROME_PROTOCOL) ||
                           url.startsWith(this.CHROME_EXTENSION_PROTOCOL) ||
                           url.startsWith(this.MOZ_EXTENSION_PROTOCOL) ||
                           url.startsWith(this.ABOUT_PROTOCOL);
                }
            },
            API: {
                MAX_WEWORK_CONTENT_LENGTH: 4096,
                MAX_WEWORK_CONTENT_TRUNCATE_MARGIN: 100
            }
        };
        // 同时设置 globalThis 以确保兼容性
        if (typeof globalThis !== 'undefined') {
            globalThis.CONSTANTS = self.CONSTANTS;
        }
    }
}

/**
 * 加载模块化组件
 * Service Worker 需要使用 importScripts 来加载其他文件
 */
try {
    // 加载通用工具（供 service/handler 复用）
    importScripts('utils/requestUtils.js');
    importScripts('utils/loggerUtils.js');
    importScripts('utils/errorHandler.js');

    // 加载服务
    importScripts('background/services/tabMessaging.js');
    importScripts('background/services/injectionService.js');
    importScripts('background/services/weworkService.js');
    
    // 加载处理器
    importScripts('background/handlers/extensionHandler.js');
    importScripts('background/handlers/petHandler.js');
    importScripts('background/handlers/screenshotHandler.js');
    importScripts('background/handlers/messageForwardHandler.js');
    importScripts('background/handlers/weworkHandler.js');
    importScripts('background/handlers/tabHandler.js');
    
    // 加载路由
    importScripts('background/routers/messageRouter.js');
} catch (e) {
    console.error('无法加载模块化组件:', e);
}

// ==================== 日志控制（可选） ====================
// 通过 sync storage 的 petDevMode 开关控制 console.log/info/debug/warn
try {
    if (typeof self !== 'undefined' && self.LoggerUtils && typeof self.LoggerUtils.initMuteLogger === 'function') {
        self.LoggerUtils.initMuteLogger('petDevMode', false);
    } else if (typeof LoggerUtils !== 'undefined' && LoggerUtils.initMuteLogger) {
        LoggerUtils.initMuteLogger('petDevMode', false);
    }
} catch (e) {
    // 静默处理
}

// ==================== 扩展生命周期管理 ====================

/**
 * 扩展安装/更新时的处理
 * 设置默认配置，确保首次安装时有一致的初始状态
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('可拖拽小宠物扩展已安装');
    
    // 设置默认配置
    chrome.storage.sync.set({
        petSettings: {
            size: 60,           // 默认大小（像素）
            color: 0,           // 默认颜色索引
            visible: false,      // 默认不可见
            autoStart: true     // 默认自动启动
        },
        petGlobalState: {
            visible: false,
            color: 0,
            size: 60,
            timestamp: Date.now()
        }
    });
    
    // 如果是更新，记录更新信息
    if (details.reason === 'update') {
        console.log('扩展已更新到版本:', chrome.runtime.getManifest().version);
    }
});

// ==================== 消息路由初始化 ====================

/**
 * 初始化消息路由
 * 将所有消息处理器注册到路由系统中
 */
function initializeMessageRouter() {
    const router = new MessageRouter();
    
    // 注册扩展相关处理器
    router.register('getExtensionInfo', (request, sender, sendResponse) => {
        ExtensionHandler.handleGetExtensionInfo(sendResponse);
    });
    
    router.register('openOptionsPage', (request, sender, sendResponse) => {
        ExtensionHandler.handleOpenOptionsPage(sendResponse);
    });
    
    router.register('getActiveTab', (request, sender, sendResponse) => {
        ExtensionHandler.handleGetActiveTab(sendResponse);
    }, true); // 异步操作
    
    // 注册宠物相关处理器
    router.register('injectPet', (request, sender, sendResponse) => {
        PetHandler.handleInjectPet(request, sender, sendResponse);
    });
    
    router.register('removePet', (request, sender, sendResponse) => {
        PetHandler.handleRemovePet(sender, sendResponse);
    });
    
    // 注册截图相关处理器
    router.register('captureVisibleTab', (request, sender, sendResponse) => {
        ScreenshotHandler.handleCaptureVisibleTab(sendResponse);
    }, true); // 异步操作
    
    router.register('checkPermissions', (request, sender, sendResponse) => {
        ScreenshotHandler.handleCheckPermissions(sendResponse);
    }, true); // 异步操作
    
    // 注册消息转发处理器
    router.register('forwardToContentScript', (request, sender, sendResponse) => {
        MessageForwardHandler.handleForwardToContentScript(request, sendResponse);
    }, true); // 异步操作
    
    // 注册企微机器人处理器
    router.register('sendToWeWorkRobot', (request, sender, sendResponse) => {
        WeWorkHandler.handleSendToWeWorkRobot(request, sendResponse);
    }, true); // 异步操作
    
    // 注册标签页处理器
    router.register('openLinkInNewTab', (request, sender, sendResponse) => {
        TabHandler.handleOpenLinkInNewTab(request, sendResponse);
    }, true); // 异步操作
    
    return router;
}

// ==================== 消息路由 ====================

/**
 * 初始化消息路由器
 */
const messageRouter = initializeMessageRouter();

/**
 * 处理来自popup和content script的消息
 * 使用统一的消息路由系统
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background收到消息:', request);
    return messageRouter.handle(request, sender, sendResponse);
});

// ==================== 标签页管理 ====================

/**
 * 标签页更新时的处理
 * 当页面加载完成时，根据设置决定是否自动注入宠物
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('标签页更新:', tabId, changeInfo.status, tab.url);
    
    // 只在页面完全加载完成且不是系统页面时处理
    if (changeInfo.status === 'complete' && tab.url && !CONSTANTS.URLS.isSystemPage(tab.url)) {
        console.log('页面加载完成，检查是否需要注入宠物');
        
        // 检查是否需要自动注入宠物
        chrome.storage.sync.get(['petSettings'], (result) => {
            const settings = result.petSettings || { autoStart: true, visible: false };
            console.log('宠物设置:', settings);
            
            if (settings.autoStart && settings.visible !== false) {
                // 延迟注入，确保页面完全加载
                setTimeout(() => {
                    console.log('自动注入宠物到标签页:', tabId);
                    // 使用注入服务
                    if (typeof self !== 'undefined' && self.InjectionService) {
                        self.InjectionService.injectPetToTab(tabId);
                    } else {
                        injectPetToTab(tabId); // 降级方案
                    }
                }, CONSTANTS.TIMING.INJECT_PET_DELAY);
            } else {
                console.log('自动注入已禁用或宠物不可见');
            }
        });
    } else {
        // 跳过系统页面（chrome://、chrome-extension://等）
        console.log('跳过注入:', {
            status: changeInfo.status,
            url: tab.url,
            isSystemPage: tab.url && CONSTANTS.URLS.isSystemPage(tab.url)
        });
    }
});

// ==================== 注入功能（已迁移到 InjectionService） ====================
// 保留向后兼容的函数，实际调用服务

/**
 * 向后兼容的注入函数
 * @deprecated 使用 InjectionService.injectContentScript 代替
 */
async function injectContentScript(tabId) {
    if (typeof self !== 'undefined' && self.InjectionService) {
        return await self.InjectionService.injectContentScript(tabId);
    }
    console.warn('InjectionService 未加载，使用降级方案');
    return false;
}

/**
 * 向后兼容的注入宠物函数
 * @deprecated 使用 InjectionService.injectPetToTab 代替
 */
function injectPetToTab(tabId) {
    if (typeof self !== 'undefined' && self.InjectionService) {
        self.InjectionService.injectPetToTab(tabId);
    } else {
        console.warn('InjectionService 未加载');
    }
}

/**
 * 向后兼容的移除宠物函数
 * @deprecated 使用 InjectionService.removePetFromTab 代替
 */
function removePetFromTab(tabId) {
    if (typeof self !== 'undefined' && self.InjectionService) {
        self.InjectionService.removePetFromTab(tabId);
    } else {
        console.warn('InjectionService 未加载');
    }
}

/**
 * 向后兼容的执行所有标签页操作函数
 * @deprecated 使用 InjectionService.executeActionInAllTabs 代替
 */
async function executeActionInAllTabs(action, data = {}) {
    if (typeof self !== 'undefined' && self.InjectionService) {
        return await self.InjectionService.executeActionInAllTabs(action, data);
    }
    console.warn('InjectionService 未加载');
    return [];
}

// ==================== 截图功能（已迁移到 ScreenshotHandler） ====================
// 保留向后兼容的函数，实际调用处理器

/**
 * 向后兼容的截图函数
 * @deprecated 使用 ScreenshotHandler.captureTabScreenshot 代替
 */
function captureTabScreenshot(sendResponse) {
    if (typeof self !== 'undefined' && self.ScreenshotHandler) {
        // 注意：这里需要直接调用内部函数，因为 sendResponse 需要传递
        // 实际实现已在 ScreenshotHandler 中
        ScreenshotHandler.handleCaptureVisibleTab(sendResponse);
    } else {
        console.warn('ScreenshotHandler 未加载');
        sendResponse({ success: false, error: '截图功能未加载' });
    }
}

// ==================== 扩展图标点击处理 ====================

/**
 * 扩展图标点击时的处理
 * 快速切换宠物的显示/隐藏状态
 */
chrome.action.onClicked.addListener((tab) => {
    // 切换宠物的显示/隐藏状态
    chrome.tabs.sendMessage(tab.id, { action: 'toggleVisibility' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('无法切换宠物状态:', chrome.runtime.lastError.message);
        }
    });
});

// ==================== 存储变化监听 ====================

/**
 * 监听存储变化
 * 当设置或全局状态变化时，同步到所有标签页
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    // 监听 local 存储的变化（新版本使用 local 避免写入配额限制）
    if (namespace === 'local') {
        if (changes.petSettings) {
            console.log('宠物设置已更新');
            // 通知所有标签页设置已更新
            const injectionService = typeof self !== 'undefined' && self.InjectionService 
                ? self.InjectionService 
                : null;
            if (injectionService) {
                injectionService.executeActionInAllTabs('settingsUpdated', changes.petSettings.newValue);
            } else {
                executeActionInAllTabs('settingsUpdated', changes.petSettings.newValue);
            }
        }
        
        if (changes.petGlobalState) {
            console.log('宠物全局状态已更新');
            // 通知所有标签页全局状态已更新
            const injectionService = typeof self !== 'undefined' && self.InjectionService 
                ? self.InjectionService 
                : null;
            if (injectionService) {
                injectionService.executeActionInAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
            } else {
                executeActionInAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
            }
            
            // 立即同步到所有活动标签页（确保实时性）
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    // 跳过系统页面
                    if (tab.url && !CONSTANTS.URLS.isSystemPage(tab.url)) {
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
        const injectionService = typeof self !== 'undefined' && self.InjectionService 
            ? self.InjectionService 
            : null;
            
        if (changes.petSettings) {
            console.log('宠物设置已更新（sync）');
            if (injectionService) {
                injectionService.executeActionInAllTabs('settingsUpdated', changes.petSettings.newValue);
            } else {
                executeActionInAllTabs('settingsUpdated', changes.petSettings.newValue);
            }
        }
        
        if (changes.petGlobalState) {
            console.log('宠物全局状态已更新（sync，兼容旧版本）');
            if (injectionService) {
                injectionService.executeActionInAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
            } else {
                executeActionInAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
            }
        }
    }
});

// ==================== 键盘快捷键处理 ====================

/**
 * 处理键盘快捷键
 * 支持以下快捷键：
 * - toggle-pet: 切换宠物显示/隐藏
 * - change-color: 切换宠物颜色
 * - reset-position: 重置宠物位置
 */
try {
    if (chrome && chrome.commands && typeof chrome.commands.onCommand === 'object' && chrome.commands.onCommand.addListener) {
        chrome.commands.onCommand.addListener((command) => {
            try {
                switch (command) {
                    case 'toggle-pet':
                        // 切换宠物显示/隐藏
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs && tabs[0]) {
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleVisibility' });
                            }
                        });
                        break;
                        
                    case 'change-color':
                        // 切换宠物颜色
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs && tabs[0]) {
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'changeColor' });
                            }
                        });
                        break;
                        
                    case 'reset-position':
                        // 重置宠物位置
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

// ==================== 定期清理任务 ====================

/**
 * 定期清理无效的存储数据
 * 清理一周前的宠物位置数据，防止存储空间浪费
 */
setInterval(() => {
    chrome.storage.local.get(null, (items) => {
        const now = Date.now();
        const cleanupAge = CONSTANTS.TIMING.STORAGE_CLEANUP_AGE;
        const oneWeekAgo = now - cleanupAge;
        
        Object.keys(items).forEach(key => {
            // 清理过期的位置数据
            if (key.startsWith('petPosition_') && items[key].timestamp < oneWeekAgo) {
                chrome.storage.local.remove(key);
            }
        });
    });
}, CONSTANTS.TIMING.STORAGE_CLEANUP_INTERVAL);

// ==================== 错误处理 ====================

/**
 * 扩展挂起时的处理
 * 在扩展被系统挂起前执行清理操作
 */
chrome.runtime.onSuspend.addListener(() => {
    console.log('扩展即将被挂起');
});

// ==================== 企微机器人集成（已迁移到 WeWorkService） ====================
// 保留向后兼容的函数，实际调用服务

/**
 * 向后兼容的企微机器人发送函数
 * @deprecated 使用 WeWorkService.sendMessage 代替
 */
async function sendMessageToWeWorkRobot(webhookUrl, content) {
    if (typeof self !== 'undefined' && self.WeWorkService) {
        return await self.WeWorkService.sendMessage(webhookUrl, content);
    } else {
        console.warn('WeWorkService 未加载');
        throw new Error('企微机器人服务未加载');
    }
}

// ==================== 网络请求监控 ====================

/**
 * 接口请求监控管理器（Background）
 * 使用 webRequest API 监控所有标签页的网络请求
 * 
 * 功能：
 * - 记录所有 XHR/Fetch 请求
 * - 自动去重（相同请求在5秒内只记录一次）
 * - 限制最大记录数，防止存储溢出
 */

// 存储所有标签页的请求数据
let globalApiRequests = [];
const MAX_REQUESTS = CONSTANTS.STORAGE.MAX_REQUESTS;

// 去重索引：使用 Map 存储请求的唯一标识，提高查找效率
// key格式: `${method}:${normalizedUrl}:${timestampRange}`
// value: 请求在数组中的索引
const requestIndexMap = new Map();

// ==================== 请求工具函数（已迁移到 RequestUtils） ====================
// 这些函数现在应该从 RequestUtils 工具类中获取
// 保留向后兼容的引用，但优先使用 RequestUtils

/**
 * 获取请求工具函数（向后兼容）
 * 优先使用全局 RequestUtils，否则使用降级实现
 */
function getRequestUtils() {
    // 尝试从全局获取
    if (typeof self !== 'undefined' && self.RequestUtils) {
        return self.RequestUtils;
    }
    // 尝试从 window 获取（如果可用）
    if (typeof window !== 'undefined' && window.RequestUtils) {
        return window.RequestUtils;
    }
    // 降级：返回空对象，调用者需要处理
    return null;
}

// 向后兼容的函数（使用 RequestUtils）
const isExtensionRequest = function(url) {
    const utils = getRequestUtils();
    if (utils && utils.isExtensionRequest) {
        return utils.isExtensionRequest(url);
    }
    // 降级实现（尽量保守：无法判断时不当作扩展请求）
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('chrome-extension://') || url.startsWith('moz-extension://') || url.startsWith('chrome://');
};

const normalizeUrl = function(url) {
    const utils = getRequestUtils();
    if (utils && utils.normalizeUrl) {
        return utils.normalizeUrl(url);
    }
    // 降级实现：解析失败则返回原始字符串（不做去重增强）
    if (!url || typeof url !== 'string') return '';
    try {
        const urlObj = new URL(url);
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch (e) {
        return url;
    }
};

const formatHeaders = function(headers) {
    const utils = getRequestUtils();
    if (utils && utils.formatHeaders) {
        return utils.formatHeaders(headers);
    }
    // 降级实现：仅处理 object/array
    if (!headers) return {};
    if (Array.isArray(headers)) {
        const result = {};
        headers.forEach(header => {
            if (header && header.name) result[header.name] = header.value;
        });
        return result;
    }
    return typeof headers === 'object' ? { ...headers } : {};
};

const generateCurl = function(url, method, headers, body) {
    const utils = getRequestUtils();
    if (utils && utils.generateCurl) {
        return utils.generateCurl(url, method, headers, body);
    }
    // 降级实现
    let curl = `curl -X ${method}`;
    if (headers && typeof headers === 'object') {
        Object.entries(headers).forEach(([key, value]) => {
            curl += ` \\\n  -H "${key}: ${value}"`;
        });
    }
    if (body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        curl += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
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
    
    // 对于相同URL和方法的请求，如果时间戳在时间窗口内，视为重复请求
    // 将时间戳向下取整到时间窗口区间，这样窗口内的相同请求会有相同的key
    const timestamp = request.timestamp || Date.now();
    const timeWindow = CONSTANTS.TIMING.REQUEST_DEDUP_WINDOW;
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
                if (tab.url && !CONSTANTS.URLS.isSystemPage(tab.url)) {
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
    const timeout = CONSTANTS.TIMING.REQUEST_CLEANUP_TIMEOUT;
    
    for (const [requestId, info] of requestStartInfo.entries()) {
        if (now - info.startTime > timeout) {
            requestStartInfo.delete(requestId);
        }
    }
}, CONSTANTS.TIMING.REQUEST_CLEANUP_INTERVAL);

// 导出函数供其他脚本使用（向后兼容）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        injectPetToTab,
        removePetFromTab,
        executeActionInAllTabs,
        sendMessageToWeWorkRobot,
        injectContentScript,
        captureTabScreenshot,
        // 导出服务（如果可用）
        InjectionService: typeof self !== 'undefined' && self.InjectionService ? self.InjectionService : null,
        WeWorkService: typeof self !== 'undefined' && self.WeWorkService ? self.WeWorkService : null
    };
}









