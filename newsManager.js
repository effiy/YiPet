/**
 * 新闻管理器
 * 统一管理新闻数据的加载、缓存等功能
 * 提供清晰的 API 接口，与新闻 API 对接
 */

class NewsManager {
    constructor(options = {}) {
        // 配置选项
        this.apiUrl = options.apiUrl || 'https://api.effiy.cn/mongodb/';
        this.enableCache = options.enableCache !== false; // 是否启用缓存
        
        // 新闻数据
        this.news = []; // 存储所有新闻列表
        this.cname = options.cname || 'rss'; // 集合名称

        // 轻量列表加载配置（默认不拉取大字段 content，节省流量）
        this.lightweightList = options.lightweightList !== false;
        this.listFields = options.listFields || [
            'key',
            'title',
            'link',
            'description',
            'tags',
            'source_name',
            'source_url',
            'published',
            'published_parsed',
            'createdTime',
            'updatedTime',
        ];
        this.excludeFields = options.excludeFields || ['content'];
        this.pageSize = options.pageSize || 500; // 单次最多拉取条数（可按需调整）
        this.maxPages = options.maxPages || 10; // 最多翻页次数，避免异常数据导致无限拉取

        // 详情缓存（key -> newsDetail）
        this.detailCache = new Map();

        // 请求去重
        this.pendingRequests = new Map();
        
        // 同步和保存优化
        this.lastNewsLoadTime = 0;
        this.newsUpdateTimer = null;
        this.pendingNewsUpdate = false;
        this.NEWS_UPDATE_DEBOUNCE = options.debounceTime || 300; // 新闻列表更新防抖时间（毫秒）
        this.NEWS_LOAD_THROTTLE = options.throttleTime || 1000; // 新闻列表加载节流时间（毫秒）
        
        // 新闻列表加载控制
        this.NEWS_RELOAD_INTERVAL = options.reloadInterval || 60000; // 新闻列表重新加载间隔（60秒）
        
        // 初始化
        this._initialized = false;
        
        // 加载动画计数器
        this.activeRequestCount = 0;
    }

    /**
     * 构建请求key用于去重
     */
    _getRequestKey(method, url, body) {
        const bodyStr = body ? JSON.stringify(body) : '';
        return `${method}:${url}:${bodyStr}`;
    }

    /**
     * 统一请求（带去重）
     */
    async _request(url, options = {}) {
        const method = options.method || 'GET';
        const requestKey = this._getRequestKey(method, url, options.body);

        if (this.pendingRequests.has(requestKey)) {
            return await this.pendingRequests.get(requestKey);
        }

        this._showLoadingAnimation();

        const requestPromise = (async () => {
            try {
                // 获取 API Token（优先从 chrome.storage，支持跨 tab 和跨域共享）
                const getApiToken = async () => {
                    try {
                        // 优先使用 TokenUtils（如果可用）
                        if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiToken) {
                            return await TokenUtils.getApiToken();
                        }
                        // 降级方案：从 localStorage 获取
                        const token = localStorage.getItem('YiPet.apiToken.v1');
                        return token ? String(token).trim() : '';
                    } catch (error) {
                        return '';
                    }
                };

                // 检查并确保 token 已设置
                let token = await getApiToken();
                if (!token && typeof TokenUtils !== 'undefined' && TokenUtils.ensureTokenSet) {
                    const hasToken = await TokenUtils.ensureTokenSet();
                    if (hasToken) {
                        token = await getApiToken();
                    }
                }

                const authHeaders = token ? { 'X-Token': token } : {};

                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders,
                        ...(options.headers || {}),
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                return await response.json();
            } finally {
                this.pendingRequests.delete(requestKey);
                this._hideLoadingAnimation();
            }
        })();

