/**
 * 网络请求监控服务
 * 使用 webRequest API 监控所有标签页的网络请求
 * 
 * 功能：
 * - 记录所有 XHR/Fetch 请求
 * - 自动去重（相同请求在5秒内只记录一次）
 * - 限制最大记录数，防止存储溢出
 */

class RequestMonitorService {
    constructor() {
        this.maxRequests = CONSTANTS.STORAGE.MAX_REQUESTS;
        this.requestIndexMap = new Map();
        this.requestStartInfo = new Map();
        this.isInitialized = false;
    }

    /**
     * 初始化请求监控服务
     */
    initialize() {
        if (this.isInitialized) {
            return;
        }

        // 监听请求开始
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => this.handleRequestStart(details),
            { urls: ['<all_urls>'] },
            ['requestBody']
        );

        // 定期清理过期的请求开始信息（防止内存泄漏）
        setInterval(() => this.cleanupExpiredRequests(), CONSTANTS.TIMING.REQUEST_CLEANUP_INTERVAL);

        this.isInitialized = true;
    }

    /**
     * 处理请求开始
     */
    handleRequestStart(details) {
        // 过滤扩展请求
        if (this.isExtensionRequest(details.url)) {
            return;
        }

        // 只监控 fetch 和 xhr 类型的请求
        if (details.type !== 'xmlhttprequest' && details.type !== 'fetch') {
            return;
        }

        const requestId = details.requestId;
        const startTime = Date.now();
        const method = details.method || 'GET';

        // 获取请求体（如果有，且是 POST/PUT/PATCH 等）
        let requestBody = null;
        if (details.requestBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            if (details.requestBody.formData) {
                requestBody = details.requestBody.formData;
            } else if (details.requestBody.raw) {
                // 对于原始数据，我们无法直接读取，只能标记
                requestBody = '[Binary Data]';
            }
        }

        // 存储请求开始信息
        this.requestStartInfo.set(requestId, {
            url: details.url,
            method: method,
            tabId: details.tabId,
            frameId: details.frameId,
            type: details.type,
            startTime: startTime,
            requestBody: requestBody,
            requestHeaders: details.requestHeaders || []
        });
    }

    /**
     * 清理过期的请求开始信息
     */
    cleanupExpiredRequests() {
        const now = Date.now();
        const timeout = CONSTANTS.TIMING.REQUEST_CLEANUP_TIMEOUT;

        for (const [requestId, info] of this.requestStartInfo.entries()) {
            if (now - info.startTime > timeout) {
                this.requestStartInfo.delete(requestId);
            }
        }
    }

    /**
     * 判断是否为扩展请求
     */
    isExtensionRequest(url) {
        if (!url || typeof url !== 'string') return false;
        return url.startsWith('chrome-extension://') ||
               url.startsWith('moz-extension://') ||
               url.startsWith('chrome://');
    }

    /**
     * 规范化URL（移除query参数和hash，用于去重）
     */
    normalizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        try {
            const urlObj = new URL(url);
            return `${urlObj.origin}${urlObj.pathname}`;
        } catch (e) {
            return url;
        }
    }

    /**
     * 生成请求的唯一标识符（用于去重）
     */
    generateRequestKey(request) {
        if (!request || !request.url || !request.method) {
            return null;
        }

        const normalizedUrl = this.normalizeUrl(request.url);
        const method = (request.method || 'GET').toUpperCase();
        const timestamp = request.timestamp || Date.now();
        const timeWindow = CONSTANTS.TIMING.REQUEST_DEDUP_WINDOW;
        const timeRange = Math.floor(timestamp / timeWindow);

        return `${method}:${normalizedUrl}:${timeRange}`;
    }

    /**
     * 重建请求索引（当数组发生变化时调用）
     */
    rebuildRequestIndex(requests) {
        this.requestIndexMap.clear();

        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            if (request) {
                const key = this.generateRequestKey(request);
                if (key && !this.requestIndexMap.has(key)) {
                    this.requestIndexMap.set(key, i);
                }
            }
        }
    }

    /**
     * 合并请求到列表（去重）
     */
    mergeRequestIntoList(requests, newRequest) {
        if (!newRequest || typeof newRequest !== 'object' || !newRequest.url || !newRequest.method) {
            return requests;
        }

        const requestKey = this.generateRequestKey(newRequest);
        if (!requestKey) {
            return requests;
        }

        const existingIndex = this.requestIndexMap.get(requestKey);

        if (existingIndex !== undefined && existingIndex < requests.length) {
            const existingRequest = requests[existingIndex];
            if (existingRequest && existingRequest.timestamp < newRequest.timestamp) {
                requests[existingIndex] = newRequest;
            }
            return requests;
        }

        const newIndex = requests.length;
        requests.push(newRequest);
        this.requestIndexMap.set(requestKey, newIndex);

        // 限制总请求数量
        if (requests.length > this.maxRequests) {
            requests.shift();
            this.rebuildRequestIndex(requests);
        }

        return requests;
    }

    /**
     * 记录请求到存储（带去重功能）
     */
    async recordRequestToStorage(request) {
        try {
            // 过滤扩展请求
            if (this.isExtensionRequest(request.url)) {
                return;
            }

            // 获取当前存储的请求列表
            const result = await chrome.storage.local.get(['apiRequests']);
            let requests = result.apiRequests || [];

            // 如果索引为空，先重建索引
            if (this.requestIndexMap.size === 0 && requests.length > 0) {
                this.rebuildRequestIndex(requests);
            }

            // 合并新请求（自动去重）
            requests = this.mergeRequestIntoList(requests, request);

            // 保存到存储
            await chrome.storage.local.set({ apiRequests: requests });

            // 通知所有标签页有新请求
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && !CONSTANTS.URLS.isSystemPage(tab.url)) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'apiRequestRecorded',
                            request: request
                        }).catch(() => {
                            // 忽略错误（content script 可能未加载）
                        });
                    }
                });
            });

            console.log('[RequestMonitor] 接口请求已记录:', {
                url: request.url,
                method: request.method,
                status: request.status,
                tabId: request.tabId,
                totalRequests: requests.length,
                uniqueRequests: this.requestIndexMap.size
            });
        } catch (error) {
            console.error('[RequestMonitor] 记录请求失败:', error);
        }
    }
}

// 创建全局实例
if (typeof self !== 'undefined') {
    self.RequestMonitorService = RequestMonitorService;
}

