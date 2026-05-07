# YiPet Design System

> 基线文档，rui init 生成 | 2026-05-07

## 设计语言

**温柔、陪伴、亲和**。浏览器虚拟宠物伴侣，视觉风格以柔和圆润为主，营造温暖陪伴感。

## Design Tokens

### 颜色
- 宠物主题色: 暖橙 (#FF9800) / 柔粉 (#FF7EB3)
- 聊天面板: 半透明白底 + 模糊背景
- 气泡: 用户蓝色，AI 灰色
- 角色配色: 教师蓝 / 医生绿 / 甜品师粉 / 警察深蓝

### 间距
- Tailwind spacing scale (4px 基础)
- 聊天面板: p-4 (16px)
- 宠物图标: 48×48px

### 圆角
- 聊天面板: rounded-2xl (16px)
- 气泡: rounded-lg (8px)
- 按钮: rounded-full (胶囊形)

### 字体
- 系统默认字体
- 聊天消息: 14px
- 宠物对话: 13px

## 组件

| 组件 | 路径 | 说明 |
|------|------|------|
| PetManager | `modules/pet/content/` | 宠物核心（渲染/拖拽/动画） |
| ChatPanel | `modules/pet/content/petManager.ui.js` | 聊天面板 UI |
| ChatBubble | `modules/pet/content/petManager.message.js` | 消息气泡 |
| RoleSelector | `modules/pet/content/` | 角色切换 |
| Popup | `modules/extension/popup/` | 扩展 Popup |
| FAQ Manager | `modules/faq/content/` | FAQ 管理面板 |

## 页面模板

**Content Script 注入布局**:
```
[网页内容]
    └── [宠物图标 右下固定] → 点击展开
        └── [聊天面板 右侧滑入: 320×480px]
            ├── [角色选择器]
            ├── [消息列表]
            └── [输入框]
```

## 交互

- 宠物拖拽: 按住拖动到页面任意位置
- 面板展开: 点击宠物 → 从右侧滑入
- 角色切换: 点击头像 → 淡入淡出过渡
- 消息发送: Enter 发送
- 快捷键: Ctrl+Shift+P (显隐), Ctrl+Shift+X (聊天)

## 无障碍 (a11y)

- 宠物元素 aria-label="虚拟宠物伴侣"
- 聊天面板 role="dialog"
- 快捷键操作支持

## 响应式

- 宠物: 固定 48px，不受页面缩放影响
- 聊天面板: 宽度自适应（min 320px, max 420px）
- 移动端: 面板占 80vw

## 图标

- Emoji 作为角色头像（👩‍🏫 👨‍⚕️ 👩‍🍳 👮）
- 自定义 SVG 宠物形象
- 操作图标: Unicode 符号
