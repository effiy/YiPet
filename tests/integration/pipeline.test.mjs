/**
 * FP7: API 管理器集成测试 — SessionService + FaqService
 *
 * 依赖链: config → logger → error → token → request → ApiManager → SessionService → FaqService
 * 所有测试通过 mock fetch 控制 API 响应，不发起真实网络请求。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const BASE_URL = 'https://api.effiy.cn';

function makeApiResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json']]),
    json: vi.fn().mockResolvedValue({ code: 0, data }),
    text: vi.fn(),
    blob: vi.fn(),
  };
}

function makeApiError(code, message) {
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json']]),
    json: vi.fn().mockResolvedValue({ code, message }),
    text: vi.fn(),
    blob: vi.fn(),
  };
}

function urlHas(haystack, needle) {
  return decodeURIComponent(haystack).includes(needle);
}

beforeEach(() => {
  delete globalThis.ApiManager;
  delete globalThis.SessionService;
  delete globalThis.FaqService;
  delete globalThis.RequestClient;
  delete globalThis.ErrorHandler;
  delete globalThis.Logger;
  delete globalThis.LoggerUtils;
  delete globalThis.TokenManager;
  delete globalThis.buildDatabaseUrl;
  delete globalThis.PET_CONFIG;
  globalThis.clearChromeStorage();
  globalThis.clearChromeError();
  globalThis.restoreExtensionContext();
  globalThis.resetFetchMock();

  // 1. config.js — 提供 PET_CONFIG + buildDatabaseUrl
  globalThis.loadModule('core/config.js');
  globalThis.buildDatabaseUrl = globalThis.PET_CONFIG.buildDatabaseUrl;

  // 2. logger.js
  globalThis.loadModule('core/utils/api/logger.js');

  // 3. error.js
  globalThis.loadModule('core/utils/api/error.js');

  // 4. token.js
  globalThis.loadModule('core/utils/api/token.js');

  // 5. request.js
  globalThis.loadModule('core/utils/api/request.js');

  // 6. ApiManager.js
  globalThis.loadModule('core/api/core/ApiManager.js');

  // 7. SessionService.js
  globalThis.loadModule('core/api/services/SessionService.js');

  // 8. FaqService.js
  globalThis.loadModule('core/api/services/FaqService.js');
});

// ── SessionService ──────────────────────────────────────────

describe('SessionService', () => {
  function createService() {
    const logger = new globalThis.Logger({ level: 4 }); // NONE — suppress test logs
    return new globalThis.SessionService(BASE_URL, { logger });
  }

  describe('getSessionsList', () => {
    it('returns session list from API', async () => {
      const sessions = [{ key: 's1', title: 'Session 1' }, { key: 's2', title: 'Session 2' }];
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: sessions }));

      const svc = createService();
      const result = await svc.getSessionsList();
      expect(result).toEqual(sessions);
    });

    it('returns empty array when API returns no list', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: null }));

      const svc = createService();
      const result = await svc.getSessionsList();
      expect(result).toEqual([]);
    });

    it('returns empty array on fetch error', async () => {
      globalThis.mockFetch.mockRejectedValue(new Error('Network failure'));

      const svc = createService();
      const result = await svc.getSessionsList();
      expect(result).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('returns session by key', async () => {
      const session = { key: 'abc', title: 'Found' };
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: [session] }));

      const svc = createService();
      const result = await svc.getSession('abc');
      expect(result).toEqual(session);
    });

    it('returns null for missing key', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: [] }));

      const svc = createService();
      const result = await svc.getSession('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null for falsy key', async () => {
      const svc = createService();
      const result = await svc.getSession('');
      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      globalThis.mockFetch.mockRejectedValue(new Error('fail'));

      const svc = createService();
      const result = await svc.getSession('abc');
      expect(result).toBeNull();
    });
  });

  describe('createSession', () => {
    it('creates session and returns success', async () => {
      const created = { _id: 'new-id', key: 'new-key' };
      globalThis.mockFetch.mockResolvedValue(makeApiResponse(created));

      const svc = createService();
      const result = await svc.createSession({ key: 'new-key', title: 'New' });
      expect(result.success).toBe(true);
      expect(result.data._id).toBe('new-id');
      expect(globalThis.mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on invalid session data', async () => {
      const svc = createService();
      await expect(svc.createSession(null)).rejects.toThrow('会话数据无效');
    });
  });

  describe('saveSession', () => {
    it('creates new session when key does not exist', async () => {
      // getSession returns empty list (not found) → saveSession calls createSession
      globalThis.mockFetch
        .mockResolvedValueOnce(makeApiResponse({ list: [] }))       // getSession
        .mockResolvedValueOnce(makeApiResponse({ _id: 'id', key: 'k1' })); // createSession

      const svc = createService();
      const result = await svc.saveSession({ key: 'k1', title: 'Fresh' });
      expect(result.success).toBe(true);
      expect(globalThis.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('updates existing session', async () => {
      // getSession finds it → saveSession calls update (POST with update_document)
      globalThis.mockFetch
        .mockResolvedValueOnce(makeApiResponse({ list: [{ key: 'k1', title: 'Old' }] }))
        .mockResolvedValueOnce(makeApiResponse({ updated: true }));

      const svc = createService();
      const result = await svc.saveSession({ key: 'k1', title: 'Updated' });
      expect(result.success).toBe(true);
      expect(globalThis.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws when sessionData has no key', async () => {
      const svc = createService();
      await expect(svc.saveSession({ title: 'NoKey' })).rejects.toThrow('缺少 key 字段');
    });
  });

  describe('deleteSession', () => {
    it('deletes session by key', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ deleted: true }));

      const svc = createService();
      const result = await svc.deleteSession('k1');
      expect(result.success).toBe(true);
    });

    it('throws on empty key', async () => {
      const svc = createService();
      await expect(svc.deleteSession('')).rejects.toThrow('会话 Key 无效');
    });
  });

  describe('deleteSessions', () => {
    it('batch deletes multiple sessions', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ deleted: true }));

      const svc = createService();
      const result = await svc.deleteSessions(['k1', 'k2', 'k3']);
      expect(result.success).toBe(true);
      expect(result.data.deletedCount).toBe(3);
      expect(globalThis.mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws on empty array', async () => {
      const svc = createService();
      await expect(svc.deleteSessions([])).rejects.toThrow('会话 Key 列表无效');
    });

    it('throws on non-array input', async () => {
      const svc = createService();
      await expect(svc.deleteSessions('not-array')).rejects.toThrow('会话 Key 列表无效');
    });
  });

  describe('searchSessions', () => {
    it('searches sessions by query', async () => {
      const results = [{ key: 's1', title: 'Hello World' }];
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: results }));

      const svc = createService();
      const result = await svc.searchSessions('Hello');
      expect(result).toEqual(results);
    });

    it('returns empty for empty query', async () => {
      const svc = createService();
      const result = await svc.searchSessions('');
      expect(result).toEqual([]);
    });

    it('returns empty on fetch error', async () => {
      globalThis.mockFetch.mockRejectedValue(new Error('fail'));

      const svc = createService();
      const result = await svc.searchSessions('test');
      expect(result).toEqual([]);
    });
  });

  describe('queueSave / flushSaveQueue', () => {
    it('queues and flushes sessions', async () => {
      // getSession returns empty (not found) → createSession succeeds
      globalThis.mockFetch
        .mockResolvedValueOnce(makeApiResponse({ list: [] }))
        .mockResolvedValueOnce(makeApiResponse({ _id: 'a' }))
        .mockResolvedValueOnce(makeApiResponse({ list: [] }))
        .mockResolvedValueOnce(makeApiResponse({ _id: 'b' }));

      const svc = createService();
      svc.saveInterval = 50; // speed up for test
      svc.queueSave({ key: 'k1', title: 'A' });
      svc.queueSave({ key: 'k2', title: 'B' });

      expect(svc.saveQueue.size).toBe(2);

      await svc.flushSaveQueue();
      expect(svc.saveQueue.size).toBe(0);
      expect(globalThis.mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});

// ── FaqService ──────────────────────────────────────────────

describe('FaqService', () => {
  function createService() {
    const logger = new globalThis.Logger({ level: 4 });
    return new globalThis.FaqService(BASE_URL, { logger });
  }

  describe('getFaqs', () => {
    it('returns normalized FAQ list', async () => {
      const faqs = [
        { key: 'f1', title: 'FAQ 1', text: 'Answer 1' },
        { key: 'f2', title: 'FAQ 2', text: 'Answer 2' },
      ];
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: faqs }));

      const svc = createService();
      const result = await svc.getFaqs();
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('f1');
      expect(result[0].text).toBe('Answer 1');
    });

    it('returns empty array when response has no list', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: null }));
      const svc = createService();
      expect(await svc.getFaqs()).toEqual([]);
    });

    it('returns empty array on fetch error', async () => {
      globalThis.mockFetch.mockRejectedValue(new Error('fail'));
      const svc = createService();
      expect(await svc.getFaqs()).toEqual([]);
    });
  });

  describe('createFaq', () => {
    it('creates FAQ and returns normalized result', async () => {
      const created = { key: 'f-new', title: 'New FAQ', text: 'Content' };
      globalThis.mockFetch.mockResolvedValue(makeApiResponse(created));

      const svc = createService();
      const result = await svc.createFaq({ title: 'New FAQ', text: 'Content' });
      expect(result.key).toBe('f-new');
      expect(result.title).toBe('New FAQ');
    });

    it('throws on null data', async () => {
      const svc = createService();
      await expect(svc.createFaq(null)).rejects.toThrow('FAQ数据无效');
    });

    it('throws when no title, prompt, or text', async () => {
      const svc = createService();
      await expect(svc.createFaq({ tags: [] })).rejects.toThrow('FAQ数据无效');
    });
  });

  describe('updateFaq', () => {
    it('updates FAQ by key', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ updated: true }));

      const svc = createService();
      const result = await svc.updateFaq('f1', { title: 'Updated' });
      expect(result.updated).toBe(true);
    });

    it('throws on empty key', async () => {
      const svc = createService();
      await expect(svc.updateFaq('', { title: 'X' })).rejects.toThrow('FAQ key无效');
    });

    it('throws on non-object patch', async () => {
      const svc = createService();
      await expect(svc.updateFaq('f1', null)).rejects.toThrow('更新数据无效');
    });
  });

  describe('deleteFaq', () => {
    it('deletes FAQ by key', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ deleted: true }));

      const svc = createService();
      const result = await svc.deleteFaq('f1');
      expect(result.deleted).toBe(true);
    });

    it('throws on empty key', async () => {
      const svc = createService();
      await expect(svc.deleteFaq('')).rejects.toThrow('FAQ key无效');
    });
  });

  describe('saveFaqs', () => {
    it('batch saves FAQs via POST', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ inserted: 2 }));

      const svc = createService();
      const result = await svc.saveFaqs([
        { title: 'FAQ 1', text: 'Content 1' },
        { title: 'FAQ 2', text: 'Content 2' },
      ]);
      expect(result.inserted).toBe(2);
      expect(globalThis.mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on non-array input', async () => {
      const svc = createService();
      await expect(svc.saveFaqs({})).rejects.toThrow('FAQ列表必须是数组');
    });
  });

  describe('searchFaqs', () => {
    it('searches FAQs by query', async () => {
      const results = [{ key: 'f1', title: 'How to install' }];
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: results }));

      const svc = createService();
      const result = await svc.searchFaqs('install');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('f1');
    });

    it('returns empty for empty query', async () => {
      const svc = createService();
      expect(await svc.searchFaqs('')).toEqual([]);
    });

    it('returns empty on fetch error', async () => {
      globalThis.mockFetch.mockRejectedValue(new Error('fail'));
      const svc = createService();
      expect(await svc.searchFaqs('test')).toEqual([]);
    });
  });

  describe('getFaqsByTags', () => {
    it('returns FAQs filtered by tags', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({ list: [{ key: 'f1', tags: ['a'] }] }));

      const svc = createService();
      const result = await svc.getFaqsByTags(['a', 'b']);
      expect(result).toHaveLength(1);
    });

    it('returns empty for empty tags array', async () => {
      const svc = createService();
      expect(await svc.getFaqsByTags([])).toEqual([]);
    });

    it('returns empty on fetch error', async () => {
      globalThis.mockFetch.mockRejectedValue(new Error('fail'));
      const svc = createService();
      expect(await svc.getFaqsByTags(['a'])).toEqual([]);
    });
  });

  describe('getAllTags', () => {
    it('collects unique tags from all FAQs', async () => {
      globalThis.mockFetch.mockResolvedValue(makeApiResponse({
        list: [
          { key: 'f1', tags: ['setup', 'guide'] },
          { key: 'f2', tags: ['guide', 'faq'] },
        ],
      }));

      const svc = createService();
      const result = await svc.getAllTags();
      expect(result).toEqual(['faq', 'guide', 'setup']);
    });

    it('returns empty on fetch error', async () => {
      globalThis.mockFetch.mockRejectedValue(new Error('fail'));
      const svc = createService();
      expect(await svc.getAllTags()).toEqual([]);
    });
  });
});
