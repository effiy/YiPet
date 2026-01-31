/**
 * YiPet Application - Main Entry
 * YiPet应用主入口
 */

import { YiPetApplication } from '../core/YiPetApplication.js';
import { AppConfig } from '../core/config/app.js';
import { ProjectConfig } from './project.config.js';

/**
 * 初始化YiPet应用
 */
async function initializeYiPet() {
    try {
        console.log('🐱 正在初始化YiPet应用...');
        
        // 创建应用实例
        const app = new YiPetApplication({
            config: AppConfig,
            projectConfig: ProjectConfig
        });
        
        // 初始化应用
        await app.init();
        
        // 启动应用
        await app.start();
        
        console.log('✅ YiPet应用初始化完成');
        
        return app;
        
    } catch (error) {
        console.error('❌ YiPet应用初始化失败:', error);
        throw error;
    }
}

/**
 * 全局应用实例
 */
let yiPetApp = null;

/**
 * 获取应用实例
 */
export function getYiPetApp() {
    return yiPetApp;
}

/**
 * 启动应用
 */
export async function startYiPet() {
    if (yiPetApp) {
        console.warn('YiPet应用已经启动');
        return yiPetApp;
    }
    
    yiPetApp = await initializeYiPet();
    return yiPetApp;
}

/**
 * 停止应用
 */
export async function stopYiPet() {
    if (!yiPetApp) {
        console.warn('YiPet应用未启动');
        return;
    }
    
    try {
        await yiPetApp.stop();
        yiPetApp = null;
        console.log('YiPet应用已停止');
    } catch (error) {
        console.error('停止YiPet应用失败:', error);
        throw error;
    }
}

/**
 * 重新启动应用
 */
export async function restartYiPet() {
    await stopYiPet();
    return await startYiPet();
}

/**
 * 应用状态检查
 */
export function isYiPetRunning() {
    return yiPetApp !== null && yiPetApp.isRunning();
}

/**
 * 获取应用状态
 */
export function getYiPetStatus() {
    if (!yiPetApp) {
        return {
            running: false,
            initialized: false,
            modules: [],
            errors: []
        };
    }
    
    return yiPetApp.getStatus();
}

/**
 * 获取应用配置
 */
export function getYiPetConfig() {
    return yiPetApp ? yiPetApp.getConfig() : null;
}

/**
 * 获取应用统计信息
 */
export function getYiPetStatistics() {
    return yiPetApp ? yiPetApp.getStatistics() : null;
}

/**
 * 获取应用错误日志
 */
export function getYiPetErrors() {
    return yiPetApp ? yiPetApp.getErrors() : [];
}

/**
 * 清除应用错误
 */
export function clearYiPetErrors() {
    if (yiPetApp) {
        yiPetApp.clearErrors();
    }
}

/**
 * 获取应用版本信息
 */
export function getYiPetVersion() {
    return {
        version: '1.0.0',
        build: '2024.01.31',
        environment: process.env.NODE_ENV || 'development',
        platform: navigator.platform,
        userAgent: navigator.userAgent
    };
}

/**
 * 应用生命周期钩子
 */
export const YiPetHooks = {
    onBeforeInit: [],
    onAfterInit: [],
    onBeforeStart: [],
    onAfterStart: [],
    onBeforeStop: [],
    onAfterStop: [],
    onError: []
};

/**
 * 注册生命周期钩子
 */
export function registerHook(hookName, callback) {
    if (YiPetHooks[hookName]) {
        YiPetHooks[hookName].push(callback);
    }
}

/**
 * 触发生命周期钩子
 */
export async function triggerHook(hookName, ...args) {
    if (YiPetHooks[hookName]) {
        for (const callback of YiPetHooks[hookName]) {
            try {
                await callback(...args);
            } catch (error) {
                console.error(`钩子 ${hookName} 执行失败:`, error);
            }
        }
    }
}

/**
 * 全局错误处理
 */
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    if (yiPetApp) {
        yiPetApp.handleError(event.error);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    if (yiPetApp) {
        yiPetApp.handleError(event.reason);
    }
});

/**
 * 浏览器扩展环境检测
 */
function detectExtensionEnvironment() {
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    const isFirefox = typeof browser !== 'undefined' && browser.runtime;
    const isChrome = isExtension && !isFirefox;
    
    return {
        isExtension,
        isFirefox,
        isChrome,
        manifestVersion: chrome.runtime?.getManifest?.()?.manifest_version || 3
    };
}

