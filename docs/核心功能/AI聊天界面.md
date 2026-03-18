# AI 聊天界面

> 流式响应的 AI 对话体验

---

## 功能概述

AI 聊天界面提供了与虚拟宠物进行智能对话的功能，支持 Markdown 渲染、代码高亮和流式响应。

---

## 主要特性

### 1. 聊天界面
- 美观的聊天窗口设计
- 支持全屏和窗口模式
- 自适应不同屏幕尺寸

### 2. 流式响应
- AI 响应实时流式显示
- 打字机效果增强用户体验
- 支持中途停止生成

### 3. Markdown 渲染
- 支持 Markdown 语法
- 代码高亮显示
- 支持表格、列表、链接等

### 4. 消息管理
- 支持发送文本消息
- 支持发送图片消息
- 消息历史记录

---

## 使用说明

### 打开/关闭聊天窗口
- **方式一**：双击宠物图标
- **方式二**：使用快捷键 `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`)

### 发送消息
1. 在输入框中输入文字
2. 点击发送按钮或按 Enter 键
3. 等待 AI 响应

### 插入截图
- 点击输入框旁的截图按钮
- 选择截图区域
- 自动将截图插入到输入框

---

## 技术实现

### 相关文件
- `modules/pet/components/chat/ChatWindow/` - 主聊天窗口组件
- `modules/pet/content/petManager.ai.js` - AI 对话功能实现
- `modules/pet/content/petManager.parser.js` - 消息解析和渲染
- `core/api/` - API 请求管理

### 技术特性
- 流式响应处理
- Markdown 渲染（使用 marked 库）
- 代码高亮（使用 highlight.js）
- 消息发送和接收管理

### 消息格式
```javascript
{
  id: 'unique-message-id',
  type: 'text' | 'image' | 'system',
  content: '消息内容',
  sender: 'user' | 'ai',
  timestamp: Date.now(),
  status: 'sending' | 'sent' | 'error'
}
```

---

## 配置选项

### AI 模型配置
在 `petSettings` 中配置：
```javascript
{
  aiModel: 'gpt-4',
  aiTemperature: 0.7,
  maxTokens: 2000
}
```

### 聊天设置
- 自动保存聊天记录
- 消息通知设置
- 聊天窗口位置记忆

---

*最后更新：2026-03-18*
