# Vue 组件库文档

> 温柔陪伴助手 - Vue 3 组件库文档

---

## 概述

本目录包含温柔陪伴助手项目的所有 Vue 3 组件文档，涵盖聊天、弹窗、管理、编辑等各个功能模块的组件。

---

## 📋 组件分类

### 💬 聊天组件

| 组件名称 | 组件文档 | 功能说明 |
|---------|---------|---------|
| **ChatWindow** | [ChatWindow](./聊天组件/ChatWindow.md) | 主聊天界面 |
| **ChatInput** | [ChatInput](./聊天组件/ChatInput.md) | 聊天输入框 |
| **ChatMessage** | [ChatMessage](./聊天组件/ChatMessage.md) | 聊天消息展示 |
| **ChatHeader** | [ChatHeader](./聊天组件/ChatHeader.md) | 聊天窗口头部 |
| **ChatMessages** | [ChatMessages](./聊天组件/ChatMessages.md) | 聊天消息列表 |

### 🪟 弹窗组件

| 组件名称 | 组件文档 | 功能说明 |
|---------|---------|---------|
| **AiSettingsModal** | [AiSettingsModal](./弹窗组件/AiSettingsModal.md) | AI 配置弹窗 |
| **TokenSettingsModal** | [TokenSettingsModal](./弹窗组件/TokenSettingsModal.md) | Token 设置弹窗 |

### 📦 管理组件

| 组件名称 | 组件文档 | 功能说明 |
|---------|---------|---------|
| **FaqManager** | [FaqManager](./管理组件/FaqManager.md) | FAQ 管理器 |
| **SessionTagManager** | [SessionTagManager](./管理组件/SessionTagManager.md) | 会话标签管理器 |
| **FaqTagManager** | [FaqTagManager](./管理组件/FaqTagManager.md) | FAQ 标签管理器 |

### ✏️ 编辑组件

| 组件名称 | 组件文档 | 功能说明 |
|---------|---------|---------|
| **SessionInfoEditor** | [SessionInfoEditor](./编辑组件/SessionInfoEditor.md) | 会话信息编辑器 |

### 🔧 通用组件

| 组件名称 | 组件文档 | 功能说明 |
|---------|---------|---------|
| **LoadingSpinner** | [LoadingSpinner](./通用组件/LoadingSpinner.md) | 加载动画 |
| **Notification** | [Notification](./通用组件/Notification.md) | 通知组件 |

---

## 组件规范

### 文件结构

每个组件都遵循以下目录结构：

```
{componentName}/
├── index.html         # 组件模板
├── index.js           # 组件逻辑
├── index.css          # 组件样式（可选）
└── hooks/             # 自定义 hooks（可选）
    ├── store.js       # 状态管理
    ├── useComputed.js # 计算属性
    └── useMethods.js  # 方法
```

### 组件命名

- **组件文件**：大驼峰命名法，如 `ChatWindow/`
- **组件注册**：与文件名相同，如 `<ChatWindow />`
- **样式类**：小写连字符，如 `.chat-window`

### Props 规范

```javascript
// 组件 Props 定义
const props = defineProps({
  // 必填参数
  requiredProp: {
    type: String,
    required: true
  },

  // 可选参数
  optionalProp: {
    type: Number,
    default: 0
  },

  // 布尔参数
  booleanProp: {
    type: Boolean,
    default: false
  }
})
```

### Events 规范

```javascript
// 组件 Events 定义
const emit = defineEmits([
  'update:modelValue',
  'change',
  'submit',
  'close'
])

// 使用示例
emit('update:modelValue', newValue)
emit('change', { value: newValue })
```

---

## 快速开始

### 引入组件

```javascript
// 在 content script 中使用
import { createApp } from '/libs/vue.global.js'
import ChatWindow from '/modules/pet/components/chat/ChatWindow/index.js'
import AiSettingsModal from '/modules/pet/components/modal/AiSettingsModal/index.js'

const app = createApp({
  components: {
    ChatWindow,
    AiSettingsModal
  }
})

app.mount('#app')
```

### 组件使用

```html
<!-- 在 index.html 中 -->
<div id="app">
  <chat-window
    :visible="showChat"
    @close="showChat = false"
  ></chat-window>

  <ai-settings-modal
    v-model:visible="showAiSettings"
  ></ai-settings-modal>
</div>
```

---

## 组件特点

1. **独立目录结构**：每个组件都有独立的目录
2. **完整文件**：包含模板、逻辑、样式文件
3. **Vue 3 Composition API**：使用最新的 Composition API
4. **组件通信**：支持 Props 和 Events 进行通信
5. **状态管理**：内置状态管理 hooks
6. **样式封装**：组件样式独立封装

---

## 开发指南

### 创建新组件

1. 在对应分类目录下创建组件文件夹
2. 创建 `index.html`、`index.js`、`index.css`
3. 添加组件文档到组件库文档
4. 更新主 README 中的组件列表

### 组件开发流程

1. 设计组件接口（Props、Events）
2. 编写组件模板（index.html）
3. 实现组件逻辑（index.js）
4. 添加组件样式（index.css）
5. 编写组件文档
6. 测试组件功能

---

## 🔗 相关文档

- **[项目文档](../README.md)** - 主项目文档
- **[架构设计](../架构设计.md)** - 项目架构文档
- **[开发规范](../开发规范/README.md)** - 开发规范文档

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- **Issue 追踪**：[提交 Issue](https://github.com/yourusername/your-repo/issues)

---

*最后更新：2026-03-18*
