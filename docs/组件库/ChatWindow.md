# ChatWindow 组件

> 主聊天窗口组件，负责聊天界面的管理和显示

---

## 📋 组件概述

ChatWindow 是应用的主聊天界面组件，负责管理聊天窗口的显示、布局、状态和交互。它是整个聊天系统的核心组件。

---

## 🏗️ 组件架构

### 文件结构
```
modules/pet/components/chat/ChatWindow/
├── index.html                 # 组件 HTML 模板
├── index.js                   # Vue 应用主逻辑
├── index.css                  # 聊天窗口样式
└── hooks/                     # Vue 组合式函数钩子
    ├── store.js               # 聊天窗口状态管理
    ├── useComputed.js         # 计算属性钩子
    └── useMethods.js          # 方法钩子
```

---

## 🔧 主要功能

### 1. 窗口管理
- 聊天窗口的显示和隐藏
- 窗口大小调整
- 窗口位置记忆
- 窗口状态管理

### 2. 布局管理
- 主聊天区域布局
- 侧边栏布局
- 消息列表区域
- 输入区域

### 3. 状态管理
- 窗口状态（显示/隐藏）
- 聊天状态（发送中/已发送/错误）
- 用户输入状态
- 会话信息

### 4. 交互功能
- 消息发送和接收
- 截图功能
- 会话切换
- 标签管理
- 设置功能

---

## 🚀 初始化流程

### 1. 组件创建
```javascript
// 在 PetManager.chat.js 中初始化
window.PetManager.ChatWindow = {
  init: function() {
    // 初始化聊天窗口
    this.createWindow()
    this.setupEventListeners()
    this.loadState()
  }
}
```

### 2. Vue 应用初始化
```javascript
// 在 index.js 中创建 Vue 应用
const app = Vue.createApp({
  setup() {
    // 状态设置和方法定义
    const { state, methods, computed } = setupChatWindow()

    return {
      ...state,
      ...methods,
      ...computed
    }
  }
})
```

---

## 📦 核心类和函数

### 1. setupChatWindow()
- **功能**：设置聊天窗口的状态和方法
- **返回**：包含 `state`、`methods`、`computed` 的对象
- **位置**：`hooks/useMethods.js`

### 2. ChatWindowHooks
- **功能**：聊天窗口的钩子函数集合
- **包含**：`store.js`、`useComputed.js`、`useMethods.js`
- **位置**：`hooks/` 目录

### 3. createWindow()
- **功能**：创建聊天窗口 DOM 元素
- **位置**：`index.js`

### 4. loadState()
- **功能**：从 Chrome 存储中加载窗口状态
- **位置**：`index.js`

---

## 🎨 样式结构

### 主要样式文件
- `index.css` - 聊天窗口主要样式
- `content.css` - 内容脚本样式
- `base/animations.css` - 动画效果

### 关键样式类
```css
.yi-pet-chat-container         /* 聊天窗口容器 */
.yi-pet-chat-content-container /* 聊天内容容器 */
.yi-pet-chat-right-panel       /* 右侧聊天面板 */
.yi-pet-chat-messages          /* 消息列表 */
.yi-pet-chat-input-container   /* 输入区域 */
```

---

## 📞 事件处理

### 窗口事件
- `resize` - 窗口大小调整
- `scroll` - 滚动事件
- `mousedown`/`mousemove`/`mouseup` - 拖拽事件

### 用户交互事件
- `send-message` - 发送消息
- `toggle-faq-manager` - 切换 FAQ 管理器
- `toggle-session-manager` - 切换会话管理器
- `take-screenshot` - 截图功能

---

## 🔄 状态存储

### 本地存储键
```javascript
petChatWindowState: {
  position: { x: 100, y: 100 },  // 窗口位置
  size: { width: 850, height: 720 }, // 窗口大小
  sidebarWidth: 320,            // 侧边栏宽度
  visible: false                // 窗口可见性
}
```

---

## 🛠️ 开发接口

### 公开方法
```javascript
// 在 window.PetManager.ChatWindow 上暴露的方法
window.PetManager.ChatWindow = {
  show: function() { /* 显示窗口 */ },
  hide: function() { /* 隐藏窗口 */ },
  toggle: function() { /* 切换显示/隐藏 */ },
  focus: function() { /* 聚焦输入框 */ },
  sendMessage: function(text) { /* 发送消息 */ }
}
```

---

## 📚 相关文件

- `modules/pet/content/petManager.chat.js` - 聊天管理主逻辑
- `modules/pet/content/petManager.parser.js` - 消息解析
- `core/api/SessionService.js` - 会话管理 API
- `core/api/FaqService.js` - FAQ 管理 API

---

*最后更新：2026-03-18*
