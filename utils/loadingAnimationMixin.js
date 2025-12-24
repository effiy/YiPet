/**
 * 加载动画混入工具
 * 
 * 功能说明：
 * - 提供统一的加载动画管理逻辑，避免代码重复
 * - 可以作为 Mixin 混入到类中，或作为独立工具使用
 * 
 * 使用示例：
 * ```javascript
 * // 方式1: 作为 Mixin 混入
 * class MyClass extends LoadingAnimationMixin {
 *     constructor() {
 *         super();
 *         // 初始化 activeRequestCount
 *         this.activeRequestCount = 0;
 *     }
 * }
 * 
 * // 方式2: 作为工具函数使用
 * LoadingAnimationMixin.show();
 * LoadingAnimationMixin.hide();
 * ```
 */

class LoadingAnimationMixin {
    /**
     * 显示加载动画（静态方法）
     * @param {Object} context - 上下文对象（包含 activeRequestCount 属性）
     */
    static show(context = null) {
        if (context) {
            context.activeRequestCount = (context.activeRequestCount || 0) + 1;
            if (context.activeRequestCount === 1 && this._canShowAnimation()) {
                this._doShowAnimation();
            }
        } else {
            // 全局计数器（如果作为独立工具使用）
            if (!this._globalRequestCount) {
                this._globalRequestCount = 0;
            }
            this._globalRequestCount++;
            if (this._globalRequestCount === 1 && this._canShowAnimation()) {
                this._doShowAnimation();
            }
        }
    }

    /**
     * 隐藏加载动画（静态方法）
     * @param {Object} context - 上下文对象（包含 activeRequestCount 属性）
     */
    static hide(context = null) {
        if (context) {
            context.activeRequestCount = Math.max(0, (context.activeRequestCount || 0) - 1);
            if (context.activeRequestCount === 0 && this._canShowAnimation()) {
                this._doHideAnimation();
            }
        } else {
            // 全局计数器
            if (this._globalRequestCount) {
                this._globalRequestCount = Math.max(0, this._globalRequestCount - 1);
                if (this._globalRequestCount === 0 && this._canShowAnimation()) {
                    this._doHideAnimation();
                }
            }
        }
    }

    /**
     * 检查是否可以显示动画
     * @returns {boolean} 是否可以显示动画
     */
    static _canShowAnimation() {
        return typeof window !== 'undefined' && window.petLoadingAnimation;
    }

    /**
     * 执行显示动画
     */
    static _doShowAnimation() {
        try {
            if (window.petLoadingAnimation && typeof window.petLoadingAnimation.show === 'function') {
                window.petLoadingAnimation.show();
            }
        } catch (e) {
            console.warn('显示加载动画失败:', e);
        }
    }

    /**
     * 执行隐藏动画
     */
    static _doHideAnimation() {
        try {
            if (window.petLoadingAnimation && typeof window.petLoadingAnimation.hide === 'function') {
                window.petLoadingAnimation.hide();
            }
        } catch (e) {
            console.warn('隐藏加载动画失败:', e);
        }
    }

    /**
     * 实例方法：显示加载动画
     */
    _showLoadingAnimation() {
        LoadingAnimationMixin.show(this);
    }

    /**
     * 实例方法：隐藏加载动画
     */
    _hideLoadingAnimation() {
        LoadingAnimationMixin.hide(this);
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = LoadingAnimationMixin;
} else {
    if (typeof window !== 'undefined') {
        window.LoadingAnimationMixin = LoadingAnimationMixin;
    }
    if (typeof self !== 'undefined') {
        self.LoadingAnimationMixin = LoadingAnimationMixin;
    }
}

