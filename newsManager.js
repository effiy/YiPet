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
            
            const url = `${this.apiUrl}?cname=${this.cname}&isoDate=${isoDate}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // 处理返回的数据
            let newsList = [];
            if (Array.isArray(result)) {
                newsList = result;
            } else if (result.data && Array.isArray(result.data)) {
                newsList = result.data;
            } else if (result.items && Array.isArray(result.items)) {
                newsList = result.items;
            }
            
            this.news = newsList;
            this.lastNewsLoadTime = now;
            
            console.log('新闻列表已加载，共', newsList.length, '条新闻');
        } catch (error) {
            console.warn('从API加载新闻列表失败:', error);
            // 如果加载失败，保持现有数据
        }
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
            const content = (news.content || '').toLowerCase();
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
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = NewsManager;
} else {
    window.NewsManager = NewsManager;
}

