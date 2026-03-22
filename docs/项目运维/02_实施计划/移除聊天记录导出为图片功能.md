# 实现计划：移除聊天记录导出为图片功能

## 1. 计划概述

**计划名称**：移除聊天记录导出为图片功能

**计划类型**：功能重构

**预计时间**：2.5 小时

**负责人**：[开发人员姓名]

**风险评估**：低风险

## 2. 现状分析

### 2.1 功能概述
当前应用支持将聊天记录导出为高清 PNG 图片的功能，包含以下特点：
- 导出整个聊天会话为 PNG 图片
- 导出单条消息为 PNG 图片
- 使用 2x 缩放生成高清图片（1500px 宽度）
- 使用 html2canvas 库进行 DOM 转图片处理

### 2.2 文件结构
```
├── modules/chat/content/export-chat-to-png.js    # 核心实现 (483 行)
├── libs/html2canvas.min.js                        # 依赖库 (340KB)
└── modules/pet/content/core/petManager.core.js    # 按钮添加方法
```

### 2.3 引用位置
- `manifest.json` - 在 content_scripts 和 web_accessible_resources 中引用
- `CLAUDE.md` - 文档描述
- `架构设计.md` - 项目结构说明

## 3. 实施计划

### 阶段 1：准备工作（15 分钟）

#### 3.1.1 环境检查
- [ ] 确保当前工作区没有未提交的更改
- [ ] 确认需求文档已创建并理解需求
- [ ] 检查所有相关文件的当前状态

#### 3.1.2 备份
- [ ] 对即将修改的文件进行备份（可选）

### 阶段 2：核心代码修改（1 小时）

#### 3.2.1 删除功能实现文件
```bash
rm -f modules/chat/content/export-chat-to-png.js
rm -f libs/html2canvas.min.js
```

#### 3.2.2 修改 manifest.json
**文件位置**：`/Users/yi/Yi/YiPet/manifest.json`

**修改内容**：
```diff
--- a/manifest.json
+++ b/manifest.json
@@ -32,8 +32,6 @@
         "libs/marked.min.js",
         "libs/turndown.js",
         "libs/vue.global.js",
-        "libs/html2canvas.min.js",
-        "modules/chat/content/export-chat-to-png.js",
         "core/utils/logging/loggerUtils.js",
         "core/utils/error/errorHandler.js",
         "core/utils/dom/domHelper.js",
```

#### 3.2.3 修改 petManager.core.js
**文件位置**：`/Users/yi/Yi/YiPet/modules/pet/content/core/petManager.core.js`

**修改内容**：
1. 删除 `addExportButtonForMessage` 方法（第 791-833 行）
2. 找到 `addActionButtonsToMessage` 方法中对该方法的调用并删除

#### 3.2.4 修改 ChatWindow 组件
**文件位置**：`/Users/yi/Yi/YiPet/modules/pet/components/chat/ChatWindow/index.js`

**检查内容**：
- 检查是否有对 `export-chat-to-png.js` 的导入
- 检查是否有导出功能相关的调用

### 阶段 3：文档更新（30 分钟）

#### 3.3.1 更新 CLAUDE.md
**文件位置**：`/Users/yi/Yi/YiPet/CLAUDE.md`

**修改内容**：
1. 在"功能特性"部分移除"导出聊天记录为图片"
2. 在"技术栈"部分移除 html2canvas 库的说明
3. 在"开发任务"部分移除与导出功能相关的任务

#### 3.3.2 更新 架构设计.md
**文件位置**：`/Users/yi/Yi/YiPet/docs/架构设计.md`

**修改内容**：
1. 移除 `export-chat-to-png.js` 文件的描述
2. 移除 html2canvas 库的引用

### 阶段 4：验证与测试（45 分钟）

#### 3.4.1 编译检查
- [ ] 检查是否有语法错误
- [ ] 确认所有引用已正确更新

#### 3.4.2 功能测试
**测试步骤**：
1. 加载扩展到 Chrome 浏览器
2. 打开聊天窗口
3. 验证每条消息上没有"导出消息为图片"按钮
4. 验证聊天功能正常
5. 验证会话导入/导出功能正常
6. 验证截图功能正常
7. 验证复制功能正常

**预期结果**：
- 所有消息上的导出按钮已移除
- 聊天功能正常工作
- 会话导入/导出功能正常
- 截图功能正常
- 复制功能正常
- 应用无崩溃或错误

#### 3.4.3 性能验证
- [ ] 检查内存使用情况是否改善
- [ ] 检查初始加载时间是否缩短
- [ ] 确认没有遗留代码导致的性能问题

### 阶段 5：清理与提交（15 分钟）

#### 3.5.1 代码审查
- [ ] 自我审查修改的代码
- [ ] 检查是否有遗漏的引用或未删除的代码

#### 3.5.2 提交更改
```bash
# 查看更改
git status
git diff

# 提交
git add manifest.json modules/pet/content/core/petManager.core.js CLAUDE.md docs/架构设计.md
git add -u  # 删除的文件会自动追踪
git commit -m "refactor: 移除聊天记录导出为图片功能"
```

## 4. 质量保证

### 4.1 验收标准
- [ ] 所有聊天消息上的"导出消息为图片"按钮已移除
- [ ] 导出功能相关的代码已删除
- [ ] 应用功能正常，无崩溃或错误
- [ ] 内存使用情况良好
- [ ] 初始加载时间无明显增加
- [ ] 文档已更新

### 4.2 问题修复
如果在测试过程中发现问题：
1. 立即停止并记录问题
2. 分析问题原因
3. 修复问题
4. 重新测试

## 5. 后续工作

### 5.1 监控
- 上线后监控用户反馈
- 检查是否有与功能移除相关的问题

### 5.2 优化建议
- 考虑是否需要添加其他导出方式
- 监控会话导入/导出功能的使用情况

## 6. 风险评估

### 6.1 低风险
- 功能使用频率较低，用户影响范围有限
- 有明确的替代方案（会话导入/导出、复制功能）
- 实施过程简单，代码改动集中

### 6.2 风险缓解
- 在功能移除前，确保文档已更新
- 保持会话导入/导出功能的稳定性
- 确保复制功能正常工作

## 7. 总结

本计划详细描述了移除聊天记录导出为图片功能的实施步骤。通过执行这些步骤，我们将简化应用架构，提高性能，并减少维护负担。用户可以通过会话导入/导出和复制功能来满足类似的需求。
