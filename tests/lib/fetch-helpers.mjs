/**
 * tests/lib/fetch-helpers.mjs — Fetch mock 工厂函数
 *
 * 提供标准的 fetch mock 工厂，统一 API 测试中的 mock 模式。
 */
import { vi } from 'vitest';

/**
 * 创建模拟成功的 API 响应
 * @param {*}      data       - 响应数据
 * @param {number} [status=200]
 * @returns {Response}
 */
export function makeApiResponse (data, status = 200) {
  return new Response(JSON.stringify({ code: 0, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 创建模拟失败的 API 响应（业务错误）
 * @param {number} code    - 业务错误码
 * @param {string} message - 错误消息
 * @param {number} [httpStatus=200]
 * @returns {Response}
 */
export function makeApiError (code, message, httpStatus = 200) {
  return new Response(JSON.stringify({ code, message }), {
    status: httpStatus,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 创建模拟网络错误（fetch reject）
 * @param {string} [message='Failed to fetch']
 * @returns {Error}
 */
export function mockFetchError (message = 'Failed to fetch') {
  const err = new TypeError(message);
  err.name = 'TypeError';
  return err;
}

/**
 * 创建 vi.fn() fetch mock 并挂载到 globalThis
 * @returns {vi.Mock} mock fetch 函数
 */
export function createMockFetch () {
  const mock = vi.fn();
  globalThis.fetch = mock;
  globalThis.mockFetch = mock;
  return mock;
}

/**
 * 重置 fetch mock
 */
export function resetFetchMock () {
  if (globalThis.mockFetch) {
    globalThis.mockFetch.mockReset();
  }
}
