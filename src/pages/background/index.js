// Background Service Worker - Minimal Version

// 基本日志
console.log('Background Service Worker starting...');

// Service Worker 生命周期管理
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        console.log('首次安装');
    } else if (details.reason === 'update') {
        console.log('扩展更新');
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Service Worker 启动');
});

// 扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
    console.log('扩展图标被点击，标签页:', tab.id);
});

// 简单的消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message);
    
    if (message.action === 'ping') {
        sendResponse({ pong: true, timestamp: Date.now() });
    } else {
        sendResponse({ error: 'Unknown action' });
    }
    
    return true;
});

// 错误处理
self.addEventListener('error', (event) => {
    console.error('Service Worker 错误:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});

console.log('Background Service Worker 加载完成');