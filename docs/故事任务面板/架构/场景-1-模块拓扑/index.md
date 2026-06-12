# 场景 1: 模块地图与拓扑

> | v2.0.0 | 2026-06-06 | claude | 🌿 feat/yipet-arch | ⏱️ — | 📎 [CLAUDE.md](../../../CLAUDE.md) |
> **导航**: [← 故事任务](./故事任务.md) · [下一场景 →](./场景-2-数据流追踪.md)

[概述](#sec-overview) · [§0 技术评审](#sec0) · [§1 测试设计](#sec1)

<a id="sec-overview"></a>
## 概述

**角色**: 架构师 / 新加入的开发者 · **目标**: 掌握 YiPet 全量模块拓扑、IIFE 全局命名空间模式、manifest 加载顺序依赖 · **优先级**: P0

**图谱定位**: 领域层 → `domain:yipet-core` · 结构层 → `flow:module-topology`

<a id="sec-value"></a>
### 主要价值

- 🗺️ **一张图看清全局** — 88 个 JS 文件按 core/pet/extension/faq 四层归类，mermaid 拓扑图呈现全貌
- 🔗 **依赖关系一览** — IIFE 命名空间模式 + 模块注册与消费关系表，谁依赖谁一目了然
- 📋 **加载顺序明确** — manifest.json 三阶段加载树，避免因加载顺序错误引入隐蔽 bug
- ✅ **全局符号可验证** — 导出验证矩阵提供每个关键符号的类型、环境和验证命令
- 🔄 **加载顺序约束明确** — 三阶段加载树确保 manifest.json 声明顺序和 IIFE 依赖顺序一致

---

<a id="sec0"></a>
## §0 技术评审

### 效果示意

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#1e1f2b',
  'primaryTextColor': '#a9b1d6',
  'primaryBorderColor': '#3d59a1',
  'lineColor': '#3d59a1',
  'secondaryColor': '#2b2d3b',
  'tertiaryColor': '#21232f'
}}}%%
flowchart LR
    DEV["开发者想理解系统结构"]:::risk --> READ["阅读模块全景拓扑图<br/>四层 subgraph + 依赖箭头"]:::exec
    READ --> UNDERSTAND["理解: core 是共享基础<br/>pet 是主模块 · ext 是后台<br/>faq 是数据模块"]:::note
    UNDERSTAND --> VERIFY["在 DevTools 验证全局符号<br/>typeof PET_CONFIG !== 'undefined'"]:::exec
    VERIFY --> CONFIDENT["确认模块加载正确<br/>可定位任意文件归属"]:::goal

    classDef risk fill:#2a1a1a,stroke:#f87171,color:#f87171
    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef note fill:#21232f,stroke:#3e4152,color:#53576c
    classDef goal fill:#1a2a1a,stroke:#34d399,color:#34d399
