# 项目结构

本文档说明 YiPet 温柔陪伴助手的完整目录结构。

---

## 目录结构

```
温柔陪伴助手/
├── manifest.json                          # 📋 Chrome 扩展清单文件，定义扩展的权限、脚本、图标等元信息
├── CLAUDE.md                              # 🤖 Claude Code AI 工具的项目指导文档
├── README.md                              # 📖 项目说明文档，包含功能介绍、安装指南和使用说明
│
├── assets/                                # 🎨 样式、图片、图标资源
│   ├── icons/                             # 🔷 扩展图标资源
│   │   ├── icon.png                       # 🖼️ 扩展主图标
│   │   ├── icon128.png                    # 🖼️ 128x128 像素图标
│   │   ├── icon16.png                     # 🖼️ 16x16 像素图标
│   │   ├── icon32.png                     # 🖼️ 32x32 像素图标
│   │   └── icon48.png                     # 🖼️ 48x48 像素图标
│   │
│   ├── images/                            # 🐾 宠物角色图片资源
│   │   ├── 医生/                          # 👨‍⚕️ 医生角色
│   │   │   └── icon.png                   # 🖼️ 医生角色宠物图标
│   │   ├── 教师/                          # 👨‍🏫 教师角色
│   │   │   ├── icon.png                   # 🖼️ 教师角色宠物图标
│   │   │   └── run/                       # 🏃 跑步动画
│   │   │       ├── 1.png                  # 🖼️ 教师跑步动画第 1 帧
│   │   │       ├── 2.png                  # 🖼️ 教师跑步动画第 2 帧
│   │   │       └── 3.png                  # 🖼️ 教师跑步动画第 3 帧
│   │   ├── 甜品师/                        # 👨‍🍳 甜品师角色
│   │   │   └── icon.png                   # 🖼️ 甜品师角色宠物图标
│   │   └── 警察/                          # 👮 警察角色
│   │       └── icon.png                   # 🖼️ 警察角色宠物图标
│   │
│   └── styles/                            # 🎭 样式表文件
│       ├── base/                          # 🏗️ 基础样式
│       │   ├── animations.css             # ✨ 基础动画样式，包含宠物浮动、眨眼等动画
│       │   └── theme.css                  # 🎨 主题样式文件
│       ├── content.css                    # 🎨 内容脚本样式，定义宠物和聊天窗口的基础样式
│       ├── popup.css                      # 🎨 弹出页面样式
│       └── tailwind.css                   # 🎨 Tailwind CSS 工具类样式
│
├── core/                                  # 🔧 核心系统模块
│   ├── config.js                          # ⚙️ 集中配置文件，包含宠物、聊天窗口、API、环境等所有配置项
│   ├── bootstrap/                         # 🚀 引导/初始化代码
│   │   ├── bootstrap.js                   # 🚀 扩展启动引导程序
│   │   └── index.js                       # 🚪 引导模块入口
│   └── constants/                         # 📌 常量定义
│       └── endpoints.js                   # 🔗 API 端点常量定义
│
├── libs/                                  # 📚 第三方库
│   ├── marked.min.js                      # 📝 Markdown 渲染库，用于渲染聊天消息
│   ├── md5.js                             # 🔒 MD5 哈希计算库
│   ├── mermaid.min.js                     # 📊 Mermaid 图表渲染库
│   ├── turndown.js                        # 🔄 HTML 转 Markdown 转换库
│   └── vue.global.js                      # 💚 Vue.js 3 框架，用于构建 UI 组件
│
├── modules/                               # 🔧 功能模块（按功能组织）
│   ├── pet/                               # 🐾 宠物管理模块
│   │   ├── components/                    # 🖼️ Vue.js UI 组件
│   │   │   ├── chat/                      # 💬 聊天相关组件
│   │   │   │   ├── ChatHeader/            # 💬 聊天窗口头部组件
│   │   │   │   │   ├── index.html         # 📄 头部组件 HTML 模板
│   │   │   │   │   └── index.js           # 🧠 头部组件 Vue 应用逻辑
│   │   │   │   ├── ChatInput/             # ⌨️ 聊天输入框组件
│   │   │   │   │   ├── index.html         # 📄 输入框组件 HTML 模板
│   │   │   │   │   └── index.js           # 🧠 输入框组件 Vue 应用逻辑
│   │   │   │   ├── ChatMessages/          # 📨 聊天消息列表组件
│   │   │   │   │   ├── index.html         # 📄 消息列表组件 HTML 模板
│   │   │   │   │   └── index.js           # 🧠 消息列表组件 Vue 应用逻辑
│   │   │   │   └── ChatWindow/            # 🪟 主聊天窗口组件
│   │   │   │       ├── index.css          # 🎨 聊天窗口样式
│   │   │   │       ├── index.html         # 📄 聊天窗口主模板
│   │   │   │       ├── index.js           # 🧠 聊天窗口 Vue 应用主逻辑
│   │   │   │       └── hooks/             # 🎣 Vue 组合式函数钩子
│   │   │   │           ├── store.js        # 🗄️ 聊天窗口状态管理
│   │   │   │           ├── useComputed.js  # 🧮 计算属性钩子
│   │   │   │           └── useMethods.js   # ⚡ 方法钩子
│   │   │   │
│   │   │   ├── editor/                    # ✏️ 编辑器组件
│   │   │   │   └── SessionInfoEditor/     # ✏️ 会话信息编辑器组件
│   │   │   │       └── index.html         # 📄 会话编辑器 HTML 模板
│   │   │   │
│   │   │   ├── manager/                   # 📋 管理器组件
│   │   │   │   ├── FaqManager/            # ❓ FAQ 管理器组件
│   │   │   │   │   ├── index.html         # 📄 FAQ 管理器 HTML 模板
│   │   │   │   │   └── index.js           # 🧠 FAQ 管理器 Vue 应用逻辑
│   │   │   │   ├── FaqTagManager/         # 🏷️ FAQ 标签管理器组件
│   │   │   │   │   ├── index.html         # 📄 FAQ 标签管理器 HTML 模板
│   │   │   │   │   └── index.js           # 🧠 FAQ 标签管理器 Vue 应用逻辑
│   │   │   │   └── SessionTagManager/     # 🏷️ 会话标签管理器组件
│   │   │   │       ├── index.html         # 📄 会话标签管理器 HTML 模板
│   │   │   │       └── index.js           # 🧠 会话标签管理器 Vue 应用逻辑
│   │   │   │
│   │   │   └── modal/                     # 🪟 弹窗组件
│   │   │       ├── AiSettingsModal/        # ⚙️ AI 设置弹窗组件
│   │   │       │   ├── index.html         # 📄 AI 设置弹窗 HTML 模板
│   │   │       │   └── index.js           # 🧠 AI 设置弹窗 Vue 应用逻辑
│   │   │       └── TokenSettingsModal/     # 🔑 API 令牌设置弹窗组件
│   │   │           ├── index.html         # 📄 令牌设置弹窗 HTML 模板
│   │   │           └── index.js           # 🧠 令牌设置弹窗 Vue 应用逻辑
│   │   │
│   │   ├── content/                       # 🐾 核心宠物管理逻辑
│   │   │   ├── core/                      # 🔧 核心实现
│   │   │   │   └── petManager.core.js     # 🧠 PetManager 核心实现，包含主类定义
│   │   │   ├── modules/                   # 📦 功能模块
│   │   │   │   ├── petManager.ai.js       # 🤖 AI 对话功能模块
│   │   │   │   ├── petManager.auth.js     # 🔐 认证和令牌管理模块
│   │   │   │   ├── petManager.editor.js   # ✏️ 会话编辑器模块
│   │   │   │   ├── petManager.io.js       # (已弃用) 会话导入导出模块
│   │   │   │   ├── petManager.mermaid.js  # 📊 Mermaid 图表处理模块
│   │   │   │   ├── petManager.messaging.js # 💬 消息传递模块
│   │   │   │   ├── petManager.pageInfo.js # 📄 页面信息收集模块
│   │   │   │   ├── petManager.parser.js   # 🔍 消息解析模块
│   │   │   │   ├── petManager.robot.js    # 🤖 机器人动作模块
│   │   │   │   ├── petManager.roles.js    # 🎭 宠物角色配置模块
│   │   │   │   ├── petManager.session.js  # 📦 会话管理模块
│   │   │   │   ├── petManager.sessionEditor.js # ✏️ 会话编辑模块
│   │   │   │   └── petManager.tags.js     # 🏷️ 标签管理模块
│   │   │   ├── petManager.chat.js         # 💬 聊天窗口管理
│   │   │   ├── petManager.chatUi.js       # 🎨 聊天 UI 交互
│   │   │   ├── petManager.drag.js         # ✋ 宠物拖拽功能
│   │   │   ├── petManager.events.js       # 🎉 事件处理
│   │   │   ├── petManager.media.js        # 🎬 媒体处理（图片等）
│   │   │   ├── petManager.message.js      # 💬 消息处理
│   │   │   ├── petManager.pet.js          # 🐾 宠物显示和动画
│   │   │   ├── petManager.screenshot.js   # 🖼️ 截图功能
│   │   │   ├── petManager.state.js        # 🗄️ 状态管理
│   │   │   ├── petManager.ui.js           # 🖼️ UI 组件管理
│   │   │   └── petManager.js              # 🚪 轻量入口/装配文件，组装各个功能模块
│   │   │
│   │   └── styles/                        # 🎨 宠物相关样式
│   │
│   ├── chat/                              # 💬 聊天功能模块
│   │   └── content/                        # 💬 聊天内容脚本
│   │       └── (已移除 export-chat-to-png.js)
│   │
│   ├── faq/                               # ❓ FAQ 系统模块
│   │   └── content/                        # ❓ FAQ 内容脚本
│   │       ├── faq.js                     # 🛠️ FAQ 管理主逻辑
│   │       └── tags.js                    # 🏷️ FAQ 标签管理
│   │
│   ├── session/                           # 📦 会话管理模块
│   │
│   ├── screenshot/                        # 📸 截图功能模块
│   │   └── content/                        # 📸 截图内容脚本
│   │       └── petManager.screenshot.js   # 🖼️ 截图功能实现
│   │
│   ├── mermaid/                           # 📊 Mermaid 图表渲染模块
│   │   └── page/                           # 📊 Mermaid 页面脚本
│   │       ├── load-mermaid.js            # 📥 Mermaid 库加载器
│   │       ├── preview-mermaid.js         # 👁️ Mermaid 图表预览
│   │       └── render-mermaid.js         # 🎨 Mermaid 图表渲染
│   │
│   └── extension/                         # 🔌 Chrome 扩展系统
│       ├── background/                     # 🔙 后台服务 Worker
│       │   ├── index.js                   # 🚪 后台入口文件，处理扩展安装、更新和生命周期管理
│       │   ├── actions/                   # 📨 消息处理器
│       │   │   ├── extensionHandler.js    # 🛠️ 扩展操作消息处理器
│       │   │   ├── messageForwardHandler.js # 🔄 消息转发处理器
│       │   │   ├── petHandler.js         # 🐾 宠物相关消息处理器
│       │   │   ├── screenshotHandler.js  # 🖼️ 截图功能消息处理器
│       │   │   └── tabHandler.js         # 📑 标签页操作消息处理器
│       │   ├── messaging/                 # 💬 消息传递
│       │   │   └── messageRouter.js      # 🛠️ 消息路由器，分发消息到对应的处理器
│       │   └── services/                  # 📋 后台服务
│       │       ├── injectionService.js    # 🛠️ 脚本注入服务
│       │       └── tabMessaging.js        # 💬 标签页消息传递服务
│       │
│       ├── content-scripts/               # 📄 内容脚本（由 manifest.json 配置）
│       ├── popup/                         # 🪟 弹出页面
│       │   ├── index.html                 # 📄 弹出页面 HTML
│       │   └── index.js                   # 🧠 弹出页面逻辑
│       │
│       └── messaging/                     # 💬 消息路由（原位置已移至 background/messaging/）
│
└── docs/                                  # 📚 文档目录
    ├── structure.md                       # 📁 本文件 - 项目结构说明
    ├── needs/                             # 📋 需求文档
    │   └── remove-export-chat-to-image.md # 📋 移除导出聊天记录为图片功能的需求文档
    ├── plans/                             # 📝 实施计划文档
    │   └── remove-export-chat-to-image.md # 📝 移除导出聊天记录为图片功能的实施计划
    ├── specs/                             # 📋 功能设计文档
    │   └── remove-export-chat-to-image.md # 📋 移除导出聊天记录为图片功能的功能设计
    ├── tests/                             # 🧪 测试报告文档
    │   └── remove-export-chat-to-image.md # 🧪 移除导出聊天记录为图片功能的验证与测试报告
    └── superpowers/                       # 🦸 Superpowers 相关文档（旧版，保留历史记录）
        ├── specs/                         # 📋 设计规范文档（已弃用）
        └── plans/                         # 📝 实施计划文档（已弃用）
```

