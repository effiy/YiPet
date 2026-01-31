/**
 * API模块主入口文件
 * 提供统一的API接口和工具函数
 */

// 核心类
export { ApiManager } from './core/ApiManager.js';
export { RequestClient } from './client/RequestClient.js';

// 服务类
export { AuthService } from './services/AuthService.js';
export { ConfigService } from './services/ConfigService.js';
export { SessionService } from './services/SessionService.js';
export { FaqService } from './services/FaqService.js';

// 工具类
export { TokenManager } from './utils/token.js';
export { ErrorHandler } from './utils/error.js';
export { Logger } from './utils/logger.js';

// 工具函数
export { buildUrl, buildQueryParams, buildDatabaseUrl } from './constants/endpoints.js';

// 常量
export { 
    HTTP_METHODS,
    STATUS_CODES,
    ERROR_TYPES,
    API_CONFIG,
    CONTENT_TYPES,
    DEFAULT_HEADERS,
    EXTENSION_URL_PATTERNS
} from './constants/index.js';

export { 
    BASE_ENDPOINTS,
    AUTH_ENDPOINTS,
    SESSION_ENDPOINTS,
    FAQ_ENDPOINTS,
    CONFIG_ENDPOINTS,
    DATABASE_ENDPOINTS
} from './constants/endpoints.js';

// 错误类
export { 
    APIError,
    NetworkError,
    TimeoutError,
    AuthError,
    ValidationError,
    RateLimitError,
    ServerError
} from './utils/error.js';

// 类型定义（用于JSDoc）
export * from './types/index.js';

// 默认导出
export default {
    // 核心类
    ApiManager,
    RequestClient,
    
    // 服务类
    AuthService,
    ConfigService,
    SessionService,
    FaqService,
    
    // 工具类
    TokenManager,
    ErrorHandler,
    Logger,
    
    // 工具函数
    buildUrl,
    buildQueryParams,
    buildDatabaseUrl,
    
    // 常量
    HTTP_METHODS,
    STATUS_CODES,
    ERROR_TYPES,
    API_CONFIG,
    CONTENT_TYPES,
    DEFAULT_HEADERS,
    EXTENSION_URL_PATTERNS,
    
    // 端点常量
    BASE_ENDPOINTS,
    AUTH_ENDPOINTS,
    SESSION_ENDPOINTS,
    FAQ_ENDPOINTS,
    CONFIG_ENDPOINTS,
    DATABASE_ENDPOINTS,
    
    // 错误类
    APIError,
    NetworkError,
    TimeoutError,
    AuthError,
    ValidationError,
    RateLimitError,
    ServerError
};