/**
 * 应用初始化
 */
async function bootstrap() {
    try {
        console.log('🚀 正在启动YiPet...');
        
        // 检测环境
        const environment = detectExtensionEnvironment();
        console.log('环境检测:', environment);
        
        // 触发初始化前钩子
        await triggerHook('onBeforeInit', environment);
        
        // 启动应用
        const app = await startYiPet();
        
        // 触发初始化后钩子
        await triggerHook('onAfterInit', app);
        
        // 如果是浏览器扩展，设置扩展API
        if (environment.isExtension) {
            setupExtensionAPI(app, environment);
        }
        
        console.log('🎉 YiPet启动成功！');
        
    } catch (error) {
        console.error('💥 YiPet启动失败:', error);
        await triggerHook('onError', error);
    }
}

/**
 * 设置浏览器扩展API
 */
function setupExtensionAPI(app, environment) {
    try {
        // 设置扩展图标点击事件
        if (chrome.action || chrome.browserAction) {
            const action = chrome.action || chrome.browserAction;
            
            action.onClicked.addListener(async (tab) => {
                try {
                    // 打开弹窗
                    const { popupManagerCore } = await import('../pages/popup/index.js');
                    await popupManagerCore.open({
                        view: 'main',
                        data: { tabId: tab.id }
                    });
                } catch (error) {
                    console.error('打开弹窗失败:', error);
                }
            });
        }
        
        // 设置右键菜单
        if (chrome.contextMenus) {
            chrome.contextMenus.create({
                id: 'yipet-toggle',
                title: '切换YiPet',
                contexts: ['all']
            });
            
            chrome.contextMenus.onClicked.addListener(async (info, tab) => {
                if (info.menuItemId === 'yipet-toggle') {
                    try {
                        // 功能模块已移除 - 宠物功能暂时禁用
                        console.log('宠物功能暂时禁用，等待重构完成');
                    } catch (error) {
                        console.error('切换宠物显示失败:', error);
                    }
                }
            });
        }
        
        // 设置快捷键
        if (chrome.commands) {
            chrome.commands.onCommand.addListener(async (command) => {
                try {
                    switch (command) {
                        case 'toggle-pet':
                            // 功能模块已移除 - 宠物功能暂时禁用
                            console.log('宠物功能暂时禁用，等待重构完成');
                            break;
                            
                        case 'open-popup':
                            const { popupManagerCore } = await import('../pages/popup/index.js');
                            await popupManagerCore.open({ view: 'main' });
                            break;
                            
                        case 'take-screenshot':
                            // 功能模块已移除 - 截图功能暂时禁用
                            console.log('截图功能暂时禁用，等待重构完成');
                            break;
                            
                        case 'open-chat':
                            // 功能模块已移除 - 聊天功能暂时禁用
                            console.log('聊天功能暂时禁用，等待重构完成');
                            break;
                    }
                } catch (error) {
                    console.error(`执行快捷键命令 ${command} 失败:`, error);
                }
            });
        }
        
        // 设置存储变化监听
        if (chrome.storage) {
            chrome.storage.onChanged.addListener(async (changes, namespace) => {
                try {
                    // 通知应用配置变化
                    app.handleConfigChange(changes, namespace);
                } catch (error) {
                    console.error('处理存储变化失败:', error);
                }
            });
        }
        
        console.log('✅ 浏览器扩展API设置完成');
        
    } catch (error) {
        console.error('设置浏览器扩展API失败:', error);
    }
}

/**
 * 导出应用API
 */
export const YiPetAPI = {
    start: startYiPet,
    stop: stopYiPet,
    restart: restartYiPet,
    getApp: getYiPetApp,
    getStatus: getYiPetStatus,
    getConfig: getYiPetConfig,
    getStatistics: getYiPetStatistics,
    getErrors: getYiPetErrors,
    clearErrors: clearYiPetErrors,
    getVersion: getYiPetVersion,
    registerHook,
    triggerHook,
    isRunning: isYiPetRunning
};

/**
 * 全局YiPet对象
 */
window.YiPet = YiPetAPI;

/**
 * 自动启动应用（如果不是在测试环境中）
 */
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
}

// 默认导出
export default YiPetAPI;