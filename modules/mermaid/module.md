# 模块：mermaid

## 基本信息
- **模块名**：mermaid
- **职责**：Mermaid 图表渲染功能
- **入口文件**：modules/mermaid/page/load-mermaid.js
- **代码规模**：约 100 行

## 上游依赖
- modules/pet：使用 PetManager 上下文
- libs/mermaid.min.js：Mermaid 库
- core/utils：可能使用工具函数

## 反向依赖
- modules/pet：通过 PetManager 渲染 Mermaid 图表
- manifest.json：web_accessible_resources 包含 mermaid 页面

## 导出接口
- `window.PetManager.Mermaid`：Mermaid 图表渲染功能
