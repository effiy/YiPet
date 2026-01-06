/**
 * 图片资源管理器
 * 统一管理角色图片的加载和缓存，避免重复请求和死循环
 */

class ImageResourceManager {
    constructor() {
        // 图片缓存：key 为图片路径，value 为 Image 对象或 data URL
        this.imageCache = new Map();
        // 加载中的 Promise：避免重复加载同一张图片
        this.loadingPromises = new Map();
        // 加载失败的图片：记录失败次数，避免无限重试
        this.failedImages = new Map();
        // 最大重试次数
        this.maxRetries = 3;
        // 扩展上下文状态
        this.extensionContextValid = true;
    }

    /**
     * 获取扩展资源 URL
     */
    getExtensionUrl(path) {
        try {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                this.extensionContextValid = false;
                return null;
            }
            
            try {
                const runtimeId = chrome.runtime.id;
                if (!runtimeId) {
                    this.extensionContextValid = false;
                    return null;
                }
                
                const url = chrome.runtime.getURL(path);
                this.extensionContextValid = true;
                return url;
            } catch (error) {
                this.extensionContextValid = false;
                console.warn('[ImageResourceManager] 扩展上下文已失效:', error);
                return null;
            }
        } catch (error) {
            console.warn('[ImageResourceManager] 获取扩展URL失败:', error);
            this.extensionContextValid = false;
            return null;
        }
    }

    /**
     * 加载单张图片（带缓存和去重）
     * @param {string} imagePath - 图片路径（如 'roles/教师/run/1.png'）
     * @param {number} retries - 重试次数
     * @returns {Promise<Image>} 加载完成的 Image 对象
     */
    async loadImage(imagePath, retries = this.maxRetries) {
        // 检查缓存
        if (this.imageCache.has(imagePath)) {
            const cached = this.imageCache.get(imagePath);
            if (cached && cached.complete && cached.naturalWidth > 0) {
                return cached;
            }
            // 缓存中的图片无效，清除
            this.imageCache.delete(imagePath);
        }

        // 检查是否正在加载
        if (this.loadingPromises.has(imagePath)) {
            return this.loadingPromises.get(imagePath);
        }

        // 检查失败次数
        const failCount = this.failedImages.get(imagePath) || 0;
        if (failCount >= retries) {
            throw new Error(`图片加载失败次数过多: ${imagePath}`);
        }

        // 创建加载 Promise
        const loadPromise = this._loadImageInternal(imagePath, retries);
        this.loadingPromises.set(imagePath, loadPromise);

        try {
            const img = await loadPromise;
            // 加载成功，清除失败记录
            this.failedImages.delete(imagePath);
            return img;
        } catch (error) {
            // 记录失败次数
            this.failedImages.set(imagePath, failCount + 1);
            throw error;
        } finally {
            // 清除加载中的 Promise
            this.loadingPromises.delete(imagePath);
        }
    }

    /**
     * 内部加载方法
     */
    _loadImageInternal(imagePath, maxRetries) {
        return new Promise((resolve, reject) => {
            const imageUrl = this.getExtensionUrl(imagePath);
            
            if (!imageUrl) {
                reject(new Error('无法获取扩展资源URL'));
                return;
            }

            const img = new Image();
            let attemptCount = 0;

            const attemptLoad = () => {
                attemptCount++;

                // 设置超时
                const timeout = setTimeout(() => {
                    img.onload = null;
                    img.onerror = null;
                    
                    if (attemptCount < maxRetries) {
                        setTimeout(attemptLoad, 100 * attemptCount);
                    } else {
                        reject(new Error(`图片加载超时: ${imagePath}`));
                    }
                }, 3000);

                img.onload = () => {
                    clearTimeout(timeout);
                    img.onload = null;
                    img.onerror = null;
                    
                    // 验证图片是否真正加载成功
                    if (img.complete && img.naturalWidth > 0) {
                        // 缓存图片
                        this.imageCache.set(imagePath, img);
                        resolve(img);
                    } else {
                        if (attemptCount < maxRetries) {
                            setTimeout(attemptLoad, 100 * attemptCount);
                        } else {
                            reject(new Error(`图片加载不完整: ${imagePath}`));
                        }
                    }
                };

                img.onerror = (error) => {
                    clearTimeout(timeout);
                    img.onload = null;
                    img.onerror = null;
                    
                    if (!this.extensionContextValid) {
                        reject(new Error('扩展上下文已失效'));
                        return;
                    }
                    
                    if (attemptCount < maxRetries) {
                        setTimeout(attemptLoad, 100 * attemptCount);
                    } else {
                        reject(new Error(`图片加载失败: ${imagePath}`));
                    }
                };

                // 设置 src（触发加载）
                img.src = imageUrl;
            };

            attemptLoad();
        });
    }

    /**
     * 预加载角色运行动画的所有帧
     * @param {string} role - 角色名称（如 '教师'）
     * @param {number} frameCount - 帧数（默认 3）
     * @returns {Promise<Image[]>} 所有帧的 Image 对象数组
     */
    async preloadRunFrames(role = '教师', frameCount = 3) {
        const promises = [];
        for (let frame = 1; frame <= frameCount; frame++) {
            const imagePath = `assets/images/roles/${role}/run/${frame}.png`;
            promises.push(
                this.loadImage(imagePath).catch(error => {
                    console.warn(`[ImageResourceManager] 预加载失败: ${imagePath}`, error);
                    return null; // 返回 null 而不是抛出错误，允许部分成功
                })
            );
        }
        const results = await Promise.all(promises);
        return results.filter(img => img !== null);
    }

    /**
     * 获取角色图标
     * @param {string} role - 角色名称
     * @returns {Promise<Image>} 图标 Image 对象
     */
    async loadRoleIcon(role = '教师') {
        const imagePath = `assets/images/roles/${role}/icon.png`;
        return this.loadImage(imagePath);
    }

    /**
     * 获取图片的 data URL（用于避免重复请求）
     * @param {string} imagePath - 图片路径
     * @returns {Promise<string>} data URL
     */
    async getImageDataUrl(imagePath) {
        const img = await this.loadImage(imagePath);
        return this._imageToDataUrl(img);
    }

    /**
     * 将 Image 对象转换为 data URL
     */
    _imageToDataUrl(img) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return canvas.toDataURL('image/png');
        } catch (error) {
            console.warn('[ImageResourceManager] 转换为 data URL 失败:', error);
            // 降级：返回原始 URL
            return img.src;
        }
    }

    /**
     * 获取运行动画帧的 URL（优先使用 data URL 避免重复请求）
     * @param {string} role - 角色名称
     * @param {number} frame - 帧数（1-3）
     * @returns {Promise<string>} 图片 URL 或 data URL
     */
    async getRunFrameUrl(role = '教师', frame = 1) {
        const imagePath = `assets/images/roles/${role}/run/${frame}.png`;
        
        // 如果缓存中有，尝试使用 data URL
        if (this.imageCache.has(imagePath)) {
            const cached = this.imageCache.get(imagePath);
            if (cached && cached.complete && cached.naturalWidth > 0) {
                try {
                    return this._imageToDataUrl(cached);
                } catch (error) {
                    // 降级：返回原始 URL
                    return cached.src;
                }
            }
        }
        
        // 否则加载图片并返回 data URL
        try {
            const img = await this.loadImage(imagePath);
            return this._imageToDataUrl(img);
        } catch (error) {
            // 如果加载失败，返回原始 URL（让浏览器处理）
            const url = this.getExtensionUrl(imagePath);
            return url || '';
        }
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.imageCache.clear();
        this.loadingPromises.clear();
        this.failedImages.clear();
    }

    /**
     * 重置扩展上下文状态
     */
    resetExtensionContext() {
        this.extensionContextValid = true;
        this.clearCache();
    }
}

// 创建全局单例
if (typeof window.imageResourceManager === 'undefined') {
    window.imageResourceManager = new ImageResourceManager();
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = ImageResourceManager;
} else {
    window.ImageResourceManager = ImageResourceManager;
}

