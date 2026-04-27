# 模块：pet

## 基本信息
- **模块名**：pet
- **职责**：宠物管理核心模块，包含 UI 渲染、拖拽、状态管理、事件处理、聊天、媒体、消息等功能
- **入口文件**：modules/pet/content/petManager.js
- **代码规模**：约 19000 行（22 子模块 + 12 Vue 组件）

## 上游依赖
- core/config：PET_CONFIG
- core/utils：StorageHelper、ErrorHandler、LoggerUtils、LoadingAnimationMixin、ImageResourceManager、DomHelper、SessionManager 等
- core/api：ApiManager、SessionService、FaqService
- core/constants：endpoints

## 反向依赖
- modules/chat：导出聊天到 PNG 时使用 PetManager 上下文
- modules/faq：通过 PetManager.prototype 挂载 FAQ 方法
- modules/screenshot：通过 PetManager.prototype 挂载截图方法
- modules/session：通过 PetManager 进行会话导入导出
- modules/mermaid：通过 PetManager 渲染 Mermaid 图表
- core/bootstrap：创建 PetManager 单例
- manifest.json：加载所有 pet 相关 content_scripts

## 导出接口
- `window.PetManager`：PetManager 类定义（petManager.core.js:1080）
- `window.PetManager.Components`：Vue 组件注册入口
- `window.petManager`：PetManager 单例实例

## 子模块清单
| 子模块 | 文件路径 | 职责 |
|-------|---------|------|
| core | modules/pet/content/core/petManager.core.js | PetManager 核心类定义 |
| ai | modules/pet/content/modules/petManager.ai.js | AI 相关功能 |
| auth | modules/pet/content/modules/petManager.auth.js | 认证相关 |
| chat | modules/pet/content/petManager.chat.js | 聊天功能 |
| drag | modules/pet/content/petManager.drag.js | 拖拽功能 |
| events | modules/pet/content/petManager.events.js | 事件处理 |
| media | modules/pet/content/petManager.media.js | 媒体处理 |
| message | modules/pet/content/petManager.message.js | 消息处理 |
| pet | modules/pet/content/petManager.pet.js | 宠物管理 |
| state | modules/pet/content/petManager.state.js | 状态管理 |
| ui | modules/pet/content/petManager.ui.js | UI 管理 |
| io | modules/pet/content/modules/petManager.io.js | 导入导出 |
| mermaid | modules/pet/content/modules/petManager.mermaid.js | Mermaid 图表 |
| messaging | modules/pet/content/modules/petManager.messaging.js | 消息路由 |
| roles | modules/pet/content/modules/petManager.roles.js | 角色管理 |
| session | modules/pet/content/modules/petManager.session.js | 会话管理 |
| tags | modules/pet/content/modules/petManager.tags.js | 标签管理 |
| editor | modules/pet/content/modules/petManager.editor.js | 编辑器 |
| parser | modules/pet/content/modules/petManager.parser.js | 解析器 |
| pageInfo | modules/pet/content/modules/petManager.pageInfo.js | 页面信息 |
| robot | modules/pet/content/modules/petManager.robot.js | 机器人功能 |
| sessionEditor | modules/pet/content/modules/petManager.sessionEditor.js | 会话编辑器 |

## Vue 组件清单
| 组件 | 路径 | 职责 |
|-----|------|------|
| ChatWindow | modules/pet/components/chat/ChatWindow/ | 聊天窗口主组件 |
| ChatHeader | modules/pet/components/chat/ChatHeader/ | 聊天窗口头部 |
| ChatInput | modules/pet/components/chat/ChatInput/ | 聊天输入框 |
| ChatMessages | modules/pet/components/chat/ChatMessages/ | 聊天消息列表 |
| AiSettingsModal | modules/pet/components/modal/AiSettingsModal/ | AI 设置模态框 |
| TokenSettingsModal | modules/pet/components/modal/TokenSettingsModal/ | Token 设置模态框 |
| FaqManager | modules/pet/components/manager/FaqManager/ | FAQ 管理器 |
| FaqTagManager | modules/pet/components/manager/FaqTagManager/ | FAQ 标签管理器 |
| SessionTagManager | modules/pet/components/manager/SessionTagManager/ | 会话标签管理器 |
| SessionInfoEditor | modules/pet/components/editor/SessionInfoEditor/ | 会话信息编辑器 |
