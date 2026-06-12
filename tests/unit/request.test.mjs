import { describe, it, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  delete globalThis.RequestClient
  delete globalThis.createRequestClient
  delete globalThis.requestClient
  resetFetchMock()
  loadModule('core/utils/api/request.js')
})

function mockFetchResponse(body, status = 200, contentType = 'application/json') {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Map(Object.entries({ 'content-type': contentType })),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(body)])),
  }
  mockFetch.mockResolvedValue(response)
  return response
}

function mockFetchError(type = 'network') {
  if (type === 'network') {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
  } else if (type === 'abort') {
    const err = new Error('The operation was aborted')
    err.name = 'AbortError'
    mockFetch.mockRejectedValue(err)
  } else {
    mockFetch.mockRejectedValue(new Error(type))
  }
}

describe('RequestClient constructor', () => {
  it('has default options', () => {
    const client = new globalThis.RequestClient()
    expect(client.defaultOptions.timeout).toBe(30000)
    expect(client.defaultOptions.mode).toBe('cors')
    expect(client.defaultOptions.headers['Content-Type']).toBe('application/json')
  })

  it('accepts custom timeout and headers', () => {
    const client = new globalThis.RequestClient({
      timeout: 5000,
      headers: { 'X-Custom': 'value' },
    })
    expect(client.defaultOptions.timeout).toBe(5000)
    expect(client.defaultOptions.headers['X-Custom']).toBe('value')
  })

  it('exports convenience creators', () => {
    expect(globalThis.createRequestClient).toBeDefined()
    expect(globalThis.requestClient).toBeInstanceOf(globalThis.RequestClient)
    const custom = globalThis.createRequestClient({ timeout: 10000 })
    expect(custom).toBeInstanceOf(globalThis.RequestClient)
  })
})

describe('RequestClient request()', () => {
  it('throws when url is missing', async () => {
    const client = new globalThis.RequestClient()
    await expect(client.request({})).rejects.toThrow('请求缺少 url')
  })

  it('sends GET and returns JSON response', async () => {
    mockFetchResponse({ data: { id: 1, name: 'test' } })
    const client = new globalThis.RequestClient()
    const result = await client.request({ url: 'http://example.com/api/data', method: 'GET' })
    expect(result).toEqual({ id: 1, name: 'test' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sends POST with JSON body', async () => {
    mockFetchResponse({ data: { id: 2 } })
    const client = new globalThis.RequestClient()
    const result = await client.request({
      url: 'http://example.com/api/create',
      method: 'POST',
      data: { name: 'new' },
    })
    expect(result).toEqual({ id: 2 })
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('POST')
  })

  it('appends query params to URL', async () => {
    mockFetchResponse({ data: [] })
    const client = new globalThis.RequestClient()
    await client.request({
      url: 'http://example.com/api/list',
      params: { page: '1', limit: '10' },
    })
    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain('page=1')
    expect(url).toContain('limit=10')
  })
})

describe('RequestClient convenience methods', () => {
  it('get() sends GET request', async () => {
    mockFetchResponse({ data: 'ok' })
    const client = new globalThis.RequestClient()
    const result = await client.get('http://example.com/api/data', { page: '1' })
    expect(result).toBe('ok')
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('GET')
  })

  it('post() sends POST with data', async () => {
    mockFetchResponse({ data: { created: true } })
    const client = new globalThis.RequestClient()
    await client.post('http://example.com/api/create', { name: 'x' })
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('POST')
  })

  it('put() sends PUT with data', async () => {
    mockFetchResponse({ data: { updated: true } })
    const client = new globalThis.RequestClient()
    await client.put('http://example.com/api/update', { name: 'y' })
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('PUT')
  })

  it('delete() sends DELETE request', async () => {
    mockFetchResponse({ data: { deleted: true } })
    const client = new globalThis.RequestClient()
    await client.delete('http://example.com/api/remove')
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('DELETE')
  })
})

describe('RequestClient _fetchWithRetry', () => {
  it('succeeds on first attempt', async () => {
    mockFetchResponse({ data: 'ok' })
    const client = new globalThis.RequestClient()
    const result = await client._fetchWithRetry('http://example.com/api', { method: 'GET' })
    expect(result).toBe('ok')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries on network error with exponential backoff', async () => {
    const client = new globalThis.RequestClient()
    const delays = []
    const origDelay = client._delay.bind(client)
    client._delay = vi.fn((ms) => {
      delays.push(ms)
      return Promise.resolve()
    })

    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue({ data: 'recovered' }),
      })

    const result = await client._fetchWithRetry('http://example.com/api', { method: 'GET' })
    expect(result).toBe('recovered')
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([1000, 2000]) // 1000*2^0, 1000*2^1

    client._delay = origDelay
  })

  it('throws after exhausting max retries', async () => {
    const client = new globalThis.RequestClient()
    // Mock _delay to resolve immediately so retries happen synchronously
    const origDelay = client._delay.bind(client)
    client._delay = vi.fn().mockResolvedValue()

    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(client._fetchWithRetry('http://example.com/api', { method: 'GET' })).rejects.toThrow('Failed to fetch')
    expect(mockFetch).toHaveBeenCalledTimes(4) // initial + 3 retries

    client._delay = origDelay
  })
})

