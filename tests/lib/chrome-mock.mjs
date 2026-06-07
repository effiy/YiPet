/**
 * tests/lib/chrome-mock.mjs — Chrome Extension API 模拟层
 *
 * 合并 setup.mjs 的 Map storage + mocks/chrome.mjs 的 EventEmitter runtime。
 * 所有测试文件通过 setup.mjs 间接使用此模块。
 */
import { vi } from 'vitest';

// ── Storage backend ─────────────────────────────────────
const storageData = new Map();

// ── EventEmitter ────────────────────────────────────────
class EventEmitter {
  constructor () {
    this._listeners = new Map();
  }

  addListener (fn) {
    if (!this._listeners.has(fn)) {
      this._listeners.set(fn, true);
    }
  }

  removeListener (fn) {
    this._listeners.delete(fn);
  }

  hasListener (fn) {
    return this._listeners.has(fn);
  }

  hasListeners () {
    return this._listeners.size > 0;
  }

  dispatch (...args) {
    for (const fn of this._listeners.keys()) {
      try { fn(...args); } catch (_) { /* 模拟 Chrome 的静默错误处理 */ }
    }
  }
}

// ── Runtime message event emitters ──────────────────────
const onMessageEmitter = new EventEmitter();
const onChangedEmitter = new EventEmitter();

// ── Build chrome mock ───────────────────────────────────
export function setupChromeMock () {
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn((keys, callback) => {
          const result = {};
          const keyList = keys === null || keys === undefined
            ? [...storageData.keys()]
            : (Array.isArray(keys) ? keys : [keys]);
          for (const k of keyList) {
            if (storageData.has(k)) result[k] = storageData.get(k);
          }
          if (callback) callback(result);
        }),
        set: vi.fn((items, callback) => {
          for (const [k, v] of Object.entries(items)) {
            storageData.set(k, v);
          }
          if (callback) callback();
        }),
        remove: vi.fn((keys, callback) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const k of keyList) storageData.delete(k);
          if (callback) callback();
        }),
        clear: vi.fn((callback) => {
          storageData.clear();
          if (callback) callback();
        }),
      },
    },
    runtime: {
      id: 'mock-extension-id',
      lastError: null,
      onMessage: {
        addListener: (fn) => onMessageEmitter.addListener(fn),
        removeListener: (fn) => onMessageEmitter.removeListener(fn),
        hasListener: (fn) => onMessageEmitter.hasListener(fn),
        hasListeners: () => onMessageEmitter.hasListeners(),
      },
      sendMessage: vi.fn((msg) => {
        return new Promise((resolve) => {
          onMessageEmitter.dispatch(msg, { id: chrome.runtime.id }, resolve);
        });
      }),
      getURL: vi.fn((path) => `chrome-extension://mock-extension-id${path}`),
      getManifest: vi.fn(() => ({ version: '1.0.0', manifest_version: 3 })),
    },
  };
}

// ── Storage helpers ─────────────────────────────────────
export function clearChromeStorage () {
  storageData.clear();
}

export function getChromeStorageData () {
  return new Map(storageData);
}

export function setStorageValue (key, value) {
  storageData.set(key, value);
}

export function getStorageValue (key) {
  return storageData.get(key);
}

// ── Error injection ─────────────────────────────────────
export function setChromeError (message) {
  chrome.runtime.lastError = message ? { message } : null;
}

export function clearChromeError () {
  chrome.runtime.lastError = null;
}

// ── Context invalidation ────────────────────────────────
export function invalidateExtensionContext () {
  chrome.runtime.id = undefined;
}

export function restoreExtensionContext () {
  chrome.runtime.id = 'mock-extension-id';
}

// ── Runtime message dispatch (for tests) ────────────────
export function dispatchSendMessage (msg, sender, sendResponse) {
  onMessageEmitter.dispatch(msg, sender || { id: chrome.runtime.id }, sendResponse || (() => {}));
}

// ── Full reset ──────────────────────────────────────────
export function resetChromeMock () {
  clearChromeStorage();
  clearChromeError();
  restoreExtensionContext();
}
