# 安全策略与自检规则

> 本文档描述项目的安全策略，供 AI 和人工开发者参考。AI 在实施涉及安全的代码时，必须遵守本文档的自检规则。

## 安全架构概览

| 维度 | 策略 | 代码来源 |
|------|------|---------|
| 传输安全 | HTTPS（生产环境） | core/config.js API 端点配置 |
| 内容安全策略 | 待补充 | manifest.json |
| 跨域策略 | host_permissions 配置 | manifest.json |
| 输入消毒 | 待补充 | 待补充 |
| XSS 防护 | Markdown 渲染时 HTML 过滤 | marked 渲染逻辑 |
| CSRF 防护 | 待补充 | 待补充 |
| 依赖安全 | 使用本地第三方库（libs/ 目录） | manifest.json web_accessible_resources |

## 威胁模型

| 威胁类型 | 风险等级 | 当前防护 | 防护代码路径 | 改进建议 |
|---------|---------|---------|-------------|---------|
| XSS 攻击 | 中 | Markdown 渲染 | 待补充 | 加强输入消毒 |
| Token 泄露 | 高 | 存储在 chrome.storage.local | core/utils/api/token.js | 添加 Token 加密 |
| 权限过度申请 | 中 | 最小权限原则 | manifest.json permissions | 持续审查权限 |
| 恶意网页访问扩展资源 | 中 | web_accessible_resources 限制 | manifest.json | 待补充 |

## 安全自检规则

### 必须遵守（P0）

| # | 自检项 | 检查方法 | 不通过的后果 |
|---|--------|---------|-------------|
| 1 | 不在 localStorage 存储敏感信息（Token 等） | `grep -r 'localStorage' modules/ core/` | 敏感信息可能被恶意网站读取 |
| 2 | 使用 chrome.storage.local 存储 Token | 检查 core/utils/api/token.js | 使用 localStorage 风险更高 |
| 3 | manifest.json 中只申请必要的权限 | 检查 manifest.json permissions | 权限过度申请增加风险 |
| 4 | 用户输入在渲染前进行消毒 | 检查 Markdown 渲染逻辑 | XSS 攻击风险 |
| 5 | web_accessible_resources 只包含必要资源 | 检查 manifest.json | 恶意网页可能访问扩展资源 |

### 应该遵守（P1）

| # | 自检项 | 检查方法 | 备注 |
|---|--------|---------|------|
| 1 | API 请求使用 HTTPS | 检查 core/config.js API 端点 | 传输安全 |
| 2 | 有内容安全策略（CSP）配置 | 检查 manifest.json content_security_policy | 防止 XSS 和代码注入 |
| 3 | 第三方库使用固定版本 | 检查 libs/ 目录和 manifest.json | 防止依赖链攻击 |

## 典型安全故障与修复

| 症状 | 原因 | 排查命令 | 修复方案 |
|------|------|---------|---------|
| Token 在不同 tab 不同步 | 仅依赖内存缓存 | `chrome.storage.local.get('YiPet.apiToken.v1')` | 添加 chrome.storage.onChanged 监听 |
| 系统页面无法使用宠物 | chrome:// 等页面不允许 content script | 检查 URL 是否在系统页面列表 | 优雅降级处理 |
| 存储配额超限 | 会话数据过大 | `chrome.storage.local.getBytesInUse()` | 实现数据清理策略 |

## 依赖安全审计

| 审计项 | 状态 | 工具/命令 | 上次执行 | 发现问题 |
|---------|------|---------|---------|---------|
| 第三方库版本 | 已检查 | 检查 libs/ 目录 | 2026-04-28 | vue.global.js、marked.min.js、turndown.js、md5.js、mermaid.min.js |
| 权限审查 | 已检查 | 检查 manifest.json permissions | 2026-04-28 | storage、tabs、scripting、webRequest |
| CSP 配置 | 待补充 | 检查 manifest.json | 待补充 | 待补充 |

## 当前权限清单

| 权限 | 用途 | 是否必要 |
|------|------|---------|
| storage | 本地存储 Token、会话、设置 | 是 |
| tabs | 获取当前标签页信息、与 background script 通信 | 是 |
| scripting | 动态注入 content script（待确认） | 待确认 |
| webRequest | 监听网络请求（待确认） | 待确认 |

## web_accessible_resources 清单

| 资源 | 用途 |
|------|------|
| assets/icons/icon.png | 扩展图标 |
| assets/images/*/icon.png | 宠物角色图标 |
| assets/images/*/run/*.png | 宠物动画帧 |
| libs/mermaid.min.js | Mermaid 图表库 |
| modules/mermaid/page/*.js | Mermaid 渲染脚本 |
| modules/pet/components/**/*.html | Vue 组件模板 |

## 核心安全代码路径

| 功能 | 文件路径 | 关键实现 |
|------|---------|---------|
| Token 安全存储 | core/utils/api/token.js | chrome.storage.local、_cachedToken |
| 系统页面检测 | core/config.js | URLS.isSystemPage() |
| 存储安全 | core/utils/storage/（待确认） | 待补充 |
| 错误处理 | core/utils/error/errorHandler.js | 待补充 |
