/**
 * Popup Types
 * 弹窗类型定义 - JavaScript版本
 */

/**
 * 弹窗配置类型
 */
export class PopupConfig {
    constructor(options = {}) {
        this.width = options.width || 400;
        this.height = options.height || 600;
        this.position = options.position || 'center';
        this.theme = options.theme || 'light';
        this.animations = options.animations !== false;
        this.autoClose = options.autoClose || false;
        this.showHeader = options.showHeader !== false;
        this.showFooter = options.showFooter || false;
    }
}

/**
 * 弹窗状态类型
 */
export class PopupState {
    constructor(options = {}) {
        this.isOpen = options.isOpen || false;
        this.currentView = options.currentView || 'main';
        this.history = options.history || [];
        this.config = new PopupConfig(options.config || {});
    }
}

/**
 * 弹窗历史项类型
 */
export class PopupHistoryItem {
    constructor(options = {}) {
        this.view = options.view || 'main';
        this.timestamp = options.timestamp || Date.now();
        this.options = options.options || {};
    }
}

/**
 * 快捷操作类型
 */
export class QuickAction {
    constructor(options = {}) {
        this.id = options.id || '';
        this.name = options.name || '';
        this.icon = options.icon || '';
        this.description = options.description || '';
        this.enabled = options.enabled !== false;
        this.order = options.order || 0;
        this.handler = options.handler || null;
    }
}

/**
 * 通知类型
 */
export class Notification {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.type = options.type || 'info';
        this.title = options.title || '通知';
        this.message = options.message || '';
        this.timestamp = options.timestamp || Date.now();
        this.read = options.read || false;
        this.icon = options.icon || this.getDefaultIcon(this.type);
        this.actions = options.actions || [];
        this.data = options.data || {};
    }
    
    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getDefaultIcon(type) {
        const iconMap = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'system': '🔔'
        };
        return iconMap[type] || 'ℹ️';
    }
}

/**
 * 通知动作类型
 */
export class NotificationAction {
    constructor(options = {}) {
        this.id = options.id || '';
        this.label = options.label || '';
        this.handler = options.handler || (() => {});
    }
}

/**
 * 统计信息类型
 */
export class Statistics {
    constructor(options = {}) {
        this.totalUsage = options.totalUsage || 0;
        this.todayUsage = options.todayUsage || 0;
        this.weekUsage = options.weekUsage || 0;
        this.monthUsage = options.monthUsage || 0;
        this.averageSession = options.averageSession || 0;
        this.mostUsedFeature = options.mostUsedFeature || 'pet';
        this.lastUpdated = options.lastUpdated || Date.now();
    }
}

/**
 * 用户设置类型
 */
export class UserSettings {
    constructor(options = {}) {
        this.theme = options.theme || 'light';
        this.language = options.language || 'zh-CN';
        this.notifications = options.notifications !== false;
        this.autoStart = options.autoStart || false;
        this.shortcuts = new ShortcutSettings(options.shortcuts || {});
    }
}

/**
 * 快捷键设置类型
 */
export class ShortcutSettings {
    constructor(options = {}) {
        this.toggle = options.toggle || 'Alt+P';
        this.screenshot = options.screenshot || 'Alt+S';
        this.chat = options.chat || 'Alt+C';
    }
}

/**
 * 功能开关类型
 */
export class FeatureFlag {
    constructor(options = {}) {
        this.key = options.key || '';
        this.enabled = options.enabled !== false;
        this.description = options.description || '';
        this.lastModified = options.lastModified || Date.now();
    }
}

/**
 * API响应类型
 */
export class ApiResponse {
    constructor(options = {}) {
        this.success = options.success || false;
        this.data = options.data || null;
        this.error = options.error || null;
        this.message = options.message || '';
    }
}

/**
 * 弹窗选项类型
 */
export class PopupOptions {
    constructor(options = {}) {
        this.view = options.view || 'main';
        this.data = options.data || {};
        this.position = options.position || 'center';
        this.size = options.size || { width: 400, height: 600 };
        this.animations = options.animations !== false;
        this.autoClose = options.autoClose || 0;
    }
}

/**
 * 错误信息类型
 */
export class PopupError {
    constructor(options = {}) {
        this.code = options.code || 'UNKNOWN_ERROR';
        this.message = options.message || '未知错误';
        this.details = options.details || null;
        this.timestamp = options.timestamp || Date.now();
    }
}

/**
 * 弹窗事件类型
 */
export class PopupEvent {
    constructor(options = {}) {
        this.type = options.type || '';
        this.data = options.data || {};
        this.timestamp = options.timestamp || Date.now();
        this.target = options.target || '';
    }
}

/**
 * 浏览器信息类型
 */
export class BrowserInfo {
    constructor(options = {}) {
        this.browser = options.browser || 'unknown';
        this.version = options.version || 'unknown';
        this.userAgent = options.userAgent || navigator.userAgent;
    }
}

/**
 * 权限类型
 */
export class Permission {
    constructor(options = {}) {
        this.name = options.name || '';
        this.granted = options.granted || false;
        this.required = options.required || false;
    }
}

/**
 * 存储数据类型
 */
export class StorageData {
    constructor(data = {}) {
        Object.assign(this, data);
    }
}

/**
 * 弹窗管理器类型
 */
