# generate-document weekly 编排会话日志

> **时间**: 2026-04-29
> **流程**: /generate-document weekly

---

## 操作场景 1：规范检索与项目基础文件读取

**对话与交互摘要**:
- 读取 .claude/skills/generate-document/rules/周报.md 获取周报生成规范
- 读取 CLAUDE.md、README.md、docs/architecture.md 等项目基础文件
- 扫描 docs/ 目录获取本周活跃功能目录（项目初始化）
- 读取 .claude/agents/memory/knowledge.md 获取 agent 记忆
- 读取 git log 获取本周提交记录

**结果**: 获取了完整的项目上下文与规范要求

---

## 操作场景 2：周报生成

**对话与交互摘要**:
- 基于规则生成周报结构：文档头部、KPI 量化总表、本周复盘、链路全景图、后期规划与优先级矩阵
- 从 docs/项目初始化/06_实施总结.md 提取 KPI 数据
- 从 git log 提取本周进展
- 从 .claude/agents/memory/knowledge.md 提取复盘根因
- 生成 Mermaid 图表（链路全景图和优先级矩阵）
- 保存周报到 docs/周报/2026-04-27~2026-05-03/周报.md

**结果**: 周报生成完成

---

## 操作场景 3：import-docs 文档同步

**对话与交互摘要**:
- 执行 node .claude/skills/import-docs/scripts/import-docs.js --dir docs --exts md
- 同步 18 个文件：1 个新建（周报）、17 个覆盖（项目初始化文档等）
- 同步状态：全部成功

**结果**: 文档同步完成

---

## 操作场景 4：wework-bot 通知发送

**对话与交互摘要**:
- 读取 .claude/skills/wework-bot/config.json 确认路由配置
- 构建符合 rules/message-contract.md 规范的消息正文
- 写入临时文件 tmp-wework-message.md
- 调用 node .claude/skills/wework-bot/scripts/send-message.js --agent generate-document --content-file ...
- 响应状态 200，消息发送成功
- 清理临时文件

**结果**: 企业微信通知发送成功

---

## 总览

**技能调用**:
- generate-document（本技能）
- import-docs
- wework-bot

**Agent 相关**:
- 读取了 spec-retriever、knowledge-curator 的记忆
- 读取了 rules/周报.md 规范

**关键产出**:
- docs/周报/2026-04-27~2026-05-03/周报.md
- import-docs 同步 18 个文件
- wework-bot 通知发送成功
