# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension (Manifest V3) called "温柔陪伴助手" (Gentle Companionship Assistant) that adds interactive AI-powered virtual pets to web pages.

**Key Features:**
- Virtual pet display on web pages with drag-and-drop support
- AI chat interface with streaming responses
- Screenshot capabilities (region selection)
- Session management with import/export (ZIP format)
- FAQ system with tagging
- Mermaid diagram rendering
- Multiple pet roles (Teacher, Doctor, Pastry Chef, Police Officer)
- Keyboard shortcuts (Ctrl+Shift+P to toggle pet, Ctrl+Shift+X to open chat)

**Technology Stack:**
- Vanilla JavaScript (no framework for core extension)
- Vue.js 3 for UI components
- Chrome Extension API (Manifest V3)
- External libraries: marked, html2canvas, JSZip, mermaid, turndown, md5

## Development Setup

This is a zero-build extension - files are ready to be loaded directly into Chrome as an unpacked extension.

### Loading the Extension in Chrome:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked" and select this repository directory

### Environment Configuration:
- API endpoints are configured in `core/config.js`
- Default environment: `production` (uses `https://api.effiy.cn`)
- Set `window.__PET_ENV_MODE__` to `development` or `staging` before loading config to use different endpoints
- Development mode uses `http://localhost:8000`

## Architecture

### Directory Structure:
```
├── manifest.json                    # Extension manifest
├── assets/                          # Global assets (styles, images, icons)
│   ├── styles/                      # Stylesheets
│   ├── images/                      # Pet role images
│   └── icons/                       # Extension icons
├── core/                            # Core system modules
│   ├── config.js                    # Centralized configuration
│   ├── bootstrap/                   # Bootstrap/init code
│   ├── constants/                   # Constants (endpoints, etc.)
│   ├── api/                         # API integration layer
│   │   ├── core/                    # API manager
│   │   ├── services/                # API services (Session, FAQ)
│   │   └── utils/                   # API utilities (token, logger, error)
│   └── utils/                       # Global utility modules
│       ├── api/                     # API-specific utilities
│       ├── dom/                     # DOM manipulation
│       ├── storage/                 # Chrome storage utilities
│       ├── media/                   # Media handling (images, resources)
│       └── ui/                      # UI utilities (loading, notifications)
├── libs/                            # Third-party libraries
├── modules/                         # Feature modules (by functionality)
│   ├── pet/                         # Pet management module
│   │   ├── components/              # Vue components (chat, modals, managers)
│   │   ├── content/                 # Core pet manager logic
│   │   │   ├── core/                # Main pet manager implementation
│   │   │   └── modules/             # Feature modules (AI, auth, roles, etc.)
│   │   └── styles/                  # Pet-specific styles
│   ├── chat/                        # Chat functionality module
│   ├── faq/                         # FAQ system module
│   ├── session/                     # Session management module
│   ├── screenshot/                  # Screenshot functionality module
│   ├── mermaid/                     # Mermaid diagram rendering module
│   └── extension/                   # Chrome extension system
│       ├── background/              # Background service worker
│       ├── content-scripts/         # Content scripts
│       ├── popup/                   # Popup UI
│       └── messaging/               # Message routing
└── docs/                            # Documentation
```

### Key Modules:

**PetManager** (`modules/pet/content/`):
- Main entry: `petManager.js` (lightweight assembly)
- Core implementation: `core/petManager.core.js`
- Feature modules: `modules/petManager.*.js` (ai, auth, roles, session, etc.)
- Feature files: `petManager.*.js` (chat, drag, events, screenshot, ui, state, etc.)
- Vue components in `modules/pet/components/`

**Background Script** (`modules/extension/background/`):
- Service worker: `index.js`
- Message handlers: `actions/*.js` (extension, pet, tab, screenshot handlers)
- Message router: `messaging/messageRouter.js`

**API Layer** (`core/api/`):
- `core/ApiManager.js` - API request management
- `services/SessionService.js` - Session CRUD operations
- `services/FaqService.js` - FAQ CRUD operations
- `utils/` - Token management, logging, error handling (under `core/utils/api/`)

**Vue Components** (`modules/pet/components/`):
- `chat/ChatWindow/` - Main chat interface
- `modal/` - Settings modals (AI, token)
- `manager/` - FAQ and session tag managers
- `editor/` - Session info editor

### Message Flow:
- Popup ↔ Background ↔ Content Script via Chrome Runtime Messaging
- Content script uses `window.PetManager` as main entry point
- Background uses `messageRouter.js` to route actions to handlers

## Common Development Tasks

### Adding a New Pet Role:
1. Add role configuration in `petManager.roles.js`
2. Add role image assets in `assets/images/{roleName}/`
3. Update manifest `web_accessible_resources` if needed

### Modifying API Endpoints:
- Edit `core/config.js` - endpoints are configured per environment
- Constants also in `core/constants/endpoints.js`

### Working with Vue Components:
- Components are loaded as HTML templates via `web_accessible_resources`
- Vue 3 is loaded globally from `libs/vue.global.js`
- Component JS files define Vue apps using `Vue.createApp()`

### Debugging:
- Content script logs: Open web page DevTools → Console
- Background script logs: `chrome://extensions/` → Inspect views service worker
- Popup logs: Right-click extension icon → Inspect popup

## Storage

Chrome `storage.local` is used with keys:
- `petGlobalState` - Pet visibility, position, size, color
- `petChatWindowState` - Chat window position and size
- `petSettings` - User settings (API token, AI config)
- `petDevMode` - Dev mode flag

## Keyboard Shortcuts

- `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`) - Toggle pet display
- `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`) - Open chat window
