/**
 * 轻量日志工具（可按环境开关）
 * author: liangliang
 * 适配 Chrome 扩展环境
 */

// 获取调试开关：优先 chrome.storage -> 默认关闭
function detectDebug() {
  try {
    // 优先从 chrome.storage 读取
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // 异步读取，这里先返回默认值，实际使用时通过回调更新
      return false; // 默认关闭
    }
    return false; // 默认关闭
  } catch (_) {
    return false;
  }
}

let __debugEnabled = detectDebug();

// 监听调试开关变化
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.petDebug) {
      __debugEnabled = changes.petDebug.newValue === true;
    }
  });
}

function shouldDebug() {
  return __debugEnabled;
}

let __consolePatched = false;
function patchConsole() {
  if (__consolePatched) return;
  __consolePatched = true;
  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };
  const gate = (fn, always) => (...args) => {
    if (always || shouldDebug()) fn(...args);
  };
  console.log = gate(original.log, false);
  console.info = gate(original.info, false);
  console.warn = gate(original.warn, false);
  console.debug = gate(original.debug, false);
  console.error = gate(original.error, true);
}

function logDebug(...args) {
  if (shouldDebug()) console.debug('[DEBUG]', ...args);
}

function logInfo(...args) {
  if (shouldDebug()) console.info('[INFO ]', ...args);
}

function logWarn(...args) {
  if (shouldDebug()) console.warn('[WARN ]', ...args);
}

function logError(...args) {
  // 错误始终打印
  console.error('[ERROR]', ...args);
}

// 简易计时工具
const timers = new Map();
function timeStart(label) {
  if (!shouldDebug()) return;
  timers.set(label, performance.now());
}
function timeEnd(label) {
  if (!shouldDebug()) return;
  const start = timers.get(label);
  if (start != null) {
    const ms = (performance.now() - start).toFixed(1);
    console.info(`[TIME ] ${label}: ${ms}ms`);
    timers.delete(label);
  }
}

// 在全局作用域中暴露（用于非模块环境）
if (typeof window !== 'undefined') {
    window.logDebug = logDebug;
    window.logInfo = logInfo;
    window.logWarn = logWarn;
    window.logError = logError;
    window.timeStart = timeStart;
    window.timeEnd = timeEnd;
    patchConsole();
}

// ES6模块导出（用于模块环境）
export {
    logDebug,
    logInfo,
    logWarn,
    logError,
    timeStart,
    timeEnd,
    patchConsole,
    shouldDebug
};
