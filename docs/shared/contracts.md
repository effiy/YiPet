# YiPet Contracts

## Extension Entry Points

- **Content Script**: Injected into web pages, renders pet + chat UI
- **Background Script**: `modules/extension/background/index.js` — handles events, storage
- **Popup**: Extension toolbar popup UI

## Module Contract

```js
// All modules mount to shared namespace
window.PetManager = window.PetManager || {};
window.PetManager.Components = window.PetManager.Components || {};

// Each module is an IIFE
(function(namespace) {
  // Module code
})(window.PetManager);
```

## Storage Contract

- **chrome.storage.local** — persistent data (settings, sessions, FAQ)
- Namespace: per-feature keys

## API Contract

- API Base: configured via `core/config.js`
- Auth: `X-Token` header
- Same API endpoints as YiAi (chat, FAQ, file operations)

## Content Script Contract

- Manifest V3 `content_scripts` ordered by dependency
- No ES modules in content scripts (traditional script tags)
- Minimum permissions principle in manifest.json
