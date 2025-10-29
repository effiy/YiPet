// 在页面上下文中注入的脚本，用于加载 mermaid
(function() {
    'use strict';
    
    // 检查是否已经加载
    if (window.__MERMAID_LOADED__) {
        return;
    }
    
    const scriptUrl = chrome.runtime.getURL('mermaid.min.js');
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.charset = 'UTF-8';
    script.async = false;
    
    script.onload = function() {
        console.log('[Inject] Mermaid.js 脚本加载完成');
        // 给一点时间让 mermaid 初始化
        setTimeout(() => {
            if (typeof mermaid !== 'undefined' && mermaid.initialize) {
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
                console.log('[Inject] Mermaid.js 初始化完成');
            } else {
                console.error('[Inject] Mermaid 对象未找到');
            }
        }, 100);
    };
    
    script.onerror = function(error) {
        console.error('[Inject] 加载 Mermaid.js 失败:', error);
        window.__MERMAID_LOADED__ = false;
        window.__MERMAID_ERROR__ = true;
    };
    
    (document.head || document.documentElement).appendChild(script);
    window.__MERMAID_LOADING__ = true;
    console.log('[Inject] 开始加载 Mermaid.js:', scriptUrl);
})();