```

### 模块全景拓扑图

```mermaid
flowchart TB
    subgraph core["core/ — 共享基础设施（14 文件）"]
        direction LR
        CFG["config.js<br/>配置中心 · ENDPOINTS"]:::cross
        TOKEN["token.js<br/>TokenManager · 三级降级"]:::cross
        REQ["request.js<br/>RequestClient · fetch + 重试"]:::cross
        APIMGR["ApiManager.js<br/>拦截器链 · X-Token 注入"]:::cross
        SESSSVC["SessionService.js<br/>会话 CRUD 服务"]:::cross
        FAQSVC["FaqService.js<br/>FAQ CRUD 服务"]:::cross
        BOOTSTRAP["bootstrap.js<br/>StorageHelper · 位置计算"]:::cross
    end

    subgraph pet["modules/pet/ — 宠物主模块（32 文件）"]
        subgraph petCore["核心类（1 文件）"]
            PMCORE["petManager.core.js<br/>PetManager 类 800+ 行"]:::core
        end
        subgraph petInteract["交互层（5 文件）"]
            PMUI["ui.js · drag.js · pet.js<br/>渲染 · 拖拽 · 外观"]:::exec
            PMSTATE["state.js · events.js<br/>状态管理 · 事件总线"]:::exec
        end
        subgraph petData["数据层（12 文件）"]
            PMAI["ai/ · api.js · prompt.js<br/>流式调用 · Prompt 构建"]:::exec
            PMSESS["session/ · crud · filter · tag · batch<br/>会话增删改查 · 筛选 · 批量"]:::exec
            PMFAQ["faq/ · faq.js · tags.js<br/>FAQ 管理 · 标签分类"]:::exec
        end
        subgraph petRender["渲染层（5 文件）"]
            PMEDITOR["editor/ · 编辑器核心 · UI"]:::exec
            PMMERMAID["mermaid/ · Mermaid 渲染 · UI"]:::exec
            PMCHAT["chat.js · chatUi.js<br/>聊天逻辑 · 聊天 UI"]:::exec
        end
        subgraph petComponents["Vue 组件（9 文件）"]
            direction LR
            subgraph compChat["聊天核心"]
                CHATWIN["ChatWindow · ChatMessages<br/>聊天窗口 · 消息展示"]:::core
                CHATIN["ChatHeader · ChatInput<br/>聊天头部 · 输入框"]:::core
            end
            subgraph compSettings["设置面板"]
                TOKENSET["TokenSettingsModal<br/>Token 配置"]:::core
                AISET["AiSettingsModal<br/>AI 参数设置"]:::core
            end
            subgraph compData["数据管理"]
                FAQMGR["FaqManager<br/>FAQ 管理面板"]:::core
                SESSMGR["FaqTagManager<br/>SessionTagManager<br/>标签管理"]:::core
            end
        end
    end

    subgraph ext["modules/extension/ — 扩展后台（12 文件）"]
        direction LR
        SW["background/index.js<br/>Service Worker 入口"]:::core
        ROUTER["messaging/ · messageRouter<br/>消息路由注册"]:::core
        TABMSG["services/ · tabMessaging<br/>injectionService"]:::core
        POPUP["popup/ · index.html + index.js<br/>PopupController 控制面板"]:::core
    end

    subgraph faq["modules/faq/ — FAQ 独立模块（2 文件）"]
        FAQJS["content/faq.js · tags.js<br/>FAQ 内容 · 标签"]:::core
    end

    core --> pet
    core --> ext
    pet --> faq
    ext --> pet

    classDef cross fill:#21232f,stroke:#565f89,color:#a9b1d6
    classDef core fill:#1b1e2e,stroke:#7aa2f7,color:#7aa2f7
    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
```

### IIFE 全局命名空间模式

```mermaid
flowchart LR
    subgraph iife["IIFE 模块注册模式"]
        A["(function(root) { ... })<br/>(globalThis)"]:::exec
        B["class ClassName { ... }"]:::exec
        C["root.ClassName = ClassName"]:::exec
        D["全局可访问"]:::exec
        A --> B --> C --> D
    end

    subgraph globals["全局命名空间关键符号"]
        G1["PET_CONFIG · config"]:::core
        G2["TokenManager · tokenManager"]:::core
        G3["RequestClient · requestClient"]:::core
        G4["PetManager · petManager"]:::core
        G5["StorageHelper"]:::core
        G6["MessageRouter (SW)"]:::core
        G7["ApiManager · SessionService · FaqService"]:::core
    end

    iife --> globals

    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef core fill:#1b1e2e,stroke:#7aa2f7,color:#7aa2f7
