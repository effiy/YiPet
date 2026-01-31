/**
 * App Configuration
 * 应用配置文件
 */

/**
 * 应用配置
 */
export const AppConfig = {
    // 应用信息
    app: {
        name: 'YiPet',
        version: '1.0.0',
        description: '智能助手宠物扩展',
        author: 'YiPet Team',
        homepage: 'https://yipet.com',
        supportEmail: 'support@yipet.com'
    },
    
    // 调试配置
    debug: {
        enabled: true,
        logLevel: 'debug', // debug, info, warn, error
        enablePerformanceMonitoring: true,
        enableErrorTracking: true,
        enableAnalytics: false
    },
    
    // 性能配置
    performance: {
        enableLazyLoading: true,
        enableCodeSplitting: true,
        enableCaching: true,
        cacheExpiration: 24 * 60 * 60 * 1000, // 24小时
        maxCacheSize: 100 * 1024 * 1024, // 100MB
        enableCompression: true
    },
    
    // 模块配置
    modules: {
        // 宠物模块
        pet: {
            enabled: true,
            defaultVisible: true,
            defaultPosition: { x: 100, y: 100 },
            defaultSize: 80,
            defaultColor: '#FF6B6B',
            animationEnabled: true,
            dragEnabled: true,
            autoHideDelay: 5000, // 5秒
            enableContextMenu: true,
            enableTooltips: true
        },
        
        // 聊天模块
        chat: {
            enabled: true,
            defaultOpen: false,
            maxMessages: 100,
            enableTypingIndicator: true,
            enableMessageHistory: true,
            enableFileSharing: true,
            enableVoiceInput: false,
            enableVoiceOutput: false,
            apiEndpoint: 'https://api.yipet.com/chat',
            timeout: 30000
        },
        
        // 截图模块
        screenshot: {
            enabled: true,
            defaultFormat: 'png',
            defaultQuality: 0.9,
            enableAnnotation: true,
            enableOCR: false,
            enableSharing: true,
            autoSave: true,
            savePath: 'screenshots',
            hotkey: 'Ctrl+Shift+S'
        },
        
        // 流程图模块
        mermaid: {
            enabled: true,
            defaultTheme: 'default',
            enableLivePreview: true,
            enableExport: true,
            exportFormats: ['png', 'svg', 'pdf'],
            autoSave: true,
            savePath: 'diagrams'
        },
        
        // FAQ模块
        faq: {
            enabled: true,
            maxItems: 50,
            enableSearch: true,
            enableCategories: true,
            enableFeedback: true,
            autoUpdate: true,
            updateInterval: 24 * 60 * 60 * 1000 // 24小时
        },
        
        // 会话模块
        session: {
            enabled: true,
            maxSessions: 10,
            autoSaveInterval: 5 * 60 * 1000, // 5分钟
            enableSync: false,
            syncInterval: 30 * 60 * 1000, // 30分钟
            enableEncryption: true,
            encryptionKey: 'default-key'
        }
    },
    
    // 弹窗配置
    popup: {
        enabled: true,
        defaultWidth: 400,
        defaultHeight: 600,
        defaultPosition: 'center',
        enableAnimation: true,
        animationDuration: 300,
        enableTransparency: true,
        opacity: 0.95,
        themes: ['light', 'dark', 'auto'],
        defaultTheme: 'auto',
        enableNotifications: true,
        enableStatistics: true,
        enableQuickActions: true
    },
    
    // 存储配置
    storage: {
        type: 'local', // local, sync, managed
        encryption: {
            enabled: true,
            algorithm: 'AES-GCM',
            keyRotationInterval: 30 * 24 * 60 * 60 * 1000 // 30天
        },
        compression: {
            enabled: true,
            algorithm: 'gzip',
            threshold: 1024 // 1KB
        },
        backup: {
            enabled: true,
            interval: 7 * 24 * 60 * 60 * 1000, // 7天
            maxBackups: 5,
            autoCleanup: true
        }
    },
    
    // API配置
    api: {
        baseURL: 'https://api.yipet.com',
        timeout: 30000,
        retry: {
            enabled: true,
            maxRetries: 3,
            retryDelay: 1000
        },
        rateLimit: {
            enabled: true,
            maxRequests: 100,
            windowMs: 60 * 1000 // 1分钟
        },
        cache: {
            enabled: true,
            ttl: 5 * 60 * 1000, // 5分钟
            maxSize: 1000
        }
    },
    
    // 国际化配置
    i18n: {
        defaultLanguage: 'zh-CN',
        supportedLanguages: ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'],
        fallbackLanguage: 'en-US',
        autoDetect: true,
        enableRTL: false
    },
    
    // 主题配置
    theme: {
        defaultTheme: 'light',
        supportedThemes: ['light', 'dark', 'auto'],
        enableCustomThemes: true,
        enableThemeAnimation: true,
        animationDuration: 200
    },
    
    // 通知配置
    notifications: {
        enabled: true,
        position: 'top-right',
        duration: 5000,
        maxVisible: 3,
        enableSound: true,
        enableVibration: false,
        categories: {
            info: { enabled: true, sound: true },
            success: { enabled: true, sound: true },
            warning: { enabled: true, sound: true },
            error: { enabled: true, sound: true }
        }
    },
    
    // 快捷键配置
    shortcuts: {
        enabled: true,
        global: true,
        mappings: {
            'toggle-pet': 'Ctrl+Shift+P',
            'open-popup': 'Ctrl+Shift+O',
            'take-screenshot': 'Ctrl+Shift+S',
            'open-chat': 'Ctrl+Shift+C',
            'toggle-theme': 'Ctrl+Shift+T'
        }
    },
    
    // 安全配置
    security: {
        enableCSP: true,
        enableSRI: true,
        enableHTTPS: true,
        enableHSTS: true,
        permissions: {
            storage: true,
            tabs: true,
            activeTab: true,
            contextMenus: true,
            notifications: true,
            clipboard: false,
            geolocation: false,
            camera: false,
            microphone: false
        }
    },
    
    // 更新配置
    updates: {
        enabled: true,
        checkInterval: 24 * 60 * 60 * 1000, // 24小时
        autoUpdate: false,
        enableBeta: false,
        enableNotifications: true,
        updateUrl: 'https://api.yipet.com/updates'
    },
    
    // 遥测配置
    telemetry: {
        enabled: false,
        endpoint: 'https://telemetry.yipet.com',
        interval: 60 * 60 * 1000, // 1小时
        enableCrashReporting: true,
        enableUsageAnalytics: false,
        enablePerformanceMonitoring: true,
        anonymizeData: true
    }
};

