/**
 * Chrome API Mock Layer
 * Storage delegates to globalThis.chrome (set up by tests/setup.mjs) so
 * setStorageValue / getStorageValue use the same Map backend as all other tests.
 */

class EventEmitter {
  constructor () {
    this._listeners = new Set();
  }
  addListener (fn) { this._listeners.add(fn); }
  removeListener (fn) { this._listeners.delete(fn); }
  hasListeners () { return this._listeners.size > 0; }
  emit (...args) {
    for (const fn of this._listeners) {
      try { fn(...args); } catch (_) { /* noop */ }
    }
  }
}

const onMessage = new EventEmitter();
const onChanged = new EventEmitter();
const onCommand = new EventEmitter();

const runtimeListeners = [];

function _addRuntimeListener (fn) {
  runtimeListeners.push(fn);
}

function dispatchSendMessage (message) {
  let sendResponseResult = undefined;
  for (const listener of runtimeListeners) {
    const sender = { id: 'mock-sender', tab: { id: 999 } };
    let syncResponse;
    let asyncCalled = false;

    const sendResponse = (val) => {
      asyncCalled = true;
      sendResponseResult = val;
    };

    syncResponse = listener(message, sender, sendResponse);

    if (syncResponse !== undefined && syncResponse !== null && typeof syncResponse === 'object' && typeof syncResponse.then === 'function') {
      return syncResponse;
    }

    if (asyncCalled && sendResponseResult !== undefined) {
      return Promise.resolve(sendResponseResult);
    }

    if (syncResponse === true) {
      return Promise.resolve(sendResponseResult);
    }
  }
  return Promise.resolve(undefined);
}

/**
 * Returns a chrome API mock whose storage delegates to globalThis.chrome
 * (the setup.mjs backend). The SW tests set global.chrome = createChromeMock()
 * and its storage calls flow through to the shared storageData Map.
 */
export function createChromeMock () {
  // Capture the current global chrome (setup.mjs) so storage delegation
  // works even after the caller replaces globalThis.chrome with this mock.
  const _chrome = globalThis.chrome;

  const storageLocal = {
    get (keys, callback) {
      _chrome.storage.local.get(keys, callback);
    },
    set (items, callback) {
      _chrome.storage.local.set(items, callback);
    },
    remove (keys, callback) {
      _chrome.storage.local.remove(keys, callback);
    },
    clear (callback) {
      _chrome.storage.local.clear(callback);
    },
  };

  return {
    runtime: {
      id: 'mock-extension-id',
      lastError: null,
      onMessage: {
        addListener: _addRuntimeListener,
        removeListener (fn) {
          const idx = runtimeListeners.indexOf(fn);
          if (idx !== -1) runtimeListeners.splice(idx, 1);
        },
        hasListeners: () => runtimeListeners.length > 0,
        hasListener: (fn) => runtimeListeners.includes(fn),
      },
      onInstalled: { addListener: () => {} },
      sendMessage (message) {
        return dispatchSendMessage(message);
      },
      getURL (path) {
        return `chrome-extension://mock-extension-id/${path}`;
      },
      getManifest () {
        return { version: '1.0.0', name: 'YiPet' };
      },
    },
    storage: {
      local: storageLocal,
      onChanged,
    },
    tabs: {
      onUpdated: { addListener: () => {} },
      query (_, callback) { callback([]); },
      sendMessage (_tabId, _message, callback) {
        if (callback) callback();
      },
    },
    action: {
      onClicked: { addListener: () => {} },
    },
    commands: {
      onCommand: { addListener: () => {} },
    },
  };
}

export function resetChromeMock () {
  runtimeListeners.length = 0;
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.lastError = null;
  }
}

export function setStorageValue (key, value) {
  globalThis.chrome.storage.local.set({ [key]: value }, () => {});
}

export function getStorageValue (key) {
  let result;
  globalThis.chrome.storage.local.get([key], (data) => { result = data[key]; });
  return result;
}

export function clearStorage () {
  globalThis.chrome.storage.local.clear(() => {});
}

export function setRuntimeError (error) {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.lastError = { message: error };
  }
}

export { onMessage, onChanged, onCommand, runtimeListeners };
