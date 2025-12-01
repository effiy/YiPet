/**
 * RSS源管理器
 * 统一管理RSS源链接的增删改查
 * 使用后端API接口管理RSS源配置
 */

class RssSourceManager {
    constructor(options = {}) {
        // 配置选项
        this.apiUrl = options.apiUrl || 'https://api.effiy.cn/mongodb/';
        this.rssApiUrl = options.rssApiUrl || 'https://api.effiy.cn/rss';
        this.cname = options.cname || 'seeds';
        this.enabled = options.enabled !== false;
        
        // RSS源数据
        this.sources = []; // 存储所有RSS源（缓存）
        
        // 同步和保存优化
        this.lastSourcesLoadTime = 0;
        this.SOURCES_RELOAD_INTERVAL = options.reloadInterval || 30000; // 30秒
        
        // 定时器状态
        this.schedulerStatus = {
            enabled: false,
            type: 'interval', // 'interval' 或 'cron'
            interval: 3600, // 默认1小时（秒）
            cron: {
                second: null,
                minute: null,
                hour: null,
                day: null,
                month: null,
                day_of_week: null
            },
            running: false
        };
        
        // 初始化状态
        this._initialized = false;
        
        // 加载动画计数器
        this.activeRequestCount = 0;
    }
    
    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled && !!this.apiUrl;
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
     * 初始化RSS源管理器
     * 注意：不自动加载数据，只有在需要时才调用 loadSources()
     */
    async initialize() {
        if (this._initialized) {
            return;
        }
        
        // 不自动加载，等待用户打开管理界面时再加载
        this._initialized = true;
        console.log('RSS源管理器已初始化（延迟加载）');
    }
    
