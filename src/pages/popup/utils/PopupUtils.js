/**
 * Popup Utilities
 * 弹窗工具函数
 */

import { POPUP_CONFIG, POPUP_VIEWS, NOTIFICATION_TYPES } from '../constants/PopupConstants.js';

/**
 * 弹窗工具类
 */
export class PopupUtils {
    /**
     * 计算弹窗位置
     */
    static calculatePosition(position, width, height) {
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        
        let left = 0;
        let top = 0;
        
        switch (position) {
            case POPUP_CONFIG.POSITIONS.CENTER:
                left = Math.round((screenWidth - width) / 2);
                top = Math.round((screenHeight - height) / 2);
                break;
                
            case POPUP_CONFIG.POSITIONS.TOP_LEFT:
                left = 20;
                top = 20;
                break;
                
            case POPUP_CONFIG.POSITIONS.TOP_RIGHT:
                left = screenWidth - width - 20;
                top = 20;
                break;
                
            case POPUP_CONFIG.POSITIONS.BOTTOM_LEFT:
                left = 20;
                top = screenHeight - height - 20;
                break;
                
            case POPUP_CONFIG.POSITIONS.BOTTOM_RIGHT:
                left = screenWidth - width - 20;
                top = screenHeight - height - 20;
                break;
                
            default:
                left = Math.round((screenWidth - width) / 2);
                top = Math.round((screenHeight - height) / 2);
        }
        
        return { left, top };
    }
    
    /**
     * 验证弹窗尺寸
     */
    static validateDimensions(width, height) {
        const validatedWidth = Math.max(
            POPUP_CONFIG.MIN_WIDTH,
            Math.min(width || POPUP_CONFIG.DEFAULT_WIDTH, POPUP_CONFIG.MAX_WIDTH)
        );
        
        const validatedHeight = Math.max(
            POPUP_CONFIG.MIN_HEIGHT,
            Math.min(height || POPUP_CONFIG.DEFAULT_HEIGHT, POPUP_CONFIG.MAX_HEIGHT)
        );
        
        return { width: validatedWidth, height: validatedHeight };
    }
    
    /**
     * 创建通知
     */
    static createNotification(type, title, message, options = {}) {
        const notification = {
            id: this.generateId(),
            type: type || NOTIFICATION_TYPES.INFO,
            title: title || '通知',
            message: message || '',
            timestamp: Date.now(),
            read: false,
            ...options
        };
        
        return notification;
    }
    
    /**
     * 格式化通知时间
     */
    static formatNotificationTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) {
            return '刚刚';
        } else if (minutes < 60) {
            return `${minutes}分钟前`;
        } else if (hours < 24) {
            return `${hours}小时前`;
        } else if (days < 7) {
            return `${days}天前`;
        } else {
            const date = new Date(timestamp);
            return date.toLocaleDateString();
        }
    }
    
    /**
     * 生成唯一ID
     */
    static generateId() {
        return `popup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 验证视图名称
     */
    static validateView(view) {
        return Object.values(POPUP_VIEWS).includes(view) ? view : POPUP_VIEWS.MAIN;
    }
    
    /**
     * 创建快捷操作
     */
    static createQuickAction(id, name, icon, description, options = {}) {
        return {
            id,
            name,
            icon,
            description,
            enabled: true,
            order: 0,
            ...options
        };
    }
    
    /**
     * 格式化使用时长
     */
    static formatUsageTime(seconds) {
        if (seconds < 60) {
            return `${seconds}秒`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
        }
    }
    
    /**
     * 创建统计信息
     */
    static createStatistics() {
        return {
            totalUsage: 0,
            todayUsage: 0,
            weekUsage: 0,
            monthUsage: 0,
            averageSession: 0,
            mostUsedFeature: 'pet',
            lastUpdated: Date.now()
        };
    }
    
    /**
     * 更新统计信息
     */
    static updateStatistics(statistics, feature, usageTime) {
        const now = Date.now();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        const updatedStats = { ...statistics };
        
        // 更新总使用时长
        updatedStats.totalUsage += usageTime;
        
        // 更新今日使用时长
        if (statistics.lastUpdated >= today.getTime()) {
            updatedStats.todayUsage += usageTime;
        } else {
            updatedStats.todayUsage = usageTime;
        }
        
        // 更新本周使用时长
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        
        if (statistics.lastUpdated >= weekStart.getTime()) {
            updatedStats.weekUsage += usageTime;
        } else {
            updatedStats.weekUsage = usageTime;
        }
        
        // 更新本月使用时长
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        
        if (statistics.lastUpdated >= monthStart.getTime()) {
            updatedStats.monthUsage += usageTime;
        } else {
            updatedStats.monthUsage = usageTime;
        }
        
        // 更新平均会话时长
        updatedStats.averageSession = Math.round(updatedStats.totalUsage / 100); // 假设100个会话
        
        // 更新最常用功能
        if (feature) {
            updatedStats.mostUsedFeature = feature;
        }
        
        updatedStats.lastUpdated = now;
        
        return updatedStats;
    }
    
    /**
     * 创建功能开关
     */
    static createFeatureFlag(key, enabled = true, description = '') {
        return {
            key,
            enabled,
            description,
            lastModified: Date.now()
        };
    }
    
    /**
     * 验证权限
     */
    static validatePermissions(requiredPermissions) {
        if (!chrome || !chrome.permissions) {
            return false;
        }
        
        return new Promise((resolve) => {
            chrome.permissions.contains({
                permissions: requiredPermissions
            }, (result) => {
                resolve(result);
            });
        });
    }
    
    /**
     * 请求权限
     */
    static requestPermissions(requiredPermissions) {
        if (!chrome || !chrome.permissions) {
            return Promise.resolve(false);
        }
        
        return new Promise((resolve) => {
            chrome.permissions.request({
                permissions: requiredPermissions
            }, (granted) => {
                resolve(granted);
            });
        });
    }
    
    /**
     * 防抖函数
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 节流函数
     */
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 深度合并对象
     */
    static deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }
    
    /**
     * 获取浏览器信息
     */
    static getBrowserInfo() {
        const userAgent = navigator.userAgent;
        let browser = 'unknown';
        let version = 'unknown';
        
        if (userAgent.includes('Chrome')) {
            browser = 'chrome';
            const match = userAgent.match(/Chrome\/(\d+)/);
            version = match ? match[1] : 'unknown';
        } else if (userAgent.includes('Firefox')) {
            browser = 'firefox';
            const match = userAgent.match(/Firefox\/(\d+)/);
            version = match ? match[1] : 'unknown';
        } else if (userAgent.includes('Safari')) {
            browser = 'safari';
            const match = userAgent.match(/Version\/(\d+)/);
            version = match ? match[1] : 'unknown';
        } else if (userAgent.includes('Edge')) {
            browser = 'edge';
            const match = userAgent.match(/Edge\/(\d+)/);
            version = match ? match[1] : 'unknown';
        }
        
        return { browser, version };
    }
}

// 默认导出
export default PopupUtils;