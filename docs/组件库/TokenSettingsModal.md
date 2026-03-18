# TokenSettingsModal 组件

> API 令牌设置弹窗组件，配置 API 访问令牌

---

## 📋 组件概述

TokenSettingsModal 组件负责管理 API 访问令牌，提供令牌输入、验证和保存功能。

---

## 🏗️ 文件结构

```
modules/pet/components/modal/TokenSettingsModal/
├── index.html                 # 组件 HTML 模板
└── index.js                   # Vue 应用逻辑
```

---

## 🔧 主要功能

### 1. 令牌输入
- API 令牌输入框
- 输入框验证
- 密码显示/隐藏切换

### 2. 验证功能
- 令牌格式验证
- 令牌有效性检测
- 网络连接测试

### 3. 保存和管理
- 令牌保存到 Chrome 存储
- 令牌加密存储
- 令牌过期检查

---

## 📚 相关文件

- `ChatWindow` - 父组件
- `AiSettingsModal` - AI 设置组件
- `petManager.auth.js` - 认证模块

---

*最后更新：2026-03-18*
