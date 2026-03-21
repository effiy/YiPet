# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension (Manifest V3) called "温柔陪伴助手" (Gentle Companionship Assistant) that adds interactive AI-powered virtual pets to web pages.

**核心功能 (Key Features):**
- 虚拟宠物在网页上的展示和拖拽支持
- AI 聊天界面，支持流式响应
- 带有标签管理的 FAQ 系统
- Mermaid 图表渲染
- 多种宠物角色（教师、医生、甜品师、警察）
- 键盘快捷键（Ctrl+Shift+P 切换宠物显示，Ctrl+Shift+X 打开聊天窗口）

**技术栈 (Technology Stack):**
- 原生 JavaScript（核心扩展无框架）
- Vue.js 3 用于 UI 组件
- Chrome Extension API (Manifest V3)
- 外部库：marked, mermaid, turndown, md5

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
│   │   ├── base/                    # Base styles (animations, theme)
│   │   ├── content.css              # Content script styles
│   │   ├── popup.css                # Popup UI styles
│   │   └── tailwind.css             # Tailwind CSS utilities
│   ├── images/                      # Pet role images
│   │   ├── 医生/                    # Doctor role
│   │   ├── 教师/                    # Teacher role (with run animation)
│   │   ├── 甜品师/                  # Pastry Chef role
│   │   └── 警察/                    # Police Officer role
│   └── icons/                       # Extension icons (16, 32, 48, 128px)
├── core/                            # Core system modules
│   ├── config.js                    # Centralized configuration
│   ├── bootstrap/                   # Bootstrap/init code
│   ├── constants/                   # Constants (endpoints, etc.)
│   ├── api/                         # API integration layer
│   │   ├── core/                    # API manager (ApiManager.js)
│   │   ├── services/                # API services (SessionService, FaqService)
│   │   └── utils/                   # API utilities (error, logger, request, token)
│   └── utils/                       # Global utility modules
│       ├── api/                     # API-specific utilities
│       ├── dom/                     # DOM manipulation (domHelper.js)
│       ├── error/                   # Error handling (errorHandler.js)
│       ├── logging/                 # Logging utilities (loggerUtils.js)
│       ├── media/                   # Media handling (imageResourceManager.js)
│       ├── messaging/               # Chrome messaging (messageHelper.js)
│       ├── runtime/                 # Runtime utilities (globalAccessor, moduleUtils)
│       ├── session/                 # Session management (sessionManager.js)
│       ├── storage/                 # Chrome storage utilities (storageUtils.js)
│       ├── time/                    # Time utilities (timeUtils.js)
│       └── ui/                      # UI utilities (loading, notifications)
├── libs/                            # Third-party libraries
│   ├── marked.min.js                # Markdown parser
│   ├── md5.js                       # MD5 hashing
│   ├── mermaid.min.js               # Mermaid diagram renderer
│   ├── turndown.js                  # HTML to Markdown converter
│   └── vue.global.js                # Vue.js 3 runtime
├── modules/                         # Feature modules (by functionality)
│   ├── pet/                         # Pet management module
│   │   ├── components/              # Vue components
│   │   │   ├── chat/                # Chat components (ChatWindow, ChatHeader, ChatInput, ChatMessages)
│   │   │   ├── modal/               # Settings modals (AiSettingsModal, TokenSettingsModal)
│   │   │   ├── manager/             # Managers (FaqManager, FaqTagManager, SessionTagManager)
│   │   │   └── editor/              # Editor (SessionInfoEditor)
│   │   ├── content/                 # Core pet manager logic
│   │   │   ├── core/                # Main pet manager implementation (petManager.core.js)
│   │   │   ├── modules/             # Feature modules (ai, auth, roles, session, mermaid, etc.)
│   │   │   ├── components/          # Content script components
│   │   │   └── petManager.*.js      # Feature files (chat, drag, events, state, ui, etc.)
│   │   └── styles/                  # Pet-specific styles
│   ├── chat/                        # Chat functionality module
│   ├── faq/                         # FAQ system module
│   │   └── content/                 # FAQ implementation (faq.js, tags.js)
│   ├── session/                     # Session management module
│   ├── mermaid/                     # Mermaid diagram rendering module
│   │   └── page/                    # Mermaid scripts (load, preview, render)
│   └── extension/                   # Chrome extension system
│       ├── background/              # Background service worker
│       │   ├── index.js             # Background entry point
│       │   ├── actions/             # Message handlers (extension, pet, tab handlers)
│       │   ├── messaging/           # Message routing (messageRouter.js)
│       │   ├── services/            # Background services (injection, tabMessaging)
│       │   ├── app/                 # App registration
│       │   ├── bootstrap/           # Bootstrap imports
│       │   └── integrations/        # External integrations (wework)
│       ├── content-scripts/         # Content scripts
│       └── popup/                   # Popup UI (index.html, index.js)
└── docs/                            # Documentation
    ├── 核心功能/                    # Core feature documentation
    ├── 组件库/                      # Vue component documentation
    ├── 开发规范/                    # Development standards
    ├── devOps/                      # DevOps documentation (needs, plans, specs, tests)
    ├── 架构设计.md                  # Architecture design
    ├── 目录结构.md                  # Directory structure (this doc)
    ├── 配置指南.md                  # Configuration guide
    ├── API端点.md                   # API endpoints
    └── README.md                    # Main documentation
```

### Key Modules:

**PetManager** (`modules/pet/content/`):
- Main entry: `petManager.js` (lightweight assembly)
- Core implementation: `core/petManager.core.js`
- Feature modules: `modules/petManager.*.js` (ai, auth, roles, session, etc.)
- Feature files: `petManager.*.js` (chat, drag, events, ui, state, etc.)
- Vue components in `modules/pet/components/`

**Background Script** (`modules/extension/background/`):
- Service worker: `index.js`
- Message handlers: `actions/*.js` (extension, pet, tab, messageForward handlers)
- Message router: `messaging/messageRouter.js`
- Services: `services/` (injectionService, tabMessaging)
- Integrations: `integrations/wework/` (WeWork integration handler and service)

**API Layer** (`core/api/`):
- `core/ApiManager.js` - API request management
- `services/SessionService.js` - Session CRUD operations
- `services/FaqService.js` - FAQ CRUD operations
- `utils/` - Token management, logging, error handling, request helpers (under `core/api/utils/`)

**Core Utilities** (`core/utils/`):
- `dom/` - DOM manipulation helpers
- `error/` - Global error handling
- `logging/` - Logging utilities
- `media/` - Image and resource management
- `messaging/` - Chrome Runtime messaging helpers
- `runtime/` - Global accessors and module utilities
- `session/` - Session storage management
- `storage/` - Chrome storage wrapper
- `time/` - Time and date utilities
- `ui/` - Loading animations and notifications

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
