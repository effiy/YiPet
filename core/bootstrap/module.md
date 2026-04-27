# 模块：core/bootstrap

## 基本信息
- **模块名**：core/bootstrap
- **职责**：Content Script 入口与初始化，负责 PetManager 单例创建
- **入口文件**：core/bootstrap/index.js
- **代码规模**：约 200 行

## 上游依赖
- core/config：PET_CONFIG
- core/utils：StorageHelper、ErrorHandler
- modules/pet：PetManager 类

## 反向依赖
- manifest.json：作为 content_scripts 入口加载

## 导出接口
- `window.bootstrap`：引导初始化函数
- `window.petManager`：PetManager 单例实例（创建后）
