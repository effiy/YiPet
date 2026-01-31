/**
 * Shared API Index
 * 共享API模块入口文件
 */

// API客户端
export { APIClient } from './client/APIClient.js';
export { HTTPClient } from './client/HTTPClient.js';
export { WebSocketClient } from './client/WebSocketClient.js';

// API服务
export { AuthService } from './services/AuthService.js';
export { ConfigService } from './services/ConfigService.js';
export { ErrorService } from './services/ErrorService.js';
export { LoggerService } from './services/LoggerService.js';

// API工具
export { 
    createAPI,
    createRequest,
    createResponse,
    handleError,
    validateResponse,
    parseResponse,
    formatRequest,
    addHeaders,
    setAuthToken,
    removeAuthToken,
    getAuthToken,
    refreshAuthToken,
    handleRateLimit,
    retryRequest,
    cancelRequest,
    createCancelToken
} from './utils/apiUtils.js';

export { 
    logRequest,
    logResponse,
    logError,
    createLogger,
    setLogLevel,
    getLogLevel,
    enableLogging,
    disableLogging
} from './utils/loggerUtils.js';

export { 
    createError,
    handleAPIError,
    formatError,
    categorizeError,
    isNetworkError,
    isTimeoutError,
    isAuthError,
    isValidationError,
    createErrorHandler,
    setGlobalErrorHandler
} from './utils/errorUtils.js';

// API常量
export { 
    API_CONSTANTS,
    HTTP_METHODS,
    STATUS_CODES,
    ERROR_TYPES,
    RATE_LIMIT_CONFIG,
    RETRY_CONFIG,
    TIMEOUT_CONFIG
} from './constants/index.js';

// API类型
export { 
    APIRequestType,
    APIResponseType,
    APIErrorType,
    APIClientType,
    HTTPMethodType,
    StatusCodeType,
    ErrorHandlerType,
    LoggerType,
    RetryConfigType,
    RateLimitConfigType
} from './types/index.js';

// 默认导出
export default {
    // 客户端
    APIClient,
    HTTPClient,
    WebSocketClient,
    
    // 服务
    AuthService,
    ConfigService,
    ErrorService,
    LoggerService,
    
    // 工具
    createAPI,
    createRequest,
    createResponse,
    handleError,
    validateResponse,
    parseResponse,
    formatRequest,
    addHeaders,
    setAuthToken,
    removeAuthToken,
    getAuthToken,
    refreshAuthToken,
    handleRateLimit,
    retryRequest,
    cancelRequest,
    createCancelToken,
    logRequest,
    logResponse,
    logError,
    createLogger,
    setLogLevel,
    getLogLevel,
    enableLogging,
    disableLogging,
    createError,
    handleAPIError,
    formatError,
    categorizeError,
    isNetworkError,
    isTimeoutError,
    isAuthError,
    isValidationError,
    createErrorHandler,
    setGlobalErrorHandler,
    
    // 常量
    API_CONSTANTS,
    HTTP_METHODS,
    STATUS_CODES,
    ERROR_TYPES,
    RATE_LIMIT_CONFIG,
    RETRY_CONFIG,
    TIMEOUT_CONFIG,
    
    // 类型
    APIRequestType,
    APIResponseType,
    APIErrorType,
    APIClientType,
    HTTPMethodType,
    StatusCodeType,
    ErrorHandlerType,
    LoggerType,
    RetryConfigType,
    RateLimitConfigType
};