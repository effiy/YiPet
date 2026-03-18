# FAQ 系统

> 保存常用问题和答案，快速检索和复用

---

## 功能概述

FAQ 系统帮助用户保存、管理和快速检索常用问题和答案，提高工作效率。

---

## 主要特性

### 1. FAQ 管理
- 添加新的 FAQ 条目
- 编辑现有 FAQ
- 删除不需要的 FAQ

### 2. 标签分类
- 为 FAQ 添加标签
- 创建和管理标签
- 按标签筛选 FAQ

### 3. 快速检索
- 搜索 FAQ 内容
- 快速插入到聊天
- 收藏常用 FAQ

### 4. 批量操作
- 批量导入 FAQ
- 批量导出 FAQ
- 批量删除 FAQ

---

## 使用说明

### 添加 FAQ
1. 打开 FAQ 管理器
2. 点击"添加 FAQ"按钮
3. 输入问题和答案
4. 可选：添加标签
5. 点击保存

### 使用 FAQ
1. 在聊天窗口点击 FAQ 按钮
2. 搜索或浏览 FAQ 列表
3. 点击 FAQ 条目
4. 自动插入到聊天输入框

### 管理标签
1. 打开 FAQ 标签管理器
2. 创建新标签或编辑现有标签
3. 为标签设置颜色和图标
4. 保存标签设置

---

## 技术实现

### 相关文件
- `modules/faq/content/faq.js` - FAQ 管理主逻辑
- `modules/faq/content/tags.js` - FAQ 标签管理
- `modules/pet/components/manager/FaqManager/` - FAQ 管理器组件
- `modules/pet/components/manager/FaqTagManager/` - FAQ 标签管理器组件
- `core/api/services/FaqService.js` - FAQ API 服务

### 数据结构
```javascript
{
  id: 'faq-id',
  question: '问题内容',
  answer: '答案内容',
  tags: ['标签1', '标签2'],
  isFavorite: false,
  usageCount: 0,
  createdAt: Date.now(),
  updatedAt: Date.now()
}
```

### 存储位置
- 本地存储：Chrome `storage.local` 中的 `petFaqs` 键
- 云端同步：通过 API 服务同步（如果配置）

---

## 高级功能

### FAQ 智能推荐
- 根据当前对话内容推荐相关 FAQ
- 基于使用频率排序
- 支持自定义推荐规则

### FAQ 模板
- 预定义常用 FAQ 模板
- 支持自定义模板
- 一键导入模板

### FAQ 统计
- 使用次数统计
- 常用 FAQ 排行
- 使用趋势分析

---

*最后更新：2026-03-18*
