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
    importScripts('../config.js');
} catch (e) {
    console.error('无法加载 config.js:', e);
}

/**
 * 加载模块化组件
 * Service Worker 需要使用 importScripts 来加载其他文件
 */
try {
    // 加载通用工具（供 service/handler 复用）
    importScripts('../api/requestUtils.js');
    importScripts('../utils/helpers/loggerUtils.js');
    importScripts('../utils/helpers/errorHandler.js');
    importScripts('../utils/helpers/moduleUtils.js');
    importScripts('../utils/helpers/globalAccessor.js');

    // 加载服务
    importScripts('services/tabMessaging.js');
    importScripts('services/injectionService.js');
    importScripts('services/weworkService.js');

    // 加载处理器
    importScripts('handlers/extensionHandler.js');
    importScripts('handlers/petHandler.js');
    importScripts('handlers/screenshotHandler.js');
    importScripts('handlers/messageForwardHandler.js');
    importScripts('handlers/weworkHandler.js');
    importScripts('handlers/tabHandler.js');

    // 加载路由
    importScripts('routers/messageRouter.js');
} catch (e) {
    console.error('无法加载模块化组件:', e);
}

// ==================== 日志控制（可选） ====================
// 通过 storage 的 petDevMode 开关控制 console.log/info/debug/warn
try {
    if (typeof self !== 'undefined' && self.LoggerUtils && typeof self.LoggerUtils.initMuteLogger === 'function') {
        const keyName = (typeof self !== 'undefined' && self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.storageKeys) ? self.PET_CONFIG.constants.storageKeys.devMode : 'petDevMode';
        self.LoggerUtils.initMuteLogger(keyName, false);
    } else if (typeof LoggerUtils !== 'undefined' && LoggerUtils.initMuteLogger) {
        const keyName = (typeof self !== 'undefined' && self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.storageKeys) ? self.PET_CONFIG.constants.storageKeys.devMode : 'petDevMode';
        LoggerUtils.initMuteLogger(keyName, false);
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
    chrome.storage.local.set({
        petSettings: {
            size: 60,
            color: 0,
            visible: false,
            autoStart: true
        }
    });

    chrome.storage.local.set({
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
    if (changeInfo.status === 'complete' && tab.url && !(self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.URLS && self.PET_CONFIG.constants.URLS.isSystemPage(tab.url))) {
        console.log('页面加载完成，检查是否需要注入宠物');

        // 检查是否需要自动注入宠物
        chrome.storage.local.get(['petSettings'], (result) => {
            const settings = result.petSettings || { autoStart: true, visible: false };
            console.log('宠物设置:', settings);

            if (settings.autoStart && settings.visible !== false) {
                // 延迟注入，确保页面完全加载
                setTimeout(() => {
                    console.log('自动注入宠物到标签页:', tabId);
                    const injectionService = getInjectionService();
                    if (!injectionService) {
                        console.error('自动注入失败：InjectionService 不可用');
                        return;
                    }
                    injectionService.injectPetToTab(tabId);
                }, (self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.TIMING) ? self.PET_CONFIG.constants.TIMING.INJECT_PET_DELAY : 1000);
            } else {
                console.log('自动注入已禁用或宠物不可见');
            }
        });
    } else {
        // 跳过系统页面（chrome://、chrome-extension://等）
        console.log('跳过注入:', {
            status: changeInfo.status,
            url: tab.url,
            isSystemPage: tab.url && (self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.URLS && self.PET_CONFIG.constants.URLS.isSystemPage(tab.url))
        });
    }
});

// ==================== 初始化服务 ====================

/**
 * 初始化请求监控服务
 */

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
 * 处理存储变化（统一处理逻辑，避免重复代码）
 * @param {Object} changes - 存储变化对象
 * @param {string} namespace - 存储命名空间
 */
function handleStorageChange(changes, namespace) {
    if (namespace !== 'local') return;

    // 处理宠物设置变化
    if (changes.petSettings) {
        console.log('宠物设置已更新');
        notifyAllTabs('settingsUpdated', changes.petSettings.newValue);
    }

    // 处理宠物全局状态变化
    if (changes.petGlobalState) {
        console.log('宠物全局状态已更新');
        notifyAllTabs('globalStateUpdated', changes.petGlobalState.newValue);

        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && !(self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.URLS && self.PET_CONFIG.constants.URLS.isSystemPage(tab.url))) {
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

/**
 * 监听存储变化
 * 当设置或全局状态变化时，同步到所有标签页
 */
chrome.storage.onChanged.addListener(handleStorageChange);

// ==================== 键盘快捷键处理 ====================

/**
 * 向当前活动标签页发送消息（统一处理逻辑）
 * @param {Object} message - 要发送的消息
 */
function sendMessageToActiveTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('发送消息到活动标签页失败:', chrome.runtime.lastError.message);
                }
            });
        }
    });
}

/**
 * 键盘快捷键命令映射
 */
const KEYBOARD_COMMANDS = {
    'toggle-pet': { action: 'toggleVisibility' },
    'change-color': { action: 'changeColor' },
    'reset-position': { action: 'resetPosition' },
    'open-quick-comment': { action: 'openQuickCommentFromShortcut' }
};

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
                const commandConfig = KEYBOARD_COMMANDS[command];
                if (commandConfig) {
                    if (command === 'open-quick-comment') {
                        try {
                            chrome.storage.local.get(['petSettings'], (result) => {
                                const settings = result && result.petSettings ? result.petSettings : null;
                                const enabled = settings ? settings.quickCommentShortcutEnabled : undefined;
                                if (enabled === false || enabled === 'false') {
                                    return;
                                }
                                sendMessageToActiveTab(commandConfig);
                            });
                        } catch (e) {
                            sendMessageToActiveTab(commandConfig);
                        }
                        return;
                    }
                    sendMessageToActiveTab(commandConfig);
                } else {
                    console.warn(`未知的键盘命令: ${command}`);
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
        const cleanupAge = (self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.TIMING) ? self.PET_CONFIG.constants.TIMING.STORAGE_CLEANUP_AGE : 604800000;
        const oneWeekAgo = now - cleanupAge;

        Object.keys(items).forEach(key => {
            // 清理过期的位置数据
            if (key.startsWith('petPosition_') && items[key].timestamp < oneWeekAgo) {
                chrome.storage.local.remove(key);
            }
        });
    });
}, (self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.TIMING) ? self.PET_CONFIG.constants.TIMING.STORAGE_CLEANUP_INTERVAL : 86400000);

// ==================== 错误处理 ====================

/**
 * 扩展挂起时的处理
 * 在扩展被系统挂起前执行清理操作
 */
chrome.runtime.onSuspend.addListener(() => {
    console.log('扩展即将被挂起');
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'greeting') {
    console.log('Message received:', request.message);
    sendResponse({ reply: 'Hello, content script!' });
  }
});
