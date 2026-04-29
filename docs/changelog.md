# Changelog

本文件记录项目的所有重要变更。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- docs/architecture.md - 项目架构约定文档
- docs/changelog.md - 变更日志
- docs/devops.md - 构建/部署/运维流程文档
- docs/FAQ.md - 常见问题与故障排查文档
- docs/auth.md - 认证/鉴权方案文档
- docs/security.md - 安全策略文档
- docs/项目初始化/ - 项目初始化全文档集

## [1.1.1] - 2026-04-29

### 变更
- 更新 .claude 子模块到 commit 1b159bd
- 添加文档生成和网络请求库文档的详细日志
- 移除过时的企业微信通知临时文件和周报

### 新增
- 新增文档生成流程日志记录

## [1.1.0] - 2026-04-29

### 变更
- 更新 .claude 子模块到 commit ab66a44
- 为周报添加企业微信推送成功的通知详情
- 移除 2026-04-28 到 2026-05-04 期间的过时周报文件

## [1.0.9] - 2026-04-29

### 变更
- 更新 .claude 子模块到 commit 9e08eff
- 增强周报生成文档，包括 KPI 达成情况详细摘要和未来改进规划

## [1.0.8] - 2026-04-29

### 变更
- 更新 .claude 子模块到 commit 6b2c4a4d12b28f2ee03728624876520042e6e795-dirty
- 文档更新动态检查清单验证状态改进，确保所有项目标记为完成且通过率为 100%

## [1.0.7] - 2026-04-28

### 重构
- 第三阶段 - 持续优化代码结构与兼容层清理

### 变更
- 更新 .claude 子模块到 new commit 6b2c4a4
- 继续拆分大型文件
- 重构代码坏味道，拆分大型文件并统一配置管理

## [1.0.6] - 2026-04-28

### 文档
- docs: 继续拆分其他大型文件 - 完整文档集

### 变更
- chore: 清理 .gitkeep 文件并更新 .claude 子模块
- refactor: 重构代码坏味道，拆分大型文件并统一配置管理
- 更新 .claude 子模块到 new commit 56dc750
- 更新 .claude 子模块到 new commit 416b1ff
- 更新 .claude 子模块到 new commit 1209564

## [1.0.5] - 2026-04-28

### 重构
- refactor: Update project structure and documentation for modularization
- 更新 .claude 子模块

### 文档
- docs: 更新CLAUDE.md以整合行为指导和项目概述
- docs: 为项目运维任务创建文档并添加可点击链接
- docs: 项目运维表格更新，添加任务板任务和状态表情包
- docs: 优化项目运维部分，去除概述并更新表格标题和列名
- docs: 去除项目运维标题下的核心职责部分

## [1.0.0] - 初始版本

### 新增
- Chrome Extension Manifest V3 架构
- 实时虚拟宠物功能（网页显示、拖拽、动画）
- AI 对话系统（流式响应、Markdown 渲染、图表解析）
- 会话管理（保存、标签分类、导入导出）
- FAQ 知识库（常用问题快速检索和复用）
- 角色系统（教师、医生、甜品师、警察等）
- Mermaid 图表渲染（流程图、时序图、甘特图等）
- 零构建架构（原生 JavaScript 直接运行）
- Vue 3 (Global Build) UI 组件
- Tailwind CSS 样式系统
- chrome.storage.local 本地数据持久化
