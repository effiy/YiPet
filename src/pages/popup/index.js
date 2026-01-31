/**
 * Popup Module - Main Entry
 * 弹出窗口模块主入口
 */

import { PopupManager } from './core/PopupManager.js';
import { PopupService } from './services/PopupService.js';
import { usePopup } from './hooks/usePopup.js';
import { PopupWindow } from './ui/PopupWindow.js';
import { PopupUtils } from './utils/PopupUtils.js';
import { PopupConstants } from './constants/PopupConstants.js';

/**
 * Popup模块配置
 */
export const popupConfig = {
    name: 'popup',
    version: '1.0.0',
    dependencies: ['core'],
    provides: ['popup:manager', 'popup:service', 'popup:ui'],
    priority: 100,
    autoStart: true
};

/**
 * Popup模块类
 */
export class PopupModule {
    constructor(options = {}) {
        this.options = { ...popupConfig, ...options };
        this.manager = null;
        this.service = null;
        this.initialized = false;
        this.started = false;
    }
    
    /**
     * 初始化模块
     */
    async init() {
        if (this.initialized) {
            console.warn('Popup模块已经初始化');
            return;
        }
        
        console.log('初始化Popup模块...');
        
        try {
            // 创建管理器实例
            this.manager = new PopupManager(this.options);
            
            // 创建服务实例
            this.service = new PopupService(this.options);
            
            // 初始化管理器
            await this.manager.init();
            
            // 初始化服务
            await this.service.init();
            
            this.initialized = true;
            console.log('Popup模块初始化完成');
            
        } catch (error) {
            console.error('Popup模块初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 启动模块
     */
    async start() {
        if (!this.initialized) {
            throw new Error('Popup模块未初始化，无法启动');
        }
        
        if (this.started) {
            console.warn('Popup模块已经启动');
            return;
        }
        
        console.log('启动Popup模块...');
        
        try {
            // 启动管理器
            await this.manager.start();
            
            // 启动服务
            await this.service.start();
            
            // 设置全局访问点
            this.setupGlobalAccess();
            
            this.started = true;
            console.log('Popup模块启动完成');
            
        } catch (error) {
            console.error('Popup模块启动失败:', error);
            throw error;
        }
    }
    
    /**
     * 停止模块
     */
    async stop() {
        if (!this.started) {
            console.warn('Popup模块未启动');
            return;
        }
        
        console.log('停止Popup模块...');
        
        try {
            // 停止服务
            if (this.service) {
                await this.service.stop();
            }
            
            // 停止管理器
            if (this.manager) {
                await this.manager.stop();
            }
            
            // 清理全局访问点
            this.cleanupGlobalAccess();
            
            this.started = false;
            console.log('Popup模块停止完成');
            
        } catch (error) {
            console.error('Popup模块停止失败:', error);
            throw error;
        }
    }
    
    /**
     * 销毁模块
     */
    async destroy() {
        console.log('销毁Popup模块...');
        
        try {
            // 停止模块
            await this.stop();
            
            // 销毁管理器
            if (this.manager) {
                await this.manager.destroy();
                this.manager = null;
            }
            
            // 销毁服务
            if (this.service) {
                await this.service.destroy();
                this.service = null;
            }
            
            this.initialized = false;
            console.log('Popup模块销毁完成');
            
        } catch (error) {
            console.error('Popup模块销毁失败:', error);
            throw error;
        }
    }
    
    /**
     * 设置全局访问点
     */
    setupGlobalAccess() {
        // 将模块实例添加到全局命名空间
        if (typeof window !== 'undefined') {
            window.YiPet = window.YiPet || {};
            window.YiPet.popup = this;
        }
        
        // 将管理器和服务注册到模块管理器
        if (this.manager) {
            this.emit('popup:manager:ready', this.manager);
        }
        
        if (this.service) {
            this.emit('popup:service:ready', this.service);
        }
    }
    
    /**
     * 清理全局访问点
     */
    cleanupGlobalAccess() {
        if (typeof window !== 'undefined' && window.YiPet && window.YiPet.popup) {
            delete window.YiPet.popup;
        }
    }
    
    /**
     * 获取管理器实例
     */
    getManager() {
        return this.manager;
    }
    
    /**
     * 获取服务实例
     */
    getService() {
        return this.service;
    }
    
    /**
     * 检查模块状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            started: this.started,
            manager: this.manager ? this.manager.getStatus() : null,
            service: this.service ? this.service.getStatus() : null
        };
    }
}

/**
 * 创建Popup模块实例
 */
export function createPopupModule(options = {}) {
    return new PopupModule(options);
}

/**
 * 导出模块组件
 */
export {
    PopupManager,
    PopupService,
    usePopup,
    PopupWindow,
    PopupUtils,
    PopupConstants
};

/**
 * 默认导出
 */
export default {
    config: popupConfig,
    module: PopupModule,
    create: createPopupModule,
    
    // 核心组件
    PopupManager,
    PopupService,
    usePopup,
    PopupWindow,
    PopupUtils,
    PopupConstants
};