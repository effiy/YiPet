# 常见问题与故障排查

> 本文档提供开发过程中的常见问题、报错、异常的快速排查方法和修复方案。供 AI 和人工开发者参考，提升故障处理效率。

## 快速排查索引

| 关键词 | 问题分类 | 跳转 |
|--------|---------|------|
| 扩展无法加载、manifest.json 错误 | 安装与加载 | [链接](#安装与加载问题) |
| 宠物不显示、扩展上下文失效 | 运行时问题 | [链接](#运行时问题) |
| 聊天功能无法使用、API 错误 | 功能问题 | [链接](#功能问题) |
| 存储配额超出、chrome.storage 错误 | 存储问题 | [链接](#存储问题) |

## 安装与加载问题

### Q: 扩展无法加载到 Chrome 中？

**症状**：chrome://extensions/ 显示"加载已解压的扩展程序失败"或"清单文件缺失或不可读"。

**原因**：
- manifest.json 文件有语法错误
- 目录结构不正确
- 文件权限问题

**排查步骤**：
1. 检查 manifest.json 是否存在于根目录：`ls -la /Users/yi/Yi/YiPet/manifest.json`
2. 使用 JSON 验证工具检查 manifest.json 语法
3. 确认目录结构完整：所有在 manifest.json 中引用的文件都存在

**修复方案**：
- 修复 manifest.json 中的语法错误
- 确保所有引用的文件路径正确

**预防措施**：修改 manifest.json 后先使用 JSON 验证工具检查

### Q: 扩展加载了但在页面中没有反应？

**症状**：chrome://extensions/ 显示扩展已启用，但打开网页没有宠物显示，控制台没有日志。

**原因**：
- content script 加载顺序错误
- 扩展上下文失效（扩展重新加载后页面未刷新）

**排查步骤**：
1. 检查 manifest.json 中 content_scripts 的 js 加载顺序
2. 刷新网页，查看是否有变化
3. 打开网页 DevTools Console 查看是否有错误

**修复方案**：
- 刷新网页
- 检查并修复 content_scripts 加载顺序
- 确保依赖文件在被依赖文件之前加载

**预防措施**：在 manifest.json 中严格按照依赖顺序排列 js 文件

## 运行时问题

### Q: 宠物不显示？

**症状**：扩展已加载，但网页上没有宠物图标出现。

**原因**：
- 浏览器控制台有 JavaScript 错误
- 在不支持的网站上使用（如 Chrome 内部页面）
- 扩展权限问题
- 扩展上下文失效

**排查步骤**：
1. 打开网页 DevTools 查看 Console 是否有错误
2. 尝试在普通的 HTTPS 网站上使用（如 https://example.com）
3. 检查扩展权限是否正确配置
4. 检查 StorageHelper.isChromeStorageAvailable() 是否返回 true

**修复方案**：
- 根据控制台错误修复相应问题
- 刷新网页重新加载扩展
- 在 chrome://extensions/ 重新加载扩展后刷新网页

**预防措施**：代码中添加扩展上下文失效的检测和处理

### Q: 控制台显示"扩展上下文失效"或"Invocation of form chrome.storage.local.get doesn't match definition"?

**症状**：StorageHelper 相关操作报错，提示扩展上下文失效。

**原因**：扩展在 chrome://extensions/ 中被重新加载，但网页没有刷新，旧的 content script 仍在运行。

**排查步骤**：
1. 检查 StorageHelper.isContextInvalidatedError() 是否检测到该错误
2. 检查 chrome.runtime.id 是否存在

**修复方案**：
- 刷新网页即可恢复
- 代码中已有处理逻辑，会检测并跳过操作

**预防措施**：代码中添加了 isChromeStorageAvailable() 和上下文失效检测

## 功能问题

### Q: 聊天功能无法使用？

**症状**：点击宠物或打开聊天窗口，但无法发送消息或没有 AI 回复。

**原因**：
- 网络连接问题
- 未配置有效的 API 令牌
- API 端点配置错误

**排查步骤**：
1. 检查网络连接是否正常
2. 确认已在设置中配置了有效的 API 令牌
3. 查看浏览器控制台的错误信息
4. 检查 core/config.js 中的 API 端点配置

**修复方案**：
- 根据错误信息修复相应问题
- 检查并配置 API 令牌
- 确认 API 端点配置正确

**预防措施**：添加 API 连接测试功能

### Q: 快捷键不生效？

**症状**：按下 Ctrl+Shift+P 或 Ctrl+Shift+X 没有反应。

**原因**：
- 快捷键与其他扩展冲突
- 快捷键与系统快捷键冲突
- manifest.json 中 commands 配置错误

**排查步骤**：
1. 检查 manifest.json 中 commands 配置
2. 检查 chrome://extensions/shortcuts 中的快捷键设置
3. 尝试禁用其他扩展测试是否冲突

**修复方案**：
- 在 chrome://extensions/shortcuts 中修改快捷键
- 禁用冲突的扩展

**预防措施**：选择不常用的组合键作为默认快捷键

## 存储问题

### Q: 控制台显示"存储配额超出"错误？

**症状**：保存会话或设置时报错，提示 QUOTA_BYTES 配额超出。

**原因**：chrome.storage.local 有 5MB 存储限制，数据量过大。

**排查步骤**：
1. 检查 StorageHelper.isQuotaError() 是否检测到该错误
2. 查看是否有清理旧数据的逻辑

**修复方案**：
- 代码中已有清理旧数据的逻辑（StorageHelper.cleanupOldData）
- 手动删除一些旧的会话释放空间

**预防措施**：定期清理旧数据，限制单个会话大小

## 自愈系统参考

> 以下内容由 tool-chain-logger 和 agent 记忆自动补充，记录从实际错误案例中提炼的自愈规则。

| 根因分类 | 典型症状 | 自愈排查命令 | 自愈修复操作 | 案例来源 |
|---------|---------|-------------|-------------|---------|
| 路径虚构 | 引用文件不存在 | `ls <路径>` 或 `glob <模式>` | 替换为正确路径或标注"待补充" | 待补充 |
| 防幻觉遗漏 | 文档包含虚构内容 | 交叉验证：`grep <关键词>` | 标注"待补充（原因：…）" | 待补充 |
| 归类错误 | 检查项/commit 归类错误 | 检查 rules/<类型>.md 归类规则 | 按规则重新归类 | 待补充 |
| 工具限制 | 工具返回不足 | 检查工具输出完整性 | 标注"待补充"或切换工具 | 待补充 |
| 逻辑缺陷 | 推断结果不合理 | 对比实际代码模式 | 增加采样文件数量 | 待补充 |
| 规则缺失 | 无对应规则约束 | 检查 rules/ 和 checklists/ | 新增/调整规则 | 待补充 |
| 格式不符 | 输出格式不合规 | 对照 rules/<类型>.md 模板 | 按模板修正格式 | 待补充 |
| 扩展上下文失效 | chrome.storage 操作报错 | 检查 chrome.runtime.id 是否存在 | 刷新网页或跳过操作 | bootstrap.js StorageHelper |
| 存储配额超出 | chrome.storage.local.set 失败 | 检查存储使用量 | 清理旧数据并重试 | bootstrap.js StorageHelper |
