/**
 * Mermaid 图表处理模块
 * 负责 Mermaid 图表的加载、渲染和交互
 */
(function (global) {
    const proto = global.PetManager.prototype;

    // 加载 Mermaid.js (CDN)
    proto.loadMermaid = async function () {
        if (this.mermaidLoaded || this.mermaidLoading) {
            return this.mermaidLoaded;
        }

        this.mermaidLoading = true;

        return new Promise((resolve, reject) => {
            // 检查是否已经加载（从 content_scripts 自动加载或之前动态加载）
            const mermaidLib = (typeof mermaid !== 'undefined') ? mermaid :
                (typeof window !== 'undefined' && window.mermaid) ? window.mermaid : null;

            if (mermaidLib && typeof mermaidLib.initialize === 'function') {
                try {
                    // 初始化 mermaid
                    mermaidLib.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        flowchart: {
                            useMaxWidth: true,
                            htmlLabels: true
                        }
                    });
                    this.mermaidLoaded = true;
                    this.mermaidLoading = false;
                    console.log('Mermaid.js 已加载并初始化');
                    resolve(true);
                    return;
                } catch (error) {
                    console.error('初始化 Mermaid 失败:', error);
                    this.mermaidLoading = false;
                    reject(error);
                    return;
                }
            }

            // 使用注入脚本在页面上下文中加载 mermaid
            // 这样可以确保 mermaid 在页面的 window 对象中可用
            const scriptUrl = chrome.runtime.getURL('src/libs/mermaid.min.js');
            const loadScriptUrl = chrome.runtime.getURL('src/features/mermaid/load-mermaid.js');
            console.log('尝试在页面上下文中加载 Mermaid.js，URL:', scriptUrl);

            // 通过 data 属性传递 URL（避免内联脚本）
            // 注：我们仍然需要通过页面上下文传递 URL，使用隐藏的 data 属性
            const urlContainer = document.createElement('div');
            urlContainer.id = '__mermaid_url_container__';
            urlContainer.style.display = 'none';
            urlContainer.setAttribute('data-mermaid-url', scriptUrl);
            (document.head || document.documentElement).appendChild(urlContainer);

            // 修改 load-mermaid.js 以从 data 属性读取 URL
            // 但更简单的方法是在 load-mermaid.js 中直接使用 chrome.runtime.getURL
            // 因为 load-mermaid.js 在页面上下文中执行，无法直接访问 chrome API
            // 所以我们需要通过 data 属性传递

            // 加载外部脚本文件（避免 CSP 限制）
            const injectedScript = document.createElement('script');
            injectedScript.src = loadScriptUrl;
            injectedScript.charset = 'UTF-8';
            injectedScript.async = false;

            // 监听页面中的 mermaid 加载事件（在脚本加载前设置）
            const handleMermaidLoaded = () => {
                console.log('[Content] 收到 Mermaid 加载完成事件');
                // Mermaid 已经在页面上下文中加载（通过 load-mermaid.js）
                // 由于 content script 的隔离环境，我们无法直接访问页面的 window.mermaid
                // 但我们知道它已经加载，可以通过外部脚本执行渲染
                this.mermaidLoaded = true;
                this.mermaidLoading = false;
                console.log('[Content] Mermaid.js 在页面上下文中已加载');
                window.removeEventListener('mermaid-loaded', handleMermaidLoaded);
                window.removeEventListener('mermaid-error', handleMermaidError);
                resolve(true);
            };

            const handleMermaidError = () => {
                console.error('[Content] 收到 Mermaid 加载失败事件');
                this.mermaidLoading = false;
                window.removeEventListener('mermaid-loaded', handleMermaidLoaded);
                window.removeEventListener('mermaid-error', handleMermaidError);
                reject(new Error('页面上下文中的 Mermaid.js 加载失败'));
            };

            // 监听页面事件（通过注入的事件监听器）
            window.addEventListener('mermaid-loaded', handleMermaidLoaded);
            window.addEventListener('mermaid-error', handleMermaidError);

            // 注入脚本到页面上下文
            (document.head || document.documentElement).appendChild(injectedScript);

            // 清理注入的脚本
            setTimeout(() => {
                if (injectedScript.parentNode) {
                    injectedScript.parentNode.removeChild(injectedScript);
                }
            }, 1000);
        });
    };

    // 处理 Markdown 中的 Mermaid 代码块
    proto.processMermaidBlocks = async function (container) {
        if (!container) return;

        // 检查是否需要加载 mermaid - 更全面的选择器
        const mermaidBlocks = container.querySelectorAll('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');

        if (mermaidBlocks.length === 0) return;

        // 过滤掉已经处理过的块
        const unprocessedBlocks = Array.from(mermaidBlocks).filter(block => {
            // 检查是否已经是mermaid div或被标记为已处理
            const preElement = block.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
                // 如果父元素的下一个兄弟元素是mermaid div，说明已经处理过
                const nextSibling = preElement.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('mermaid')) {
                    return false;
                }
                // 检查是否有处理标记
                if (block.classList.contains('mermaid-processed')) {
                    return false;
                }
            }
            return true;
        });

        if (unprocessedBlocks.length === 0) return;

        // 加载 mermaid（如果需要）
        const mermaidAvailable = await this.loadMermaid().catch(() => false);
        if (!mermaidAvailable) {
            console.warn('Mermaid.js 未加载，无法渲染图表');
            return;
        }

        // 处理每个未处理的 mermaid 代码块
        unprocessedBlocks.forEach((codeBlock, index) => {
            const preElement = codeBlock.parentElement;
            if (preElement && preElement.tagName === 'PRE') {
                const mermaidId = `mermaid-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
                const mermaidContent = codeBlock.textContent || codeBlock.innerText || '';

                if (!mermaidContent.trim()) {
                    return; // 跳过空内容
                }

                // 创建 mermaid 容器
                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';
                mermaidDiv.id = mermaidId;
                mermaidDiv.textContent = mermaidContent;
                // 保存源代码以便后续复制功能使用
                mermaidDiv.setAttribute('data-mermaid-source', mermaidContent);
                mermaidDiv.style.cssText = `
                    background: rgba(255, 255, 255, 0.1) !important;
                    padding: 15px !important;
                    border-radius: 8px !important;
                    margin: 15px 0 !important;
                    overflow-x: auto !important;
                    min-height: 100px !important;
                `;

                // 标记为已处理
                codeBlock.classList.add('mermaid-processed');

                // 替换代码块
                try {
                    preElement.parentNode.replaceChild(mermaidDiv, preElement);

                    // 渲染 mermaid 图表 - 使用页面上下文中的 mermaid
                    // 因为 mermaid 在页面上下文中，我们需要通过注入脚本执行渲染
                    // 通过 data 属性传递渲染 ID（避免内联脚本）
                    // 为每个 mermaid 块使用唯一的容器 ID，避免冲突
                    const renderIdContainer = document.createElement('div');
                    renderIdContainer.id = `__mermaid_render_id_container__${mermaidId}`;
                    renderIdContainer.style.display = 'none';
                    renderIdContainer.setAttribute('data-mermaid-id', mermaidId);
                    // 确保容器在页面上下文中（不是在 content script 的隔离 DOM）
                    (document.head || document.documentElement).appendChild(renderIdContainer);

                    // 监听渲染结果（在加载脚本之前设置）
                    const handleRender = (event) => {
                        if (event.detail.id === mermaidId) {
                            window.removeEventListener('mermaid-rendered', handleRender);
                            if (!event.detail.success) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'mermaid-error';
                                errorDiv.style.cssText = `
                                    background: rgba(255, 0, 0, 0.1) !important;
                                    padding: 10px !important;
                                    border-radius: 5px !important;
                                    color: #ff6b6b !important;
                                    font-size: 12px !important;
                                    margin: 10px 0 !important;
                                `;
                                errorDiv.innerHTML = `
                                    <div>❌ Mermaid 图表渲染失败</div>
                                    <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                                `;
                                if (mermaidDiv.parentNode) {
                                    mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                                }
                            } else {
                                // 渲染成功，添加复制和下载按钮
                                setTimeout(() => {
                                    this.addMermaidActions(mermaidDiv, event.detail.svgContent || '', mermaidContent);
                                }, 100);
                            }
                            // 清理 ID 容器
                            if (renderIdContainer.parentNode) {
                                renderIdContainer.parentNode.removeChild(renderIdContainer);
                            }
                        }
                    };
                    window.addEventListener('mermaid-rendered', handleRender);

                    // 延迟加载渲染脚本，确保 mermaid div 已经添加到 DOM 且事件监听器已设置
                    // 增加延迟时间，确保 DOM 完全更新
                    setTimeout(() => {
                        // 再次检查 mermaid div 是否存在（确保 DOM 已更新）
                        const checkDiv = document.getElementById(mermaidId);
                        if (!checkDiv) {
                            console.warn('[ProcessMermaid] mermaid div 尚未准备好，延迟渲染:', mermaidId);
                            // 如果还没准备好，再等一会
                            setTimeout(() => {
                                const renderScript = document.createElement('script');
                                renderScript.src = chrome.runtime.getURL('src/features/mermaid/render-mermaid.js');
                                renderScript.charset = 'UTF-8';
                                renderScript.async = false;
                                document.documentElement.appendChild(renderScript);

                                setTimeout(() => {
                                    if (renderScript.parentNode) {
                                        renderScript.parentNode.removeChild(renderScript);
                                    }
                                }, 3000);
                            }, 150);
                            return;
                        }

                        // 加载外部渲染脚本（避免 CSP 限制）
                        const renderScript = document.createElement('script');
                        renderScript.src = chrome.runtime.getURL('src/features/mermaid/render-mermaid.js');
                        renderScript.charset = 'UTF-8';
                        renderScript.async = false;

                        // 注入渲染脚本到页面上下文
                        document.documentElement.appendChild(renderScript);

                        // 清理脚本（渲染完成后）
                        setTimeout(() => {
                            if (renderScript.parentNode) {
                                renderScript.parentNode.removeChild(renderScript);
                            }
                        }, 3000);
                    }, 200);
                } catch (error) {
                    console.error('替换 Mermaid 代码块时出错:', error);
                    // 出错时显示错误信息，但保留原始代码
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'mermaid-error';
                    errorDiv.style.cssText = `
                        background: rgba(255, 0, 0, 0.1) !important;
                        padding: 10px !important;
                        border-radius: 5px !important;
                        color: #ff6b6b !important;
                        font-size: 12px !important;
                        margin: 10px 0 !important;
                    `;
                    errorDiv.innerHTML = `
                        <div>❌ Mermaid 图表渲染失败</div>
                        <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                    `;
                    if (mermaidDiv.parentNode) {
                        mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                    }
                }
            }
        });
    };

    // 渲染 Markdown 为 HTML（保持同步以兼容现有代码）
    proto.renderMarkdown = function (markdown) {
        if (!markdown) return '';

        try {
            // 检查 marked 是否可用
            if (typeof marked !== 'undefined') {
                // 配置 marked 以增强安全性
                marked.setOptions({
                    breaks: true, // 支持换行
                    gfm: true, // GitHub Flavored Markdown
                    sanitize: false // 允许 HTML，但我们会通过 DOMPurify 或其他方式处理
                });
                return marked.parse(markdown);
            } else {
                // 如果 marked 不可用，返回转义的纯文本
                return this.escapeHtml(markdown);
            }
        } catch (error) {
            console.error('渲染 Markdown 失败:', error);
            return this.escapeHtml(markdown);
        }
    };

    // 渲染 Markdown 并处理 Mermaid（完整流程）
    proto.renderMarkdownWithMermaid = async function (markdown, container) {
        // 先渲染 Markdown
        const html = this.renderMarkdown(markdown);

        // 如果提供了容器，处理其中的 Mermaid 代码块
        if (container) {
            // 需要等待 DOM 更新后再处理
            setTimeout(async () => {
                await this.processMermaidBlocks(container);
            }, 100);
        }

        return html;
    };

    // HTML 转义辅助函数
    proto.escapeHtml = function (text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // 为 Mermaid 图表添加复制和下载按钮
    proto.addMermaidActions = function (mermaidDiv, svgContent, mermaidSourceCode) {
        if (!mermaidDiv) return;

        // 检查是否已经添加了按钮
        if (mermaidDiv.querySelector('.mermaid-actions')) {
            return;
        }

        // 创建按钮容器
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'mermaid-actions';
        actionsContainer.style.cssText = `
            position: absolute !important;
            top: 10px !important;
            right: 10px !important;
            display: flex !important;
            gap: 8px !important;
            z-index: 10 !important;
            opacity: 0 !important;
            transition: opacity 0.2s ease !important;
        `;

        // 确保 mermaid div 有相对定位
        const currentPosition = window.getComputedStyle(mermaidDiv).position;
        if (currentPosition === 'static') {
            mermaidDiv.style.position = 'relative';
        }

        // 创建复制按钮
        const copyButton = document.createElement('button');
        copyButton.className = 'mermaid-copy-button';
        copyButton.title = '复制 Mermaid 代码';
        copyButton.innerHTML = '📋';
        copyButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建下载 SVG 按钮
        const downloadButton = document.createElement('button');
        downloadButton.className = 'mermaid-download-button';
        downloadButton.title = '下载 SVG';
        downloadButton.innerHTML = '💾';
        downloadButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建下载 PNG 按钮
        const downloadPngButton = document.createElement('button');
        downloadPngButton.className = 'mermaid-download-png-button';
        downloadPngButton.title = '下载 PNG';
        downloadPngButton.innerHTML = '🖼️';
        downloadPngButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 创建编辑按钮（在新标签页打开 Mermaid Live Editor）
        const editButton = document.createElement('button');
        editButton.className = 'mermaid-edit-button';
        editButton.title = '在 Mermaid Live Editor 中打开';
        editButton.innerHTML = '✏️';
        editButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 获取 SVG 内容的辅助函数
        const getSvgContent = () => {
            return new Promise((resolve) => {
                // 首先尝试使用事件传递的内容
                if (svgContent) {
                    resolve(svgContent);
                    return;
                }

                // 尝试从 DOM 获取（content script 可以直接访问 DOM）
                const svgElement = mermaidDiv.querySelector('svg');
                if (svgElement) {
                    try {
                        const clone = svgElement.cloneNode(true);
                        if (!clone.getAttribute('xmlns')) {
                            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        }
                        const svgString = new XMLSerializer().serializeToString(clone);
                        resolve(svgString);
                        return;
                    } catch (error) {
                        console.warn('通过 DOM 获取 SVG 失败，尝试注入脚本:', error);
                    }
                }

                // 如果都失败，通过注入脚本从页面上下文获取
                const script = document.createElement('script');
                script.textContent = `
                    (function() {
                        const mermaidDiv = document.getElementById('${mermaidDiv.id}');
                        if (mermaidDiv) {
                            const svgElement = mermaidDiv.querySelector('svg');
                            if (svgElement) {
                                const clone = svgElement.cloneNode(true);
                                if (!clone.getAttribute('xmlns')) {
                                    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                                }
                                const svgString = new XMLSerializer().serializeToString(clone);
                                window.postMessage({
                                    type: 'mermaid-svg-content',
                                    id: '${mermaidDiv.id}',
                                    svgContent: svgString
                                }, '*');
                            }
                        }
                    })();
                `;
                document.documentElement.appendChild(script);

                const messageHandler = (event) => {
                    if (event.data && event.data.type === 'mermaid-svg-content' && event.data.id === mermaidDiv.id) {
                        window.removeEventListener('message', messageHandler);
                        document.documentElement.removeChild(script);
                        resolve(event.data.svgContent || '');
                    }
                };
                window.addEventListener('message', messageHandler);

                // 超时处理
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    if (script.parentNode) {
                        document.documentElement.removeChild(script);
                    }
                    resolve('');
                }, 1000);
            });
        };

        // 复制按钮点击事件 - 复制 Mermaid 源代码
        copyButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                // 优先使用传入的参数，其次从 data 属性获取
                let codeToCopy = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || '';

                if (codeToCopy) {
                    await navigator.clipboard.writeText(codeToCopy);
                    // 显示成功提示
                    copyButton.innerHTML = '✓';
                    copyButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    setTimeout(() => {
                        copyButton.innerHTML = '📋';
                        copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 Mermaid 源代码');
                }
            } catch (error) {
                console.error('复制 Mermaid 代码失败:', error);
                copyButton.innerHTML = '✗';
                copyButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                setTimeout(() => {
                    copyButton.innerHTML = '📋';
                    copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 下载 SVG 按钮点击事件
        downloadButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                const svg = await getSvgContent();

                if (svg) {
                    // 创建 Blob 并下载
                    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `mermaid-diagram-${Date.now()}.svg`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    // 显示成功提示
                    downloadButton.innerHTML = '✓';
                    downloadButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    setTimeout(() => {
                        downloadButton.innerHTML = '💾';
                        downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 SVG 内容');
                }
            } catch (error) {
                console.error('下载 SVG 失败:', error);
                downloadButton.innerHTML = '✗';
                downloadButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                setTimeout(() => {
                    downloadButton.innerHTML = '💾';
                    downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 将 SVG 转换为 PNG 的辅助函数
        const svgToPng = (svgString) => {
            return new Promise((resolve, reject) => {
                // 方法1: 优先尝试直接从 DOM 中的 SVG 元素绘制（最可靠，已渲染好的元素）
                const svgElementInDom = mermaidDiv.querySelector('svg');
                if (svgElementInDom) {
                    try {
                        // 获取 SVG 的实际尺寸
                        const bbox = svgElementInDom.getBBox();
                        let width = bbox.width || 800;
                        let height = bbox.height || 600;

                        // 如果 bbox 无效，尝试从属性获取
                        if (width <= 0 || height <= 0) {
                            width = parseFloat(svgElementInDom.getAttribute('width')) ||
                                parseFloat(svgElementInDom.getAttribute('viewBox')?.split(/\s+/)[2]) || 800;
                            height = parseFloat(svgElementInDom.getAttribute('height')) ||
                                parseFloat(svgElementInDom.getAttribute('viewBox')?.split(/\s+/)[3]) || 600;
                        }

                        // 确保宽高有效
                        if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
                            width = 800;
                            height = 600;
                        }

                        // 创建 Canvas
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const scale = 2; // 提高清晰度

                        canvas.width = width * scale;
                        canvas.height = height * scale;

                        // 设置白色背景
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // 将 SVG 序列化为字符串并创建 data URI
                        const clone = svgElementInDom.cloneNode(true);
                        if (!clone.getAttribute('xmlns')) {
                            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        }
                        // 确保有明确的宽高
                        if (!clone.getAttribute('width')) {
                            clone.setAttribute('width', width.toString());
                        }
                        if (!clone.getAttribute('height')) {
                            clone.setAttribute('height', height.toString());
                        }

                        const clonedSvgString = new XMLSerializer().serializeToString(clone);
                        const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clonedSvgString);

                        // 创建图片并绘制
                        const img = new Image();
                        img.onload = () => {
                            try {
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                canvas.toBlob((blob) => {
                                    if (blob) {
                                        resolve(blob);
                                    } else {
                                        // 如果 DOM 方法失败，回退到字符串方法
                                        tryStringMethod(svgString, width, height, resolve, reject);
                                    }
                                }, 'image/png');
                            } catch (error) {
                                // 如果 DOM 方法失败，回退到字符串方法
                                tryStringMethod(svgString, width, height, resolve, reject);
                            }
                        };
                        img.onerror = () => {
                            // 如果 DOM 方法失败，回退到字符串方法
                            tryStringMethod(svgString, width, height, resolve, reject);
                        };
                        img.src = svgDataUri;
                        return; // 成功启动 DOM 方法，退出
                    } catch (error) {
                        // DOM 方法出错，继续尝试字符串方法
                        console.warn('从 DOM 绘制 SVG 失败，尝试字符串方法:', error);
                    }
                }

                // 方法2: 使用 SVG 字符串（备选方案）
                tryStringMethod(svgString, null, null, resolve, reject);
            });

            // 辅助函数：尝试使用 SVG 字符串方法
            function tryStringMethod(svgString, preferredWidth, preferredHeight, resolve, reject) {
                try {
                    // 确保 SVG 字符串不为空
                    if (!svgString || typeof svgString !== 'string') {
                        reject(new Error('SVG 内容为空或无效'));
                        return;
                    }

                    // 解析 SVG 字符串以获取尺寸信息
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');

                    // 检查解析错误
                    const parserError = svgDoc.querySelector('parsererror');
                    if (parserError) {
                        reject(new Error('SVG 格式错误: ' + parserError.textContent));
                        return;
                    }

                    const svgElement = svgDoc.documentElement;

                    // 确保 SVG 有正确的命名空间
                    if (!svgElement.getAttribute('xmlns')) {
                        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    }

                    // 获取 SVG 的宽高
                    let width = preferredWidth || svgElement.getAttribute('width');
                    let height = preferredHeight || svgElement.getAttribute('height');

                    // 如果没有明确的宽高，尝试从 viewBox 获取
                    if (!width || !height) {
                        const viewBox = svgElement.getAttribute('viewBox');
                        if (viewBox) {
                            const parts = viewBox.split(/\s+/);
                            if (parts.length >= 4) {
                                width = parts[2];
                                height = parts[3];
                            }
                        }
                    }

                    // 如果还是没有，使用默认值或从实际渲染的元素获取
                    if (!width || !height || width === '0' || height === '0') {
                        const svgElementInDom = mermaidDiv.querySelector('svg');
                        if (svgElementInDom) {
                            try {
                                const bbox = svgElementInDom.getBBox();
                                width = bbox.width || '800';
                                height = bbox.height || '600';
                            } catch (e) {
                                width = '800';
                                height = '600';
                            }
                        } else {
                            width = '800';
                            height = '600';
                        }
                    }

                    // 移除单位（px, em 等），只保留数字
                    width = parseFloat(width) || 800;
                    height = parseFloat(height) || 600;

                    // 确保宽高有效
                    if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
                        width = 800;
                        height = 600;
                    }

                    // 重新序列化 SVG，确保格式正确
                    const serializer = new XMLSerializer();
                    let finalSvgString = serializer.serializeToString(svgElement);

                    // 如果 SVG 没有明确的宽高，在加载前设置
                    if (!svgElement.getAttribute('width') || !svgElement.getAttribute('height')) {
                        finalSvgString = finalSvgString.replace(
                            /<svg([^>]*)>/,
                            `<svg$1 width="${width}" height="${height}">`
                        );
                    }

                    // 使用 data URI
                    const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(finalSvgString);

                    const img = new Image();
                    img.crossOrigin = 'anonymous';

                    // 设置超时处理
                    const timeout = setTimeout(() => {
                        reject(new Error('加载 SVG 超时'));
                    }, 10000); // 10秒超时

                    img.onload = () => {
                        clearTimeout(timeout);
                        try {
                            // 创建 Canvas
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');

                            // 设置 Canvas 尺寸（可以设置缩放比例，默认 2x 提高清晰度）
                            const scale = 2;
                            // 使用实际图片尺寸或解析的尺寸
                            const finalWidth = (img.width && img.width > 0) ? img.width : width;
                            const finalHeight = (img.height && img.height > 0) ? img.height : height;

                            canvas.width = finalWidth * scale;
                            canvas.height = finalHeight * scale;

                            // 设置白色背景（PNG 需要背景色）
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);

                            // 绘制图片到 Canvas
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                            // 转换为 PNG
                            canvas.toBlob((blob) => {
                                if (blob) {
                                    resolve(blob);
                                } else {
                                    reject(new Error('Canvas 转换失败'));
                                }
                            }, 'image/png');
                        } catch (error) {
                            reject(new Error('处理图片时出错: ' + error.message));
                        }
                    };

                    img.onerror = () => {
                        clearTimeout(timeout);
                        // 最后尝试使用 Blob URL
                        try {
                            const svgBlob = new Blob([finalSvgString], { type: 'image/svg+xml;charset=utf-8' });
                            const svgUrl = URL.createObjectURL(svgBlob);

                            const img2 = new Image();
                            img2.crossOrigin = 'anonymous';

                            const timeout2 = setTimeout(() => {
                                URL.revokeObjectURL(svgUrl);
                                reject(new Error('加载 SVG 超时（使用 Blob URL）'));
                            }, 10000);

                            img2.onload = () => {
                                clearTimeout(timeout2);
                                try {
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');
                                    const scale = 2;
                                    const finalWidth = (img2.width && img2.width > 0) ? img2.width : width;
                                    const finalHeight = (img2.height && img2.height > 0) ? img2.height : height;

                                    canvas.width = finalWidth * scale;
                                    canvas.height = finalHeight * scale;

                                    ctx.fillStyle = '#ffffff';
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                    ctx.drawImage(img2, 0, 0, canvas.width, canvas.height);

                                    canvas.toBlob((blob) => {
                                        URL.revokeObjectURL(svgUrl);
                                        if (blob) {
                                            resolve(blob);
                                        } else {
                                            reject(new Error('Canvas 转换失败'));
                                        }
                                    }, 'image/png');
                                } catch (error) {
                                    URL.revokeObjectURL(svgUrl);
                                    reject(new Error('处理图片时出错: ' + error.message));
                                }
                            };

                            img2.onerror = () => {
                                clearTimeout(timeout2);
                                URL.revokeObjectURL(svgUrl);
                                reject(new Error('加载 SVG 图片失败：可能是 SVG 格式问题或包含无法加载的外部资源。请确保 SVG 不包含外部图片链接。'));
                            };

                            img2.src = svgUrl;
                        } catch (error) {
                            reject(new Error('加载 SVG 图片失败: ' + error.message));
                        }
                    };

                    img.src = svgDataUri;
                } catch (error) {
                    reject(new Error('处理 SVG 时出错: ' + error.message));
                }
            }
        };

        // 下载 PNG 按钮点击事件
        downloadPngButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                const svg = await getSvgContent();

                if (svg) {
                    // 显示加载状态
                    downloadPngButton.innerHTML = '⏳';
                    downloadPngButton.style.cursor = 'wait';

                    // 转换为 PNG
                    const pngBlob = await svgToPng(svg);

                    // 创建下载链接
                    const url = URL.createObjectURL(pngBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `mermaid-diagram-${Date.now()}.png`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    // 显示成功提示
                    downloadPngButton.innerHTML = '✓';
                    downloadPngButton.style.background = 'rgba(76, 175, 80, 0.3) !important';
                    downloadPngButton.style.cursor = 'pointer';
                    setTimeout(() => {
                        downloadPngButton.innerHTML = '🖼️';
                        downloadPngButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                    }, 1000);
                } else {
                    throw new Error('无法获取 SVG 内容');
                }
            } catch (error) {
                console.error('下载 PNG 失败:', error);
                downloadPngButton.innerHTML = '✗';
                downloadPngButton.style.background = 'rgba(244, 67, 54, 0.3) !important';
                downloadPngButton.style.cursor = 'pointer';
                setTimeout(() => {
                    downloadPngButton.innerHTML = '🖼️';
                    downloadPngButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                }, 1000);
            }
        });

        // 编辑按钮点击事件 - 在新标签页打开 Mermaid Live Editor
        editButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            try {
                // 获取 Mermaid 源代码
                const codeToEdit = mermaidSourceCode || mermaidDiv.getAttribute('data-mermaid-source') || '';

                if (!codeToEdit || !codeToEdit.trim()) {
                    // 如果没有源代码，直接打开编辑器
                    window.open('https://mermaid.live/edit', '_blank');
                    return;
                }

                // 显示加载状态
                const originalHTML = editButton.innerHTML;
                editButton.innerHTML = '⏳';
                editButton.style.cursor = 'wait';

                // 同时使用多种方式传递代码，提高成功率
                let urlOpened = false;
                let clipboardSuccess = false;

                // 方式1: 优先将代码复制到剪贴板（最可靠的方式）
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(codeToEdit);
                        clipboardSuccess = true;
                        console.log('代码已复制到剪贴板');
                    }
                } catch (clipboardError) {
                    console.warn('复制到剪贴板失败，尝试 fallback 方法:', clipboardError);
                    // 如果 Clipboard API 失败，尝试使用 fallback 方法
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = codeToEdit;
                        textArea.style.position = 'fixed';
                        textArea.style.opacity = '0';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        if (successful) {
                            clipboardSuccess = true;
                            console.log('代码已通过 fallback 方法复制到剪贴板');
                        }
                    } catch (fallbackError) {
                        console.error('Fallback 复制方法也失败:', fallbackError);
                    }
                }

                // 方式2: 尝试通过 URL 传递代码（多种格式尝试）
                const urlFormats = [];

                // 格式1: state 参数（JSON 对象 base64 编码）
                try {
                    const stateObj = {
                        code: codeToEdit,
                        mermaid: { theme: 'default' }
                    };
                    const stateJson = JSON.stringify(stateObj);
                    const stateBase64 = btoa(unescape(encodeURIComponent(stateJson)));
                    urlFormats.push(`https://mermaid.live/edit#state/${stateBase64}`);
                } catch (e) {
                    console.warn('生成 state 格式 URL 失败:', e);
                }

                // 格式2: code 参数（代码直接 base64 编码）
                try {
                    const codeBase64 = btoa(unescape(encodeURIComponent(codeToEdit)));
                    urlFormats.push(`https://mermaid.live/edit#code/${codeBase64}`);
                } catch (e) {
                    console.warn('生成 code 格式 URL 失败:', e);
                }

                // 格式3: 查询参数方式
                try {
                    const encodedCode = encodeURIComponent(codeToEdit);
                    urlFormats.push(`https://mermaid.live/edit?code=${encodedCode}`);
                } catch (e) {
                    console.warn('生成查询参数 URL 失败:', e);
                }

                // 尝试打开编辑器（使用多种 URL 格式）
                for (const editorUrl of urlFormats) {
                    try {
                        const newWindow = window.open(editorUrl, '_blank');
                        if (newWindow) {
                            urlOpened = true;
                            console.log('Mermaid Live Editor 已打开，尝试通过 URL 传递代码');
                            break; // 成功打开后就停止尝试
                        }
                    } catch (error) {
                        console.warn('打开编辑器失败，尝试下一个 URL 格式:', error);
                    }
                }

                // 如果所有 URL 格式都失败，尝试使用基础 URL
                if (!urlOpened) {
                    try {
                        const newWindow = window.open('https://mermaid.live/edit', '_blank');
                        urlOpened = !!newWindow;
                        if (urlOpened) {
                            console.log('Mermaid Live Editor 已打开（代码已在剪贴板中）');
                        }
                    } catch (error) {
                        console.error('打开编辑器窗口失败:', error);
                    }
                }

                // 显示成功提示
                setTimeout(() => {
                    // 根据结果显示不同的提示
                    let tipMessage = '';
                    if (clipboardSuccess && urlOpened) {
                        tipMessage = '✓ 编辑器已打开，代码已复制到剪贴板';
                    } else if (clipboardSuccess) {
                        tipMessage = '✓ 代码已复制到剪贴板，请在新打开的编辑器中粘贴';
                    } else if (urlOpened) {
                        tipMessage = '✓ 编辑器已打开';
                    } else {
                        tipMessage = '⚠️ 编辑器已打开，请手动复制代码';
                    }

                    // 更新按钮状态
                    if (clipboardSuccess || urlOpened) {
                        editButton.innerHTML = '✓';
                        editButton.style.background = clipboardSuccess ? 'rgba(76, 175, 80, 0.3) !important' : 'rgba(255, 193, 7, 0.3) !important';
                    }

                    // 创建临时提示（仅在成功复制或打开时显示）
                    if (clipboardSuccess || urlOpened) {
                        const tip = document.createElement('div');
                        tip.textContent = tipMessage;
                        tip.style.cssText = `
                            position: fixed !important;
                            top: 50% !important;
                            left: 50% !important;
                            transform: translate(-50%, -50%) !important;
                            background: rgba(0, 0, 0, 0.85) !important;
                            color: white !important;
                            padding: 14px 28px !important;
                            border-radius: 8px !important;
                            font-size: 14px !important;
                            z-index: 10000 !important;
                            pointer-events: none !important;
                            animation: fadeInOut 2.5s ease-in-out !important;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                            max-width: 90% !important;
                            text-align: center !important;
                            word-wrap: break-word !important;
                        `;

                        // 添加动画样式（如果还没有）
                        if (!document.getElementById('mermaid-tip-styles')) {
                            const style = document.createElement('style');
                            style.id = 'mermaid-tip-styles';
                            style.textContent = `
                                @keyframes fadeInOut {
                                    0%, 100% { opacity: 0; transform: translate(-50%, -50%) translateY(-10px); }
                                    10%, 90% { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
                                }
                            `;
                            document.head.appendChild(style);
                        }

                        document.body.appendChild(tip);
                        setTimeout(() => {
                            if (tip.parentNode) {
                                tip.parentNode.removeChild(tip);
                            }
                        }, 2500);
                    }

                    // 恢复按钮状态
                    setTimeout(() => {
                        editButton.innerHTML = originalHTML;
                        editButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
                        editButton.style.cursor = 'pointer';
                    }, 2000);
                }, 100);

            } catch (error) {
                console.error('打开 Mermaid Live Editor 失败:', error);
                // 出错时仍尝试打开编辑器
                try {
                    window.open('https://mermaid.live/edit', '_blank');
                } catch (openError) {
                    console.error('无法打开编辑器窗口:', openError);
                }
                // 恢复按钮状态
                setTimeout(() => {
                    editButton.innerHTML = '✏️';
                    editButton.style.cursor = 'pointer';
                }, 1000);
            }
        });

        // 创建全屏按钮
        const fullscreenButton = document.createElement('button');
        fullscreenButton.className = 'mermaid-fullscreen-button';
        fullscreenButton.title = '全屏查看';
        fullscreenButton.innerHTML = '⛶';
        fullscreenButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            border-radius: 4px !important;
            width: 28px !important;
            height: 28px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 14px !important;
            transition: all 0.2s ease !important;
            opacity: 0.8 !important;
            backdrop-filter: blur(4px) !important;
        `;

        // 全屏按钮点击事件
        fullscreenButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.openMermaidFullscreen(mermaidDiv, mermaidSourceCode);
        });

        // 悬停显示按钮
        mermaidDiv.addEventListener('mouseenter', () => {
            actionsContainer.style.opacity = '1';
        });
        mermaidDiv.addEventListener('mouseleave', () => {
            actionsContainer.style.opacity = '0';
        });

        actionsContainer.appendChild(copyButton);
        actionsContainer.appendChild(downloadButton);
        actionsContainer.appendChild(downloadPngButton);
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(fullscreenButton);
        mermaidDiv.appendChild(actionsContainer);

        // 按钮悬停效果
        copyButton.addEventListener('mouseenter', () => {
            copyButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            copyButton.style.transform = 'scale(1.1)';
            copyButton.style.opacity = '1';
        });
        copyButton.addEventListener('mouseleave', () => {
            copyButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            copyButton.style.transform = 'scale(1)';
            copyButton.style.opacity = '0.8';
        });

        downloadButton.addEventListener('mouseenter', () => {
            downloadButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            downloadButton.style.transform = 'scale(1.1)';
            downloadButton.style.opacity = '1';
        });
        downloadButton.addEventListener('mouseleave', () => {
            downloadButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            downloadButton.style.transform = 'scale(1)';
            downloadButton.style.opacity = '0.8';
        });

        downloadPngButton.addEventListener('mouseenter', () => {
            downloadPngButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            downloadPngButton.style.transform = 'scale(1.1)';
            downloadPngButton.style.opacity = '1';
        });
        downloadPngButton.addEventListener('mouseleave', () => {
            downloadPngButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            downloadPngButton.style.transform = 'scale(1)';
            downloadPngButton.style.opacity = '0.8';
        });

        editButton.addEventListener('mouseenter', () => {
            editButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            editButton.style.transform = 'scale(1.1)';
            editButton.style.opacity = '1';
        });
        editButton.addEventListener('mouseleave', () => {
            editButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            editButton.style.transform = 'scale(1)';
            editButton.style.opacity = '0.8';
        });

        fullscreenButton.addEventListener('mouseenter', () => {
            fullscreenButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
            fullscreenButton.style.transform = 'scale(1.1)';
            fullscreenButton.style.opacity = '1';
        });
        fullscreenButton.addEventListener('mouseleave', () => {
            fullscreenButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
            fullscreenButton.style.transform = 'scale(1)';
            fullscreenButton.style.opacity = '0.8';
        });
    };

    // 打开 Mermaid 图表全屏查看
    proto.openMermaidFullscreen = function (mermaidDiv, mermaidSourceCode) {
        // 检查是否已经存在全屏容器
        const existingFullscreen = document.getElementById('mermaid-fullscreen-container');
        if (existingFullscreen) {
            existingFullscreen.remove();
        }

        // 获取聊天窗口
        const chatWindow = document.getElementById('pet-chat-window');
        if (!chatWindow) {
            console.error('找不到聊天窗口');
            return;
        }

        // 获取聊天窗口的位置和尺寸
        const chatRect = chatWindow.getBoundingClientRect();

        // 创建全屏容器
        const fullscreenContainer = document.createElement('div');
        fullscreenContainer.id = 'mermaid-fullscreen-container';
        // 使用比聊天窗口更高的 z-index（聊天窗口是 2147483648）
        const fullscreenZIndex = 2147483649;
        fullscreenContainer.style.cssText = `
            position: fixed !important;
            top: ${chatRect.top}px !important;
            left: ${chatRect.left}px !important;
            width: ${chatRect.width}px !important;
            height: ${chatRect.height}px !important;
            background: rgba(0, 0, 0, 0.95) !important;
            z-index: ${fullscreenZIndex} !important;
            display: flex !important;
            flex-direction: column !important;
            border-radius: 8px !important;
            overflow: hidden !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
        `;

        // 创建头部栏（包含关闭按钮）
        const headerBar = document.createElement('div');
        headerBar.style.cssText = `
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 10px 15px !important;
            background: rgba(255, 255, 255, 0.1) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            flex-shrink: 0 !important;
        `;

        const title = document.createElement('div');
        title.textContent = 'Mermaid 图表全屏查看';
        title.style.cssText = `
            color: white !important;
            font-size: 14px !important;
            font-weight: 500 !important;
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.title = '关闭全屏';
        closeButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2) !important;
            border: none !important;
            color: white !important;
            font-size: 18px !important;
            cursor: pointer !important;
            width: 28px !important;
            height: 28px !important;
            border-radius: 4px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.2s ease !important;
        `;
        closeButton.addEventListener('click', () => {
            fullscreenContainer.remove();
        });
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.3) !important';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.2) !important';
        });

        headerBar.appendChild(title);
        headerBar.appendChild(closeButton);

        // 创建内容区域
        const contentArea = document.createElement('div');
        contentArea.style.cssText = `
            flex: 1 !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: stretch !important;
            justify-content: stretch !important;
            padding: 0 !important;
            position: relative !important;
        `;

        // 克隆 mermaid 图表
        const clonedMermaid = mermaidDiv.cloneNode(true);
        clonedMermaid.style.cssText = `
            width: 100% !important;
            height: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            background: rgba(255, 255, 255, 0.1) !important;
            padding: 20px !important;
            border-radius: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
        `;

        // 移除克隆元素中的操作按钮
        const clonedActions = clonedMermaid.querySelector('.mermaid-actions');
        if (clonedActions) {
            clonedActions.remove();
        }

        // 调整 SVG 样式使其自适应
        const adjustSvgSize = () => {
            const svg = clonedMermaid.querySelector('svg');
            if (svg) {
                svg.style.cssText = `
                    width: 100% !important;
                    height: 100% !important;
                    max-width: 100% !important;
                    max-height: 100% !important;
                `;
                // 确保 SVG 有 viewBox 属性以便自适应
                if (!svg.getAttribute('viewBox') && svg.getAttribute('width') && svg.getAttribute('height')) {
                    const width = svg.getAttribute('width');
                    const height = svg.getAttribute('height');
                    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
                    svg.removeAttribute('width');
                    svg.removeAttribute('height');
                }
            }
        };

        contentArea.appendChild(clonedMermaid);

        // 组装全屏容器
        fullscreenContainer.appendChild(headerBar);
        fullscreenContainer.appendChild(contentArea);

        // 添加到页面
        document.body.appendChild(fullscreenContainer);

        // 添加四个角的拖拽调整大小功能 - 已禁用
        // this.addResizeHandles(fullscreenContainer, chatWindow);

        // 重新渲染 mermaid（如果需要）
        const clonedMermaidId = clonedMermaid.id || `mermaid-fullscreen-${Date.now()}`;
        clonedMermaid.id = clonedMermaidId;

        // 如果克隆的图表还没有渲染，需要重新渲染
        if (!clonedMermaid.querySelector('svg')) {
            const mermaidContent = mermaidSourceCode || clonedMermaid.getAttribute('data-mermaid-source') || clonedMermaid.textContent || '';
            if (mermaidContent.trim()) {
                clonedMermaid.textContent = mermaidContent;
                clonedMermaid.className = 'mermaid';

                // 使用注入脚本重新渲染
                const renderIdContainer = document.createElement('div');
                renderIdContainer.id = `__mermaid_render_id_container__${clonedMermaidId}`;
                renderIdContainer.setAttribute('data-mermaid-id', clonedMermaidId);
                renderIdContainer.style.display = 'none';
                document.body.appendChild(renderIdContainer);

                const handleRender = (event) => {
                    if (event.detail.id === clonedMermaidId) {
                        window.removeEventListener('mermaid-rendered', handleRender);
                        renderIdContainer.remove();
                        // 渲染完成后调整 SVG 大小
                        setTimeout(() => {
                            adjustSvgSize();
                        }, 100);
                    }
                };
                window.addEventListener('mermaid-rendered', handleRender);

                setTimeout(() => {
                    const renderScript = document.createElement('script');
                    renderScript.src = chrome.runtime.getURL('src/features/mermaid/render-mermaid.js');
                    renderScript.onload = () => {
                        if (renderScript.parentNode) {
                            renderScript.parentNode.removeChild(renderScript);
                        }
                    };
                    document.documentElement.appendChild(renderScript);
                }, 100);
            }
        } else {
            // 如果已经有 SVG，立即调整大小
            setTimeout(() => {
                adjustSvgSize();
            }, 100);
        }

        // 监听窗口大小变化和容器大小变化，自适应调整图表
        const resizeObserver = new ResizeObserver(() => {
            adjustSvgSize();
        });
        resizeObserver.observe(fullscreenContainer);
        resizeObserver.observe(contentArea);

        // 当全屏容器被移除时，清理观察者
        const originalRemove = fullscreenContainer.remove.bind(fullscreenContainer);
        fullscreenContainer.remove = function () {
            resizeObserver.disconnect();
            originalRemove();
        };
    };

})(typeof window !== 'undefined' ? window : this);