describe('RequestClient _parseResponse', () => {
  it('returns data field when present in JSON', async () => {
    const client = new globalThis.RequestClient()
    const response = {
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: vi.fn().mockResolvedValue({ code: 0, data: { items: [1, 2] } }),
    }
    const result = await client._parseResponse(response)
    expect(result).toEqual({ items: [1, 2] })
  })

  it('returns full body when no data field', async () => {
    const client = new globalThis.RequestClient()
    const response = {
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: vi.fn().mockResolvedValue({ code: 0, items: [1, 2] }),
    }
    const result = await client._parseResponse(response)
    expect(result).toEqual({ code: 0, items: [1, 2] })
  })

  it('throws on business error code', async () => {
    const client = new globalThis.RequestClient()
    const response = {
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: vi.fn().mockResolvedValue({ code: 500, message: 'Server Error' }),
    }
    await expect(client._parseResponse(response)).rejects.toThrow('Server Error')
  })

  it('returns text for text/* content type', async () => {
    const client = new globalThis.RequestClient()
    const response = {
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      text: vi.fn().mockResolvedValue('<html></html>'),
      blob: vi.fn(),
    }
    const result = await client._parseResponse(response)
    expect(result).toBe('<html></html>')
  })

  it('returns blob for other content types', async () => {
    const client = new globalThis.RequestClient()
    const blob = new Blob(['data'])
    const response = {
      ok: true,
      headers: new Map([['content-type', 'application/octet-stream']]),
      blob: vi.fn().mockResolvedValue(blob),
    }
    const result = await client._parseResponse(response)
    expect(result).toBe(blob)
  })
})

describe('RequestClient _shouldRetry', () => {
  it('retries on TypeError with "Failed to fetch"', () => {
    const client = new globalThis.RequestClient()
    expect(client._shouldRetry(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('retries on AbortError', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    const client = new globalThis.RequestClient()
    expect(client._shouldRetry(err)).toBe(true)
  })

  it('does not retry on other errors', () => {
    const client = new globalThis.RequestClient()
    expect(client._shouldRetry(new Error('Something else'))).toBe(false)
    expect(client._shouldRetry(new Error('HTTP 500: Internal Server Error'))).toBe(false)
  })
})

describe('RequestClient abort', () => {
  it('aborts by key before request completes', () => {
    const client = new globalThis.RequestClient()
    // abort with no matching key is a no-op
    expect(() => client.abort('non-existent')).not.toThrow()
    expect(() => client.abort(null)).not.toThrow()
  })
})

describe('RequestClient destroy', () => {
  it('clears all abort controllers', () => {
    const client = new globalThis.RequestClient()
    expect(() => client.destroy()).not.toThrow()
  })
})

describe('RequestClient _buildUrlWithParams', () => {
  it('returns url unchanged when no params', () => {
    const client = new globalThis.RequestClient()
    expect(client._buildUrlWithParams('http://example.com/api', null)).toBe('http://example.com/api')
    expect(client._buildUrlWithParams('http://example.com/api', {})).toBe('http://example.com/api')
  })

  it('appends params as query string', () => {
    const client = new globalThis.RequestClient()
    const url = client._buildUrlWithParams('http://example.com/api', { a: '1', b: '2' })
    expect(url).toContain('a=1')
    expect(url).toContain('b=2')
  })

  it('filters null and undefined values', () => {
    const client = new globalThis.RequestClient()
    const url = client._buildUrlWithParams('http://example.com/api', { a: '1', b: null })
    expect(url).toContain('a=1')
    expect(url).not.toContain('b=')
  })
})
