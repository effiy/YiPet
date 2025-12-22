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
    importScripts('background/services/requestMonitorService.js');
    
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

// ==================== 初始化服务 ====================

/**
 * 初始化请求监控服务
 */
function initializeRequestMonitor() {
    if (typeof self !== 'undefined' && self.RequestMonitorService) {
        const monitor = new self.RequestMonitorService();
        monitor.initialize();
        self.requestMonitor = monitor;
        console.log('请求监控服务已初始化');
    }
}

// 初始化请求监控
initializeRequestMonitor();

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
 * 获取注入服务实例（统一获取逻辑，避免重复代码）
 * @returns {InjectionService|null} 注入服务实例，如果不可用则返回null
 */
function getInjectionService() {
    if (typeof self !== 'undefined' && self.InjectionService) {
        return self.InjectionService;
    }
    return null;
}

/**
 * 通知所有标签页执行操作
 * @param {string} action - 操作名称
 * @param {*} data - 操作数据
 */
function notifyAllTabs(action, data) {
    const injectionService = getInjectionService();
    if (injectionService) {
        injectionService.executeActionInAllTabs(action, data);
    }
}

/**
 * 监听存储变化
 * 当设置或全局状态变化时，同步到所有标签页
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
    // 监听 local 存储的变化（新版本使用 local 避免写入配额限制）
    if (namespace === 'local') {
        if (changes.petSettings) {
            console.log('宠物设置已更新');
            notifyAllTabs('settingsUpdated', changes.petSettings.newValue);
        }
        
        if (changes.petGlobalState) {
            console.log('宠物全局状态已更新');
            notifyAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
            
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
        if (changes.petSettings) {
            console.log('宠物设置已更新（sync）');
            notifyAllTabs('settingsUpdated', changes.petSettings.newValue);
        }
        
        if (changes.petGlobalState) {
            console.log('宠物全局状态已更新（sync，兼容旧版本）');
            notifyAllTabs('globalStateUpdated', changes.petGlobalState.newValue);
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










