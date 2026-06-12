/**
 * RequestClient Unit Tests
 * Covers HTTP methods (GET/POST/PUT/DELETE), timeout, retry, abort, URL params, response parsing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadModule } from '../lib/load-module.mjs'

beforeEach(async () => {
  // Set a fresh fetch mock BEFORE loadModule (IIFE captures this reference)
  global.fetch = vi.fn()
  delete globalThis.RequestClient
  delete globalThis.requestClient
  await loadModule('core/utils/api/request.js', globalThis)
  globalThis.RequestClient.prototype._delay = () => Promise.resolve()
})

function mockJsonResponse(data) {
  const headers = new Map([['content-type', 'application/json']])
  return {
    ok: true,
    headers,
    json: () => Promise.resolve(data),
  }
}

function mockTextResponse(text) {
  const headers = new Map([['content-type', 'text/plain']])
  return {
    ok: true,
    headers,
    text: () => Promise.resolve(text),
    json: () => {
      throw new Error('not json')
    },
  }
}

function mockBlobResponse(blob) {
  const headers = new Map([['content-type', 'application/octet-stream']])
  return {
    ok: true,
    headers,
    blob: () => Promise.resolve(blob),
    json: () => {
      throw new Error('not json')
    },
    text: () => {
      throw new Error('not text')
    },
  }
}

describe('RequestClient', () => {
  describe('HTTP methods', () => {
    it('GET returns parsed data from JSON response', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({ data: 'hello' }))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      const result = await client.get('https://api.example.com/test')
      expect(result).toBe('hello')
      const [url, init] = globalThis.fetch.mock.calls[0]
      expect(init.method).toBe('GET')
    })

    it('GET returns parsed data with business code 0', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({ code: 0, data: { items: [1, 2] } }))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      const result = await client.get('https://api.example.com/data')
      expect(result).toEqual({ items: [1, 2] })
    })

    it('GET throws on business error code', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({ code: 1, message: '业务失败' }))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await expect(client.get('https://api.example.com/data')).rejects.toThrow('业务失败')
    })

    it('GET returns text response', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockTextResponse('hello world'))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      const result = await client.get('https://api.example.com/text')
      expect(result).toBe('hello world')
    })

    it('GET returns blob response', async () => {
      const fakeBlob = new Blob(['binary'])
      globalThis.fetch.mockResolvedValueOnce(mockBlobResponse(fakeBlob))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      const result = await client.get('https://api.example.com/blob')
      expect(result).toBe(fakeBlob)
    })

    it('POST sends stringified JSON body', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.post('https://api.example.com/echo', { key: 'val' })
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.method).toBe('POST')
      expect(init.body).toBe(JSON.stringify({ key: 'val' }))
    })

    it('POST with FormData does not set Content-Type', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const formData = new FormData()
      formData.append('file', 'content')
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.post('https://api.example.com/upload', formData)
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.headers['Content-Type']).toBeUndefined()
    })

    it('POST with string body sends as-is', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.post('https://api.example.com/raw', 'plain text', {
        headers: { 'Content-Type': 'text/plain' },
      })
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.body).toBe('plain text')
    })

    it('PUT uses PUT method', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.put('https://api.example.com/item/1', { key: 'val' })
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.method).toBe('PUT')
    })

    it('DELETE uses DELETE method with no body', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.delete('https://api.example.com/sessions/1')
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.method).toBe('DELETE')
      expect(init.body).toBeUndefined()
    })
  })

  describe('Headers', () => {
    it('sets Content-Type application/json by default on POST', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.post('https://api.example.com/post', { x: 1 })
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.headers['Content-Type']).toBe('application/json')
    })

    it('merges custom headers with defaults', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const client = new globalThis.RequestClient({
        timeout: 5000,
        headers: { 'X-Custom': 'value' },
      })
      await client.get('https://api.example.com/test')
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.headers['X-Custom']).toBe('value')
      expect(init.headers['Content-Type']).toBe('application/json')
    })

    it('request-level headers override default headers', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))
      const client = new globalThis.RequestClient({
        timeout: 5000,
        headers: { 'X-Custom': 'default' },
      })
      await client.get(
        'https://api.example.com/test',
        {},
        {
          headers: { 'X-Custom': 'override' },
        },
      )
      const [, init] = globalThis.fetch.mock.calls[0]
      expect(init.headers['X-Custom']).toBe('override')
    })
  })

  describe('Timeout', () => {
    it('rejects with timeout error after configured timeout', async () => {
      vi.useFakeTimers()
      // fetch that never resolves
      globalThis.fetch.mockReturnValue(new Promise(() => {}))

      const client = new globalThis.RequestClient({ timeout: 100 })
      const prom = client.get('https://api.example.com/slow')

      await vi.advanceTimersByTimeAsync(150)
      await expect(prom).rejects.toThrow(/超时/)
      vi.useRealTimers()
    })
  })

  describe('Retry mechanism', () => {
    it('retries on first network failure and succeeds on second attempt', async () => {
      globalThis.fetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(mockJsonResponse({ data: 'retry-ok' }))

      const client = new globalThis.RequestClient({ timeout: 5000 })
      const result = await client.get('https://api.example.com/test')
      expect(result).toBe('retry-ok')
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('retries max 3 times and then rejects on persistent network error', async () => {
      globalThis.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

      const client = new globalThis.RequestClient({ timeout: 5000 })
      await expect(client.get('https://api.example.com/fail')).rejects.toThrow()
      // 1 original + 3 retries = 4 total calls
      expect(globalThis.fetch).toHaveBeenCalledTimes(4)
    })

    it('does NOT retry on HTTP error (only network errors)', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
      })

      const client = new globalThis.RequestClient({ timeout: 5000 })
      await expect(client.get('https://api.example.com/500')).rejects.toThrow('HTTP 500')
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    it('retries on AbortError from timeout', async () => {
      globalThis.fetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

      const client = new globalThis.RequestClient({ timeout: 5000 })
      await expect(client.get('https://api.example.com/abort')).rejects.toThrow()
      // AbortError should be retried (1 original + 3 retries = 4)
      expect(globalThis.fetch).toHaveBeenCalledTimes(4)
    })
  })

  describe('AbortController', () => {
    it('aborts request via abortKey and rejects', async () => {
      vi.useFakeTimers()
      globalThis.fetch.mockReturnValue(new Promise(() => {}))

      const client = new globalThis.RequestClient({ timeout: 1000 })
      const reqPromise = client.get('https://api.example.com/test', {}, { abortKey: 'test-key' })
      client.abort('test-key')
      await vi.advanceTimersByTimeAsync(1100)
      await expect(reqPromise).rejects.toThrow()
      vi.useRealTimers()
    })

    it('abort with non-existent key is no-op', () => {
      const client = new globalThis.RequestClient({ timeout: 5000 })
      expect(() => client.abort('non-existent')).not.toThrow()
    })

    it('abort with no key is no-op', () => {
      const client = new globalThis.RequestClient({ timeout: 5000 })
      expect(() => client.abort()).not.toThrow()
    })
  })

  describe('URL params', () => {
    it('builds URL with query params', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))

      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.get('https://api.example.com/search', { a: 1, b: 'x' })
      const [url] = globalThis.fetch.mock.calls[0]
      expect(url).toContain('a=1')
      expect(url).toContain('b=x')
    })

    it('skips null/undefined param values', async () => {
      globalThis.fetch.mockResolvedValueOnce(mockJsonResponse({}))

      const client = new globalThis.RequestClient({ timeout: 5000 })
      await client.get('https://api.example.com/search', { a: null, b: undefined, c: 'ok' })
      const [url] = globalThis.fetch.mock.calls[0]
      expect(url).toContain('c=ok')
      expect(url).not.toContain('a=')
      expect(url).not.toContain('b=')
    })
  })

  describe('Error handling', () => {
    it('throws when no url is provided', async () => {
      const client = new globalThis.RequestClient({ timeout: 5000 })
      await expect(client.request({})).rejects.toThrow('请求缺少 url')
    })
  })

  describe('Default construction', () => {
    it('default requestClient instance is available on globalThis', () => {
      expect(globalThis.requestClient).toBeInstanceOf(globalThis.RequestClient)
    })

    it('createRequestClient factory returns new instance', () => {
      const client = globalThis.createRequestClient({ timeout: 10000 })
      expect(client).toBeInstanceOf(globalThis.RequestClient)
      expect(client.defaultOptions.timeout).toBe(10000)
    })
  })

  describe('destroy', () => {
    it('clears all abort controllers', () => {
      globalThis.fetch.mockReturnValue(new Promise(() => {}))
      const client = new globalThis.RequestClient({ timeout: 5000 })
      client.get('https://api.example.com/test', {}, { abortKey: 'k1' })
      expect(() => client.destroy()).not.toThrow()
    })
  })
})
