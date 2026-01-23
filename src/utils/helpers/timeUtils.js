/**
 * 时间工具类
 * 
 * 功能说明：
 * - 提供统一的时间格式化功能
 * - 避免在多个文件中重复定义时间格式化函数
 * 
 * 使用示例：
 * ```javascript
 * // 格式化时间戳
 * const timeStr = TimeUtils.formatTimestamp(Date.now());
 * 
 * // 格式化日期
 * const dateStr = TimeUtils.formatDate(new Date());
 * 
 * // 获取当前时间字符串
 * const now = TimeUtils.getCurrentTime();
 * ```
 */

class TimeUtils {
    /**
     * 格式化时间戳为年月日时分格式
     * @param {number|string|Date} timestamp - 时间戳（毫秒）或日期对象
     * @returns {string} 格式化后的时间字符串，格式：YYYY年MM月DD日 HH:mm
     */
    static formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        let date;
        if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }
        
        // 检查日期是否有效
        if (isNaN(date.getTime())) {
            return '';
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}年${month}月${day}日 ${hour}:${minute}`;
    }

    /**
     * 格式化日期为 YYYY/MM/DD 格式
     * @param {Date|number|string} date - 日期对象、时间戳或日期字符串
     * @returns {string} 格式化后的日期字符串，格式：YYYY/MM/DD
     */
    static formatDate(date) {
        if (!date) return '';
        
        let dateObj;
        if (date instanceof Date) {
            dateObj = date;
        } else {
            dateObj = new Date(date);
        }
        
        if (!dateObj || isNaN(dateObj.getTime())) {
            return '';
        }
        
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    /**
     * 获取当前时间的格式化字符串
     * @returns {string} 当前时间的格式化字符串
     */
    static getCurrentTime() {
        return this.formatTimestamp(Date.now());
    }

    /**
     * 格式化相对时间（如：刚刚、5分钟前、2小时前等）
     * @param {number|string|Date} timestamp - 时间戳（毫秒）或日期对象
     * @returns {string} 相对时间字符串
     */
    static formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        
        let date;
        if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }
        
        if (isNaN(date.getTime())) {
            return '';
        }
        
        const now = Date.now();
        const diff = now - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return date.toLocaleDateString('zh-CN');
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = TimeUtils;
} else if (typeof self !== "undefined") {
    // Service Worker / Web Worker 环境
    self.TimeUtils = TimeUtils;
    if (typeof globalThis !== "undefined") {
        globalThis.TimeUtils = TimeUtils;
    }
} else if (typeof window !== "undefined") {
    // 浏览器环境
    window.TimeUtils = TimeUtils;
} else {
    // 最后兜底
    try {
        globalThis.TimeUtils = TimeUtils;
    } catch (e) {
        this.TimeUtils = TimeUtils;
    }
}
