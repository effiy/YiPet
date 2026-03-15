# 项目结构

```
温柔陪伴助手/
├── 📄 manifest.json                    # 扩展清单文件
├── 📄 CLAUDE.md                        # Claude Code 指导文档
├── 📄 README.md                        # 项目说明文档
│
├── 📁 cdn/
│   ├── 📁 core/                        # 🔧 核心工具和配置
│   │   ├── 📄 config.js               # 集中配置
│   │   ├── 📁 bootstrap/              # 引导/初始化代码
│   │   │   ├── 📄 bootstrap.js
│   │   │   └── 📄 index.js
│   │   └── 📁 constants/              # 常量（端点等）
│   │       └── 📄 endpoints.js
│   │
│   ├── 📁 libs/                        # 📚 第三方库
│   │   ├── 📄 html2canvas.min.js
│   │   ├── 📄 jszip.min.js
│   │   ├── 📄 marked.min.js
│   │   ├── 📄 md5.js
│   │   ├── 📄 mermaid.min.js
│   │   ├── 📄 turndown.js
│   │   └── 📄 vue.global.js
│   │
│   ├── 📁 assets/                      # 🎨 样式、图片、图标
│   │   ├── 📁 icons/                   # 图标资源
│   │   │   ├── 🖼️ icon.png
│   │   │   ├── 🖼️ icon128.png
│   │   │   ├── 🖼️ icon16.png
│   │   │   ├── 🖼️ icon32.png
│   │   │   └── 🖼️ icon48.png
│   │   │
│   │   ├── 📁 images/                  # 宠物图片资源
│   │   │   ├── 📁 医生/
│   │   │   │   └── 🖼️ icon.png
│   │   │   ├── 📁 教师/
│   │   │   │   ├── 🖼️ icon.png
│   │   │   │   └── 📁 run/
│   │   │   │       ├── 🖼️ 1.png
│   │   │   │       ├── 🖼️ 2.png
│   │   │   │       └── 🖼️ 3.png
│   │   │   ├── 📁 甜品师/
│   │   │   │   └── 🖼️ icon.png
│   │   │   └── 📁 警察/
│   │   │       └── 🖼️ icon.png
│   │   │
│   │   └── 📁 styles/                  # 样式文件
│   │       ├── 📁 base/
│   │       │   ├── 📄 animations.css
│   │       │   └── 📄 theme.css
│   │       ├── 📄 content.css
│   │       ├── 📄 popup.css
│   │       └── 📄 tailwind.css
│   │
│   ├── 📁 components/                  # 🖼️ Vue.js 组件
│   │   ├── 📁 chat/
│   │   │   ├── 📁 ChatHeader/
│   │   │   │   ├── 📄 index.html
│   │   │   │   └── 📄 index.js
│   │   │   ├── 📁 ChatInput/
│   │   │   │   ├── 📄 index.html
│   │   │   │   └── 📄 index.js
│   │   │   ├── 📁 ChatMessages/
│   │   │   │   ├── 📄 index.html
│   │   │   │   └── 📄 index.js
│   │   │   └── 📁 ChatWindow/
│   │   │       ├── 📄 index.css
│   │   │       ├── 📄 index.html
│   │   │       ├── 📄 index.js
│   │   │       └── 📁 hooks/
│   │   │           ├── 📄 store.js
│   │   │           ├── 📄 useComputed.js
│   │   │           └── 📄 useMethods.js
│   │   │
│   │   ├── 📁 editor/
│   │   │   └── 📁 SessionInfoEditor/
│   │   │       └── 📄 index.html
│   │   │
│   │   ├── 📁 manager/
│   │   │   ├── 📁 FaqManager/
│   │   │   │   ├── 📄 index.html
│   │   │   │   └── 📄 index.js
│   │   │   ├── 📁 FaqTagManager/
│   │   │   │   ├── 📄 index.html
│   │   │   │   └── 📄 index.js
│   │   │   └── 📁 SessionTagManager/
│   │   │       ├── 📄 index.html
│   │   │       └── 📄 index.js
│   │   │
│   │   └── 📁 modal/
│   │       ├── 📁 AiSettingsModal/
│   │       │   ├── 📄 index.html
│   │       │   └── 📄 index.js
│   │       └── 📁 TokenSettingsModal/
│   │           ├── 📄 index.html
│   │           └── 📄 index.js
│   │
│   └── 📁 utils/                       # 🛠️ 工具模块
│       ├── 📁 dom/
│       │   └── 📄 domHelper.js
│       ├── 📁 error/
│       │   └── 📄 errorHandler.js
│       ├── 📁 logging/
│       │   └── 📄 loggerUtils.js
│       ├── 📁 media/
│       │   └── 📄 imageResourceManager.js
│       ├── 📁 messaging/
│       │   └── 📄 messageHelper.js
│       ├── 📁 runtime/
│       │   ├── 📄 globalAccessor.js
│       │   └── 📄 moduleUtils.js
│       ├── 📁 session/
│       │   └── 📄 sessionManager.js
│       ├── 📁 storage/
│       │   └── 📄 storageUtils.js
│       ├── 📁 time/
│       │   └── 📄 timeUtils.js
│       ├── 📁 ui/
│       │   ├── 📄 loadingAnimation.js
│       │   ├── 📄 loadingAnimationMixin.js
│       │   └── 📄 notificationUtils.js
│       └── 📄 index.js
│
├── 📁 src/
│   ├── 📁 api/                         # 🔌 API 集成层
│   │   ├── 📁 core/
│   │   │   └── 📄 ApiManager.js       # API 请求管理
│   │   ├── 📁 services/
│   │   │   ├── 📄 FaqService.js       # FAQ 服务
│   │   │   └── 📄 SessionService.js   # 会话服务
│   │   └── 📁 utils/
│   │       ├── 📄 error.js
│   │       ├── 📄 logger.js
│   │       ├── 📄 request.js
│   │       └── 📄 token.js
│   │
│   ├── 📁 extension/
│   │   └── 📁 background/              # 🔙 后台服务 worker
│   │       ├── 📄 index.js             # 后台入口
│   │       ├── 📁 actions/             # 消息处理器
│   │       │   ├── 📄 extensionHandler.js
│   │       │   ├── 📄 messageForwardHandler.js
│   │       │   ├── 📄 petHandler.js
│   │       │   ├── 📄 screenshotHandler.js
│   │       │   └── 📄 tabHandler.js
│   │       ├── 📁 app/
│   │       │   └── 📄 register.js
│   │       ├── 📁 bootstrap/
│   │       │   └── 📄 imports.js
│   │       ├── 📁 integrations/
│   │       │   └── 📁 wework/
│   │       │       ├── 📄 weworkHandler.js
│   │       │       └── 📄 weworkService.js
│   │       ├── 📁 messaging/
│   │       │   └── 📄 messageRouter.js
│   │       └── 📁 services/
│   │           ├── 📄 injectionService.js
│   │           └── 📄 tabMessaging.js
│   │
│   ├── 📁 features/
│   │   ├── 📁 chat/                    # 💬 聊天功能
│   │   │   └── 📁 content/
│   │   │       └── 📄 export-chat-to-png.js
│   │   │
│   │   ├── 📁 faq/                     # ❓ FAQ 系统
│   │   │   └── 📁 content/
│   │   │       ├── 📄 faq.js
│   │   │       └── 📄 tags.js
│   │   │
│   │   ├── 📁 mermaid/                 # 📊 Mermaid 图表渲染
│   │   │   └── 📁 page/
│   │   │       ├── 📄 load-mermaid.js
│   │   │       ├── 📄 preview-mermaid.js
│   │   │       └── 📄 render-mermaid.js
│   │   │
│   │   ├── 📁 petManager/              # 🐾 核心宠物管理（内容脚本）
│   │   │   └── 📁 content/
│   │   │       ├── 📄 petManager.js        # 主入口
│   │   │       ├── 📁 core/
│   │   │       │   └── 📄 petManager.core.js
│   │   │       ├── 📁 modules/
│   │   │       │   ├── 📄 petManager.ai.js
│   │   │       │   ├── 📄 petManager.auth.js
│   │   │       │   ├── 📄 petManager.editor.js
│   │   │       │   ├── 📄 petManager.io.js
│   │   │       │   ├── 📄 petManager.mermaid.js
│   │   │       │   ├── 📄 petManager.messaging.js
│   │   │       │   ├── 📄 petManager.pageInfo.js
│   │   │       │   ├── 📄 petManager.parser.js
│   │   │       │   ├── 📄 petManager.robot.js
│   │   │       │   ├── 📄 petManager.roles.js
│   │   │       │   ├── 📄 petManager.session.js
│   │   │       │   ├── 📄 petManager.sessionEditor.js
│   │   │       │   └── 📄 petManager.tags.js
│   │   │       ├── 📄 petManager.chat.js
│   │   │       ├── 📄 petManager.chatUi.js
│   │   │       ├── 📄 petManager.drag.js
│   │   │       ├── 📄 petManager.events.js
│   │   │       ├── 📄 petManager.media.js
│   │   │       ├── 📄 petManager.message.js
│   │   │       ├── 📄 petManager.pet.js
│   │   │       ├── 📄 petManager.screenshot.js
│   │   │       ├── 📄 petManager.state.js
│   │   │       └── 📄 petManager.ui.js
│   │   │
│   │   └── 📁 session/                 # 📦 会话管理
│   │       └── 📁 page/
│   │           ├── 📄 export-sessions.js
│   │           ├── 📄 import-sessions.js
│   │           └── 📄 load-jszip.js
│   │
│   └── 📁 views/                       # 🖼️ Popup UI
│       └── 📁 popup/
│           ├── 📄 index.html
│           └── 📄 index.js
│
└── 📁 docs/                            # 📚 文档目录
    ├── 📄 structure.md                 # 项目结构说明（本文件）
    └── 📁 superpowers/
        ├── 📁 specs/                   # 设计规范文档
        │   └── 📄 2026-03-14-readme-design.md
        └── 📁 plans/                   # 实施计划文档
            └── 📄 2026-03-14-readme-implementation.md
```

## 图标说明

| 图标 | 说明 |
|------|------|
| 📄 | 文件 |
| 📁 | 目录 |
| 🖼️ | 图片资源 |
| 🎨 | 样式/设计 |
| 🔧 | 核心工具 |
| 📚 | 库/文档 |
| 🖼️ | UI 组件 |
| 🛠️ | 工具模块 |
| 🔌 | API 集成 |
| 🔙 | 后台服务 |
| 💬 | 聊天功能 |
| ❓ | FAQ 系统 |
| 📊 | 图表渲染 |
| 🐾 | 宠物管理 |
| 📦 | 会话管理 |
