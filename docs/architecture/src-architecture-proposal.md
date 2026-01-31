# Src 目录结构优化方案

## 核心理念：功能模块化 + 页面组件化

### 1. 功能模块化 (Feature-based Architecture)

```
src/
├── modules/                    # 功能模块目录
│   ├── pet/                   # 宠物功能模块
│   │   ├── core/              # 核心逻辑
│   │   │   ├── PetManager.js
│   │   │   ├── PetState.js
│   │   │   └── PetEvents.js
│   │   ├── services/          # 业务服务
│   │   │   ├── AuthService.js
│   │   │   ├── AIService.js
│   │   │   ├── SessionService.js
│   │   │   ├── MessageService.js
│   │   │   └── MediaService.js
│   │   ├── ui/                # UI组件
│   │   │   ├── components/    # 通用组件
│   │   │   │   ├── PetAvatar/
│   │   │   │   ├── PetAnimation/
│   │   │   │   └── PetControls/
│   │   │   ├── chat/          # 聊天相关组件
│   │   │   │   ├── ChatWindow/
│   │   │   │   ├── ChatInput/
│   │   │   │   ├── ChatMessages/
│   │   │   │   └── ChatHeader/
│   │   │   ├── session/       # 会话相关组件
│   │   │   │   ├── SessionList/
│   │   │   │   ├── SessionItem/
│   │   │   │   ├── SessionSidebar/
│   │   │   │   └── SessionSearch/
│   │   │   └── layout/        # 布局组件
│   │   │       ├── PetContainer/
│   │   │       └── PetOverlay/
│   │   ├── hooks/             # 自定义Hooks
│   │   │   ├── usePetState.js
│   │   │   ├── useChat.js
│   │   │   ├── useSession.js
│   │   │   └── useDrag.js
│   │   ├── store/             # 状态管理
│   │   │   ├── petStore.js
│   │   │   ├── chatStore.js
│   │   │   └── sessionStore.js
│   │   ├── utils/             # 模块工具函数
│   │   │   ├── petHelpers.js
│   │   │   ├── chatHelpers.js
│   │   │   └── validation.js
│   │   ├── constants/         # 模块常量
│   │   │   ├── petTypes.js
│   │   │   ├── messageTypes.js
│   │   │   └── eventTypes.js
│   │   └── types/             # TypeScript类型定义
│   │       ├── pet.types.js
│   │       ├── chat.types.js
│   │       └── session.types.js
│   │
│   ├── chat/                  # 聊天功能模块
│   │   ├── services/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   │
│   ├── screenshot/            # 截图功能模块
│   │   ├── services/
│   │   ├── components/
│   │   └── utils/
│   │
│   ├── mermaid/               # Mermaid图表模块
│   │   ├── services/
│   │   ├── components/
│   │   └── utils/
│   │
│   ├── faq/                   # FAQ功能模块
│   │   ├── services/
│   │   ├── components/
│   │   └── utils/
│   │
│   └── session/               # 会话管理模块
│       ├── services/
│       ├── components/
│       └── utils/
```

### 2. 页面组件化 (Page-based Components)

```
src/
├── pages/                     # 页面级组件
│   ├── popup/                 # 弹窗页面
│   │   ├── PopupApp.js
│   │   ├── PopupApp.css
│   │   ├── components/        # 页面私有组件
│   │   └── utils/            # 页面私有工具
│   │
│   ├── content/               # 内容脚本页面
│   │   ├── ContentApp.js
│   │   ├── components/
│   │   └── utils/
│   │
│   └── background/            # 背景脚本页面
│       ├── BackgroundApp.js
│       ├── handlers/          # 消息处理器
│       ├── routers/           # 路由管理
│       └── services/          # 后台服务
```

### 3. 共享资源 (Shared Resources)

```
src/
├── shared/                    # 共享资源
│   ├── api/                   # API接口
│   │   ├── base/              # 基础API
│   │   ├── endpoints/         # 具体接口
│   │   └── interceptors/        # 拦截器
│   │
│   ├── utils/                 # 工具函数
│   │   ├── dom/               # DOM操作
│   │   ├── storage/           # 存储相关
│   │   ├── validation/        # 验证相关
│   │   └── helpers/           # 通用助手
│   │
│   ├── constants/             # 全局常量
│   ├── types/                 # 全局类型
│   └── assets/                # 静态资源
│       ├── icons/
│       ├── images/
│       └── styles/
```

### 4. 核心配置和启动

```
src/
├── core/                      # 核心配置
│   ├── config/                # 配置文件
│   ├── bootstrap/               # 启动文件
│   └── plugins/               # 插件系统
│
├── app/                       # 应用入口
│   ├── background.js          # 背景脚本入口
│   ├── content.js             # 内容脚本入口
│   ├── popup.js               # 弹窗入口
│   └── options.js             # 选项页面入口
```

## 优势说明

### 1. 功能模块化优势

- **高内聚低耦合**：每个功能模块独立，职责单一
- **易于测试**：模块独立，方便单元测试
- **便于维护**：功能修改只影响对应模块
- **支持渐进式开发**：可以独立开发新功能模块

### 2. 页面组件化优势

- **组件复用**：通用组件可在不同页面复用
- **结构清晰**：页面级组件与功能组件分离
- **开发效率**：组件化开发提高开发效率
- **易于扩展**：新增页面只需添加对应目录

### 3. 整体架构优势

- **可维护性**：清晰的目录结构便于定位和维护
- **可扩展性**：支持功能模块和页面的快速扩展
- **团队协作**：不同开发者可以负责不同模块
- **性能优化**：支持按需加载和代码分割

## 迁移策略

### 阶段1：建立新结构

1. 创建新的目录结构
2. 移动和重组现有文件
3. 更新导入路径

### 阶段2：代码重构

1. 拆分大型文件（如petManager.js）
2. 提取通用组件和工具函数
3. 优化模块间依赖关系

### 阶段3：验证和优化

1. 测试所有功能正常
2. 优化构建配置
3. 完善文档和类型定义

## 实施建议

1. **保持向后兼容**：逐步迁移，避免一次性大改
2. **遵循单一职责**：每个文件只负责一个功能
3. **统一命名规范**：使用清晰一致的命名规则
4. **完善类型定义**：为更好的开发体验添加类型
5. **建立文档**：记录模块职责和使用方式
