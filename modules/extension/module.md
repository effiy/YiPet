# 模块：extension

## 基本信息
- **模块名**：extension
- **职责**：扩展系统（background/popup），包含后台服务、消息路由、弹出页面等
- **入口文件**：modules/extension/background/index.js
- **代码规模**：约 1300 行（background + popup）

## 上游依赖
- core/config：PET_CONFIG
- core/utils：ErrorHandler、LoggerUtils
- libs：可能使用第三方库

## 反向依赖
- manifest.json：background.service_worker、action.default_popup 指向该模块
- modules/pet：通过消息路由与 background 通信

## 子模块清单
| 子模块 | 路径 | 职责 |
|-------|------|------|
| background | modules/extension/background/ | 后台服务 Worker |
| popup | modules/extension/popup/ | 扩展弹出页面 |
| messaging | modules/extension/background/messaging/ | 消息路由（提升为同级） |
