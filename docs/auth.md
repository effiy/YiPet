# 认证与鉴权方案

> 本文档描述项目的认证/鉴权架构，供 AI 和人工开发者参考。
> AI 在实施涉及鉴权的代码时，必须遵守本文档的自检规则。

## 认证架构概览

| 维度 | 方案 | 配置来源 |
|------|------|---------|
| 认证方式 | API Token 认证 | `core/config.js`、`modules/pet/components/modal/TokenSettingsModal/` |
| Token 类型 | 用户自定义 API Token | `PET_CONFIG.api` |
| Token 存储 | chrome.storage.local | `modules/pet/content/petManager.state.js` |
| Token 传递 | HTTP Header Authorization: Bearer | `core/utils/api/request.js`、`core/api/core/ApiManager.js` |
| 登录入口 | Token 设置弹窗 | `modules/pet/components/modal/TokenSettingsModal/` |
| 登出入口 | Token 设置（清除） | `modules/pet/components/modal/TokenSettingsModal/` |

**来源**：`core/config.js`、`modules/pet/content/modules/petManager.auth.js`、`modules/pet/components/modal/TokenSettingsModal/`

## 认证流程

> 待补充（原因：未找到完整认证流程时序图或代码）。

## 鉴权流程

> 待补充（原因：未找到权限层级或鉴权流程代码）。

## Token 管理

### 生命周期

| 阶段 | 行为 | 代码路径 | 配置 |
|------|------|---------|------|
| 获取 | 用户在 Token 设置弹窗输入 | `modules/pet/components/modal/TokenSettingsModal/` | `PET_CONFIG.constants.storageKeys` |
| 存储 | 保存到 chrome.storage.local | `modules/pet/content/petManager.state.js` | `storageKeys.settings` |
| 传递 | 通过 Authorization Header 传递 | `core/utils/api/request.js`、`core/api/core/ApiManager.js` | `PET_CONFIG.api` |
| 刷新 | 待补充 | 待补充 | 待补充 |
| 过期 | 待补充 | 待补充 | 待补充 |
| 销毁 | 用户在设置中清除 Token | `modules/pet/components/modal/TokenSettingsModal/` | - |

**来源**：`core/config.js`、`modules/pet/content/petManager.state.js`

### Token 安全

- Token 存储在 chrome.storage.local（扩展隔离存储）
- 未发现明文 localStorage 存储 Token 的代码
- 通过 HTTPS 传输（api.effiy.cn 使用 HTTPS）

**来源**：`manifest.json`、`core/config.js`

## 鉴权自检规则

> 待补充（原因：未找到鉴权相关代码，无法推断自检规则）。

## 无认证场景

> 以下内容标注「待补充」，供后续补充鉴权方案时参考。

| 章节 | 状态 |
|------|------|
| 认证架构概览 | 部分完成（Token 方案） |
| 认证流程时序图 | 待补充 |
| 鉴权流程 | 待补充 |
| 权限层级 | 待补充 |
| 权限定义 | 待补充 |
| 鉴权自检规则 | 待补充 |
| 典型故障与修复 | 待补充 |
