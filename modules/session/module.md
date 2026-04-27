# 模块：session

## 基本信息
- **模块名**：session
- **职责**：会话导入导出功能，支持 ZIP 格式
- **入口文件**：modules/session/page/load-jszip.js
- **代码规模**：约 200 行

## 上游依赖
- modules/pet：使用 PetManager 上下文
- libs/jszip.min.js：ZIP 库
- core/api：SessionService
- core/utils：可能使用工具函数

## 反向依赖
- modules/pet：通过 PetManager 进行会话导入导出
- manifest.json：web_accessible_resources 包含会话页面

## 导出接口
- `window.PetManager.SessionExport`：会话导出功能
- `window.PetManager.SessionImport`：会话导入功能
