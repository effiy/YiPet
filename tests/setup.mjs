/**
 * tests/setup.mjs — 测试环境初始化
 *
 * - 模拟 Chrome Extension API (chrome.storage, chrome.runtime)
 * - loadModule 辅助函数：加载 IIFE 模块到测试上下文
 * - fetch 全局 mock 基础设施
 */

import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Chrome API Mocks ─────────────────────────────────────

const storageData = new Map();

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
  },
};

// Helper to simulate chrome.runtime.lastError
globalThis.setChromeError = (message) => {
  chrome.runtime.lastError = message ? { message } : null;
};

globalThis.clearChromeError = () => {
  chrome.runtime.lastError = null;
};

globalThis.clearChromeStorage = () => {
  storageData.clear();
};

globalThis.getChromeStorageData = () => new Map(storageData);

// ── Helpers to simulate context invalidation ──────────────

globalThis.invalidateExtensionContext = () => {
  chrome.runtime.id = undefined;
};

globalThis.restoreExtensionContext = () => {
  chrome.runtime.id = 'mock-extension-id';
};

// ── loadModule — 加载 IIFE 模块 ────────────────────────────

globalThis.loadModule = (relativePath) => {
  const fullPath = resolve(ROOT, relativePath);

  const code = readFileSync(fullPath, 'utf-8');
  const fn = new Function('globalThis', code);
  fn(globalThis);
};

// ── Fetch Mock ────────────────────────────────────────────

globalThis.mockFetch = vi.fn();
globalThis.fetch = globalThis.mockFetch;

// Reset fetch mock between tests
globalThis.resetFetchMock = () => {
  globalThis.mockFetch.mockReset();
};

// ── Global Setup / Teardown ───────────────────────────────

beforeEach(() => {
  clearChromeStorage();
  clearChromeError();
  restoreExtensionContext();
  resetFetchMock();
});

afterEach(() => {
  vi.clearAllMocks();
});
