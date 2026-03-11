# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YiPet** - 温柔陪伴助手 (Gentle Companion Assistant)
- **Type**: Chrome/Firefox Browser Extension (Manifest V3)
- **Version**: 1.1.1
- **Purpose**: Adds a virtual pet companion to web browsing with AI chat capabilities

### Key Features
- Interactive pet overlay on web pages (draggable, resizable)
- AI chat integration with multiple models
- Screenshot tools and region capture
- Session management with import/export (ZIP)
- FAQ management with tags
- Mermaid diagram rendering
- WeWork (企业微信) integration
- Multiple pet roles (教师, 医生, 甜品师, 警察)

### Keyboard Shortcuts
- `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`): Toggle pet display/hide
- `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`): Toggle chat window

## Architecture

### File Structure

```
YiPet/
├── manifest.json                   # Extension configuration
├── cdn/                            # CDN-hosted static assets
│   ├── libs/                       # Third-party libraries (local)
│   │   ├── vue.global.js          # Vue.js framework
│   │   ├── marked.min.js          # Markdown parsing
│   │   ├── html2canvas.min.js     # Screenshot capture
│   │   ├── jszip.min.js           # ZIP archive handling
│   │   ├── mermaid.min.js         # Diagram rendering
│   │   ├── md5.js                 # MD5 hashing
│   │   └── turndown.js            # HTML to Markdown
│   ├── core/                       # Core modules
│   │   ├── config.js              # Central configuration (PET_CONFIG)
│   │   ├── constants/endpoints.js # API endpoints
│   │   └── bootstrap/              # Bootstrap logic
│   ├── utils/                      # Shared utilities
│   │   ├── dom/                   # DOM helpers
│   │   ├── storage/               # Storage utilities
│   │   ├── session/               # Session manager
│   │   ├── media/                 # Image resource manager
│   │   ├── logging/               # Logger utilities
│   │   ├── error/                 # Error handler
│   │   └── ui/                    # UI utilities
│   ├── assets/
│   │   ├── icons/
│   │   ├── images/                # Pet avatars (教师, 医生, 甜品师, 警察)
│   │   └── styles/
│   └── components/                 # Vue components
│       ├── chat/                   # Chat components
│       ├── manager/                # Manager components
│       ├── modal/                  # Modal components
│       └── editor/                 # Editor components
├── src/
│   ├── api/                        # API layer
│   │   ├── core/ApiManager.js     # Request manager with interceptors
│   │   ├── services/              # SessionService, FaqService, AuthService, ConfigService
│   │   └── utils/                 # token, logger, error, request
│   ├── extension/
│   │   └── background/            # Service worker
│   │       ├── index.js
│   │       ├── actions/           # petHandler, screenshotHandler, tabHandler, etc.
│   │       ├── messaging/         # messageRouter
│   │       ├── services/          # injectionService, tabMessaging
│   │       ├── bootstrap/         # Background imports
│   │       ├── app/               # App registration
│   │       └── integrations/wework/
│   ├── features/
│   │   ├── petManager/            # Core pet functionality (content scripts)
│   │   ├── chat/content/          # export-chat-to-png.js
│   │   ├── faq/content/           # FAQ management
│   │   ├── mermaid/page/          # Mermaid rendering
│   │   └── session/page/          # Session import/export
│   └── views/popup/               # Popup UI
└── CLAUDE.md                       # This file
```

## Configuration

**Central Config**: `cdn/core/config.js` exposes `window.PET_CONFIG`

Key configuration sections:
- `pet`: Pet size, position, colors, visibility
- `chatWindow`: Chat window dimensions, behavior
- `api`: API endpoints (api.effiy.cn)
- `chatModels`: AI model configuration (uses text input, default empty)
- `env`: Environment modes (production/staging/development) with endpoint overrides

## Development

### Setup
1. Load unpacked extension from the `YiPet/` directory in Chrome/Firefox developer tools
2. No build step required - modify source files directly and reload extension

### Permissions
- `activeTab`, `storage`, `tabs`, `scripting`, `webRequest`
- Host permissions: `<all_urls>` (content script injection), `https://api.effiy.cn/*`

## API Layer

**Base URL**: `https://api.effiy.cn`

**ApiManager Features**:
- Request/response interceptors
- Token management (X-Token header)
- Error handling with retry logic
- Request logging
- Statistics tracking

**Services**:
- `SessionService` - CRUD for chat sessions
- `FaqService` - FAQ management
- `AuthService` - Authentication
- `ConfigService` - Configuration sync

## Third-party Libraries

All libraries are included locally in `cdn/libs/` (no CDN dependencies):
- **Vue.js** - UI framework (global `Vue`)
- **marked** - Markdown parsing
- **html2canvas** - Screenshot capture
- **jsZip** - ZIP export/import
- **mermaid** - Diagram rendering
- **md5** - Hash generation
- **turndown** - HTML to Markdown conversion

## Styling

- Tailwind CSS (via CDN in HTML)
- Custom animations in `cdn/assets/styles/base/animations.css`
- Pet gradient colors (5 themes)

## Security

- Network access restricted to `https://api.effiy.cn/*`
- Content scripts injected on all URLs (`<all_urls>`) for pet overlay
- No external CDNs for libraries (all local in `cdn/libs/`)

## Key Files to Modify

| Task | File(s) |
|------|---------|
| Change pet appearance | `cdn/core/config.js` (pet.colors), `cdn/assets/images/` |
| Add chat model | `cdn/core/config.js` (chatModels) |
| Modify API endpoint | `cdn/core/config.js` (api) |
| Add pet feature | `src/features/petManager/content/modules/petManager.*.js` |
| Update background logic | `src/extension/background/actions/` |
| Change manifest | `manifest.json` |
| Update Vue components | `cdn/components/` |
