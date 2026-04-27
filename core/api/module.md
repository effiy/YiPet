# 模块：core/api

## 基本信息
- **模块名**：core/api
- **职责**：API 请求管理与服务封装
- **入口文件**：core/api/core/ApiManager.js
- **代码规模**：约 800 行

## 上游依赖
- core/config：PET_CONFIG
- core/utils：ErrorHandler、LoggerUtils

## 反向依赖
- modules/pet：使用 ApiManager、SessionService、FaqService
- modules/faq：使用 FaqService
- modules/session：使用 SessionService

## 导出接口
- `window.PetManager.ApiManager`：API 管理器
- `window.PetManager.SessionService`：会话服务
- `window.PetManager.FaqService`：FAQ 服务
