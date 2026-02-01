/**
 * 通知工具类
 * 
 * 功能说明：
 * - 提供统一的通知显示功能
 * - 避免在多个文件中重复实现通知逻辑
 * - 支持不同类型的通知（success、error、info）
 * 
 * 使用示例：
 * ```javascript
 * // 显示成功通知
 * NotificationUtils.show('操作成功', 'success');
 * 
 * // 显示错误通知
 * NotificationUtils.show('操作失败', 'error');
 * 
 * // 显示信息通知
 * NotificationUtils.show('提示信息', 'info');
 * ```
 */

class NotificationUtils {
    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型：'success' | 'error' | 'info'
     * @param {Object} options - 选项 {position: 'top'|'right', duration: number}
     */
    static show(message, type = 'success', options = {}) {
        if (!message) return;

        const position = options.position || 'right'; // 'top' 或 'right'
        const duration = options.duration || 3000;
        const baseClass = options.baseClass || 'pet-notification';
        const includePositionClass = options.includePositionClass !== false;
        const exitingClass = options.exitingClass || 'notification-exiting';
        const zIndex = options.zIndex || (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.ui && PET_CONFIG.ui.zIndex && PET_CONFIG.ui.zIndex.modal) 
            ? PET_CONFIG.ui.zIndex.modal + 1 
            : 2147483650;

        // 创建通知元素（使用 CSS 类，样式已在 content.css 中定义）
        const notification = document.createElement('div');
        const parts = [baseClass, type];
        if (includePositionClass) parts.push(`notification-${position}`);
        notification.className = parts.filter(Boolean).join(' ');
        notification.textContent = message;

        // 只设置动态的 z-index（如果需要覆盖默认值）
        if (zIndex !== 2147483650) {
            notification.style.setProperty('z-index', zIndex.toString(), 'important');
        }

        // 将通知添加到页面
        if (document.body) {
            document.body.appendChild(notification);
        }

        // 延迟移除通知（自动消失）
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add(exitingClass);
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, duration);
    }

    /**
     * 显示成功通知
     * @param {string} message - 通知消息
     * @param {Object} options - 选项
     */
    static success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    /**
     * 显示错误通知
     * @param {string} message - 通知消息
     * @param {Object} options - 选项
     */
    static error(message, options = {}) {
        return this.show(message, 'error', options);
    }

    /**
     * 显示信息通知
     * @param {string} message - 通知消息
     * @param {Object} options - 选项
     */
    static info(message, options = {}) {
        return this.show(message, 'info', options);
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = NotificationUtils;
} else if (typeof self !== "undefined") {
    // Service Worker / Web Worker 环境
    self.NotificationUtils = NotificationUtils;
    if (typeof globalThis !== "undefined") {
        globalThis.NotificationUtils = NotificationUtils;
    }
} else if (typeof window !== "undefined") {
    // 浏览器环境
    window.NotificationUtils = NotificationUtils;
} else {
    // 最后兜底
    try {
        globalThis.NotificationUtils = NotificationUtils;
    } catch (e) {
        this.NotificationUtils = NotificationUtils;
    }
}
