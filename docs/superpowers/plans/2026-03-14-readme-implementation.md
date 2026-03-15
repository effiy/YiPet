# README 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 "温柔陪伴助手" Chrome 扩展创建一个完整的 README.md 文件

**Architecture:** 基于设计文档创建单一的 README.md 文件，包含用户指南和开发者文档

**Tech Stack:** Markdown

---

## Chunk 1: 创建 README 基础结构

### Task 1: 创建 README.md 文件头部

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 README.md 文件并添加头部**

```markdown
# 温柔陪伴助手 (Gentle Companionship Assistant)

> 在浏览器中添加一位温柔体贴的伴侣，陪伴您的浏览时光

[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![Version](https://img.shields.io/badge/version-1.1.1-green)](manifest.json)

[English Overview](#english-overview) • [快速开始](#-快速开始) • [功能特性](#-功能特性) • [开发指南](#-开发指南)

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add README.md header and badges"
```

---

### Task 2: 添加 English Overview 英文摘要

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在头部后添加 English Overview 部分**

```markdown
## English Overview

**Gentle Companionship Assistant** is a Chrome browser extension (Manifest V3) that adds interactive AI-powered virtual pets to your web pages, making your browsing experience more enjoyable and productive.

### Key Features:
- 🐾 Virtual pet display with drag-and-drop support
- 💬 AI chat interface with streaming responses
- 📸 Region screenshot capabilities
- 📦 Session management with import/export (ZIP format)
- ❓ FAQ system with tagging
- 📊 Mermaid diagram rendering
- 🎭 Multiple pet roles (Teacher, Doctor, Pastry Chef, Police Officer)
- ⌨️ Keyboard shortcuts

### Quick Install:
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select this repository directory

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add English Overview section"
```

---

### Task 3: 添加项目简介

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 English Overview 后添加项目简介部分**

```markdown
## 项目简介

温柔陪伴助手是一个基于 Chrome Manifest V3 的浏览器扩展，旨在为您的网页浏览体验增添趣味和互动性。

### 设计理念

我们相信技术应该更加人性化。通过在网页上添加可爱的虚拟宠物角色，我们希望：
- 减轻长时间浏览网页的疲劳感
- 提供便捷的 AI 对话助手
- 让工作和学习变得更加有趣

### 目标用户

- 需要长时间使用浏览器的办公人员
- 希望有 AI 助手陪伴的学习者
- 喜欢可爱宠物元素的用户
- 需要截图、会话管理等实用功能的开发者

### 核心价值

- **陪伴感**：可爱的宠物角色在浏览器中陪伴您
- **实用性**：集成 AI 对话、截图、会话管理等实用功能
- **可定制**：多种宠物角色可选，满足不同喜好
- **零门槛**：无需构建，直接加载即可使用

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add project introduction section"
```

---

## Chunk 2: 添加功能和使用说明

### Task 4: 添加功能特性部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 ✨ 功能特性部分**

```markdown
## ✨ 功能特性

### 🐾 虚拟宠物展示
- 在网页上显示可爱的虚拟宠物
- 支持拖拽移动到任意位置
- 多种动画效果让宠物更加生动

### 💬 AI 聊天界面
- 流式响应的 AI 对话体验
- Markdown 渲染支持
- 代码高亮显示
- 支持导出聊天记录为图片

### 📸 区域截图功能
- 自由选择截图区域
- 快捷方便的截图体验
- 与聊天功能集成

### 📦 会话管理
- 保存和管理多个对话会话
- 支持导出会话为 ZIP 格式
- 支持从 ZIP 文件导入会话
- 会话标签管理系统

### ❓ FAQ 系统
- 保存常用问题和答案
- 支持标签分类
- 快速检索和复用

### 📊 Mermaid 图表渲染
- 支持 Mermaid 语法的图表渲染
- 流程图、时序图、甘特图等
- 图表预览功能

### 🎭 多种宠物角色
- **教师**：知识渊博的学习伙伴
- **医生**：关心健康的医疗顾问
- **甜品师**：甜蜜温馨的生活伴侣
- **警察**：正直可靠的安全卫士

### ⌨️ 键盘快捷键
- `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`) - 切换宠物显示/隐藏
- `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`) - 打开/关闭聊天窗口

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add features section"
```

---

