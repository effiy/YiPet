# 安全策略与自检规则

> 本文档描述项目的安全策略，供 AI 和人工开发者参考。
> AI 在实施涉及安全的代码时，必须遵守本文档的自检规则。

## 安全架构概览

| 维度 | 策略 | 代码来源 |
|------|------|---------|
| 传输安全 | HTTPS | `manifest.json`、`core/config.js` |
| 内容安全策略 | 待补充 | 待补充 |
| 跨域策略 | host_permissions 配置 | `manifest.json` |
| 输入消毒 | 待补充 | 待补充 |
| XSS 防护 | Markdown 渲染不直接使用 innerHTML（待确认） | `modules/pet/content/core/petManager.core.js` |
| CSRF 防护 | 待补充 | 待补充 |
| 依赖安全 | 第三方库预打包在 libs/ | `libs/` |

**来源**：`manifest.json`、`core/config.js`

## 传输安全

API 接口使用 HTTPS 协议：
- 生产环境：`https://api.effiy.cn`
- 测试环境：`https://staging.api.effiy.cn`
- 开发环境：`http://localhost:8000`（仅本地开发）

**来源**：`core/config.js`

## 跨域策略

Manifest V3 配置的 host_permissions：
```json
"<all_urls>",
"https://api.effiy.cn/*"
```

**来源**：`manifest.json`

## 依赖安全

第三方库预打包在 `libs/` 目录，不使用 npm 动态安装：

| 库 | 用途 | 来源 |
|----|------|------|
| `vue.global.js` | Vue 3 UI 框架 | `libs/vue.global.js` |
| `marked.min.js` | Markdown 解析 | `libs/marked.min.js` |
| `turndown.js` | HTML 转 Markdown | `libs/turndown.js` |
| `mermaid.min.js` | 图表渲染 | `libs/mermaid.min.js` |
| `md5.js` | MD5 哈希 | `libs/md5.js` |

**来源**：`libs/`、`manifest.json`

## 威胁模型

| 威胁类型 | 风险等级 | 当前防护 | 防护代码路径 | 改进建议 |
|---------|---------|---------|-------------|---------|
| XSS 攻击 | 中 | Markdown 渲染（需确认） | `modules/pet/content/core/petManager.core.js` | 待补充 |
| 数据泄露 | 中 | chrome.storage.local 隔离存储 | `core/bootstrap/bootstrap.js` | 待补充 |
| 恶意 API 调用 | 中 | Token 由用户管理 | `modules/pet/components/modal/TokenSettingsModal/` | 待补充 |

## 安全自检规则

### 必须遵守（P0）

| # | 自检项 | 检查方法 | 不通过的后果 |
|---|--------|---------|-------------|
| 1 | 不直接修改 libs/ 下第三方库源码 | `ls -la libs/` + git status | 破坏依赖完整性 |
| 2 | 不在 content script 中硬编码 API 密钥 | `grep -r "api_key\|secret\|token" modules/ --include="*.js" \| grep -v "PET_CONFIG\|storageKeys"` | 密钥泄露风险 |
| 3 | API 通信优先使用 HTTPS | 检查 `core/config.js` API 端点 | 中间人攻击风险 |

### 应该遵守（P1）

| # | 自检项 | 检查方法 | 备注 |
|---|--------|---------|------|
| 1 | 用户输入适当转义 | 检查 Markdown 渲染代码 | XSS 防护 |
| 2 | 敏感操作需用户确认 | 检查删除会话等功能 | 误操作防护 |

## 典型安全故障与修复

> 待补充（原因：未找到安全故障案例或修复代码）。

## 依赖安全审计

| 审计项 | 状态 | 工具/命令 | 上次执行 | 发现问题 |
|--------|------|---------|---------|---------|
| 第三方库审计 | 待补充 | 待补充 | 未执行 | 无 |
| 依赖完整性 | 待补充 | git status libs/ | 未执行 | 无 |