/**
 * 获取配置
 */
export function getConfig(path = null) {
    if (!path) {
        return AppConfig;
    }
    
    const keys = path.split('.');
    let current = AppConfig;
    
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return undefined;
        }
    }
    
    return current;
}

/**
 * 设置配置
 */
export function setConfig(path, value) {
    const keys = path.split('.');
    let current = AppConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
}

/**
 * 合并配置
 */
export function mergeConfig(config) {
    Object.assign(AppConfig, config);
}

/**
 * 验证配置
 */
export function validateConfig(config = AppConfig) {
    const errors = [];
    
    // 验证必填字段
    if (!config.app || !config.app.name) {
        errors.push('应用名称不能为空');
    }
    
    if (!config.app || !config.app.version) {
        errors.push('应用版本不能为空');
    }
    
    // 验证数值范围
    if (config.popup && config.popup.defaultWidth) {
        if (config.popup.defaultWidth < 200 || config.popup.defaultWidth > 800) {
            errors.push('弹窗宽度必须在200-800之间');
        }
    }
    
    if (config.popup && config.popup.defaultHeight) {
        if (config.popup.defaultHeight < 300 || config.popup.defaultHeight > 1000) {
            errors.push('弹窗高度必须在300-1000之间');
        }
    }
    
    // 验证枚举值
    if (config.theme && config.theme.defaultTheme) {
        const supportedThemes = config.theme.supportedThemes || ['light', 'dark', 'auto'];
        if (!supportedThemes.includes(config.theme.defaultTheme)) {
            errors.push(`不支持的主题: ${config.theme.defaultTheme}`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 获取默认配置
 */
export function getDefaultConfig() {
    return JSON.parse(JSON.stringify(AppConfig));
}

/**
 * 重置配置
 */
export function resetConfig() {
    const defaultConfig = getDefaultConfig();
    Object.assign(AppConfig, defaultConfig);
}

// 默认导出
export default {
    AppConfig,
    getConfig,
    setConfig,
    mergeConfig,
    validateConfig,
    getDefaultConfig,
    resetConfig
};