    /**
     * 从API加载RSS源
     * @param {boolean} forceRefresh - 是否强制刷新
     */
    async loadSources(forceRefresh = false) {
        if (!this.isEnabled()) {
            console.warn('RSS源管理器未启用');
            return;
        }
        
        const now = Date.now();
        
        // 如果不是强制刷新，且距离上次加载时间太短，则跳过
        if (!forceRefresh && (now - this.lastSourcesLoadTime) < this.SOURCES_RELOAD_INTERVAL) {
            return;
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.apiUrl}?cname=${this.cname}`;
            
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
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            
            // 处理返回的数据
            let sourcesList = [];
            
            if (Array.isArray(result)) {
                sourcesList = result;
            } else if (result && typeof result === 'object') {
                // 尝试多种可能的数据字段
                if (Array.isArray(result?.data?.list)) {
                    sourcesList = result.data.list;
                } else if (Array.isArray(result?.data)) {
                    sourcesList = result.data;
                } else {
                    // 尝试查找所有数组类型的属性
                    for (const key in result) {
                        if (Array.isArray(result[key]) && result[key].length > 0) {
                            console.log('发现数组字段:', key, '包含', result[key].length, '条数据');
                            sourcesList = result[key];
                            break;
                        }
                    }
                }
            }
            
            // 统一处理ID字段：将 _id 转换为 id（如果存在）
            sourcesList = sourcesList.map(source => {
                if (source._id && !source.id) {
                    source.id = source._id;
                }
                // 确保必要字段存在
                if (!source.enabled && source.enabled !== false) {
                    source.enabled = true; // 默认启用
                }
                return source;
            });
            
            this.sources = sourcesList;
            this.lastSourcesLoadTime = now;
            
            console.log('RSS源列表已加载，共', sourcesList.length, '个');
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.warn('从API加载RSS源列表失败:', error);
            // 如果加载失败，保持现有数据
        }
    }
    
    /**
     * 获取所有RSS源
     * @param {boolean} onlyEnabled - 是否只返回启用的源
     * @returns {Array} RSS源列表
     */
    getAllSources(onlyEnabled = false) {
        if (onlyEnabled) {
            return this.sources.filter(source => source.enabled !== false);
        }
        return this.sources || [];
    }
    
    /**
     * 根据ID获取RSS源
     * @param {string} id - RSS源ID（支持id、_id或key）
     * @returns {Object|null} RSS源对象
     */
    getSourceById(id) {
        return this.sources.find(source => 
            source.id === id || 
            source._id === id || 
            source.key === id
        ) || null;
    }
    
    /**
     * 添加RSS源
     * @param {Object} sourceData - RSS源数据
     * @returns {Promise<Object>} 添加的RSS源对象
     */
    async addSource(sourceData) {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        if (!sourceData.url || !sourceData.url.trim()) {
            throw new Error('RSS源URL不能为空');
        }
        
        // 验证URL格式
        try {
            new URL(sourceData.url);
        } catch (error) {
            throw new Error('RSS源URL格式无效');
        }
        
        // 检查是否已存在相同的URL（本地缓存检查）
        const existingSource = this.sources.find(s => s.url === sourceData.url.trim());
        if (existingSource) {
            throw new Error('该RSS源已存在');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.apiUrl}?cname=${this.cname}`;
            
            // 创建新的RSS源对象
            const newSourceData = {
                url: sourceData.url.trim(),
                name: sourceData.name || sourceData.url.trim(),
                description: sourceData.description || '',
                enabled: sourceData.enabled !== false, // 默认启用
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newSourceData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            
            // 处理返回的数据
            let newSource = null;
            if (result.success && result.data) {
                newSource = result.data;
            } else if (result.data) {
                newSource = result.data;
            } else {
                newSource = result;
            }
            
            // 统一处理ID字段
            if (newSource._id && !newSource.id) {
                newSource.id = newSource._id;
            }
            
            // 更新本地缓存
            await this.loadSources(true);
            
            console.log('RSS源已添加:', newSource);
            return newSource;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('添加RSS源失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新RSS源
     * @param {string} id - RSS源ID（或key，优先使用key）
     * @param {Object} updateData - 要更新的数据
     * @returns {Promise<Object>} 更新后的RSS源对象
     */
    async updateSource(id, updateData) {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        const source = this.getSourceById(id);
        if (!source) {
            throw new Error('RSS源不存在');
        }
        
        // 如果更新URL，验证格式
        if (updateData.url && updateData.url !== source.url) {
            try {
                new URL(updateData.url);
            } catch (error) {
                throw new Error('RSS源URL格式无效');
            }
            
            // 检查新URL是否与其他源重复
            const existingSource = this.sources.find(s => s.url === updateData.url.trim() && s.id !== id && s._id !== id);
            if (existingSource) {
                throw new Error('该RSS源URL已被其他源使用');
            }
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.apiUrl}?cname=${this.cname}`;
            
            // 使用key字段（优先）或id字段作为标识
            const key = source.key || source.url || id;
            
            // 构建更新数据
            const updatePayload = {
                key: key,
                ...updateData,
                url: updateData.url ? updateData.url.trim() : source.url,
                updatedAt: Date.now()
            };
            
            // 保留原有字段
            if (source.name && !updateData.name) {
                updatePayload.name = source.name;
            }
            if (source.description !== undefined && updateData.description === undefined) {
                updatePayload.description = source.description;
            }
            if (source.enabled !== undefined && updateData.enabled === undefined) {
                updatePayload.enabled = source.enabled;
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            
            // 处理返回的数据
            let updatedSource = null;
            if (result.success && result.data) {
                updatedSource = result.data;
            } else if (result.data) {
                updatedSource = result.data;
            } else {
                updatedSource = result;
            }
            
            // 统一处理ID字段
            if (updatedSource._id && !updatedSource.id) {
                updatedSource.id = updatedSource._id;
            }
            
            // 更新本地缓存
            await this.loadSources(true);
            
            console.log('RSS源已更新:', updatedSource);
            return updatedSource;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('更新RSS源失败:', error);
            throw error;
        }
    }
    
    /**
     * 删除RSS源
     * @param {string} id - RSS源ID（或key，优先使用key）
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteSource(id) {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        const source = this.getSourceById(id);
        if (!source) {
            throw new Error('RSS源不存在');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            // 使用key字段（优先）或url字段作为标识
            const key = source.key || source.url || id;
            
            // DELETE请求通过URL参数传递key
            const url = `${this.apiUrl}?cname=${this.cname}&key=${encodeURIComponent(key)}`;
            
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
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            
            // 检查删除是否成功（支持多种响应格式）
            const isSuccess = result.code === 200 || 
                            result.status === 200 || 
                            result.success === true ||
                            (result.data && result.data.deleted_count > 0);
            
            if (isSuccess) {
                // 更新本地缓存
                await this.loadSources(true);
                console.log('RSS源已删除:', id);
                return true;
            } else {
                const errorMsg = result.msg || result.message || '删除失败';
                throw new Error(errorMsg);
            }
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('删除RSS源失败:', error);
            throw error;
        }
    }
    
    /**
     * 切换RSS源启用状态
     * @param {string} id - RSS源ID
     * @returns {Promise<Object>} 更新后的RSS源对象
     */
    async toggleSourceEnabled(id) {
        const source = this.getSourceById(id);
        if (!source) {
            throw new Error('RSS源不存在');
        }
        
        return await this.updateSource(id, {
            enabled: !source.enabled
        });
    }
    
    /**
     * 批量删除RSS源
     * @param {Array<string>} ids - RSS源ID数组
     * @returns {Promise<number>} 删除的数量
     */
    async deleteSources(ids) {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return 0;
        }
        
        let deletedCount = 0;
        
        // 逐个删除
        for (const id of ids) {
            try {
                await this.deleteSource(id);
                deletedCount++;
            } catch (error) {
                console.warn(`删除RSS源 ${id} 失败:`, error);
            }
        }
        
        if (deletedCount > 0) {
            console.log('批量删除RSS源，共删除', deletedCount, '个');
        }
        
        return deletedCount;
    }
    
    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return 'rss_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 验证RSS源URL
     * @param {string} url - RSS源URL
     * @returns {Promise<boolean>} 是否为有效的RSS源
     */
    async validateRssUrl(url) {
        try {
            const urlObj = new URL(url);
            // 基本URL格式验证
            if (!urlObj.protocol || !['http:', 'https:'].includes(urlObj.protocol)) {
                return false;
            }
            
            // 可以进一步验证是否为RSS feed（可选）
            // 这里只做基本验证，实际验证可以通过尝试获取feed内容来实现
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 获取定时器状态
     * @returns {Promise<Object>} 定时器状态
     */
    async getSchedulerStatus() {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.rssApiUrl}/scheduler/status`;
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
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            const status = result.data || result;
            
            this.schedulerStatus = {
                enabled: status.enabled || false,
                type: status.type || 'interval',
                interval: status.interval || 3600,
                cron: status.cron || {
                    second: null,
                    minute: null,
                    hour: null,
                    day: null,
                    month: null,
                    day_of_week: null
                },
                running: status.running || false
            };
            
            return this.schedulerStatus;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.warn('获取定时器状态失败:', error);
            return this.schedulerStatus;
        }
    }
    
    /**
     * 配置定时器
     * @param {Object} config - 配置对象 {type, interval, cron, enabled}
     *   - type: 'interval' 或 'cron'
     *   - interval: 间隔秒数（interval 模式）
     *   - cron: {second, minute, hour, day, month, day_of_week} (cron 模式)
     *   - enabled: 是否启用
     * @returns {Promise<Object>} 更新后的状态
     */
    async configScheduler(config) {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.rssApiUrl}/scheduler/config`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            const status = result.data || result;
            
            this.schedulerStatus = {
                enabled: status.enabled || false,
                type: status.type || 'interval',
                interval: status.interval || 3600,
                cron: status.cron || {
                    second: null,
                    minute: null,
                    hour: null,
                    day: null,
                    month: null,
                    day_of_week: null
                },
                running: status.running || false
            };
            
            return this.schedulerStatus;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('配置定时器失败:', error);
            throw error;
        }
    }
    
    /**
     * 启动定时器
     * @returns {Promise<Object>} 定时器状态
     */
    async startScheduler() {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.rssApiUrl}/scheduler/start`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            const status = result.data || result;
            
            this.schedulerStatus.enabled = true;
            this.schedulerStatus.running = true;
            
            return this.schedulerStatus;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('启动定时器失败:', error);
            throw error;
        }
    }
    
    /**
     * 停止定时器
     * @returns {Promise<Object>} 定时器状态
     */
    async stopScheduler() {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.rssApiUrl}/scheduler/stop`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            const status = result.data || result;
            
            this.schedulerStatus.enabled = false;
            this.schedulerStatus.running = false;
            
            return this.schedulerStatus;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('停止定时器失败:', error);
            throw error;
        }
    }
    
    /**
     * 解析所有启用的RSS源
     * @returns {Promise<Object>} 解析结果
     */
    async parseAllEnabledSources() {
        if (!this.isEnabled()) {
            throw new Error('RSS源管理器未启用');
        }
        
        // 显示加载动画
        this._showLoadingAnimation();
        
        try {
            const url = `${this.rssApiUrl}/parse-all`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ force: true })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // 隐藏加载动画
            this._hideLoadingAnimation();
            
            return result.data || result;
        } catch (error) {
            // 隐藏加载动画
            this._hideLoadingAnimation();
            console.error('批量解析RSS源失败:', error);
            throw error;
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = RssSourceManager;
} else {
    window.RssSourceManager = RssSourceManager;
}


