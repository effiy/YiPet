# AiSettingsModal 组件

> AI 设置弹窗组件，配置 AI 模型和参数

---

## 📋 组件概述

AiSettingsModal 组件提供 AI 相关设置的配置界面，包括模型选择、API 配置和对话参数调整。

---

## 🏗️ 文件结构

```
modules/pet/components/modal/AiSettingsModal/
├── index.html                 # 组件 HTML 模板
└── index.js                   # Vue 应用逻辑
```

---

## 🔧 主要功能

### 1. 模型配置
- AI 模型选择
- 模型参数设置
- API 端点配置
- API 版本选择

### 2. 对话参数
- 温度参数（Temperature）
- 最大令牌数（Max Tokens）
- 系统提示词
- 回复格式设置

### 3. 高级设置
- 重试机制配置
- 超时设置
- 代理服务器配置

---

## 📚 相关文件

- `ChatWindow` - 父组件
- `TokenSettingsModal` - 令牌设置组件
- `core/config.js` - 配置文件

---

*最后更新：2026-03-18*
