# 规格文档：移除会话管理的 ZIP 导入/导出功能

## 1. 规格概述

**文档类型**：功能重构规格

**功能名称**：移除会话管理的 ZIP 导入/导出功能

**重构目标**：
- 简化应用架构
- 减少代码复杂度
- 提高应用性能
- 改善用户体验

## 2. 重构范围

### 2.1 文件变更

#### 2.1.1 删除的文件
| 文件路径 | 功能描述 | 行数 | 文件大小 |
|----------|----------|------|----------|
| `modules/session/page/export-sessions.js` | 导出会话为 ZIP 文件的核心实现 | 122 | ~4KB |
| `modules/session/page/import-sessions.js` | 从 ZIP 文件导入会话的核心实现 | 147 | ~5KB |
| `modules/session/page/load-jszip.js` | JSZip 库的动态加载器 | 69 | ~2KB |
| `libs/jszip.min.js` | 依赖的 ZIP 文件处理库 | - | 266KB |

#### 2.1.2 修改的文件
| 文件路径 | 修改内容 |
|----------|----------|
| `manifest.json` | 移除 content_scripts 和 web_accessible_resources 中的引用 |
| `modules/extension/background/services/injectionService.js` | 移除注入脚本列表中的引用 |
| `modules/pet/content/core/petManager.core.js` | 移除 jszip 相关属性 |
| `modules/pet/content/modules/petManager.io.js` | 清空文件内容，该文件只包含导入/导出功能 |
| `modules/pet/components/chat/ChatWindow/hooks/useMethods.js` | 移除 UI 事件监听器 |
| `modules/pet/components/chat/ChatWindow/index.js` | 移除组件方法 |
| `CLAUDE.md` | 更新项目概述和技术栈 |
| `README.md` | 更新功能特性和会话管理部分 |
| `docs/架构设计.md` | 更新项目结构文档 |

## 3. 技术规格

### 3.1 代码变更细节

#### 3.1.1 删除的方法
- `window.PetManager.prototype.exportSessionsToZip` - 导出会话为 ZIP 文件
- `window.PetManager.prototype.importSessionsFromZip` - 从 ZIP 文件导入会话
- `window.PetManager.prototype._loadJSZip` - JSZip 库加载方法

#### 3.1.2 删除的属性
- `window.PetManager.prototype.jszipLoaded` - JSZip 库加载状态标志
- `window.PetManager.prototype.jszipLoading` - JSZip 库加载中状态标志

#### 3.1.3 删除的事件
- `jszip-loaded` - JSZip 库加载完成事件
- `jszip-error` - JSZip 库加载失败事件
- `jszip-export-success` - 会话导出成功事件
- `jszip-export-error` - 会话导出失败事件
- `jszip-import-success` - 会话导入成功事件
- `jszip-import-error` - 会话导入失败事件

### 3.2 代码修改示例

#### 3.2.1 从 manifest.json 中移除引用
```diff
--- a/manifest.json
+++ b/manifest.json
@@ -124,11 +124,7 @@
         "libs/mermaid.min.js",
         "modules/mermaid/page/load-mermaid.js",
         "modules/mermaid/page/render-mermaid.js",
         "modules/mermaid/page/preview-mermaid.js",
-        "libs/jszip.min.js",
-        "modules/session/page/load-jszip.js",
-        "modules/session/page/export-sessions.js",
-        "modules/session/page/import-sessions.js",
         "modules/pet/components/chat/ChatWindow/index.html",
```

#### 3.2.2 从 injection service 中移除引用
```diff
--- a/modules/extension/background/services/injectionService.js
+++ b/modules/extension/background/services/injectionService.js
@@ -45,11 +45,7 @@ class InjectionService {
     'modules/pet/content/modules/petManager.editor.js',
     'modules/pet/content/modules/petManager.mermaid.js',
     'modules/pet/components/manager/SessionTagManager/index.js',
     'modules/pet/content/modules/petManager.tags.js',
     'modules/pet/content/modules/petManager.parser.js',
-    'modules/pet/content/modules/petManager.io.js',
```

#### 3.2.3 从 PetManager 中移除属性
```diff
--- a/modules/pet/content/core/petManager.core.js
+++ b/modules/pet/content/core/petManager.core.js
@@ -32,8 +32,6 @@ class PetManager extends LoadingAnimationMixin {
         this.colors = PET_CONFIG.pet.colors
         this.mermaidLoaded = false
         this.mermaidLoading = false
-        this.jszipLoaded = false
-        this.jszipLoading = false

         // 会话管理相关属性
         this.currentSessionId = null
```

## 4. 用户界面变更

### 4.1 会话管理界面
- 删除了会话管理侧边栏的"导出"按钮
- 删除了会话管理侧边栏的"导入"按钮

### 4.2 聊天窗口
- 删除了聊天窗口顶部的"导出"和"导入"按钮
- 删除了相关的快捷键支持

## 5. 功能替代方案

### 5.1 会话管理替代方案
- **会话标签**：使用标签对会话进行分类和管理
- **搜索功能**：使用搜索功能快速找到需要的会话
- **会话删除**：可以删除不需要的会话

### 5.2 数据备份替代方案
虽然移除了 ZIP 导入/导出功能，但用户可以通过其他方式备份和恢复数据：

- **Chrome 同步**：使用 Chrome 的同步功能，在不同设备之间同步会话数据
- **本地存储导出**：使用 Chrome 开发者工具直接导出本地存储数据
- **手动备份**：定期备份浏览器的本地存储数据

## 6. 性能改进

### 6.1 加载时间
- **首次加载**：减少了对 JSZip 库的加载需求，首次加载时间缩短
- **内存使用**：不再需要加载 JSZip 库，减少了内存占用

### 6.2 运行时性能
- **初始化**：移除了 JSZip 库的初始化过程
- **操作响应**：避免了 ZIP 文件处理过程对其他操作的影响

### 6.3 资源消耗
- **CPU 消耗**：不再执行 ZIP 文件压缩和解压缩操作
- **网络请求**：没有额外的网络请求，所有功能都在本地执行

## 7. 兼容性考虑

### 7.1 浏览器兼容性
- 保持与 Chrome 浏览器的兼容性
- 不影响其他浏览器的兼容性

### 7.2 数据兼容性
- 保持对现有会话数据的兼容性
- 会话数据的存储格式保持不变
- 现有的会话数据可以继续正常使用

### 7.3 功能兼容性
- 其他会话管理功能保持不变
- 与其他功能的交互方式保持一致

## 8. 验证标准

### 8.1 功能验证
- [x] 导出按钮已从 UI 中移除
- [x] 导入按钮已从 UI 中移除
- [x] 所有相关代码已删除
- [x] 应用功能正常，无崩溃或错误

### 8.2 性能验证
- [x] 首次加载时间缩短
- [x] 内存使用减少
- [x] 操作响应更及时

### 8.3 文档验证
- [x] 项目概述和技术栈已更新
- [x] 功能特性和会话管理部分已更新
- [x] 项目结构文档已更新

### 8.4 用户体验验证
- [x] UI 更简洁直观
- [x] 操作流程更简单
- [x] 响应更及时
