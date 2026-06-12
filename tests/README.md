# YiPet 测试体系

> vitest + jsdom 自动化测试。9 个测试文件覆盖 6 核心基础设施 + 2 模块 + 1 集成回归，总计 14 文件。

## 快速开始

```bash
# 运行全部测试（输出 JSON 结果到 tests/results.json）
node tests/run.mjs

# 按分类运行
node tests/run.mjs --unit          # 仅 6 个单元测试
node tests/run.mjs --integration   # 仅集成测试
node tests/run.mjs --modules       # 仅模块测试

# 直接运行 vitest（文本输出，不写 results.json）
npx vitest run

# 运行单个测试文件
npx vitest run tests/unit/token.test.mjs
npx vitest run tests/integration/pipeline.test.mjs

# 列出测试文件
node tests/run.mjs --list
```

## 目录结构

```
tests/
├── run.mjs                          # 测试运行器：桥接 vitest JSON → results.json
├── manifest.json                    # 测试清单（14 条目，含 lib + setup）
├── results.json                     # 测试结果（自动生成）
├── index.html                       # 交互式测试仪表板
├── README.md                        # 本文件
├── setup.mjs                        # 全局测试初始化（chrome mock + fetch mock）
├── lib/
│   ├── chrome-mock.mjs              # chrome.storage.local/runtime mock — Map 后端 + EventEmitter
│   ├── fetch-helpers.mjs            # fetch mock 工厂 — makeApiResponse/makeApiError/mockFetchError
│   ├── load-module.mjs              # IIFE 模块加载器 — 将全局 IIFE 模块注入 jsdom 作用域
│   └── test-utils.mjs               # 测试辅助工具 — 共享断言和工具函数
├── unit/
│   ├── token.test.mjs               # Token 三级降级验证 — 5 套件 27 断言
│   ├── api.test.mjs                 # HTTP 客户端全路径 — 7 套件 34 断言
│   ├── request.test.mjs             # RequestClient 核心 — 7 套件 30 断言
│   ├── storage.test.mjs             # chrome.storage mock + StorageHelper — 5 套件 46 断言
│   ├── config.test.mjs              # DEFAULT_CONFIG 结构/环境检测 — 4 套件 20 断言
│   └── error.test.mjs               # 7 种 Error 子类/ErrorHandler — 5 套件 33 断言
├── integration/
│   └── pipeline.test.mjs            # SessionService + FaqService 端到端 — 4 套件 42 断言
└── modules/
    ├── pet/components/
    │   └── ChatWindow.test.mjs      # ChatWindow/ChatInput Vue 3 组件 — 2 套件 6 断言
    └── extension/
        └── sw.test.mjs              # Service Worker messageRouter 路由 — 1 套件 8 断言
```

## 测试框架

### vitest + jsdom

基于 Vite 的测试框架，jsdom 提供浏览器环境模拟。配置见 `vitest.config.js`：

- **环境**: `jsdom` — 模拟浏览器 DOM、window、document
- **全局**: `true` — describe/it/expect 无需导入
- **Setup**: `tests/setup.mjs` — 每个测试文件前自动执行

### setup.mjs

全局测试初始化，每个 vitest 测试文件执行前自动运行：

- 导入 `chrome-mock.mjs` 注册全局 `chrome` mock
- 导入 `fetch-helpers.mjs` 注册 `makeApiResponse`/`makeApiError`/`mockFetchError` 全局函数
- 导入 `load-module.mjs` 提供 IIFE 模块注入能力
- `beforeEach` 重置 mock 状态
- `afterEach` 恢复所有 mock

### test lib 库

| 文件 | 行数 | 用途 |
|------|------|------|
| chrome-mock.mjs | 147 | `chrome.storage.local` + `chrome.runtime` mock — Map 后端 + EventEmitter 事件系统 |
| fetch-helpers.mjs | 64 | fetch mock 工厂 — 生成标准 API 响应/错误/网络异常的辅助函数 |
| load-module.mjs | 61 | IIFE 模块加载器 — 将项目中的 IIFE 全局模块注入 jsdom `window` 作用域 |
| test-utils.mjs | 28 | 共享断言和通用工具函数 |

## 测试覆盖矩阵

| 被测对象 | 测试文件 | 用例数 | 覆盖维度 |
|---------|---------|--------|---------|
| TokenManager | unit/token.test.mjs | 27 | 三级降级 · 构造校验 · MD5 指纹 · 环境变量回退 · 空 token 处理 |
| ApiManager | unit/api.test.mjs | 34 | HTTP 方法 · 请求头注入 · 超时重试 · Abort 中断 · 响应解析 |
| RequestClient | unit/request.test.mjs | 30 | 方法封装 · 请求头管理 · 超时控制 · URL 构建 · 工厂创建 |
| StorageHelper + SessionManager | unit/storage.test.mjs | 46 | chrome.storage mock · 读写操作 · 配额管理 · LRU 淘汰 · 会话 CRUD |
| DEFAULT_CONFIG | unit/config.test.mjs | 20 | 配置结构 · buildUrl · buildQueryParams · 环境检测 |
| 7 种 Error 子类 + ErrorHandler | unit/error.test.mjs | 33 | 错误分类 · 上下文失效检测 · 重试判定 · 辅助函数 |
| SessionService + FaqService | integration/pipeline.test.mjs | 42 | 端到端 CRUD · 搜索过滤 · 标签关联 · 批量操作 |
| ChatWindow/ChatInput | modules/.../ChatWindow.test.mjs | 6 | Vue 3 组件挂载 · props 交互 · 事件触发 |
| Service Worker | modules/.../sw.test.mjs | 8 | messageRouter action 路由 · 异常处理 · 消息格式校验 |

## 约定

1. **vitest 原生断言** — 使用 `describe`/`it`/`expect` 标准 API，不引入额外测试框架
2. **jsdom 环境隔离** — 每个测试文件独立 jsdom 实例，不共享 DOM 状态
3. **chrome API mock** — 所有 chrome API 调用通过 `tests/lib/chrome-mock.mjs` 模拟，不依赖真实浏览器
4. **IIFE 模块注入** — 被测模块通过 `load-module.mjs` 注入 jsdom 作用域，模拟 content-script 运行环境
5. **测试先行** — 新功能必须先写测试设计（TC#）再实现（Gate A 门禁）
