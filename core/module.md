# 模块：core/config

## 基本信息
- **模块名**：core/config
- **职责**：全局配置与环境检测，提供 PET_CONFIG 全局变量
- **入口文件**：core/config.js
- **代码规模**：约 214 行

## 上游依赖
- 无（独立模块）

## 反向依赖
- modules/pet：使用 PET_CONFIG
- modules/chat：可能使用 PET_CONFIG
- modules/faq：可能使用 PET_CONFIG
- modules/screenshot：可能使用 PET_CONFIG
- modules/session：可能使用 PET_CONFIG
- core/utils：可能使用 PET_CONFIG
- core/api：可能使用 PET_CONFIG
- core/bootstrap：使用 PET_CONFIG
- modules/extension/background：使用 PET_CONFIG

## 导出接口
- `window.PET_CONFIG`：全局配置对象，包含 API、默认宠物角色等常量