export class PopupManager {
    constructor(options = {}) {
        this.options = options;
        this.state = new PopupState();
    }
    
    async init() {
        // 初始化逻辑
    }
    
    async open(options = {}) {
        // 打开弹窗逻辑
    }
    
    async close() {
        // 关闭弹窗逻辑
    }
    
    async switchView(view, options = {}) {
        // 切换视图逻辑
    }
    
    async goBack() {
        // 返回逻辑
    }
    
    getState() {
        return this.state;
    }
    
    destroy() {
        // 销毁逻辑
    }
}

/**
 * 弹窗服务类型
 */
export class PopupServiceInterface {
    constructor(options = {}) {
        this.options = options;
    }
    
    async init() {
        // 服务初始化逻辑
    }
    
    async getUserSettings() {
        // 获取用户设置逻辑
        return new UserSettings();
    }
    
    async updateUserSettings(settings) {
        // 更新用户设置逻辑
        return settings;
    }
    
    async getQuickActions() {
        // 获取快捷操作逻辑
        return [];
    }
    
    async executeQuickAction(actionId, params = {}) {
        // 执行快捷操作逻辑
        return { success: true };
    }
    
    async getRecentActivity() {
        // 获取最近活动逻辑
        return [];
    }
    
    async getStatistics() {
        // 获取统计信息逻辑
        return new Statistics();
    }
    
    async getNotifications() {
        // 获取通知逻辑
        return [];
    }
    
    async markNotificationAsRead(notificationId) {
        // 标记通知为已读逻辑
    }
    
    async getFeatureFlags() {
        // 获取功能开关逻辑
        return [];
    }
    
    async updateFeatureFlag(featureKey, enabled) {
        // 更新功能开关逻辑
        return new FeatureFlag({ key: featureKey, enabled });
    }
}

/**
 * 主题枚举
 */
export const PopupTheme = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
};

/**
 * 位置枚举
 */
export const PopupPosition = {
    CENTER: 'center',
    TOP_LEFT: 'top-left',
    TOP_RIGHT: 'top-right',
    BOTTOM_LEFT: 'bottom-left',
    BOTTOM_RIGHT: 'bottom-right'
};

/**
 * 通知类型枚举
 */
export const NotificationType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    SYSTEM: 'system'
};

/**
 * 弹窗事件类型枚举
 */
export const PopupEventType = {
    INITIALIZED: 'popup:initialized',
    OPENED: 'popup:opened',
    CLOSED: 'popup:closed',
    VIEW_SWITCHED: 'popup:view:switched',
    ERROR: 'popup:error'
};

/**
 * 视图枚举
 */
export const PopupView = {
    MAIN: 'main',
    SETTINGS: 'settings',
    STATISTICS: 'statistics',
    NOTIFICATIONS: 'notifications',
    HELP: 'help',
    ABOUT: 'about'
};

/**
 * 类型保护函数
 */
export function isPopupConfig(obj) {
    return obj && typeof obj === 'object' && 
           (obj.width === undefined || typeof obj.width === 'number') &&
           (obj.height === undefined || typeof obj.height === 'number') &&
           (obj.position === undefined || typeof obj.position === 'string') &&
           (obj.theme === undefined || typeof obj.theme === 'string');
}

export function isNotification(obj) {
    return obj && typeof obj === 'object' &&
           typeof obj.id === 'string' &&
           typeof obj.type === 'string' &&
           typeof obj.title === 'string' &&
           typeof obj.message === 'string' &&
           typeof obj.timestamp === 'number' &&
           typeof obj.read === 'boolean';
}

export function isQuickAction(obj) {
    return obj && typeof obj === 'object' &&
           typeof obj.id === 'string' &&
           typeof obj.name === 'string' &&
           typeof obj.icon === 'string' &&
           typeof obj.description === 'string' &&
           typeof obj.enabled === 'boolean' &&
           typeof obj.order === 'number';
}

export function isUserSettings(obj) {
    return obj && typeof obj === 'object' &&
           typeof obj.theme === 'string' &&
           typeof obj.language === 'string' &&
           typeof obj.notifications === 'boolean' &&
           typeof obj.autoStart === 'boolean' &&
           obj.shortcuts && typeof obj.shortcuts === 'object';
}

export function isPopupError(obj) {
    return obj && typeof obj === 'object' &&
           typeof obj.code === 'string' &&
           typeof obj.message === 'string' &&
           typeof obj.timestamp === 'number';
}

export function isPopupEvent(obj) {
    return obj && typeof obj === 'object' &&
           typeof obj.type === 'string' &&
           typeof obj.timestamp === 'number';
}

// 默认导出
export default {
    // 类
    PopupConfig,
    PopupState,
    PopupHistoryItem,
    QuickAction,
    Notification,
    NotificationAction,
    Statistics,
    UserSettings,
    ShortcutSettings,
    FeatureFlag,
    ApiResponse,
    PopupOptions,
    PopupError,
    PopupEvent,
    BrowserInfo,
    Permission,
    StorageData,
    PopupManager,
    PopupServiceInterface,
    
    // 枚举
    PopupTheme,
    PopupPosition,
    NotificationType,
    PopupEventType,
    PopupView,
    
    // 类型保护函数
    isPopupConfig,
    isNotification,
    isQuickAction,
    isUserSettings,
    isPopupError,
    isPopupEvent
};