### Task 5: 添加快速开始部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 🚀 快速开始部分**

```markdown
## 🚀 快速开始

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```

2. **加载扩展到 Chrome**
   - 打开 Chrome 浏览器
   - 导航到 `chrome://extensions/`
   - 启用右上角的"开发者模式"开关
   - 点击"加载已解压的扩展程序"按钮
   - 选择仓库目录

3. **开始使用**
   - 打开任意网页
   - 您应该能看到虚拟宠物出现在页面上
   - 点击宠物或使用快捷键开始聊天

### 环境配置

扩展支持多环境配置：

- **生产环境**（默认）：`https://api.effiy.cn`
- **开发环境**：`http://localhost:8000`

如需切换到开发环境，在加载配置前设置：
```javascript
window.__PET_ENV_MODE__ = 'development';
```

配置文件位于 `cdn/core/config.js`。

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add quick start section"
```

---

### Task 6: 添加使用说明部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 📖 使用说明部分**

```markdown
## 📖 使用说明

### 基本操作

#### 显示/隐藏宠物
- 点击浏览器工具栏的扩展图标，在弹出面板中切换显示状态
- 或使用快捷键 `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`)

#### 移动宠物位置
- 点击并拖曳宠物到页面任意位置
- 松开鼠标完成移动

#### 打开聊天窗口
- 双击宠物图标
- 或使用快捷键 `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`)

#### 截图功能
- 在聊天窗口中点击截图按钮
- 在页面上拖动选择截图区域
- 松开鼠标完成截图，截图会自动插入到聊天输入框

### 键盘快捷键

| 功能 | Windows/Linux | Mac |
|------|--------------|-----|
| 切换宠物显示/隐藏 | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| 打开/关闭聊天窗口 | `Ctrl+Shift+X` | `Cmd+Shift+X` |

### 常见问题

**Q: 宠物为什么没有显示在某些网站上？**

A: 某些网站（如 Chrome 内部页面、新标签页）出于安全考虑不允许内容脚本运行。请尝试在普通的 HTTP/HTTPS 网站上使用。

**Q: 如何更换宠物角色？**

A: 在聊天窗口的设置中可以切换不同的宠物角色（教师、医生、甜品师、警察）。

**Q: 会话数据保存在哪里？**

A: 所有数据都保存在浏览器的本地存储中，不会上传到任何服务器。您可以使用导出功能备份数据。

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add usage instructions section"
```

---

## Chunk 3: 添加技术文档

### Task 7: 添加技术架构部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 🔧 技术架构部分**

```markdown
## 🔧 技术架构

### 技术栈

- **Vanilla JavaScript** - 核心扩展逻辑（无框架）
- **Vue.js 3** - UI 组件框架
- **Chrome Extension API (Manifest V3)** - 浏览器扩展 API
- **第三方库：**
  - `marked` - Markdown 渲染
  - `html2canvas` - 页面截图
  - `JSZip` - ZIP 文件处理
  - `mermaid` - 图表渲染
  - `turndown` - HTML 转 Markdown
  - `md5` - 哈希计算

### 架构概览

扩展采用经典的 Chrome 扩展三层架构：

```
Popup (弹出界面)
    ↓↑ Chrome Runtime Messaging
Background Service Worker (后台服务)
    ↓↑ Chrome Runtime Messaging
Content Script (内容脚本) ←→ 网页 DOM
```

#### 核心模块

**PetManager** (`src/features/petManager/content/`)
- 核心宠物管理模块
- 主入口：`petManager.js`
- 核心实现：`core/petManager.core.js`
- 功能模块：`modules/petManager.*.js`（ai、auth、roles、session 等）

**Background Script** (`src/extension/background/`)
- 后台服务 worker
- 主入口：`index.js`
- 消息处理器：`actions/*.js`
- 消息路由：`messaging/messageRouter.js`

**API Layer** (`src/api/`)
- API 请求管理层
- `core/ApiManager.js` - 请求管理
- `services/SessionService.js` - 会话服务
- `services/FaqService.js` - FAQ 服务

**Vue Components** (`cdn/components/`)
- `chat/ChatWindow/` - 主聊天界面
- `modal/` - 设置弹窗
- `manager/` - 标签和 FAQ 管理器
- `editor/` - 会话信息编辑器

#### 消息流

