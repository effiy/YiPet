# 场景 3: 信任边界与安全面

> | v2.0.0 | 2026-06-06 | claude | 🌿 feat/yipet-arch | ⏱️ — | 📎 [CLAUDE.md](../../../CLAUDE.md) |
> **导航**: [← 场景 2](./场景-2-数据流追踪.md) · [下一场景 →](./场景-4-依赖影响.md)

[概述](#sec-overview) · [§0 技术评审](#sec0) · [§1 测试设计](#sec1)

<a id="sec-overview"></a>
## 概述

**角色**: 安全审计者 / code reviewer · **目标**: 识别全量信任边界，覆盖认证、传输、输入、存储、权限五大安全面的威胁建模和缓解措施 · **优先级**: P0

**图谱定位**: 领域层 → `domain:yipet-security` · 结构层 → `flow:auth-chain` · `flow:input-sanitization` · `flow:permission-check`

<a id="sec-value"></a>
### 主要价值

- 🔒 **五面全量覆盖** — 认证/传输/输入/存储/权限每个面独立审计，标注现状评级和已知缺口
- 🛡️ **信任边界可视化** — 外部不可信域 → 信任边界 → 内部可信域的三层 mermaid 图，每层标注风险
- ⚠️ **风险优先级明确** — P0 缺口（聊天消息无 XSS 过滤）到 P2 缺口（Token 无过期机制）逐项列出
- ✅ **安全回归可执行** — 每面有具体测试用例，每次变更可对照安全面总览矩阵做回归
- 🔐 **STRIDE 全覆盖** — 六类威胁（欺骗/篡改/抵赖/泄露/拒绝服务/权限提升）映射到具体安全面和缓解措施
- 📋 **权限最小审计** — 5 项 manifest 权限逐条审查，每项有用途说明和风险评估

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
    AUDITOR["安全审计者接到任务<br/>审查 YiPet 安全面"]:::risk --> SCAN["对照安全面总览矩阵<br/>逐面检查"]:::exec
    SCAN --> FIND["发现 P0: 聊天消息无 XSS 过滤<br/>P1: POST 重试非幂等<br/>P2: Token 无过期机制"]:::milestone
    FIND --> PRIORITIZE["按优先级排定修复计划<br/>P0 → P1 → P2"]:::exec
    PRIORITIZE --> VERIFY["执行 §1 测试用例<br/>确认现状和修复生效"]:::goal

    classDef risk fill:#2a1a1a,stroke:#f87171,color:#f87171
    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef milestone fill:#2a2417,stroke:#fbbf24,color:#fbbf24
    classDef goal fill:#1a2a1a,stroke:#34d399,color:#34d399
```

### 信任边界全景图

```mermaid
flowchart TB
    subgraph untrusted["外部不可信域"]
        U1["用户输入<br/>聊天消息 · Token 输入 · FAQ 编辑"]:::risk
        U2["任意网页<br/>&lt;all_urls&gt; 注入范围"]:::risk
        U3["api.effiy.cn<br/>外部 API 响应"]:::risk
        U4["CDN 脚本<br/>Vue/marked/Mermaid"]:::risk
    end

    subgraph boundary["=== 信任边界 ==="]
        B1["输入校验层<br/>⚠️ 现状: 无 XSS 过滤"]:::milestone
        B2["认证层<br/>TokenManager 三级降级"]:::milestone
        B3["传输层<br/>fetch CORS + X-Token 头"]:::milestone
        B4["存储层<br/>chrome.storage.local + 配额保护"]:::milestone
        B5["权限层<br/>系统页面跳过 + 注入控制"]:::milestone
    end

    subgraph trusted["内部可信域"]
        T1["Content Script<br/>PetManager 实例"]:::good
        T2["Service Worker<br/>后台消息路由"]:::good
        T3["Popup<br/>控制面板"]:::good
    end

    U1 --> B1 --> T1
    U2 --> B5 --> T1
    U3 --> B3 --> T1
    U3 --> B2
    U4 --> B5

    classDef risk fill:#2a1a1a,stroke:#f87171,color:#f87171
    classDef milestone fill:#2a2417,stroke:#fbbf24,color:#fbbf24
    classDef good fill:#1a2a1a,stroke:#34d399,color:#a9b1d6
```

### 认证面: TokenManager 三级降级

```mermaid
flowchart TB
    REQ["API 请求发起"]:::exec --> L1{"L1: 环境变量?<br/>window.__API_X_TOKEN__"}:::review
    L1 -->|"✅ 存在"| USE1["使用环境变量 Token"]:::good
    L1 -->|"❌ 缺失"| L2{"L2: chrome.storage?<br/>YiPet.apiToken.v1"}:::review
    L2 -->|"✅ 存在"| USE2["使用存储 Token"]:::good
    L2 -->|"❌ 缺失"| L3["L3: 空 Token"]:::bad
    USE1 & USE2 --> INJECT["注入 Header<br/>X-Token: &#60token&#62"]:::exec
    L3 --> NOINJECT["不带 X-Token 头发送"]:::risk

    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef review fill:#1e1f2b,stroke:#7aa2f7,color:#a9b1d6
    classDef good fill:#1a2a1a,stroke:#34d399,color:#a9b1d6
    classDef bad fill:#2a1a1a,stroke:#f87171,color:#a9b1d6
    classDef risk fill:#2a1a1a,stroke:#f87171,color:#f87171
```

| 降级级 | 来源 | 获取方式 | 失败后行为 |
|:---:|------|---------|-----------|
| L1 | 环境变量 | `window.__API_X_TOKEN__` (同步) | 降级到 L2 |
| L2 | chrome.storage.local | `chrome.storage.local.get(['YiPet.apiToken.v1'])` (异步) | 降级到 L3 |
| L3 | 空 Token | 返回 `''` (同步) | 请求不带 X-Token 头，API 返回认证错误 |

### 输入面: 用户输入路径（风险标注）

```mermaid
flowchart TB
    subgraph inputs["用户输入入口"]
        I1["聊天输入 — ChatInput → sendMessage()"]:::note
        I2["Token 设置 — TokenSettingsModal → saveToken()"]:::note
        I3["FAQ 编辑 — FaqManager → FaqService"]:::note
        I4["会话标题 — SessionEditor → SessionService"]:::note
    end

    subgraph current["当前处理"]
        C1["⚠️ P0: 无 XSS 过滤<br/>直接拼接入 prompt"]:::risk
        C2["✅ validateToken()<br/>格式: /^[a-zA-Z0-9_-]+$/ · 长度 ≥ 10"]:::good
        C3["✅ _normalizeFaqDoc()<br/>trim · 默认值兜底"]:::good
        C4["⚠️ P1: 无长度限制<br/>可能超 chrome.storage 配额"]:::risk
    end

    I1 --> C1
    I2 --> C2
    I3 --> C3
    I4 --> C4

    classDef note fill:#21232f,stroke:#3e4152,color:#53576c
    classDef risk fill:#2a1a1a,stroke:#f87171,color:#f87171
    classDef good fill:#1a2a1a,stroke:#34d399,color:#a9b1d6
```

### 权限面: `<all_urls>` 系统页面跳过

```mermaid
flowchart TB
    START["chrome.tabs.onUpdated<br/>页面加载完成"]:::exec --> CHECK{"isSystemPage(tab.url)?"}:::review
    CHECK -->|"是"| SKIP["🚫 跳过注入<br/>chrome:// · chrome-extension://<br/>moz-extension:// · about:"]:::risk
    CHECK -->|"否"| AUTOSTART{"autoStart AND<br/>visible !== false?"}:::review
    AUTOSTART -->|"是"| INJECT["延迟注入<br/>InjectionService.injectPetToTab(tabId)"]:::good
    AUTOSTART -->|"否"| WAIT["等待用户手动触发"]:::note

    classDef exec fill:#1e1f2b,stroke:#565f89,color:#a9b1d6
    classDef review fill:#1e1f2b,stroke:#7aa2f7,color:#a9b1d6
    classDef risk fill:#2a1a1a,stroke:#f87171,color:#f87171
    classDef good fill:#1a2a1a,stroke:#34d399,color:#a9b1d6
    classDef note fill:#21232f,stroke:#3e4152,color:#53576c
```

### 安全面总览矩阵

| 安全面 | 保护机制 | 现状评级 | 已知缺口 | 优先级 |
|--------|---------|:---:|------|:---:|
| 认证 | TokenManager 三级降级 + validateToken 格式校验 | 良好 | Token 无过期机制 | P2 |
| 传输 | CORS + X-Token 头 + HTTPS + credentials: 'omit' | 良好 | POST 重试非幂等 | P1 |
| 输入 | Token 格式校验 + FAQ 规范化 | **不足** | 聊天消息无 XSS 过滤 | P0 |
| 存储 | isChromeStorageAvailable() + isContextInvalidated() + 配额清理 | 良好 | 无数据加密 | P2 |
| 权限 | isSystemPage() + autoStart 控制 | 可接受 | `<all_urls>` 范围过大 | P1 |

### 设计评审清单

| # | 检查项 | 状态 |
|---|--------|:---:|
| 1 | 信任边界全景覆盖全部 4 个不可信域和 5 条边界 | ✅ |
| 2 | TokenManager 三级降级链路完整且每级有失败后行为 | ✅ |
| 3 | 输入面 4 个入口全部审计，每个有现状评级 | ✅ |
| 4 | 安全面总览矩阵覆盖认证/传输/输入/存储/权限 5 列 | ✅ |
| 5 | STRIDE 六类威胁映射到具体安全面 | ✅ |

### STRIDE 威胁映射

| 威胁 | 对应安全面 | 具体风险 | 缓解 |
|------|----------|------|------|
| Spoofing | 认证 | Token 被盗用后冒充合法用户 | Token 格式校验 + HTTPS 传输 |
| Tampering | 传输 + 存储 | API 响应被篡改 / storage 数据被修改 | HTTPS + 响应校验 |
| Repudiation | 认证 | 无操作日志无法追溯 | 待补充（当前无审计日志） |
| Information Disclosure | 存储 + 传输 | Token 泄露 / 敏感数据明文存储 | Token 仅存 chrome.storage.local |
| Denial of Service | 权限 + 存储 | storage 配额被恶意填满 | cleanupOldData() LRU 淘汰 |
| Elevation of Privilege | 权限 | `<all_urls>` 被滥用 | isSystemPage() 跳过 + 最小权限审查 |

---

<a id="sec1"></a>
## §1 测试设计

### TC-3-1: Token 管理与认证

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-3-1-1 | `window.__API_X_TOKEN__` = `'test-token'`，storage 也有 Token | `tokenManager.getToken()` | 返回环境变量 Token（L1 优先） |
| TC-3-1-2 | 无环境变量，storage 有 Token | `tokenManager.getToken()` | 返回 storage 中的 Token（L2 降级） |
| TC-3-1-3 | 无环境变量，storage 无 Token | `tokenManager.getToken()` | 返回 `''`（L3 空 Token） |
| TC-3-1-4 | Token = `'<script>alert(1)</script>'` | `tokenManager.validateToken(token)` | 返回 `false`（含非法字符） |
| TC-3-1-5 | Token = `'valid_token_123'` | `tokenManager.validateToken(token)` | 返回 `true` |

### TC-3-2: 系统页面跳过

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-3-2-1 | 扩展已安装 | 导航到 `chrome://extensions` | isSystemPage() 返回 true，宠物不注入 |
| TC-3-2-2 | 扩展已安装 | 导航到 `chrome-extension://xxx` | isSystemPage() 返回 true，宠物不注入 |
| TC-3-2-3 | 扩展已安装 | 导航到 `about:blank` | isSystemPage() 返回 true，宠物不注入 |
| TC-3-2-4 | 扩展已安装，autoStart=true | 导航到 `https://github.com` | isSystemPage() 返回 false，宠物正常注入 |
| TC-3-2-5 | tab.url = null | `isSystemPage(null)` 被调用 | 返回 `false`（安全兜底） |

### TC-3-3: 存储安全

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-3-3-1 | chrome.storage.local 使用量接近上限 | `StorageHelper.set()` 触发写入 | isQuotaError() 检测 → cleanupOldData() 清理 petOssFiles → 重试写入 |
| TC-3-3-2 | 扩展被重新加载 | 任意 storage 操作 | isChromeStorageAvailable() 返回 false → 返回 `{ contextInvalidated: true }` |
| TC-3-3-3 | 项目源码 | grep `token` / `password` / `secret` | 无硬编码 Token/密钥 |

### TC-B: 边界与异常

| 用例 ID | Given | When | Then |
|---------|-------|------|------|
| TC-B-3-1 | chrome.storage.local 完全不可达 | 页面加载时初始化 | PetManager 以降级模式运行（纯内存状态），功能正常但不持久化 |
| TC-B-3-2 | 恶意网页尝试覆盖全局变量 | 网页自身定义了 `window.PET_CONFIG` | 扩展注入的 PET_CONFIG 先到先得，页面脚本无法覆盖已加载的扩展变量 |
| TC-B-3-3 | 用户在 TokenSettingsModal 粘贴恶意脚本 | Token = `<img src=x onerror=...>` | validateToken() 拒绝非法字符 |

> **Gate A 交接信号**: §1 测试设计完成，覆盖认证、输入、系统页面跳过、存储安全 4 类安全面的正常路径和异常边界。每个测试用例可追溯到 §0 安全面总览矩阵的具体行。可进入实现阶段。

---

<a id="sec2"></a>
## §2 实施报告

### 安全相关文件

| 文件 | 安全职责 | 信任边界 |
|------|---------|---------|
| `core/utils/api/token.js` | Token 管理 · 三级降级（环境变量 → storage → 空 token 提示） | L1 Token 缓存降级 |
| `core/utils/api/request.js` | 请求客户端 · Token 注入请求头 · CORS 处理 | L2 传输安全 |
| `core/api/core/ApiManager.js` | 拦截器链 · X-Token 自动注入 | L2 认证注入 |
| `core/bootstrap/bootstrap.js` | StorageHelper · 存储配额清理 | L2 存储安全 |
| `core/utils/storage/storageUtils.js` | chrome.storage.local 读写 · 配额保护 | L2 存储安全 |
| `manifest.json` | 权限声明 · content_scripts 注入规则 | L3 权限边界 |
| `modules/extension/background/services/injectionService.js` | Content Script 注入 · 系统页面跳过 | L3 注入安全 |
| `core/config.js` | API 端点定义 · 系统页面列表 | L3 URL 白名单 |
| `libs/md5.js` | MD5 哈希 · 数据校验 | L4 数据完整性 |

### 安全防御层次

```mermaid
flowchart LR
    subgraph L1["L1 Token 降级"]
        T1["环境变量 API_X_TOKEN"] --> T2["chrome.storage.local"]
        T2 --> T3["空 token → 提示设置"]
    end
    subgraph L2["L2 传输安全"]
        R1["fetch CORS"] --> R2["Token 注入请求头"]
        R2 --> R3["HTTPS 传输"]
    end
    subgraph L3["L3 注入安全"]
        I1["系统页面跳过"] --> I2["chrome:// 排除"]
        I2 --> I3["chrome-extension:// 排除"]
    end
    subgraph L4["L4 存储安全"]
        S1["配额检测"] --> S2["LRU 清理"]
        S2 --> S3["petOssFiles 可重建数据优先清理"]
    end
```

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
| 2026-06-06 | 按新文档标准重写 | `/rui doc` | F.story.scene 公式 §0+§1 覆盖 + STRIDE 映射 |
