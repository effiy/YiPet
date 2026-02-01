// 在页面上下文中加载 mermaid.js 的脚本
(function() {
    'use strict';
    
    // 检查是否已经加载
    if (window.__MERMAID_LOADED__) {
        return;
    }
    
    // 从 data 属性或 window 变量中获取 mermaid.min.js 的 URL
    let scriptUrl = window.__MERMAID_SCRIPT_URL__;
    
    // 如果没有设置，尝试从隐藏的容器元素中获取
    if (!scriptUrl) {
        const urlContainer = document.getElementById('__mermaid_url_container__');
        if (urlContainer) {
            scriptUrl = urlContainer.getAttribute('data-mermaid-url');
        }
    }
    
    // 如果仍然没有，尝试使用 chrome API（在扩展上下文中可用）
    if (!scriptUrl && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        scriptUrl = chrome.runtime.getURL('libs/mermaid.min.js');
    }
    
    if (!scriptUrl) {
        console.error('[LoadMermaid] 无法获取 mermaid.min.js 的 URL');
        window.dispatchEvent(new CustomEvent('mermaid-load-error', { 
            detail: { error: '无法获取脚本 URL' } 
        }));
        return;
    }
    
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.charset = 'UTF-8';
    script.async = false;
    
    script.onload = function() {
        console.log('[LoadMermaid] Mermaid.js 脚本加载完成');
        setTimeout(() => {
            if (typeof mermaid !== 'undefined' && typeof mermaid.initialize === 'function') {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    flowchart: {
                        useMaxWidth: true,
                        htmlLabels: true
                    }
                });
                window.__MERMAID_LOADED__ = true;
                window.__MERMAID_READY__ = true;
                console.log('[LoadMermaid] Mermaid.js 初始化完成');
                window.dispatchEvent(new CustomEvent('mermaid-loaded'));
            } else {
                console.error('[LoadMermaid] Mermaid 对象未找到或没有 initialize 方法');
                window.__MERMAID_ERROR__ = true;
                window.dispatchEvent(new CustomEvent('mermaid-error', { 
                    detail: { error: 'Mermaid 对象未找到' } 
                }));
            }
        }, 100);
    };
    
    script.onerror = function(error) {
        console.error('[LoadMermaid] 加载 Mermaid.js 失败:', error);
        window.__MERMAID_ERROR__ = true;
        window.dispatchEvent(new CustomEvent('mermaid-error', { 
            detail: { error: '脚本加载失败' } 
        }));
    };
    
    (document.head || document.documentElement).appendChild(script);
    window.__MERMAID_LOADING__ = true;
    console.log('[LoadMermaid] 开始加载 Mermaid.js:', scriptUrl);
})();

