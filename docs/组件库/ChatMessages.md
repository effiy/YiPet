# ChatMessages 组件

> 聊天消息列表组件，负责显示聊天历史记录

---

## 📋 组件概述

ChatMessages 组件负责渲染和管理聊天消息列表，支持流式显示、Markdown 渲染、代码高亮等功能。

---

## 🏗️ 文件结构

```
modules/pet/components/chat/ChatMessages/
├── index.html                 # 组件 HTML 模板
└── index.js                   # Vue 应用逻辑
```

---

## 🔧 主要功能

### 1. 消息渲染
- 文本消息显示
- Markdown 格式渲染
- 代码高亮显示
- 图片消息显示
- Mermaid 图表渲染

### 2. 消息管理
- 消息历史加载
- 滚动到底部
- 消息复制功能
- 消息删除功能
- 消息状态显示

### 3. 流式显示
- AI 响应流式渲染
- 打字机效果
- 渲染进度显示

---

## 📚 相关文件

- `ChatWindow` - 父组件
- `petManager.parser.js` - 消息解析
- `petManager.mermaid.js` - 图表渲染

---

*最后更新：2026-03-18*
