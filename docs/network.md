# 网络请求与 API 调用约定

> **最后更新**：2026-04-29  
> **适用范围**：YiPet Chrome Extension（Manifest V3，Content Script + Background Service Worker）  
> **关联文档**：[认证方案](./auth.md) ｜ [状态管理](./state-management.md) ｜ [架构约定](./architecture.md)

## 目标与原则

- **统一入口**：业务模块尽量不要直接 `fetch()`；优先通过 `ApiManager`/`RequestClient` 走统一的超时、重试、解析与鉴权注入。
- **最小权限**：扩展 `host_permissions`/`permissions` 只为实际访问域名与能力开放，避免泛化扩大攻击面。
- **可取消、可重试、可观测**：所有长请求可取消（AbortController），网络/超时错误可重试（指数退避），关键请求可记录日志与统计。

## 网络层分层（现状）

### 1) 低层请求客户端：`RequestClient`

- **位置**：`core/utils/api/request.js`
- **底层能力**：基于 `fetch()` 封装
- **关键特性**：
  - 超时：默认 `timeout=30000ms`
  - 取消：支持 `abortKey`（同 key 新请求会先取消旧请求）
  - 重试：最多 3 次；对网络失败（`Failed to fetch`）与超时（`AbortError`）重试，指数退避
  - 响应解析：JSON 自动 `response.json()`；若返回 `{ code, message, data }` 且 `code !== 0` 会抛错；文本/二进制按 `content-type` 自动解析

### 2) API 管理器：`ApiManager`

- **位置**：`core/api/core/ApiManager.js`
- **组合**：
  - `RequestClient`：真正发请求（`this.client.request(...)`）
  - `TokenManager`：注入请求头 `X-Token`
  - `ErrorHandler`：统一错误分类/处理（见 `core/utils/api/error.js`）
  - `Logger`：请求/响应日志（见 `core/utils/api/logger.js`）
- **拦截器**：
  - 请求拦截：自动读取 token（异步）并写入 `X-Token`
  - 请求/响应拦截：记录日志

### 3) 业务 Service：Session / FAQ

- **会话**：`core/api/services/SessionService.js`（继承 `ApiManager`）
- **FAQ**：`core/api/services/FaqService.js`（继承 `ApiManager`）
- **接口组织**：大量使用 `PET_CONFIG.buildDatabaseUrl(...)` 拼出后端 `data_service` 形式的 URL（定义见 `core/config.js`）。

### 4) 特例：AI Chat 请求（待统一）

- **位置**：`modules/pet/content/ai/petManager.ai.api.js`
- **现状**：直接 `fetch(PET_CONFIG.api.yiaiBaseUrl, ...)`，自己处理流式 SSE、取消（AbortController）与错误。
- **建议**：后续可逐步改造为走 `ApiManager/RequestClient`，避免两套“超时/重试/错误解析”并存（本文件不阻塞当前 init 文档补齐）。

## BaseURL 与环境切换

- **配置中心**：`core/config.js` 暴露 `window.PET_CONFIG`
- **关键字段**：
  - `PET_CONFIG.api.yiaiBaseUrl`：AI Chat 后端 base url
  - `PET_CONFIG.api.faqApiUrl`：FAQ/数据库相关 base url（现有 Service 通常直接传入 `baseUrl`）
  - `PET_CONFIG.env.mode` / `PET_CONFIG.env.endpoints`：按 `production/staging/development` 切换
- **兼容层**：`core/constants/endpoints.js` 会把 `PET_CONFIG.ENDPOINTS` 挂到全局（如 `SESSION_ENDPOINTS`），用于向后兼容。

## 鉴权/认证注入（必须与 `docs/auth.md` 保持一致）

- **Token 存储与来源**：`core/utils/api/token.js`
  - 优先读取环境变量（`window.__API_X_TOKEN__` / `self.__API_X_TOKEN__` / `process.env.API_X_TOKEN`）
  - 否则读写 `chrome.storage.local`（key 默认 `YiPet.apiToken.v1`）
- **请求头**：`ApiManager` 默认以 `X-Token` 方式注入（`core/api/core/ApiManager.js`）。
- **约定**：
  - 新增后端接口若需要鉴权，必须在 `ApiManager` 体系内调用（或自行明确写出“为何不使用 ApiManager”）。
  - `docs/auth.md` 中应记录：token 的**产生方式**、**存储位置**、**传递方式（Header 名称）**、以及**用户侧设置入口**（如 Token 设置弹窗）。

## 错误分类与处理

- **错误类型**：`core/utils/api/error.js`
  - `NetworkError`：网络失败（如 `Failed to fetch`）
  - `TimeoutError`：超时/Abort
  - `AuthError`：401/403 或认证相关错误文本
  - `ValidationError`：400/422 等
  - `RateLimitError`：429 或限流
- **业务错误码**：`RequestClient._parseResponse()` 里若 JSON 含 `code` 且 `code !== 0`，会抛出 `Error(data.message || ...)`（注意：这不是 `APIError` 子类，若需要更精确分类可在上层包裹转换）。

## 推荐写法（新代码约定）

### 新增一个 Service

1. 继承 `ApiManager`，构造时传入 baseUrl（来自 `PET_CONFIG.api.*`）。
2. 尽量用 `get/post/put/delete`，避免直接 `this.client.request`。
3. 对外暴露的 API：
   - 参数做最小校验（缺关键字段直接 `throw new Error(...)`）
   - 返回值形状尽量稳定（例如 `{ success, data }`）

### 在业务模块中调用

- 业务模块（尤其是 `modules/*/content`）不要散落 `fetch()`，而是：
  - 由 `PetManager` 或模块聚合点负责持有 Service 实例
  - 统一处理用户提示（toast/notification），避免重复弹错

## 常见问题与排查

### Q1：请求提示 `Failed to fetch`

- **优先检查**：
  - `manifest.json` 的 `host_permissions` 是否包含目标域名（例如 `https://api.effiy.cn/*`）
  - 当前环境 `PET_CONFIG.envInfo.mode` 与 `PET_CONFIG.api.*` 是否指向可访问地址

### Q2：后端返回业务错误 `code != 0`

- **现象**：`RequestClient` 会直接抛错 `请求失败 (code=...)`
- **处理建议**：
  - 在调用侧捕获并给用户友好提示
  - 若需要区分错误码，考虑在 Service 层把错误 message/code 结构化再抛出

### Q3：请求需要取消

- **推荐**：
  - UI 层保存 `AbortController`（现有 ChatWindow 就有类似逻辑）
  - 或者使用 `RequestClient` 的 `abortKey` 进行“新请求覆盖旧请求”

