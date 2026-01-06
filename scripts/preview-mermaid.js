// 在页面上下文中预览 mermaid 图表的脚本
(function() {
    'use strict';
    
    // 从 data 属性或 window 变量中获取预览 ID
    let previewId = window.__MERMAID_PREVIEW_ID__;
    
    // 如果没有设置，尝试从隐藏的容器元素中获取
    if (!previewId) {
        const idContainer = document.getElementById('__mermaid_preview_id_container__');
        if (idContainer) {
            previewId = idContainer.getAttribute('data-mermaid-id');
        }
    }
    
    if (!previewId) {
        console.error('[PreviewMermaid] 未提供预览 ID');
        window.dispatchEvent(new CustomEvent('mermaid-preview-error', { 
            detail: { id: '', error: '未提供 ID' } 
        }));
        return;
    }
    
    try {
        const mermaidDiv = document.getElementById(previewId);
        if (!mermaidDiv) {
            window.dispatchEvent(new CustomEvent('mermaid-preview-error', { 
                detail: { id: previewId, error: '找不到 div' } 
            }));
            return;
        }
        
        if (typeof mermaid === 'undefined' || typeof mermaid.run !== 'function') {
            window.dispatchEvent(new CustomEvent('mermaid-preview-error', { 
                detail: { id: previewId, error: 'Mermaid 不可用' } 
            }));
            return;
        }
        
        mermaid.run({
            nodes: [mermaidDiv],
            suppressErrors: true
        }).then(() => {
            window.dispatchEvent(new CustomEvent('mermaid-preview-success', { 
                detail: { id: previewId } 
            }));
        }).catch((error) => {
            window.dispatchEvent(new CustomEvent('mermaid-preview-error', { 
                detail: { id: previewId, error: error.message } 
            }));
        });
    } catch (error) {
        window.dispatchEvent(new CustomEvent('mermaid-preview-error', { 
            detail: { id: previewId, error: error.message } 
        }));
    }
})();


