// 在页面上下文中渲染 mermaid 图表的脚本
(function() {
    'use strict';
    
    // 从 data 属性或 window 变量中获取 mermaid ID
    let mermaidId = window.__MERMAID_RENDER_ID__;
    
    // 如果没有设置，尝试从隐藏的容器元素中获取
    if (!mermaidId) {
        const idContainer = document.getElementById('__mermaid_render_id_container__');
        if (idContainer) {
            mermaidId = idContainer.getAttribute('data-mermaid-id');
        }
    }
    
    if (!mermaidId) {
        console.error('[RenderMermaid] 未提供 mermaid ID');
        window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
            detail: { id: '', success: false, error: '未提供 ID' } 
        }));
        return;
    }
    
    // 使用轮询方式查找元素（等待 DOM 更新）
    let attempts = 0;
    const maxAttempts = 20; // 最多尝试 20 次，每次 50ms，总共 1 秒
    
    const tryRender = () => {
        attempts++;
        
        try {
            const mermaidDiv = document.getElementById(mermaidId);
            
            if (!mermaidDiv) {
                if (attempts < maxAttempts) {
                    // 等待一段时间后重试
                    setTimeout(tryRender, 50);
                    return;
                } else {
                    console.error('[RenderMermaid] 找不到 mermaid div:', mermaidId, '尝试了', attempts, '次');
                    window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                        detail: { id: mermaidId, success: false, error: '找不到 div (超时)' } 
                    }));
                    return;
                }
            }
            
            if (typeof mermaid === 'undefined' || typeof mermaid.run !== 'function') {
                if (attempts < maxAttempts) {
                    // 等待 mermaid 加载
                    setTimeout(tryRender, 50);
                    return;
                } else {
                    console.error('[RenderMermaid] Mermaid 不可用');
                    window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                        detail: { id: mermaidId, success: false, error: 'Mermaid 不可用' } 
                    }));
                    return;
                }
            }
            
            // 找到元素且 mermaid 可用，执行渲染
            mermaid.run({
                nodes: [mermaidDiv],
                suppressErrors: true
            }).then(() => {
                console.log('[RenderMermaid] Mermaid 图表渲染成功:', mermaidId);
                window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                    detail: { id: mermaidId, success: true } 
                }));
            }).catch((error) => {
                console.error('[RenderMermaid] 渲染 Mermaid 图表失败:', error);
                window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                    detail: { id: mermaidId, success: false, error: error.message } 
                }));
            });
        } catch (error) {
            console.error('[RenderMermaid] 执行渲染时出错:', error);
            window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                detail: { id: mermaidId, success: false, error: error.message } 
            }));
        }
    };
    
    // 延迟第一次尝试，确保 DOM 已更新
    setTimeout(tryRender, 100);
})();

