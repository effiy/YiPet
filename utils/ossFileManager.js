/**
 * OSS文件管理器
 * 管理OSS文件列表的加载、缓存和操作
 */

class OssFileManager {
    constructor(options = {}) {
        // 配置选项
        this.ossApi = options.ossApi || null; // OssApiManager 实例
        this.enableCache = options.enableCache !== false; // 是否启用缓存
        
        // 文件数据
        this.files = []; // 存储所有文件列表
        this.lastLoadTime = 0; // 上次加载时间
        this.loading = false; // 是否正在加载
        
        // 请求去重
        this.pendingLoadRequest = null;
        
        // 初始化
        this._initialized = false;
    }
    
    /**
     * 初始化文件管理器
     */
    async initialize() {
        if (this._initialized) {
            return;
        }
        
        // 从本地存储加载缓存的文件列表
        if (this.enableCache) {
            await this.loadCachedFiles();
        }
        
        this._initialized = true;
    }
    
    /**
     * 从本地存储加载缓存的文件列表
     */
    async loadCachedFiles() {
        try {
            if (typeof StorageHelper !== 'undefined' && StorageHelper.get) {
                const cachedFiles = await StorageHelper.get('petOssFiles');
                if (Array.isArray(cachedFiles)) {
                    this.files = cachedFiles;
                    console.log('已从缓存加载OSS文件列表，文件数:', this.files.length);
                }
            } else if (typeof chrome !== 'undefined' && chrome.storage) {
                return new Promise((resolve) => {
                    chrome.storage.local.get(['petOssFiles'], (result) => {
                        if (chrome.runtime.lastError) {
                            console.warn('加载OSS文件缓存失败:', chrome.runtime.lastError);
                            resolve();
                            return;
                        }
                        if (result.petOssFiles && Array.isArray(result.petOssFiles)) {
                            this.files = result.petOssFiles;
                            console.log('已从缓存加载OSS文件列表，文件数:', this.files.length);
                        }
                        resolve();
                    });
                });
            }
        } catch (error) {
            console.warn('加载OSS文件缓存失败:', error);
        }
    }
    
    /**
     * 保存文件列表到本地存储
     */
    async saveCachedFiles() {
        try {
            if (typeof StorageHelper !== 'undefined' && StorageHelper.set) {
                await StorageHelper.set('petOssFiles', this.files);
            } else if (typeof chrome !== 'undefined' && chrome.storage) {
                return new Promise((resolve) => {
                    chrome.storage.local.set({ petOssFiles: this.files }, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('保存OSS文件缓存失败:', chrome.runtime.lastError);
                        }
                        resolve();
                    });
                });
            }
        } catch (error) {
            console.warn('保存OSS文件缓存失败:', error);
        }
    }
    
    /**
     * 从后端加载文件列表
     * @param {boolean} forceRefresh - 是否强制刷新
     * @param {Array<string>} filterTags - 过滤标签（可选）
     * @returns {Promise<Array>} 文件列表
     */
    async loadBackendFiles(forceRefresh = false, filterTags = null) {
        if (!this.ossApi || !this.ossApi.isEnabled()) {
            console.warn('OSS API未启用，无法加载文件列表');
            return this.files;
        }
        
        // 如果正在加载，等待现有请求完成
        if (this.pendingLoadRequest) {
            return await this.pendingLoadRequest;
        }
        
        // 检查是否需要刷新（如果距离上次加载超过5分钟，自动刷新）
        const now = Date.now();
        const shouldRefresh = forceRefresh || 
                            (now - this.lastLoadTime > 5 * 60 * 1000) ||
                            this.files.length === 0;
        
        if (!shouldRefresh && !forceRefresh) {
            console.log('使用缓存的OSS文件列表');
            return this.files;
        }
        
        // 创建加载请求
        this.loading = true;
        this.pendingLoadRequest = (async () => {
            try {
                console.log('从后端加载OSS文件列表...');
                
                const options = {
                    forceRefresh: forceRefresh
                };
                
                if (filterTags && Array.isArray(filterTags) && filterTags.length > 0) {
                    options.tags = filterTags;
                }
                
                const files = await this.ossApi.getFilesList(options);
                
                if (Array.isArray(files)) {
                    this.files = files;
                    this.lastLoadTime = Date.now();
                    
                    // 保存到缓存
                    if (this.enableCache) {
                        await this.saveCachedFiles();
                    }
                    
                    console.log('OSS文件列表加载完成，文件数:', this.files.length);
                } else {
                    console.warn('OSS文件列表格式异常:', files);
                }
                
                return this.files;
            } catch (error) {
                console.error('加载OSS文件列表失败:', error);
                // 如果加载失败，返回缓存的列表
                return this.files;
            } finally {
                this.loading = false;
                this.pendingLoadRequest = null;
            }
        })();
        
        return await this.pendingLoadRequest;
    }
    
    /**
     * 刷新文件列表
     * @param {boolean} forceRefresh - 是否强制刷新
     * @returns {Promise<Array>} 文件列表
     */
    async refreshFiles(forceRefresh = true) {
        return await this.loadBackendFiles(forceRefresh);
    }
    
    /**
     * 获取所有文件
     * @returns {Array} 文件列表
     */
    getAllFiles() {
        return this.files || [];
    }
    
    /**
     * 根据文件名获取文件
     * @param {string} fileName - 文件名
     * @returns {Object|null} 文件对象
     */
    getFileByName(fileName) {
        return this.files.find(file => file.name === fileName) || null;
    }
    
    /**
     * 根据URL获取文件
     * @param {string} url - 文件URL
     * @returns {Object|null} 文件对象
     */
    getFileByUrl(url) {
        return this.files.find(file => file.url === url) || null;
    }
    
    /**
     * 删除文件（从列表中移除）
     * @param {string} fileName - 文件名
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteFile(fileName) {
        try {
            // 如果OSS API可用，先调用删除接口
            if (this.ossApi && this.ossApi.isEnabled()) {
                await this.ossApi.deleteFile(fileName);
            }
            
            // 从列表中移除
            const index = this.files.findIndex(file => file.name === fileName);
            if (index !== -1) {
                this.files.splice(index, 1);
                
                // 更新缓存
                if (this.enableCache) {
                    await this.saveCachedFiles();
                }
                
                console.log('已从文件列表中删除:', fileName);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('删除OSS文件失败:', error);
            throw error;
        }
    }
    
    /**
     * 添加或更新文件（用于上传后更新列表）
     * @param {Object} file - 文件对象
     */
    async addOrUpdateFile(file) {
        const index = this.files.findIndex(f => f.name === file.name);
        if (index !== -1) {
            // 更新现有文件
            this.files[index] = { ...this.files[index], ...file };
        } else {
            // 添加新文件
            this.files.push(file);
        }
        
        // 更新缓存
        if (this.enableCache) {
            await this.saveCachedFiles();
        }
    }
    
    /**
     * 清空文件列表
     */
    clearFiles() {
        this.files = [];
        this.lastLoadTime = 0;
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = OssFileManager;
} else {
    window.OssFileManager = OssFileManager;
}

