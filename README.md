# 温柔陪伴助手

> 在浏览器中添加一位温柔体贴的伴侣，陪伴您的浏览时光。支持多种互动功能，让网页浏览更加有趣！

## 简介

温柔陪伴助手是一款基于 Chrome Manifest V3 的浏览器扩展，为网页浏览提供智能虚拟伴侣服务。它解决了传统浏览器浏览体验单调、缺乏互动性的痛点，通过在网页上添加虚拟宠物形象和 AI 交互功能，提升用户的浏览体验，缓解压力，同时提供实用工具提高效率。

核心功能包括：
- 🐾 实时虚拟宠物：在网页上显示可爱的虚拟宠物，支持拖拽和动画效果
- 💬 AI 对话系统：流式响应的智能对话，支持 Markdown 渲染和图表解析
- 📦 会话管理：保存和管理多个对话会话，支持标签分类
- 📚 FAQ 知识库：存储常用问题和答案，支持快速检索和复用
- 🎭 角色系统：提供 4 种专业角色（教师、医生、甜品师、警察）
- 📊 Mermaid 图表渲染：支持 Mermaid 语法的图表渲染功能

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Chrome Extension | Manifest V3 | 浏览器扩展标准 |
| Vanilla JavaScript | ES6+ | 核心扩展逻辑 |
| Vue | 3 (Global Build) | 现代化 UI 组件框架 |
| Tailwind CSS | - | 实用优先的 CSS 框架 |
| marked | - | Markdown 解析与渲染 |
| turndown | - | HTML 逆向转换为 Markdown |
| mermaid | - | 专业图表渲染 |

## 快速开始

### 环境要求

- Chrome 浏览器 >= 88（支持 Manifest V3）
- 待补充

### 安装

1. 克隆仓库
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"开关
4. 点击"加载已解压的扩展程序"按钮
5. 选择仓库目录

### 开发

打开任意网页，您应该能看到虚拟宠物出现在页面上。点击宠物或使用快捷键（Ctrl+Shift+P 切换显示/隐藏，Ctrl+Shift+X 打开聊天窗口）开始交互。

访问 chrome://extensions/ 查看扩展状态，点击"错误"按钮查看控制台日志。

### 构建

无需构建步骤，零构建架构，直接加载源代码到 Chrome 即可运行。

### 测试

待补充

## 目录结构

```
YiPet/
├── core/                    # 核心模块
│   ├── config.js            # 全局配置
│   ├── utils/               # 工具函数
│   ├── api/                 # API 服务
│   ├── constants/           # 常量定义
│   ├── bootstrap/           # 初始化入口
│   └── module.md            # 模块清单
├── modules/                 # 功能模块
│   ├── pet/                 # 宠物管理核心模块
│   ├── faq/                 # FAQ 管理
│   ├── mermaid/             # Mermaid 图表渲染
│   ├── extension/           # 扩展系统（background/popup）
│   ├── chat/                # 聊天导出
│   ├── screenshot/          # 区域截图
│   └── session/             # 会话导入导出
├── libs/                    # 第三方库
├── assets/                  # 静态资源
│   ├── styles/              # 样式文件
│   ├── icons/               # 图标
│   └── images/              # 图片资源
├── docs/                    # 项目文档
├── manifest.json            # 扩展配置
├── CLAUDE.md                # 项目行为准则
└── README.md                # 项目说明
```

## 核心架构

- 视图入口使用 createBaseView 工厂
- 状态管理使用 createStore + useComputed + useMethods
- 共享组件在 modules/pet/components/ 下通过 IIFE 命名空间挂载
- 模块封装使用 IIFE 模式，挂载到 window.PetManager 命名空间
- manifest.json 中 content_scripts 按依赖顺序插入

## 文档

| 文档 | 说明 |
|------|------|
| [架构约定](docs/architecture.md) | 项目架构模式与编码规范 |
| [构建与部署](docs/devops.md) | 构建/部署/运维流程 |
| [变更日志](docs/changelog.md) | 版本变更记录 |
| [常见问题](docs/FAQ.md) | 开发常见问题与解答 |
| [认证方案](docs/auth.md) | 认证/鉴权方案 |
| [安全策略](docs/security.md) | 安全策略与自检规则 |

## 贡献指南

待补充

## 许可证

待补充
