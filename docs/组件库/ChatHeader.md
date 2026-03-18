# ChatHeader 组件

> 聊天窗口头部组件，包含窗口控制按钮和设置选项

---

## 📋 组件概述

ChatHeader 组件是聊天窗口的顶部栏，提供窗口控制（关闭、最小化）、设置按钮和会话信息显示。

---

## 🏗️ 文件结构

```
modules/pet/components/chat/ChatHeader/
├── index.html                 # 组件 HTML 模板
└── index.js                   # Vue 应用逻辑
```

---

## 🔧 主要功能

### 1. 窗口控制
- 关闭聊天窗口
- 最小化聊天窗口
- 窗口拖拽功能

### 2. 设置功能
- 打开 AI 设置弹窗
- 打开令牌设置弹窗
- 角色选择和切换
- 宠物显示/隐藏切换

### 3. 会话信息
- 显示当前会话名称
- 显示当前角色信息
- 显示会话标签

---

## 🎨 样式说明

### 主要样式类
```css
.yi-pet-chat-header            /* 头部容器 */
.yi-pet-chat-header-title      /* 标题区域 */
.yi-pet-chat-header-controls   /* 控制按钮区域 */
.yi-pet-chat-settings-btn      /* 设置按钮 */
```

---

## 📚 相关文件

- `ChatWindow` - 父组件
- `AiSettingsModal` - AI 设置弹窗组件
- `TokenSettingsModal` - 令牌设置弹窗组件

---

*最后更新：2026-03-18*
