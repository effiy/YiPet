/**
 * API类型定义
 * 定义所有API相关的TypeScript类型（用于JSDoc和IDE支持）
 */

/**
 * 基础API配置
 * @typedef {Object} ApiConfig
 * @property {number} [timeout] - 请求超时时间（毫秒）
 * @property {number} [maxRetries] - 最大重试次数
 * @property {number} [retryDelay] - 重试延迟（毫秒）
 * @property {Object} [headers] - 自定义请求头
 * @property {boolean} [enabled] - 是否启用
 * @property {Object} [logger] - 日志配置
 * @property {string} [logger.prefix] - 日志前缀
 * @property {string} [logger.level] - 日志级别
 */

/**
 * 请求配置
 * @typedef {Object} RequestConfig
 * @property {string} method - HTTP方法
 * @property {string} url - 请求URL
 * @property {Object} [headers] - 请求头
 * @property {Object} [params] - URL参数
 * @property {Object} [data] - 请求体数据
 * @property {number} [timeout] - 超时时间
 * @property {boolean} [withCredentials] - 是否携带凭据
 * @property {Object} [signal] - AbortSignal
 */

/**
 * 响应数据
 * @typedef {Object} ApiResponse
 * @property {number} status - HTTP状态码
 * @property {string} statusText - 状态文本
 * @property {Object} headers - 响应头
 * @property {*} data - 响应数据
 * @property {Object} [config] - 请求配置
 */

/**
 * 分页参数
 * @typedef {Object} PaginationParams
 * @property {number} [page] - 页码
 * @property {number} [limit] - 每页数量
 * @property {string} [sort] - 排序字段
 * @property {number} [skip] - 跳过数量
 */

/**
 * 分页响应
 * @typedef {Object} PaginatedResponse
 * @property {Array} list - 数据列表
 * @property {number} total - 总数量
 * @property {number} page - 当前页码
 * @property {number} limit - 每页数量
 * @property {number} totalPages - 总页数
 */

/**
 * 会话数据
 * @typedef {Object} SessionData
 * @property {string} key - 会话唯一标识
 * @property {string} url - 页面URL
 * @property {string} title - 页面标题
 * @property {string} [pageDescription] - 页面描述
 * @property {string} [pageContent] - 页面内容
 * @property {Array<Object>} [messages] - 消息列表
 * @property {Array<string>} [tags] - 标签列表
 * @property {boolean} [isFavorite] - 是否收藏
 * @property {number} [createdAt] - 创建时间戳
 * @property {number} [updatedAt] - 更新时间戳
 * @property {number} [lastAccessTime] - 最后访问时间
 */

/**
 * FAQ数据
 * @typedef {Object} FaqData
 * @property {string} key - FAQ唯一标识
 * @property {string} title - 标题
 * @property {string} prompt - 提示内容
 * @property {Array<string>} [tags] - 标签列表
 * @property {number} [order] - 排序序号
 * @property {string} [id] - 旧版ID字段
 */

/**
 * 认证凭据
 * @typedef {Object} AuthCredentials
 * @property {string} username - 用户名
 * @property {string} password - 密码
 */

/**
 * 用户信息
 * @typedef {Object} UserInfo
 * @property {string} id - 用户ID
 * @property {string} username - 用户名
 * @property {string} email - 邮箱
 * @property {string} [avatar] - 头像URL
 * @property {Array<string>} [roles] - 角色列表
 * @property {number} [createdAt] - 创建时间
 * @property {number} [updatedAt] - 更新时间
 */

/**
 * 配置数据
 * @typedef {Object} ConfigData
 * @property {Object} [general] - 通用配置
 * @property {Object} [api] - API配置
 * @property {Object} [ui] - UI配置
 * @property {Object} [features] - 功能配置
 * @property {Object} [extensions] - 扩展配置
 */

/**
 * 错误信息
 * @typedef {Object} ErrorInfo
 * @property {string} type - 错误类型
 * @property {string} message - 错误消息
 * @property {string} [code] - 错误代码
 * @property {Object} [details] - 错误详情
 * @property {Object} [originalError] - 原始错误
 */

/**
 * 请求拦截器
 * @typedef {Function} RequestInterceptor
 * @param {RequestConfig} config - 请求配置
 * @returns {Promise<RequestConfig>|RequestConfig} - 修改后的请求配置
 */

/**
 * 响应拦截器
 * @typedef {Function} ResponseInterceptor
 * @param {ApiResponse} response - 响应数据
 * @returns {Promise<ApiResponse>|ApiResponse} - 修改后的响应数据
 */

/**
 * 错误处理器
 * @typedef {Function} ErrorHandler
 * @param {Error} error - 错误对象
 * @param {Object} context - 错误上下文
 * @returns {Promise<Error>|Error} - 处理后的错误
 */

/**
 * 日志级别
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 */

/**
 * 日志数据
 * @typedef {Object} LogData
 * @property {LogLevel} level - 日志级别
 * @property {string} message - 日志消息
 * @property {Object} [data] - 附加数据
 * @property {number} [timestamp] - 时间戳
 */

