# 项目结构

```
温柔陪伴助手/
├── 📄 manifest.json                    # Chrome 扩展清单文件，定义扩展的权限、脚本、图标等元信息
├── 📄 CLAUDE.md                        # Claude Code AI 工具的项目指导文档，提供开发规范和架构说明
├── 📄 README.md                        # 项目说明文档，包含功能介绍、安装指南和使用说明
│
├── 📁 cdn/
│   ├── 📁 core/                        # 🔧 核心工具和配置
│   │   ├── 📄 config.js               # 集中配置文件，包含宠物、聊天窗口、API、环境等所有配置项
│   │   ├── 📁 bootstrap/              # 引导/初始化代码
│   │   │   ├── 📄 bootstrap.js        # 扩展启动引导程序
│   │   │   └── 📄 index.js            # 引导模块入口
│   │   └── 📁 constants/              # 常量定义
│   │       └── 📄 endpoints.js        # API 端点常量定义
│   │
│   ├── 📁 libs/                        # 📚 第三方库
│   │   ├── 📄 html2canvas.min.js      # 网页截图库，用于将 DOM 元素转换为图片
│   │   ├── 📄 jszip.min.js            # ZIP 文件处理库，用于会话的导入导出
│   │   ├── 📄 marked.min.js           # Markdown 渲染库，用于渲染聊天消息
│   │   ├── 📄 md5.js                  # MD5 哈希计算库
│   │   ├── 📄 mermaid.min.js          # Mermaid 图表渲染库，用于渲染流程图、时序图等
│   │   ├── 📄 turndown.js             # HTML 转 Markdown 转换库
│   │   └── 📄 vue.global.js           # Vue.js 3 框架，用于构建 UI 组件
│   │
│   ├── 📁 assets/                      # 🎨 样式、图片、图标资源
│   │   ├── 📁 icons/                   # 扩展图标资源
│   │   │   ├── 🖼️ icon.png            # 扩展主图标
│   │   │   ├── 🖼️ icon128.png         # 128x128 像素图标
│   │   │   ├── 🖼️ icon16.png          # 16x16 像素图标
│   │   │   ├── 🖼️ icon32.png          # 32x32 像素图标
│   │   │   └── 🖼️ icon48.png          # 48x48 像素图标
│   │   │
│   │   ├── 📁 images/                  # 宠物角色图片资源
│   │   │   ├── 📁 医生/
│   │   │   │   └── 🖼️ icon.png        # 医生角色宠物图标
│   │   │   ├── 📁 教师/
│   │   │   │   ├── 🖼️ icon.png        # 教师角色宠物图标
│   │   │   │   └── 📁 run/
│   │   │   │       ├── 🖼️ 1.png       # 教师跑步动画第 1 帧
│   │   │   │       ├── 🖼️ 2.png       # 教师跑步动画第 2 帧
│   │   │   │       └── 🖼️ 3.png       # 教师跑步动画第 3 帧
│   │   │   ├── 📁 甜品师/
│   │   │   │   └── 🖼️ icon.png        # 甜品师角色宠物图标
│   │   │   └── 📁 警察/
│   │   │       └── 🖼️ icon.png        # 警察角色宠物图标
│   │   │
│   │   └── 📁 styles/                  # 样式表文件
│   │       ├── 📁 base/
│   │       │   ├── 📄 animations.css  # 基础动画样式，包含宠物浮动、眨眼等动画
│   │       │   └── 📄 theme.css       # 主题样式文件
│   │       ├── 📄 content.css         # 内容脚本样式，定义宠物和聊天窗口的基础样式
│   │       ├── 📄 popup.css           # 弹出页面样式
│   │       └── 📄 tailwind.css        # Tailwind CSS 工具类样式
│   │
│   ├── 📁 components/                  # 🖼️ Vue.js UI 组件
│   │   ├── 📁 chat/
│   │   │   ├── 📁 ChatHeader/         # 聊天窗口头部组件
│   │   │   │   ├── 📄 index.html      # 头部组件 HTML 模板
│   │   │   │   └── 📄 index.js        # 头部组件 Vue 应用逻辑
│   │   │   ├── 📁 ChatInput/          # 聊天输入框组件
│   │   │   │   ├── 📄 index.html      # 输入框组件 HTML 模板
│   │   │   │   └── 📄 index.js        # 输入框组件 Vue 应用逻辑
│   │   │   ├── 📁 ChatMessages/       # 聊天消息列表组件
│   │   │   │   ├── 📄 index.html      # 消息列表组件 HTML 模板
│   │   │   │   └── 📄 index.js        # 消息列表组件 Vue 应用逻辑
│   │   │   └── 📁 ChatWindow/         # 主聊天窗口组件
│   │   │       ├── 📄 index.css       # 聊天窗口样式
│   │   │       ├── 📄 index.html      # 聊天窗口主模板
│   │   │       ├── 📄 index.js        # 聊天窗口 Vue 应用主逻辑
│   │   │       └── 📁 hooks/          # Vue 组合式函数钩子
│   │   │           ├── 📄 store.js     # 聊天窗口状态管理
│   │   │           ├── 📄 useComputed.js  # 计算属性钩子
│   │   │           └── 📄 useMethods.js   # 方法钩子
│   │   │
│   │   ├── 📁 editor/
│   │   │   └── 📁 SessionInfoEditor/  # 会话信息编辑器组件
│   │   │       └── 📄 index.html      # 会话编辑器 HTML 模板
│   │   │
│   │   ├── 📁 manager/
│   │   │   ├── 📁 FaqManager/         # FAQ 管理器组件
│   │   │   │   ├── 📄 index.html      # FAQ 管理器 HTML 模板
│   │   │   │   └── 📄 index.js        # FAQ 管理器 Vue 应用逻辑
│   │   │   ├── 📁 FaqTagManager/      # FAQ 标签管理器组件
│   │   │   │   ├── 📄 index.html      # FAQ 标签管理器 HTML 模板
│   │   │   │   └── 📄 index.js        # FAQ 标签管理器 Vue 应用逻辑
│   │   │   └── 📁 SessionTagManager/  # 会话标签管理器组件
│   │   │       ├── 📄 index.html      # 会话标签管理器 HTML 模板
│   │   │       └── 📄 index.js        # 会话标签管理器 Vue 应用逻辑
│   │   │
│   │   └── 📁 modal/
│   │       ├── 📁 AiSettingsModal/    # AI 设置弹窗组件
│   │       │   ├── 📄 index.html      # AI 设置弹窗 HTML 模板
│   │       │   └── 📄 index.js        # AI 设置弹窗 Vue 应用逻辑
│   │       └── 📁 TokenSettingsModal/ # API 令牌设置弹窗组件
│   │           ├── 📄 index.html      # 令牌设置弹窗 HTML 模板
│   │           └── 📄 index.js        # 令牌设置弹窗 Vue 应用逻辑
│   │
│   └── 📁 utils/                       # 🛠️ 工具函数模块
│       ├── 📁 dom/
│       │   └── 📄 domHelper.js        # DOM 操作辅助工具
│       ├── 📁 error/
│       │   └── 📄 errorHandler.js     # 错误处理工具
│       ├── 📁 logging/
│       │   └── 📄 loggerUtils.js      # 日志记录工具
│       ├── 📁 media/
│       │   └── 📄 imageResourceManager.js  # 图片资源管理器
│       ├── 📁 messaging/
│       │   └── 📄 messageHelper.js    # 消息传递辅助工具
│       ├── 📁 runtime/
│       │   ├── 📄 globalAccessor.js   # 全局对象访问器
│       │   └── 📄 moduleUtils.js      # 模块工具函数
│       ├── 📁 session/
│       │   └── 📄 sessionManager.js   # 会话管理器
│       ├── 📁 storage/
│       │   └── 📄 storageUtils.js     # 存储工具函数
│       ├── 📁 time/
│       │   └── 📄 timeUtils.js        # 时间工具函数
│       ├── 📁 ui/
│       │   ├── 📄 loadingAnimation.js # 加载动画组件
│       │   ├── 📄 loadingAnimationMixin.js  # 加载动画混入
│       │   └── 📄 notificationUtils.js  # 通知工具函数
│       └── 📄 index.js                # 工具模块入口
│
├── 📁 src/
│   ├── 📁 api/                         # 🔌 API 集成层
│   │   ├── 📁 core/
│   │   │   └── 📄 ApiManager.js       # API 请求管理器，提供统一的请求处理、错误处理、重试机制
│   │   ├── 📁 services/
│   │   │   ├── 📄 FaqService.js       # FAQ 数据服务，处理 FAQ 的 CRUD 操作
│   │   │   └── 📄 SessionService.js   # 会话数据服务，处理会话的 CRUD 操作
│   │   └── 📁 utils/
│   │       ├── 📄 error.js            # API 错误处理工具
│   │       ├── 📄 logger.js           # API 日志记录工具
│   │       ├── 📄 request.js          # API 请求封装工具
│   │       └── 📄 token.js            # API 令牌管理工具
│   │
│   ├── 📁 extension/
│   │   └── 📁 background/              # 🔙 后台服务 Worker
│   │       ├── 📄 index.js             # 后台入口文件，处理扩展安装、更新和生命周期管理
│   │       ├── 📁 actions/             # 消息处理器
│   │       │   ├── 📄 extensionHandler.js  # 扩展操作消息处理器
│   │       │   ├── 📄 messageForwardHandler.js  # 消息转发处理器
│   │       │   ├── 📄 petHandler.js    # 宠物相关消息处理器
│   │       │   ├── 📄 screenshotHandler.js  # 截图功能消息处理器
│   │       │   └── 📄 tabHandler.js    # 标签页操作消息处理器
│   │       ├── 📁 app/
│   │       │   └── 📄 register.js      # 应用注册和初始化
│   │       ├── 📁 bootstrap/
│   │       │   └── 📄 imports.js       # 后台脚本导入声明
│   │       ├── 📁 integrations/
│   │       │   └── 📁 wework/          # 企业微信集成
│   │       │       ├── 📄 weworkHandler.js  # 企业微信消息处理器
│   │       │       └── 📄 weworkService.js  # 企业微信服务
│   │       ├── 📁 messaging/
│   │       │   └── 📄 messageRouter.js  # 消息路由器，分发消息到对应的处理器
│   │       └── 📁 services/
│   │           ├── 📄 injectionService.js  # 脚本注入服务
│   │           └── 📄 tabMessaging.js  # 标签页消息传递服务
│   │
│   ├── 📁 features/
│   │   ├── 📁 chat/                    # 💬 聊天功能模块
│   │   │   └── 📁 content/
│   │   │       └── 📄 export-chat-to-png.js  # 聊天记录导出为图片功能
│   │   │
│   │   ├── 📁 faq/                     # ❓ FAQ 系统模块
│   │   │   └── 📁 content/
│   │   │       ├── 📄 faq.js           # FAQ 管理主逻辑
│   │   │       └── 📄 tags.js          # FAQ 标签管理
│   │   │
│   │   ├── 📁 mermaid/                 # 📊 Mermaid 图表渲染模块
│   │   │   └── 📁 page/
│   │   │       ├── 📄 load-mermaid.js  # Mermaid 库加载器
│   │   │       ├── 📄 preview-mermaid.js  # Mermaid 图表预览
│   │   │       └── 📄 render-mermaid.js  # Mermaid 图表渲染
│   │   │
│   │   ├── 📁 petManager/              # 🐾 核心宠物管理（内容脚本）
│   │   │   └── 📁 content/
│   │   │       ├── 📄 petManager.js        # 轻量入口/装配文件，组装各个功能模块
│   │   │       ├── 📁 core/
│   │   │       │   └── 📄 petManager.core.js  # PetManager 核心实现，包含主类定义
│   │   │       ├── 📁 modules/
│   │   │       │   ├── 📄 petManager.ai.js      # AI 对话功能模块
│   │   │       │   ├── 📄 petManager.auth.js    # 认证和令牌管理模块
│   │   │       │   ├── 📄 petManager.editor.js  # 会话编辑器模块
│   │   │       │   ├── 📄 petManager.io.js      # 会话导入导出模块
│   │   │       │   ├── 📄 petManager.mermaid.js # Mermaid 图表处理模块
│   │   │       │   ├── 📄 petManager.messaging.js  # 消息传递模块
│   │   │       │   ├── 📄 petManager.pageInfo.js  # 页面信息收集模块
│   │   │       │   ├── 📄 petManager.parser.js  # 消息解析模块
│   │   │       │   ├── 📄 petManager.robot.js   # 机器人动作模块
│   │   │       │   ├── 📄 petManager.roles.js   # 宠物角色配置模块
│   │   │       │   ├── 📄 petManager.session.js # 会话管理模块
│   │   │       │   ├── 📄 petManager.sessionEditor.js  # 会话编辑模块
│   │   │       │   └── 📄 petManager.tags.js    # 标签管理模块
│   │   │       ├── 📄 petManager.chat.js    # 聊天窗口管理
│   │   │       ├── 📄 petManager.chatUi.js  # 聊天 UI 交互
│   │   │       ├── 📄 petManager.drag.js    # 宠物拖拽功能
│   │   │       ├── 📄 petManager.events.js  # 事件处理
│   │   │       ├── 📄 petManager.media.js   # 媒体处理（图片等）
│   │   │       ├── 📄 petManager.message.js # 消息处理
│   │   │       ├── 📄 petManager.pet.js     # 宠物显示和动画
│   │   │       ├── 📄 petManager.screenshot.js  # 截图功能
│   │   │       ├── 📄 petManager.state.js   # 状态管理
│   │   │       └── 📄 petManager.ui.js      # UI 组件管理
│   │   │
│   │   └── 📁 session/                 # 📦 会话管理模块
│   │       └── 📁 page/
│   │           ├── 📄 export-sessions.js  # 会话导出功能
│   │           ├── 📄 import-sessions.js  # 会话导入功能
│   │           └── 📄 load-jszip.js      # JSZip 库加载器
│   │
│   └── 📁 views/                       # 🖼️ 弹出页面视图
│       └── 📁 popup/
│           ├── 📄 index.html           # 弹出页面 HTML
│           └── 📄 index.js             # 弹出页面逻辑
│
└── 📁 docs/                            # 📚 文档目录
    ├── 📄 structure.md                 # 项目结构说明（本文件）
    └── 📁 superpowers/
        ├── 📁 specs/                   # 设计规范文档
        │   └── 📄 2026-03-14-readme-design.md  # README 设计文档
        └── 📁 plans/                   # 实施计划文档
            └── 📄 2026-03-14-readme-implementation.md  # README 实施计划
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

## 架构说明

### 三层架构

本扩展采用经典的 Chrome 扩展三层架构：

1. **Popup (弹出界面)** - 用户点击扩展图标时显示的界面
2. **Background Service Worker** - 后台持续运行的服务，处理消息路由、标签管理等
3. **Content Script** - 注入到网页中的脚本，负责显示宠物和聊天窗口

### 消息流

```
Popup ←→ Background ←→ Content Script
         ↓↑
       API Server
```

### 核心模块依赖关系

- **PetManager** 是核心模块，聚合了所有宠物相关功能
- **ApiManager** 提供统一的 API 请求管理
- **Vue Components** 负责 UI 渲染，通过消息与 PetManager 通信
- **Background Script** 负责扩展生命周期和系统级功能
