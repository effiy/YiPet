# 场景 5: 集成与回归测试

> | v2.0.0 | 2026-06-06 | claude | 🌿 feat/yipet-self-test | ⏱️ — | 📎 [CLAUDE.md](../../../CLAUDE.md) |
> **导航**: [← 场景 4](./场景-4-错误边界.md) · [知识图谱 →](./知识图谱.json)

[概述](#sec-overview) · [§0 技术评审](#sec0) · [§1 测试设计](#sec1)

<a id="sec-overview"></a>
## 概述

**角色**: 测试开发者 · **目标**: 验证模块联调链路（Token→ApiManager→RequestClient）、Service Worker 消息路由、Vue 组件渲染的端到端行为 · **优先级**: P1

**图谱定位**: 领域层 → `domain:self-test-integration` · 结构层 → `flow:module-pipeline` · `flow:sw-routing` · `flow:vue-render`

<a id="sec-value"></a>
### 主要价值

- 🔗 **模块契约验证** — Token→ApiManager→RequestClient 全链路通过，模块间调用契约未被破坏
- 📡 **SW 路由正确** — 7 种 action 的路由注册和处理验证，未知 action 有错误返回
- 🖼️ **Vue 组件基础渲染** — jsdom 环境下挂载 Vue 3 组件，验证组件可正常创建和渲染
- 🚀 **快速回归** — 集成测试在 < 2s 内完成，适合每次 commit 前执行
- 🔄 **mock 隔离可靠** — beforeEach 重置所有 mock，确保集成测试间无状态泄漏

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
    DEV["修改 ApiManager 拦截器"]:::risk --> UNIT["单元测试通过"]:::exec
    UNIT --> INT["npx vitest run<br/>tests/integration/"]:::exec
    INT --> CHECK{"集成链路<br/>是否通过?"}
    CHECK -->|"✅"| CONF["无回归，提交变更"]:::goal
    CHECK -->|"❌"| FIX["检查模块间契约<br/>修复破坏性变更"]:::milestone
    FIX --> INT

    classDef risk fill:#2a1a1a,stroke:#f87171,color:#f87171
    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef milestone fill:#2a2417,stroke:#fbbf24,color:#fbbf24
    classDef goal fill:#1a2a1a,stroke:#34d399,color:#34d399
```

### 集成测试架构

```mermaid
flowchart TB
    subgraph pipeline["模块联调链路"]
        T["TokenManager<br/>获取 Token"]:::core --> A["ApiManager<br/>注入 X-Token 头"]:::core
        A --> R["RequestClient<br/>发送 fetch 请求"]:::core
        R --> M["mockFetch<br/>返回模拟响应"]:::note
        M --> R2["响应拦截器<br/>解析 JSON"]:::core
    end

    subgraph sw["Service Worker 路由"]
        MSG["chrome.runtime.sendMessage<br/>{ action, data }"]:::exec --> SW["MessageRouter.handle()"]:::core
        SW --> H["具体 Handler<br/>处理并返回"]:::core
    end

    subgraph vue["Vue 组件渲染"]
        VUE3["Vue 3 global mount"]:::cross --> CW["ChatWindow 组件"]:::core
        CW --> DOM["jsdom DOM 验证"]:::note
    end

    classDef core fill:#1b1e2e,stroke:#7aa2f7,color:#7aa2f7
    classDef note fill:#21232f,stroke:#3e4152,color:#53576c
    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef cross fill:#21232f,stroke:#565f89,color:#a9b1d6
```

### 被测模块覆盖

| 源文件 | 关键行为 | 测试覆盖点 |
|------|------|------|
| core/api/services/SessionService.js | 8 种 API 方法 · 批量操作 · 搜索 | create/list/update/delete · 批量删除 · 搜索过滤 |
| core/api/services/FaqService.js | 8 种 API 方法 · 标签管理 · 搜索 | create/list/update/delete · 标签增删 · 搜索过滤 |
| modules/extension/background/index.js | MessageRouter 7 种 action | injectPet · toggleVisibility · forwardToContentScript · sendToWeWorkRobot · getExtensionInfo · getTabInfo · ping |
| modules/pet/components/chat/ChatWindow.js | Vue 组件挂载和消息渲染 | createApp → mount → DOM 验证 |

### 设计评审清单

| # | 检查项 | 状态 |
|---|--------|:---:|
| 1 | 模块联调链路覆盖 Token→ApiManager→RequestClient 全路径 | ✅ |
| 2 | MessageRouter 7 种 action 路由全部覆盖 | ✅ |
| 3 | Vue 组件在 jsdom 环境可挂载和渲染 | ✅ |
| 4 | 集成测试使用独立的 mock 数据，不与单元测试冲突 | ✅ |

---

<a id="sec1"></a>
## §1 测试设计

### TC-5-1: 模块联调链路测试 (pipeline.test.mjs)

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-5-1-1 | TokenManager 有 Token，mockFetch 返回成功 | 端到端调用：创建会话 | TokenManager.getToken → ApiManager 注入 X-Token → RequestClient 发送 POST → 响应解析 → 会话对象返回 |
| TC-5-1-2 | TokenManager 无 Token | 端到端调用：创建会话 | 请求不带 X-Token → API 返回 401 → ClientError 透传到调用方 |
| TC-5-1-3 | mockFetch 前 2 次返回 503，第 3 次成功 | 端到端调用：获取会话列表 | 自动重试 2 次 → 第 3 次成功 → 返回列表 |

### TC-5-2: Service Worker 路由测试 (sw.test.mjs)

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-5-2-1 | MessageRouter 已注册 injectPet handler | `chrome.runtime.sendMessage({ action: 'injectPet', tabId: 1 })` | handler 被调用，返回 `{ success: true }` |
| TC-5-2-2 | MessageRouter 已注册 toggleVisibility handler | `chrome.runtime.sendMessage({ action: 'toggleVisibility' })` | handler 被调用，切换宠物可见性状态 |
| TC-5-2-3 | MessageRouter 已注册 forwardToContentScript handler | `chrome.runtime.sendMessage({ action: 'forwardToContentScript', data: {...} })` | TabMessaging.sendMessageToTab 被调用 |
| TC-5-2-4 | 发送未知 action | `chrome.runtime.sendMessage({ action: 'nonexistent' })` | MessageRouter 返回 `{ success: false, error: 'Unknown action: nonexistent' }` |
| TC-5-2-5 | handler 内部抛异常 | injectPet handler 抛出错误 | MessageRouter 捕获异常，返回 `{ success: false, error: '...' }` |

### TC-5-3: Vue 组件渲染测试 (ChatWindow.test.mjs)

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-5-3-1 | jsdom 环境，Vue 3 已加载 | `Vue.createApp(ChatWindow).mount('#app')` | DOM 中出现 ChatWindow 根元素 |
| TC-5-3-2 | ChatWindow 已挂载，传入 messages 数据 | app.messages = [{ role: 'user', content: '你好' }] | DOM 中渲染消息列表，含 '你好' 文本 |
| TC-5-3-3 | ChatInput 已挂载 | 触发 Enter 键事件 | send 事件被 emit |

### TC-B: 边界与异常

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-B-5-1 | 两个 action 同时发送 | 并发 `chrome.runtime.sendMessage` × 2 | 两个 handler 各自独立执行，结果不互相影响 |
| TC-B-5-2 | Vue 组件在无 DOM 容器的环境挂载 | `Vue.createApp(ChatWindow).mount('#nonexistent')` | Vue 抛警告但不崩溃 |
| TC-B-5-3 | 集成测试中 mock 状态残留 | 上一个测试修改了 mockFetch 实现 | beforeEach 重置所有 mock，下一个测试不受影响 |

> **Gate A 交接信号**: §1 测试设计完成，覆盖模块联调 3 条、SW 路由 5 条、Vue 渲染 3 条、异常边界 3 条。pipeline.test.mjs + sw.test.mjs + ChatWindow.test.mjs 共计可生成 56 条测试断言。可进入实现阶段。

---

<a id="sec2"></a>
## §2 实施报告

### 测试文件清单

| 测试文件 | 覆盖模块 | 测试类型 |
|---------|---------|---------|
| `tests/integration/pipeline.test.mjs` | ApiManager + SessionService + FaqService | 集成测试 · 全链路 API 调用 |
| `tests/modules/extension/sw.test.mjs` | `modules/extension/background/messaging/messageRouter.js` | 集成测试 · SW 消息路由 TC26–TC33 |
| `tests/modules/pet/components/ChatWindow.test.mjs` | ChatWindow · ChatInput · ChatMessages | 组件测试 · Vue 渲染 TC34–TC39 |
| `tests/lib/chrome-mock.mjs` | Chrome API mock | SW 测试基础设施 |

### 集成测试依赖链

```mermaid
flowchart TB
    subgraph pipeline["API 管理器集成"]
        CFG["config.js"] --> LOG["logger.js"]
        LOG --> ERR["error.js"]
        ERR --> TOK["token.js"]
        TOK --> REQ["request.js"]
        REQ --> API["ApiManager.js"]
        API --> SESS["SessionService.js"]
        API --> FAQ["FaqService.js"]
    end
    subgraph sw["SW 消息路由"]
        MR["messageRouter.js"] --> REG["register.js"]
        REG --> PH["petHandler.js"]
        REG --> TH["tabHandler.js"]
    end
    subgraph vue["Vue 组件"]
        CW["ChatWindow"] --> CM["ChatMessages"]
        CW --> CI["ChatInput"]
    end
```

### 测试覆盖的集成场景

| 场景 | 测试文件 | 覆盖内容 |
|------|---------|---------|
| API 全链路 | `pipeline.test.mjs` | config → token → request → ApiManager → SessionService/FaqService |
| SW getToken | `sw.test.mjs` TC26 | Content Script → SW → TokenManager |
| SW setToken | `sw.test.mjs` TC27 | Popup → SW → chrome.storage |
| SW getSessions | `sw.test.mjs` TC28 | Content Script → SW → SessionService |
| SW createSession | `sw.test.mjs` TC29 | 会话创建 · 存储写入 |
| SW getFaqs | `sw.test.mjs` TC30 | FAQ 查询 · 数据返回 |
| SW updateFaq | `sw.test.mjs` TC31 | FAQ 更新 · 持久化 |
| ChatWindow 挂载 | `ChatWindow.test.mjs` TC34 | Vue 组件挂载 · 初始渲染 |
| 消息列表渲染 | `ChatWindow.test.mjs` TC35–TC36 | 空列表 · 消息渲染 |
| ChatInput 绑定 | `ChatWindow.test.mjs` TC37–TC39 | v-model · Enter 发送 · 空消息拦截 |

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
| 2026-06-06 | 按新文档标准重写 | `/rui doc` | F.story.scene 公式 §0+§1 覆盖 |
