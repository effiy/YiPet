/**
 * YiPet Application Core
 * YiPet应用核心类
 */

import { EventEmitter } from '../shared/utils/events/EventEmitter.js';
import { Logger } from '../shared/utils/logging/Logger.js';
import { ModuleManager } from './ModuleManager.js';
import { AppConfig, getConfig, validateConfig } from '../config/app.js';

/**
 * YiPet应用核心类
 */
export class YiPetApplication extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            debug: false,
            autoStart: true,
            ...options
        };
        
        this.logger = new Logger('YiPetApplication');
        this.moduleManager = new ModuleManager(this);
        this.initialized = false;
        this.started = false;
        this.version = '1.0.0';
        
        // 全局应用实例
        window.YiPetApp = this;
        
        this.logger.info('YiPet应用核心实例已创建');
    }
    
    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) {
            this.logger.warn('应用已经初始化');
            return;
        }
        
        this.logger.info('初始化YiPet应用...');
        
        try {
            // 验证配置
            const configValidation = validateConfig();
            if (!configValidation.valid) {
                throw new Error(`配置验证失败: ${configValidation.errors.join(', ')}`);
            }
            
            // 初始化模块管理器
            await this.moduleManager.init();
            
            // 加载核心模块
            await this.loadCoreModules();
            
            // 加载功能模块
            await this.loadFeatureModules();
            
            // 加载页面模块
            await this.loadPageModules();
            
            // 设置全局错误处理
            this.setupGlobalErrorHandling();
            
            this.initialized = true;
            
            this.emit('app:initialized');
            
            this.logger.info('YiPet应用初始化完成');
            
            // 自动启动
            if (this.options.autoStart) {
                await this.start();
            }
            
        } catch (error) {
            this.logger.error('应用初始化失败', error);
            this.emit('app:init-error', error);
            throw error;
        }
    }
    
    /**
     * 启动应用
     */
    async start() {
        if (!this.initialized) {
            throw new Error('应用未初始化，请先调用init()方法');
        }
        
        if (this.started) {
            this.logger.warn('应用已经启动');
            return;
        }
        
        this.logger.info('启动YiPet应用...');
        
        try {
            // 启动所有模块
            await this.moduleManager.startAll();
            
            // 设置全局快捷键
            this.setupGlobalShortcuts();
            
            // 设置扩展API
            this.setupExtensionAPI();
            
            this.started = true;
            
            this.emit('app:started');
            
            this.logger.info('YiPet应用启动完成');
            
        } catch (error) {
            this.logger.error('应用启动失败', error);
            this.emit('app:start-error', error);
            throw error;
        }
    }
    
    /**
     * 停止应用
     */
    async stop() {
        if (!this.started) {
            this.logger.warn('应用未启动');
            return;
        }
        
        this.logger.info('停止YiPet应用...');
        
        try {
            // 停止所有模块
            await this.moduleManager.stopAll();
            
            this.started = false;
            
            this.emit('app:stopped');
            
            this.logger.info('YiPet应用停止完成');
            
        } catch (error) {
            this.logger.error('应用停止失败', error);
            this.emit('app:stop-error', error);
            throw error;
        }
    }
    
    /**
     * 重新启动应用
     */
    async restart() {
        this.logger.info('重新启动YiPet应用...');
        
        try {
            await this.stop();
            await this.start();
            
            this.emit('app:restarted');
            
            this.logger.info('YiPet应用重新启动完成');
            
        } catch (error) {
            this.logger.error('应用重新启动失败', error);
            this.emit('app:restart-error', error);
            throw error;
        }
    }
    
    /**
     * 加载核心模块
     */
    async loadCoreModules() {
        this.logger.info('加载核心模块...');
        
        // 核心模块配置
        const coreModules = [
            // 这里可以添加核心模块
        ];
        
        for (const moduleConfig of coreModules) {
            try {
                await this.loadModule(moduleConfig);
            } catch (error) {
                this.logger.error(`核心模块加载失败: ${moduleConfig.name}`, error);
                throw error;
            }
        }
        
        this.logger.info('核心模块加载完成');
    }
    
    /**
     * 加载功能模块
     */
    async loadFeatureModules() {
        this.logger.info('加载功能模块...');
        
        // 功能模块配置
        const featureModules = [
            {
                name: 'pet',
                path: '../modules/pet/index.js',
                required: true,
                priority: 10,
                dependencies: [],
                provides: ['pet-core', 'pet-ui', 'pet-services']
            },
            {
                name: 'chat',
                path: '../modules/chat/index.js',
                required: false,
                priority: 8,
                dependencies: ['pet'],
                provides: ['chat-core', 'chat-ui', 'chat-services']
            },
            {
                name: 'screenshot',
                path: '../modules/screenshot/index.js',
                required: false,
                priority: 7,
                dependencies: [],
                provides: ['screenshot-core', 'screenshot-ui', 'screenshot-services']
            },
            {
                name: 'mermaid',
                path: '../modules/mermaid/index.js',
                required: false,
                priority: 6,
                dependencies: [],
                provides: ['mermaid-core', 'mermaid-ui', 'mermaid-services']
            },
            {
                name: 'faq',
                path: '../modules/faq/index.js',
                required: false,
                priority: 5,
                dependencies: [],
                provides: ['faq-core', 'faq-ui', 'faq-services']
            },
            {
                name: 'session',
                path: '../modules/session/index.js',
                required: true,
                priority: 9,
                dependencies: [],
                provides: ['session-core', 'session-ui', 'session-services']
            }
        ];
        
        // 根据配置过滤模块
        const enabledModules = featureModules.filter(module => {
            const config = getConfig(`modules.${module.name}.enabled`);
            return config !== false; // 默认启用
        });
        
        for (const moduleConfig of enabledModules) {
            try {
                await this.loadModule(moduleConfig);
            } catch (error) {
                if (moduleConfig.required) {
                    this.logger.error(`必需功能模块加载失败: ${moduleConfig.name}`, error);
                    throw error;
                } else {
                    this.logger.warn(`可选功能模块加载失败: ${moduleConfig.name}`, error);
                }
            }
        }
        
        this.logger.info('功能模块加载完成');
    }
    
    /**
     * 加载页面模块
     */
    async loadPageModules() {
        this.logger.info('加载页面模块...');
        
        // 页面模块配置
        const pageModules = [
            {
                name: 'popup',
                path: '../pages/popup/index.js',
                required: true,
                priority: 10,
                dependencies: [],
                provides: ['popup-core', 'popup-ui', 'popup-services']
            },
            {
                name: 'background',
                path: '../pages/background/index.js',
                required: true,
                priority: 10,
                dependencies: [],
                provides: ['background-core', 'background-services']
            },
            {
                name: 'content',
                path: '../pages/content/index.js',
                required: true,
                priority: 9,
                dependencies: [],
                provides: ['content-core', 'content-services']
            },
            {
                name: 'options',
                path: '../pages/options/index.js',
                required: false,
                priority: 7,
                dependencies: [],
                provides: ['options-core', 'options-ui', 'options-services']
            }
        ];
        
        for (const moduleConfig of pageModules) {
            try {
                await this.loadModule(moduleConfig);
            } catch (error) {
                if (moduleConfig.required) {
                    this.logger.error(`必需页面模块加载失败: ${moduleConfig.name}`, error);
                    throw error;
                } else {
                    this.logger.warn(`可选页面模块加载失败: ${moduleConfig.name}`, error);
                }
            }
        }
        
        this.logger.info('页面模块加载完成');
    }
    
    /**
     * 加载模块
     */
    async loadModule(moduleConfig) {
        this.logger.info(`加载模块: ${moduleConfig.name}`);
        
        try {
            // 动态导入模块
            const moduleExports = await import(moduleConfig.path);
            let moduleInstance;
            
            // 处理不同的模块导出格式
            if (moduleExports.default && typeof moduleExports.default === 'function') {
                // 如果默认导出是类，创建实例
                moduleInstance = new moduleExports.default();
            } else if (moduleExports.default && moduleExports.default.module) {
                // 如果默认导出包含module属性，使用module属性
                moduleInstance = new moduleExports.default.module();
            } else if (moduleExports.module && typeof moduleExports.module === 'function') {
                // 如果module属性是类，创建实例
                moduleInstance = new moduleExports.module();
            } else if (typeof moduleExports === 'function') {
                // 如果直接导出是类，创建实例
                moduleInstance = new moduleExports();
            } else {
                // 其他情况，直接使用导出
                moduleInstance = moduleExports.default || moduleExports;
            }
            
            // 确保模块实例有必要的生命周期方法
            if (typeof moduleInstance.init !== 'function') {
                moduleInstance.init = async () => {};
            }
            if (typeof moduleInstance.start !== 'function') {
                moduleInstance.start = async () => {};
            }
            if (typeof moduleInstance.stop !== 'function') {
                moduleInstance.stop = async () => {};
            }
            if (typeof moduleInstance.destroy !== 'function') {
                moduleInstance.destroy = async () => {};
            }
            
            // 注册模块
            await this.moduleManager.registerModule(
                moduleConfig.name,
                moduleInstance,
                {
                    dependencies: moduleConfig.dependencies,
                    provides: moduleConfig.provides,
                    priority: moduleConfig.priority,
                    ...moduleConfig.options
                }
            );
            
            this.logger.info(`模块加载成功: ${moduleConfig.name}`);
            
        } catch (error) {
            this.logger.error(`模块加载失败: ${moduleConfig.name}`, error);
            throw error;
        }
    }
    
    /**
     * 设置全局错误处理
     */
    setupGlobalErrorHandling() {
        this.logger.info('设置全局错误处理...');
        
        // 全局错误处理
        window.addEventListener('error', (event) => {
            this.logger.error('全局错误', event.error);
            this.emit('app:error', event.error);
        });
        
        // 未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('未处理的Promise拒绝', event.reason);
            this.emit('app:unhandled-rejection', event.reason);
        });
        
        this.logger.info('全局错误处理设置完成');
    }
    
    /**
     * 设置全局快捷键
     */
    setupGlobalShortcuts() {
        this.logger.info('设置全局快捷键...');
        
        // 这里可以添加全局快捷键设置
        // 例如：监听键盘事件，处理快捷键
        
        document.addEventListener('keydown', (event) => {
            // 检查是否是快捷键组合
            if (event.ctrlKey && event.shiftKey) {
                switch (event.key) {
                    case 'P':
                        event.preventDefault();
                        this.emit('shortcut:toggle-pet');
                        break;
                    case 'O':
                        event.preventDefault();
                        this.emit('shortcut:open-popup');
                        break;
                    case 'S':
                        event.preventDefault();
                        this.emit('shortcut:take-screenshot');
                        break;
                    case 'C':
                        event.preventDefault();
                        this.emit('shortcut:open-chat');
                        break;
                    case 'T':
                        event.preventDefault();
                        this.emit('shortcut:toggle-theme');
                        break;
                }
            }
        });
        
        this.logger.info('全局快捷键设置完成');
    }
    
    /**
     * 设置扩展API
     */
    setupExtensionAPI() {
        this.logger.info('设置扩展API...');
        
        // 检查是否在扩展环境中
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // 设置扩展图标点击事件
            if (chrome.action) {
                chrome.action.onClicked.addListener(async (tab) => {
                    try {
                        // 获取popup模块
                        const popupModule = this.moduleManager.getModule('popup');
                        if (popupModule && popupModule.instance) {
                            const manager = popupModule.instance.getManager();
                            if (manager) {
                                await manager.open({
                                    view: 'main',
                                    data: { tabId: tab.id }
                                });
                            }
                        } else {
                            // 备用方案：直接导入
                            const { createPopupModule } = await import('../pages/popup/index.js');
                            const popupInstance = createPopupModule();
                            if (popupInstance.initialized) {
                                const manager = popupInstance.getManager();
                                if (manager) {
                                    await manager.open({
                                        view: 'main',
                                        data: { tabId: tab.id }
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error('打开弹窗失败:', error);
                    }
                });
            }
            
            // 设置右键菜单
            if (chrome.contextMenus) {
                chrome.contextMenus.create({
                    id: 'yipet-main',
                    title: 'YiPet',
                    contexts: ['all']
                });
                
                chrome.contextMenus.onClicked.addListener(async (info, tab) => {
                    if (info.menuItemId === 'yipet-main') {
                        try {
                            // 获取popup模块
                            const popupModule = this.moduleManager.getModule('popup');
                            if (popupModule && popupModule.instance) {
                                const manager = popupModule.instance.getManager();
                                if (manager) {
                                    await manager.open({
                                        view: 'main',
                                        data: { tabId: tab.id }
                                    });
                                }
                            } else {
                                // 备用方案：直接导入
                                const { createPopupModule } = await import('../pages/popup/index.js');
                                const popupInstance = createPopupModule();
                                if (popupInstance.initialized) {
                                    const manager = popupInstance.getManager();
                                    if (manager) {
                                        await manager.open({
                                            view: 'main',
                                            data: { tabId: tab.id }
                                        });
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('打开弹窗失败:', error);
                        }
                    }
                });
            }
            
            // 设置快捷键
            if (chrome.commands) {
                chrome.commands.onCommand.addListener(async (command) => {
                    switch (command) {
                        case 'open-popup':
                            try {
                                // 获取popup模块
                                const popupModule = this.moduleManager.getModule('popup');
                                if (popupModule && popupModule.instance) {
                                    const manager = popupModule.instance.getManager();
                                    if (manager) {
                                        await manager.open({
                                            view: 'main',
                                            data: {}
                                        });
                                    }
                                } else {
                                    // 备用方案：直接导入
                                    const { createPopupModule } = await import('../pages/popup/index.js');
                                    const popupInstance = createPopupModule();
                                    if (popupInstance.initialized) {
                                        const manager = popupInstance.getManager();
                                        if (manager) {
                                            await manager.open({
                                                view: 'main',
                                                data: {}
                                            });
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error('打开弹窗失败:', error);
                            }
                            break;
                    }
                });
            }
        }
        
        this.logger.info('扩展API设置完成');
    }
    
    /**
     * 获取应用状态
     */
    getAppStatus() {
        return {
            initialized: this.initialized,
            started: this.started,
            version: this.version,
            modules: this.moduleManager.getAllModuleStatus(),
            stats: this.moduleManager.getModuleStatistics()
        };
    }
    
    /**
     * 获取模块管理器
     */
    getModuleManager() {
        return this.moduleManager;
    }
    
    /**
     * 获取配置
     */
    getConfig(path = null) {
        return getConfig(path);
    }
    
    /**
     * 清理应用
     */
    async cleanup() {
        this.logger.info('清理YiPet应用...');
        
        try {
            // 停止应用
            if (this.started) {
                await this.stop();
            }
            
            // 清理模块管理器
            await this.moduleManager.cleanup();
            
            this.logger.info('YiPet应用清理完成');
            
        } catch (error) {
            this.logger.error('应用清理失败', error);
            throw error;
        }
    }
}