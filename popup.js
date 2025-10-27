/**
 * Chrome扩展弹窗控制脚本 - 网页摘要
 */

class SummaryController {
    constructor() {
        this.currentTab = null;
        this.init();
    }
    
    async init() {
        try {
            // 获取当前标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
            
            if (!this.currentTab) {
                this.showError('无法获取当前标签页');
                return;
            }
            
            // 初始化UI
            this.setupEventListeners();
            
            // 加载网页摘要
            await this.loadPageSummary();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('初始化失败，请刷新页面后重试');
        }
    }
    
    setupEventListeners() {
        // 保存到笔记
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveToNotes();
            });
        }
        
        // 代码按钮
        const codeBtn = document.getElementById('codeBtn');
        if (codeBtn) {
            codeBtn.addEventListener('click', () => {
                this.showCodeView();
            });
        }
        
        // 视频概览
        const videoBtn = document.getElementById('videoBtn');
        if (videoBtn) {
            videoBtn.addEventListener('click', () => {
                this.showVideoOverview();
            });
        }
        
        // 音频概览
        const audioBtn = document.getElementById('audioBtn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                this.showAudioOverview();
            });
        }
        
        // 思维导图
        const mindmapBtn = document.getElementById('mindmapBtn');
        if (mindmapBtn) {
            mindmapBtn.addEventListener('click', () => {
                this.showMindMap();
            });
        }
    }
    
    async loadPageSummary() {
        try {
            // 获取网页标题
            const pageTitle = this.currentTab.title || this.currentTab.url;
            
            // 获取网页内容
            const pageContent = await this.getPageContent();
            
            // 更新UI
            const titleElement = document.getElementById('pageTitle');
            if (titleElement) {
                titleElement.textContent = pageTitle;
            }
            
            const descElement = document.getElementById('summaryDescription');
            if (descElement) {
                descElement.textContent = pageContent;
            }
            
            // 保持"1个来源"显示
        } catch (error) {
            console.error('加载网页摘要失败:', error);
            this.showError('无法加载网页摘要');
        }
    }
    
    async getPageContent() {
        try {
            // 尝试从content script获取网页内容
            const response = await chrome.tabs.sendMessage(this.currentTab.id, { action: 'getFullPageText' });
            
            if (response && response.text) {
                // 返回完整内容，不做截断
                return response.text;
            }
            
            // 如果无法获取，尝试直接从页面获取
            const results = await chrome.scripting.executeScript({
                target: { tabId: this.currentTab.id },
                function: () => {
                    // 定义需要排除的选择器
                    const excludeSelectors = [
                        'script', 'style', 'nav', 'header', 'footer', 'aside', 
                        'noscript', 'iframe', 'embed', 'svg', 'canvas',
                        '.ad', '.advertisement', '.ads', '.advertisement-container',
                        '.sidebar', '.menu', '.navigation', '.navbar', '.nav',
                        '.header', '.footer', '.comment', '.comments', '.social-share',
                        '.related-posts', '.related', '.widget', '.sidebar-widget',
                        '[class*="ad"]', '[class*="banner"]', '[class*="promo"]',
                        '[id*="ad"]', '[id*="banner"]', '[id*="promo"]',
                        'iframe', 'embed', 'object', 'form', 'button', 'input'
                    ];
                    
                    // 定义主要正文内容选择器
                    const contentSelectors = [
                        'main',
                        'article', 
                        '[role="main"]',
                        '.content', '.main-content', '.page-content',
                        '.post-content', '.entry-content', '.article-content',
                        '.post-body', '.text-content', '.article-body',
                        '#content', '#main-content', '#main',
                        '.article', '.blog-post', '.entry', '.post',
                        '.content-area', '.content-wrapper',
                        '.text-wrapper', '.text-container'
                    ];
                    
                    // 尝试从主要内容区域获取
                    let mainContent = null;
                    for (const selector of contentSelectors) {
                        mainContent = document.querySelector(selector);
                        if (mainContent) break;
                    }
                    
                    if (mainContent) {
                        const cloned = mainContent.cloneNode(true);
                        excludeSelectors.forEach(sel => {
                            try {
                                const elements = cloned.querySelectorAll(sel);
                                elements.forEach(el => el.remove());
                            } catch (e) {}
                        });
                        const textContent = cloned.textContent || cloned.innerText || '';
                        const trimmedText = textContent.trim();
                        if (trimmedText.length > 100) {
                            return trimmedText;
                        }
                    }
                    
                    // 获取页面中所有的文本段落
                    const textElements = Array.from(document.querySelectorAll(
                        'p, div, section, article, main, li, blockquote, ' +
                        'h1, h2, h3, h4, h5, h6, span, pre, code, td, th, dd, dt, ' +
                        'label, legend, caption, summary, details, address, time'
                    ));
                    
                    const allTexts = textElements
                        .map(el => (el.textContent || el.innerText || '').trim())
                        .filter(text => {
                            // 进一步放宽文本长度要求：只要超过3个字符就保留
                            if (text.length < 3) return false;
                            
                            // 只过滤明显的垃圾内容
                            const lowerText = text.toLowerCase();
                            
                            // 只过滤最明显、最简短的无意义文本
                            if (text.length <= 5 && 
                                (lowerText === '更多' || lowerText === 'more' || lowerText === '点击')) {
                                return false;
                            }
                            
                            return true;
                        });
                    
                    // 去重并合并文本（使用更宽松的去重策略）
                    const uniqueTexts = [];
                    const seenTexts = new Set();
                    
                    // 简化的相似度计算函数
                    const calculateSimilarity = (text1, text2) => {
                        if (text1 === text2) return 1.0;
                        if (text1.length === 0 || text2.length === 0) return 0;
                        
                        const longer = text1.length > text2.length ? text1 : text2;
                        const shorter = text1.length > text2.length ? text2 : text1;
                        
                        if (longer.length === 0) return 1.0;
                        
                        let matches = 0;
                        for (let i = 0; i < shorter.length; i++) {
                            if (longer.includes(shorter[i])) {
                                matches++;
                            }
                        }
                        
                        return matches / longer.length;
                    };
                    
                    for (const text of allTexts) {
                        // 检查是否是确切的重复
                        let isExactDuplicate = seenTexts.has(text);
                        
                        if (!isExactDuplicate) {
                            // 更宽松的去重：只在文本非常相似时视为重复
                            let isSimilar = false;
                            for (const seenText of seenTexts) {
                                // 只有当两个长文本几乎完全相同时才视为重复
                                if (text.length > 100 && seenText.length > 100) {
                                    const similarity = calculateSimilarity(text, seenText);
                                    if (similarity > 0.99) { // 99%以上相似才视为重复（几乎完全一致）
                                        isSimilar = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (!isSimilar) {
                                seenTexts.add(text);
                                uniqueTexts.push(text);
                            }
                        }
                    }
                    
                    if (uniqueTexts.length > 0) {
                        return uniqueTexts.join('\n\n').trim();
                    }
                    
                    // 最后尝试从整个body获取
                    const body = document.body;
                    if (body) {
                        const clonedBody = body.cloneNode(true);
                        excludeSelectors.forEach(sel => {
                            try {
                                const elements = clonedBody.querySelectorAll(sel);
                                elements.forEach(el => el.remove());
                            } catch (e) {}
                        });
                        const textContent = clonedBody.textContent || clonedBody.innerText || '';
                        return textContent.trim();
                    }
                    
                    return '暂无内容';
                }
            });
            
            if (results && results[0] && results[0].result) {
                return results[0].result;
            }
            
            // 默认内容
            return '正在为您整理网页内容摘要，请稍候...';
        } catch (error) {
            console.error('获取网页内容失败:', error);
            return '暂时无法获取网页内容';
        }
    }
    
    saveToNotes() {
        const title = document.getElementById('pageTitle').textContent;
        const content = document.getElementById('summaryDescription').textContent;
        
        // 创建笔记数据
        const note = {
            title: title,
            content: content,
            url: this.currentTab.url,
            timestamp: new Date().toISOString()
        };
        
        // 保存到存储
        chrome.storage.local.get(['notes'], (result) => {
            const notes = result.notes || [];
            notes.push(note);
            chrome.storage.local.set({ notes: notes }, () => {
                this.showNotification('已保存到笔记');
            });
        });
    }
    
    showCodeView() {
        window.open(this.currentTab.url, '_blank');
    }
    
    showVideoOverview() {
        this.showNotification('视频概览功能开发中...', 'info');
    }
    
    showAudioOverview() {
        this.showNotification('音频概览功能开发中...', 'info');
    }
    
    showMindMap() {
        this.showNotification('思维导图功能开发中...', 'info');
    }
    
    showError(message) {
        const descElement = document.getElementById('summaryDescription');
        if (descElement) {
            descElement.textContent = message;
            descElement.style.color = '#f44336';
        }
    }

    showNotification(message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        const backgroundColor = type === 'error' ? '#f44336' : 
                               type === 'info' ? '#2196F3' : '#4CAF50';
        
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${backgroundColor};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 1000;
            animation: slideDown 0.3s ease-out;
            pointer-events: none;
        `;
        
        // 添加动画样式
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            if (document.head) {
                document.head.appendChild(style);
            }
        }
        
        if (document.body) {
            document.body.appendChild(notification);
        }
        
        // 3秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new SummaryController();
});
