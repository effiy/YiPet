# FaqManager 组件

> FAQ 管理器组件，管理常见问题和答案

---

## 📋 组件概述

FaqManager 组件提供 FAQ 条目管理功能，包括添加、编辑、删除和搜索 FAQ。

---

## 🏗️ 文件结构

```
modules/pet/components/manager/FaqManager/
├── index.html                 # 组件 HTML 模板
└── index.js                   # Vue 应用逻辑
```

---

## 🔧 主要功能

### 1. FAQ 管理
- 添加新的 FAQ 条目
- 编辑现有 FAQ
- 删除不需要的 FAQ
- 批量导入导出

### 2. 标签管理
- 为 FAQ 添加标签
- 标签筛选
- 标签分类

### 3. 搜索和筛选
- 关键词搜索
- 按标签筛选
- 按使用频率排序

---

## 📚 相关文件

- `ChatWindow` - 父组件
- `FaqTagManager` - 标签管理器
- `modules/faq/content/faq.js` - FAQ 管理逻辑

---

*最后更新：2026-03-18*
