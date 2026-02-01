/**
 * API端点常量
 */

// 基础端点
 (function (root) {
const BASE_ENDPOINTS = {
    API_BASE: '/api',
    V1_BASE: '/api/v1',
    V2_BASE: '/api/v2'
};

// 认证相关端点
const AUTH_ENDPOINTS = {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
    VALIDATE: '/auth/validate'
};

// 会话相关端点
const SESSION_ENDPOINTS = {
    LIST: '/sessions',
    CREATE: '/sessions',
    UPDATE: '/sessions/:id',
    DELETE: '/sessions/:id',
    BATCH_DELETE: '/sessions/batch',
    SEARCH: '/sessions/search',
    FAVORITES: '/sessions/favorites',
    EXPORT: '/sessions/export',
    IMPORT: '/sessions/import'
};

// FAQ相关端点
const FAQ_ENDPOINTS = {
    LIST: '/faqs',
    CREATE: '/faqs',
    UPDATE: '/faqs/:id',
    DELETE: '/faqs/:id',
    BATCH_UPDATE: '/faqs/batch',
    REORDER: '/faqs/reorder'
};

// 配置相关端点
const CONFIG_ENDPOINTS = {
    GET: '/config',
    UPDATE: '/config',
    RESET: '/config/reset'
};

// 通用数据库操作端点（兼容现有实现）
const DATABASE_ENDPOINTS = {
    QUERY: '/database/query',
    CREATE: '/database/create',
    UPDATE: '/database/update',
    DELETE: '/database/delete',
    BATCH: '/database/batch'
};

// 构建完整URL的工具函数
function buildUrl(baseUrl, endpoint, params = {}) {
    let url = endpoint;
    
    // 替换路径参数
    Object.entries(params).forEach(([key, value]) => {
        url = url.replace(`:${key}`, encodeURIComponent(value));
    });
    
    // 如果是相对路径，添加基础URL
    if (!url.startsWith('http') && baseUrl) {
        url = `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    }
    
    return url;
}

// 构建查询参数的工具函数
function buildQueryParams(params = {}) {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            if (typeof value === 'object') {
                searchParams.append(key, JSON.stringify(value));
            } else {
                searchParams.append(key, String(value));
            }
        }
    });
    
    return searchParams.toString();
}

// 构建数据库查询URL（兼容现有实现）
function buildDatabaseUrl(baseUrl, methodName, parameters = {}) {
    const queryParams = new URLSearchParams({
        module_name: 'services.database.data_service',
        method_name: methodName,
        parameters: JSON.stringify(parameters)
    });
    
    return `${baseUrl}/?${queryParams.toString()}`;
}

root.BASE_ENDPOINTS = BASE_ENDPOINTS;
root.AUTH_ENDPOINTS = AUTH_ENDPOINTS;
root.SESSION_ENDPOINTS = SESSION_ENDPOINTS;
root.FAQ_ENDPOINTS = FAQ_ENDPOINTS;
root.CONFIG_ENDPOINTS = CONFIG_ENDPOINTS;
root.DATABASE_ENDPOINTS = DATABASE_ENDPOINTS;
root.buildUrl = buildUrl;
root.buildQueryParams = buildQueryParams;
root.buildDatabaseUrl = buildDatabaseUrl;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
