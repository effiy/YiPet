/**
 * 接口请求管理器
 * 拦截和记录页面上的网络请求（fetch、XMLHttpRequest）
 * 提供清晰的 API 接口，用于管理和查看接口请求元数据
 * 
 * 性能优化版本：
 * - 异步处理响应体读取，避免阻塞主线程
 * - 延迟格式化操作，只在需要时执行
 * - 优化URL监听，减少MutationObserver负担
 * - 批量处理请求，减少数组操作频率
 * - 优化索引重建逻辑
 */

// 引入公共工具（如果可用）
let RequestUtils;
if (typeof window !== 'undefined' && window.RequestUtils) {
    RequestUtils = window.RequestUtils;
} else if (typeof require !== 'undefined') {
    try {
        RequestUtils = require('./utils/requestUtils.js');
    } catch (e) {
        RequestUtils = null;
    }
}

class ApiRequestManager {
    constructor(options = {}) {
        // 配置选项
        this.enableRecording = options.enableRecording !== false; // 是否启用记录
        this.maxRecords = options.maxRecords || 1000; // 最大记录数
        this.filterExtensionRequests = options.filterExtensionRequests !== false; // 是否过滤扩展请求
        this.enableStorageSync = options.enableStorageSync !== false; // 是否启用存储同步
        
        // 接口请求数据
        this.requests = []; // 存储所有接口请求记录（本地 + 从 storage 同步的）
        this.localRequests = []; // 仅存储当前页面本地拦截的请求
        this.currentPageUrl = window.location.href; // 当前页面URL
        
        // 去重索引：使用 Map 存储请求的唯一标识，提高查找效率
        // key: `${method}:${normalizedUrl}:${normalizedBody}:${timestampRange}`，value: 请求在数组中的索引
        this._requestIndex = new Map();
        
        // 请求去重配置
        this._deduplicationConfig = {
            timeWindow: 5000, // 5秒时间窗口（相同请求在5秒内视为重复）
            enableBodyDedup: true, // 是否基于请求体进行去重
        };
        
        // 使用公共工具或本地实现
        this._requestUtils = RequestUtils || null;
        
        // 初始化
        this._initialized = false;
        this._syncInterval = null; // 同步定时器
        this._lastSyncTime = 0; // 上次同步时间
        this._contextInvalidated = false; // 扩展上下文是否失效
        
        // 性能优化：防抖保存队列
        this._saveQueue = []; // 待保存的请求队列
        this._saveTimer = null; // 防抖定时器
        this._saveDebounceDelay = 3000; // 防抖延迟（3秒，增加以减少写入频率）
        
        // 性能优化：批量处理队列
        this._processQueue = []; // 待处理的请求队列
        this._processTimer = null; // 批量处理定时器
        this._processBatchDelay = 100; // 批量处理延迟（100ms）
        this._processBatchSize = 10; // 每批处理的请求数量
        
        // 静态资源过滤模式（不记录这些请求）
        this.staticResourcePatterns = [
            /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)$/i, // 图片
            /\.(css)$/i, // 样式表
            /\.(js)$/i, // JavaScript文件
            /\.(woff|woff2|ttf|eot|otf)$/i, // 字体
            /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i, // 媒体
            /\.(pdf|zip|rar|tar|gz)$/i, // 文件
            /favicon\.ico/i, // favicon
            /^data:/i, // data URL
            /^blob:/i, // blob URL
        ];
        
        // 重要请求模式（只记录这些）
        this.importantRequestPatterns = [
            /\/api\//i, // API路径
            /\/v\d+\//i, // API版本路径
            /\.json$/i, // JSON文件
            /application\/(json|xml)/i, // JSON/XML响应
        ];
        