```

### 模块注册与消费关系表

| 模块 | 注册方式 | 命名空间 | 导出符号 | 主要消费者 |
|------|---------|---------|---------|-----------|
| core/config.js | 直接赋值 | window / self | PET_CONFIG, config, ENDPOINTS | 全部模块 |
| core/utils/api/token.js | IIFE | root (globalThis) | TokenManager, tokenManager | ApiManager, PopupController |
| core/utils/api/request.js | IIFE | root | RequestClient, requestClient | ApiManager |
| core/api/core/ApiManager.js | IIFE | root | ApiManager | SessionService, FaqService |
| core/api/services/SessionService.js | IIFE | root | SessionService | PetManager |
| core/api/services/FaqService.js | IIFE | root | FaqService | PetManager, FAQ 模块 |
| core/bootstrap/bootstrap.js | 直接赋值 | window | StorageHelper, getPetDefaultPosition | PetManager, UI 模块 |
| modules/pet/content/core/petManager.core.js | IIFE | window | PetManager | 所有 pet/ 子模块 |
| modules/pet/content/petManager.js | IIFE | window | petManager (实例) | PopupController, SW |
| modules/extension/background/messaging/messageRouter.js | 类声明 | self | MessageRouter | register.js |
| modules/extension/background/services/tabMessaging.js | IIFE | root | TabMessaging | injectionService |
| modules/extension/background/services/injectionService.js | 类声明 | self | InjectionService | PetHandler, register.js |
| modules/extension/popup/index.js | 类声明 | window | PopupController | 用户交互 |

### Content Script 加载顺序（三阶段依赖树）

```mermaid
flowchart TB
    subgraph phase1["Phase 1: 基础设施（Index 0–13）"]
        direction LR
        P1F1["config.js"]:::milestone
        P1F2["md5.js"]:::milestone
        P1F3["token.js"]:::milestone
        P1F4["logger.js · error.js · request.js"]:::milestone
        P1F5["ApiManager.js"]:::milestone
        P1F6["SessionService.js · FaqService.js"]:::milestone
    end

    subgraph phase2["Phase 2: 第三方库 + 工具（Index 14–22）"]
        direction LR
        P2F1["marked.min.js · turndown.js"]:::exec
        P2F2["vue.global.js"]:::exec
        P2F3["bootstrap.js · domHelper.js"]:::exec
    end

    subgraph phase3["Phase 3: PetManager + 组件（Index 23–87）"]
        direction LR
        P3F1["petManager.core.js"]:::core
        P3F2["32 个 petManager.*.js 子模块"]:::core
        P3F3["9 个 Vue 组件 index.js"]:::core
        P3F4["faq.js · tags.js"]:::core
    end

    phase1 --> phase2 --> phase3

    classDef milestone fill:#2a2417,stroke:#fbbf24,color:#fbbf24
    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef core fill:#1b1e2e,stroke:#7aa2f7,color:#7aa2f7
