/**
 * tests/lib/test-utils.mjs — 测试生命周期工具
 *
 * 提供统一的 beforeEach 重置逻辑，消除各测试文件的重复代码。
 */
import { clearChromeStorage, clearChromeError, restoreExtensionContext } from './chrome-mock.mjs'
import { resetFetchMock } from './fetch-helpers.mjs'

/**
 * 重置所有测试状态。在 beforeEach 中调用。
 */
export function resetTestState() {
  clearChromeStorage()
  clearChromeError()
  restoreExtensionContext()
  resetFetchMock()
}

/**
 * 从 globalThis 清理指定的全局变量（用于隔离模块重载）
 * @param {...string} names
 */
export function clearGlobals(...names) {
  for (const name of names) {
    delete globalThis[name]
    delete globalThis.window?.[name]
  }
}
