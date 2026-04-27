# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 模块地图

### 模块索引

| 模块名称 | 目录路径 | module.md 路径 | 职责描述 |
|---------|---------|---------------|---------|
| core/config | core/ | core/module.md | 全局配置与环境检测 |
| core/utils | core/utils/ | core/utils/module.md | 通用工具函数集 |
| core/api | core/api/ | core/api/module.md | API 请求管理与服务 |
| core/bootstrap | core/bootstrap/ | core/bootstrap/module.md | Content Script 入口与初始化 |
| modules/pet | modules/pet/ | modules/pet/module.md | 宠物管理核心模块 |
| modules/chat | modules/chat/ | modules/chat/module.md | 聊天导出功能 |
| modules/faq | modules/faq/ | modules/faq/module.md | FAQ 管理与标签 |
| modules/screenshot | modules/screenshot/ | modules/screenshot/module.md | 区域截图功能 |
| modules/session | modules/session/ | modules/session/module.md | 会话导入导出 |
| modules/mermaid | modules/mermaid/ | modules/mermaid/module.md | Mermaid 图表渲染 |
| modules/extension | modules/extension/ | modules/extension/module.md | 扩展系统（background/popup） |

### 上下文加载策略

#### 单模块任务

当任务仅涉及单个模块时：
1. 读取项目级 CLAUDE.md，定位目标模块
2. 读取目标模块的 module.md，获取依赖清单
3. 仅加载目标模块文件 + 上游依赖的导出接口
4. 避免加载无关模块的完整代码

#### 跨模块任务

当任务涉及多个模块时：
1. 读取项目级 CLAUDE.md，获取涉及的模块列表
2. 依次读取各模块的 module.md
3. 按依赖顺序加载涉及的模块
4. 验证影响链闭合

---

## 项目架构约定

### IIFE 命名空间模式

所有业务模块必须使用 IIFE 封装，挂载到 `window.PetManager` 命名空间：

```javascript
(function () {
  'use strict'
  if (!window.PetManager) window.PetManager = {}
  if (!window.PetManager.Chat) window.PetManager.Chat = {}

  window.PetManager.Chat.someMethod = function someMethod() {
    // implementation
  }
})()
```

### Hooks 工厂模式

状态管理使用 hooks 工厂模式（createStore + useComputed + useMethods）。

### manifest.json 注册

新增 content_scripts 条目必须在 manifest.json 中按依赖顺序插入。