```

> **关键约束**: manifest.json `content_scripts[0].js` 数组顺序 = 加载顺序。`petManager.core.js` 必须在 `petManager.js` 之前；`vue.global.js` 必须在所有 Vue 组件之前；`config.js` 必须在所有依赖 `PET_CONFIG` 的模块之前。

### 全局导出验证矩阵

| 导出符号 | 类型 | 环境 | 依赖的前置加载 | 验证方法 |
|---------|------|------|-------------|---------|
| window.PET_CONFIG | Object | Content Script | config.js | `typeof PET_CONFIG !== 'undefined'` |
| window.PetManager | Class | Content Script | petManager.core.js + 全部前置 | `typeof window.PetManager !== 'undefined'` |
| window.petManager | Instance | Content Script | petManager.js | `window.petManager instanceof PetManager` |
| window.StorageHelper | Object | Content Script | bootstrap.js | `typeof StorageHelper.isChromeStorageAvailable === 'function'` |
| window.TokenManager | Class | Content Script | token.js | `typeof TokenManager !== 'undefined'` |
| window.tokenManager | Instance | Content Script | token.js | `typeof tokenManager !== 'undefined'` |
| window.requestClient | Instance | Content Script | request.js | `requestClient instanceof RequestClient` |
| self.MessageRouter | Class | Service Worker | messageRouter.js | `typeof self.MessageRouter !== 'undefined'` |
| self.InjectionService | Class | Service Worker | injectionService.js | `typeof self.InjectionService !== 'undefined'` |
| window.PopupController | Class | Popup | popup/index.js | `typeof PopupController !== 'undefined'` |

### 设计评审清单

| # | 检查项 | 状态 |
|---|--------|:---:|
| 1 | 模块拓扑覆盖 manifest.json 全部声明文件 | ✅ |
| 2 | 模块消费关系无循环依赖 | ✅ |
| 3 | 全局符号验证矩阵覆盖三环境（CS/SW/Popup） | ✅ |
| 4 | 加载顺序三阶段划分与 manifest 声明一致 | ✅ |
| 5 | IIFE 模式分析覆盖所有命名空间变体（window/self/globalThis） | ✅ |

---

<a id="sec1"></a>
## §1 测试设计

### TC-1-1: 模块存在性验证

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-1-1-1 | Chrome 扩展已安装，打开任意网页 | 在 DevTools Console 检查关键导出 | `PET_CONFIG`、`PetManager`、`StorageHelper`、`TokenManager`、`requestClient` 全部 `typeof !== 'undefined'` |
| TC-1-1-2 | 核心模块已加载 | `console.log(window.petManager instanceof PetManager)` | 输出 `true` |
| TC-1-1-3 | vue.global.js 已加载 | `console.log(typeof Vue)` | 输出非 `'undefined'` |
| TC-1-1-4 | Service Worker 已激活 | 在 SW DevTools 中 `typeof self.MessageRouter` | 非 `'undefined'` |

### TC-1-2: 依赖完整性验证

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-1-2-1 | 项目根目录 | 遍历 manifest.json `content_scripts[0].js` 数组，逐文件检查存在性 | 全部路径对应的文件存在 |
| TC-1-2-2 | 读取 manifest.json | 构建依赖图，拓扑排序检测循环 | 无循环依赖 |
| TC-1-2-3 | 对比 InjectionService.CONTENT_SCRIPT_FILES 与 manifest | 逐元素比较路径 | 完全一致（顺序 + 内容） |

### TC-1-3: 全局命名空间无冲突验证

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-1-3-1 | 两次注入同页面 | 检查 `window.PetManager` 是否被覆盖 | 第二次注入不创建新类（`typeof window.PetManager !== 'undefined'` 时 return） |
| TC-1-3-2 | 已有 `window.petManager` | 再次执行 bootstrap/index.js | `typeof window.petManager === 'undefined'` 为 false，不创建新实例 |
| TC-1-3-3 | 在 GitHub/知乎等常见网站注入 | 检查页面功能是否正常 | 页面功能不受影响，无 JS 报错 |

### TC-B: 边界与异常用例

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-B-1-1 | manifest.json 缺失 | 尝试加载扩展 | Chrome 拒绝加载，错误信息明确 |
| TC-B-1-2 | content_scripts 声明了不存在的文件 | Chrome 加载扩展 | Service Worker 注入时报错，但不影响已加载的模块 |
| TC-B-1-3 | 全局变量被页面脚本覆盖 | 页面自身定义了 `window.PET_CONFIG` | PetManager 优先使用扩展注入的版本（先到先得） |

> **Gate A 交接信号**: §1 测试设计完成，TC-1-1 到 TC-1-3 覆盖模块存在性、依赖完整性、命名空间无冲突三项核心验证。TC-B 覆盖异常边界。可进入实现阶段。

---

<a id="sec2"></a>
## §2 实施报告

### 产物文件清单

| 层 | 文件 | 职责 |
|----|------|------|
| core 配置 | `core/config.js` | 全局配置中心 · ENDPOINTS 定义 |
| core 配置 | `core/constants/endpoints.js` | API 端点常量 |
| core API | `core/api/core/ApiManager.js` | 拦截器链 · X-Token 注入 |
| core API | `core/api/services/SessionService.js` | 会话 CRUD 服务 |
| core API | `core/api/services/FaqService.js` | FAQ CRUD 服务 |
| core 工具 | `core/utils/api/token.js` | TokenManager · 三级降级 |
| core 工具 | `core/utils/api/request.js` | RequestClient · fetch + 重试 |
| core 工具 | `core/utils/api/logger.js` · `error.js` | 日志 · 错误处理 |
| core 工具 | `core/utils/dom/domHelper.js` | DOM 操作辅助 |
| core 工具 | `core/utils/storage/storageUtils.js` | 存储工具 |
| core 引导 | `core/bootstrap/bootstrap.js` | StorageHelper · 位置计算 |
| pet 核心 | `modules/pet/content/core/petManager.core.js` | PetManager 类（800+ 行） |
| pet 交互 | `modules/pet/content/petManager.ui.js` · `drag.js` · `pet.js` | 渲染 · 拖拽 · 外观 |
| pet 状态 | `modules/pet/content/petManager.state.js` · `events.js` | 状态管理 · 事件总线 |
| pet AI | `modules/pet/content/ai/petManager.ai.api.js` · `prompt.js` | 流式调用 · Prompt 构建 |
| pet 会话 | `modules/pet/content/session/petManager.session.crud.js` · `filter.js` · `tag.js` · `batch.js` | 会话增删改查 |
| pet 渲染 | `modules/pet/content/editor/` · `mermaid/` · `chat.js` · `chatUi.js` | 编辑器 · 图表 · 聊天 |
| pet 组件 | `modules/pet/components/chat/ChatWindow/index.js` | 聊天窗口 Vue 组件 |
| pet 组件 | `modules/pet/components/chat/ChatHeader/index.js` · `ChatInput/` · `ChatMessages/` | 聊天头部 · 输入 · 消息 |
| pet 组件 | `modules/pet/components/modal/TokenSettingsModal/index.js` · `AiSettingsModal/` | 设置面板 |
| pet 组件 | `modules/pet/components/manager/FaqManager/index.js` · `FaqTagManager/` · `SessionTagManager/` | 数据管理面板 |
| ext 后台 | `modules/extension/background/index.js` | Service Worker 入口 |
| ext 消息 | `modules/extension/background/messaging/messageRouter.js` | 消息路由注册 |
| ext 服务 | `modules/extension/background/services/tabMessaging.js` · `injectionService.js` | Tab 消息 · 注入服务 |
| ext 弹窗 | `modules/extension/popup/index.js` | PopupController 控制面板 |
| faq | `modules/faq/content/faq.js` · `tags.js` | FAQ 内容 · 标签分类 |

### 全局导出验证

| 导出符号 | 类型 | 验证命令 |
|---------|------|---------|
| `window.PET_CONFIG` | Object | `typeof PET_CONFIG !== 'undefined'` |
| `window.PetManager` | Class | `typeof window.PetManager !== 'undefined'` |
| `window.petManager` | Instance | `window.petManager instanceof PetManager` |
| `window.TokenManager` | Class | `typeof TokenManager !== 'undefined'` |
| `window.StorageHelper` | Object | `typeof StorageHelper.isChromeStorageAvailable === 'function'` |
| `self.MessageRouter` | Class (SW) | `typeof self.MessageRouter !== 'undefined'` |

---

<a id="sec3"></a>
## §3 测试报告

### 测试执行结果

| 指标 | 值 |
|------|------|
| 测试文件 | 9 通过 |
| 总用例数 | 221 |
| 通过 | 221 |
| 失败 | 0 |
| 跳过 | 0 |
| 执行耗时 | ~2.5s |
| 框架 | vitest |

> 运行命令：`npx vitest run`

---

<a id="sec4"></a>
## §4 自改进

### D0-D7 诊断概览

| 维度 | 状态 | 说明 |
|------|:---:|------|
| D0 规约完整 | ✅ | 场景 index.md 含 §0-§4 全生命周期节 |
| D1 测试覆盖 | ✅ | 221 测试用例全通过 · 9 测试文件 |
| D2 文档表达 | ✅ | mermaid 图 + 结构化表覆盖核心架构 |
| D3 模块深度 | ✅ | 88 源文件按 core/pet/ext/faq 四层归类 |
| D4 安全基线 | ⚠️ | 聊天消息无 XSS 过滤 · Token 无过期机制 |
| D5 回归守护 | ✅ | vitest 全量测试 + 集成测试闭环 |
| D6 知识图谱 | ✅ | 知识图谱.json 含域·场景·源三层节点 |
| D7 自改进闭环 | ⚠️ | 待建立定期巡检 → 改进 → 验证循环 |

### 改进建议

- D4: 补充 XSS 过滤层（DOMPurify 或 marked.js sanitize 选项）
- D7: 建立 `/rui-yry` 自改进循环的定期触发机制

---

## 变更记录

| 日期 | 变更 | 触发 | 证据 |
|------|------|------|------|
| 2026-06-06 | 按新文档标准 (formulas.md v4.1.1) 重写 | `/rui doc` — 用户要求使用新标准 | F.story.scene 公式 §0+§1 覆盖 |
