/**
 * API常量定义
 */

// HTTP方法
export const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    PATCH: 'PATCH',
    HEAD: 'HEAD',
    OPTIONS: 'OPTIONS'
};

// 状态码
export const STATUS_CODES = {
    // 成功
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    
    // 重定向
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    NOT_MODIFIED: 304,
    
    // 客户端错误
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    
    // 服务器错误
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

// 错误类型
export const ERROR_TYPES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// API配置
export const API_CONFIG = {
    // 默认超时时间（毫秒）
    DEFAULT_TIMEOUT: 30000,
    
    // 重试配置
    RETRY_CONFIG: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
    },
    
    // 限流配置
    RATE_LIMIT_CONFIG: {
        maxRequests: 100,
        windowMs: 60000, // 1分钟
        retryAfter: 60 // 秒
    },
    
    // 缓存配置
    CACHE_CONFIG: {
        defaultTTL: 300000, // 5分钟
        maxSize: 100
    }
};

// 内容类型
export const CONTENT_TYPES = {
    JSON: 'application/json',
    FORM_DATA: 'multipart/form-data',
    URL_ENCODED: 'application/x-www-form-urlencoded',
    TEXT: 'text/plain',
    HTML: 'text/html',
    XML: 'application/xml'
};

// 默认请求头
export const DEFAULT_HEADERS = {
    'Content-Type': CONTENT_TYPES.JSON,
    'Accept': CONTENT_TYPES.JSON,
    'X-Requested-With': 'XMLHttpRequest'
};

// 扩展相关的URL模式（用于过滤）
export const EXTENSION_URL_PATTERNS = [
    /^chrome-extension:\/\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
    /api\.effiy\.cn/i // 扩展使用的API域名
];

// 导出默认配置
export default {
    HTTP_METHODS,
    STATUS_CODES,
    ERROR_TYPES,
    API_CONFIG,
    CONTENT_TYPES,
    DEFAULT_HEADERS,
    EXTENSION_URL_PATTERNS
};