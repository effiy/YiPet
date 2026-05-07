# YiPet Design System

> 基线文档，rui init 生成 | 2026-05-07

## 设计语言

**温柔、陪伴、亲和**。浏览器扩展伴侣，视觉风格温暖柔和，强调陪伴感和易用性。

## Design Tokens

### 颜色
- 主色: 粉紫渐变（#f0abfc → #c084fc），用于宠物和主交互
- 背景: 纯白 `#ffffff` 或跟随页面
- 文字: 深灰 `#1f2937` primary, 中灰 `#6b7280` secondary
- 强调: 粉红 `#ec4899` accent
- Tailwind 类名统一管理

### 间距
- 基础单位: 4px（Tailwind spacing scale）
- 组件内边距: p-2 / p-3 / p-4
- 卡片间距: gap-2 / gap-4

### 圆角
- 宠物气泡: rounded-2xl
- 卡片: rounded-xl
- 按钮: rounded-lg
- 输入框: rounded-lg

### 字体
- 系统字体栈: system-ui, -apple-system, sans-serif
- 字号: text-xs(辅助) / text-sm(正文) / text-base(标题)

## 组件

| 组件 | 位置 | 说明 |
|------|------|------|
| PetAvatar | `modules/pet/` | 宠物形象展示与拖拽 |
| ChatBubble | `modules/pet/` | 聊天气泡（用户/AI） |
| RoleSelector | `modules/pet/` | 4 角色切换面板 |
| SessionPanel | `modules/pet/` | 会话与 FAQ 管理 |
| MermaidRenderer | `modules/mermaid/` | Mermaid 图表渲染 |
| ScreenshotCapture | `modules/screenshot/` | 区域截图工具 |
| ExportPanel | `modules/chat/` | 聊天导出（图片/文本） |

## 页面模板

**浮动宠物模式**:
```
┌──────────────────────────┐
│       网页内容           │
│                          │
│   ┌──────────────┐      │
│   │  宠物气泡     │      │
│   │  [头像]       │      │
│   └──────────────┘      │
└──────────────────────────┘
```

**弹出面板模式** (popup):
```
┌────────────────┐
│ 会话列表        │
│ 角色切换 [1][2] │
│ 聊天区域        │
│ 输入框 [发送]   │
└────────────────┘
```

## 交互

- 宠物拖拽: 鼠标拖拽移动位置，双指缩放（触屏）
- 聊天气泡: 流式逐字渲染，自动滚动
- 角色切换: 点击角色卡片即时切换，动画过渡
- 截图: 点击后进入选区模式，拖拽选取区域
- 右键菜单: 集成到浏览器原生右键

## 无障碍 (a11y)

- 所有可交互元素支持键盘导航
- 宠物区域 role="application" aria-label
- 动态内容更新使用 aria-live="polite"

## 响应式

- 自适应浏览器窗口大小
- 宠物栏: 浮动模式适应任何页面布局
- 弹出面板: 固定宽度 380px，高度自适应

## 图标

- Tailwind 内联 SVG 为主
- 少量 Unicode 符号装饰
