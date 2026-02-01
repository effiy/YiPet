/**
 * API模块主入口文件
 * 提供统一的API接口和工具函数
 */

(function (root) {
    root.API = {
        ApiManager: root.ApiManager,
        RequestClient: root.RequestClient,
        AuthService: root.AuthService,
        ConfigService: root.ConfigService,
        SessionService: root.SessionService,
        FaqService: root.FaqService,
        TokenManager: root.TokenManager,
        ErrorHandler: root.ErrorHandler,
        Logger: root.Logger,
        buildUrl: root.buildUrl,
        buildQueryParams: root.buildQueryParams,
        buildDatabaseUrl: root.buildDatabaseUrl,
        HTTP_METHODS: root.HTTP_METHODS,
        STATUS_CODES: root.STATUS_CODES,
        ERROR_TYPES: root.ERROR_TYPES,
        API_CONFIG: root.API_CONFIG,
        CONTENT_TYPES: root.CONTENT_TYPES,
        DEFAULT_HEADERS: root.DEFAULT_HEADERS,
        EXTENSION_URL_PATTERNS: root.EXTENSION_URL_PATTERNS,
        BASE_ENDPOINTS: root.BASE_ENDPOINTS,
        AUTH_ENDPOINTS: root.AUTH_ENDPOINTS,
        SESSION_ENDPOINTS: root.SESSION_ENDPOINTS,
        FAQ_ENDPOINTS: root.FAQ_ENDPOINTS,
        CONFIG_ENDPOINTS: root.CONFIG_ENDPOINTS,
        DATABASE_ENDPOINTS: root.DATABASE_ENDPOINTS,
        APIError: root.APIError,
        NetworkError: root.NetworkError,
        TimeoutError: root.TimeoutError,
        AuthError: root.AuthError,
        ValidationError: root.ValidationError,
        RateLimitError: root.RateLimitError
    };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
