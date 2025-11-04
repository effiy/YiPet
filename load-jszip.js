// 在页面上下文中加载 jszip.min.js 的脚本
(function() {
    'use strict';
    
    // 检查是否已经加载
    if (window.__JSZIP_LOADED__) {
        return;
    }
    
    // 从 data 属性或 window 变量中获取 jszip.min.js 的 URL
    let scriptUrl = window.__JSZIP_SCRIPT_URL__;
    
    // 如果没有设置，尝试从隐藏的容器元素中获取
    if (!scriptUrl) {
        const urlContainer = document.getElementById('__jszip_url_container__');
        if (urlContainer) {
            scriptUrl = urlContainer.getAttribute('data-jszip-url');
        }
    }
    
    // 如果仍然没有，尝试使用 chrome API（在扩展上下文中可用）
    if (!scriptUrl && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        scriptUrl = chrome.runtime.getURL('jszip.min.js');
    }
    
    if (!scriptUrl) {
        console.error('[LoadJSZip] 无法获取 jszip.min.js 的 URL');
        window.dispatchEvent(new CustomEvent('jszip-load-error', { 
            detail: { error: '无法获取脚本 URL' } 
        }));
        return;
    }
    
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.charset = 'UTF-8';
    script.async = false;
    
    script.onload = function() {
        console.log('[LoadJSZip] JSZip.js 脚本加载完成');
        setTimeout(() => {
            if (typeof JSZip !== 'undefined') {
                window.__JSZIP_LOADED__ = true;
                window.__JSZIP_READY__ = true;
                console.log('[LoadJSZip] JSZip.js 加载完成');
                window.dispatchEvent(new CustomEvent('jszip-loaded'));
            } else {
                console.error('[LoadJSZip] JSZip 对象未找到');
                window.__JSZIP_ERROR__ = true;
                window.dispatchEvent(new CustomEvent('jszip-error', { 
                    detail: { error: 'JSZip 对象未找到' } 
                }));
            }
        }, 100);
    };
    
    script.onerror = function(error) {
        console.error('[LoadJSZip] 加载 JSZip.js 失败:', error);
        window.__JSZIP_ERROR__ = true;
        window.dispatchEvent(new CustomEvent('jszip-error', { 
            detail: { error: '脚本加载失败' } 
        }));
    };
    
    (document.head || document.documentElement).appendChild(script);
    window.__JSZIP_LOADING__ = true;
    console.log('[LoadJSZip] 开始加载 JSZip.js:', scriptUrl);
})();


