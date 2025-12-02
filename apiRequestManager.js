/**
 * 接口请求管理器
 * 拦截和记录页面上的网络请求（fetch、XMLHttpRequest）
 * 提供清晰的 API 接口，用于管理和查看接口请求元数据
 */

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
        
        // 扩展相关的URL模式（用于过滤）
        this.extensionUrlPatterns = [
            /^chrome-extension:\/\//i,
            /^chrome:\/\//i,
            /^moz-extension:\/\//i,
            /api\.effiy\.cn/i, // 扩展使用的API域名
        ];
        
        // 初始化
        this._initialized = false;
        this._syncInterval = null; // 同步定时器
        this._lastSyncTime = 0; // 上次同步时间
        this._contextInvalidated = false; // 扩展上下文是否失效
        
        // 性能优化：防抖保存队列
        this._saveQueue = []; // 待保存的请求队列
        this._saveTimer = null; // 防抖定时器
        this._saveDebounceDelay = 2000; // 防抖延迟（2秒）
        
        // 静态资源过滤模式（不记录这些请求）
        this.staticResourcePatterns = [
            /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)$/i, // 图片
            /\.(css)$/i, // 样式表
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
            
            // 性能优化：减少同步频率（每30秒同步一次，而不是5秒）
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
            }, 30000); // 30秒同步一次
            
            // 页面卸载前保存队列
            if (typeof window !== 'undefined') {
                window.addEventListener('beforeunload', () => {
                    this._flushSaveQueue();
                });
            }
        }
        
        this._initialized = true;
        console.log('接口请求管理器已初始化，拦截器已设置');
        
        // 输出当前状态用于调试
        console.log('当前页面URL:', this.currentPageUrl);
        console.log('是否启用记录:', this.enableRecording);
        console.log('是否过滤扩展请求:', this.filterExtensionRequests);
        console.log('是否启用存储同步:', this.enableStorageSync);
    }
    
    /**
     * 拦截 fetch 请求
     */
    _interceptFetch() {
        const self = this;
        const originalFetch = window.fetch;
        
        window.fetch = async function(...args) {
            const [url, options = {}] = args;
            const requestUrl = typeof url === 'string' ? url : url.url || url.toString();
            const method = options.method || 'GET';
            const headers = options.headers || {};
            const body = options.body || null;
            
            // 记录请求开始时间
            const startTime = Date.now();
            
            try {
                // 执行原始请求
                const response = await originalFetch.apply(this, args);
                
                // 记录请求结束时间
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // 克隆响应以便读取body（不消耗原始响应）
                const clonedResponse = response.clone();
                
                // 性能优化：只读取重要的响应内容，避免大文件导致卡死
                let responseBody = null;
                let responseText = null;
                const contentType = response.headers.get('content-type') || '';
                
                // 只读取JSON和文本响应，其他类型跳过
                if (contentType.includes('application/json') || contentType.includes('text/')) {
                    try {
                        // 先检查响应大小（通过Content-Length）
                        const contentLength = response.headers.get('content-length');
                        if (contentLength && parseInt(contentLength) > 100000) {
                            // 响应体过大，不读取
                            responseText = '[响应体过大，已跳过]';
                        } else {
                            if (contentType.includes('application/json')) {
                                responseBody = await clonedResponse.json();
                                responseText = JSON.stringify(responseBody, null, 2);
                                // 限制JSON字符串长度
                                if (responseText.length > 100000) {
                                    responseText = responseText.substring(0, 100000) + '...[已截断]';
                                    responseBody = null;
                                }
                            } else if (contentType.includes('text/')) {
                                responseText = await clonedResponse.text();
                                // 限制文本长度
                                if (responseText.length > 100000) {
                                    responseText = responseText.substring(0, 100000) + '...[已截断]';
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
                
                // 记录请求
                self._recordRequest({
                    url: requestUrl,
                    method: method,
                    headers: self._formatHeaders(headers),
                    body: self._formatBody(body),
                    status: response.status,
                    statusText: response.statusText,
                    responseHeaders: self._formatHeaders(response.headers),
                    responseBody: responseBody,
                    responseText: responseText,
                    duration: duration,
                    timestamp: startTime,
                    type: 'fetch',
                    curl: self._generateCurl(requestUrl, method, headers, body)
                });
                
                return response;
            } catch (error) {
                // 记录请求失败
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                self._recordRequest({
                    url: requestUrl,
                    method: method,
                    headers: self._formatHeaders(headers),
                    body: self._formatBody(body),
                    status: 0,
                    statusText: 'Network Error',
                    error: error.message || error.toString(),
                    duration: duration,
                    timestamp: startTime,
                    type: 'fetch',
                    curl: self._generateCurl(requestUrl, method, headers, body)
                });
                
                throw error;
            }
        };
    }
    
    /**
     * 拦截 XMLHttpRequest
     */
    _interceptXHR() {
        const self = this;
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        
        // 存储请求信息
        const requestInfoMap = new WeakMap();
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
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
            if (requestInfo) {
                requestInfo.body = body;
                requestInfo.startTime = Date.now();
            }
            
            // 监听响应
            this.addEventListener('load', function() {
                const info = requestInfoMap.get(this);
                if (info) {
                    const duration = Date.now() - info.startTime;
                    let responseBody = null;
                    let responseText = null;
                    
                    try {
                        const contentType = this.getResponseHeader('content-type') || '';
                        // 性能优化：限制响应体大小
                        if (contentType.includes('application/json')) {
                            try {
                                const text = this.responseText;
                                if (text && text.length > 100000) {
                                    responseText = text.substring(0, 100000) + '...[已截断]';
                                } else {
                                    responseBody = JSON.parse(text);
                                    responseText = JSON.stringify(responseBody, null, 2);
                                    if (responseText.length > 100000) {
                                        responseText = responseText.substring(0, 100000) + '...[已截断]';
                                        responseBody = null;
                                    }
                                }
                            } catch (e) {
                                const text = this.responseText || '';
                                responseText = text.length > 100000 ? text.substring(0, 100000) + '...[已截断]' : text;
                            }
                        } else if (contentType.includes('text/')) {
                            const text = this.responseText || '';
                            responseText = text.length > 100000 ? text.substring(0, 100000) + '...[已截断]' : text;
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
                    
                    self._recordRequest({
                        url: info.url,
                        method: info.method,
                        headers: self._formatHeaders(info.headers),
                        body: self._formatBody(info.body),
                        status: this.status,
                        statusText: this.statusText,
                        responseHeaders: self._formatHeaders(responseHeaders),
                        responseBody: responseBody,
                        responseText: responseText,
                        duration: duration,
                        timestamp: info.startTime,
                        type: 'xhr',
                        curl: self._generateCurl(info.url, info.method, info.headers, info.body)
                    });
                }
            });
            
            this.addEventListener('error', function() {
                const info = requestInfoMap.get(this);
                if (info) {
                    const duration = Date.now() - info.startTime;
                    self._recordRequest({
                        url: info.url,
                        method: info.method,
                        headers: self._formatHeaders(info.headers),
                        body: self._formatBody(info.body),
                        status: 0,
                        statusText: 'Network Error',
                        error: 'Request failed',
                        duration: duration,
                        timestamp: info.startTime,
                        type: 'xhr',
                        curl: self._generateCurl(info.url, info.method, info.headers, info.body)
                    });
                }
            });
            
            return originalSend.apply(this, [body]);
        };
    }
    
    /**
     * 监听URL变化（用于SPA应用）
     */
    _watchUrlChanges() {
        let lastUrl = window.location.href;
        
        // 使用 MutationObserver 监听DOM变化
        const observer = new MutationObserver(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                this.currentPageUrl = currentUrl;
                // 可以在这里清空当前页面的请求记录，或者保留
                console.log('页面URL已变化:', currentUrl);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 监听 popstate 事件（浏览器前进/后退）
        window.addEventListener('popstate', () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                this.currentPageUrl = currentUrl;
                console.log('页面URL已变化（popstate）:', currentUrl);
            }
        });
    }
    
    /**
     * 格式化请求头
     */
    _formatHeaders(headers) {
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
     * 格式化请求体
     */
    _formatBody(body) {
        if (!body) return null;
        
        if (typeof body === 'string') {
            try {
                // 尝试解析为JSON
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
     * 生成 curl 命令
     */
    _generateCurl(url, method, headers, body) {
        let curl = `curl -X ${method}`;
        
        // 添加请求头
        if (headers && typeof headers === 'object') {
            Object.entries(headers).forEach(([key, value]) => {
                curl += ` \\\n  -H "${key}: ${value}"`;
            });
        }
        
        // 添加请求体
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
     * 检查是否是扩展请求
     * @param {string} url - 请求URL
     * @returns {boolean} 是否是扩展请求
     */
    _isExtensionRequest(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        // 检查URL是否匹配扩展相关的模式
        for (const pattern of this.extensionUrlPatterns) {
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
     * 记录请求（只记录重要的API请求）
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
        
        // 性能优化：限制响应体大小，避免大文件导致卡死
        if (request.responseText && request.responseText.length > 100000) {
            request.responseText = request.responseText.substring(0, 100000) + '...[响应体过大，已截断]';
            request.responseBody = null; // 大响应体不解析JSON
        }
        
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
        
        // 触发自定义事件，通知UI更新
        if (typeof window !== 'undefined') {
            try {
                window.dispatchEvent(new CustomEvent('apiRequestRecorded', {
                    detail: request
                }));
            } catch (e) {
                // 静默处理事件触发错误
            }
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
        
        // 合并到总请求列表（去重）
        this._mergeRequest(request);
        
        // 触发自定义事件，通知UI更新
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('apiRequestRecorded', {
                detail: request
            }));
        }
    }
    
    /**
     * 合并请求到总列表（去重）
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
            // 检查是否已存在相同的请求（基于 URL、方法、时间戳）
            const exists = this.requests.some(existing => {
                try {
                    if (!existing || typeof existing !== 'object') {
                        return false;
                    }
                    return existing.url === request.url &&
                           existing.method === request.method &&
                           Math.abs((existing.timestamp || 0) - (request.timestamp || 0)) < 1000; // 1秒内的相同请求视为重复
                } catch (e) {
                    // 比较时出错，静默返回 false
                    return false;
                }
            });
            
            if (!exists) {
                this.requests.push(request);
                
                // 限制总请求数量
                if (this.requests.length > this.maxRecords) {
                    this.requests.shift();
                }
            }
        } catch (e) {
            // 合并请求时出错，静默舍弃
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
            
            // 额外检查：尝试访问 runtime.getURL（如果可用）
            // 这可以更可靠地检测上下文是否有效
            try {
                if (typeof chrome.runtime.getURL === 'function') {
                    chrome.runtime.getURL(''); // 测试调用
                }
            } catch (e) {
                // 如果 getURL 调用失败，上下文可能已失效
                return false;
            }
            
            // 所有检查都通过，上下文有效
            return true;
        } catch (error) {
            // 如果抛出任何错误，说明上下文已失效
            // 不检查具体错误消息，直接返回 false
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
        
        // 静默处理，不输出警告日志（避免控制台污染）
        // console.warn('[ApiRequestManager] 扩展上下文已失效，已禁用存储同步功能');
    }
    
    /**
     * 从 storage 加载请求数据
     * 所有错误都静默处理，不输出任何错误日志
     */
    async _loadRequestsFromStorage() {
        // 快速检查：如果上下文已失效或 chrome.storage 不可用，直接返回
        if (this._contextInvalidated || typeof chrome === 'undefined' || !chrome?.storage) {
            return;
        }
        
        // 整个方法用 try-catch 包裹，确保所有错误都被静默处理
        try {
            // 检查上下文是否有效（静默处理所有错误）
            try {
                if (!this._isContextValid()) {
                    this._handleContextInvalidated();
                    return;
                }
            } catch (e) {
                this._handleContextInvalidated();
                return;
            }
            
            // 从 storage 获取数据，所有错误都静默处理
            const result = await new Promise((resolve) => {
                try {
                    // 再次检查上下文
                    if (!this._isContextValid()) {
                        this._handleContextInvalidated();
                        resolve({ apiRequests: [] });
                        return;
                    }
                    
                    chrome.storage.local.get(['apiRequests'], (items) => {
                        try {
                            // 检查运行时错误（所有错误都静默处理）
                            if (chrome.runtime?.lastError) {
                                this._handleContextInvalidated();
                                resolve({ apiRequests: [] });
                                return;
                            }
                            resolve(items || { apiRequests: [] });
                        } catch (e) {
                            // 回调中任何错误都静默处理
                            this._handleContextInvalidated();
                            resolve({ apiRequests: [] });
                        }
                    });
                } catch (e) {
                    // 任何错误都静默处理
                    this._handleContextInvalidated();
                    resolve({ apiRequests: [] });
                }
            }).catch(() => {
                // Promise reject 也静默处理
                return { apiRequests: [] };
            });
            
            // 检查上下文是否在 Promise 执行期间失效
            try {
                if (this._contextInvalidated || !this._isContextValid()) {
                    if (!this._contextInvalidated) {
                        this._handleContextInvalidated();
                    }
                    return;
                }
            } catch (e) {
                this._handleContextInvalidated();
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
            
            // 合并请求到总列表
            if (storageRequests.length > 0) {
                try {
                    for (const request of storageRequests) {
                        try {
                            // 验证并处理请求对象
                            if (request && typeof request === 'object' && request.url && request.method) {
                                if (request.source !== 'local') {
                                    request.source = 'background';
                                }
                                this._mergeRequest(request);
                            }
                        } catch (e) {
                            // 单个请求处理失败，静默跳过
                        }
                    }
                    
                    // 输出同步日志（仅在成功时）
                    try {
                        const now = Date.now();
                        if (now - this._lastSyncTime > 10000) {
                            console.log('[ApiRequestManager] 从 storage 同步请求数据:', {
                                storageCount: storageRequests.length,
                                totalCount: this.requests.length,
                                localCount: this.localRequests.length
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
        if (this._contextInvalidated || typeof chrome === 'undefined' || !chrome?.storage) {
            return;
        }
        
        // 整个方法用 try-catch 包裹，确保所有错误都被静默处理
        try {
            // 检查上下文是否有效（静默处理所有错误）
            try {
                if (!this._isContextValid()) {
                    this._handleContextInvalidated();
                    return;
                }
            } catch (e) {
                this._handleContextInvalidated();
                return;
            }
            
            // 获取当前存储的请求列表，所有错误都静默处理
            const result = await new Promise((resolve) => {
                try {
                    if (!this._isContextValid()) {
                        this._handleContextInvalidated();
                        resolve({ apiRequests: [] });
                        return;
                    }
                    
                    chrome.storage.local.get(['apiRequests'], (items) => {
                        try {
                            // 检查运行时错误（所有错误都静默处理）
                            if (chrome.runtime?.lastError) {
                                this._handleContextInvalidated();
                                resolve({ apiRequests: [] });
                                return;
                            }
                            resolve(items || { apiRequests: [] });
                        } catch (e) {
                            // 回调中任何错误都静默处理
                            this._handleContextInvalidated();
                            resolve({ apiRequests: [] });
                        }
                    });
                } catch (e) {
                    // 任何错误都静默处理
                    this._handleContextInvalidated();
                    resolve({ apiRequests: [] });
                }
            }).catch(() => {
                // Promise reject 也静默处理
                return { apiRequests: [] };
            });
            
            // 检查上下文是否在 Promise 执行期间失效
            try {
                if (this._contextInvalidated || !this._isContextValid()) {
                    if (!this._contextInvalidated) {
                        this._handleContextInvalidated();
                    }
                    return;
                }
            } catch (e) {
                this._handleContextInvalidated();
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
            
            // 保存到 storage，所有错误都静默处理
            await new Promise((resolve) => {
                try {
                    if (!this._isContextValid()) {
                        this._handleContextInvalidated();
                        resolve();
                        return;
                    }
                    
                    chrome.storage.local.set({ apiRequests: storageRequests }, () => {
                        try {
                            // 检查运行时错误（所有错误都静默处理）
                            if (chrome.runtime?.lastError) {
                                this._handleContextInvalidated();
                            }
                            resolve();
                        } catch (e) {
                            // 回调中任何错误都静默处理
                            this._handleContextInvalidated();
                            resolve();
                        }
                    });
                } catch (e) {
                    // 任何错误都静默处理
                    this._handleContextInvalidated();
                    resolve();
                }
            }).catch(() => {
                // Promise reject 也静默处理
            });
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
     * 规范化URL（移除hash和query参数，用于匹配）
     * @param {string} url - 原始URL
     * @returns {string} 规范化后的URL
     */
    _normalizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        try {
            const urlObj = new URL(url);
            // 只保留 origin + pathname，忽略 hash 和 search
            return `${urlObj.origin}${urlObj.pathname}`;
        } catch (e) {
            // 如果URL解析失败，尝试简单处理
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
            console.log('当前页面URL匹配失败，返回所有请求');
            console.log('当前页面URL:', this.currentPageUrl);
            console.log('规范化后的URL:', this._normalizeUrl(this.currentPageUrl));
            console.log('总请求数:', this.requests.length);
            if (this.requests.length > 0) {
                console.log('第一个请求的pageUrl:', this.requests[0]?.pageUrl);
                console.log('第一个请求的规范化pageUrl:', this._normalizeUrl(this.requests[0]?.pageUrl || ''));
            }
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
        
        // 清空保存队列
        this._saveQueue = [];
    }
    
    /**
     * 清空当前页面的请求记录
     */
    clearCurrentPageRequests() {
        this.requests = this.requests.filter(req => req.pageUrl !== this.currentPageUrl);
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



