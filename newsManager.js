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
            
            // 调试：输出原始返回数据
            console.log('新闻API返回的原始数据:', result);
            
            if (Array.isArray(result)) {
                newsList = result;
            } else if (result && typeof result === 'object') {
                // 尝试多种可能的数据字段
                if (Array.isArray(result?.data?.list)) {
                    newsList = result?.data?.list;
                } else {
                    // 如果都不匹配，尝试查找所有数组类型的属性
                    for (const key in result) {
                        if (Array.isArray(result[key]) && result[key].length > 0) {
                            console.log('发现数组字段:', key, '包含', result[key].length, '条数据');
                            newsList = result[key];
                            break;
                        }
                    }
                }
            }
            
            // 如果仍然没有找到数据，输出警告
            if (newsList.length === 0) {
                console.warn('未能从API返回数据中提取新闻列表，返回的数据结构:', Object.keys(result || {}));
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
        
        try {
            // 构建URL，优先使用key参数，如果没有key则使用link参数
            let url;
            if (key) {
                url = `${this.apiUrl}?cname=${this.cname}&key=${encodeURIComponent(key)}`;
            } else {
                url = `${this.apiUrl}?cname=${this.cname}&link=${encodeURIComponent(link)}`;
            }
            
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
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

