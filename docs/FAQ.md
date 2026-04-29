# 常见问题与故障排查

> 本文档提供开发过程中的常见问题、报错、异常的快速排查方法和修复方案。
> 供 AI 和人工开发者参考，提升故障处理效率。

## 快速排查索引

| 关键词 | 问题分类 | 跳转 |
|--------|---------|------|
| 宠物不显示 | 页面渲染 | [宠物不显示](#宠物不显示) |
| 聊天窗口打不开 | UI 交互 | [聊天窗口无法打开](#聊天窗口无法打开) |
| 扩展加载失败 | 扩展安装 | [扩展加载失败](#扩展加载失败) |
| 配置未定义 | 初始化错误 | [PET_CONFIG 未定义](#pet_config-未定义) |
| 存储失败 | 数据持久化 | [存储操作失败](#存储操作失败) |

## 页面渲染类

### 宠物不显示

**症状**：网页加载后宠物没有出现，或显示空白

**原因**：
- 在 Chrome 内置页面（chrome://、chrome-extension:// 等）
- Content script 加载顺序问题
- DOM 注入失败
- PET_CONFIG 未正确初始化

**排查步骤**：
1. 检查当前页面 URL 是否为系统页面：
   ```javascript
   // 在 DevTools Console 运行
   window.location.href
   ```
   系统页面（chrome:// 开头）不允许 content script 运行。
2. 打开 DevTools Console 查看错误日志，搜索 `[PetManager]`
3. 检查 `#yi-pet-assistant` 元素是否存在于 DOM 中：
   ```javascript
   document.getElementById('yi-pet-assistant')
   ```
4. 检查 `PET_CONFIG` 是否已定义：
   ```javascript
   typeof PET_CONFIG !== 'undefined'
   ```

**修复方案**：
- 在普通网页（如 https://example.com）测试
- 刷新扩展和网页
- 检查 manifest.json content_scripts 加载顺序

**预防措施**：避免在 chrome:// 页面测试扩展功能。

**来源**：`core/config.js`、`core/bootstrap/bootstrap.js`、`manifest.json`

### 聊天窗口无法打开

**症状**：点击宠物或使用快捷键 `Ctrl+Shift+X` 无反应

**原因**：
- PetManager 未正确初始化
- 聊天窗口元素创建失败
- 事件监听器未绑定
- 快捷键冲突

**排查步骤**：
1. 检查 `window.PetManager` 是否已定义：
   ```javascript
   typeof window.PetManager !== 'undefined'
   ```
2. 检查是否有 JavaScript 错误
3. 尝试直接调用 API：
   ```javascript
   window.petManager?.toggleChat?.()
   ```

**修复方案**：
- 刷新网页重新加载 content script
- 检查是否有其他扩展占用相同快捷键

**来源**：`modules/pet/content/petManager.events.js`

## 初始化错误类

### PET_CONFIG 未定义

**症状**：Console 显示 `PET_CONFIG is not defined` 或 `Cannot read properties of undefined`

**原因**：
- `core/config.js` 未在 manifest.json 中排在首位
- config.js 加载失败
- 命名空间污染

**排查步骤**：
1. 检查 manifest.json content_scripts 顺序，确保 `core/config.js` 排在第一个
2. 在 DevTools Console 运行：
   ```javascript
   typeof PET_CONFIG !== 'undefined'
   typeof window.PET_CONFIG !== 'undefined'
   ```

**修复方案**：确保 manifest.json 中 content_scripts 按依赖顺序加载，`core/config.js` 必须在第一位。

**来源**：`core/config.js`、`manifest.json`

### 存储操作失败

**症状**：无法保存会话或设置，Console 显示存储相关错误

**原因**：
- chrome.storage 不可用（非扩展环境）
- 存储配额超限
- 扩展上下文失效（context invalidated）

**排查步骤**：
1. 检查是否在扩展环境中运行：
   ```javascript
   typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && chrome.runtime.id
   ```
2. 检查 StorageHelper 诊断：
   ```javascript
   window.StorageHelper?.isChromeStorageAvailable?.()
   ```
3. 查看 Console 是否有 `QUOTA_EXCEEDED_ERR` 或 `context invalidated` 错误

**修复方案**：
- 如果是上下文失效：刷新网页
- 如果是配额超限：清理旧数据
- 检查代码是否正确处理存储错误

**来源**：`core/bootstrap/bootstrap.js`、`modules/pet/content/petManager.state.js`

## 扩展安装类

### 扩展加载失败

**症状**：在 `chrome://extensions/` 页面显示错误，无法加载扩展

**原因**：
- manifest.json 语法错误
- 引用的文件路径不存在
- Manifest V3 兼容性问题

**排查步骤**：
1. 查看扩展错误详情（点击「错误」按钮）
2. 验证 manifest.json 语法
3. 检查所有引用的文件路径是否真实存在

**修复方案**：根据错误详情修复 manifest.json 或文件路径。

**来源**：`manifest.json`

## AI 辅助开发常见问题

### 文件路径虚构

**症状**：代码或文档引用不存在的文件路径

**排查步骤**：
1. 验证文件是否存在：
   ```bash
   ls -la <file-path>
   ```
2. 检查路径大小写（macOS 文件系统默认不区分大小写，但 git 区分）

**修复方案**：替换为正确路径或标注「待补充」。

### 防幻觉遗漏

**症状**：文档包含无依据的技术断言或配置

**排查步骤**：交叉验证：
```bash
grep -r "<keyword>" <directory>
```

**修复方案**：标注「待补充（原因：未找到依据）」或补充实际验证。

### 工具限制

**症状**：工具返回不足或被截断

**修复方案**：标注「待补充」或切换工具/方法。

## 自愈系统参考

> 以下内容由 `tool-chain-logger` 和 `agent 记忆` 自动补充，记录从实际错误案例中提炼的自愈规则。

| 根因分类 | 典型症状 | 自愈排查命令 | 自愈修复操作 | 案例来源 |
|---------|---------|-------------|-------------|---------|
| 路径虚构 | 引用文件不存在 | `ls -la <path>` 或 `glob <模式>` | 替换为正确路径或标注「待补充」 | 待补充 |
| 防幻觉遗漏 | 文档包含虚构内容 | 交叉验证：`grep <keyword>` | 标注「待补充（原因：…）」 | 待补充 |
| 归类错误 | 检查项/commit 归类错误 | 检查 `rules/<类型>.md` 归类规则 | 按规则重新归类 | 待补充 |
| 工具限制 | 工具返回不足 | 检查工具输出完整性 | 标注「待补充」或切换工具 | 待补充 |
| 逻辑缺陷 | 推断结果不合理 | 对比实际代码模式 | 增加采样文件数量 | 待补充 |
| 规则缺失 | 无对应规则约束 | 检查 `rules/` 和 `checklists/` | 新增/调整规则 | 待补充 |
| 格式不符 | 输出格式不合规 | 对照 `rules/<类型>.md` 模板 | 按模板修正格式 | 待补充 |
