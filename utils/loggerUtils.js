/**
 * 日志工具类
 * 
 * 功能说明：
 * - 统一处理日志静默功能
 * - 根据开发模式设置控制控制台输出
 * - 避免在生产环境输出过多日志
 * 
 * 使用示例：
 * ```javascript
 * // 初始化日志工具（默认禁用日志）
 * LoggerUtils.initMuteLogger('petDevMode', false);
 * 
 * // 启用日志（通过Chrome Storage设置 petDevMode = true）
 * ```
 */

class LoggerUtils {
    /**
     * 初始化日志静默功能
     * @param {string} keyName - 存储键名，默认为 'petDevMode'
     * @param {boolean} defaultEnabled - 默认是否启用日志，默认为 false
     */
    static initMuteLogger(keyName = 'petDevMode', defaultEnabled = false) {
        try {
            // 检查 chrome.storage 是否可用
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime) {
                return;
            }
            
            // 检查扩展上下文是否有效
            try {
                if (!chrome.runtime.id) {
                    return;
                }
            } catch (error) {
                // 扩展上下文已失效
                return;
            }
            
            const original = {
                log: console.log,
                info: console.info,
                debug: console.debug,
                warn: console.warn
            };
            
            const muteIfNeeded = (enabled) => {
                if (enabled) {
                    // 恢复原始日志方法
                    console.log = original.log;
                    console.info = original.info;
                    console.debug = original.debug;
                    console.warn = original.warn;
                } else {
                    // 禁用日志
                    const noop = () => {};
                    console.log = noop;
                    console.info = noop;
                    console.debug = noop;
                    console.warn = noop;
                }
            };
            
            // 读取初始状态
            chrome.storage.sync.get([keyName], (res) => {
                if (chrome.runtime.lastError) {
                    // 忽略错误，使用默认值
                    muteIfNeeded(defaultEnabled);
                    return;
                }
                const enabled = res[keyName];
                muteIfNeeded(typeof enabled === 'boolean' ? enabled : defaultEnabled);
            });
            
            // 监听存储变化
            chrome.storage.onChanged.addListener((changes, namespace) => {
                try {
                    if (namespace !== 'sync') return;
                    if (changes[keyName]) {
                        const enabled = changes[keyName].newValue;
                        muteIfNeeded(enabled);
                    }
                } catch (error) {
                    // 静默处理错误
                }
            });
        } catch (e) {
            // 静默处理初始化错误
        }
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = LoggerUtils;
} else {
    window.LoggerUtils = LoggerUtils;
}

