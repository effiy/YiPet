# 构建与部署运维流程

> 本文档描述 YiPet 项目的构建、部署和运维流程。

## 环境要求

| 环境 | 最低版本 | 说明 |
|------|---------|------|
| Chrome 浏览器 | >= 88 | 支持 Manifest V3 |
| 开发工具 | - | Chrome DevTools |

> 待补充：Node.js 版本要求（如需）。

## 安装与加载

### 开发模式加载

1. 克隆仓库
```bash
git clone <repository-url>
cd YiPet
```

2. 打开 Chrome 浏览器，访问 `chrome://extensions/`

3. 开启右上角的「开发者模式」开关

4. 点击「加载已解压的扩展程序」按钮

5. 选择 YiPet 项目根目录

6. 扩展加载完成，任意网页即可看到虚拟宠物

**来源**：`README.md`

### 权限说明

Manifest V3 声明的权限：

| 权限 | 用途 |
|------|------|
| `storage` | 本地数据持久化（宠物状态、会话、设置等） |
| `tabs` | 标签页管理和查询 |
| `scripting` | 脚本注入功能 |
| `webRequest` | 网络请求监控和拦截 |
| `<all_urls>` | 在所有网页运行 content script |
| `https://api.effiy.cn/*` | 访问 AI 服务接口 |

**来源**：`manifest.json`

## 构建流程

### 零构建架构

YiPet 采用零构建架构，无需 npm install 或 build 步骤：

```
无需构建
├── 直接加载源码到 Chrome
├── 原生 JavaScript 运行
├── Vue 3 使用 Global Build
├── 所有依赖预先打包在 libs/
└── 修改代码后刷新扩展即可
```

**来源**：`CLAUDE.md`、`README.md`

### 更新扩展

代码修改后，在 `chrome://extensions/` 页面点击刷新按钮重新加载扩展：

1. 修改代码文件
2. 访问 `chrome://extensions/`
3. 找到 YiPet 扩展
4. 点击刷新图标 🔄
5. 刷新网页查看变化

## 部署流程

### 打包发布（待补充）

> 待补充：打包为 .crx 或 .zip 的流程。

### 发布到 Chrome Web Store（待补充）

> 待补充：Chrome Web Store 发布流程。

## 运维监控

### 日志查看

Content Script 日志：
1. 打开任意网页
2. 按 F12 打开 DevTools
3. 查看 Console 标签页，筛选 `[PetManager]` 前缀日志

Background Script 日志：
1. 访问 `chrome://extensions/`
2. 找到 YiPet 扩展
3. 点击「Service Worker」链接
4. 查看 Console 标签页

### 数据备份与恢复

数据存储在 `chrome.storage.local`：

- 备份：使用会话导出功能导出会话
- 恢复：使用会话导入功能恢复会话

> 待补充：完整数据备份/恢复方案。

## 常见问题

### 扩展加载失败

**症状**：在 `chrome://extensions/` 显示错误

**排查步骤**：
1. 检查 manifest.json 语法是否正确
2. 检查 content_scripts 引用的文件路径是否存在
3. 查看扩展错误详情

### 宠物不显示

**症状**：网页加载后宠物没有出现

**排查步骤**：
1. 检查是否在 Chrome 内置页面（chrome:// 等）- 这些页面不允许 content script
2. 打开 DevTools Console 查看错误日志
3. 检查扩展是否启用
4. 使用快捷键 `Ctrl+Shift+P`（Mac: `Cmd+Shift+P`）尝试切换显示

**来源**：`core/bootstrap/bootstrap.js`、`manifest.json`

### 聊天窗口无法打开

**症状**：点击宠物或使用快捷键无反应

**排查步骤**：
1. 检查是否有 JavaScript 错误
2. 检查 `PET_CONFIG` 是否已正确加载
3. 检查 DOM 元素是否正确创建
