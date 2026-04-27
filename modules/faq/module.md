# 模块：faq

## 基本信息
- **模块名**：faq
- **职责**：FAQ 管理与标签功能
- **入口文件**：modules/faq/content/faq.js
- **代码规模**：约 300 行

## 上游依赖
- modules/pet：使用 PetManager 上下文
- core/api：FaqService
- core/utils：可能使用工具函数

## 反向依赖
- modules/pet：通过 PetManager.prototype 挂载 FAQ 方法
- manifest.json：加载 FAQ 相关 content_scripts

## 导出接口
- `window.PetManager.Faq`：FAQ 管理功能
- `window.PetManager.FaqTags`：FAQ 标签管理功能