/**
 * 统计信息
 * @typedef {Object} ApiStats
 * @property {number} totalRequests - 总请求数
 * @property {number} successRequests - 成功请求数
 * @property {number} errorRequests - 失败请求数
 * @property {number} averageResponseTime - 平均响应时间
 * @property {number} [saveCount] - 保存次数（会话服务）
 * @property {number} [queueSize] - 队列大小（会话服务）
 */

/**
 * 数据库查询参数
 * @typedef {Object} DatabaseQueryParams
 * @property {string} cname - 集合名称
 * @property {Object} [filter] - 查询条件
 * @property {Object} [sort] - 排序条件
 * @property {number} [limit] - 限制数量
 * @property {number} [skip] - 跳过数量
 * @property {Array<string>} [projection] - 字段投影
 */

/**
 * 数据库操作结果
 * @typedef {Object} DatabaseResult
 * @property {boolean} success - 操作是否成功
 * @property {Object} [data] - 返回数据
 * @property {string} [message] - 操作消息
 * @property {Object} [error] - 错误信息
 */

/**
 * 网络错误
 * @typedef {Object} NetworkError
 * @property {string} type - 错误类型（NETWORK_ERROR）
 * @property {string} message - 错误消息
 * @property {Object} [originalError] - 原始错误
 */

/**
 * 超时错误
 * @typedef {Object} TimeoutError
 * @property {string} type - 错误类型（TIMEOUT_ERROR）
 * @property {string} message - 错误消息
 * @property {number} timeout - 超时时间
 * @property {Object} [originalError] - 原始错误
 */

/**
 * 认证错误
 * @typedef {Object} AuthError
 * @property {string} type - 错误类型（AUTH_ERROR）
 * @property {string} message - 错误消息
 * @property {number} [statusCode] - HTTP状态码
 * @property {Object} [originalError] - 原始错误
 */

/**
 * 验证错误
 * @typedef {Object} ValidationError
 * @property {string} type - 错误类型（VALIDATION_ERROR）
 * @property {string} message - 错误消息
 * @property {Object} [fields] - 字段错误信息
 * @property {Object} [originalError] - 原始错误
 */

/**
 * 限流错误
 * @typedef {Object} RateLimitError
 * @property {string} type - 错误类型（RATE_LIMIT_ERROR）
 * @property {string} message - 错误消息
 * @property {number} [retryAfter] - 重试等待时间（秒）
 * @property {Object} [originalError] - 原始错误
 */

/**
 * 服务器错误
 * @typedef {Object} ServerError
 * @property {string} type - 错误类型（SERVER_ERROR）
 * @property {string} message - 错误消息
 * @property {number} [statusCode] - HTTP状态码
 * @property {Object} [originalError] - 原始错误
 */

/**
 * 未知错误
 * @typedef {Object} UnknownError
 * @property {string} type - 错误类型（UNKNOWN_ERROR）
 * @property {string} message - 错误消息
 * @property {Object} [originalError] - 原始错误
 */

/**
 * API错误
 * @typedef {NetworkError|TimeoutError|AuthError|ValidationError|RateLimitError|ServerError|UnknownError} APIError
 */

/**
 * 服务配置选项
 * @typedef {Object} ServiceOptions
 * @property {Object} [logger] - 日志配置
 * @property {string} [logger.prefix] - 日志前缀
 * @property {string} [logger.level] - 日志级别
 * @property {number} [cacheDuration] - 缓存时间（毫秒）
 * @property {number} [timeout] - 请求超时时间（毫秒）
 * @property {number} [maxRetries] - 最大重试次数
 * @property {number} [retryDelay] - 重试延迟（毫秒）
 * @property {number} [saveBatchSize] - 批量保存大小（会话服务）
 * @property {number} [saveInterval] - 批量保存间隔（毫秒）（会话服务）
 * @property {Object} [requestInterceptors] - 请求拦截器
 * @property {Object} [responseInterceptors] - 响应拦截器
 * @property {Function} [errorHandler] - 错误处理器
 */

export default {
    // 类型定义导出（用于JSDoc引用）
    ApiConfig: undefined,
    RequestConfig: undefined,
    ApiResponse: undefined,
    PaginationParams: undefined,
    PaginatedResponse: undefined,
    SessionData: undefined,
    FaqData: undefined,
    AuthCredentials: undefined,
    UserInfo: undefined,
    ConfigData: undefined,
    ErrorInfo: undefined,
    RequestInterceptor: undefined,
    ResponseInterceptor: undefined,
    ErrorHandler: undefined,
    LogLevel: undefined,
    LogData: undefined,
    ApiStats: undefined,
    DatabaseQueryParams: undefined,
    DatabaseResult: undefined,
    NetworkError: undefined,
    TimeoutError: undefined,
    AuthError: undefined,
    ValidationError: undefined,
    RateLimitError: undefined,
    ServerError: undefined,
    UnknownError: undefined,
    APIError: undefined,
    ServiceOptions: undefined
};