1. **Popup → Background**：弹出界面向后台发送消息
2. **Background → Content Script**：后台转发消息到内容脚本
3. **Content Script → Background**：内容脚本响应或主动发送消息
4. **Background → Popup**：后台返回结果到弹出界面

内容脚本使用 `window.PetManager` 作为主要入口点。

#### 存储

使用 Chrome `storage.local` 存储数据：

| 键名 | 说明 |
|------|------|
| `petGlobalState` | 宠物可见性、位置、大小、颜色 |
| `petChatWindowState` | 聊天窗口位置和大小 |
| `petSettings` | 用户设置（API 令牌、AI 配置） |
| `petDevMode` | 开发模式标志 |

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add technical architecture section"
```

---

### Task 8: 添加开发指南部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 🛠️ 开发指南部分**

```markdown
## 🛠️ 开发指南

### 开发环境设置

这是一个**零构建**的扩展项目 - 所有文件可以直接加载到 Chrome 中使用，无需构建步骤。

#### 调试方法

**Content Script 日志（内容脚本）**
- 打开任意网页
- 按 F12 打开 DevTools
- 查看 Console 标签页

**Background Script 日志（后台脚本）**
- 打开 `chrome://extensions/`
- 找到"温柔陪伴助手"扩展
- 点击"Inspect views: service worker"链接

**Popup 日志（弹出界面）**
- 右键点击浏览器工具栏的扩展图标
- 选择"检查弹出内容"

### 常见开发任务

#### 添加新宠物角色

1. 在 `src/features/petManager/content/modules/petManager.roles.js` 中添加角色配置
2. 在 `cdn/assets/images/{roleName}/` 中添加角色图片资源
3. 如需要，更新 `manifest.json` 中的 `web_accessible_resources`

#### 修改 API 端点

- 编辑 `cdn/core/config.js` - 端点按环境配置
- 常量也定义在 `cdn/core/constants/endpoints.js`

#### 工作与 Vue 组件

- 组件通过 `web_accessible_resources` 加载为 HTML 模板
- Vue 3 从 `cdn/libs/vue.global.js` 全局加载
- 组件 JS 文件使用 `Vue.createApp()` 定义 Vue 应用

### 代码规范

#### 文件组织规范
- 功能相关的文件放在同一目录下
- 使用清晰的文件名前缀标识功能模块
- 工具函数放在 `cdn/utils/` 目录下

#### 模块命名约定
- 核心模块：`petManager.*.js`
- 功能子模块：`modules/petManager.*.js`
- Vue 组件：按功能目录组织

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add development guide section"
```

---

## Chunk 4: 添加项目结构和贡献指南

### Task 9: 添加项目结构部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 📁 项目结构部分**

```markdown
## 📁 项目结构

```
温柔陪伴助手/
├── manifest.json                    # 扩展清单文件
├── CLAUDE.md                        # Claude Code 指导文档
├── README.md                        # 项目说明文档（本文件）
├── cdn/
│   ├── core/                        # 核心工具和配置
│   │   ├── config.js               # 集中配置
│   │   ├── bootstrap/              # 引导/初始化代码
│   │   └── constants/              # 常量（端点等）
│   ├── libs/                        # 第三方库
│   ├── assets/                      # 样式、图片、图标
│   ├── components/                  # Vue.js 组件
│   └── utils/                       # 工具模块
├── src/
│   ├── extension/
│   │   └── background/              # 后台服务 worker
│   │       ├── index.js             # 后台入口
│   │       ├── actions/             # 消息处理器
│   │       └── messaging/           # 消息路由
│   ├── features/
│   │   ├── petManager/              # 核心宠物管理（内容脚本）
│   │   │   ├── petManager.js        # 主入口
│   │   │   ├── core/                # 核心实现
│   │   │   ├── modules/             # 功能模块
│   │   │   └── petManager.*.js      # 功能文件
│   │   ├── chat/                    # 聊天功能
│   │   ├── faq/                     # FAQ 系统
│   │   ├── session/                 # 会话导入/导出
│   │   └── mermaid/                 # Mermaid 图表渲染
│   ├── api/                         # API 集成层
│   │   ├── core/                    # API 请求管理
│   │   ├── services/                # 会话、FAQ 服务
│   │   └── utils/                   # 令牌、日志、错误处理
│   └── views/                       # Popup UI
└── docs/                            # 文档目录
    └── superpowers/
        ├── specs/                   # 设计规范文档
        └── plans/                   # 实施计划文档
```

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add project structure section"
```

---

### Task 10: 添加许可证部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 📄 许可证部分**

```markdown
## 📄 许可证

