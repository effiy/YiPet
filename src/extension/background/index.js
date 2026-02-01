/**
 * Chrome扩展后台脚本
 *
 * 功能说明：
 * - 处理扩展的安装、更新和生命周期管理
 * - 管理消息传递（popup <-> background <-> content script）
 * - 监控网络请求（API请求记录）
 * - 处理标签页注入和宠物初始化
 * - 提供截图、权限检查等系统级功能
 */

try {
    importScripts('bootstrap/imports.js');
    importScripts('app/register.js');
} catch (e) {
    try {
        console.error('Background 初始化失败:', e);
    } catch (_) {}
}
