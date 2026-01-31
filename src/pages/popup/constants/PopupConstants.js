/**
 * Popup Constants
 * 弹窗常量
 */

/**
 * 弹窗配置常量
 */
export const POPUP_CONFIG = {
    // 默认尺寸
    DEFAULT_WIDTH: 400,
    DEFAULT_HEIGHT: 600,
    
    // 最小尺寸
    MIN_WIDTH: 320,
    MIN_HEIGHT: 400,
    
    // 最大尺寸
    MAX_WIDTH: 600,
    MAX_HEIGHT: 800,
    
    // 位置选项
    POSITIONS: {
        CENTER: 'center',
        TOP_LEFT: 'top-left',
        TOP_RIGHT: 'top-right',
        BOTTOM_LEFT: 'bottom-left',
        BOTTOM_RIGHT: 'bottom-right'
    },
    
    // 主题选项
    THEMES: {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    },
    
    // 动画配置
    ANIMATION_DURATION: 300,
    ANIMATION_EASING: 'ease-out',
    
    // 超时配置
    TIMEOUTS: {
        AUTO_CLOSE: 5000,
        NOTIFICATION: 3000,
        LOADING: 10000
    }
};

/**
 * 弹窗视图常量
 */
export const POPUP_VIEWS = {
    MAIN: 'main',
    SETTINGS: 'settings',
    STATISTICS: 'statistics',
    NOTIFICATIONS: 'notifications',
    HELP: 'help',
    ABOUT: 'about'
};

/**
 * 快捷操作常量
 */
export const QUICK_ACTIONS = {
    TOGGLE_PET: 'toggle-pet',
    SCREENSHOT: 'screenshot',
    CHAT: 'chat',
    SETTINGS: 'settings',
    HELP: 'help',
    FEEDBACK: 'feedback',
    SHARE: 'share',
    QUIT: 'quit'
};

/**
 * 通知类型常量
 */
export const NOTIFICATION_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    SYSTEM: 'system'
};

/**
 * 通知图标常量
 */
export const NOTIFICATION_ICONS = {
    [NOTIFICATION_TYPES.INFO]: 'ℹ️',
    [NOTIFICATION_TYPES.SUCCESS]: '✅',
    [NOTIFICATION_TYPES.WARNING]: '⚠️',
    [NOTIFICATION_TYPES.ERROR]: '❌',
    [NOTIFICATION_TYPES.SYSTEM]: '🔔'
};

/**
 * 存储键常量
 */
export const STORAGE_KEYS = {
    POPUP_CONFIG: 'yipet_popup_config',
    POPUP_STATE: 'yipet_popup_state',
    QUICK_ACTIONS: 'yipet_quick_actions',
    NOTIFICATIONS: 'yipet_notifications',
    STATISTICS: 'yipet_statistics',
    USER_SETTINGS: 'yipet_user_settings'
};

/**
 * 事件常量
 */
export const POPUP_EVENTS = {
    // 生命周期事件
    INITIALIZED: 'popup:initialized',
    OPENED: 'popup:opened',
    CLOSED: 'popup:closed',
    DESTROYED: 'popup:destroyed',
    
    // 视图事件
    VIEW_SWITCHED: 'popup:view:switched',
    VIEW_BACK: 'popup:view:back',
    
    // 配置事件
    CONFIG_SAVED: 'popup:config:saved',
    CONFIG_LOADED: 'popup:config:loaded',
    
    // 操作事件
    ACTION_EXECUTED: 'popup:action:executed',
    ACTION_FAILED: 'popup:action:failed',
    
    // 通知事件
    NOTIFICATION_RECEIVED: 'popup:notification:received',
    NOTIFICATION_READ: 'popup:notification:read',
    
    // 错误事件
    ERROR: 'popup:error',
    
    // 窗口事件
    WINDOW_RESIZED: 'popup:window:resized'
};

/**
 * API端点常量
 */
export const API_ENDPOINTS = {
    POPUP_CONFIG: '/popup/config',
    POPUP_STATE: '/popup/state',
    QUICK_ACTIONS: '/popup/actions',
    NOTIFICATIONS: '/popup/notifications',
    STATISTICS: '/popup/statistics',
    USER_SETTINGS: '/user/settings',
    FEATURE_FLAGS: '/popup/features'
};

/**
 * 权限常量
 */
export const PERMISSIONS = {
    POPUP: 'popup',
    NOTIFICATIONS: 'notifications',
    STORAGE: 'storage',
    TABS: 'tabs'
};

/**
 * 默认配置
 */
export const DEFAULT_POPUP_CONFIG = {
    width: POPUP_CONFIG.DEFAULT_WIDTH,
    height: POPUP_CONFIG.DEFAULT_HEIGHT,
    position: POPUP_CONFIG.POSITIONS.CENTER,
    theme: POPUP_CONFIG.THEMES.LIGHT,
    animations: true,
    autoClose: false,
    showHeader: true,
    showFooter: false
};

/**
 * 默认快捷操作
 */
export const DEFAULT_QUICK_ACTIONS = [
    {
        id: QUICK_ACTIONS.TOGGLE_PET,
        name: '切换宠物显示',
        icon: '🐱',
        description: '显示/隐藏宠物',
        enabled: true,
        order: 1
    },
    {
        id: QUICK_ACTIONS.SCREENSHOT,
        name: '截图',
        icon: '📸',
        description: '快速截图',
        enabled: true,
        order: 2
    },
    {
        id: QUICK_ACTIONS.CHAT,
        name: '聊天',
        icon: '💬',
        description: '打开聊天窗口',
        enabled: true,
        order: 3
    },
    {
        id: QUICK_ACTIONS.SETTINGS,
        name: '设置',
        icon: '⚙️',
        description: '打开设置页面',
        enabled: true,
        order: 4
    }
];

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
    INITIALIZATION_FAILED: '弹窗初始化失败',
    OPEN_FAILED: '打开弹窗失败',
    CLOSE_FAILED: '关闭弹窗失败',
    VIEW_SWITCH_FAILED: '切换视图失败',
    CONFIG_SAVE_FAILED: '保存配置失败',
    ACTION_EXECUTION_FAILED: '执行操作失败',
    SERVICE_UNAVAILABLE: '服务不可用',
    PERMISSION_DENIED: '权限被拒绝'
};

/**
 * 成功消息常量
 */
export const SUCCESS_MESSAGES = {
    INITIALIZED: '弹窗初始化成功',
    OPENED: '弹窗已打开',
    CLOSED: '弹窗已关闭',
    CONFIG_SAVED: '配置已保存',
    ACTION_EXECUTED: '操作执行成功',
    NOTIFICATION_MARKED_AS_READ: '通知已标记为已读'
};

// 默认导出
export default {
    POPUP_CONFIG,
    POPUP_VIEWS,
    QUICK_ACTIONS,
    NOTIFICATION_TYPES,
    NOTIFICATION_ICONS,
    STORAGE_KEYS,
    POPUP_EVENTS,
    API_ENDPOINTS,
    PERMISSIONS,
    DEFAULT_POPUP_CONFIG,
    DEFAULT_QUICK_ACTIONS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES
};