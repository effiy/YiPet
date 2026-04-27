# 模块：pet - CLAUDE.md

## 模块边界

该模块负责宠物管理的核心功能，包括：
- 宠物 UI 渲染与拖拽
- 聊天功能与 UI
- 会话管理与导入导出
- 状态管理与持久化
- 消息处理与路由
- Vue 组件注册

## 关键文件

### 核心入口
- `modules/pet/content/petManager.js`：模块聚合入口
- `modules/pet/content/core/petManager.core.js`：PetManager 类定义

### 功能模块
- `modules/pet/content/petManager.chat.js`：聊天功能
- `modules/pet/content/petManager.drag.js`：拖拽功能
- `modules/pet/content/petManager.events.js`：事件处理
- `modules/pet/content/petManager.media.js`：媒体处理
- `modules/pet/content/petManager.message.js`：消息处理
- `modules/pet/content/petManager.pet.js`：宠物管理
- `modules/pet/content/petManager.state.js`：状态管理
- `modules/pet/content/petManager.ui.js`：UI 管理

### 子模块
- `modules/pet/content/modules/petManager.ai.js`：AI 功能
- `modules/pet/content/modules/petManager.auth.js`：认证
- `modules/pet/content/modules/petManager.io.js`：导入导出
- `modules/pet/content/modules/petManager.mermaid.js`：Mermaid
- `modules/pet/content/modules/petManager.messaging.js`：消息路由
- `modules/pet/content/modules/petManager.roles.js`：角色管理
- `modules/pet/content/modules/petManager.session.js`：会话管理
- `modules/pet/content/modules/petManager.tags.js`：标签管理

### Vue 组件
- `modules/pet/components/chat/ChatWindow/`：聊天窗口
- `modules/pet/components/modal/AiSettingsModal/`：AI 设置
- `modules/pet/components/modal/TokenSettingsModal/`：Token 设置
- `modules/pet/components/manager/FaqManager/`：FAQ 管理
- `modules/pet/components/manager/FaqTagManager/`：FAQ 标签管理
- `modules/pet/components/manager/SessionTagManager/`：会话标签管理
- `modules/pet/components/editor/SessionInfoEditor/`：会话信息编辑器

## 依赖清单摘要

### 上游依赖
- core/config：PET_CONFIG
- core/utils：StorageHelper、ErrorHandler、LoggerUtils、LoadingAnimationMixin、ImageResourceManager、DomHelper、SessionManager
- core/api：ApiManager、SessionService、FaqService
- core/constants：endpoints

### 反向依赖
- modules/chat：导出聊天到 PNG
- modules/faq：FAQ 功能
- modules/screenshot：截图功能
- modules/session：会话导入导出
- modules/mermaid：Mermaid 渲染
- core/bootstrap：创建 PetManager 单例
- manifest.json：加载所有 pet 相关 content_scripts

## 上下文加载建议

修改 pet 模块时，建议加载：
1. 本模块的目标文件
2. core/config.js（只读配置）
3. core/utils/ 相关工具的接口（而非完整实现）
4. modules/pet/module.md（依赖清单）
