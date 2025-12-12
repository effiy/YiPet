/**
 * 常量定义文件
 * 集中管理所有魔法数字和字符串常量
 */

const CONSTANTS = {
    // 时间相关常量（毫秒）
    TIMING: {
        RETRY_DELAY: 500,
        STATUS_SYNC_INTERVAL: 5000,
        NOTIFICATION_DURATION: 3000,
        CONTENT_SCRIPT_WAIT: 1000,
        REQUEST_RETRY_DELAY: 500,
        QUOTA_CLEANUP_TIMEOUT: 60000,
        REQUEST_TIMEOUT: 60000
    },
    
    // 重试相关常量
    RETRY: {
        MAX_RETRIES: 3,
        INITIAL_DELAY: 500
    },
    
    // 存储相关常量
    STORAGE: {
        MAX_REQUESTS: 1000,
        MAX_SESSION_SIZE: 50000,
        SYNC_INTERVAL: 60000
    },
    
    // UI 相关常量
    UI: {
        NOTIFICATION_TOP: 10,
        STATUS_DOT_ACTIVE: '#4CAF50',
        STATUS_DOT_INACTIVE: '#FF9800',
        NOTIFICATION_SUCCESS: '#4CAF50',
        NOTIFICATION_ERROR: '#f44336',
        NOTIFICATION_INFO: '#2196F3'
    },
    
    // 默认值
    DEFAULTS: {
        PET_SIZE: 180,
        PET_COLOR: 0,
        PET_VISIBLE: false,
        PET_ROLE: '教师'
    },
    
    // 错误消息
    ERROR_MESSAGES: {
        TAB_NOT_FOUND: '无法获取当前标签页，请刷新页面后重试',
        INIT_FAILED: '初始化失败，请刷新页面后重试',
        OPERATION_FAILED: '操作失败，请刷新页面后重试',
        CONTEXT_INVALIDATED: '扩展上下文已失效',
        QUOTA_EXCEEDED: '存储配额超出'
    },
    
    // 成功消息
    SUCCESS_MESSAGES: {
        SHOWN: '已显示',
        HIDDEN: '已隐藏',
        COLOR_CHANGED: '颜色已更换',
        COLOR_SET: '颜色主题已设置',
        SIZE_UPDATED: '大小已更新',
        POSITION_RESET: '位置已重置',
        CENTERED: '已居中',
        ROLE_CHANGED: '角色已切换'
    }
};

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = CONSTANTS;
} else {
    window.CONSTANTS = CONSTANTS;
}

