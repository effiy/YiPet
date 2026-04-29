# CLAUDE.md

行为规范见 .claude/shared/behavioral-guidelines.md。
项目架构约定见 docs/architecture.md。

## 技术栈

- Chrome Extension Manifest V3 - 浏览器扩展标准
- Vanilla JavaScript (ES6+) - 核心扩展逻辑（零构建架构）
- Vue 3 (Global Build) - 现代化 UI 组件框架
- Tailwind CSS - 实用优先的 CSS 框架
- marked - Markdown 解析与渲染
- turndown - HTML 逆向转换为 Markdown
- mermaid - 专业图表渲染
- chrome.storage.local - 本地数据持久化

## 项目结构

- core/ - 核心模块
  - config.js - 全局配置与环境检测
  - utils/ - 通用工具函数集
  - api/ - API 服务与请求管理
  - constants/ - 常量定义
  - bootstrap/ - Content Script 入口与初始化
  - module.md - 模块清单
- modules/ - 功能模块
  - pet/ - 宠物管理核心模块（UI、聊天、会话等）
  - faq/ - FAQ 管理与标签
  - mermaid/ - Mermaid 图表渲染
  - extension/ - 扩展系统（background、popup）
  - chat/ - 聊天导出功能
  - screenshot/ - 区域截图功能
  - session/ - 会话导入导出
- libs/ - 第三方库
- assets/ - 静态资源（样式、图标、图片）
- docs/ - 项目文档
- manifest.json - 扩展配置入口

## 编码规范

- 命名：使用 camelCase 命名变量和函数，PascalCase 命名类
- 组件：Vue 组件使用 IIFE 封装，挂载到 window.PetManager.Components 命名空间
- 状态管理：使用 Hooks 工厂模式（createStore + useComputed + useMethods）
- 样式：使用 Tailwind CSS，类名使用 kebab-case
- 模块封装：所有业务模块使用 IIFE 封装，挂载到 window.PetManager 命名空间
- manifest.json：新增 content_scripts 条目按依赖顺序插入
- 语法：使用 ES6+，优先 const，禁用 var
- 注释：使用 JSDoc 风格注释关键函数和模块
- 文件组织：按功能模块化，单个文件不宜过大

## 禁止事项

- 禁止在 content script 中使用 ES modules（需要使用传统 script 方式）
- 禁止修改第三方库源码（通过适配器模式封装）
- 禁止在 manifest.json 中添加不必要的权限（最小权限原则）
- 禁止硬编码 API 密钥（使用配置管理）

## 构建与运行

- 安装：无需 npm install（零构建架构）
- 开发：在 Chrome 中加载已解压的扩展（chrome://extensions/ -> 开发者模式 -> 加载已解压的扩展）
- 构建：无需构建步骤（原生 JavaScript，直接运行）
- 测试：待补充

## 关键文件

- manifest.json - 扩展配置入口
- core/config.js - 全局配置与环境检测
- core/bootstrap/bootstrap.js - Content Script 初始化
- modules/pet/content/core/petManager.core.js - PetManager 核心类定义
- modules/extension/background/index.js - 后台脚本入口

## 文档体系

- /generate-document 功能名-描述 - 生成功能文档集
- /generate-document init - 初始化项目基础文件
- /implement-code 功能名 - 实施代码
