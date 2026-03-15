# YiPet 组件化目录结构改造计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 YiPet 项目目录结构，按功能模块统一组织代码，消除职责重叠，提升可维护性。

**Architecture:** 采用功能驱动的组件化架构，将相关代码（业务逻辑、UI组件、工具函数）组织在同一功能模块下，替代现有的按技术类型分层的结构。

**Tech Stack:** Chrome Extension Manifest V3, Vanilla JavaScript, Vue.js 3, Chrome Extension API

---

## 1. 改造概述

### 当前问题分析
- `cdn/components/` 与 `src/features/` 存在职责重叠
- 功能分散在多个目录，难以定位相关文件
- 工具函数分散在 `cdn/utils/` 和 `src/api/utils/`
- 新成员需要了解两套目录结构

### 改造原则
- 按功能模块组织代码，相关文件放在同一目录
- 保持现有功能完全不变
- 最小化对 `manifest.json` 的修改
- 确保扩展仍能正常加载和运行

---

## 2. 新目录结构设计

```
YiPet/
├── manifest.json                # 扩展清单文件
├── assets/                      # 全局资源（样式、图片、图标）
│   ├── styles/
│   ├── images/
│   └── icons/
├── libs/                        # 第三方库（Vue、marked、html2canvas等）
├── core/                        # 核心系统模块
│   ├── config/                  # 配置管理
│   ├── bootstrap/               # 引导初始化
│   ├── constants/               # 常量定义
│   ├── utils/                   # 全局工具函数
│   └── api/                     # API 核心层
├── modules/                     # 功能模块（按功能划分）
│   ├── pet/                     # 宠物管理模块
│   │   ├── components/          # 宠物相关 Vue 组件
│   │   ├── core/                # 宠物核心逻辑
│   │   ├── modules/             # 宠物子功能模块
│   │   ├── utils/               # 宠物相关工具函数
│   │   └── styles/              # 宠物样式
│   ├── chat/                    # 聊天功能模块
│   │   ├── components/          # 聊天相关 Vue 组件
│   │   ├── core/                # 聊天核心逻辑
│   │   ├── utils/               # 聊天相关工具函数
│   │   └── styles/              # 聊天样式
│   ├── faq/                     # FAQ 系统模块
│   │   ├── components/          # FAQ 相关 Vue 组件
│   │   ├── core/                # FAQ 核心逻辑
│   │   ├── utils/               # FAQ 相关工具函数
│   │   └── styles/              # FAQ 样式
│   ├── session/                 # 会话管理模块
│   │   ├── components/          # 会话相关 Vue 组件
│   │   ├── core/                # 会话核心逻辑
│   │   ├── utils/               # 会话相关工具函数
│   │   └── styles/              # 会话样式
│   ├── screenshot/              # 截图功能模块
│   │   ├── core/                # 截图核心逻辑
│   │   ├── utils/               # 截图相关工具函数
│   │   └── styles/              # 截图样式
│   ├── mermaid/                 # Mermaid 图表模块
│   │   ├── core/                # 图表核心逻辑
│   │   ├── utils/               # 图表相关工具函数
│   │   └── styles/              # 图表样式
│   └── extension/               # 扩展系统模块
│       ├── background/          # 后台服务 Worker
│       ├── content-scripts/     # 内容脚本
│       ├── popup/               # 弹出窗口
│       └── messaging/           # 消息通信
└── docs/                        # 文档
```

---

## 3. 改造任务分解

### 任务 1: 准备工作
- [ ] 创建新目录结构的基础文件夹
- [ ] 备份当前项目（建议使用 git 分支）
- [ ] 检查 `manifest.json` 中的所有文件引用

### 任务 2: 迁移全局资源
- [ ] 移动 `cdn/assets/` 到 `assets/`
- [ ] 移动 `cdn/libs/` 到 `libs/`
- [ ] 更新 `manifest.json` 中的资源路径

### 任务 3: 迁移核心系统模块
- [ ] 移动 `cdn/core/` 到 `core/`
- [ ] 移动 `src/api/` 到 `core/api/`
- [ ] 合并 `cdn/utils/` 和 `src/api/utils/` 到 `core/utils/`
- [ ] 更新相关文件的引用路径

### 任务 4: 迁移宠物管理模块
- [ ] 移动 `src/features/petManager/` 到 `modules/pet/`
- [ ] 移动 `cdn/components/` 中宠物相关组件到 `modules/pet/components/`
- [ ] 更新宠物模块内部文件引用
- [ ] 更新 `manifest.json` 中的宠物模块文件路径

### 任务 5: 迁移聊天功能模块
- [ ] 移动 `src/features/chat/` 到 `modules/chat/`
- [ ] 移动 `cdn/components/chat/` 到 `modules/chat/components/`
- [ ] 更新聊天模块内部文件引用
- [ ] 更新 `manifest.json` 中的聊天模块文件路径

