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
            await this._loadRequestsFromStorage();
            
            // 监听 background 发送的新请求消息
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
                chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                    if (request.action === 'apiRequestRecorded' && request.request) {
                        this._addRequestFromBackground(request.request);
                    }
                });
            }
            
            // 定期同步 storage 中的请求数据（每5秒）
            this._syncInterval = setInterval(() => {
                this._loadRequestsFromStorage();
            }, 5000);
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
                
                // 异步读取响应内容
                let responseBody = null;
                let responseText = null;
                const contentType = response.headers.get('content-type') || '';
                
                try {
                    if (contentType.includes('application/json')) {
                        responseBody = await clonedResponse.json();
                        responseText = JSON.stringify(responseBody, null, 2);
                    } else if (contentType.includes('text/')) {
                        responseText = await clonedResponse.text();
                    } else {
                        // 对于其他类型，尝试读取为文本
                        responseText = await clonedResponse.text();
                    }
                } catch (e) {
                    // 如果读取失败，记录错误
                    responseText = '[无法读取响应内容]';
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
                        if (contentType.includes('application/json')) {
                            try {
                                responseBody = JSON.parse(this.responseText);
                                responseText = JSON.stringify(responseBody, null, 2);
                            } catch (e) {
                                responseText = this.responseText;
                            }
                        } else {
                            responseText = this.responseText;
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
     * 记录请求
     */
    _recordRequest(request) {
        if (!this.enableRecording) {
            console.log('接口请求记录已禁用');
            return;
        }
        
        // 如果启用了过滤扩展请求，则跳过扩展相关的请求
        if (this.filterExtensionRequests && this._isExtensionRequest(request.url)) {
            console.log('请求被过滤（扩展请求）:', request.url);
            return;
        }
        
        // 更新当前页面URL（确保是最新的）
        this.currentPageUrl = window.location.href;
        
        // 添加当前页面URL（同时保存原始URL和规范化URL）
        request.pageUrl = this.currentPageUrl;
        request.normalizedPageUrl = this._normalizeUrl(this.currentPageUrl);
        request.source = 'local'; // 标记为本地请求
        
        // 添加到本地请求列表
        this.localRequests.push(request);
        
        // 合并到总请求列表（去重）
        this._mergeRequest(request);
        
        console.log('接口请求已记录:', {
            url: request.url,
            method: request.method,
            status: request.status,
            pageUrl: request.pageUrl,
            totalRequests: this.requests.length,
            localRequests: this.localRequests.length
        });
        
        // 限制本地请求数量
        if (this.localRequests.length > this.maxRecords) {
            this.localRequests.shift();
        }
        
        // 如果启用了存储同步，保存到 storage
        if (this.enableStorageSync && typeof chrome !== 'undefined' && chrome.storage) {
            this._saveRequestToStorage(request);
        }
        
        // 触发自定义事件，通知UI更新
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('apiRequestRecorded', {
                detail: request
            }));
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
        // 检查是否已存在相同的请求（基于 URL、方法、时间戳）
        const exists = this.requests.some(existing => {
            return existing.url === request.url &&
                   existing.method === request.method &&
                   Math.abs(existing.timestamp - request.timestamp) < 1000; // 1秒内的相同请求视为重复
        });
        
        if (!exists) {
            this.requests.push(request);
            
            // 限制总请求数量
            if (this.requests.length > this.maxRecords) {
                this.requests.shift();
            }
        }
    }
    
    /**
     * 从 storage 加载请求数据
     */
    async _loadRequestsFromStorage() {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            return;
        }
        
        try {
            const result = await new Promise((resolve) => {
                chrome.storage.local.get(['apiRequests'], resolve);
            });
            
            const storageRequests = result.apiRequests || [];
            
            if (storageRequests.length > 0) {
                // 合并 storage 中的请求到总列表
                storageRequests.forEach(request => {
                    if (request.source !== 'local') {
                        request.source = 'background';
                        this._mergeRequest(request);
                    }
                });
                
                // 只在有新请求时输出日志
                const now = Date.now();
                if (now - this._lastSyncTime > 10000) { // 每10秒输出一次日志
                    console.log('[ApiRequestManager] 从 storage 同步请求数据:', {
                        storageCount: storageRequests.length,
                        totalCount: this.requests.length,
                        localCount: this.localRequests.length
                    });
                    this._lastSyncTime = now;
                }
            }
        } catch (error) {
            console.error('[ApiRequestManager] 从 storage 加载请求数据失败:', error);
        }
    }
    
    /**
     * 保存请求到 storage（仅保存本地请求）
     */
    async _saveRequestToStorage(request) {
        if (typeof chrome === 'undefined' || !chrome.storage) {
            return;
        }
        
        try {
            // 获取当前存储的请求列表
            const result = await new Promise((resolve) => {
                chrome.storage.local.get(['apiRequests'], resolve);
            });
            
            let storageRequests = result.apiRequests || [];
            
            // 添加新请求
            storageRequests.push(request);
            
            // 限制存储数量
            if (storageRequests.length > this.maxRecords) {
                storageRequests = storageRequests.slice(-this.maxRecords);
            }
            
            // 保存到 storage
            await new Promise((resolve) => {
                chrome.storage.local.set({ apiRequests: storageRequests }, resolve);
            });
        } catch (error) {
            console.error('[ApiRequestManager] 保存请求到 storage 失败:', error);
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
        
        // 如果启用了存储同步，也清空 storage
        if (this.enableStorageSync && typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ apiRequests: [] }, () => {
                console.log('[ApiRequestManager] 已清空 storage 中的请求数据');
            });
        }
    }
    
    /**
     * 销毁管理器（清理定时器等资源）
     */
    destroy() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
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


