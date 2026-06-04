import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  delete globalThis.StorageUtils;
  delete globalThis.StorageHelper;
  delete globalThis.SessionManager;
  delete globalThis.getPetDefaultPosition;
  delete globalThis.getChatWindowDefaultPosition;
  delete globalThis.getCenterPosition;
  delete globalThis.PET_CONFIG;
  clearChromeStorage();
  clearChromeError();
  restoreExtensionContext();
});

// ── chrome.storage mock tests ──────────────────────────────

describe('chrome.storage mock', () => {
  it('stores and retrieves values', () => {
    chrome.storage.local.set({ key1: 'value1' }, () => {});
    let result;
    chrome.storage.local.get(['key1'], (data) => { result = data; });
    expect(result.key1).toBe('value1');
  });

  it('returns undefined for missing keys', () => {
    let result;
    chrome.storage.local.get(['nonexistent'], (data) => { result = data; });
    expect(result.nonexistent).toBeUndefined();
  });

  it('removes keys', () => {
    chrome.storage.local.set({ k1: 'v1', k2: 'v2' }, () => {});
    chrome.storage.local.remove(['k1'], () => {});
    let result;
    chrome.storage.local.get(['k1', 'k2'], (data) => { result = data; });
    expect(result.k1).toBeUndefined();
    expect(result.k2).toBe('v2');
  });

  it('clears all data', () => {
    chrome.storage.local.set({ k1: 'v1', k2: 'v2' }, () => {});
    chrome.storage.local.clear(() => {});
    let result;
    chrome.storage.local.get(null, (data) => { result = data; });
    expect(Object.keys(result).length).toBe(0);
  });

  it('simulates lastError', () => {
    setChromeError('Something went wrong');
    let errorResult = null;
    chrome.storage.local.get(['key'], (data) => {
      errorResult = chrome.runtime.lastError?.message;
    });
    expect(errorResult).toBe('Something went wrong');
  });
});

// ── StorageUtils tests ─────────────────────────────────────