### 任务 6: 迁移 FAQ 系统模块
- [ ] 移动 `src/features/faq/` 到 `modules/faq/`
- [ ] 移动 `cdn/components/manager/FaqManager/` 和 `FaqTagManager/` 到 `modules/faq/components/`
- [ ] 更新 FAQ 模块内部文件引用
- [ ] 更新 `manifest.json` 中的 FAQ 模块文件路径

### 任务 7: 迁移会话管理模块
- [ ] 移动 `src/features/session/` 到 `modules/session/`
- [ ] 移动 `cdn/components/manager/SessionTagManager/` 到 `modules/session/components/`
- [ ] 更新会话模块内部文件引用
- [ ] 更新 `manifest.json` 中的会话模块文件路径

### 任务 8: 迁移其他功能模块
- [ ] 移动 `src/features/mermaid/` 到 `modules/mermaid/`
- [ ] 移动 `src/features/petManager/content/petManager.screenshot.js` 到 `modules/screenshot/`
- [ ] 更新各模块内部文件引用
- [ ] 更新 `manifest.json` 中的相应文件路径

### 任务 9: 迁移扩展系统模块
- [ ] 移动 `src/extension/` 到 `modules/extension/`
- [ ] 更新扩展模块内部文件引用
- [ ] 确保后台服务 Worker 仍能正常加载

### 任务 10: 迁移视图层
- [ ] 移动 `src/views/` 到 `modules/extension/popup/`
- [ ] 更新视图层文件引用

### 任务 11: 更新 manifest.json
- [ ] 全面更新 `manifest.json` 中的所有文件路径
- [ ] 更新 `web_accessible_resources` 中的资源路径
- [ ] 更新 `content_scripts` 中的文件列表

### 任务 12: 测试验证
- [ ] 加载扩展到 Chrome 浏览器
- [ ] 测试所有功能：宠物显示、聊天、截图、会话管理等
- [ ] 检查控制台是否有错误
- [ ] 验证扩展在不同网站上的运行情况

### 任务 13: 清理工作
- [ ] 删除旧的目录结构（cdn/、src/）
- [ ] 检查是否有未使用的文件
- [ ] 优化 `manifest.json` 中的文件列表

---

## 4. 关键文件修改说明

### manifest.json 修改
- 更新 `content_scripts` 中的 JS 和 CSS 文件路径
- 更新 `web_accessible_resources` 中的资源路径
- 更新 `background.service_worker` 路径
- 更新 `action.default_popup` 路径

### 模块内部文件引用
- 将 `../` 或 `../../` 等相对路径更新为新结构的路径
- 确保所有 `import` 或 `require` 语句正确
- 检查 HTML 模板中的资源引用

---

## 5. 风险评估与应对

### 风险 1: 路径引用错误
- **应对**：使用脚本批量更新文件引用
- **验证**：加载扩展后检查控制台错误

### 风险 2: 扩展无法加载
- **应对**：保留备份，可快速回滚
- **验证**：在每次重大修改后测试加载

### 风险 3: 功能损坏
- **应对**：按模块迁移，每个模块测试后再进行下一个
- **验证**：完整测试所有功能

---

## 6. 测试清单

### 安装测试
- [ ] 扩展能正常加载
- [ ] 无错误警告

### 功能测试
- [ ] 宠物能正常显示和隐藏
- [ ] 聊天窗口能正常打开和关闭
- [ ] 聊天功能正常（发送/接收消息）
- [ ] 截图功能正常（区域选择、保存）
- [ ] 会话管理正常（导入/导出）
- [ ] FAQ 系统正常（搜索、标签）
- [ ] Mermaid 图表正常渲染
- [ ] 键盘快捷键正常工作

### 兼容性测试
- [ ] 在不同 Chrome 版本上测试
- [ ] 在不同类型网站上测试
- [ ] 测试响应式布局

---

## 7. 后续优化建议

### 代码优化
- [ ] 统一工具函数命名规范
- [ ] 优化模块间的依赖关系
- [ ] 提取公共组件到 `core/components/`

### 文档优化
- [ ] 更新 `CLAUDE.md` 中的架构说明
- [ ] 为每个模块添加 README.md
- [ ] 优化 `manifest.json` 注释

---

## 8. 执行计划

### 阶段 1: 基础架构（2天）
- 完成任务 1-3，搭建新目录结构

### 阶段 2: 功能模块迁移（3天）
- 完成任务 4-8，迁移所有功能模块

### 阶段 3: 测试验证（1天）
- 完成任务 11-12，全面测试

### 阶段 4: 清理与优化（1天）
- 完成任务 13 和后续优化建议

---

## 9. 工具推荐

### 路径更新工具
- 使用 `sed` 命令批量替换路径
- 使用 IDE 的全局搜索替换功能
- 编写简单的 Node.js 脚本辅助迁移

### 测试工具
- Chrome DevTools（Console、Network、Elements）
- Chrome 扩展管理页面的错误检查

---

**计划完成时间：** 7 天（保守估计）

**预期结果：** 扩展功能完全正常，目录结构更加清晰，代码可维护性显著提升。
