# 温柔陪伴助手 项目架构约定

> .claude/ 下的 agents 和 rules 通过引用本文件获取项目特有约束。

## 目录组织

```
YiPet/
├── core/                    # 核心模块
│   ├── config.js            # 全局配置与环境检测
│   ├── utils/               # 通用工具函数集
│   ├── api/                 # API 请求管理与服务
│   ├── constants/           # 常量定义
│   ├── bootstrap/           # Content Script 入口与初始化
│   └── module.md            # 模块清单
├── modules/                 # 功能模块
│   ├── pet/                 # 宠物管理核心模块
│   │   ├── content/         # 核心逻辑
│   │   └── components/      # Vue 组件
│   ├── faq/                 # FAQ 管理与标签
│   ├── mermaid/             # Mermaid 图表渲染
│   ├── extension/           # 扩展系统（background/popup）
│   ├── chat/                # 聊天导出功能
│   ├── screenshot/          # 区域截图功能
│   └── session/             # 会话导入导出
├── libs/                    # 第三方库
├── assets/                  # 静态资源
│   ├── styles/              # 样式文件
│   ├── icons/               # 图标
│   └── images/              # 图片资源
├── docs/                    # 项目文档
├── manifest.json            # 扩展配置文件
├── CLAUDE.md                # 项目行为准则
└── README.md                # 项目说明
```

## 放置规则

| 类型 | 存放位置 | 判断标准 |
|------|---------|---------|
| 共享工具 | core/utils/ | 至少 2 个模块使用 |
| 共享 API | core/api/ | 至少 2 个模块使用 |
| 模块特有逻辑 | modules/xxx/ | 只在单个模块中使用 |
| Vue 组件 | modules/xxx/components/ | 与特定模块相关 |
| 第三方库 | libs/ | 外部依赖，不修改源码 |

**禁止**：在 content script 中使用 ES modules（需要使用传统 script 方式通过 manifest.json 加载）

## 核心架构模式

### 1. IIFE 命名空间模式：模块封装标准

所有业务模块使用 IIFE 封装，挂载到 `window.PetManager` 命名空间，避免全局污染。

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

代码示例取自实际项目的 Vue 组件 hooks 定义（modules/pet/components/chat/ChatWindow/hooks/useMethods.js）。

### 2. Hooks 工厂模式：状态管理标准

状态管理使用 createStore + useComputed + useMethods 的工厂模式，提供响应式状态和方法封装。

| 文件 | 职责 | 返回 |
|------|------|------|
| store.js | 创建响应式状态存储 | 包含 ref 状态的对象 |
| useComputed.js | 定义计算属性 | 计算属性对象 |
| useMethods.js | 定义方法 | 方法对象 |

代码示例取自实际项目的 store.js（modules/pet/components/chat/ChatWindow/hooks/store.js）：

```javascript
(function () {
  'use strict'

  if (!window.PetManager) window.PetManager = {}
  if (!window.PetManager.Components) window.PetManager.Components = {}
  if (!window.PetManager.Components.ChatWindowHooks) window.PetManager.Components.ChatWindowHooks = {}

  window.PetManager.Components.ChatWindowHooks.createStore = function createStore(manager) {
    const { ref } = window.Vue
    return {
      searchValue: ref(manager.sessionTitleFilter || '')
    }
  }
})()
```

### 3. Manifest.json 加载顺序：依赖管理标准

