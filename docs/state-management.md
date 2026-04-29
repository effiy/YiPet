# 数据与状态管理约定

> **最后更新**：2026-04-29  
> **适用范围**：YiPet Chrome Extension（Vanilla JS + Vue 3 Global Build）  
> **关联文档**：[网络请求](./network.md) ｜ [架构约定](./architecture.md)

## 目标与边界

- **目标**：让“UI 状态、业务状态、远端数据、持久化数据”各有归属，避免跨模块随意读写导致的状态漂移。
- **边界**：Content Script 不能使用 ES Modules；状态与模块封装需兼容 IIFE + `window.PetManager` 命名空间约定。

## 状态分层（按数据来源/生命周期）

### 1) 配置与常量（只读）

- **入口**：`core/config.js` 暴露 `window.PET_CONFIG`
- **特点**：运行时只读（除少量 UI 逻辑读取）；环境切换与端点配置统一在这里。

### 2) PetManager 运行态（业务状态）

典型字段：可见性、角色、模型选择、窗口状态、会话数据等。

- **示例（全局状态）**：`modules/pet/content/petManager.state.js`
  - 状态保存：`PetManager.prototype.saveState()` / `syncToGlobalState()`
  - 防抖/节流：`STATE_SAVE_THROTTLE` 控制写入频率，避免触发 `chrome.storage` 配额
  - 恢复：`loadState()` → `_applyLoadedState(state)`

### 3) Vue 组件内部状态（UI 状态）

本项目的组件状态管理采用“Hooks 工厂模式”，由 3 个 IIFE 文件组成：

- **store**：`modules/pet/components/chat/ChatWindow/hooks/store.js`
  - 约定：`createStore(manager)` 返回 `ref/reactive` 数据
  - 现状示例：`searchValue: ref(manager.sessionTitleFilter || '')`
- **computed**：`modules/pet/components/chat/ChatWindow/hooks/useComputed.js`
  - 约定：只做派生，不产生副作用
- **methods**：`modules/pet/components/chat/ChatWindow/hooks/useMethods.js`
  - 约定：封装事件处理与对 manager 的调用，避免模板/DOM 里散落业务逻辑

> 说明：目前该模式在 `ChatWindowHooks` 里较轻量（只覆盖搜索框一类 UI 状态）。后续扩展时依然遵循同样的三分法，避免把“业务状态”塞回组件内部。

### 4) 持久化状态（跨页面/跨生命周期）

#### 4.1 `chrome.storage.local` 作为主持久化

- **原因**：扩展环境下，`chrome.storage.local` 是官方持久化方案，能跨页面与扩展生命周期保留数据。
- **key 约定**：`PET_CONFIG.storage.keys.*`（见 `core/config.js`）
  - `pet_global_state`
  - `pet_chat_window_state`

#### 4.2 安全存取包装：`window.StorageHelper`

- **定义位置**：`core/bootstrap/bootstrap.js`
- **能力**：
  - `isChromeStorageAvailable()`：扩展上下文失效时避免继续读写
  - `set(key, value)`：自动处理配额超限（Quota）并尝试清理旧数据后重试
  - `get(key)`：安全读取，失败返回 `null`

> 约定：业务模块写 `chrome.storage.local` 时，优先走 `StorageHelper`，避免“上下文失效/配额超限”导致的未捕获异常。

### 5) 远端数据（后端同步）

远端数据的读写应通过 `core/api/services/*` 与 `SessionManager`/业务模块协调完成，避免 UI 组件直接调用 API。

- **会话同步（示例）**：`core/utils/session/sessionManager.js`
  - `sessionApi`：可注入 `SessionService`（继承 `ApiManager`）
  - `enableBackendSync`：是否启用后端同步（受 `PET_CONFIG.api.syncSessionsToBackend` 等配置影响）

## 读写边界（P0 约定）

- **UI 组件**：
  - 只能读：配置（`PET_CONFIG`）、manager 暴露的只读字段、store/computed
  - 写入必须走：hooks 的 `methods`，再由 `methods` 调用 manager（或显式的 service）
- **业务模块 / PetManager**：
  - 负责写入业务状态与触发持久化（例如 `saveState`）
  - 负责协调远端同步（例如会话保存后入队/立即同步）
- **核心工具层（core/utils, core/api）**：
  - 不持有 UI 状态
  - 只提供能力（存储、请求、错误处理），并保证 API 形状稳定

## 与网络层协作：缓存、并发与一致性

- **取消与并发**：
  - UI 层用 `AbortController` 取消长请求（ChatWindow 已有实践）
  - `RequestClient` 支持 `abortKey` 做“新请求覆盖旧请求”（见 `core/utils/api/request.js`）
- **一致性**：
  - 对同一份会话数据的写入，应集中在 `SessionManager`（或 `SessionService.queueSave/saveSession`）路径，避免多处写导致覆盖。

## 常见问题与排查

### Q1：`chrome.storage` 写入失败 / 配额超限

- **推荐排查**：
  - 先确认是否走了 `StorageHelper.set(...)`（`core/bootstrap/bootstrap.js`）
  - 检查 console 是否出现“存储配额超出，尝试清理旧数据...”

### Q2：扩展热重载后出现 “上下文失效”

- **现象**：`chrome.runtime.lastError` 或调用存储时报错 invalidated
- **建议**：使用 `StorageHelper.isChromeStorageAvailable()` 兜底；必要时提示用户刷新页面/重新加载扩展

### Q3：组件里状态与 manager 不一致

- **建议**：
  - 组件 store 初始化时尽量从 manager 派生（如 `searchValue`）
  - 所有写入动作回到 `methods` → manager，避免组件本地偷偷改业务字段

