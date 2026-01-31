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
            const cfgKey = (typeof globalThis !== 'undefined' && globalThis.PET_CONFIG && globalThis.PET_CONFIG.constants && globalThis.PET_CONFIG.constants.storageKeys && globalThis.PET_CONFIG.constants.storageKeys.devMode) ? globalThis.PET_CONFIG.constants.storageKeys.devMode : null;
            const effectiveKeyName = keyName || cfgKey || 'petDevMode';
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
            chrome.storage.local.get([effectiveKeyName], (res) => {
                if (chrome.runtime.lastError) {
                    // 忽略错误，使用默认值
                    muteIfNeeded(defaultEnabled);
                    return;
                }
                const enabled = res[effectiveKeyName];
                muteIfNeeded(typeof enabled === 'boolean' ? enabled : defaultEnabled);
            });
            
            // 监听存储变化
            chrome.storage.onChanged.addListener((changes, namespace) => {
                try {
                    if (namespace !== 'local') return;
                    if (changes[effectiveKeyName]) {
                        const enabled = changes[effectiveKeyName].newValue;
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
    static _levelMap = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
    static _currentLevel = (() => {
        try {
            const mode = (typeof window !== 'undefined' && window.PET_ENV && window.PET_ENV.mode) || 'production';
            return mode === 'production' ? 'warn' : 'debug';
        } catch (_) {
            return 'warn';
        }
    })();
    static setLevel(level) {
        if (this._levelMap[level] !== undefined) {
            this._currentLevel = level;
        }
    }
    static getLevel() {
        return this._currentLevel;
    }
    static _sanitize(obj) {
        try {
            if (!obj) return obj;
            const maskKeys = ['token', 'key', 'password', 'secret', 'authorization', 'cookie'];
            const traverse = (val) => {
                if (val === null || typeof val !== 'object') return val;
                if (Array.isArray(val)) return val.map(traverse);
                const out = {};
                for (const k in val) {
                    const v = val[k];
                    if (maskKeys.some(m => k.toLowerCase().includes(m))) {
                        out[k] = '***';
                    } else {
                        out[k] = traverse(v);
                    }
                }
                return out;
            };
            return traverse(obj);
        } catch (_) {
            return obj;
        }
    }
    static _ts() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    static _shouldEmit(level) {
        const map = this._levelMap;
        const cur = map[this._currentLevel] ?? map.warn;
        const lv = map[level] ?? map.info;
        return lv <= cur;
    }
    static _repeatCache = new Map();
    static _shouldSkipRepeat(scope, level, message) {
        const key = `${scope}|${level}|${message}`;
        const now = Date.now();
        const entry = this._repeatCache.get(key);
        if (!entry) {
            this._repeatCache.set(key, { t: now, c: 1 });
            return false;
        }
        const dt = now - entry.t;
        if (dt < 500) {
            entry.c++;
            entry.t = now;
            if (entry.c > 5) return true;
            return false;
        }
        this._repeatCache.set(key, { t: now, c: 1 });
        return false;
    }
    static _emit(scope, level, message, meta, context) {
        try {
            if (!this._shouldEmit(level)) return;
            if (this._shouldSkipRepeat(scope, level, String(message))) return;
            const ts = this._ts();
            const parts = [`[${ts}] [${scope}] ${message}`];
            const sanitized = this._sanitize(meta);
            if (sanitized !== undefined) parts.push(sanitized);
            if (context && context.correlationId) parts.push({ correlationId: context.correlationId });
            const fn = (level === 'error' && console.error) ? console.error :
                (level === 'warn' && console.warn) ? console.warn :
                    (level === 'debug' && console.debug) ? console.debug :
                        (console.info && (level === 'info' || level === 'log')) ? console.info : console.log;
            fn.apply(console, parts);
        } catch (_) { }
    }
    static setGlobalCorrelationId(id) {
        this._globalCorrelationId = id;
    }
    static getLogger(scope = 'app') {
        const self = this;
        const baseCtx = { correlationId: self._globalCorrelationId };
        const api = {
            debug(m, meta) { self._emit(scope, 'debug', m, meta, baseCtx); },
            info(m, meta) { self._emit(scope, 'info', m, meta, baseCtx); },
            warn(m, meta) { self._emit(scope, 'warn', m, meta, baseCtx); },
            error(m, meta) { self._emit(scope, 'error', m, meta, baseCtx); },
            child(sub) { const s = sub ? `${scope}:${sub}` : scope; return self.getLogger(s); },
            withCorrelation(id) {
                const ctx = { correlationId: id };
                return {
                    debug(m, meta) { self._emit(scope, 'debug', m, meta, ctx); },
                    info(m, meta) { self._emit(scope, 'info', m, meta, ctx); },
                    warn(m, meta) { self._emit(scope, 'warn', m, meta, ctx); },
                    error(m, meta) { self._emit(scope, 'error', m, meta, ctx); }
                };
            }
        };
        return api;
    }
}

// 导出
if (typeof module !== "undefined" && module.exports) {
    module.exports = LoggerUtils;
} else if (typeof self !== "undefined") {
    // Service Worker / Web Worker 环境
    self.LoggerUtils = LoggerUtils;
    if (typeof globalThis !== "undefined") {
        globalThis.LoggerUtils = LoggerUtils;
    }
} else if (typeof window !== "undefined") {
    // 浏览器环境
    window.LoggerUtils = LoggerUtils;
} else {
    // 最后兜底
    try {
        globalThis.LoggerUtils = LoggerUtils;
    } catch (e) {
        this.LoggerUtils = LoggerUtils;
    }
}
