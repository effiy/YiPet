/**
 * API模块主入口文件
 * 提供统一的API接口和工具函数
 */

import { ApiManager } from './core/ApiManager.js';
import { RequestClient } from './utils/request.js';

import { AuthService } from './services/AuthService.js';
import { ConfigService } from './services/ConfigService.js';
import { SessionService } from './services/SessionService.js';
import { FaqService } from './services/FaqService.js';

import { TokenManager } from './utils/token.js';
import { ErrorHandler } from './utils/error.js';
import { Logger } from './utils/logger.js';

import { buildUrl, buildQueryParams, buildDatabaseUrl } from './constants/endpoints.js';
import {
    HTTP_METHODS,
    STATUS_CODES,
    ERROR_TYPES,
    API_CONFIG,
    CONTENT_TYPES,
    DEFAULT_HEADERS,
    EXTENSION_URL_PATTERNS
} from './constants/index.js';
import {
    BASE_ENDPOINTS,
    AUTH_ENDPOINTS,
    SESSION_ENDPOINTS,
    FAQ_ENDPOINTS,
    CONFIG_ENDPOINTS,
    DATABASE_ENDPOINTS
} from './constants/endpoints.js';
import {
    APIError,
    NetworkError,
    TimeoutError,
    AuthError,
    ValidationError,
    RateLimitError,
    ServerError
} from './utils/error.js';

// 核心类
export { ApiManager, RequestClient };

// 服务类
export { AuthService, ConfigService, SessionService, FaqService };

// 工具类
export { TokenManager, ErrorHandler, Logger };

// 工具函数
export { buildUrl, buildQueryParams, buildDatabaseUrl };

// 常量
export {
    HTTP_METHODS,
    STATUS_CODES,
    ERROR_TYPES,
    API_CONFIG,
    CONTENT_TYPES,
    DEFAULT_HEADERS,
    EXTENSION_URL_PATTERNS
};

export {
    BASE_ENDPOINTS,
    AUTH_ENDPOINTS,
    SESSION_ENDPOINTS,
    FAQ_ENDPOINTS,
    CONFIG_ENDPOINTS,
    DATABASE_ENDPOINTS
};

// 错误类
export {
    APIError,
    NetworkError,
    TimeoutError,
    AuthError,
    ValidationError,
    RateLimitError,
    ServerError
};

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
