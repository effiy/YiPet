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
                        // 优化自适应配置
                        flowchart: {
                            useMaxWidth: false, // 不使用最大宽度限制，让图表根据内容自适应
                            htmlLabels: true,
                            wrap: false, // 不自动换行，保持原始布局
                        },
                        // 其他图表类型也优化自适应
                        sequence: {
                            useMaxWidth: false,
                            wrap: false,
                        },
                        gantt: {
                            useMaxWidth: false,
                        },
                        class: {
                            useMaxWidth: false,
                        },
                        state: {
                            useMaxWidth: false,
                        },
                        pie: {
                            useMaxWidth: false,
                        },
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
            const scriptUrl = chrome.runtime.getURL('libs/mermaid.min.js');
            const loadScriptUrl = chrome.runtime.getURL('src/features/mermaid/page/load-mermaid.js');
            console.log('尝试在页面上下文中加载 Mermaid.js，URL:', scriptUrl);
            const DomHelper = window.DomHelper;
            if (!DomHelper || typeof DomHelper.runPageScriptWithData !== 'function') {
                this.mermaidLoading = false;
                reject(new Error('DomHelper 不可用，无法加载 Mermaid'));
                return;
            }

            DomHelper.runPageScriptWithData({
                scriptSrc: loadScriptUrl,
                dataContainerId: '__mermaid_url_container__',
                dataAttributes: {
                    'data-mermaid-url': scriptUrl
                },
                successEvent: 'mermaid-loaded',
                errorEvent: 'mermaid-error',
                timeoutMs: 30000,
                cleanupDelayMs: 1000
            }).then(() => {
                console.log('[Content] 收到 Mermaid 加载完成事件');
                this.mermaidLoaded = true;
                this.mermaidLoading = false;
                console.log('[Content] Mermaid.js 在页面上下文中已加载');
                resolve(true);
            }).catch((eventOrError) => {
                console.error('[Content] 收到 Mermaid 加载失败事件', eventOrError);
                this.mermaidLoading = false;
                const errorMsg = (eventOrError && eventOrError.detail && eventOrError.detail.error)
                    ? eventOrError.detail.error
                    : (eventOrError && eventOrError.message ? eventOrError.message : '页面上下文中的 Mermaid.js 加载失败');
                reject(new Error(errorMsg));
            });
        });
    };

    // 处理 Markdown 中的 Mermaid 代码块
    proto.processMermaidBlocks = async function (container) {
        if (!container) return;

        // 检查是否需要加载 mermaid - 更全面的选择器
        // 1. 查找 code.language-mermaid（原始代码块）
        // 2. 查找已转换为 div.mermaid 的元素（renderMarkdown 转换后的）
        const mermaidCodeBlocks = container.querySelectorAll('code.language-mermaid, code.language-mmd, pre code.language-mermaid, pre code.language-mmd, code[class*="mermaid"]');
        const mermaidDivs = container.querySelectorAll('div.mermaid:not([data-mermaid-rendered])');

        // 合并两种类型的元素
        const allMermaidElements = [...Array.from(mermaidCodeBlocks), ...Array.from(mermaidDivs)];

        if (allMermaidElements.length === 0) return;

        // 过滤掉已经处理过的块
        const unprocessedBlocks = allMermaidElements.filter(element => {
            // 如果是 div.mermaid，检查是否已渲染
            if (element.tagName === 'DIV' && element.classList.contains('mermaid')) {
                // 如果已经有 SVG 子元素，说明已经渲染过
                if (element.querySelector('svg')) {
                    return false;
                }
                // 如果已标记为已成功渲染（值为 "true"），跳过
                const rendered = element.getAttribute('data-mermaid-rendered');
                if (rendered === 'true') {
                    return false;
                }
                // 如果值为 "false" 或没有属性，说明需要处理（可能是首次处理或之前处理失败）
                return true;
            }
            
            // 如果是 code 元素，检查是否已处理
            if (element.tagName === 'CODE') {
                const preElement = element.parentElement;
                if (preElement && preElement.tagName === 'PRE') {
                    // 如果父元素的下一个兄弟元素是mermaid div，说明已经处理过
                    const nextSibling = preElement.nextElementSibling;
                    if (nextSibling && nextSibling.classList.contains('mermaid')) {
                        return false;
                    }
                    // 检查是否有处理标记
                    if (element.classList.contains('mermaid-processed')) {
                        return false;
                    }
                }
                return true;
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
        unprocessedBlocks.forEach((element, index) => {
            const mermaidId = `mermaid-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            let mermaidDiv = null;
            let mermaidContent = '';

            // 如果已经是 div.mermaid，直接使用
            if (element.tagName === 'DIV' && element.classList.contains('mermaid')) {
                mermaidDiv = element;
                mermaidContent = element.textContent || element.innerText || '';
                
                // 确保有 ID
                if (!mermaidDiv.id) {
                    mermaidDiv.id = mermaidId;
                } else {
                    mermaidId = mermaidDiv.id;
                }
                
                // 保存源代码（如果还没有）
                if (!mermaidDiv.hasAttribute('data-mermaid-source')) {
                    mermaidDiv.setAttribute('data-mermaid-source', mermaidContent);
                }
                
                // 确保样式正确（使用 CSS 类，样式已在 content.css 中定义）
                // 添加自适应容器样式
                if (!mermaidDiv.classList.contains('mermaid-container')) {
                    mermaidDiv.classList.add('mermaid-container');
                }
                mermaidDiv.style.display = "inline-block";
                mermaidDiv.style.width = "auto";
                mermaidDiv.style.height = "auto";
                mermaidDiv.style.minWidth = "0";
                mermaidDiv.style.minHeight = "0";
            } else if (element.tagName === 'CODE') {
                // 如果是 code 元素，需要替换为 div
                const preElement = element.parentElement;
                if (preElement && preElement.tagName === 'PRE') {
                    mermaidContent = element.textContent || element.innerText || '';

                    if (!mermaidContent.trim()) {
                        return; // 跳过空内容
                    }

                    // 创建 mermaid 容器（样式已通过 CSS 类定义）
                    mermaidDiv = document.createElement('div');
                    mermaidDiv.className = 'mermaid mermaid-container';
                    mermaidDiv.id = mermaidId;
                    mermaidDiv.textContent = mermaidContent;
                    // 保存源代码以便后续复制功能使用
                    mermaidDiv.setAttribute('data-mermaid-source', mermaidContent);
                    // 添加自适应容器样式
                    mermaidDiv.style.display = "inline-block";
                    mermaidDiv.style.width = "auto";
                    mermaidDiv.style.height = "auto";
                    mermaidDiv.style.minWidth = "0";
                    mermaidDiv.style.minHeight = "0";

                    // 标记为已处理
                    element.classList.add('mermaid-processed');

                    // 替换代码块
                    try {
                        preElement.parentNode.replaceChild(mermaidDiv, preElement);
                    } catch (error) {
                        console.error('替换 Mermaid 代码块时出错:', error);
                        return;
                    }
                } else {
                    return; // 如果不是在 pre 中，跳过
                }
            } else {
                return; // 未知类型，跳过
            }

            if (!mermaidContent.trim()) {
                return; // 跳过空内容
            }

            // 继续处理渲染逻辑
            try {
                // 标记为正在处理（避免重复处理）
                mermaidDiv.setAttribute('data-mermaid-rendered', 'false');

                // 渲染 mermaid 图表 - 使用页面上下文中的 mermaid
                // 因为 mermaid 在页面上下文中，我们需要通过注入脚本执行渲染
                const DomHelper = window.DomHelper;
                if (!DomHelper || typeof DomHelper.runPageScriptWithData !== 'function') {
                    throw new Error('DomHelper 不可用，无法渲染 Mermaid');
                }

                // 延迟加载渲染脚本，确保 mermaid div 已经添加到 DOM 且事件监听器已设置
                // 增加延迟时间，确保 DOM 完全更新
                setTimeout(() => {
                    // 再次检查 mermaid div 是否存在（确保 DOM 已更新）
                    const checkDiv = document.getElementById(mermaidId);
                    if (!checkDiv) {
                        console.warn('[ProcessMermaid] mermaid div 尚未准备好，延迟渲染:', mermaidId);
                        // 如果还没准备好，再等一会
                        setTimeout(() => {
                            DomHelper.runPageScriptWithData({
                                scriptSrc: chrome.runtime.getURL('src/features/mermaid/page/render-mermaid.js'),
                                dataContainerId: `__mermaid_render_id_container__${mermaidId}`,
                                dataAttributes: { 'data-mermaid-id': mermaidId },
                                successEvent: 'mermaid-rendered',
                                timeoutMs: 15000,
                                cleanupDelayMs: 3000,
                                isSuccess: (e) => e && e.detail && e.detail.id === mermaidId
                            }).then((event) => {
                                if (!event.detail.success) {
                                    const errorDiv = document.createElement('div');
                                    errorDiv.className = 'mermaid-error';
                                    errorDiv.innerHTML = `
                                        <div>❌ Mermaid 图表渲染失败</div>
                                        <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                                    `;
                                    if (mermaidDiv.parentNode) {
                                        mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                                    }
                                } else {
                                    mermaidDiv.setAttribute('data-mermaid-rendered', 'true');
                                    setTimeout(() => {
                                        this.addMermaidActions(mermaidDiv, event.detail.svgContent || '', mermaidContent);
                                    }, 100);
                                }
                            }).catch((error) => {
                                console.warn('[ProcessMermaid] Mermaid 渲染失败:', error);
                            });
                        }, 150);
                        return;
                    }

                    DomHelper.runPageScriptWithData({
                        scriptSrc: chrome.runtime.getURL('src/features/mermaid/page/render-mermaid.js'),
                        dataContainerId: `__mermaid_render_id_container__${mermaidId}`,
                        dataAttributes: { 'data-mermaid-id': mermaidId },
                        successEvent: 'mermaid-rendered',
                        timeoutMs: 15000,
                        cleanupDelayMs: 3000,
                        isSuccess: (e) => e && e.detail && e.detail.id === mermaidId
                    }).then((event) => {
                        if (!event.detail.success) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'mermaid-error';
                            errorDiv.innerHTML = `
                                <div>❌ Mermaid 图表渲染失败</div>
                                <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                            `;
                            if (mermaidDiv.parentNode) {
                                mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                            }
                        } else {
                            mermaidDiv.setAttribute('data-mermaid-rendered', 'true');
                            setTimeout(() => {
                                this.addMermaidActions(mermaidDiv, event.detail.svgContent || '', mermaidContent);
                            }, 100);
                        }
                    }).catch((error) => {
                        console.warn('[ProcessMermaid] Mermaid 渲染失败:', error);
                    });
                }, 200);
            } catch (error) {
                console.error('处理 Mermaid 代码块时出错:', error);
                // 出错时显示错误信息，但保留原始代码
                const errorDiv = document.createElement('div');
                errorDiv.className = 'mermaid-error';
                // 样式已通过 CSS 类定义
                errorDiv.innerHTML = `
                    <div>❌ Mermaid 图表渲染失败</div>
                    <pre style="font-size: 10px; margin-top: 5px; overflow-x: auto;">${this.escapeHtml(mermaidContent)}</pre>
                `;
                if (mermaidDiv && mermaidDiv.parentNode) {
                    mermaidDiv.parentNode.replaceChild(errorDiv, mermaidDiv);
                }
            }
        });
    };

    // 渲染 Markdown 为 HTML（使用 petManager.message.js 中的实现，确保 mermaid 处理一致）
    proto.renderMarkdown = function (markdown) {
        if (!markdown) return '';

        try {
            // 检查 marked 是否可用
            if (typeof marked !== 'undefined') {
                // 创建自定义渲染器（与 petManager.message.js 保持一致）
                const renderer = new marked.Renderer();

                // 覆盖 link 渲染（安全处理）
                renderer.link = (href, title, text) => {
                    const safeHref = this._sanitizeUrl ? this._sanitizeUrl(href) : href;
                    const safeText = text || '';
                    if (!safeHref) return safeText;
                    const safeTitle = title ? ` title="${this.escapeHtml(title)}"` : '';
                    return `<a href="${this.escapeHtml(safeHref)}"${safeTitle} target="_blank" rel="noopener noreferrer">${safeText}</a>`;
                };

                // 覆盖 image 渲染（安全处理）
                renderer.image = (href, title, text) => {
                    const safeHref = this._sanitizeUrl ? this._sanitizeUrl(href) : href;
                    const alt = this.escapeHtml(text || '');
                    if (!safeHref) return alt;
                    const safeTitle = title ? ` title="${this.escapeHtml(title)}"` : '';
                    return `<img src="${this.escapeHtml(safeHref)}" alt="${alt}" loading="lazy"${safeTitle} />`;
                };

                // 覆盖 html 渲染（安全渲染 HTML）
                renderer.html = (token) => {
                    return (typeof token === 'string')
                        ? token
                        : (token && (token.raw || token.text)) || '';
                };

                // 覆盖 code 渲染（处理 mermaid）- 关键：将 mermaid 转换为 div.mermaid
                renderer.code = (code, language, isEscaped) => {
                    const lang = (language || '').trim().toLowerCase();
                    if (lang === 'mermaid' || lang === 'mmd') {
                        return `<div class="mermaid">${code}</div>`;
                    }
                    return marked.Renderer.prototype.code.call(renderer, code, language, isEscaped);
                };

                // 配置 marked
                marked.setOptions({
                    renderer: renderer,
                    breaks: true, // 支持换行
                    gfm: true, // GitHub Flavored Markdown
                    sanitize: false // 允许 HTML，但我们会通过手动处理确保安全
                });
                const rendered = marked.parse(markdown);
                if (typeof this._sanitizeMarkdownHtml === 'function') {
                    return this._sanitizeMarkdownHtml(rendered);
                }
                return rendered;
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

    // URL 净化辅助函数（与 petManager.message.js 保持一致）
    proto._sanitizeUrl = function(url) {
        if (!url) return '';
        try {
            const prot = decodeURIComponent(url)
                .replace(/[^A-Za-z0-9/:]/g, '')
                .toLowerCase();
            if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
                return '';
            }
        } catch (e) {
            return '';
        }
        return url;
    };

    // HTML 转义辅助函数（使用 DomHelper，保留兼容性）
    proto.escapeHtml = function (text) {
        if (typeof DomHelper !== 'undefined' && typeof DomHelper.escapeHtml === 'function') {
            return DomHelper.escapeHtml(text);
        }
        // 降级实现
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    if (typeof proto._isSafeCssColor !== 'function') {
        proto._isSafeCssColor = function(color) {
            if (!color || typeof color !== 'string') return false;
            const value = color.trim();
            if (!value || value.length > 48) return false;
            if (/^#[0-9a-fA-F]{3}$/.test(value) || /^#[0-9a-fA-F]{6}$/.test(value)) return true;
            if (/^[a-zA-Z]+$/.test(value)) return true;
            const rgbMatch = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
            if (rgbMatch) {
                const r = Number(rgbMatch[1]);
                const g = Number(rgbMatch[2]);
                const b = Number(rgbMatch[3]);
                return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255;
            }
            const rgbaMatch = value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i);
            if (rgbaMatch) {
                const r = Number(rgbaMatch[1]);
                const g = Number(rgbaMatch[2]);
                const b = Number(rgbaMatch[3]);
                const a = Number(rgbaMatch[4]);
                return r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255 && a >= 0 && a <= 1;
            }
            return false;
        };
    }

    if (typeof proto._isSafeCssLength !== 'function') {
        proto._isSafeCssLength = function(value) {
            if (!value || typeof value !== 'string') return false;
            const v = value.trim();
            if (/^-?0+(?:\.0+)?$/.test(v)) return true;
            const m = v.match(/^(-?\d+(?:\.\d+)?)(px|em|rem|%|vh|vw)$/i);
            if (!m) return false;
            const num = Number(m[1]);
            if (!Number.isFinite(num)) return false;
            return num >= -2000 && num <= 2000;
        };
    }

    if (typeof proto._sanitizeClassName !== 'function') {
        proto._sanitizeClassName = function(className) {
            if (!className || typeof className !== 'string') return '';
            const cleaned = className.replace(/[^a-zA-Z0-9 _-]/g, ' ').replace(/\s+/g, ' ').trim();
            return cleaned.length > 128 ? cleaned.slice(0, 128).trim() : cleaned;
        };
    }

    if (typeof proto._sanitizeStyleText !== 'function') {
        proto._sanitizeStyleText = function(styleText) {
            if (!styleText || typeof styleText !== 'string') return '';
            const text = styleText.trim();
            if (!text) return '';
            const lowered = text.toLowerCase();
            if (lowered.includes('expression(') || lowered.includes('javascript:') || lowered.includes('vbscript:') || lowered.includes('url(')) {
                return '';
            }

            const allowedProps = new Set([
                'color',
                'background-color',
                'font-weight',
                'font-style',
                'text-decoration',
                'font-size',
                'line-height',
                'font-family',
                'text-align',
                'white-space',
                'word-break',
                'overflow',
                'overflow-x',
                'overflow-y',
                'max-width',
                'min-width',
                'width',
                'height',
                'max-height',
                'padding',
                'padding-left',
                'padding-right',
                'padding-top',
                'padding-bottom',
                'margin',
                'margin-left',
                'margin-right',
                'margin-top',
                'margin-bottom',
                'border',
                'border-radius',
                'border-color',
                'border-width',
                'border-style',
                'display',
                'content',
                'position',
                'top',
                'right',
                'bottom',
                'left',
                'inset',
                'z-index',
                'opacity',
                'transform',
                'pointer-events'
            ]);

            const safeDecls = [];
            const parts = text.split(';');
            for (const part of parts) {
                const p = part.trim();
                if (!p) continue;
                const idx = p.indexOf(':');
                if (idx <= 0) continue;
                const prop = p.slice(0, idx).trim().toLowerCase();
                let value = p.slice(idx + 1).trim();
                if (!allowedProps.has(prop)) continue;
                const hasImportant = /\s*!important\s*$/i.test(value);
                if (hasImportant) {
                    value = value.replace(/\s*!important\s*$/i, '').trim();
                    if (!value) continue;
                }
                if (/\!important/i.test(value)) continue;

                if (prop === 'color' || prop === 'background-color' || prop === 'border-color') {
                    if (!this._isSafeCssColor(value)) continue;
                    safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'font-weight') {
                    const v = value.toLowerCase();
                    if (v === 'normal' || v === 'bold' || v === 'bolder' || v === 'lighter' || /^\d{3}$/.test(v)) {
                        safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    }
                    continue;
                }

                if (prop === 'font-style') {
                    const v = value.toLowerCase();
                    if (v === 'normal' || v === 'italic' || v === 'oblique') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'text-decoration') {
                    const v = value.toLowerCase();
                    if (v === 'none' || v === 'underline' || v === 'line-through') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'text-align') {
                    const v = value.toLowerCase();
                    if (v === 'left' || v === 'right' || v === 'center' || v === 'justify') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'white-space') {
                    const v = value.toLowerCase();
                    if (v === 'normal' || v === 'nowrap' || v === 'pre' || v === 'pre-wrap' || v === 'pre-line') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'word-break') {
                    const v = value.toLowerCase();
                    if (v === 'normal' || v === 'break-all' || v === 'keep-all' || v === 'break-word') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'overflow' || prop === 'overflow-x' || prop === 'overflow-y') {
                    const v = value.toLowerCase();
                    if (v === 'visible' || v === 'hidden' || v === 'scroll' || v === 'auto') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'display') {
                    const v = value.toLowerCase();
                    if (v === 'inline' || v === 'block' || v === 'inline-block' || v === 'flex' || v === 'inline-flex' || v === 'none') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'content') {
                    const v = value.trim();
                    const lowerV = v.toLowerCase();
                    if (lowerV === 'none' || lowerV === 'normal' || lowerV === 'open-quote' || lowerV === 'close-quote' || lowerV === 'no-open-quote' || lowerV === 'no-close-quote') {
                        safeDecls.push(`${prop}:${lowerV}${hasImportant ? ' !important' : ''}`);
                        continue;
                    }
                    if (/^(['"])(?:\\.|(?!\1)[^\\\n\r])*?\1$/.test(v) && v.length <= 120) {
                        safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                        continue;
                    }
                    continue;
                }

                if (prop === 'position') {
                    const v = value.toLowerCase();
                    if (!(v === 'static' || v === 'relative' || v === 'absolute' || v === 'sticky')) continue;
                    safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left') {
                    const v = value.toLowerCase();
                    if (!(v === 'auto' || this._isSafeCssLength(v))) continue;
                    safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'inset') {
                    const tokens = value.split(/\s+/).filter(Boolean).map(t => t.toLowerCase());
                    if (tokens.length < 1 || tokens.length > 4) continue;
                    if (!tokens.every(t => t === 'auto' || this._isSafeCssLength(t))) continue;
                    safeDecls.push(`${prop}:${tokens.join(' ')}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'z-index') {
                    const v = value.trim();
                    if (!/^-?\d{1,5}$/.test(v)) continue;
                    const n = Number(v);
                    if (!Number.isFinite(n) || n < -9999 || n > 9999) continue;
                    safeDecls.push(`${prop}:${n}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'opacity') {
                    const v = value.trim();
                    if (!/^(0|1|0?\.\d+)$/.test(v)) continue;
                    const n = Number(v);
                    if (!Number.isFinite(n) || n < 0 || n > 1) continue;
                    safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'pointer-events') {
                    const v = value.toLowerCase();
                    if (!(v === 'auto' || v === 'none')) continue;
                    safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'transform') {
                    const v = value.trim();
                    const lowerV = v.toLowerCase();
                    if (lowerV === 'none') {
                        safeDecls.push(`${prop}:none${hasImportant ? ' !important' : ''}`);
                        continue;
                    }
                    if (v.length > 120) continue;
                    if (!/^[0-9a-zA-Z().,%+\- \t]+$/.test(v)) continue;
                    if (lowerV.includes('url(') || lowerV.includes('expression(') || lowerV.includes('javascript:') || lowerV.includes('vbscript:')) continue;
                    const allowedFns = new Set(['translate', 'translatex', 'translatey', 'scale', 'scalex', 'scaley', 'rotate', 'skew', 'skewx', 'skewy', 'perspective']);
                    const fnMatches = lowerV.match(/[a-z-]+\(/g) || [];
                    let ok = true;
                    for (const m of fnMatches) {
                        const name = m.slice(0, -1);
                        if (!allowedFns.has(name)) { ok = false; break; }
                    }
                    if (!ok) continue;
                    safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'border-style') {
                    const v = value.toLowerCase();
                    if (v === 'none' || v === 'solid' || v === 'dashed' || v === 'dotted' || v === 'double') safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'border-width') {
                    const v = value.toLowerCase();
                    if (this._isSafeCssLength(v) || /^\d{1,3}$/.test(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'border-radius') {
                    const v = value.toLowerCase();
                    if (this._isSafeCssLength(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'font-size' || prop === 'line-height' || prop === 'max-width' || prop === 'min-width' || prop === 'width' || prop === 'height' || prop === 'max-height') {
                    const v = value.toLowerCase();
                    if (this._isSafeCssLength(v) || /^\d{1,4}$/.test(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'padding' || prop === 'padding-left' || prop === 'padding-right' || prop === 'padding-top' || prop === 'padding-bottom' ||
                    prop === 'margin' || prop === 'margin-left' || prop === 'margin-right' || prop === 'margin-top' || prop === 'margin-bottom') {
                    const v = value.toLowerCase();
                    if (this._isSafeCssLength(v) || /^0$/.test(v)) safeDecls.push(`${prop}:${value}${hasImportant ? ' !important' : ''}`);
                    continue;
                }

                if (prop === 'border') {
                    const v = value.toLowerCase();
                    if (v.includes('url(') || v.includes('expression(') || v.includes('javascript:') || v.includes('vbscript:')) continue;
                    safeDecls.push(`${prop}:${value}`.slice(0, 120) + (hasImportant ? ' !important' : ''));
                    continue;
                }

                if (prop === 'font-family') {
                    const cleaned = value.replace(/[^a-zA-Z0-9 ,'"-]/g, '').trim();
                    if (cleaned) safeDecls.push(`${prop}:${cleaned}`.slice(0, 120) + (hasImportant ? ' !important' : ''));
                    continue;
                }
            }

            return safeDecls.join(';');
        };
    }

    if (typeof proto._sanitizeImageSrc !== 'function') {
        proto._sanitizeImageSrc = function(src) {
            if (!src || typeof src !== 'string') return '';
            const s = src.trim();
            if (/^data:image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(s)) {
                return s;
            }
            return this._sanitizeUrl(s);
        };
    }

    if (typeof proto._sanitizeStyleSheetText !== 'function') {
        proto._sanitizeStyleSheetText = function(cssText) {
            if (!cssText || typeof cssText !== 'string') return '';
            const text = cssText.trim();
            if (!text) return '';
            const lowered = text.toLowerCase();
            if (lowered.includes('@') || lowered.includes('url(') || lowered.includes('expression(') || lowered.includes('javascript:') || lowered.includes('vbscript:')) {
                return '';
            }

            const scopeSelector = (sel) => {
                if (!sel) return '';
                let s = String(sel).trim();
                if (!s) return '';
                if (s.startsWith('.markdown-content')) return s;
                s = s.replace(/#pet-context-preview\b/g, '.markdown-content');
                s = s.replace(/#pet-message-preview\b/g, '.markdown-content');
                s = s.replace(/\.context-editor-preview\b/g, '.markdown-content');
                s = s.replace(/^(:root|html|body)\b/g, '.markdown-content');
                s = s.trim();
                if (!s) return '';
                if (s.startsWith('.markdown-content')) return s;
                return `.markdown-content ${s}`;
            };

            const rules = [];
            const blocks = text.split('}');
            for (const block of blocks) {
                const b = block.trim();
                if (!b) continue;
                const idx = b.indexOf('{');
                if (idx <= 0) continue;
                const selectorPart = b.slice(0, idx).trim();
                const declPart = b.slice(idx + 1).trim();
                if (!selectorPart || !declPart) continue;

                const safeDecls = this._sanitizeStyleText(declPart);
                if (!safeDecls) continue;

                const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean);
                if (selectors.length === 0) continue;

                const needsDefaultContent = selectors.some(sel => /(^|[^-])::?(before|after)\b/i.test(sel)) && !/content\s*:/i.test(safeDecls);
                const finalDecls = needsDefaultContent ? `${safeDecls};content:""` : safeDecls;

                const scopedSelectors = selectors.map(scopeSelector).filter(Boolean).join(', ');
                if (!scopedSelectors) continue;

                rules.push(`${scopedSelectors}{${finalDecls}}`);
            }

            return rules.join('\n');
        };
    }

    if (typeof proto._sanitizeMarkdownHtml !== 'function') {
        proto._sanitizeMarkdownHtml = function(html) {
            if (!html) return '';
            if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
                return this.escapeHtml(String(html));
            }

            const raw = String(html);
            const template = document.createElement('template');
            try {
                template.innerHTML = raw;
            } catch (e) {
                return this.escapeHtml(raw);
            }

            const allowedTags = new Set([
                'a', 'b', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li',
                'mark', 'ol', 'p', 'pre', 'small', 'span', 'strong', 'sub', 'summary',
                'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul', 'style'
            ]);

            const removeTags = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta']);

            const sanitizeElement = (el) => {
                const tag = String(el.tagName || '').toLowerCase();

                for (const child of Array.from(el.childNodes)) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        sanitizeElement(child);
                    } else if (child.nodeType === Node.COMMENT_NODE) {
                        child.parentNode && child.parentNode.removeChild(child);
                    }
                }

                if (removeTags.has(tag)) {
                    el.parentNode && el.parentNode.removeChild(el);
                    return;
                }

                if (!allowedTags.has(tag)) {
                    const parent = el.parentNode;
                    if (parent) {
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        parent.removeChild(el);
                    }
                    return;
                }

                if (tag === 'style') {
                    for (const attr of Array.from(el.attributes)) {
                        el.removeAttribute(attr.name);
                    }
                    const safeCss = this._sanitizeStyleSheetText(el.textContent || '');
                    el.textContent = safeCss || '';
                    if (!safeCss) {
                        el.parentNode && el.parentNode.removeChild(el);
                    }
                    return;
                }

                for (const attr of Array.from(el.attributes)) {
                    const name = attr.name.toLowerCase();
                    if (name.startsWith('on')) {
                        el.removeAttribute(attr.name);
                        continue;
                    }
                    if (name === 'style') {
                        const safeStyle = this._sanitizeStyleText(attr.value || '');
                        if (safeStyle) el.setAttribute('style', safeStyle);
                        else el.removeAttribute('style');
                        continue;
                    }
                    if (name === 'class') {
                        const safeClass = this._sanitizeClassName(attr.value || '');
                        if (safeClass) el.setAttribute('class', safeClass);
                        else el.removeAttribute('class');
                        continue;
                    }

                    if (tag === 'a' && (name === 'href' || name === 'title' || name === 'target' || name === 'rel')) {
                        if (name === 'href') {
                            const safeHref = this._sanitizeUrl(attr.value || '');
                            if (safeHref) el.setAttribute('href', safeHref);
                            else el.removeAttribute('href');
                        } else if (name === 'target') {
                            const v = String(attr.value || '').toLowerCase();
                            if (v === '_blank' || v === '_self') el.setAttribute('target', v);
                            else el.removeAttribute('target');
                        } else if (name === 'rel') {
                            el.setAttribute('rel', 'noopener noreferrer');
                        } else {
                            el.setAttribute(name, String(attr.value || '').slice(0, 120));
                        }
                        continue;
                    }

                    if (tag === 'img' && (name === 'src' || name === 'alt' || name === 'title' || name === 'width' || name === 'height' || name === 'loading')) {
                        if (name === 'src') {
                            const safeSrc = this._sanitizeImageSrc(attr.value || '');
                            if (safeSrc) el.setAttribute('src', safeSrc);
                            else el.removeAttribute('src');
                        } else if (name === 'width' || name === 'height') {
                            const v = String(attr.value || '').trim();
                            if (/^\d{1,4}$/.test(v)) el.setAttribute(name, v);
                            else el.removeAttribute(name);
                        } else if (name === 'loading') {
                            const v = String(attr.value || '').toLowerCase();
                            if (v === 'lazy' || v === 'eager') el.setAttribute('loading', v);
                            else el.setAttribute('loading', 'lazy');
                        } else {
                            el.setAttribute(name, this.escapeHtml(String(attr.value || '')).slice(0, 200));
                        }
                        continue;
                    }

                    if ((name === 'title' || name === 'aria-label') && attr.value) {
                        el.setAttribute(name, String(attr.value).slice(0, 200));
                        continue;
                    }

                    el.removeAttribute(attr.name);
                }

                if (tag === 'a' && el.getAttribute('target') === '_blank') {
                    el.setAttribute('rel', 'noopener noreferrer');
                }

                if (tag === 'img') {
                    if (!el.getAttribute('loading')) el.setAttribute('loading', 'lazy');
                }
            };

            for (const node of Array.from(template.content.childNodes)) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    sanitizeElement(node);
                } else if (node.nodeType === Node.COMMENT_NODE) {
                    node.parentNode && node.parentNode.removeChild(node);
                }
            }

            const container = document.createElement('div');
            container.appendChild(template.content.cloneNode(true));
            return container.innerHTML;
        };
    }

    // 为 Mermaid 图表添加复制和下载按钮
    proto.addMermaidActions = function (mermaidDiv, svgContent, mermaidSourceCode) {
        if (!mermaidDiv) return;

        // 检查是否已经添加了按钮
        if (mermaidDiv.querySelector('.mermaid-actions')) {
            return;
        }

        // 创建按钮容器（样式已通过 CSS 类定义）
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'mermaid-actions';

        // 确保 mermaid div 有相对定位（用于绝对定位的按钮容器）
        const currentPosition = window.getComputedStyle(mermaidDiv).position;
        if (currentPosition === 'static') {
            mermaidDiv.classList.add('mermaid-has-relative-position');
        }

        // 创建复制按钮（样式已通过 CSS 类定义）
        const copyButton = document.createElement('button');
        copyButton.className = 'mermaid-copy-button';
        copyButton.title = '复制 Mermaid 代码';
        copyButton.innerHTML = '📋';

        // 创建下载 SVG 按钮（样式已通过 CSS 类定义）
        const downloadButton = document.createElement('button');
        downloadButton.className = 'mermaid-download-button';
        downloadButton.title = '下载 SVG';
        downloadButton.innerHTML = '💾';

        // 创建下载 PNG 按钮（样式已通过 CSS 类定义）
        const downloadPngButton = document.createElement('button');
        downloadPngButton.className = 'mermaid-download-png-button';
        downloadPngButton.title = '下载 PNG';
        downloadPngButton.innerHTML = '🖼️';

        // 创建编辑按钮（在新标签页打开 Mermaid Live Editor）
        const editButton = document.createElement('button');
        editButton.className = 'mermaid-edit-button';
        editButton.title = '在 Mermaid Live Editor 中打开';
        editButton.innerHTML = '✏️';

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
                    link.classList.add('tw-hidden');
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
                    downloadPngButton.classList.add('js-loading');

                    // 转换为 PNG
                    const pngBlob = await svgToPng(svg);

                    // 创建下载链接
                    const url = URL.createObjectURL(pngBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `mermaid-diagram-${Date.now()}.png`;
                    link.classList.add('tw-hidden');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    // 显示成功提示
                    downloadPngButton.innerHTML = '✓';
                    downloadPngButton.classList.remove('js-loading');
                    downloadPngButton.classList.add('js-success');
                    setTimeout(() => {
                        downloadPngButton.innerHTML = '🖼️';
                        downloadPngButton.classList.remove('js-success');
                    }, 1000);
                } else {
                    throw new Error('无法获取 SVG 内容');
                }
            } catch (error) {
                console.error('下载 PNG 失败:', error);
                downloadPngButton.innerHTML = '✗';
                downloadPngButton.classList.remove('js-loading');
                downloadPngButton.classList.add('js-error');
                setTimeout(() => {
                    downloadPngButton.innerHTML = '🖼️';
                    downloadPngButton.classList.remove('js-error');
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
                editButton.classList.add('js-loading');

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
                        textArea.classList.add('pet-offscreen-invisible');
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
                        editButton.classList.toggle('js-success', clipboardSuccess);
                        editButton.classList.toggle('js-warning', !clipboardSuccess && urlOpened);
                    }

                    // 创建临时提示（仅在成功复制或打开时显示）
                    if (clipboardSuccess || urlOpened) {
                        const tip = document.createElement('div');
                        tip.textContent = tipMessage;
                        tip.className = 'mermaid-tip';

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
                        editButton.classList.remove('js-success', 'js-warning');
                        editButton.classList.remove('js-loading');
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
                    editButton.classList.remove('js-loading');
                }, 1000);
            }
        });

        // 创建全屏按钮
        const fullscreenButton = document.createElement('button');
        fullscreenButton.className = 'mermaid-fullscreen-button';
        fullscreenButton.title = '全屏查看';
        fullscreenButton.innerHTML = '⛶';

        // 全屏按钮点击事件
        fullscreenButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.openMermaidFullscreen(mermaidDiv, mermaidSourceCode);
        });

        actionsContainer.appendChild(copyButton);
        actionsContainer.appendChild(downloadButton);
        actionsContainer.appendChild(downloadPngButton);
        actionsContainer.appendChild(editButton);
        actionsContainer.appendChild(fullscreenButton);
        mermaidDiv.appendChild(actionsContainer);
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
        fullscreenContainer.className = 'mermaid-fullscreen-container';
        // 使用比聊天窗口更高的 z-index（聊天窗口是 2147483648）
        const fullscreenZIndex = 2147483649;
        fullscreenContainer.style.top = `${chatRect.top}px`;
        fullscreenContainer.style.left = `${chatRect.left}px`;
        fullscreenContainer.style.width = `${chatRect.width}px`;
        fullscreenContainer.style.height = `${chatRect.height}px`;
        fullscreenContainer.style.zIndex = String(fullscreenZIndex);

        // 创建头部栏（包含关闭按钮）
        const headerBar = document.createElement('div');
        headerBar.className = 'mermaid-fullscreen-header';

        const title = document.createElement('div');
        title.textContent = 'Mermaid 图表全屏查看';
        title.className = 'mermaid-fullscreen-title';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.title = '关闭全屏';
        closeButton.className = 'mermaid-fullscreen-close';
        closeButton.addEventListener('click', () => {
            fullscreenContainer.remove();
        });

        headerBar.appendChild(title);
        headerBar.appendChild(closeButton);

        // 创建内容区域
        const contentArea = document.createElement('div');
        contentArea.className = 'mermaid-fullscreen-content';

        // 克隆 mermaid 图表
        const clonedMermaid = mermaidDiv.cloneNode(true);
        clonedMermaid.classList.add('mermaid-fullscreen-mermaid');

        // 移除克隆元素中的操作按钮
        const clonedActions = clonedMermaid.querySelector('.mermaid-actions');
        if (clonedActions) {
            clonedActions.remove();
        }

        // 调整 SVG 样式使其自适应
        const adjustSvgSize = () => {
            const svg = clonedMermaid.querySelector('svg');
            if (svg) {
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
                renderIdContainer.classList.add('tw-hidden');
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
                    renderScript.src = chrome.runtime.getURL('src/features/mermaid/page/render-mermaid.js');
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
