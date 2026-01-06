// 在页面上下文中渲染 mermaid 图表的脚本
(function() {
    'use strict';
    
    // 从 data 属性或 window 变量中获取 mermaid ID
    let mermaidId = window.__MERMAID_RENDER_ID__;
    
    // 如果没有设置，尝试从隐藏的容器元素中获取
    if (!mermaidId) {
        // 查找所有可能的 ID 容器（支持多个同时处理）
        // 支持新的唯一 ID 格式：__mermaid_render_id_container__${mermaidId}
        // 也支持旧的单一 ID 格式（向后兼容）
        const idContainers = document.querySelectorAll('[id^="__mermaid_render_id_container__"]');
        if (idContainers.length > 0) {
            // 使用第一个找到的容器
            const idContainer = idContainers[0];
            mermaidId = idContainer.getAttribute('data-mermaid-id');
            
            // 验证 ID 是否有效（确保容器 ID 和 data 属性匹配）
            const containerId = idContainer.id;
            if (containerId.includes(mermaidId) || containerId === '__mermaid_render_id_container__') {
                // 清理已使用的容器
                if (idContainer.parentNode) {
                    idContainer.parentNode.removeChild(idContainer);
                }
            } else {
                // ID 不匹配，尝试下一个
                mermaidId = null;
            }
        }
        
        // 如果还是没找到，尝试旧的单一 ID 容器（向后兼容）
        if (!mermaidId) {
            const idContainer = document.getElementById('__mermaid_render_id_container__');
            if (idContainer) {
                mermaidId = idContainer.getAttribute('data-mermaid-id');
                if (mermaidId && idContainer.parentNode) {
                    idContainer.parentNode.removeChild(idContainer);
                }
            }
        }
    }
    
    if (!mermaidId) {
        console.error('[RenderMermaid] 未提供 mermaid ID');
        window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
            detail: { id: '', success: false, error: '未提供 ID' } 
        }));
        return;
    }
    
    // 使用 MutationObserver + 轮询的组合方式查找元素
    let attempts = 0;
    const maxAttempts = 40; // 增加到 40 次
    let found = false;
    let observer = null;
    
    const tryRender = () => {
        if (found) return; // 如果已经找到，不再继续
        
        attempts++;
        
        try {
            // 尝试多种方式查找元素
            let mermaidDiv = document.getElementById(mermaidId);
            
            // 如果通过 ID 找不到，尝试通过类名和内容查找（处理可能的 ID 冲突）
            if (!mermaidDiv && mermaidId) {
                const allMermaidDivs = document.querySelectorAll('.mermaid');
                for (let div of allMermaidDivs) {
                    if (div.id === mermaidId || (div.id && div.id.startsWith('mermaid-'))) {
                        mermaidDiv = div;
                        break;
                    }
                }
            }
            
            if (!mermaidDiv) {
                if (attempts < maxAttempts) {
                    // 等待一段时间后重试，使用指数退避
                    const delay = Math.min(50 + attempts * 10, 200); // 50ms 到 200ms
                    setTimeout(tryRender, delay);
                    return;
                } else {
                    console.error('[RenderMermaid] 找不到 mermaid div:', mermaidId, '尝试了', attempts, '次');
                    // 清理观察者
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                    window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                        detail: { id: mermaidId, success: false, error: '找不到 div (超时)' } 
                    }));
                    return;
                }
            }
            
            // 检查 mermaid 是否可用
            if (typeof mermaid === 'undefined' || typeof mermaid.run !== 'function') {
                if (attempts < maxAttempts) {
                    // 等待 mermaid 加载
                    const delay = Math.min(50 + attempts * 10, 200);
                    setTimeout(tryRender, delay);
                    return;
                } else {
                    console.error('[RenderMermaid] Mermaid 不可用');
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                    window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                        detail: { id: mermaidId, success: false, error: 'Mermaid 不可用' } 
                    }));
                    return;
                }
            }
            
            // 找到元素且 mermaid 可用
            found = true;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            
            // 执行渲染
            mermaid.run({
                nodes: [mermaidDiv],
                suppressErrors: true
            }).then(() => {
                console.log('[RenderMermaid] Mermaid 图表渲染成功:', mermaidId);
                // 获取渲染后的 SVG 内容
                const svgElement = mermaidDiv.querySelector('svg');
                let svgContent = '';
                if (svgElement) {
                    // 克隆 SVG 以获取完整的 XML 字符串
                    const clone = svgElement.cloneNode(true);
                    // 确保 SVG 有正确的命名空间
                    if (!clone.getAttribute('xmlns')) {
                        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    }
                    svgContent = new XMLSerializer().serializeToString(clone);
                }
                window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                    detail: { id: mermaidId, success: true, svgContent: svgContent } 
                }));
            }).catch((error) => {
                console.error('[RenderMermaid] 渲染 Mermaid 图表失败:', error);
                window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                    detail: { id: mermaidId, success: false, error: error.message } 
                }));
            });
        } catch (error) {
            console.error('[RenderMermaid] 执行渲染时出错:', error);
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            window.dispatchEvent(new CustomEvent('mermaid-rendered', { 
                detail: { id: mermaidId, success: false, error: error.message } 
            }));
        }
    };
    
    // 使用 MutationObserver 监听 DOM 变化（更快响应）
    if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver((mutations) => {
            // 检查是否有新的元素添加，然后尝试渲染
            const mermaidDiv = document.getElementById(mermaidId);
            if (mermaidDiv && !found) {
                // 延迟一点，确保元素完全插入
                setTimeout(tryRender, 50);
            }
        });
        
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }
    
    // 延迟第一次尝试，确保 DOM 已更新
    setTimeout(tryRender, 150);
})();


