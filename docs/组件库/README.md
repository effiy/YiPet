# 组件库文档

> 温柔陪伴助手 - Vue 组件库详细说明

---

## 📋 组件列表

本目录包含温柔陪伴助手所有 Vue 组件的详细文档：

### 💬 聊天组件
- **[ChatWindow](./ChatWindow.md)** - 主聊天窗口组件
- **[ChatHeader](./ChatHeader.md)** - 聊天窗口头部组件
- **[ChatInput](./ChatInput.md)** - 聊天输入框组件
- **[ChatMessages](./ChatMessages.md)** - 聊天消息列表组件

### 🪟 弹窗组件
- **[AiSettingsModal](./AiSettingsModal.md)** - AI 设置弹窗组件
- **[TokenSettingsModal](./TokenSettingsModal.md)** - API 令牌设置弹窗组件

### 📋 管理器组件
- **[FaqManager](./FaqManager.md)** - FAQ 管理器组件
- **[FaqTagManager](./FaqTagManager.md)** - FAQ 标签管理器组件
- **[SessionTagManager](./SessionTagManager.md)** - 会话标签管理器组件

### ✏️ 编辑器组件
- **[SessionInfoEditor](./SessionInfoEditor.md)** - 会话信息编辑器组件

---

## 🚀 快速开始

### 组件特点
- 使用 Vue 3 Composition API
- 组件化设计，易于维护
- 支持响应式布局
- 统一的样式规范

### 文件结构
每个组件通常包含：
- `index.html` - 组件 HTML 模板
- `index.js` - Vue 应用逻辑
- `index.css` - 组件样式（可选）

### 技术栈
- **Vue 3** - UI 组件框架
- **原生 JavaScript** - 组件逻辑
- **CSS** - 组件样式

---

## 📖 组件使用

### 组件加载
组件通过 `web_accessible_resources` 加载为 HTML 模板：
```javascript
// 组件 HTML 模板通过 fetch 加载
const html = await fetch(chrome.runtime.getURL('path/to/component/index.html')).then(r => r.text());
```

### Vue 应用初始化
```javascript
// 使用 Vue.createApp() 定义 Vue 应用
const app = Vue.createApp({
  // 组件逻辑
});

app.mount('#app-container');
```

---

## 🔗 相关文档

- [配置指南](../配置指南.md) - 详细的配置说明
- [架构设计](../架构设计.md) - 项目架构和结构
- [项目文档](../README.md) - 主项目文档

---

*最后更新：2026-03-18*
