# YiPet 源代码迁移指南

## 概述

本指南描述了将YiPet项目从旧结构迁移到新的模块化架构的过程。新的架构采用了功能模块化、页面组件化的设计，支持更好的代码组织和扩展性。

## 新目录结构

```
src/
├── assets/                    # 静态资源
│   ├── icons/                # 图标文件
│   └── images/               # 图片资源
├── config/                   # 配置管理
│   └── app.js               # 应用配置
├── core/                     # 核心模块
│   ├── ModuleManager.js     # 模块管理器
│   └── YiPetApplication.js  # 应用核心类
├── modules/                  # 功能模块
│   ├── pet/                 # 宠物模块
│   ├── chat/                # 聊天模块
│   ├── screenshot/          # 截图模块
│   ├── mermaid/             # 流程图模块
│   ├── faq/                 # FAQ模块
│   └── session/             # 会话模块
├── pages/                    # 页面模块
│   ├── popup/               # 弹出窗口
│   ├── background/          # 后台脚本
│   ├── content/             # 内容脚本
│   └── options/             # 选项页面
├── shared/                   # 共享资源
│   ├── api/                 # API接口
│   ├── constants/           # 常量定义
│   ├── types/               # 类型定义
│   └── utils/               # 工具函数
├── styles/                   # 样式文件
└── views/                    # 视图文件（旧结构，将逐步迁移）
```

## 迁移步骤

### 1. 核心模块迁移

#### 已完成：
- ✅ 创建 `src/core/ModuleManager.js` - 模块生命周期管理
- ✅ 创建 `src/core/YiPetApplication.js` - 应用核心类
- ✅ 创建 `src/config/app.js` - 应用配置管理

#### 模块管理器特性：
- 支持模块依赖解析
- 支持模块优先级排序
- 支持模块生命周期管理（init/start/stop/destroy）
- 支持模块间通信
- 支持模块状态监控

### 2. 功能模块迁移

#### 宠物模块 (src/modules/pet/)
```
pet/
├── constants/          # 宠物相关常量
├── core/              # 核心功能（PetManagerCore, PetStateManager, PetEventManager）
├── hooks/             # React Hooks（usePetState, usePetDrag, usePetChat等）
├── services/          # 业务服务（PetAIService, PetAuthService）
├── types/             # 类型定义
├── ui/                # UI组件（PetAvatar, PetDrag, PetChat等）
├── utils/             # 工具函数
└── index.js           # 模块入口
```

#### 其他功能模块
- chat/ - 聊天功能模块
- screenshot/ - 截图功能模块
- mermaid/ - 流程图功能模块
- faq/ - FAQ功能模块
- session/ - 会话管理模块

### 3. 页面模块迁移

#### 弹出窗口模块 (src/pages/popup/)
```
popup/
├── constants/          # 弹出窗口常量
├── core/              # 核心功能（PopupManagerCore）
├── hooks/             # React Hooks（usePopup）
├── services/          # 业务服务（PopupService）
├── types/             # 类型定义
├── utils/             # 工具函数
└── index.js           # 模块入口
```

#### 其他页面模块
- background/ - 后台脚本模块
- content/ - 内容脚本模块
- options/ - 选项页面模块

### 4. 共享资源迁移

#### 共享工具函数 (src/shared/utils/)
- domHelper.js - DOM操作工具
- errorHandler.js - 错误处理
- loggerUtils.js - 日志工具
- messageHelper.js - 消息处理
- storageUtils.js - 存储工具
- timeUtils.js - 时间工具
- urlUtils.js - URL工具

#### 共享API (src/shared/api/)
- baseApiManager.js - API基础管理
- faqApi.js - FAQ相关API
- sessionApi.js - 会话相关API
- tokenUtils.js - Token工具

### 5. 样式迁移

#### 样式文件 (src/styles/)
- base/animations.css - 动画样式
- base/reset.css - 重置样式
- base/theme.css - 主题样式
- index.css - 主样式文件
- popup.css - 弹出窗口样式
- content.css - 内容脚本样式

## 迁移检查清单

### 模块迁移检查
- [ ] 模块是否有清晰的职责划分？
- [ ] 模块是否遵循单一职责原则？
- [ ] 模块是否有明确的依赖关系？
- [ ] 模块是否提供了必要的生命周期方法？
- [ ] 模块是否使用了统一的导出格式？

### 代码质量检查
- [ ] 代码是否遵循项目编码规范？
- [ ] 是否有适当的错误处理？
- [ ] 是否有适当的日志记录？
- [ ] 是否有适当的类型检查？
- [ ] 是否有适当的注释？

### 性能检查
- [ ] 模块加载是否按需进行？
- [ ] 是否有适当的缓存机制？
- [ ] 是否有内存泄漏风险？
- [ ] 是否有性能瓶颈？

### 兼容性检查
- [ ] 是否兼容不同的浏览器？
- [ ] 是否兼容不同的扩展环境？
- [ ] 是否向后兼容？
- [ ] 是否有适当的降级处理？

## 迁移最佳实践

### 1. 逐步迁移
- 不要一次性迁移所有代码
- 优先迁移核心功能和常用功能
- 保持旧代码运行，逐步替换

### 2. 测试驱动
- 为每个模块编写测试用例
- 确保迁移后的功能与原来一致
- 进行集成测试验证模块间协作

### 3. 文档同步
- 更新相关文档
- 记录API变更
- 提供迁移示例

### 4. 代码审查
- 进行代码审查确保质量
- 收集团队反馈
- 持续改进架构

## 常见问题解决

### 1. 循环依赖
- 使用依赖注入
- 重构模块职责
- 使用事件总线

### 2. 模块间通信
- 使用事件系统
- 使用共享状态管理
- 使用服务层抽象

### 3. 性能问题
- 懒加载非关键模块
- 使用代码分割
- 优化模块初始化

### 4. 错误处理
- 统一的错误处理机制
- 模块级错误边界
- 全局错误监控

## 后续计划

1. **第一阶段**：完成核心模块和popup模块迁移
2. **第二阶段**：迁移其他功能模块
3. **第三阶段**：迁移页面组件和样式
4. **第四阶段**：优化和测试
5. **第五阶段**：文档更新和发布

## 联系方式

如有迁移相关问题，请联系开发团队或提交Issue。