/**
 * 加载动画组件
 * 使用 roles/教师/run 下的连续图片生成动画
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
        
        // 获取扩展资源URL
        this.getExtensionUrl = (path) => {
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                    return chrome.runtime.getURL(path);
                }
                // 备用方案：如果是开发环境，可能需要使用相对路径
                return path;
            } catch (error) {
                console.warn('获取扩展URL失败:', error);
                return path;
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
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 2147483649;
            pointer-events: none;
            display: none;
        `;
        
        // 创建图片元素
        const img = document.createElement('img');
        img.id = 'pet-loading-animation-img';
        img.style.cssText = `
            width: 120px;
            height: 120px;
            object-fit: contain;
            animation: none;
        `;
        
        container.appendChild(img);
        document.body.appendChild(container);
        
        this.animationElement = container;
        this.animationImg = img;
        
        return container;
    }
    
    /**
     * 显示动画
     */
    show() {
        this.showCount++;
        
        if (this.isVisible) {
            return;
        }
        
        this.createAnimationElement();
        this.isVisible = true;
        this.currentFrame = 1;
        
        // 显示容器
        if (this.animationElement) {
            this.animationElement.style.display = 'block';
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
            this.animationElement.style.display = 'none';
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
        
        // 设置循环
        this.animationInterval = setInterval(() => {
            this.currentFrame = (this.currentFrame % this.totalFrames) + 1;
            this.updateFrame();
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
     * 更新当前帧
     */
    updateFrame() {
        if (!this.animationImg) {
            return;
        }
        
        const imagePath = `roles/教师/run/${this.currentFrame}.png`;
        const imageUrl = this.getExtensionUrl(imagePath);
        
        this.animationImg.src = imageUrl;
    }
    
    /**
     * 销毁动画元素
     */
    destroy() {
        this.hide();
        
        if (this.animationElement && this.animationElement.parentNode) {
            this.animationElement.parentNode.removeChild(this.animationElement);
            this.animationElement = null;
            this.animationImg = null;
        }
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

