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
        if (!window.imageResourceManager) {
            console.warn('[LoadingAnimation] 缺少 imageResourceManager，无法显示动画');
            return;
        }
        
        // 预加载图片（如果还没预加载）
        if (this.imageCache.size === 0) {
            await this.preloadImages();
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
        if (!window.imageResourceManager) {
            this.isPreloading = false;
            throw new Error('缺少 imageResourceManager');
        }

        try {
            const role = '教师';
            const promises = [];
            for (let frame = 1; frame <= this.totalFrames; frame++) {
                const imagePath = `src/assets/images/${role}/run/${frame}.png`;
                promises.push(
                    window.imageResourceManager.loadImage(imagePath).then((img) => {
                        this.imageCache.set(frame, img);
                    })
                );
            }
            await Promise.all(promises);
            console.log('[LoadingAnimation] 图片预加载完成');
        } finally {
            this.isPreloading = false;
        }
    }
    
    /**
     * 加载单张图片（带重试机制，优化版：使用统一的图片资源管理器）
     */
    async loadImage(frame, retries = 3) {
        const imagePath = `src/assets/images/教师/run/${frame}.png`;
        if (!window.imageResourceManager) {
            throw new Error('缺少 imageResourceManager');
        }

        const img = await window.imageResourceManager.loadImage(imagePath, retries);
        this.imageCache.set(frame, img);
        return img;
    }
    
    /**
     * 更新当前帧（优化版：使用预加载的图片，避免重复请求）
     */
    async updateFrame() {
        if (!this.animationImg) {
            return;
        }

        if (!window.imageResourceManager) {
            this.stopAnimation();
            return;
        }

        try {
            const role = '教师';
            const frameUrl = await window.imageResourceManager.getRunFrameUrl(role, this.currentFrame);
            if (frameUrl && this.animationImg.src !== frameUrl) {
                this.animationImg.src = frameUrl;
            }
        } catch (error) {
            this.stopAnimation();
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