describe('StorageUtils', () => {
  beforeEach(() => {
    // Set up PET_CONFIG for StorageUtils defaults
    globalThis.PET_CONFIG = {
      constants: {
        storageKeys: { globalState: 'petGlobalState', devMode: 'petDevMode' },
        DEFAULTS: { PET_ROLE: '教师' },
      },
      pet: { defaultVisible: false, defaultColorIndex: 0, defaultSize: 180 },
    };
    loadModule('core/utils/api/error.js');
    loadModule('core/utils/storage/storageUtils.js');
  });

  describe('isChromeStorageAvailable', () => {
    it('returns true when chrome.storage is available', () => {
      const su = new globalThis.StorageUtils();
      expect(su.isChromeStorageAvailable()).toBeTruthy();
    });

    it('returns false when extension context is invalidated', () => {
      invalidateExtensionContext();
      const su = new globalThis.StorageUtils();
      expect(su.isChromeStorageAvailable()).toBeFalsy();
    });
  });

  describe('normalizeState', () => {
    it('fills defaults for missing fields', () => {
      const su = new globalThis.StorageUtils();
      const normalized = su.normalizeState({});
      expect(normalized.visible).toBe(false);
      expect(normalized.color).toBe(0);
      expect(normalized.size).toBe(180);
      expect(normalized.role).toBe('教师');
    });

    it('preserves existing values', () => {
      const su = new globalThis.StorageUtils();
      const normalized = su.normalizeState({ visible: true, size: 200 });
      expect(normalized.visible).toBe(true);
      expect(normalized.size).toBe(200);
    });

    it('returns null for null state', () => {
      const su = new globalThis.StorageUtils();
      expect(su.normalizeState(null)).toBeNull();
    });
  });

  describe('loadFromChromeStorage', () => {
    it('loads stored value by key', async () => {
      chrome.storage.local.set({ petGlobalState: { visible: true } }, () => {});
      const su = new globalThis.StorageUtils();
      const result = await su.loadFromChromeStorage('petGlobalState');
      expect(result).toEqual({ visible: true });
    });

    it('returns null for missing key', async () => {
      const su = new globalThis.StorageUtils();
      const result = await su.loadFromChromeStorage('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when chrome.storage is unavailable', async () => {
      invalidateExtensionContext();
      const su = new globalThis.StorageUtils();
      const result = await su.loadFromChromeStorage('petGlobalState');
      expect(result).toBeNull();
    });
  });

  describe('saveToChromeStorage', () => {
    it('saves and returns true', async () => {
      const su = new globalThis.StorageUtils();
      const result = await su.saveToChromeStorage('testKey', { data: 42 });
      expect(result).toBe(true);
    });

    it('returns false when chrome.storage is unavailable', async () => {
      invalidateExtensionContext();
      const su = new globalThis.StorageUtils();
      const result = await su.saveToChromeStorage('testKey', { data: 42 });
      expect(result).toBe(false);
    });
  });

  describe('loadGlobalState', () => {
    it('loads and normalizes global state', async () => {
      chrome.storage.local.set({ petGlobalState: { visible: true } }, () => {});
      const su = new globalThis.StorageUtils();
      const state = await su.loadGlobalState();
      expect(state.visible).toBe(true);
      expect(state.size).toBe(180); // default filled
    });
  });

  describe('saveGlobalState', () => {
    it('saves normalized state with timestamp', async () => {
      const su = new globalThis.StorageUtils();
      await su.saveGlobalState({ visible: true });
      let stored;
      chrome.storage.local.get(['petGlobalState'], (data) => { stored = data.petGlobalState; });
      expect(stored.visible).toBe(true);
      expect(typeof stored.timestamp).toBe('number');
    });
  });
});

// ── StorageHelper tests (bootstrap.js) ─────────────────────

describe('StorageHelper', () => {
  beforeEach(() => {
    globalThis.PET_CONFIG = {
      constants: {
        storageKeys: { globalState: 'petGlobalState', devMode: 'petDevMode' },
        DEFAULTS: { PET_ROLE: '教师' },
      },
      pet: { defaultVisible: false, defaultColorIndex: 0, defaultSize: 180 },
    };
    loadModule('core/utils/api/error.js');
    loadModule('core/bootstrap/bootstrap.js');
  });

  describe('isChromeStorageAvailable', () => {
    it('returns true when chrome.runtime.id exists', () => {
      expect(globalThis.StorageHelper.isChromeStorageAvailable()).toBe(true);
    });

    it('returns false when extension context is invalidated', () => {
      invalidateExtensionContext();
      expect(globalThis.StorageHelper.isChromeStorageAvailable()).toBe(false);
    });
  });

  describe('set and get', () => {
    it('sets and retrieves a value', async () => {
      const result = await globalThis.StorageHelper.set('testKey', 'testValue');
      expect(result.success).toBe(true);
      const stored = await globalThis.StorageHelper.get('testKey');
      expect(stored).toBe('testValue');
    });

    it('returns contextInvalidated when chrome.storage unavailable', async () => {
      invalidateExtensionContext();
      const result = await globalThis.StorageHelper.set('testKey', 'value');
      expect(result.success).toBe(false);
      expect(result.contextInvalidated).toBe(true);
    });

    it('get returns null for missing keys', async () => {
      const result = await globalThis.StorageHelper.get('nonexistentKey');
      expect(result).toBeNull();
    });
  });

  describe('cleanupOldData', () => {
    it('removes petOssFiles key', async () => {
      chrome.storage.local.set({ petOssFiles: { files: ['a', 'b'] } }, () => {});
      await globalThis.StorageHelper.cleanupOldData();
      let data;
      chrome.storage.local.get(null, (d) => { data = d; });
      expect(data.petOssFiles).toBeUndefined();
    });

    it('handles context invalidation gracefully', async () => {
      invalidateExtensionContext();
      // Should not throw
      await expect(globalThis.StorageHelper.cleanupOldData()).resolves.toBeUndefined();
    });
  });
});

// ── Position helpers (bootstrap.js) ────────────────────────

describe('Position helpers', () => {
  beforeEach(() => {
    loadModule('core/bootstrap/bootstrap.js');
    globalThis.innerWidth = 1920;
    globalThis.innerHeight = 1080;
  });

  it('getPetDefaultPosition returns default position', () => {
    const pos = globalThis.getPetDefaultPosition();
    expect(pos.x).toBe(20);
    expect(pos.y).toBe(Math.round(1080 * 0.2));
  });

  it('getChatWindowDefaultPosition returns top-right position', () => {
    const pos = globalThis.getChatWindowDefaultPosition(700, 720);
    expect(pos.x).toBe(1920 - 700);
    expect(pos.y).toBe(0);
  });

  it('getCenterPosition centers element in window', () => {
    const center = globalThis.getCenterPosition(400, 1920);
    expect(center).toBe(760);
  });
});

// ── SessionManager tests ───────────────────────────────────

describe('SessionManager', () => {
  beforeEach(() => {
    loadModule('core/utils/session/sessionManager.js');
  });

  describe('constructor', () => {
    it('initializes with default options', () => {
      const sm = new globalThis.SessionManager();
      expect(sm.sessions).toEqual({});
      expect(sm.currentSessionId).toBeNull();
      expect(sm.enableBackendSync).toBe(false);
    });
  });

  describe('createSession', () => {
    it('creates session with UUID key', () => {
      const sm = new globalThis.SessionManager();
      const session = sm.createSession('test-id', {
        url: 'http://example.com',
        title: 'Test Page',
      });
      expect(session.key).toBeDefined();
      expect(session.key).toMatch(/^[0-9a-f-]{36}$/);
      expect(session.url).toBe('http://example.com');
      expect(session.title).toBe('Test Page.md');
      expect(session.messages).toEqual([]);
      expect(session.tags).toEqual(['chat']);
      expect(typeof session.createdAt).toBe('number');
    });
  });

  describe('saveSession', () => {
    it('saves session to in-memory store', async () => {
      const sm = new globalThis.SessionManager();
      const session = sm.createSession('sid-1', { url: 'http://example.com', title: 'Page' });
      sm.sessions['sid-1'] = session;
      const result = await sm.saveSession('sid-1');
      expect(result).toBe(true);
      expect(sm.sessions['sid-1'].updatedAt).toBeDefined();
    });

    it('returns false for non-existent session', async () => {
      const sm = new globalThis.SessionManager();
      const result = await sm.saveSession('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('activateSession', () => {
    it('activates and sets currentSessionId', async () => {
      const sm = new globalThis.SessionManager();
      const session = sm.createSession('sid-1', { url: 'http://example.com', title: 'Page' });
      sm.sessions['sid-1'] = session;
      const result = await sm.activateSession('sid-1');
      expect(result).toBe(true);
      expect(sm.currentSessionId).toBe('sid-1');
    });

    it('returns false for non-existent session', async () => {
      const sm = new globalThis.SessionManager();
      const result = await sm.activateSession('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('removes session from store', async () => {
      const sm = new globalThis.SessionManager();
      const session = sm.createSession('sid-1', { url: 'http://example.com', title: 'Page' });
      sm.sessions['sid-1'] = session;
      const result = await sm.deleteSession('sid-1');
      expect(result).toBe(true);
      expect(sm.sessions['sid-1']).toBeUndefined();
    });

    it('clears currentSessionId if deleting active session', async () => {
      const sm = new globalThis.SessionManager();
      const session = sm.createSession('sid-1', { url: 'http://example.com', title: 'Page' });
      sm.sessions['sid-1'] = session;
      sm.currentSessionId = 'sid-1';
      await sm.deleteSession('sid-1');
      expect(sm.currentSessionId).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('returns all sessions sorted', () => {
      const sm = new globalThis.SessionManager();
      const s1 = sm.createSession('sid-1', { url: 'http://a.com', title: 'B Page' });
      const s2 = sm.createSession('sid-2', { url: 'http://b.com', title: 'A Page' });
      s1.id = 'sid-1';
      s2.id = 'sid-2';
      sm.sessions = { 'sid-1': s1, 'sid-2': s2 };
      const all = sm.getAllSessions();
      expect(all).toHaveLength(2);
      expect(all[0].title).toBe('A Page.md');
    });
  });

  describe('searchSessions', () => {
    it('finds sessions by title match', async () => {
      const sm = new globalThis.SessionManager();
      const s1 = sm.createSession('sid-1', { url: 'http://a.com', title: 'Hello World' });
      s1.id = 'sid-1';
      const s2 = sm.createSession('sid-2', { url: 'http://b.com', title: 'Foo Bar' });
      s2.id = 'sid-2';
      sm.sessions = { 'sid-1': s1, 'sid-2': s2 };
      const results = await sm.searchSessions('hello');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Hello World.md');
    });

    it('returns empty for no match', async () => {
      const sm = new globalThis.SessionManager();
      const results = await sm.searchSessions('nothing');
      expect(results).toEqual([]);
    });

    it('returns empty for empty query', async () => {
      const sm = new globalThis.SessionManager();
      const results = await sm.searchSessions('');
      expect(results).toEqual([]);
    });
  });

  describe('clearAllSessions', () => {
    it('clears all sessions and resets state', async () => {
      const sm = new globalThis.SessionManager();
      sm.sessions['sid-1'] = { id: 'sid-1' };
      sm.currentSessionId = 'sid-1';
      await sm.clearAllSessions();
      expect(sm.sessions).toEqual({});
      expect(sm.currentSessionId).toBeNull();
    });
  });
});