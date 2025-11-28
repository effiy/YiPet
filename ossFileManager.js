/**
 * OSS 文件管理器
 * 统一管理前端 OSS 文件的加载、缓存等功能
 * 提供清晰的 API 接口，与后端 OSS 路由对接
 */

class OssFileManager {
    constructor(options = {}) {
        // 配置选项
        this.ossApi = options.ossApi || null; // OssApiManager 实例
        this.enableBackendSync = options.enableBackendSync || false; // 是否启用后端同步
        
        // 文件数据
        this.files = []; // 存储所有文件列表
        this.currentDirectory = options.directory || ''; // 当前目录
        
        // 同步和保存优化
        this.lastFileListLoadTime = 0;
        this.fileListUpdateTimer = null;
        this.pendingFileListUpdate = false;
        this.FILE_LIST_UPDATE_DEBOUNCE = options.debounceTime || 300; // 文件列表更新防抖时间（毫秒）
        this.FILE_LIST_LOAD_THROTTLE = options.throttleTime || 1000; // 文件列表加载节流时间（毫秒）
        
        // 文件列表加载控制
        this.FILE_LIST_RELOAD_INTERVAL = options.reloadInterval || 10000; // 文件列表重新加载间隔
        
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
        
        // 不再在初始化时自动加载后端文件列表
        // 改为在第一次打开聊天窗口时调用 loadBackendFiles()
        // 这样可以避免页面刷新时自动调用 files 接口
        
        this._initialized = true;
    }
    
    /**
     * 从后端加载文件列表
     * @param {boolean} forceRefresh - 是否强制刷新
     * @param {Array<string>} tags - 标签筛选（可选）
     */
    async loadBackendFiles(forceRefresh = false, tags = null) {
        if (!this.ossApi || !this.enableBackendSync) {
            return;
        }
        
        const now = Date.now();
        
        // 如果不是强制刷新，且距离上次加载时间太短，则跳过（有标签筛选时总是刷新）
        if (!forceRefresh && !tags && (now - this.lastFileListLoadTime) < this.FILE_LIST_RELOAD_INTERVAL) {
            return;
        }
        
        try {
            const files = await this.ossApi.getFilesList({
                directory: this.currentDirectory,
                forceRefresh: forceRefresh,
                tags: tags
            });
            
            if (Array.isArray(files)) {
                this.files = files;
                this.lastFileListLoadTime = now;
                
                console.log('文件列表已从后端加载，共', files.length, '个文件');
            }
        } catch (error) {
            console.warn('从后端加载文件列表失败:', error);
        }
    }
    
    /**
     * 获取所有文件列表
     * @returns {Array} 文件列表
     */
    getAllFiles() {
        return this.files || [];
    }
    
    /**
     * 设置当前目录
     */
    setDirectory(directory) {
        this.currentDirectory = directory || '';
    }
    
    /**
     * 获取当前目录
     */
    getDirectory() {
        return this.currentDirectory;
    }
    
    /**
     * 刷新文件列表（从后端重新加载）
     * @param {boolean} forceRefresh - 是否强制刷新
     * @param {Array<string>} tags - 标签筛选（可选）
     */
    async refreshFiles(forceRefresh = false, tags = null) {
        if (this.ossApi && this.enableBackendSync) {
            await this.loadBackendFiles(forceRefresh, tags);
        }
    }
    
    /**
     * 删除文件
     * @param {string} objectName - 文件对象名
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteFile(objectName) {
        if (!this.ossApi || !this.enableBackendSync) {
            return false;
        }
        
        try {
            await this.ossApi.deleteFile(objectName);
            
            // 从本地列表中移除
            this.files = this.files.filter(file => file.name !== objectName);
            
            return true;
        } catch (error) {
            console.error('删除文件失败:', error);
            return false;
        }
    }
    
    /**
     * 搜索文件
     */
    async searchFiles(query, limit = 50) {
        if (!query) {
            return [];
        }
        
        // 从本地搜索
        const localResults = this.getAllFiles().filter(file => {
            const fileName = (file.name || '').toLowerCase();
            return fileName.includes(query.toLowerCase());
        }).slice(0, limit);
        
        return localResults;
    }
    
    /**
     * 下载文件
     * @param {string} objectName - 文件对象名
     * @param {string} filename - 下载时的文件名（可选）
     * @returns {Promise<boolean>} 是否下载成功
     */
    async downloadFile(objectName, filename = null) {
        if (!this.ossApi || !this.enableBackendSync) {
            console.warn('OSS API 未启用，无法下载文件');
            return false;
        }
        
        try {
            await this.ossApi.downloadFile(objectName, filename);
            return true;
        } catch (error) {
            console.error('下载文件失败:', error);
            return false;
        }
    }
    
    /**
     * 获取文件下载 URL
     * @param {string} objectName - 文件对象名
     * @param {number} expires - URL 过期时间（秒，默认 3600）
     * @returns {Promise<string|null>} 下载 URL，失败返回 null
     */
    async getDownloadUrl(objectName, expires = 3600) {
        if (!this.ossApi || !this.enableBackendSync) {
            console.warn('OSS API 未启用，无法获取下载 URL');
            return null;
        }
        
        try {
            return await this.ossApi.getDownloadUrl(objectName, expires);
        } catch (error) {
            console.error('获取下载 URL 失败:', error);
            return null;
        }
    }
    
    /**
     * 清空文件列表
     */
    async clearAllFiles() {
        this.files = [];
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = OssFileManager;
} else {
    window.OssFileManager = OssFileManager;
}

