# 实施计划：移除会话管理的 ZIP 导入/导出功能

## 1. 计划概述

**计划名称**：移除会话管理的 ZIP 导入/导出功能

**计划类型**：功能重构

**预计时间**：1.5 小时

**负责人**：[开发人员姓名]

**风险评估**：低风险

## 2. 现状分析

### 2.1 功能概述
当前应用支持将会话导出为 ZIP 文件和从 ZIP 文件导入会话的功能，包含以下特点：
- 导出所有会话或选中会话为 ZIP 文件
- 从 ZIP 文件中导入会话数据
- 保留会话的标签分类结构
- 使用 JSZip 库进行 ZIP 文件处理

### 2.2 文件结构
```
├── modules/session/page/export-sessions.js    # 导出会话功能 (122 行)
├── modules/session/page/import-sessions.js    # 导入会话功能 (147 行)
├── modules/session/page/load-jszip.js          # JSZip 加载器 (69 行)
├── libs/jszip.min.js                            # 依赖库 (266KB)
└── modules/pet/content/modules/petManager.io.js # 导入/导出入口 (545 行)
```

### 2.3 引用位置
- `manifest.json` - 在 content_scripts 和 web_accessible_resources 中引用
- `modules/extension/background/services/injectionService.js` - 在注入脚本列表中引用
- `modules/pet/content/core/petManager.core.js` - 有 jszip 相关属性
- `modules/pet/components/chat/ChatWindow/hooks/useMethods.js` - 有 UI 事件监听器
- `modules/pet/components/chat/ChatWindow/index.js` - 有组件方法
- `CLAUDE.md` - 文档描述
- `README.md` - 功能描述
- `docs/structure.md` - 项目结构说明

## 3. 实施计划

### 阶段 1：准备工作（15 分钟）

#### 3.1.1 环境检查
- [x] 确保当前工作区没有未提交的更改
- [x] 确认需求文档已创建并理解需求
- [x] 检查所有相关文件的当前状态

### 阶段 2：核心代码修改（45 分钟）

#### 3.2.1 删除功能实现文件
```bash
rm -f modules/session/page/export-sessions.js
rm -f modules/session/page/import-sessions.js
rm -f modules/session/page/load-jszip.js
rm -f libs/jszip.min.js
```

#### 3.2.2 修改 manifest.json
**文件位置**：`/Users/yi/Yi/YiPet/manifest.json`

**修改内容**：
1. 移除 web_accessible_resources 中的相关引用
2. 移除 content_scripts 中的相关引用

#### 3.2.3 修改 injectionService.js
**文件位置**：`/Users/yi/Yi/YiPet/modules/extension/background/services/injectionService.js`

**修改内容**：
- 移除 CONTENT_SCRIPT_FILES 数组中的相关引用

#### 3.2.4 修改 petManager.core.js
**文件位置**：`/Users/yi/Yi/YiPet/modules/pet/content/core/petManager.core.js`

**修改内容**：
- 移除 `this.jszipLoaded` 和 `this.jszipLoading` 属性

#### 3.2.5 清空 petManager.io.js
**文件位置**：`/Users/yi/Yi/YiPet/modules/pet/content/modules/petManager.io.js`

**修改内容**：
- 清空文件内容（该文件只包含导入/导出功能）

#### 3.2.6 修改 ChatWindow 组件
**文件位置**：
- `/Users/yi/Yi/YiPet/modules/pet/components/chat/ChatWindow/hooks/useMethods.js`
- `/Users/yi/Yi/YiPet/modules/pet/components/chat/ChatWindow/index.js`

**修改内容**：
- 移除 onExportClick 和 onImportClick 方法
- 移除相关的事件监听器

### 阶段 3：文档更新（30 分钟）

#### 3.3.1 更新 CLAUDE.md
**文件位置**：`/Users/yi/Yi/YiPet/CLAUDE.md`

**修改内容**：
1. 在"功能特性"部分移除"Session management with import/export (ZIP format)"
2. 在"技术栈"部分移除 JSZip 库的说明

#### 3.3.2 更新 README.md
**文件位置**：`/Users/yi/Yi/YiPet/README.md`

**修改内容**：
1. 在"功能特性"部分移除 ZIP 导入/导出功能描述
2. 在"会话管理"部分移除相关说明

#### 3.3.3 更新 docs/structure.md
**文件位置**：`/Users/yi/Yi/YiPet/docs/structure.md`

**修改内容**：
1. 移除对 jszip.min.js 的描述
2. 移除对 export-sessions.js、import-sessions.js、load-jszip.js 的描述
3. 将 petManager.io.js 标记为已弃用

## 4. 验证清单

### 4.1 功能验证
- [x] 会话管理界面上的"导出"按钮已移除
- [x] 会话管理界面上的"导入"按钮已移除
- [x] 导出功能相关的代码已删除
- [x] 导入功能相关的代码已删除
- [x] 应用功能正常，无崩溃或错误

### 4.2 文件验证
- [x] export-sessions.js 已删除
- [x] import-sessions.js 已删除
- [x] load-jszip.js 已删除
- [x] jszip.min.js 已删除
- [x] manifest.json 已更新
- [x] injectionService.js 已更新
- [x] petManager.core.js 已更新
- [x] petManager.io.js 已清空
- [x] ChatWindow 组件已更新

### 4.3 文档验证
- [x] CLAUDE.md 已更新
- [x] README.md 已更新
- [x] docs/structure.md 已更新

## 5. 实施步骤总结

1. 删除 4 个功能实现文件
2. 修改 3 个核心代码文件
3. 更新 3 个文档文件
4. 验证所有修改

## 6. 时间估计

| 阶段 | 预计时间 | 实际时间 |
|------|----------|----------|
| 准备工作 | 15 分钟 | - |
| 核心代码修改 | 45 分钟 | - |
| 文档更新 | 30 分钟 | - |
| 验证测试 | 15 分钟 | - |
| **总计** | **1.5 小时** | - |

## 7. 风险缓解

- **风险**：可能遗漏某些引用
  - **缓解**：使用 grep 进行全面搜索，确保所有相关引用都已找到并处理

- **风险**：修改后可能导致其他功能受影响
  - **缓解**：在修改后进行全面的功能测试，确保其他功能正常

- **风险**：用户可能依赖该功能
  - **缓解**：确保其他会话管理功能正常可用，满足用户的基本需求
