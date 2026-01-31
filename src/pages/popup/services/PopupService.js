/**
 * Popup Service
 * 弹窗服务
 */

import { SharedAPI } from '../../../shared/api/index.js';
import { SharedConstants } from '../../../shared/constants/index.js';

/**
 * 弹窗服务类
 */
export class PopupService {
    constructor() {
        this.apiClient = null;
        this.config = {};
    }
    
    /**
     * 初始化服务
     */
    async init() {
        try {
            // 创建API客户端
            this.apiClient = new SharedAPI.APIClient({
                baseURL: SharedConstants.API_BASE_URL,
                timeout: 10000
            });
            
            // 加载配置
            await this.loadConfig();
            
            console.log('弹窗服务初始化完成');
            
        } catch (error) {
            console.error('弹窗服务初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取用户设置
     */
    async getUserSettings() {
        try {
            const response = await this.apiClient.get('/user/settings');
            return response.data;
        } catch (error) {
            console.error('获取用户设置失败:', error);
            return this.getDefaultSettings();
        }
    }
    
    /**
     * 更新用户设置
     */
    async updateUserSettings(settings) {
        try {
            const response = await this.apiClient.put('/user/settings', settings);
            return response.data;
        } catch (error) {
            console.error('更新用户设置失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取快捷操作
     */
    async getQuickActions() {
        try {
            const response = await this.apiClient.get('/popup/actions');
            return response.data;
        } catch (error) {
            console.error('获取快捷操作失败:', error);
            return this.getDefaultQuickActions();
        }
    }
    
    /**
     * 执行快捷操作
     */
    async executeQuickAction(actionId, params = {}) {
        try {
            const response = await this.apiClient.post(`/popup/actions/${actionId}/execute`, params);
            return response.data;
        } catch (error) {
            console.error('执行快捷操作失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取最近活动
     */
    async getRecentActivity() {
        try {
            const response = await this.apiClient.get('/popup/activity');
            return response.data;
        } catch (error) {
            console.error('获取最近活动失败:', error);
            return [];
        }
    }
    
    /**
     * 获取统计信息
     */
    async getStatistics() {
        try {
            const response = await this.apiClient.get('/popup/statistics');
            return response.data;
        } catch (error) {
            console.error('获取统计信息失败:', error);
            return this.getDefaultStatistics();
        }
    }
    
    /**
     * 获取通知
     */
    async getNotifications() {
        try {
            const response = await this.apiClient.get('/popup/notifications');
            return response.data;
        } catch (error) {
            console.error('获取通知失败:', error);
            return [];
        }
    }
    
    /**
     * 标记通知为已读
     */
    async markNotificationAsRead(notificationId) {
        try {
            const response = await this.apiClient.put(`/popup/notifications/${notificationId}/read`);
            return response.data;
        } catch (error) {
            console.error('标记通知为已读失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取功能开关
     */
    async getFeatureFlags() {
        try {
            const response = await this.apiClient.get('/popup/features');
            return response.data;
        } catch (error) {
            console.error('获取功能开关失败:', error);
            return this.getDefaultFeatureFlags();
        }
    }
    
    /**
     * 更新功能开关
     */
    async updateFeatureFlag(featureKey, enabled) {
        try {
            const response = await this.apiClient.put(`/popup/features/${featureKey}`, { enabled });
            return response.data;
        } catch (error) {
            console.error('更新功能开关失败:', error);
            throw error;
        }
    }
    
    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            const response = await this.apiClient.get('/popup/config');
            this.config = response.data;
        } catch (error) {
            console.error('加载配置失败:', error);
            this.config = this.getDefaultConfig();
        }
    }
    
    /**
     * 获取默认设置
     */
    getDefaultSettings() {
        return {
            theme: 'light',
            language: 'zh-CN',
            notifications: true,
            autoStart: true,
            shortcuts: {
                toggle: 'Ctrl+Shift+Y',
                screenshot: 'Ctrl+Shift+S',
                chat: 'Ctrl+Shift+C'
            }
        };
    }
    
    /**
     * 获取默认快捷操作
     */
    getDefaultQuickActions() {
        return [
            {
                id: 'toggle-pet',
                name: '切换宠物显示',
                icon: '🐱',
                description: '显示/隐藏宠物'
            },
            {
                id: 'screenshot',
                name: '截图',
                icon: '📸',
                description: '快速截图'
            },
            {
                id: 'chat',
                name: '聊天',
                icon: '💬',
                description: '打开聊天窗口'
            },
            {
                id: 'settings',
                name: '设置',
                icon: '⚙️',
                description: '打开设置页面'
            }
        ];
    }
    
    /**
     * 获取默认统计信息
     */
    getDefaultStatistics() {
        return {
            totalUsage: 0,
            todayUsage: 0,
            weekUsage: 0,
            monthUsage: 0,
            averageSession: 0,
            mostUsedFeature: 'pet'
        };
    }
    
    /**
     * 获取默认功能开关
     */
    getDefaultFeatureFlags() {
        return {
            pet: true,
            chat: true,
            screenshot: true,
            mermaid: true,
            faq: true,
            session: true,
            notifications: true,
            analytics: true
        };
    }
    
    /**
     * 获取默认配置
     */
    getDefaultConfig() {
        return {
            popup: {
                width: 400,
                height: 600,
                position: 'center',
                theme: 'light'
            },
            api: {
                timeout: 10000,
                retries: 3,
                cache: true
            }
        };
    }
    
    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            initialized: !!this.apiClient,
            config: this.config,
            lastSync: new Date().toISOString()
        };
    }
}