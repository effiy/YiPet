# README 设计文档

**日期：** 2026-03-14
**项目：** 温柔陪伴助手 (Gentle Companionship Assistant)
**设计目标：** 创建一个技术文档型的 README 文件

---

## 1. 概述

本文档描述了为 "温柔陪伴助手" Chrome 扩展项目创建 README 文件的设计方案。该 README 将采用**技术文档型**风格，以中文为主，附带英文摘要。

## 2. 设计原则

- **技术导向：** 重点面向开发者和贡献者
- **详细完整：** 包含架构说明、开发指南、调试方法
- **中文为主：** 主要内容使用中文，符合项目定位
- **英文摘要：** 提供简要的英文概述，便于国际化
- **结构清晰：** 使用 emoji 和层级结构增强可读性

## 3. README 内容结构

### 3.1 项目头部

```markdown
# 温柔陪伴助手 (Gentle Companionship Assistant)

> 在浏览器中添加一位温柔体贴的伴侣，陪伴您的浏览时光

[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![Version](https://img.shields.io/badge/version-1.1.1-green)](manifest.json)

[English Overview](#english-overview) • [快速开始](#-快速开始) • [功能特性](#-功能特性) • [开发指南](#-开发指南)
```

### 3.2 English Overview（英文摘要）

简短的英文描述，包含：
- 项目简介（1-2 句话）
- 主要功能列表（bullet points）
- 快速安装方法概要

### 3.3 项目简介

- 项目背景和设计理念
- 解决的核心问题
- 目标用户群体
- 项目价值主张

### 3.4 ✨ 功能特性

详细的功能列表，包括：
- 虚拟宠物展示（拖拽支持）
- AI 聊天界面（流式响应）
- 区域截图功能
- 会话管理（导入/导出 ZIP）
- FAQ 系统（标签支持）
- Mermaid 图表渲染
- 多种宠物角色（教师、医生、甜品师、警察）
- 键盘快捷键

每个功能用简短的说明描述其用途。

### 3.5 🚀 快速开始

**安装步骤：**
1. 克隆仓库
2. 打开 Chrome 浏览器，导航到 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"，选择仓库目录

**环境配置：**
- 生产环境：`https://api.effiy.cn`（默认）
- 开发环境：在加载配置前设置 `window.__PET_ENV_MODE__` 为 `development`

### 3.6 📖 使用说明

- 基本操作指南（如何显示/隐藏宠物、如何打开聊天等）
- 键盘快捷键表格
  - `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`) - 切换宠物显示
  - `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`) - 打开聊天窗口
- 常见问题解答

### 3.7 🔧 技术架构

**技术栈：**
- Vanilla JavaScript（核心扩展，无框架）
- Vue.js 3（UI 组件）
- Chrome Extension API (Manifest V3)
- 第三方库：marked, html2canvas, JSZip, mermaid, turndown, md5

**架构概览：**
- 目录结构说明
- 核心模块介绍：
  - **PetManager** (`src/features/petManager/content/`) - 核心宠物管理
  - **Background Script** (`src/extension/background/`) - 后台服务 worker
  - **API Layer** (`src/api/`) - API 集成层
  - **Vue Components** (`cdn/components/`) - UI 组件
- 消息流说明（Popup ↔ Background ↔ Content Script）
- 存储说明（Chrome `storage.local` 的使用）

### 3.8 🛠️ 开发指南

**开发环境设置：**
- 零构建说明（文件可直接加载）
- 调试方法：
  - Content Script 日志：打开网页 DevTools → Console
  - Background Script 日志：`chrome://extensions/` → Inspect views service worker
  - Popup 日志：右键扩展图标 → Inspect popup

**常见开发任务：**
- 添加新宠物角色：
  1. 在 `petManager.roles.js` 中添加角色配置
  2. 在 `cdn/assets/images/{roleName}/` 中添加角色图片资源
  3. 如需要，更新 manifest 的 `web_accessible_resources`
- 修改 API 端点：编辑 `cdn/core/config.js`
- 工作与 Vue 组件：组件通过 `web_accessible_resources` 加载

**代码规范：**
- 文件组织规范
- 模块命名约定

### 3.9 📁 项目结构

完整的目录树结构，带注释说明：

```
├── manifest.json                    # 扩展清单文件
├── CLAUDE.md                        # Claude Code 指导文档
├── README.md                        # 项目说明文档（当前正在创建）
├── cdn/
│   ├── core/                        # 核心工具和配置
│   ├── libs/                        # 第三方库
│   ├── assets/                      # 样式、图片、图标
│   ├── components/                  # Vue.js 组件
│   └── utils/                       # 工具模块
├── src/
│   ├── extension/
│   │   └── background/              # 后台服务 worker
│   ├── features/
│   │   ├── petManager/              # 核心宠物管理（内容脚本）
│   │   ├── chat/                    # 聊天功能
│   │   ├── faq/                     # FAQ 系统
│   │   ├── session/                 # 会话导入/导出
│   │   └── mermaid/                 # Mermaid 图表渲染
│   ├── api/                         # API 集成层
│   └── views/                       # Popup UI
```

### 3.10 🤝 贡献指南

**提交 Issue：**
- 首先查看是否有类似的 Issue 已存在
- 提供详细的复现步骤、预期行为和实际行为
- 包含截图或视频（如果有）

**Pull Request 流程：**
1. Fork 仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改
4. 推送到您的 fork 仓库
5. 创建 Pull Request

**代码规范：**
- 使用一致的代码风格（基于项目现有代码）
- 添加适当的注释
- 确保功能的完整性
- 测试您的更改

### 3.11 📄 许可证

MIT 许可证声明。

### 3.12 🔍 故障排除

**常见问题：**

1. **扩展无法加载**：
   - 确保已启用"开发者模式"
   - 检查 `manifest.json` 是否有语法错误
   - 确认目录结构正确

2. **宠物不显示**：
   - 检查浏览器控制台是否有错误
   - 确认是否在支持的网站上（`https://` 或 `http://localhost/`）
   - 尝试重新加载网页

3. **聊天功能无法使用**：
   - 检查网络连接
   - 确认已配置有效的 API 令牌
   - 查看浏览器控制台的错误信息

4. **API 连接失败**：
   - 确认网络环境允许连接到 API 地址
   - 检查防火墙或代理设置
   - 尝试切换网络环境

### 3.13 📞 联系方式

- 项目仓库链接：[GitHub 仓库](https://github.com/yourusername/your-repo)（请替换为实际链接）
- Issue 追踪：[提交 Issue](https://github.com/yourusername/your-repo/issues)（请替换为实际链接）
- 开发者：[您的名字/团队](https://yourwebsite.com)

## 4. 实现计划

1. 创建 `README.md` 文件
2. 按照上述结构编写内容
3. 确保所有链接和引用正确
4. 添加适当的 badge 和图标
5. 验证所有信息的准确性

## 5. 注意事项

- README 应提供完整的项目信息，面向最终用户和开发者
- 保持技术准确性，确保所有代码示例和命令正确
- 使用清晰的 Markdown 格式，便于在 GitHub 等平台上渲染
- 定期更新 README 以反映项目的最新状态
- 如果有 LICENSE 文件，请确保其内容与 README 中的声明一致
