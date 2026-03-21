# 渲染 Mermaid 图表

## 功能说明

支持 Mermaid 语法的图表渲染功能（流程图、时序图、甘特图等）。

## 功能分类

📊 增强功能

## 使用方法

使用三个反引号包裹 Mermaid 代码块发送：

```
​```mermaid
graph TD
    A[开始] --> B[处理]
    B --> C[结束]
​```
```

## 相关文件

- `modules/pet/content/petManager.mermaid.js`
- `modules/mermaid/page/load-mermaid.js`
- `modules/mermaid/page/render-mermaid.js`

## 支持的图表类型

- **流程图** (graph) - 横向/纵向流程图
- **时序图** (sequenceDiagram) - 序列交互图
- **类图** (classDiagram) - UML 类图
- **状态图** (stateDiagram) - 状态转换图
- **甘特图** (gantt) - 项目进度图
- **饼图** (pie) - 饼图
- **ER 图** (erDiagram) - 实体关系图

## 功能特点

- 实时渲染 Mermaid 代码
- 支持多种图表类型
- 图表可缩放查看
- 支持图表导出