        // 性能优化：使用 requestIdleCallback 或 setTimeout 作为降级
        this._scheduleAsync = this._getAsyncScheduler();
    }
    
    /**
     * 获取异步调度器（优先使用 requestIdleCallback）
     */
    _getAsyncScheduler() {
        if (typeof requestIdleCallback !== 'undefined') {
            return (callback, delay = 0) => {
                requestIdleCallback(callback, { timeout: delay });
            };
        }
        return (callback, delay = 0) => {
            setTimeout(callback, delay);
        };
    }
    
    /**
     * 初始化接口请求管理器
     */
    async initialize() {
        if (this._initialized) {
            return;
        }
        
        // 立即设置拦截器（同步操作，不等待）
        // 拦截 fetch
        this._interceptFetch();
        
        // 拦截 XMLHttpRequest
        this._interceptXHR();
        
        // 监听页面URL变化（SPA应用）
        this._watchUrlChanges();
        
        // 如果启用了存储同步，从 storage 加载请求数据
        if (this.enableStorageSync && typeof chrome !== 'undefined' && chrome.storage) {
            // 延迟加载，避免阻塞初始化
            this._scheduleAsync(async () => {
                // 在加载前检查上下文
                if (this._isContextValid()) {
                    try {
                        await this._loadRequestsFromStorage();
                    } catch (error) {
                        // 静默处理所有错误
                        if (!this._contextInvalidated && !this._isContextValid()) {
                            this._handleContextInvalidated();
                        }
                    }
                } else {
                    this._handleContextInvalidated();
                }
            }, 1000); // 延迟1秒加载
            
            // 监听 background 发送的新请求消息
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
                try {
                    // 在添加监听器前检查上下文
                    if (!this._isContextValid()) {
                        this._handleContextInvalidated();
                    } else {
                        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                            // 检查上下文是否有效
                            if (this._contextInvalidated || !this._isContextValid()) {
                                if (!this._contextInvalidated) {
                                    this._handleContextInvalidated();
                                }
                                return;
                            }
                            
                            if (request.action === 'apiRequestRecorded' && request.request) {
                                this._addRequestFromBackground(request.request);
                            }
                        });
                    }
                } catch (error) {
                    // 如果添加监听器失败，静默处理
                    this._handleContextInvalidated();
                }
            }
            
            // 性能优化：减少同步频率（每60秒同步一次）
            this._syncInterval = setInterval(() => {
                // 如果上下文已失效，清理定时器
                if (this._contextInvalidated || !this._isContextValid()) {
                    if (!this._contextInvalidated) {
                        // 如果刚刚检测到失效，先处理
                        this._handleContextInvalidated();
                    }
                    if (this._syncInterval) {
                        clearInterval(this._syncInterval);
                        this._syncInterval = null;
                    }
                    return;
                }
                // 静默调用，不捕获错误（内部已处理）
                this._loadRequestsFromStorage().catch(() => {
                    // 静默处理错误
                });
            }, 60000); // 60秒同步一次
            
            // 页面卸载前保存队列
            if (typeof window !== 'undefined') {
                window.addEventListener('beforeunload', () => {
                    this._flushSaveQueue();
                });
            }
        }
        
        this._initialized = true;
        console.log('接口请求管理器已初始化，拦截器已设置');
    }
    
    /**
     * 拦截 fetch 请求（优化版本：异步处理响应体）
     */
    _interceptFetch() {
        const self = this;
        const originalFetch = window.fetch;
        
        window.fetch = async function(...args) {
            const [url, options = {}] = args;
            const requestUrl = typeof url === 'string' ? url : url.url || url.toString();
            const method = options.method || 'GET';
            
            // 快速检查：如果是静态资源或扩展请求，直接跳过记录
            if (self.filterExtensionRequests && self._isExtensionRequest(requestUrl)) {
                return originalFetch.apply(this, args);
            }
            
            // 快速检查：如果是静态资源，直接跳过记录
            if (self._isStaticResource(requestUrl)) {
                return originalFetch.apply(this, args);
            }
            
            // 记录请求开始时间
            const startTime = Date.now();
            
            // 保存原始参数（延迟格式化）
            const rawHeaders = options.headers || {};
            const rawBody = options.body || null;
            
            try {
                // 执行原始请求
                const response = await originalFetch.apply(this, args);
                
                // 记录请求结束时间
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // 快速检查响应类型
                const contentType = response.headers.get('content-type') || '';
                
                // 如果不是重要请求，直接跳过记录
                if (!self._isImportantRequest(requestUrl, method, contentType)) {
                    return response;
                }
                
                // 异步处理响应体（不阻塞主线程）
                self._scheduleAsync(async () => {
                    try {
                        // 克隆响应以便读取body（不消耗原始响应）
                        const clonedResponse = response.clone();
                        
                        // 性能优化：只读取重要的响应内容，避免大文件导致卡死
                        let responseBody = null;
                        let responseText = null;
                        
                        // 只读取JSON和文本响应，其他类型跳过
                        if (contentType.includes('application/json') || contentType.includes('text/')) {
                            try {
                                // 先检查响应大小（通过Content-Length）
                                const contentLength = response.headers.get('content-length');
                                if (contentLength && parseInt(contentLength) > 50000) {
                                    // 响应体过大，不读取（降低阈值）
                                    responseText = '[响应体过大，已跳过]';
                                } else {
                                    if (contentType.includes('application/json')) {
                                        responseBody = await clonedResponse.json();
                                        responseText = JSON.stringify(responseBody, null, 2);
                                        // 限制JSON字符串长度（降低阈值）
                                        if (responseText.length > 50000) {
                                            responseText = responseText.substring(0, 50000) + '...[已截断]';
                                            responseBody = null;
                                        }
                                    } else if (contentType.includes('text/')) {
                                        responseText = await clonedResponse.text();
                                        // 限制文本长度（降低阈值）
                                        if (responseText.length > 50000) {
                                            responseText = responseText.substring(0, 50000) + '...[已截断]';
                                        }
                                    }
                                }
                            } catch (e) {
                                // 如果读取失败，静默处理
                                responseText = '[无法读取响应内容]';
                            }
                        } else {
                            // 非文本/JSON响应，不读取
                            responseText = '[非文本响应，已跳过]';
                        }
                        
                        // 延迟格式化（在异步任务中执行）
                        const formattedHeaders = self._formatHeaders(rawHeaders);
                        const formattedBody = self._formatBody(rawBody);
                        const formattedResponseHeaders = self._formatHeaders(response.headers);
                        
                        // 延迟生成curl（在异步任务中执行）
                        const curl = self._generateCurl(requestUrl, method, formattedHeaders, formattedBody);
                        
                        // 记录请求
                        self._recordRequest({
                            url: requestUrl,
                            method: method,
                            headers: formattedHeaders,
                            body: formattedBody,
                            status: response.status,
                            statusText: response.statusText,
                            responseHeaders: formattedResponseHeaders,
                            responseBody: responseBody,
                            responseText: responseText,
                            duration: duration,
                            timestamp: startTime,
                            type: 'fetch',
                            curl: curl
                        });
                    } catch (e) {
                        // 异步处理失败，静默处理
                    }
                }, 0);
                
                return response;
            } catch (error) {
                // 记录请求失败（异步处理）
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                self._scheduleAsync(() => {
                    try {
                        const formattedHeaders = self._formatHeaders(rawHeaders);
                        const formattedBody = self._formatBody(rawBody);
                        
                        self._recordRequest({
                            url: requestUrl,
                            method: method,
                            headers: formattedHeaders,
                            body: formattedBody,
                            status: 0,
                            statusText: 'Network Error',
                            error: error.message || error.toString(),
                            duration: duration,
                            timestamp: startTime,
                            type: 'fetch',
                            curl: self._generateCurl(requestUrl, method, formattedHeaders, formattedBody)
                        });
                    } catch (e) {
                        // 静默处理错误
                    }
                }, 0);
                
                throw error;
            }
        };
    }
    
    /**
     * 拦截 XMLHttpRequest（优化版本：异步处理响应体）
     */
    _interceptXHR() {
        const self = this;
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        
        // 存储请求信息
        const requestInfoMap = new WeakMap();
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            // 快速检查：如果是静态资源或扩展请求，直接跳过
            if (self.filterExtensionRequests && self._isExtensionRequest(url)) {
                return originalOpen.apply(this, [method, url, ...rest]);
            }
            
            if (self._isStaticResource(url)) {
                return originalOpen.apply(this, [method, url, ...rest]);
            }
            
            const requestInfo = {
                method: method,
                url: url,
                headers: {},
                body: null,
                startTime: null
            };
            requestInfoMap.set(this, requestInfo);
            
            return originalOpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            const requestInfo = requestInfoMap.get(this);
            if (requestInfo) {
                requestInfo.headers[name] = value;
            }
            return originalSetRequestHeader.apply(this, [name, value]);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            const requestInfo = requestInfoMap.get(this);
            if (!requestInfo) {
                return originalSend.apply(this, [body]);
            }
            
            requestInfo.body = body;
            requestInfo.startTime = Date.now();
            
            // 监听响应（异步处理）
            this.addEventListener('load', function() {
                const info = requestInfoMap.get(this);
                if (!info) return;
                
                const duration = Date.now() - info.startTime;
                const contentType = this.getResponseHeader('content-type') || '';
                
                // 快速检查：如果不是重要请求，直接跳过
                if (!self._isImportantRequest(info.url, info.method, contentType)) {
                    return;
                }
                
                // 异步处理响应体
                self._scheduleAsync(() => {
                    try {
                        let responseBody = null;
                        let responseText = null;
                        
                        try {
                            // 性能优化：限制响应体大小
                            if (contentType.includes('application/json')) {
                                try {
                                    const text = this.responseText;
                                    if (text && text.length > 50000) {
                                        responseText = text.substring(0, 50000) + '...[已截断]';
                                    } else {
                                        responseBody = JSON.parse(text);
                                        responseText = JSON.stringify(responseBody, null, 2);
                                        if (responseText.length > 50000) {
                                            responseText = responseText.substring(0, 50000) + '...[已截断]';
                                            responseBody = null;
                                        }
                                    }
                                } catch (e) {
                                    const text = this.responseText || '';
                                    responseText = text.length > 50000 ? text.substring(0, 50000) + '...[已截断]' : text;
                                }
                            } else if (contentType.includes('text/')) {
                                const text = this.responseText || '';
                                responseText = text.length > 50000 ? text.substring(0, 50000) + '...[已截断]' : text;
                            } else {
                                responseText = '[非文本响应，已跳过]';
                            }
                        } catch (e) {
                            responseText = '[无法读取响应内容]';
                        }
                        
                        // 获取响应头
                        const responseHeaders = {};
                        try {
                            const headerString = this.getAllResponseHeaders();
                            if (headerString) {
                                headerString.split('\r\n').forEach(line => {
                                    const [name, ...valueParts] = line.split(':');
                                    if (name && valueParts.length > 0) {
                                        responseHeaders[name.trim()] = valueParts.join(':').trim();
                                    }
                                });
                            }
                        } catch (e) {
                            // 忽略错误
                        }
                        
                        // 延迟格式化
                        const formattedHeaders = self._formatHeaders(info.headers);
                        const formattedBody = self._formatBody(info.body);
                        const formattedResponseHeaders = self._formatHeaders(responseHeaders);
                        const curl = self._generateCurl(info.url, info.method, formattedHeaders, formattedBody);
                        
                        self._recordRequest({
                            url: info.url,
                            method: info.method,
                            headers: formattedHeaders,
                            body: formattedBody,
                            status: this.status,
                            statusText: this.statusText,
                            responseHeaders: formattedResponseHeaders,
                            responseBody: responseBody,
                            responseText: responseText,
                            duration: duration,
                            timestamp: info.startTime,
                            type: 'xhr',
                            curl: curl
                        });
                    } catch (e) {
                        // 静默处理错误
                    }
                }, 0);
            });
            
            this.addEventListener('error', function() {
                const info = requestInfoMap.get(this);
                if (!info) return;
                
                const duration = Date.now() - info.startTime;
                
                // 异步处理错误记录
                self._scheduleAsync(() => {
                    try {
                        const formattedHeaders = self._formatHeaders(info.headers);
                        const formattedBody = self._formatBody(info.body);
                        
                        self._recordRequest({
                            url: info.url,
                            method: info.method,
                            headers: formattedHeaders,
                            body: formattedBody,
                            status: 0,
                            statusText: 'Network Error',
                            error: 'Request failed',
                            duration: duration,
                            timestamp: info.startTime,
                            type: 'xhr',
                            curl: self._generateCurl(info.url, info.method, formattedHeaders, formattedBody)
                        });
                    } catch (e) {
                        // 静默处理错误
                    }
                }, 0);
            });
            
            return originalSend.apply(this, [body]);
        };
    }
    
    /**
     * 监听URL变化（优化版本：使用更高效的方式）
     */
    _watchUrlChanges() {
        let lastUrl = window.location.href;
        let urlCheckTimer = null;
        
        // 使用更高效的方式：只监听 popstate 和 pushState/replaceState
        const checkUrl = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                this.currentPageUrl = currentUrl;
            }
        };
        
        // 监听 popstate 事件（浏览器前进/后退）
        window.addEventListener('popstate', checkUrl);
        
        // 拦截 pushState 和 replaceState（SPA路由变化）
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            // 延迟检查，避免频繁触发
            if (urlCheckTimer) clearTimeout(urlCheckTimer);
            urlCheckTimer = setTimeout(checkUrl, 100);
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            // 延迟检查，避免频繁触发
            if (urlCheckTimer) clearTimeout(urlCheckTimer);
            urlCheckTimer = setTimeout(checkUrl, 100);
        };
        
        // 定期检查URL（作为兜底，但频率很低）
        setInterval(checkUrl, 5000);
    }
    
    /**
     * 格式化请求头（使用公共工具）
     */
    _formatHeaders(headers) {
        return this._requestUtils ? this._requestUtils.formatHeaders(headers) : this._formatHeadersLocal(headers);
    }
    
    _formatHeadersLocal(headers) {
        if (!headers) return {};
        if (headers instanceof Headers) {
            const result = {};
            headers.forEach((value, key) => {
                result[key] = value;
            });
            return result;
        }
        if (typeof headers === 'object') {
            return { ...headers };
        }
        return {};
    }
    
    /**
     * 格式化请求体（使用公共工具）
     */
    _formatBody(body) {
        return this._requestUtils ? this._requestUtils.formatBody(body) : this._formatBodyLocal(body);
    }
    
    _formatBodyLocal(body) {
        if (!body) return null;
        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            } catch (e) {
                return body;
            }
        }
        if (body instanceof FormData) {
            const result = {};
            body.forEach((value, key) => {
                result[key] = value;
            });
            return result;
        }
        if (body instanceof URLSearchParams) {
            const result = {};
            body.forEach((value, key) => {
                result[key] = value;
            });
            return result;
        }
        return body;
    }
    
    /**
     * 生成 curl 命令（使用公共工具）
     */
    _generateCurl(url, method, headers, body) {
        return this._requestUtils ? 
            this._requestUtils.generateCurl(url, method, headers, body) : 
            this._generateCurlLocal(url, method, headers, body);
    }
    
    _generateCurlLocal(url, method, headers, body) {
        let curl = `curl -X ${method}`;
        if (headers && typeof headers === 'object') {
            Object.entries(headers).forEach(([key, value]) => {
                curl += ` \\\n  -H "${key}: ${value}"`;
            });
        }
        if (body) {
            if (typeof body === 'string') {
                curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
            } else if (typeof body === 'object') {
                curl += ` \\\n  -d '${JSON.stringify(body).replace(/'/g, "\\'")}'`;
            }
        }
        curl += ` \\\n  "${url}"`;
        return curl;
    }
    
    /**
     * 检查是否是扩展请求（使用公共工具）
     */
    _isExtensionRequest(url) {
        return this._requestUtils ? 
            this._requestUtils.isExtensionRequest(url) : 
            this._isExtensionRequestLocal(url);
    }
    
    _isExtensionRequestLocal(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        const extensionUrlPatterns = [
            /^chrome-extension:\/\//i,
            /^chrome:\/\//i,
            /^moz-extension:\/\//i,
            /api\.effiy\.cn/i,
        ];
        for (const pattern of extensionUrlPatterns) {
            if (pattern.test(url)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 检查是否是静态资源请求（不重要的请求）
     * @param {string} url - 请求URL
     * @param {string} contentType - 响应Content-Type
     * @returns {boolean} 是否是静态资源
     */
    _isStaticResource(url, contentType = '') {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        // 检查URL是否匹配静态资源模式
        for (const pattern of this.staticResourcePatterns) {
            if (pattern.test(url)) {
                return true;
            }
        }
        
        // 检查Content-Type
        if (contentType) {
            const staticContentTypes = [
                /^image\//i,
                /^text\/css/i,
                /^(text|application)\/(javascript|ecmascript|x-javascript)/i, // JavaScript
                /^font\//i,
                /^video\//i,
                /^audio\//i,
                /^application\/(pdf|zip|rar|tar|gz)/i,
            ];
            for (const pattern of staticContentTypes) {
                if (pattern.test(contentType)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 检查是否是重要的API请求
     * @param {string} url - 请求URL
     * @param {string} method - 请求方法
     * @param {string} contentType - 响应Content-Type
     * @returns {boolean} 是否是重要请求
     */
    _isImportantRequest(url, method = 'GET', contentType = '') {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        // POST/PUT/PATCH/DELETE 请求通常是重要的
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
            return true;
        }
        
        // 检查URL是否匹配重要请求模式
        for (const pattern of this.importantRequestPatterns) {
            if (pattern.test(url)) {
                return true;
            }
        }
        
        // 检查Content-Type是否是API响应
        if (contentType) {
            if (/application\/(json|xml)/i.test(contentType)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 从URL提取域名
     * @param {string} url - 请求URL
     * @returns {string} 域名
     */
    _extractDomain(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        
        try {
            // 处理相对URL
            if (url.startsWith('//')) {
                url = 'https:' + url;
            } else if (url.startsWith('/')) {
                // 相对路径，使用当前页面的域名
                url = window.location.origin + url;
            }
            
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            // 如果URL解析失败，尝试使用正则表达式提取
            const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?:]+)/i);
            if (match && match[1]) {
                return match[1];
            }
            return '';
        }
    }
    
    /**
     * 记录请求（只记录重要的API请求，使用批量处理）
     */
    _recordRequest(request) {
        if (!this.enableRecording) {
            return;
        }
        
        // 如果启用了过滤扩展请求，则跳过扩展相关的请求
        if (this.filterExtensionRequests && this._isExtensionRequest(request.url)) {
            return;
        }
        
        // 性能优化：只记录重要的API请求，过滤静态资源
        const contentType = request.responseHeaders?.['content-type'] || 
                          request.responseHeaders?.['Content-Type'] || '';
        
        // 如果是静态资源，直接跳过
        if (this._isStaticResource(request.url, contentType)) {
            return;
        }
        
        // 如果不是重要请求，也跳过
        if (!this._isImportantRequest(request.url, request.method, contentType)) {
            return;
        }
        
        // 更新当前页面URL（确保是最新的）
        this.currentPageUrl = window.location.href;
        
        // 添加当前页面URL（同时保存原始URL和规范化URL）
        request.pageUrl = this.currentPageUrl;
        request.normalizedPageUrl = this._normalizeUrl(this.currentPageUrl);
        request.source = 'local'; // 标记为本地请求
        
        // 自动提取域名并添加为标签
        if (request.url) {
            const domain = this._extractDomain(request.url);
            if (domain) {
                // 如果请求还没有tags字段，初始化为空数组
                if (!request.tags || !Array.isArray(request.tags)) {
                    request.tags = [];
                }
                // 如果域名标签不存在，则添加
                if (!request.tags.includes(domain)) {
                    request.tags.push(domain);
                }
            }
        }
        
        // 性能优化：限制响应体大小，避免大文件导致卡死
        if (request.responseText && request.responseText.length > 50000) {
            request.responseText = request.responseText.substring(0, 50000) + '...[响应体过大，已截断]';
            request.responseBody = null; // 大响应体不解析JSON
        }
        
        // 添加到批量处理队列
        this._processQueue.push(request);
        
        // 触发批量处理（防抖）
        if (this._processTimer) {
            clearTimeout(this._processTimer);
        }
        
        this._processTimer = setTimeout(() => {
            this._processBatch();
        }, this._processBatchDelay);
    }
    
    /**
     * 批量处理请求队列
     */
    _processBatch() {
        if (this._processQueue.length === 0) {
            return;
        }
        
        // 取出队列中的请求（限制数量）
        const requestsToProcess = this._processQueue.splice(0, this._processBatchSize);
        this._processTimer = null;
        
        // 批量处理
        for (const request of requestsToProcess) {
            try {
                // 添加到本地请求列表
                this.localRequests.push(request);
                
                // 合并到总请求列表（去重）
                this._mergeRequest(request);
                
                // 限制本地请求数量
                if (this.localRequests.length > this.maxRecords) {
                    this.localRequests.shift();
                }
                
                // 性能优化：使用防抖机制批量保存到 storage
                if (this.enableStorageSync && !this._contextInvalidated && typeof chrome !== 'undefined' && chrome.storage) {
                    this._queueSaveRequest(request);
                }
                
                // 触发自定义事件，通知UI更新（异步）
                if (typeof window !== 'undefined') {
                    this._scheduleAsync(() => {
                        try {
                            window.dispatchEvent(new CustomEvent('apiRequestRecorded', {
                                detail: request
                            }));
                        } catch (e) {
                            // 静默处理事件触发错误
                        }
                    }, 0);
                }
            } catch (e) {
                // 静默处理单个请求的错误
            }
        }
        
        // 如果还有待处理的请求，继续处理
        if (this._processQueue.length > 0) {
            this._processTimer = setTimeout(() => {
                this._processBatch();
            }, this._processBatchDelay);
        }
    }
    
    /**
     * 将请求加入保存队列（防抖机制）
     */
    _queueSaveRequest(request) {
        // 添加到队列
        this._saveQueue.push(request);
        
        // 清除之前的定时器
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
        }
        
        // 设置新的定时器（防抖）
        this._saveTimer = setTimeout(() => {
            this._flushSaveQueue();
        }, this._saveDebounceDelay);
    }
    
    /**
     * 批量保存队列中的请求
     */
    async _flushSaveQueue() {
        if (this._saveQueue.length === 0) {
            return;
        }
        
        // 取出队列中的所有请求
        const requestsToSave = [...this._saveQueue];
        this._saveQueue = [];
        this._saveTimer = null;
        
        // 批量保存（只保存最新的请求，避免重复）
        if (requestsToSave.length > 0) {
            try {
                // 只保存最后一个请求（最新的），避免频繁写入
                const latestRequest = requestsToSave[requestsToSave.length - 1];
                await this._saveRequestToStorage(latestRequest);
            } catch (e) {
                // 静默处理保存错误
            }
        }
    }
    
    /**
     * 从 background 添加请求（来自其他标签页）
     */
    _addRequestFromBackground(request) {
        // 如果启用了过滤扩展请求，则跳过扩展相关的请求
        if (this.filterExtensionRequests && this._isExtensionRequest(request.url)) {
            return;
        }
        
        // 标记为来自 background
        request.source = 'background';
        
        // 自动提取域名并添加为标签（如果还没有标签）
        if (request.url && (!request.tags || !Array.isArray(request.tags) || request.tags.length === 0)) {
            const domain = this._extractDomain(request.url);
            if (domain) {
                request.tags = [domain];
            }
        }
        
        // 合并到总请求列表（去重）
        this._mergeRequest(request);
        
        // 触发自定义事件，通知UI更新（异步）
        if (typeof window !== 'undefined') {
            this._scheduleAsync(() => {
                try {
                    window.dispatchEvent(new CustomEvent('apiRequestRecorded', {
                        detail: request
                    }));
                } catch (e) {
                    // 静默处理错误
                }
            }, 0);
        }
    }
    
    /**
     * 规范化对象（排序键，确保相同对象生成相同的字符串）
     * @param {*} obj - 要规范化的对象
     * @returns {string} 规范化后的字符串
     */
    _normalizeObjectForDedup(obj) {
        if (obj === null || obj === undefined) {
            return '';
        }
        
        // 如果是字符串，尝试解析为JSON
        if (typeof obj === 'string') {
            try {
                obj = JSON.parse(obj);
            } catch (e) {
                // 如果不是JSON，直接返回（截断过长字符串）
                return obj.length > 100 ? obj.substring(0, 100) : obj;
            }
        }
        
        // 如果是对象，递归排序键
        if (typeof obj === 'object') {
            if (Array.isArray(obj)) {
                // 数组：只取前10个元素，避免过大
                const limitedArray = obj.slice(0, 10).map(item => this._normalizeObjectForDedup(item));
                return JSON.stringify(limitedArray);
            }
            
            // 对象：排序键后序列化（只取前20个键，避免过大）
            const sortedKeys = Object.keys(obj).sort().slice(0, 20);
            const normalized = {};
            for (const key of sortedKeys) {
                normalized[key] = this._normalizeObjectForDedup(obj[key]);
            }
            return JSON.stringify(normalized);
        }
        
        return String(obj);
    }
    
    /**
     * 生成请求的唯一标识符（用于去重，优化版）
     * @param {Object} request - 请求对象
     * @returns {string} 唯一标识符
     */
    _generateRequestKey(request) {
        if (!request || !request.url || !request.method) {
            return null;
        }
        
        // 规范化URL（移除query参数和hash，用于去重）
        const normalizedUrl = this._normalizeUrl(request.url);
        const method = (request.method || 'GET').toUpperCase();
        
        // 规范化请求体（如果启用基于body的去重）
        let normalizedBody = '';
        if (this._deduplicationConfig.enableBodyDedup && request.body) {
            normalizedBody = this._normalizeObjectForDedup(request.body);
            // 限制body字符串长度，避免key过长
            if (normalizedBody.length > 200) {
                normalizedBody = normalizedBody.substring(0, 200);
            }
        }
        
        // 对于相同URL和方法的请求，如果时间戳在时间窗口内，视为重复请求
        // 将时间戳向下取整到时间窗口区间
        const timestamp = request.timestamp || Date.now();
        const timeWindow = this._deduplicationConfig.timeWindow;
        const timeRange = Math.floor(timestamp / timeWindow);
        
        // 生成key：method:url:body:timeRange
        return `${method}:${normalizedUrl}:${normalizedBody}:${timeRange}`;
    }
    
    /**
     * 合并请求到总列表（去重，优化版）
     * 优化后的去重逻辑：使用 Map 索引提高查找效率，优化索引维护策略
     */
    _mergeRequest(request) {
        // 验证请求对象是否有效
        if (!request || typeof request !== 'object') {
            return; // 无效请求，静默舍弃
        }
        
        // 验证必要的属性是否存在
        if (!request.url || !request.method) {
            return; // 缺少必要属性，静默舍弃
        }
        
        try {
            // 生成请求的唯一标识符
            const requestKey = this._generateRequestKey(request);
            if (!requestKey) {
                return; // 无法生成key，静默舍弃
            }
            
            // 使用 Map 索引快速查找是否已存在相同请求
            const existingIndex = this._requestIndex.get(requestKey);
            
            if (existingIndex !== undefined && existingIndex >= 0 && existingIndex < this.requests.length) {
                // 已存在相同请求，检查是否需要更新（保留最新的请求）
                const existingRequest = this.requests[existingIndex];
                
                // 保护API数据：如果现有请求是API数据（有_id或key），而新请求不是API数据，不覆盖
                const existingIsApiData = !!(existingRequest._id || existingRequest.key);
                const newIsApiData = !!(request._id || request.key);
                
                if (existingIsApiData && !newIsApiData) {
                    // 现有请求是API数据，新请求不是，保留API数据，不更新
                    return;
                }
                
                if (existingRequest && existingRequest.timestamp < request.timestamp) {
                    // 新请求时间戳更大，更新为最新请求
                    // 但如果现有请求是API数据，而新请求不是，仍然保留API数据
                    if (!(existingIsApiData && !newIsApiData)) {
                        this.requests[existingIndex] = request;
                    }
                }
                // 如果新请求时间戳更小或相等，保留原有请求，不更新
                return;
            }
            
            // 不存在相同请求，添加新请求
            const newIndex = this.requests.length;
            this.requests.push(request);
            
            // 更新索引
            this._requestIndex.set(requestKey, newIndex);
            
            // 限制总请求数量（优化：使用更高效的索引维护策略）
            if (this.requests.length > this.maxRecords) {
                // 移除最旧的请求
                const removedRequest = this.requests.shift();
                
                // 优化索引维护策略：
                // 1. 如果索引大小超过阈值，重建索引（更准确）
                // 2. 否则，只更新受影响的索引项
                const indexSizeThreshold = this.maxRecords * 0.6; // 60%阈值
                
                if (this._requestIndex.size > indexSizeThreshold) {
                    // 索引过大，重建索引（更准确，但稍慢）
                    this._rebuildIndex();
                } else {
                    // 只更新受影响的索引：删除被移除请求的索引，其他索引减1
                    if (removedRequest) {
                        const removedKey = this._generateRequestKey(removedRequest);
                        if (removedKey) {
                            this._requestIndex.delete(removedKey);
                        }
                    }
                    
                    // 更新所有索引（减1），但使用更高效的方式
                    // 只遍历需要更新的索引（index > 0）
                    const keysToUpdate = [];
                    for (const [key, index] of this._requestIndex.entries()) {
                        if (index > 0) {
                            keysToUpdate.push({ key, index });
                        }
                    }
                    
                    // 批量更新索引
                    for (const { key, index } of keysToUpdate) {
                        this._requestIndex.set(key, index - 1);
                    }
                }
            }
        } catch (e) {
            // 合并请求时出错，静默舍弃
            console.debug('[ApiRequestManager] 合并请求时出错:', e);
        }
    }
    
    /**
     * 重建请求索引（当数组发生变化时调用）
     * 优化：只在必要时调用，使用更高效的策略
     */
    _rebuildIndex() {
        const startTime = performance.now();
        this._requestIndex.clear();
        
        // 重新建立索引（从后往前遍历，保留最新的请求索引）
        for (let i = this.requests.length - 1; i >= 0; i--) {
            const request = this.requests[i];
            if (request) {
                const key = this._generateRequestKey(request);
                if (key) {
                    // 从后往前遍历，如果key已存在，会被后面的（更新的）请求覆盖
                    // 这样保证索引指向的是最新的请求
                    this._requestIndex.set(key, i);
                }
            }
        }
        
        const duration = performance.now() - startTime;
        if (duration > 10) {
            console.debug(`[ApiRequestManager] 重建索引耗时: ${duration.toFixed(2)}ms, 索引大小: ${this._requestIndex.size}`);
        }
    }
    
    /**
     * 检查扩展上下文是否有效
     * @returns {boolean} 上下文是否有效
     */
    _isContextValid() {
        try {
            // 如果已经标记为失效，直接返回 false
            if (this._contextInvalidated) {
                return false;
            }
            
            // 检查 chrome 对象是否存在
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                return false;
            }
            
            // 尝试访问 chrome.runtime.id 来检查上下文是否有效
            // 如果上下文失效，访问 id 会抛出异常
            try {
                const id = chrome.runtime.id;
                // 如果 id 不存在或为空，上下文无效
                if (!id) {
                    return false;
                }
            } catch (e) {
                // 如果访问 id 时抛出异常，上下文已失效
                return false;
            }
            
            // 所有检查都通过，上下文有效
            return true;
        } catch (error) {
            // 如果抛出任何错误，说明上下文已失效
            return false;
        }
    }
    
    /**
     * 处理扩展上下文失效
     */
    _handleContextInvalidated() {
        if (this._contextInvalidated) {
            return; // 已经处理过了
        }
        
        this._contextInvalidated = true;
        this.enableStorageSync = false; // 禁用存储同步
        
        // 清理同步定时器
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
    }

    /**
     * 确保扩展上下文有效；若无效则统一标记失效并返回 false
     * 所有错误都静默处理
     * @returns {boolean}
     */
    _ensureContext() {
        try {
            if (!this._isContextValid()) {
                this._handleContextInvalidated();
                return false;
            }
            return true;
        } catch (e) {
            try { this._handleContextInvalidated(); } catch (_) {}
            return false;
        }
    }

    /**
     * 安全读取 chrome.storage.local
     * - 上下文失效/运行时错误会返回 fallback
     * - 所有错误静默处理
     * @param {string[]} keys
     * @param {Object} fallback
     * @returns {Promise<Object>}
     */
    async _storageLocalGetSafe(keys, fallback) {
        // 快速检查
        if (this._contextInvalidated || typeof chrome === 'undefined' || !chrome?.storage?.local) {
            return fallback;
        }
        if (!this._ensureContext()) {
            return fallback;
        }

        try {
            const result = await new Promise((resolve) => {
                try {
                    if (!this._ensureContext()) {
                        resolve(fallback);
                        return;
                    }
                    chrome.storage.local.get(keys, (items) => {
                        try {
                            if (chrome.runtime?.lastError) {
                                this._handleContextInvalidated();
                                resolve(fallback);
                                return;
                            }
                            resolve(items || fallback);
                        } catch (e) {
                            try { this._handleContextInvalidated(); } catch (_) {}
                            resolve(fallback);
                        }
                    });
                } catch (e) {
                    try { this._handleContextInvalidated(); } catch (_) {}
                    resolve(fallback);
                }
            });
            return result || fallback;
        } catch (e) {
            return fallback;
        }
    }

    /**
     * 安全写入 chrome.storage.local
     * 所有错误静默处理
     * @param {Object} data
     * @returns {Promise<void>}
     */
    async _storageLocalSetSafe(data) {
        if (this._contextInvalidated || typeof chrome === 'undefined' || !chrome?.storage?.local) {
            return;
        }
        if (!this._ensureContext()) {
            return;
        }

        try {
            await new Promise((resolve) => {
                try {
                    if (!this._ensureContext()) {
                        resolve();
                        return;
                    }
                    chrome.storage.local.set(data, () => {
                        try {
                            if (chrome.runtime?.lastError) {
                                this._handleContextInvalidated();
                            }
                        } catch (e) {
                            try { this._handleContextInvalidated(); } catch (_) {}
                        }
                        resolve();
                    });
                } catch (e) {
                    try { this._handleContextInvalidated(); } catch (_) {}
                    resolve();
                }
            });
        } catch (e) {
            // 静默处理
        }
    }
    
    /**
     * 从 storage 加载请求数据
     * 所有错误都静默处理，不输出任何错误日志
     */
    async _loadRequestsFromStorage() {
        // 快速检查：如果上下文已失效或 chrome.storage 不可用，直接返回
        if (this._contextInvalidated || typeof chrome === 'undefined' || !chrome?.storage?.local) {
            return;
        }

        // 整个方法用 try-catch 包裹，确保所有错误都被静默处理
        try {
            if (!this._ensureContext()) {
                return;
            }

            // 从 storage 获取数据（安全版本）
            const result = await this._storageLocalGetSafe(['apiRequests'], { apiRequests: [] });

            // 读取完成后再次确认上下文（避免执行期间失效）
            if (!this._ensureContext()) {
                return;
            }
            
            // 安全地解析存储数据，确保始终是数组
            let storageRequests = [];
            try {
                if (result?.apiRequests && Array.isArray(result.apiRequests)) {
                    storageRequests = result.apiRequests;
                }
            } catch (e) {
                // 数据格式错误，静默舍弃
                storageRequests = [];
            }
            
            // 合并请求到总列表（优化：批量处理，避免频繁重建索引）
            if (storageRequests.length > 0) {
                try {
                    // 先清空索引，准备重建
                    this._requestIndex.clear();
                    
                    // 批量处理请求
                    const batchSize = 50; // 每批处理50个
                    for (let i = 0; i < storageRequests.length; i += batchSize) {
                        const batch = storageRequests.slice(i, i + batchSize);
                        for (const request of batch) {
                            try {
                                // 验证并处理请求对象
                                if (request && typeof request === 'object' && request.url && request.method) {
                                    if (request.source !== 'local') {
                                        request.source = 'background';
                                    }
                                    // 使用合并方法（会自动去重）
                                    this._mergeRequest(request);
                                }
                            } catch (e) {
                                // 单个请求处理失败，静默跳过
                            }
                        }
                        
                        // 每批处理后，让出主线程
                        if (i + batchSize < storageRequests.length) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                    
                    // 确保索引正确（重建索引）
                    this._rebuildIndex();
                    
                    // 输出同步日志（仅在成功时，且降低频率）
                    try {
                        const now = Date.now();
                        if (now - this._lastSyncTime > 30000) {
                            console.log('[ApiRequestManager] 从 storage 同步请求数据:', {
                                storageCount: storageRequests.length,
                                totalCount: this.requests.length,
                                localCount: this.localRequests.length,
                                uniqueCount: this._requestIndex.size
                            });
                            this._lastSyncTime = now;
                        }
                    } catch (e) {
                        // 日志输出失败，静默处理
                    }
                } catch (e) {
                    // 处理请求时出错，静默处理
                }
            }
        } catch (error) {
            // 所有错误都静默处理，不输出任何错误日志
            try {
                this._handleContextInvalidated();
            } catch (e) {
                // 即使处理错误时出错，也静默处理
            }
        }
    }
    
    /**
     * 保存请求到 storage（仅保存本地请求）
     * 所有错误都静默处理，不输出任何错误日志
     */
    async _saveRequestToStorage(request) {
        // 快速检查：如果上下文已失效或 chrome.storage 不可用，直接返回
        if (this._contextInvalidated || typeof chrome === 'undefined' || !chrome?.storage?.local) {
            return;
        }

        // 整个方法用 try-catch 包裹，确保所有错误都被静默处理
        try {
            if (!this._ensureContext()) {
                return;
            }

            // 获取当前存储的请求列表（安全版本）
            const result = await this._storageLocalGetSafe(['apiRequests'], { apiRequests: [] });

            // 读取完成后再次确认上下文（避免执行期间失效）
            if (!this._ensureContext()) {
                return;
            }
            
            // 安全地获取存储的请求列表
            let storageRequests = [];
            try {
                if (result?.apiRequests && Array.isArray(result.apiRequests)) {
                    storageRequests = result.apiRequests;
                }
            } catch (e) {
                // 数据格式错误，静默舍弃
                storageRequests = [];
            }
            
            // 添加新请求并限制数量
            try {
                storageRequests.push(request);
                if (storageRequests.length > this.maxRecords) {
                    storageRequests = storageRequests.slice(-this.maxRecords);
                }
            } catch (e) {
                // 处理请求时出错，静默处理
                return;
            }
            
            // 保存到 storage（安全版本）
            await this._storageLocalSetSafe({ apiRequests: storageRequests });
        } catch (error) {
            // 所有错误都静默处理，不输出任何错误日志
            try {
                this._handleContextInvalidated();
            } catch (e) {
                // 即使处理错误时出错，也静默处理
            }
        }
    }
    
    /**
     * 规范化URL（使用公共工具）
     */
    _normalizeUrl(url) {
        return this._requestUtils ? 
            this._requestUtils.normalizeUrl(url) : 
            this._normalizeUrlLocal(url);
    }
    
    _normalizeUrlLocal(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        try {
            const urlObj = new URL(url);
            return `${urlObj.origin}${urlObj.pathname}`;
        } catch (e) {
            const hashIndex = url.indexOf('#');
            const queryIndex = url.indexOf('?');
            let endIndex = url.length;
            if (hashIndex !== -1) {
                endIndex = Math.min(endIndex, hashIndex);
            }
            if (queryIndex !== -1) {
                endIndex = Math.min(endIndex, queryIndex);
            }
            return url.substring(0, endIndex);
        }
    }
    
    /**
     * 获取所有请求记录
     * @param {string} pageUrl - 可选，过滤特定页面的请求
     * @returns {Array} 请求记录列表
     */
    getAllRequests(pageUrl = null) {
        if (pageUrl) {
            const normalizedPageUrl = this._normalizeUrl(pageUrl);
            return this.requests.filter(req => {
                const normalizedReqUrl = this._normalizeUrl(req.pageUrl);
                return normalizedReqUrl === normalizedPageUrl;
            });
        }
        return [...this.requests];
    }
    
    /**
     * 获取当前页面的请求记录
     * @returns {Array} 请求记录列表
     */
    getCurrentPageRequests() {
        // 更新当前页面URL（确保是最新的）
        this.currentPageUrl = window.location.href;
        
        // 获取匹配的请求
        const matchedRequests = this.getAllRequests(this.currentPageUrl);
        
        // 如果匹配的请求为空，但总请求数不为空，返回所有请求
        // 这样可以确保用户能看到请求记录（可能是URL匹配问题）
        if (matchedRequests.length === 0 && this.requests.length > 0) {
            // 返回所有请求，让用户能看到
            return [...this.requests];
        }
        
        return matchedRequests;
    }
    
    /**
     * 清空所有请求记录
     */
    clearAllRequests() {
        this.requests = [];
        this.localRequests = [];
        this._requestIndex.clear(); // 清空索引
        
        // 如果启用了存储同步且上下文有效，也清空 storage
        if (this.enableStorageSync && !this._contextInvalidated && typeof chrome !== 'undefined' && chrome.storage) {
            try {
                if (this._isContextValid()) {
                    chrome.storage.local.set({ apiRequests: [] }, () => {
                        if (!chrome.runtime.lastError) {
                            console.log('[ApiRequestManager] 已清空 storage 中的请求数据');
                        }
                    });
                }
            } catch (error) {
                // 忽略错误
            }
        }
    }
    
    /**
     * 销毁管理器（清理定时器等资源）
     */
    destroy() {
        // 清理同步定时器
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
        
        // 清理防抖定时器
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        
        // 清理批量处理定时器
        if (this._processTimer) {
            clearTimeout(this._processTimer);
            this._processTimer = null;
        }
        
        // 清空保存队列
        this._saveQueue = [];
        this._processQueue = [];
    }
    
    /**
     * 清空当前页面的请求记录
     */
    clearCurrentPageRequests() {
        this.requests = this.requests.filter(req => req.pageUrl !== this.currentPageUrl);
        // 重建索引
        this._rebuildIndex();
    }
    
    /**
     * 搜索请求
     * @param {string} query - 搜索关键词
     * @param {number} limit - 返回数量限制
     * @returns {Array} 搜索结果
     */
    searchRequests(query, limit = 50) {
        if (!query) {
            return [];
        }
        
        const queryLower = query.toLowerCase();
        const results = this.getAllRequests().filter(req => {
            const url = (req.url || '').toLowerCase();
            const method = (req.method || '').toLowerCase();
            const status = String(req.status || '');
            return url.includes(queryLower) || 
                   method.includes(queryLower) ||
                   status.includes(queryLower);
        }).slice(0, limit);
        
        return results;
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = ApiRequestManager;
} else {
    window.ApiRequestManager = ApiRequestManager;
}
