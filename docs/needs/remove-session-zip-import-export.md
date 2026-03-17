# 需求文档：移除会话管理的 ZIP 导入/导出功能

## 1. 需求概述

**功能名称**：移除会话管理的 ZIP 导入/导出功能

**需求类型**：功能移除

**优先级**：高

**背景**：当前应用支持将会话导出为 ZIP 文件和从 ZIP 文件导入会话的功能，但由于该功能存在以下问题，决定将其从应用中移除：

1. **功能重复**：应用提供了多种会话管理方式，但 ZIP 导入/导出功能使用频率较低
2. **代码复杂度**：该功能依赖外部库 JSZip，增加了应用的代码复杂度和维护负担
3. **性能问题**：处理 ZIP 文件需要额外的内存和计算资源，可能影响应用的响应速度
4. **用户体验**：导入/导出过程对用户不够直观，且与其他功能的交互不够流畅

## 2. 功能分析

### 当前功能实现

#### 2.1 文件结构
```
├── modules/session/page/export-sessions.js          # 会话导出为 ZIP 的核心实现
├── modules/session/page/import-sessions.js          # 从 ZIP 导入会话的核心实现
├── modules/session/page/load-jszip.js               # JSZip 库加载器
├── libs/jszip.min.js                                 # 依赖的 ZIP 处理库（266KB）
└── modules/pet/content/modules/petManager.io.js      # 导入/导出功能的入口
```

#### 2.2 功能特点
- **导出会话为 ZIP**：将所有会话或选中会话导出为 ZIP 文件
- **从 ZIP 导入会话**：支持从 ZIP 文件中导入会话数据
- **标签分类**：导出时会保留会话的标签分类结构
- **进度提示**：导入/导出过程中有相应的进度提示和错误处理

#### 2.3 功能流程
1. **导出流程**：
   - 点击"导出"按钮
   - 收集所有会话数据
   - 生成并下载 ZIP 文件

2. **导入流程**：
   - 点击"导入"按钮
   - 选择 ZIP 文件
   - 解析 ZIP 文件内容
   - 创建或更新会话数据

## 3. 移除范围

### 3.1 需要移除的文件

1. **`modules/session/page/export-sessions.js`** - 导出会话为 ZIP 的核心实现
2. **`modules/session/page/import-sessions.js`** - 从 ZIP 导入会话的核心实现
3. **`modules/session/page/load-jszip.js`** - JSZip 库加载器
4. **`libs/jszip.min.js`** - 依赖的 ZIP 处理库

### 3.2 需要修改的文件

1. **`manifest.json`** - 移除 web_accessible_resources 和 content_scripts 中的相关引用
2. **`modules/extension/background/services/injectionService.js`** - 移除注入脚本列表中的相关引用
3. **`modules/pet/content/core/petManager.core.js`** - 移除 jszip 相关属性
4. **`modules/pet/content/modules/petManager.io.js`** - 清空该文件，因为它只包含导入/导出功能
5. **`modules/pet/components/chat/ChatWindow/hooks/useMethods.js`** - 移除 UI 事件监听器和方法
6. **`modules/pet/components/chat/ChatWindow/index.js`** - 移除组件中的导入/导出按钮和功能
7. **`CLAUDE.md`** - 更新项目概述和技术栈，移除会话导入/导出功能描述
8. **`README.md`** - 更新功能特性和会话管理部分
9. **`docs/structure.md`** - 更新项目结构文档

## 4. 实施步骤

### 步骤 1：删除功能实现文件
```bash
rm -f modules/session/page/export-sessions.js
rm -f modules/session/page/import-sessions.js
rm -f modules/session/page/load-jszip.js
rm -f libs/jszip.min.js
```

### 步骤 2：更新 manifest.json
在 `manifest.json` 中：
- 移除 web_accessible_resources 中的相关引用
- 移除 content_scripts 中的相关引用

### 步骤 3：更新 injection service
在 `modules/extension/background/services/injectionService.js` 中：
- 移除注入脚本列表中的相关引用

### 步骤 4：修改 PetManager
在 `modules/pet/content/core/petManager.core.js` 中：
- 移除 jszip 相关属性

### 步骤 5：修改 chat window 组件
在 `modules/pet/components/chat/ChatWindow/` 中：
- 移除导入/导出按钮的事件监听器
- 移除相关的方法

### 步骤 6：更新文档
- 更新 `CLAUDE.md` - 移除功能描述和技术栈
- 更新 `README.md` - 更新功能特性和会话管理部分
- 更新 `docs/structure.md` - 更新项目结构文档

## 5. 影响分析

### 5.1 功能影响
- 移除后，用户将无法使用 ZIP 导入/导出功能
- 用户仍可使用其他会话管理功能（如会话标签、搜索等）
- 会话数据的存储和管理方式保持不变

### 5.2 性能影响
- 减少了对 JSZip 库的依赖，初始加载时间有所改善
- 移除了 ZIP 文件处理过程，节省了内存和 CPU 资源

### 5.3 兼容性影响
- 该功能是纯前端实现，移除后不影响与后端 API 的通信
- 对现有会话数据无影响
- 保持与 Chrome 浏览器的兼容性

## 6. 风险评估

### 6.1 低风险
- 功能使用频率较低，用户影响范围有限
- 代码改动集中，实施过程简单
- 有其他会话管理功能可供使用

### 6.2 风险缓解
- 在功能移除前，确保文档已更新
- 保持其他会话管理功能的稳定性
- 确保用户能够通过其他方式管理其会话数据

## 7. 验收标准

### 7.1 功能验证
- [x] 会话管理界面上的"导出"按钮已移除
- [x] 会话管理界面上的"导入"按钮已移除
- [x] 导出功能相关的代码已删除
- [x] 导入功能相关的代码已删除
- [x] 应用功能正常，无崩溃或错误

### 7.2 性能验证
- [x] 初始加载时间无明显增加
- [x] 内存使用情况良好
- [x] 聊天界面响应正常

### 7.3 文档验证
- [x] CLAUDE.md 中已移除导出功能的描述
- [x] README.md 中已更新会话管理部分
- [x] 项目结构文档已更新

## 8. 实施计划

### 8.1 时间安排
- **准备阶段**：30分钟（分析功能实现，编写需求文档）
- **开发阶段**：1小时（删除文件，修改代码）
- **测试阶段**：30分钟（功能验证，性能测试）
- **部署阶段**：15分钟（打包，更新）

### 8.2 负责人
- 前端开发：[开发人员姓名]

## 9. 总结

移除会话管理的 ZIP 导入/导出功能将简化应用架构，提高性能，并减少维护负担。虽然用户失去了一种导出方式，但其他会话管理功能仍然可用，能够满足用户的基本需求。
