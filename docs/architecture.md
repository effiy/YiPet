# YiPet 项目架构约定

> `.claude/` 下的 agents 和 rules 通过引用本文件获取项目特有约束。

## 目录组织

```
YiPet/
├── core/                    # 核心模块
│   ├── config.js            # 全局配置与环境检测
│   ├── utils/               # 通用工具函数集
│   │   ├── api/             # API 相关工具
│   │   ├── logging/         # 日志工具
│   │   ├── error/           # 错误处理
│   │   ├── dom/             # DOM 工具
│   │   ├── session/         # 会话管理
│   │   ├── media/           # 媒体处理
│   │   └── ui/              # UI 工具
│   ├── api/                 # API 请求管理与服务
│   │   └── core/            # 核心 API 管理器
│   ├── constants/           # 常量定义
│   ├── bootstrap/           # Content Script 入口与初始化
│   └── module.md            # 模块清单
├── modules/                 # 功能模块
│   ├── pet/                 # 宠物管理核心模块（UI、聊天、会话等）
│   ├── faq/                 # FAQ 管理与标签
│   ├── mermaid/             # Mermaid 图表渲染
│   ├── extension/           # 扩展系统（background/popup）
│   ├── chat/                # 聊天导出功能
│   ├── screenshot/          # 区域截图功能
│   └── session/             # 会话导入导出
├── libs/                    # 第三方库
│   ├── vue.global.js        # Vue 3 (Global Build)
│   ├── marked.min.js        # Markdown 解析
│   ├── turndown.js          # HTML 转 Markdown
│   ├── mermaid.min.js       # 图表渲染
│   └── md5.js               # MD5 哈希
├── assets/                  # 静态资源
│   ├── styles/              # 样式文件
│   ├── icons/               # 图标资源
│   └── images/              # 图片资源
├── docs/                    # 项目文档
├── manifest.json            # Chrome Extension 配置入口
├── CLAUDE.md                # 项目行为准则
└── README.md                # 项目说明
```

## 放置规则

| 类型 | 存放位置 | 判断标准 |
|------|---------|---------|
| 核心配置 | `core/` | 全局使用、多模块依赖 |
| 工具函数 | `core/utils/` | 通用功能、无业务逻辑 |
| API 服务 | `core/api/` | 网络请求、数据获取 |
| 业务模块 | `modules/` | 独立功能、有 UI 交互 |
| 第三方库 | `libs/` | 外部依赖、不修改源码 |
| 静态资源 | `assets/` | 样式、图标、图片 |

**禁止**：直接修改 `libs/` 下的第三方库源码（通过适配器模式封装）。

## 核心架构模式

### 1. IIFE 模块封装

所有业务模块使用立即执行函数表达式封装，挂载到 `window.PetManager` 命名空间。

```javascript
(function () {
  'use strict'

  class PetManager {
    // 核心实现
  }

  window.PetManager = PetManager
})()
```

**来源**：`modules/pet/content/core/petManager.core.js`

### 2. 配置中心模式

全局配置统一通过 `PET_CONFIG` 访问，支持环境切换（production/staging/development）。

| 文件 | 职责 | 返回 |
|------|------|------|
| `core/config.js` | 全局配置与环境检测 | `window.PET_CONFIG` |

**来源**：`core/config.js`

**禁止**：在 content script 中直接硬编码 API 地址或密钥。

### 3. Content Script 加载顺序

manifest.json 中 content_scripts 按依赖顺序加载：

```javascript
// 1. 核心配置
'core/config.js',
// 2. 第三方库
'libs/md5.js',
'libs/marked.min.js',
'libs/turndown.js',
'libs/vue.global.js',
// 3. 工具函数
'core/utils/api/token.js',
'core/utils/api/logger.js',
'core/utils/api/error.js',
'core/utils/api/request.js',
'core/utils/media/imageResourceManager.js',
'core/utils/ui/loadingAnimationMixin.js',
'core/utils/ui/loadingAnimation.js',
'core/utils/logging/loggerUtils.js',
'core/utils/error/errorHandler.js',
'core/utils/dom/domHelper.js',
'core/constants/endpoints.js',
// 4. API 服务
'core/api/core/ApiManager.js',
'core/api/services/SessionService.js',
'core/utils/session/sessionManager.js',
'core/api/services/FaqService.js',
// 5. 初始化入口
'core/bootstrap/bootstrap.js',
// 6. 业务模块
'modules/pet/content/core/petManager.core.js',
// ... 更多业务模块
'core/bootstrap/index.js'
```

**来源**：`manifest.json`

### 4. Vue 组件注册模式

Vue 组件使用 IIFE 封装，挂载到 `window.PetManager.Components` 命名空间。

```javascript
(function () {
  'use strict'

  if (!window.PetManager) window.PetManager = {}
  if (!window.PetManager.Components) window.PetManager.Components = {}

  window.PetManager.Components.ChatWindow = {
    // 组件定义
  }
})()
```

**来源**：`modules/pet/components/chat/ChatWindow/`

### 5. 状态管理 Hooks 工厂模式

使用 createStore + useComputed + useMethods 模式进行状态管理。

```javascript
// store.js - 创建状态存储
const createStore = (initialState) => {
  let state = { ...initialState }
  const listeners = new Set()

  return {
    getState: () => state,
    setState: (newState) => {
      state = { ...state, ...newState }
      listeners.forEach(listener => listener(state))
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

// useComputed.js - 计算属性
// useMethods.js - 方法定义
```

**来源**：`modules/pet/components/chat/ChatWindow/hooks/`

## 模块结构

```
modules/pet/
├── content/                # Content Script 代码
│   ├── core/              # 核心类定义
│   ├── modules/           # 功能子模块
│   ├── session/           # 会话管理
│   ├── ai/                # AI 功能
│   ├── editor/            # 编辑器功能
│   ├── mermaid/           # Mermaid 渲染
│   └── petManager.js      # 模块聚合入口
├── components/            # Vue 组件
│   ├── chat/              # 聊天窗口组件
│   ├── modal/             # 弹窗组件
│   ├── manager/           # 管理器组件
│   └── editor/            # 编辑器组件
└── module.md              # 模块依赖清单
```

## 编码规范

### 语法

- 使用 ES6+ 语法
- 优先使用 `const`，避免 `var`
- 使用 `async/await` 处理异步操作
- 分号结束语句
- 2 空格缩进

### 命名

- 变量和函数使用 `camelCase`
- 类和构造函数使用 `PascalCase`
- 常量使用 `UPPER_SNAKE_CASE`
- 文件命名使用 `kebab-case` 或 `camelCase`

### Vue API 风格

- Vue 3 使用 Global Build（无需构建）
- 组件通过 `window.PetManager.Components` 注册
- 使用 `createApp` + `mount` 挂载组件
- 状态管理使用自定义 Hooks 工厂

### 注释与文件组织

- 使用 JSDoc 风格注释关键函数和模块
- 单个文件不宜过大（按功能拆分）
- 相关文件放在同一目录下
- 使用 `module.md` 记录模块依赖

## 实施顺序

1. 先加载 `core/config.js`（配置中心）
2. 再加载第三方库和工具函数
3. 然后加载 API 服务
4. 最后加载业务模块和初始化入口
5. 新增 content_scripts 需在 manifest.json 中按依赖顺序插入
