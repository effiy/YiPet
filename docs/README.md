# 温柔陪伴助手

> 在浏览器中添加一位温柔体贴的伴侣，陪伴您的浏览时光

[项目概述](#-项目概述) • [技术栈](#-技术栈) • [快速开始](#-快速开始) • [配置指南](./配置指南.md) • [核心功能](./核心功能/) • [架构设计](#-架构设计) • [目录结构](#-目录结构) • [组件库](#-组件库) • [开发规范](#-开发规范)

---

## 📋 项目概述

### 项目简介

**温柔陪伴助手**是一款基于 Chrome Manifest V3 的浏览器扩展，为网页浏览提供智能虚拟伴侣服务。它解决了传统浏览器浏览体验单调、缺乏互动性的痛点，通过在网页上添加虚拟宠物形象和 AI 交互功能，提升用户的浏览体验，缓解压力，同时提供实用工具提高效率。

### 核心功能

- 🐾 **实时虚拟宠物**：在网页上显示可爱的虚拟宠物，支持拖拽和动画效果
- 💬 **AI 对话系统**：流式响应的智能对话，支持 Markdown 渲染和图表解析
- 📸 **智能截图工具**：自由选择区域的截图功能，支持一键保存
- 📦 **会话管理**：保存和管理多个对话会话，支持标签分类
- 📚 **FAQ 知识库**：存储常用问题和答案，支持快速检索和复用
- 🎭 **角色系统**：提供 4 种专业角色（教师、医生、甜品师、警察）
- 📊 **Mermaid 图表渲染**：支持 Mermaid 语法的图表渲染功能

---

## 🛠️ 技术栈

### 🔧 核心技术

- **🗼 Vanilla JavaScript** - 核心扩展逻辑（无框架，性能更优）
- **💚 Vue.js 3** - 现代化 UI 组件框架
- **🔌 Chrome Extension API (Manifest V3)** - 最新浏览器扩展 API

### 📦 第三方库

- **📝 marked** - Markdown 快速渲染
- **📊 mermaid** - 专业图表渲染
- **🔄 turndown** - HTML 转 Markdown 工具
- **🔒 md5** - 安全哈希计算

### ✨ 项目特点

- **🎯 零构建**：文件直接加载使用，无需构建工具，开箱即用
- **🏗️ 模块化架构**：功能模块化设计，易于扩展和维护
- **🌐 多环境支持**：生产/开发/测试环境灵活切换配置

---

## 🔗 API 端点

项目使用 RESTful API 进行数据通信，支持三个环境配置：

### 生产环境 (默认)
- **AI 对话**：`https://api.effiy.cn/prompt`
- **基础服务**：`https://api.effiy.cn`

### 测试环境
- **AI 对话**：`https://staging.api.effiy.cn/prompt`
- **基础服务**：`https://staging.api.effiy.cn`

### 开发环境
- **AI 对话**：`http://localhost:8000/prompt`
- **基础服务**：`http://localhost:8000`

详细的 API 文档请参考：**[API 端点文档](./docs/API端点.md)**

---

## 🚀 快速开始

### 📥 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```

2. **加载扩展到 Chrome**
   - 🖥️ 打开 Chrome 浏览器
   - 🔗 导航到 `chrome://extensions/`
   - 🔄 启用右上角的"开发者模式"开关
   - 📁 点击"加载已解压的扩展程序"按钮
   - 🎯 选择仓库目录

3. **🎮 开始使用**
   - 🌐 打开任意网页
   - 🐾 您应该能看到虚拟宠物出现在页面上
   - 💬 点击宠物或使用快捷键开始聊天

### ✅ 验证安装

- 🔍 打开浏览器控制台 (F12) 查看是否有错误
- ✨ 确认宠物图标正常显示
- 🎯 测试聊天和截图功能

---

## ⚙️ 配置指南

详细的配置说明请参考独立文档：[配置指南](./配置指南.md)

包含内容：
- 🌍 **环境配置** - 生产/开发/测试环境灵活切换
- 🔌 **API 端点配置** - 不同环境的 API 地址配置
- 💾 **Chrome 存储说明** - 数据存储和读取说明
- ⚙️ **功能配置** - AI、角色、快捷键等功能配置
- 🔧 **高级配置** - 调试模式、权限设置等高级选项
- 📝 **配置示例** - 完整的配置文件示例

---

## 🎯 核心功能

详细的功能说明请参考独立的功能文档：[核心功能文档](./核心功能/)

### 📋 功能分类

#### 🐾 基础功能
- **[虚拟宠物展示](./核心功能/虚拟宠物展示.md)** - 在网页上显示可爱的虚拟宠物，支持拖拽和动画效果
- **[AI 聊天界面](./核心功能/AI聊天界面.md)** - 流式响应的 AI 对话体验，支持 Markdown 渲染
- **[多种宠物角色](./核心功能/多种宠物角色.md)** - 多种可爱的虚拟宠物角色可选，满足不同喜好

#### 🛠️ 实用工具
- **[区域截图功能](./核心功能/区域截图功能.md)** - 自由选择截图区域，便捷快速截图
- **[键盘快捷键](./核心功能/键盘快捷键.md)** - 快捷操作，提高效率

#### 📦 数据管理
- **[会话管理](./核心功能/会话管理.md)** - 保存和管理多个对话会话，支持标签分类
- **[FAQ 系统](./核心功能/FAQ系统.md)** - 保存常用问题和答案，快速检索和复用

#### 📊 增强功能
- **[Mermaid 图表渲染](./核心功能/Mermaid图表渲染.md)** - 支持 Mermaid 语法的图表渲染

### ✨ 核心特性
- 🎯 **零构建，开箱即用** - 无需任何配置，直接使用
- 🎨 **多种可爱宠物角色** - 4种风格迥异的宠物角色
- 💬 **流式 AI 对话体验** - 实时响应，支持 Markdown 渲染
- 📸 **便捷截图功能** - 智能区域选择，一键截图
- 📦 **会话和 FAQ 管理** - 完整的数据管理功能
- 📊 **Mermaid 图表渲染** - 专业图表渲染功能

---

## 🏗️ 架构设计

### 🔄 整体架构

扩展采用经典的 Chrome 扩展三层架构，确保架构清晰、功能分离：

```
Popup (弹出界面)      🪟
    ↓↑ Chrome Runtime Messaging
Background Service Worker (后台服务) 🔄
    ↓↑ Chrome Runtime Messaging
Content Script (内容脚本) ←→ 网页 DOM 🌐
```

### 📦 核心模块

#### 🐾 PetManager (`modules/pet/content/`)
- **主入口**：`petManager.js`（轻量级组装）
- **核心实现**：`core/petManager.core.js`
- **功能模块**：`modules/petManager.*.js`（ai、auth、roles、session 等）
- **特性文件**：`petManager.*.js`（chat、drag、events、screenshot、ui、state 等）

#### 🔄 Background Script (`modules/extension/background/`)
- **服务 worker**：`index.js`
- **消息处理器**：`actions/*.js`（extension、pet、tab、screenshot 处理程序）
- **消息路由**：`messaging/messageRouter.js`

#### 🔗 API Layer (`core/api/`)
- `core/ApiManager.js` - API 请求管理
- `services/SessionService.js` - 会话 CRUD 操作
- `services/FaqService.js` - FAQ CRUD 操作
- `utils/` - 令牌管理、日志、错误处理（位于 `core/utils/api/` 下）

#### 🎨 Vue Components (`modules/pet/components/`)
- `chat/ChatWindow/` - 主聊天界面
- `modal/` - 设置弹窗（AI、token）
- `manager/` - FAQ 和会话标签管理器
- `editor/` - 会话信息编辑器

### 💬 消息流程
- Popup ↔ Background ↔ Content Script via Chrome Runtime Messaging
- Content script 使用 `window.PetManager` 作为主入口点
- Background 使用 `messageRouter.js` 路由动作到处理程序

---

## 📁 目录结构

```
├── manifest.json                    # Extension manifest
├── assets/                          # 全局资源
│   ├── styles/                      # 样式文件
│   ├── images/                      # 宠物角色图片
│   └── icons/                       # 扩展图标
├── core/                            # 核心系统模块
│   ├── config.js                    # 集中式配置
│   ├── bootstrap/                   # 启动/初始化代码
│   ├── constants/                   # 常量定义（端点等）
│   ├── api/                         # API 集成层
│   │   ├── core/                    # API 管理器
│   │   ├── services/                # API 服务（Session、FAQ）
│   │   └── utils/                   # API 工具（token、logger、error）
│   └── utils/                       # 全局工具模块
│       ├── api/                     # API 特定工具
│       ├── dom/                     # DOM 操作
│       ├── storage/                 # Chrome 存储工具
│       ├── media/                   # 媒体处理（图片、资源）
│       └── ui/                      # UI 工具（加载、通知）
├── libs/                            # 第三方库
├── modules/                         # 功能模块（按功能划分）
│   ├── pet/                         # 宠物管理模块
│   │   ├── components/              # Vue 组件（chat、modal、manager）
│   │   ├── content/                 # 核心宠物管理器逻辑
│   │   │   ├── core/                # 主宠物管理器实现
│   │   │   └── modules/             # 功能模块（ai、auth、roles 等）
│   │   └── styles/                  # 宠物特定样式
│   ├── chat/                        # 聊天功能模块
│   ├── faq/                         # FAQ 系统模块
│   ├── session/                     # 会话管理模块
│   ├── screenshot/                  # 截图功能模块
│   ├── mermaid/                     # Mermaid 图表渲染模块
│   └── extension/                   # Chrome 扩展系统
│       ├── background/              # 后台服务 worker
│       ├── content-scripts/         # 内容脚本
│       ├── popup/                   # 弹窗 UI
│       └── messaging/               # 消息路由
└── docs/                            # 文档
```

---

## 🎨 组件库

### Vue 组件 (`modules/pet/components/`)

#### 聊天组件
- **ChatWindow** - 主聊天界面
- **ChatInput** - 聊天输入框
- **ChatMessage** - 聊天消息展示

#### 弹窗组件
- **AiSettingsModal** - AI 配置弹窗
- **TokenSettingsModal** - Token 设置弹窗

#### 管理组件
- **FaqManager** - FAQ 管理器
- **SessionTagManager** - 会话标签管理器

#### 编辑组件
- **SessionInfoEditor** - 会话信息编辑器

#### 通用组件
- **LoadingSpinner** - 加载动画
- **Notification** - 通知组件

### 组件特点
- 每个组件有独立的目录结构
- 包含 `.vue` 模板、`.js` 逻辑和 `.css` 样式
- 支持组件间通信和状态管理

---

## 🛠️ 开发规范

详细的开发规范请参考独立文档：[开发规范](./docs/开发规范/)

### 规范分类

#### 🔒 安全规范
- **安全规范** - 安全编码规范和最佳实践

#### 💻 编码规范
- **编码规范** - JavaScript 代码规范和风格指南
- **代码结构** - 项目代码组织和架构规范
- **模块设计** - 模块设计和架构原则

#### 🚀 部署规范
- **部署规范** - 扩展打包和部署流程
- **版本控制** - 版本号管理和发布策略

#### 🧪 测试规范
- **测试规范** - 单元测试、集成测试和验收测试
- **测试策略** - 测试方法论和最佳实践

#### ⚠️ 错误处理规范
- **错误处理规范** - 异常处理和错误报告

#### 📝 日志规范
- **日志规范** - 日志记录和管理

#### 📚 文档规范
- **文档规范** - 文档编写和维护规范
- **API文档** - API 文档编写规范

#### 🎯 GIT 规范
- **GIT提交规范** - 提交信息规范和工作流程
- **分支管理** - 分支策略和代码合并流程
- **代码审查** - 代码审查流程和规范

---

## 🔧 常用开发任务

### 添加新宠物角色

1. 在 `petManager.roles.js` 中添加角色配置
2. 在 `assets/images/{roleName}/` 中添加角色图片资源
3. 更新 manifest `web_accessible_resources`（如需要）

### 修改 API 端点

- 编辑 `core/config.js` - 端点按环境配置
- 常量定义在 `core/constants/endpoints.js`

### 调试方法

#### Content Script 日志（内容脚本）
- 打开任意网页
- 按 F12 打开 DevTools
- 查看 Console 标签页

#### Background Script 日志（后台脚本）
- 打开 `chrome://extensions/`
- 找到"温柔陪伴助手"扩展
- 点击"Inspect views: service worker"链接

#### Popup 日志（弹出界面）
- 右键点击浏览器工具栏的扩展图标
- 选择"检查弹出内容"

---

## 🐛 故障排除

### 常见问题

#### 1. 扩展无法加载
**可能原因**：
- 未启用"开发者模式"
- `manifest.json` 有语法错误
- 目录结构不正确

**解决方案**：
- 确认在 `chrome://extensions/` 页面已启用"开发者模式"
- 使用 JSON 验证工具检查 `manifest.json`
- 确认仓库目录结构完整

#### 2. 宠物不显示
**可能原因**：
- 浏览器控制台有 JavaScript 错误
- 在不支持的网站上（如 Chrome 内部页面）
- 扩展权限问题

**解决方案**：
- 打开网页 DevTools 查看 Console 是否有错误
- 尝试在普通的 HTTPS 网站（如 https://example.com）上使用
- 检查扩展权限是否正确配置

#### 3. 聊天功能无法使用
**可能原因**：
- 网络连接问题
- 未配置有效的 API 令牌
- API 端点配置错误

**解决方案**：
- 检查网络连接是否正常
- 确认已在设置中配置了有效的 API 令牌
- 查看浏览器控制台的错误信息
- 确认 API 端点配置正确（检查 `core/config.js`）

---

## 📄 许可证

本项目采用 MIT 许可证。

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！无论是报告问题、提出建议还是提交代码，都非常感谢。

### 提交 Issue

在提交新 Issue 之前，请：
1. 首先查看 Issue 列表，确认是否有类似的 Issue 已存在
2. 使用清晰的标题描述问题
3. 提供详细的复现步骤
4. 说明预期行为和实际行为
5. 如果可能，包含截图或屏幕录像

### Pull Request 流程

1. **Fork 仓库**
2. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```
4. **推送到您的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```
5. **创建 Pull Request**
   - 从您的 Fork 分支向主仓库的 `main` 分支创建 PR
   - 详细描述您所做的更改
   - 关联相关的 Issue（如果有）

---

## 📚 项目文档

我们提供了完整的项目文档，帮助您更好地了解和使用温柔陪伴助手：

- **🎯 核心功能**：`docs/核心功能/` - 各个核心功能的详细说明
- **⚙️ 配置指南**：`docs/配置指南.md` - 详细的配置说明（环境、API、存储）
- **📁 目录结构**：`docs/目录结构.md` - 完整的项目目录结构说明
- **🏗️ 架构设计**：`docs/架构设计.md` - 详细的架构和关键模块说明
- **🎨 组件库**：`docs/组件库/` - Vue 组件库文档和使用说明
- **🔧 开发规范**：`docs/开发规范/` - 完整的开发规范集合（安全、编码、部署等）
- **🔗 API 端点**：`docs/API端点.md` - 详细的 API 接口文档
- **📝 开发指南**：`docs/development.md` - 开发流程和规范
- **📄 CHANGELOG**：`CHANGELOG.md` - 版本变更记录

---

## 📞 联系方式

- **项目仓库**：[GitHub 仓库](https://github.com/yourusername/your-repo)
- **Issue 追踪**：[提交 Issue](https://github.com/yourusername/your-repo/issues)
- **开发者**：[您的名字/团队](https://yourwebsite.com)

---

*最后更新：2026-03-18*
