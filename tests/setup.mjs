/**
 * tests/setup.mjs — 测试环境初始化
 *
 * 瘦身版：导入 tests/lib/ 中的共享模块，注册全局钩子。
 */
import { vi } from 'vitest';
import { setupChromeMock, resetChromeMock } from './lib/chrome-mock.mjs';
import { loadModule } from './lib/load-module.mjs';
import { createMockFetch, resetFetchMock } from './lib/fetch-helpers.mjs';

// ── 全局初始化 ─────────────────────────────────────────────
setupChromeMock();
createMockFetch();
globalThis.loadModule = loadModule;

// 暴露 chrome mock 辅助函数到 globalThis（兼容现有测试）
globalThis.clearChromeStorage = () => resetChromeMock();
globalThis.getChromeStorageData = () => {
  // 由 chrome-mock.mjs 的 Map backend 管理，这里只作兼容
};
globalThis.setChromeError = (msg) => {
  chrome.runtime.lastError = msg ? { message: msg } : null;
};
globalThis.clearChromeError = () => {
  chrome.runtime.lastError = null;
};
globalThis.invalidateExtensionContext = () => {
  chrome.runtime.id = undefined;
};
globalThis.restoreExtensionContext = () => {
  chrome.runtime.id = 'mock-extension-id';
};
globalThis.resetFetchMock = resetFetchMock;

// ── 生命周期钩子 ────────────────────────────────────────────
beforeEach(() => {
  resetChromeMock();
  resetFetchMock();
  restoreExtensionContext();
});

afterEach(() => {
  vi.clearAllMocks();
});