---

## 关键模块说明

### PetManager 核心模块

**位置**：`modules/pet/content/`

PetManager 是整个应用的核心管理类，采用模块化设计：

- **主入口**：`petManager.js` - 轻量级装配器，负责组装各个功能模块
- **核心实现**：`core/petManager.core.js` - 主类定义和核心逻辑
- **功能模块**：`modules/petManager.*.js` - 按功能拆分的独立模块（AI、认证、角色、会话等）
- **功能文件**：`petManager.*.js` - 特定功能的实现文件（聊天、拖拽、事件、截图等）

### Background 后台模块

**位置**：`modules/extension/background/`

后台服务 worker 负责处理扩展生命周期、消息路由和权限管理：

- **入口**：`index.js` - 处理扩展安装、更新和生命周期
- **消息处理器**：`actions/*.js` - 处理不同类型的消息
- **消息路由器**：`messaging/messageRouter.js` - 将消息分发到对应的处理器

### API 层

**位置**：`core/api/`

API 层提供与后端服务的通信：

- `core/ApiManager.js` - API 请求统一管理
- `services/SessionService.js` - 会话 CRUD 操作
- `services/FaqService.js` - FAQ CRUD 操作
- `utils/` - 令牌管理、日志记录、错误处理

### Vue 组件

**位置**：`modules/pet/components/`

所有 UI 组件使用 Vue 3 构建：

- `chat/ChatWindow/` - 主聊天界面组件
- `modal/` - 设置弹窗（AI、令牌）
- `manager/` - FAQ 和会话标签管理器
- `editor/` - 会话信息编辑器

### 消息流

1. **Popup ↔ Background** - 弹出界面通过 Chrome Runtime Messaging 与后台通信
2. **Background ↔ Content Script** - 后台将消息转发到内容脚本
3. **Content Script 使用** - 内容脚本使用 `window.PetManager` 作为主要入口点

### 存储

使用 Chrome `storage.local` 存储数据：

- `petGlobalState` - 宠物可见性、位置、大小、颜色
- `petChatWindowState` - 聊天窗口位置和大小
- `petSettings` - 用户设置（API 令牌、AI 配置）
- `petDevMode` - 开发模式标志
