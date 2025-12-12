/**
 * 常量定义文件
 * 
 * 功能说明：
 * - 集中管理所有魔法数字和字符串常量
 * - 避免硬编码，提高代码可维护性
 * - 统一管理用户提示消息
 * 
 * 常量分类：
 * - TIMING: 时间相关常量（毫秒）
 * - RETRY: 重试机制相关常量
 * - STORAGE: 存储相关常量
 * - UI: UI样式和位置常量
 * - DEFAULTS: 默认值常量
 * - ERROR_MESSAGES: 错误提示消息
 * - SUCCESS_MESSAGES: 成功提示消息
 */

const CONSTANTS = {
    /**
     * 时间相关常量（单位：毫秒）
     * 控制各种操作的延迟和超时时间
     */
    TIMING: {
        RETRY_DELAY: 500,                    // 重试延迟
        STATUS_SYNC_INTERVAL: 5000,          // 状态同步间隔（5秒）
        NOTIFICATION_DURATION: 3000,         // 通知显示时长（3秒）
        CONTENT_SCRIPT_WAIT: 1000,           // Content script等待时间（1秒）
        REQUEST_RETRY_DELAY: 500,            // 请求重试延迟
        QUOTA_CLEANUP_TIMEOUT: 60000,       // 配额清理超时（60秒）
        REQUEST_TIMEOUT: 60000,              // 请求超时时间（60秒）
        INJECT_PET_DELAY: 1000,              // 注入宠物延迟（1秒）
        REQUEST_DEDUP_WINDOW: 5000,          // 请求去重时间窗口（5秒）
        REQUEST_CLEANUP_INTERVAL: 30000,     // 请求清理间隔（30秒）
        REQUEST_CLEANUP_TIMEOUT: 60000,      // 请求清理超时（60秒）
        STORAGE_CLEANUP_INTERVAL: 86400000,  // 存储清理间隔（24小时）
        STORAGE_CLEANUP_AGE: 604800000       // 存储清理年龄（7天）
    },
    
    /**
     * 重试相关常量
     * 控制失败操作的重试策略
     */
    RETRY: {
        MAX_RETRIES: 3,        // 最大重试次数
        INITIAL_DELAY: 500     // 初始延迟（毫秒）
    },
    
    /**
     * 存储相关常量
     * 控制存储数据的限制和同步频率
     */
    STORAGE: {
        MAX_REQUESTS: 1000,        // 最大请求记录数
        MAX_SESSION_SIZE: 50000,   // 最大会话大小（字节）
        SYNC_INTERVAL: 60000       // 同步间隔（60秒）
    },
    
    /**
     * URL相关常量
     * 定义系统页面和扩展页面的URL前缀
     */
    URLS: {
        CHROME_PROTOCOL: 'chrome://',
        CHROME_EXTENSION_PROTOCOL: 'chrome-extension://',
        MOZ_EXTENSION_PROTOCOL: 'moz-extension://',
        ABOUT_PROTOCOL: 'about:',
        /**
         * 检查URL是否是系统页面（不应注入脚本）
         * @param {string} url - 要检查的URL
         * @returns {boolean} 是否是系统页面
         */
        isSystemPage: function(url) {
            if (!url || typeof url !== 'string') return false;
            return url.startsWith(this.CHROME_PROTOCOL) ||
                   url.startsWith(this.CHROME_EXTENSION_PROTOCOL) ||
                   url.startsWith(this.MOZ_EXTENSION_PROTOCOL) ||
                   url.startsWith(this.ABOUT_PROTOCOL);
        }
    },
    
    /**
     * UI 相关常量
     * 控制界面元素的样式和位置
     */
    UI: {
        NOTIFICATION_TOP: 10,              // 通知距离顶部距离（像素）
        STATUS_DOT_ACTIVE: '#4CAF50',      // 激活状态指示点颜色（绿色）
        STATUS_DOT_INACTIVE: '#FF9800',    // 非激活状态指示点颜色（橙色）
        NOTIFICATION_SUCCESS: '#4CAF50',   // 成功通知背景色（绿色）
        NOTIFICATION_ERROR: '#f44336',     // 错误通知背景色（红色）
        NOTIFICATION_INFO: '#2196F3'       // 信息通知背景色（蓝色）
    },
    
    /**
     * 默认值常量
     * 定义各种功能的默认初始值
     */
    DEFAULTS: {
        PET_SIZE: 180,        // 宠物默认大小（像素）
        PET_COLOR: 0,         // 宠物默认颜色索引（0-4）
        PET_VISIBLE: false,  // 宠物默认可见性（false=隐藏）
        PET_ROLE: '教师'      // 宠物默认角色
    },
    
    /**
     * 错误消息
     * 统一的错误提示文本，便于国际化
     */
    ERROR_MESSAGES: {
        TAB_NOT_FOUND: '无法获取当前标签页，请刷新页面后重试',
        INIT_FAILED: '初始化失败，请刷新页面后重试',
        OPERATION_FAILED: '操作失败，请刷新页面后重试',
        CONTEXT_INVALIDATED: '扩展上下文已失效',
        QUOTA_EXCEEDED: '存储配额超出'
    },
    
    /**
     * 成功消息
     * 统一的操作成功提示文本，便于国际化
     */
    SUCCESS_MESSAGES: {
        SHOWN: '已显示',
        HIDDEN: '已隐藏',
        COLOR_CHANGED: '颜色已更换',
        COLOR_SET: '颜色主题已设置',
        SIZE_UPDATED: '大小已更新',
        POSITION_RESET: '位置已重置',
        CENTERED: '已居中',
        ROLE_CHANGED: '角色已切换'
    },
    
    /**
     * API相关常量
     * 定义API请求的限制和配置
     */
    API: {
        MAX_WEWORK_CONTENT_LENGTH: 4096,     // 企微机器人消息最大长度
        MAX_WEWORK_CONTENT_TRUNCATE_MARGIN: 100  // 企微机器人消息截断边距
    }
};

// 导出
// 在 service worker 环境中，使用 self 或 globalThis
// 在浏览器环境中，使用 window
if (typeof module !== "undefined" && module.exports) {
    module.exports = CONSTANTS;
} else if (typeof self !== "undefined") {
    // Service Worker 环境
    self.CONSTANTS = CONSTANTS;
    if (typeof globalThis !== "undefined") {
        globalThis.CONSTANTS = CONSTANTS;
    }
} else if (typeof window !== "undefined") {
    // 浏览器环境
    window.CONSTANTS = CONSTANTS;
} else {
    // 降级方案：尝试全局作用域
    try {
        globalThis.CONSTANTS = CONSTANTS;
    } catch (e) {
        // 如果都失败，至少尝试赋值给全局对象
        this.CONSTANTS = CONSTANTS;
    }
}