manifest.json 中 content_scripts 按依赖顺序插入，确保被依赖的文件先加载。

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "core/config.js",
        "libs/md5.js",
        "core/utils/api/token.js",
        "core/utils/api/logger.js",
        "core/utils/api/error.js",
        "core/utils/api/request.js",
        "...其他依赖...",
        "modules/pet/content/core/petManager.core.js",
        "...其他模块...",
        "core/bootstrap/index.js"
      ]
    }
  ]
}
```

**禁止**：在 manifest.json 中随意调整 js 文件顺序，必须遵循依赖关系。

### 4. 类继承与混入：复用标准

使用 ES6 class 继承和混入模式复用功能，如 PetManager 继承 LoadingAnimationMixin。

```javascript
class PetManager extends LoadingAnimationMixin {
  constructor() {
    super()
    this.pet = null
    // ...
  }
  // ...
}
```

代码示例取自实际项目的 petManager.core.js。

### 5. 安全访问与错误处理：稳定性标准

- 安全访问：使用可选链、默认值、类型检查
- 错误处理：使用 try-catch、错误回调、错误日志
- 用户消息：使用通知提示用户错误
- 存储错误：专门处理 chrome.storage 的配额错误和上下文失效错误

```javascript
window.StorageHelper = {
  isChromeStorageAvailable() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime) return false
      try {
        return !!chrome.runtime.id
      } catch (error) {
        return false
      }
    } catch (error) {
      return false
    }
  },
  // ...
}
```

代码示例取自实际项目的 bootstrap.js。

## modules/pet 结构

```
modules/pet/
├── content/                # 核心逻辑
│   ├── core/               # 核心类定义
│   │   └── petManager.core.js
│   ├── modules/            # 功能子模块
│   │   ├── petManager.auth.js
│   │   ├── petManager.roles.js
│   │   ├── petManager.robot.js
│   │   ├── petManager.ai.js
│   │   ├── petManager.session.js
│   │   ├── petManager.tags.js
│   │   ├── petManager.parser.js
│   │   ├── petManager.messaging.js
│   │   ├── petManager.pageInfo.js
│   │   ├── petManager.mermaid.js
│   │   ├── petManager.sessionEditor.js
│   │   └── petManager.editor.js
│   ├── petManager.js       # 模块入口
│   ├── petManager.ui.js    # UI 管理
│   ├── petManager.drag.js  # 拖拽功能
│   ├── petManager.pet.js   # 宠物管理
│   ├── petManager.state.js # 状态管理
│   ├── petManager.chat.js  # 聊天功能
│   ├── petManager.chatUi.js # 聊天 UI
│   ├── petManager.events.js # 事件处理
│   ├── petManager.media.js # 媒体处理
│   └── petManager.message.js # 消息处理
├── components/             # Vue 组件
│   ├── chat/               # 聊天相关组件
│   │   ├── ChatWindow/     # 聊天窗口主组件
│   │   ├── ChatHeader/     # 聊天窗口头部
│   │   ├── ChatInput/      # 聊天输入框
│   │   └── ChatMessages/   # 聊天消息列表
│   ├── modal/              # 模态框组件
│   │   ├── TokenSettingsModal/
│   │   └── AiSettingsModal/
│   ├── manager/            # 管理器组件
│   │   ├── SessionTagManager/
│   │   ├── FaqManager/
│   │   └── FaqTagManager/
│   └── editor/             # 编辑器组件
│       └── SessionInfoEditor/
└── module.md               # 模块清单
```

## 编码规范

### 语法

- 使用 ES6+ 语法
- 优先使用 const，避免使用 var
- 使用分号结尾
- 使用单引号（除非需要字符串模板）
- 使用箭头函数处理回调（注意 this 绑定）
- 使用 async/await 处理异步

### 命名

- 变量和函数：camelCase（如 sessionTitleFilter、onSearchInput）
- 类：PascalCase（如 PetManager、LoadingAnimationMixin）
- 常量：UPPER_SNAKE_CASE（如 SESSION_UPDATE_DEBOUNCE、STATE_SAVE_THROTTLE）
- 私有属性：下划线前缀（如 _currentAbortController、_suppressDragUntil）
- 布尔值：is/has/can 前缀（如 isVisible、hasAutoCreatedSessionForPage）
- 样式类：kebab-case（如 pet-chat-content、yi-pet-chat-header-btn）

### Vue 3 API 风格

- 使用组合式 API（Vue 3 Global Build）
- 使用 ref 定义响应式状态
- 使用 computed 定义计算属性
- 组件通过 IIFE 命名空间挂载到 window.PetManager.Components
- Hooks 工厂模式：createStore + useComputed + useMethods

### 注释与文件组织

- 文件顶部使用 JSDoc 风格注释说明文件用途
- 关键函数使用 JSDoc 注释说明参数和返回值
- 复杂逻辑添加行内注释说明意图
- 导入顺序：先第三方库，再内部模块
- 单个文件不宜过大（建议 < 1000 行）
- 按功能模块化组织代码

## 实施顺序

1. 先更新 core/config.js（配置先行）
2. 再实现 core/utils/ 工具函数（基础建设）
3. 然后实现 core/api/ 服务（数据层）
4. 接着实现 modules/pet/ 核心模块（业务核心）
5. 最后更新 manifest.json（集成）