        this.pendingRequests.set(requestKey, requestPromise);
        return await requestPromise;
    }

    _normalizeApiBase() {
        // 允许传入 .../mongodb 或 .../mongodb/
        return (this.apiUrl || '').replace(/\/+$/, '');
    }

    _getCacheKey(isoDate) {
        return `pet_news_cache:v2:${this._normalizeApiBase()}:${this.cname}:${isoDate || ''}`;
    }

    async _storageGet(key) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                return await new Promise(resolve => {
                    chrome.storage.local.get([key], (result) => resolve(result ? result[key] : null));
                });
            }
        } catch (e) {}

        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            }
        } catch (e) {}

        return null;
    }

    async _storageSet(key, value) {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                return await new Promise(resolve => {
                    chrome.storage.local.set({ [key]: value }, () => resolve());
                });
            }
        } catch (e) {}

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch (e) {}
    }
    
    /**
     * 显示加载动画
     */
    _showLoadingAnimation() {
        this.activeRequestCount++;
        if (this.activeRequestCount === 1 && typeof window !== 'undefined' && window.petLoadingAnimation) {
            window.petLoadingAnimation.show();
        }
    }
    
    /**
     * 隐藏加载动画
     */
    _hideLoadingAnimation() {
        this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
        if (this.activeRequestCount === 0 && typeof window !== 'undefined' && window.petLoadingAnimation) {
            window.petLoadingAnimation.hide();
        }
    }
    
    /**
     * 初始化新闻管理器
     */
    async initialize() {
        if (this._initialized) {
            return;
        }
        
        this._initialized = true;
    }
    
    /**
     * 从API加载新闻列表
     * @param {boolean} forceRefresh - 是否强制刷新
     * @param {string} isoDate - 日期范围，格式：YYYY-MM-DD,YYYY-MM-DD
     */
    async loadNews(forceRefresh = false, isoDate = null) {
        const now = Date.now();
        
        // 如果不是强制刷新，且距离上次加载时间太短，则跳过
        if (!forceRefresh && (now - this.lastNewsLoadTime) < this.NEWS_RELOAD_INTERVAL) {
            return;
        }
        
        try {
            // 如果没有提供日期，使用今天的日期
            if (!isoDate) {
                const today = new Date();
                const dateStr = this.formatDate(today);
                isoDate = `${dateStr},${dateStr}`;
            }

            // 先尝试读缓存（非强制刷新时）
            if (this.enableCache && !forceRefresh) {
                const cacheKey = this._getCacheKey(isoDate);
                const cached = await this._storageGet(cacheKey);
                if (cached && cached.data && Array.isArray(cached.data) && typeof cached.savedAt === 'number') {
                    // 有缓存则先用缓存快速渲染
                    this.news = cached.data;
                    // 若缓存仍在有效期内，直接返回，节省网络请求
                    if ((now - cached.savedAt) < this.NEWS_RELOAD_INTERVAL) {
                        this.lastNewsLoadTime = now;
                        return;
                    }
                }
            }

            const apiBase = this._normalizeApiBase();
            const params = new URLSearchParams();
            params.set('cname', this.cname);
            params.set('isoDate', isoDate);
            params.set('pageNum', '1');
            params.set('pageSize', String(this.pageSize));
            params.set('orderBy', 'updatedTime');
            params.set('orderType', 'desc');

            // 轻量列表：尽量不拉 content 等大字段
            if (this.lightweightList) {
                if (this.listFields && this.listFields.length > 0) {
                    params.set('fields', this.listFields.join(','));
                } else if (this.excludeFields && this.excludeFields.length > 0) {
                    params.set('excludeFields', this.excludeFields.join(','));
                }
            }

            const firstPageUrl = `${apiBase}?${params.toString()}`;
            const firstResult = await this._request(firstPageUrl, { method: 'GET' });
            
            // 处理返回的数据
            let newsList = [];

            // 兼容不同返回结构
            const extractList = (res) => {
                if (Array.isArray(res)) return { list: res, totalPages: 1 };
                if (res && typeof res === 'object') {
                    if (Array.isArray(res?.data?.list)) {
                        const totalPages = res?.data?.totalPages || 1;
                        return { list: res.data.list, totalPages };
                    }
                    // 兜底：找第一个数组字段
                    for (const k in res) {
                        if (Array.isArray(res[k]) && res[k].length > 0) {
                            return { list: res[k], totalPages: 1 };
                        }
                    }
                }
                return { list: [], totalPages: 1 };
            };

            const extracted = extractList(firstResult);
            newsList = extracted.list || [];

            // 如果有分页信息，最多再拉若干页（仍然是轻量字段）
            const totalPages = Math.min(extracted.totalPages || 1, this.maxPages);
            if (!Array.isArray(firstResult) && totalPages > 1) {
                for (let page = 2; page <= totalPages; page++) {
                    const p = new URLSearchParams(params);
                    p.set('pageNum', String(page));
                    const pageUrl = `${apiBase}?${p.toString()}`;
                    const pageResult = await this._request(pageUrl, { method: 'GET' });
                    const pageExtracted = extractList(pageResult);
                    if (pageExtracted.list && pageExtracted.list.length > 0) {
                        newsList = newsList.concat(pageExtracted.list);
                    }
                }
            }
            
            // 如果仍然没有找到数据，输出警告
            if (newsList.length === 0) {
                console.warn('未能从API返回数据中提取新闻列表');
            }
            
            // 为每条新闻自动添加"网文"标签
            newsList = newsList.map(newsItem => {
                // 确保tags字段存在且为数组
                if (!newsItem.tags || !Array.isArray(newsItem.tags)) {
                    newsItem.tags = [];
                }
                // 如果还没有"网文"标签，则添加
                if (!newsItem.tags.includes('网文')) {
                    newsItem.tags.push('网文');
                }
                return newsItem;
            });
            
            this.news = newsList;
            this.lastNewsLoadTime = now;

            // 写缓存
            if (this.enableCache) {
                const cacheKey = this._getCacheKey(isoDate);
                await this._storageSet(cacheKey, {
                    savedAt: now,
                    isoDate,
                    data: newsList
                });
            }
            
            console.log('新闻列表已加载，共', newsList.length, '条新闻');
        } catch (error) {
            console.warn('从API加载新闻列表失败:', error);
            // 如果加载失败，保持现有数据
        }
    }

    /**
     * 获取新闻详情（按 key 懒加载，用于需要 content 等大字段的场景）
     */
    async getNewsDetail(key, forceRefresh = false) {
        if (!key) return null;
        if (!forceRefresh && this.detailCache.has(key)) {
            return this.detailCache.get(key);
        }

        const apiBase = this._normalizeApiBase();
        // 后端 mongodb 详情接口：/mongodb/detail?cname=rss&id=xxx
        const url = `${apiBase}/detail?cname=${encodeURIComponent(this.cname)}&id=${encodeURIComponent(key)}`;
        const result = await this._request(url, { method: 'GET' });

        const detail = (result && result.data) ? result.data : result;
        if (detail && typeof detail === 'object') {
            this.detailCache.set(key, detail);
            return detail;
        }
        return null;
    }

    /**
     * 确保 newsItem 具备详情字段（例如 content）。会在原对象上 merge，保证外部引用不失效。
     */
    async ensureNewsDetail(newsItem, forceRefresh = false) {
        if (!newsItem || typeof newsItem !== 'object') return newsItem;
        // 已有正文则认为详情已就绪
        if (newsItem.content && !forceRefresh) return newsItem;
        if (!newsItem.key) return newsItem;

        try {
            const detail = await this.getNewsDetail(newsItem.key, forceRefresh);
            if (detail) {
                Object.assign(newsItem, detail);
            }
        } catch (e) {
            console.warn('加载新闻详情失败:', e?.message || e);
        }
        return newsItem;
    }
    
    /**
     * 格式化日期为 YYYY-MM-DD
     * @param {Date} date - 日期对象
     * @returns {string} 格式化后的日期字符串
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * 获取所有新闻列表
     * @returns {Array} 新闻列表
     */
    getAllNews() {
        return this.news || [];
    }
    
    /**
     * 刷新新闻列表（从API重新加载）
     * @param {boolean} forceRefresh - 是否强制刷新
     * @param {string} isoDate - 日期范围
     */
    async refreshNews(forceRefresh = false, isoDate = null) {
        await this.loadNews(forceRefresh, isoDate);
    }
    
    /**
     * 搜索新闻
     * @param {string} query - 搜索关键词
     * @param {number} limit - 返回数量限制
     * @returns {Array} 搜索结果
     */
    searchNews(query, limit = 50) {
        if (!query) {
            return [];
        }
        
        const queryLower = query.toLowerCase();
        const results = this.getAllNews().filter(news => {
            const title = (news.title || '').toLowerCase();
            const description = (news.description || '').toLowerCase();
            // 轻量列表可能不包含 content，避免强行依赖正文字段
            const content = news.content ? String(news.content).toLowerCase() : '';
            return title.includes(queryLower) || 
                   description.includes(queryLower) || 
                   content.includes(queryLower);
        }).slice(0, limit);
        
        return results;
    }
    
    /**
     * 清空新闻列表
     */
    async clearAllNews() {
        this.news = [];
    }
    
    /**
     * 删除新闻
     * @param {Object} newsItem - 新闻项对象
     * @returns {Promise<Object>} 删除结果
     */
    async deleteNews(newsItem) {
        if (!newsItem) {
            throw new Error('新闻项不能为空');
        }
        
        // 优先使用key字段，如果没有则使用link字段
        const key = newsItem.key;
        const link = newsItem.link;
        
        if (!key && !link) {
            throw new Error('新闻项缺少key或link字段，无法删除');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            // 构建URL，优先使用key参数，如果没有key则使用link参数
            let url;
            if (key) {
                url = `${this.apiUrl}?cname=${this.cname}&key=${encodeURIComponent(key)}`;
            } else {
                url = `${this.apiUrl}?cname=${this.cname}&link=${encodeURIComponent(link)}`;
            }
            
            // 获取 API Token（优先从 chrome.storage，支持跨 tab 和跨域共享）
            const getApiToken = async () => {
                try {
                    // 优先使用 TokenUtils（如果可用）
                    if (typeof TokenUtils !== 'undefined' && TokenUtils.getApiToken) {
                        return await TokenUtils.getApiToken();
                    }
                    // 降级方案：从 localStorage 获取
                    const token = localStorage.getItem('YiPet.apiToken.v1');
                    return token ? String(token).trim() : '';
                } catch (error) {
                    return '';
                }
            };

            // 检查并确保 token 已设置
            let token = await getApiToken();
            if (!token && typeof TokenUtils !== 'undefined' && TokenUtils.ensureTokenSet) {
                const hasToken = await TokenUtils.ensureTokenSet();
                if (hasToken) {
                    token = await getApiToken();
                }
            }

            const authHeaders = token ? { 'X-Token': token } : {};
            
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            
            // 检查删除是否成功（支持多种响应格式）
            const isSuccess = result.code === 200 || 
                            result.status === 200 || 
                            result.success === true ||
                            (result.data && result.data.deleted_count > 0);
            
            if (isSuccess) {
                // 如果删除成功，从本地列表中移除
                this.news = this.news.filter((item) => {
                    // 如果使用key删除，匹配key；如果使用link删除，匹配link
                    if (key) {
                        return item.key !== key;
                    } else {
                        return item.link !== link;
                    }
                });
                console.log('新闻删除成功，已从本地列表移除');
            } else {
                // 如果响应表示删除失败，抛出错误
                const errorMsg = result.msg || result.message || '删除失败';
                throw new Error(errorMsg);
            }
            
            return result;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('删除新闻失败:', error);
            throw error;
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = NewsManager;
} else {
    window.NewsManager = NewsManager;
}




