# ChatInput 组件

> 聊天输入框组件，支持文本输入和截图功能

---

## 📋 组件概述

ChatInput 组件提供聊天输入功能，支持文本输入、发送、截图插入等功能。

---

## 🏗️ 文件结构

```
modules/pet/components/chat/ChatInput/
├── index.html                 # 组件 HTML 模板
└── index.js                   # Vue 应用逻辑
```

---

## 🔧 主要功能

### 1. 文本输入
- 多行文本输入
- 自动高度调整
- 输入历史记录

### 2. 消息发送
- Enter 键发送
- Shift+Enter 换行
- 发送状态显示
- 消息验证

### 3. 截图功能
- 启动截图选择
- 截图预览
- 截图插入到输入框
- 截图删除功能

---

## 📚 相关文件

- `ChatWindow` - 父组件
- `ChatMessages` - 消息列表组件
- `petManager.screenshot.js` - 截图功能实现

---

*最后更新：2026-03-18*
