# ChatWindow 组件

> 温柔陪伴助手 - 主聊天界面组件

---

## 概述

ChatWindow 是温柔陪伴助手的主聊天界面组件，提供完整的聊天功能，包括消息显示、输入框和发送按钮。

---

## 文件位置

```
modules/pet/components/chat/ChatWindow/
├── index.html         # 组件模板
├── index.js           # 组件逻辑
├── index.css          # 组件样式
└── hooks/             # 自定义 hooks
    ├── store.js       # 状态管理
    ├── useComputed.js # 计算属性
    └── useMethods.js  # 方法
```

---

## 功能特性

- **消息展示**：显示聊天消息，支持多种消息类型
- **消息输入**：提供文本输入框，支持发送功能
- **消息发送**：支持发送文本消息
- **聊天控制**：提供聊天窗口的打开和关闭功能

---

## 更新日志

### v1.0.0
- 初始版本发布
- 基础聊天功能实现
