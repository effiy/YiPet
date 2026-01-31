/**
 * Popup Manager Core
 * 弹窗管理器核心
 */

import { EventEmitter } from '../../shared/utils/common/EventEmitter.js';
import { SharedConstants } from '../../shared/constants/index.js';

/**
 * 弹窗管理器核心类
 */
export class PopupManagerCore extends EventEmitter {
    constructor() {
        super();
        this.isOpen = false;
        this.currentView = 'main';
        this.history = [];
        this.config = {};
    }
    
    /**
     * 初始化弹窗管理器
     */
    async init() {
        try {
            // 加载配置
            await this.loadConfig();
            
            // 设置事件监听
            this.setupEventListeners();
            
            console.log('弹窗管理器初始化完成');
            this.emit('popup:initialized');
            
        } catch (error) {
            console.error('弹窗管理器初始化失败:', error);
            this.emit('popup:error', error);
            throw error;
        }
    }
    
    /**
     * 打开弹窗
     */
    async open(options = {}) {
        try {
            this.isOpen = true;
            this.currentView = options.view || 'main';
            
            // 记录历史
            this.history.push({
                view: this.currentView,
                timestamp: Date.now(),
                options
            });
            
            console.log('弹窗已打开:', this.currentView);
            this.emit('popup:opened', { view: this.currentView, options });
            
        } catch (error) {
            console.error('打开弹窗失败:', error);
            this.emit('popup:error', error);
            throw error;
        }
    }
    
    /**
     * 关闭弹窗
     */
    async close() {
        try {
            this.isOpen = false;
            
            console.log('弹窗已关闭');
            this.emit('popup:closed');
            
        } catch (error) {
            console.error('关闭弹窗失败:', error);
            this.emit('popup:error', error);
            throw error;
        }
    }
    
    /**
     * 切换视图
     */
    async switchView(view, options = {}) {
        try {
            const previousView = this.currentView;
            this.currentView = view;
            
            console.log(`视图切换: ${previousView} -> ${view}`);
            this.emit('popup:view:switched', { 
                previousView, 
                currentView: view, 
                options 
            });
            
        } catch (error) {
            console.error('切换视图失败:', error);
            this.emit('popup:error', error);
            throw error;
        }
    }
    
    /**
     * 返回上一视图
     */
    async goBack() {
        try {
            if (this.history.length > 1) {
                this.history.pop(); // 移除当前视图
                const previousState = this.history[this.history.length - 1];
                
                this.currentView = previousState.view;
                
                console.log('返回上一视图:', this.currentView);
                this.emit('popup:view:back', { view: this.currentView });
            }
            
        } catch (error) {
            console.error('返回上一视图失败:', error);
            this.emit('popup:error', error);
            throw error;
        }
    }
    
    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            // 从存储加载配置
            const config = await this.getStorageData('popupConfig');
            this.config = {
                width: 400,
                height: 600,
                position: 'center',
                theme: 'light',
                ...config
            };
            
            console.log('弹窗配置已加载:', this.config);
            
        } catch (error) {
            console.error('加载配置失败:', error);
            this.config = {
                width: 400,
                height: 600,
                position: 'center',
                theme: 'light'
            };
        }
    }
    
    /**
     * 保存配置
     */
    async saveConfig(config) {
        try {
            this.config = { ...this.config, ...config };
            
            await this.setStorageData('popupConfig', this.config);
            
            console.log('弹窗配置已保存:', this.config);
            this.emit('popup:config:saved', this.config);
            
        } catch (error) {
            console.error('保存配置失败:', error);
            this.emit('popup:error', error);
            throw error;
        }
    }
    
    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 监听键盘事件
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.emit('popup:window:resized', {
                width: window.innerWidth,
                height: window.innerHeight
            });
        });
    }
    
    /**
     * 获取存储数据
     */
    async getStorageData(key) {
        return new Promise((resolve) => {
            if (chrome && chrome.storage) {
                chrome.storage.local.get([key], (result) => {
                    resolve(result[key] || {});
                });
            } else {
                resolve(JSON.parse(localStorage.getItem(key) || '{}'));
            }
        });
    }
    
    /**
     * 设置存储数据
     */
    async setStorageData(key, data) {
        return new Promise((resolve) => {
            if (chrome && chrome.storage) {
                chrome.storage.local.set({ [key]: data }, resolve);
            } else {
                localStorage.setItem(key, JSON.stringify(data));
                resolve();
            }
        });
    }
    
    /**
     * 获取当前状态
     */
    getState() {
        return {
            isOpen: this.isOpen,
            currentView: this.currentView,
            history: [...this.history],
            config: { ...this.config }
        };
    }
    
    /**
     * 销毁管理器
     */
    destroy() {
        this.removeAllListeners();
        this.history = [];
        this.config = {};
        this.isOpen = false;
    }
}

// 创建单例实例
export const popupManagerCore = new PopupManagerCore();