# YiPet Architecture

## Overview

Chrome Extension (Manifest V3) providing a virtual pet companion with AI chat, FAQ, and Mermaid rendering.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Platform | Chrome Extension Manifest V3 |
| Core Logic | Vanilla JavaScript ES6+ |
| UI | Vue 3 (Global Build) |
| Styling | Tailwind CSS |
| Rendering | marked + turndown + mermaid |
| Storage | chrome.storage.local |

## Directory Structure

```
YiPet/
├── core/                    # Core modules
│   ├── config.js            # Global config + env detection
│   ├── utils/               # Utility functions
│   ├── api/                 # API services
│   ├── constants/           # Constants
│   ├── bootstrap/           # Content Script entry + init
│   └── module.md            # Module manifest
├── modules/                 # Feature modules
│   ├── pet/                 # Pet management (UI, chat, session)
│   ├── faq/                 # FAQ management + tags
│   ├── mermaid/             # Mermaid rendering
│   ├── extension/           # Extension system (background, popup)
│   ├── chat/                # Chat export
│   ├── screenshot/          # Area screenshot
│   └── session/             # Session import/export
├── libs/                    # Third-party libraries
├── assets/                  # Static resources (styles, icons, images)
└── manifest.json            # Extension config
```

## Key Architecture Patterns

1. **IIFE Module Encapsulation** — All business modules use IIFE, mounted to `window.PetManager` namespace.

2. **Content Script Loading** — `manifest.json` `content_scripts` entries ordered by dependency chain.

3. **State Management** — `createStore + useComputed + useMethods` hooks pattern.

4. **Component Registration** — Shared components under `modules/pet/components/`, mounted via IIFE namespace.

5. **Vue Integration** — Vue 3 Global Build with template caching.

## Key Features

- **Virtual Pet**: Real-time display, drag, animation effects
- **AI Chat**: Streaming responses, Markdown + Mermaid rendering
- **Role System**: 4 roles (Teacher, Doctor, Pastry Chef, Police)
- **Session Management**: Save/manage multiple sessions with tags
- **FAQ Knowledge Base**: Quick retrieval and reuse
- **Mermaid Rendering**: Diagram rendering in chat
