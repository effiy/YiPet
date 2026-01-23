/**
 * 加载动画组件
 * 使用 src/assets/images/教师/run 下的连续图片生成动画
 * 优化版：添加图片预加载、错误处理和重试机制
 */

class LoadingAnimation {
    constructor() {
        this.animationElement = null;
        this.animationInterval = null;
        this.currentFrame = 1;
        this.totalFrames = 3; // 1.png, 2.png, 3.png
        this.frameDelay = 200; // 每帧延迟200ms
        this.isVisible = false;
        this.showCount = 0; // 显示计数器，支持多个调用者
        
        // 图片预加载缓存
        this.imageCache = new Map();
        this.preloadPromises = [];
        this.isPreloading = false;
        
        // 扩展上下文状态
        this.extensionContextValid = true;
        
        // 获取扩展资源URL（带错误处理）
        this.getExtensionUrl = (path) => {
            try {
                // 检查扩展上下文是否有效
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    this.extensionContextValid = false;
                    return null;
                }
                
                try {
                    // 尝试获取 runtime.id，如果失败说明上下文已失效
                    const runtimeId = chrome.runtime.id;
                    if (!runtimeId) {
                        this.extensionContextValid = false;
                        return null;
                    }
                    
                    const url = chrome.runtime.getURL(path);
                    this.extensionContextValid = true;
                    return url;
                } catch (error) {
                    // 扩展上下文已失效
                    this.extensionContextValid = false;
                    console.warn('扩展上下文已失效，无法获取资源URL:', error);
                    return null;
                }
            } catch (error) {
                console.warn('获取扩展URL失败:', error);
                this.extensionContextValid = false;
                return null;
            }
        };
    }
    
    /**
     * 创建动画元素
     */
    createAnimationElement() {
        if (this.animationElement) {
            return this.animationElement;
        }
        
        // 创建容器
        const container = document.createElement('div');
        container.id = 'pet-loading-animation';
        // 样式已通过 CSS 类定义

        // 创建图片元素
        const img = document.createElement('img');
        img.id = 'pet-loading-animation-img';
        // 样式已通过 CSS 类定义
        
        container.appendChild(img);
        document.body.appendChild(container);
        
        this.animationElement = container;
        this.animationImg = img;
        
        return container;
    }
    
    /**
     * 显示动画
     */
    async show() {
        this.showCount++;
        
        if (this.isVisible) {
            return;
        }
        
        this.createAnimationElement();
        this.isVisible = true;
        this.currentFrame = 1;
        
        // 检查扩展上下文
        if (!this.extensionContextValid) {
            // 尝试重新检查
            const testUrl = this.getExtensionUrl('src/assets/images/教师/run/1.png');
            if (!testUrl) {
                console.warn('[LoadingAnimation] 扩展上下文无效，无法显示动画');
                return;
            }
        }
        
        // 预加载图片（如果还没预加载）
        if (this.imageCache.size === 0) {
            try {
                await this.preloadImages();
            } catch (error) {
                console.warn('[LoadingAnimation] 预加载失败，将使用实时加载:', error);
            }
        }
        
        // 显示容器
        if (this.animationElement) {
            this.animationElement.classList.add('js-visible');
        }
        
        // 开始动画循环
        this.startAnimation();
    }
    
    /**
     * 隐藏动画
     */
    hide() {
        this.showCount = Math.max(0, this.showCount - 1);
        
        // 只有当所有调用者都调用了 hide 时才真正隐藏
        if (this.showCount > 0) {
            return;
        }
        
        if (!this.isVisible) {
            return;
        }
        
        this.isVisible = false;
        
        // 停止动画循环
        this.stopAnimation();
        
        // 隐藏容器
        if (this.animationElement) {
            this.animationElement.classList.remove('js-visible');
        }
    }
    
    /**
     * 开始动画循环
     */
    startAnimation() {
        if (this.animationInterval) {
            return;
        }
        
        // 立即显示第一帧
        this.updateFrame();
        
        // 设置循环（使用更稳定的方式）
        this.animationInterval = setInterval(async () => {
            // 检查扩展上下文
            if (!this.extensionContextValid) {
                this.stopAnimation();
                return;
            }
            
            this.currentFrame = (this.currentFrame % this.totalFrames) + 1;
            await this.updateFrame();
        }, this.frameDelay);
    }
    
    /**
     * 停止动画循环
     */
    stopAnimation() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }
    
    /**
     * 预加载所有动画帧图片（优化版：使用统一的图片资源管理器）
     */
    async preloadImages() {
        if (this.isPreloading) {
            return Promise.all(this.preloadPromises);
        }
        
        this.isPreloading = true;
        this.preloadPromises = [];
        
        // 优先使用统一的图片资源管理器
        if (window.imageResourceManager) {
            try {
                const role = '教师';
                const images = await window.imageResourceManager.preloadRunFrames(role, this.totalFrames);
                // 同步到本地缓存
                images.forEach((img, index) => {
                    if (img) {
                        this.imageCache.set(index + 1, img);
                    }
                });
                console.log('[LoadingAnimation] 图片预加载完成（使用图片资源管理器）');
                this.isPreloading = false;
                return;
            } catch (error) {
                console.warn('[LoadingAnimation] 使用图片资源管理器预加载失败，降级到原始方法:', error);
            }
        }
        
        // 降级：使用原始预加载方法
        for (let frame = 1; frame <= this.totalFrames; frame++) {
            const promise = this.loadImage(frame);
            this.preloadPromises.push(promise);
        }
        
        try {
            await Promise.all(this.preloadPromises);
            console.log('[LoadingAnimation] 图片预加载完成');
        } catch (error) {
            console.warn('[LoadingAnimation] 部分图片预加载失败:', error);
        } finally {
            this.isPreloading = false;
        }
    }
    
    /**
     * 加载单张图片（带重试机制，优化版：使用统一的图片资源管理器）
     */
    async loadImage(frame, retries = 3) {
        const imagePath = `src/assets/images/教师/run/${frame}.png`;
        
        // 优先使用统一的图片资源管理器
        if (window.imageResourceManager) {
            try {
                const img = await window.imageResourceManager.loadImage(imagePath, retries);
                // 同步到本地缓存
                this.imageCache.set(frame, img);
                return img;
            } catch (error) {
                console.warn(`[LoadingAnimation] 使用图片资源管理器加载失败: ${imagePath}`, error);
                // 降级到原始方法
            }
        }
        
        // 降级：使用原始加载方法
        return new Promise((resolve, reject) => {
            // 检查缓存
            if (this.imageCache.has(frame)) {
                const cached = this.imageCache.get(frame);
                if (cached && cached.complete && cached.naturalWidth > 0) {
                    resolve(cached);
                    return;
                }
            }
            
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
                    
                    if (attemptCount < retries) {
                        // 重试
                        setTimeout(attemptLoad, 100 * attemptCount);
                    } else {
                        reject(new Error(`图片加载超时: ${imagePath}`));
                    }
                }, 3000);
                
                img.onload = () => {
                    clearTimeout(timeout);
                    img.onload = null;
                    img.onerror = null;
                    
                    // 缓存图片
                    this.imageCache.set(frame, img);
                    resolve(img);
                };
                
                img.onerror = (error) => {
                    clearTimeout(timeout);
                    img.onload = null;
                    img.onerror = null;
                    
                    // 如果扩展上下文失效，不再重试
                    if (!this.extensionContextValid) {
                        reject(new Error('扩展上下文已失效'));
                        return;
                    }
                    
                    if (attemptCount < retries) {
                        // 重试前等待一段时间
                        setTimeout(attemptLoad, 100 * attemptCount);
                    } else {
                        console.warn(`[LoadingAnimation] 图片加载失败 (${attemptCount}次重试): ${imagePath}`);
                        reject(error);
                    }
                };
                
                // 设置 src（触发加载）
                // 直接使用 URL，允许浏览器缓存
                img.src = imageUrl;
            };
            
            attemptLoad();
        });
    }
    
    /**
     * 更新当前帧（优化版：使用预加载的图片，避免重复请求）
     */
    async updateFrame() {
        if (!this.animationImg) {
            return;
        }
        
        // 如果扩展上下文已失效，不更新
        if (!this.extensionContextValid) {
            return;
        }
        
        // 优先使用统一的图片资源管理器获取 data URL
        if (window.imageResourceManager) {
            try {
                const role = '教师';
                const frameUrl = await window.imageResourceManager.getRunFrameUrl(role, this.currentFrame);
                if (frameUrl && this.animationImg.src !== frameUrl) {
                    this.animationImg.src = frameUrl;
                }
                return;
            } catch (error) {
                console.debug(`[LoadingAnimation] 使用图片资源管理器获取帧失败，降级:`, error);
            }
        }
        
        // 降级：尝试从缓存获取
        const cachedImg = this.imageCache.get(this.currentFrame);
        
        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
            // 使用缓存的图片
            // 避免重复设置相同的 src（防止 canceled）
            if (this.animationImg.src !== cachedImg.src) {
                this.animationImg.src = cachedImg.src;
            }
        } else {
            // 如果缓存中没有或图片未加载完成，使用原始URL（降级方案）
            // 同时尝试异步加载到缓存
            const imagePath = `src/assets/images/教师/run/${this.currentFrame}.png`;
            const imageUrl = this.getExtensionUrl(imagePath);
            if (imageUrl) {
                // 避免重复设置相同的 src（防止 canceled）
                if (this.animationImg.src !== imageUrl) {
                    this.animationImg.src = imageUrl;
                }
                
                // 异步加载到缓存（不阻塞当前帧显示）
                if (!cachedImg) {
                    this.loadImage(this.currentFrame, 2).catch(error => {
                        // 静默处理加载失败
                        console.debug(`[LoadingAnimation] 后台加载第${this.currentFrame}帧失败:`, error);
                    });
                }
            }
        }
    }
    
    /**
     * 销毁动画元素
     */
    destroy() {
        this.hide();
        
        // 清理图片缓存
        this.imageCache.clear();
        this.preloadPromises = [];
        this.isPreloading = false;
        
        if (this.animationElement && this.animationElement.parentNode) {
            this.animationElement.parentNode.removeChild(this.animationElement);
            this.animationElement = null;
            this.animationImg = null;
        }
    }
    
    /**
     * 重置扩展上下文状态（当扩展重新加载时调用）
     */
    resetExtensionContext() {
        this.extensionContextValid = true;
        // 清理缓存，强制重新加载
        this.imageCache.clear();
        this.preloadPromises = [];
        this.isPreloading = false;
    }
}

// 创建全局单例
if (typeof window.petLoadingAnimation === 'undefined') {
    window.petLoadingAnimation = new LoadingAnimation();
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = LoadingAnimation;
} else {
    window.LoadingAnimation = LoadingAnimation;
}