本项目采用 MIT 许可证。

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add license section"
```

---

### Task 11: 添加贡献指南部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 🤝 贡献指南部分**

```markdown
## 🤝 贡献指南

我们欢迎任何形式的贡献！无论是报告问题、提出建议还是提交代码，都非常感谢。

### 提交 Issue

在提交新 Issue 之前，请：

1. 首先查看 [Issue 列表](https://github.com/yourusername/your-repo/issues)，确认是否有类似的 Issue 已存在
2. 使用清晰的标题描述问题
3. 提供详细的复现步骤
4. 说明预期行为和实际行为
5. 如果可能，包含截图或屏幕录像

### Pull Request 流程

1. **Fork 仓库**
   - 点击仓库右上角的 "Fork" 按钮

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

### 代码规范

- 保持与项目现有代码风格一致
- 添加适当的注释，解释非显而易见的逻辑
- 确保功能的完整性
- 测试您的更改，确保不会破坏现有功能
- 保持提交信息清晰和有意义

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add contributing guide section"
```

---

## Chunk 5: 添加故障排除和联系方式

### Task 12: 添加故障排除部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 🔍 故障排除部分**

```markdown
## 🔍 故障排除

### 常见问题

#### 1. 扩展无法加载

**可能原因：**
- 未启用"开发者模式"
- `manifest.json` 有语法错误
- 目录结构不正确

**解决方案：**
- 确认在 `chrome://extensions/` 页面已启用右上角的"开发者模式"
- 使用 JSON 验证工具检查 `manifest.json` 是否有语法错误
- 确认仓库目录结构完整，没有缺失关键文件

#### 2. 宠物不显示

**可能原因：**
- 浏览器控制台有 JavaScript 错误
- 在不支持的网站上（如 Chrome 内部页面）
- 扩展权限问题

**解决方案：**
- 打开网页 DevTools (F12) 查看 Console 是否有错误
- 尝试在普通的 HTTPS 网站（如 https://example.com）上使用
- 检查扩展权限是否正确配置

#### 3. 聊天功能无法使用

**可能原因：**
- 网络连接问题
- 未配置有效的 API 令牌
- API 端点配置错误

**解决方案：**
- 检查网络连接是否正常
- 确认已在设置中配置了有效的 API 令牌
- 查看浏览器控制台的错误信息
- 确认 API 端点配置正确（检查 `cdn/core/config.js`）

#### 4. API 连接失败

**可能原因：**
- 网络环境限制
- 防火墙或代理设置
- API 服务不可用

**解决方案：**
- 确认网络环境允许连接到 API 地址
- 检查防火墙或代理设置
- 尝试切换网络环境（如使用手机热点）
- 确认 API 服务是否正常运行

---
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add troubleshooting section"
```

---

### Task 13: 添加联系方式和结束部分

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 添加 📞 联系方式部分**

```markdown
## 📞 联系方式

- **项目仓库：** [GitHub 仓库](https://github.com/yourusername/your-repo)（请替换为实际链接）
- **Issue 追踪：** [提交 Issue](https://github.com/yourusername/your-repo/issues)（请替换为实际链接）
- **开发者：** [您的名字/团队](https://yourwebsite.com)

---

## 致谢

感谢所有为这个项目做出贡献的开发者！

---

*最后更新：2026-03-14*
```

- [ ] **Step 2: 提交更改**

```bash
git add README.md
git commit -m "feat: add contact and final sections"
```

---

### Task 14: 验证并完成

**Files:**
- Read: `README.md`

- [ ] **Step 1: 读取完整的 README.md 文件验证内容**

- [ ] **Step 2: 检查所有部分是否完整和链接正确**

- [ ] **Step 3: 最终提交（如有需要）**

```bash
# 如有任何修正，提交它们
git status
git add README.md
git commit -m "docs: final README review and fixes"
```

---

## 计划完成！

Plan complete and saved to `docs/superpowers/plans/2026-03-14-readme-implementation.md`. Ready to execute?
