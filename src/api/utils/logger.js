/**
 * 日志管理器
 * 提供统一的日志记录、级别控制等功能
 */

(function (root) {
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

class Logger {
    constructor(options = {}) {
        this.level = options.level !== undefined ? options.level : LOG_LEVELS.INFO;
        this.prefix = options.prefix || '[API]';
        this.enabled = options.enabled !== false;
        this.includeTimestamp = options.includeTimestamp !== false;
    }
    
    /**
     * 设置日志级别
     */
    setLevel(level) {
        this.level = level;
    }
    
    /**
     * 获取日志级别
     */
    getLevel() {
        return this.level;
    }
    
    /**
     * 启用日志
     */
    enable() {
        this.enabled = true;
    }
    
    /**
     * 禁用日志
     */
    disable() {
        this.enabled = false;
    }
    
    /**
     * 记录日志
     */
    _log(level, levelName, ...args) {
        if (!this.enabled || level < this.level) {
            return;
        }
        
        const timestamp = this.includeTimestamp ? `[${new Date().toISOString()}]` : '';
        const prefix = `${timestamp}${this.prefix}[${levelName}]`;
        
        console.log(prefix, ...args);
    }
    
    /**
     * 调试日志
     */
    debug(...args) {
        this._log(LOG_LEVELS.DEBUG, 'DEBUG', ...args);
    }
    
    /**
     * 信息日志
     */
    info(...args) {
        this._log(LOG_LEVELS.INFO, 'INFO', ...args);
    }
    
    /**
     * 警告日志
     */
    warn(...args) {
        this._log(LOG_LEVELS.WARN, 'WARN', ...args);
    }
    
    /**
     * 错误日志
     */
    error(...args) {
        this._log(LOG_LEVELS.ERROR, 'ERROR', ...args);
    }
    
    /**
     * 记录请求
     */
    logRequest(config) {
        const { url, method, data, params } = config;
        
        this.debug('Request:', {
            url,
            method: method || 'GET',
            data: data ? JSON.stringify(data).slice(0, 500) + '...' : undefined,
            params: params ? JSON.stringify(params).slice(0, 200) + '...' : undefined
        });
    }
    
    /**
     * 记录响应
     */
    logResponse(response) {
        this.debug('Response:', {
            data: response ? JSON.stringify(response).slice(0, 500) + '...' : undefined
        });
    }
    
    /**
     * 记录错误
     */
    logError(error, context = {}) {
        this.error('Error:', {
            name: error.name,
            message: error.message,
            code: error.code,
            context
        });
    }
}

/**
 * 创建日志器
 */
function createLogger(options = {}) {
    return new Logger(options);
}

/**
 * 默认日志器实例
 */
const logger = createLogger();

/**
 * 日志工具函数
 */
const LoggerUtils = {
    logRequest(config) {
        logger.logRequest(config);
    },
    
    logResponse(response) {
        logger.logResponse(response);
    },
    
    logError(error, context) {
        logger.logError(error, context);
    },
    
    setLogLevel(level) {
        logger.setLevel(level);
    },
    
    getLogLevel() {
        return logger.getLevel();
    },
    
    enableLogging() {
        logger.enable();
    },
    
    disableLogging() {
        logger.disable();
    }
};

root.LOG_LEVELS = LOG_LEVELS;
root.Logger = Logger;
root.createLogger = createLogger;
root.logger = logger;
root.LoggerUtils = LoggerUtils;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
