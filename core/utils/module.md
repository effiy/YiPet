# 模块：core/utils

## 基本信息
- **模块名**：core/utils
- **职责**：通用工具函数集，包含 API、DOM、错误处理、日志、媒体、存储、时间、UI 等工具
- **入口文件**：core/utils/index.js
- **代码规模**：约 1500 行

## 上游依赖
- core/config：PET_CONFIG

## 反向依赖
- modules/pet：使用 StorageHelper、ErrorHandler、LoggerUtils、LoadingAnimationMixin、ImageResourceManager 等
- modules/chat：可能使用工具函数
- modules/faq：可能使用工具函数
- modules/screenshot：可能使用工具函数
- modules/session：可能使用工具函数
- modules/extension/background：可能使用工具函数
- core/api：可能使用工具函数
- core/bootstrap：使用 StorageHelper

## 导出接口
- `window.StorageHelper`：存储辅助工具
- `window.ErrorHandler`：错误处理工具
- `window.LoggerUtils`：日志工具
- `window.ImageResourceManager`：图片资源管理
- `window.DomHelper`：DOM 操作工具
- `window.SessionManager`：会话管理工具
- `window.LoadingAnimationMixin`：加载动画混入
- `window.NotificationUtils`：通知工具
- `window.TimeUtils`：时间工具
