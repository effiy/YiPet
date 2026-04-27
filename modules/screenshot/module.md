# 模块：screenshot

## 基本信息
- **模块名**：screenshot
- **职责**：区域截图功能，允许用户截取页面区域
- **入口文件**：modules/screenshot/content/petManager.screenshot.js
- **代码规模**：约 200 行

## 上游依赖
- modules/pet：使用 PetManager 上下文
- libs/html2canvas.min.js：截图库
- core/utils：可能使用工具函数

## 反向依赖
- modules/pet：通过 PetManager.prototype 挂载截图方法

## 导出接口
- `window.PetManager.Screenshot`：截图功能
