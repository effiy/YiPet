# 模块：chat

## 基本信息
- **模块名**：chat
- **职责**：聊天导出功能，支持导出聊天记录为 PNG 图片
- **入口文件**：modules/chat/content/export-chat-to-png.js
- **代码规模**：约 400 行

## 上游依赖
- modules/pet：使用 PetManager 上下文
- core/utils：可能使用工具函数

## 反向依赖
- modules/pet：通过 PetManager.prototype 挂载导出功能

## 导出接口
- `window.PetManager.exportChatToPng`：导出聊天为 PNG 功能
