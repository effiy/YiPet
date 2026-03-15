# 项目结构

```
温柔陪伴助手/
├── manifest.json                    # 扩展清单文件
├── CLAUDE.md                        # Claude Code 指导文档
├── README.md                        # 项目说明文档
├── docs/                            # 文档目录
│   ├── structure.md                 # 项目结构说明（本文件）
│   └── superpowers/
│       ├── specs/                   # 设计规范文档
│       └── plans/                   # 实施计划文档
├── cdn/
│   ├── core/                        # 核心工具和配置
│   │   ├── config.js               # 集中配置
│   │   ├── bootstrap/              # 引导/初始化代码
│   │   └── constants/              # 常量（端点等）
│   ├── libs/                        # 第三方库
│   ├── assets/                      # 样式、图片、图标
│   ├── components/                  # Vue.js 组件
│   └── utils/                       # 工具模块
├── src/
│   ├── extension/
│   │   └── background/              # 后台服务 worker
│   │       ├── index.js             # 后台入口
│   │       ├── actions/             # 消息处理器
│   │       └── messaging/           # 消息路由
│   ├── features/
│   │   ├── petManager/              # 核心宠物管理（内容脚本）
│   │   │   ├── petManager.js        # 主入口
│   │   │   ├── core/                # 核心实现
│   │   │   ├── modules/             # 功能模块
│   │   │   └── petManager.*.js      # 功能文件
│   │   ├── chat/                    # 聊天功能
│   │   ├── faq/                     # FAQ 系统
│   │   ├── session/                 # 会话导入/导出
│   │   └── mermaid/                 # Mermaid 图表渲染
│   ├── api/                         # API 集成层
│   │   ├── core/                    # API 请求管理
│   │   ├── services/                # 会话、FAQ 服务
│   │   └── utils/                   # 令牌、日志、错误处理
│   └── views/                       # Popup UI
```
