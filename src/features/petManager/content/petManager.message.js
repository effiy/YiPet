/**
 * PetManager - 消息处理相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 提取媒体URL（图片和视频）
    proto.extractMediaUrls = function(text) {
        const images = [];
        const videos = [];
        let cleanedText = text || '';
        
        if (!text || typeof text !== 'string') {
            return { images, videos, cleanedText };
        }
        
        // 提取 data URL 格式的图片（data:image/...）
        const dataImageRegex = /data:image\/[^;]+;base64,[^\s"'<>]+/gi;
        const dataImageMatches = text.match(dataImageRegex);
        if (dataImageMatches) {
            images.push(...dataImageMatches);
            // 从文本中移除这些 data URL
            dataImageMatches.forEach(url => {
                cleanedText = cleanedText.replace(url, '');
            });
        }
        
        // 提取普通 URL 格式的图片（http:// 或 https:// 结尾是图片扩展名）
        const imageUrlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s"'<>]*)?/gi;
        const imageUrlMatches = text.match(imageUrlRegex);
        if (imageUrlMatches) {
            imageUrlMatches.forEach(url => {
                if (!images.includes(url)) {
                    images.push(url);
                }
                // 从文本中移除这些 URL
                cleanedText = cleanedText.replace(url, '');
            });
        }
        
        // 提取视频 URL（http:// 或 https:// 结尾是视频扩展名）
        const videoUrlRegex = /https?:\/\/[^\s"'<>]+\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)(\?[^\s"'<>]*)?/gi;
        const videoUrlMatches = text.match(videoUrlRegex);
        if (videoUrlMatches) {
            videos.push(...videoUrlMatches);
            // 从文本中移除这些 URL
            videoUrlMatches.forEach(url => {
                cleanedText = cleanedText.replace(url, '');
            });
        }
        
        // 提取 data URL 格式的视频（data:video/...）
        const dataVideoRegex = /data:video\/[^;]+;base64,[^\s"'<>]+/gi;
        const dataVideoMatches = text.match(dataVideoRegex);
        if (dataVideoMatches) {
            videos.push(...dataVideoMatches);
            // 从文本中移除这些 data URL
            dataVideoMatches.forEach(url => {
                cleanedText = cleanedText.replace(url, '');
            });
        }
        
        // 清理多余的空白字符
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        
        return { images, videos, cleanedText };
    };

    // 从消息 DOM 元素找到对应的消息索引（更准确的方法）
    proto.findMessageIndexByDiv = function(messageDiv) {
        if (!messageDiv || !this.currentSessionId || !this.sessions[this.currentSessionId]) {
            return -1;
        }

        const session = this.sessions[this.currentSessionId];
        if (!session.messages || !Array.isArray(session.messages)) {
            return -1;
        }

        const timestampAttr = messageDiv.getAttribute('data-chat-timestamp');
        const messageTimestamp = timestampAttr ? Number(timestampAttr) : NaN;
        if (Number.isFinite(messageTimestamp) && messageTimestamp > 0) {
            const chatType = messageDiv.getAttribute('data-chat-type');
            const messageType = chatType === 'pet' ? 'pet' : (chatType === 'user' ? 'user' : null);
            for (let i = session.messages.length - 1; i >= 0; i--) {
                const msg = session.messages[i];
                if (!msg) continue;
                if (Number(msg.timestamp) === messageTimestamp && (!messageType || msg.type === messageType)) {
                    return i;
                }
            }
        }

        // 获取消息容器
        const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages');
        if (!messagesContainer) {
            return -1;
        }

        // 获取所有消息DOM元素（排除欢迎消息）
        const allMessageDivs = Array.from(messagesContainer.children).filter(div => {
            // 排除欢迎消息和其他非消息元素
            return !div.hasAttribute('data-welcome-message') && 
                   (div.querySelector('[data-message-type="user-bubble"]') || 
                    div.querySelector('[data-message-type="pet-bubble"]'));
        });

        // 找到当前消息在DOM中的索引
        const domIndex = allMessageDivs.indexOf(messageDiv);
        if (domIndex < 0) {
            return -1;
        }

        // DOM中的消息顺序应该与session.messages数组顺序一致
        // 但需要排除欢迎消息，所以直接使用domIndex
        if (domIndex >= 0 && domIndex < session.messages.length) {
            return domIndex;
        }

        return -1;
    };

    // 从消息 DOM 元素找到对应的消息对象
    proto.findMessageObjectByDiv = function(messageDiv) {
        if (!messageDiv || !this.currentSessionId || !this.sessions[this.currentSessionId]) {
            return null;
        }

        const session = this.sessions[this.currentSessionId];
        if (!session.messages || !Array.isArray(session.messages)) {
            return null;
        }

        // 首先尝试通过索引匹配（更准确）
        const messageIndex = this.findMessageIndexByDiv(messageDiv);
        if (messageIndex >= 0 && messageIndex < session.messages.length) {
            const msg = session.messages[messageIndex];
            // 验证消息类型是否匹配
            const isUserMessage = messageDiv.querySelector('[data-message-type="user-bubble"]');
            const messageType = isUserMessage ? 'user' : 'pet';
            if (msg && msg.type === messageType) {
                return { message: msg, index: messageIndex };
            }
        }

        return null;
    };

    proto.escapeHtml = function(text) {
        if (typeof DomHelper === 'undefined' || typeof DomHelper.escapeHtml !== 'function') {
            throw new Error('DomHelper.escapeHtml is not available');
        }
        return DomHelper.escapeHtml(text);
    };

    // URL 净化辅助函数
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

    proto._sanitizeClassName = function(className) {
        if (!className || typeof className !== 'string') return '';
        const cleaned = className.replace(/[^a-zA-Z0-9 _-]/g, ' ').replace(/\s+/g, ' ').trim();
        return cleaned.length > 128 ? cleaned.slice(0, 128).trim() : cleaned;
    };

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
            'margin',
            'margin-top',
            'margin-right',
            'margin-bottom',
            'margin-left',
            'padding',
            'padding-top',
            'padding-right',
            'padding-bottom',
            'padding-left',
            'border',
            'border-radius',
            'border-width',
            'border-style',
            'border-color',
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

        const parts = text.split(';');
        const safeDecls = [];

        for (const part of parts) {
            const p = part.trim();
            if (!p) continue;
            const idx = p.indexOf(':');
            if (idx <= 0) continue;
            const prop = p.slice(0, idx).trim().toLowerCase();
            let val = p.slice(idx + 1).trim();
            if (!prop || !val) continue;
            if (!allowedProps.has(prop)) continue;
            if (val.length > 160) continue;
            if (/[\u0000-\u001f\u007f]/.test(val)) continue;

            const hasImportant = /\s*!important\s*$/i.test(val);
            if (hasImportant) {
                val = val.replace(/\s*!important\s*$/i, '').trim();
                if (!val) continue;
            }
            if (/\!important/i.test(val)) continue;

            if (prop === 'color' || prop === 'background-color' || prop.endsWith('border-color')) {
                if (!this._isSafeCssColor(val)) continue;
                safeDecls.push(`${prop}:${val}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'font-weight') {
                const v = val.toLowerCase();
                if (!(v === 'normal' || v === 'bold' || v === 'bolder' || v === 'lighter' || /^[1-9]00$/.test(v))) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'font-style') {
                const v = val.toLowerCase();
                if (!(v === 'normal' || v === 'italic' || v === 'oblique')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'text-decoration') {
                const v = val.toLowerCase();
                if (!(v === 'none' || v === 'underline' || v === 'line-through' || v === 'overline')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'text-align') {
                const v = val.toLowerCase();
                if (!(v === 'left' || v === 'right' || v === 'center' || v === 'justify' || v === 'start' || v === 'end')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'white-space') {
                const v = val.toLowerCase();
                if (!(v === 'normal' || v === 'nowrap' || v === 'pre' || v === 'pre-wrap' || v === 'pre-line')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'word-break') {
                const v = val.toLowerCase();
                if (!(v === 'normal' || v === 'break-all' || v === 'keep-all' || v === 'break-word')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'overflow' || prop === 'overflow-x' || prop === 'overflow-y') {
                const v = val.toLowerCase();
                if (!(v === 'visible' || v === 'hidden' || v === 'scroll' || v === 'auto' || v === 'clip')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'display') {
                const v = val.toLowerCase();
                if (!(v === 'inline' || v === 'block' || v === 'inline-block' || v === 'none' || v === 'flex')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'content') {
                const v = val.trim();
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
                const v = val.toLowerCase();
                if (!(v === 'static' || v === 'relative' || v === 'absolute' || v === 'sticky')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left') {
                const v = val.toLowerCase();
                if (!(v === 'auto' || this._isSafeCssLength(v))) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'inset') {
                const tokens = val.split(/\s+/).filter(Boolean).map(t => t.toLowerCase());
                if (tokens.length < 1 || tokens.length > 4) continue;
                if (!tokens.every(t => t === 'auto' || this._isSafeCssLength(t))) continue;
                safeDecls.push(`${prop}:${tokens.join(' ')}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'z-index') {
                const v = val.trim();
                if (!/^-?\d{1,5}$/.test(v)) continue;
                const n = Number(v);
                if (!Number.isFinite(n) || n < -9999 || n > 9999) continue;
                safeDecls.push(`${prop}:${n}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'opacity') {
                const v = val.trim();
                if (!/^(0|1|0?\.\d+)$/.test(v)) continue;
                const n = Number(v);
                if (!Number.isFinite(n) || n < 0 || n > 1) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'pointer-events') {
                const v = val.toLowerCase();
                if (!(v === 'auto' || v === 'none')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'transform') {
                const v = val.trim();
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

            if (prop === 'font-family') {
                const v = val.replace(/["<>]/g, '').trim();
                if (!v || v.length > 80) continue;
                if (!/^[a-zA-Z0-9 ,_-]+$/.test(v)) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'font-size' || prop === 'line-height' || prop === 'width' || prop === 'height' || prop === 'max-width' || prop === 'min-width' || prop === 'border-radius' || prop.endsWith('margin') || prop.startsWith('margin-') || prop.endsWith('padding') || prop.startsWith('padding-') || prop.endsWith('border-width')) {
                const tokens = val.split(/\s+/).filter(Boolean);
                if (tokens.length < 1 || tokens.length > 4) continue;
                if (!tokens.every(t => this._isSafeCssLength(t))) continue;
                safeDecls.push(`${prop}:${tokens.join(' ')}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'border-style') {
                const v = val.toLowerCase();
                if (!(v === 'none' || v === 'solid' || v === 'dashed' || v === 'dotted' || v === 'double')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }

            if (prop === 'border') {
                const v = val.toLowerCase().replace(/["<>]/g, '').trim();
                if (!v || v.length > 80) continue;
                if (v.includes('url(') || v.includes('expression(')) continue;
                safeDecls.push(`${prop}:${v}${hasImportant ? ' !important' : ''}`);
                continue;
            }
        }

        return safeDecls.join(';');
    };

    proto._sanitizeImageSrc = function(src) {
        if (!src || typeof src !== 'string') return '';
        const s = src.trim();
        if (/^data:image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(s)) {
            return s;
        }
        return this._sanitizeUrl(s);
    };

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

        const normalizeComponentName = (el) => String(el?.tagName || '').trim().toLowerCase();
        const pickAttr = (el, names) => {
            if (!el || !names) return '';
            for (const name of names) {
                if (el.hasAttribute(name)) return String(el.getAttribute(name) || '').trim();
                const lower = String(name).toLowerCase();
                if (lower !== name && el.hasAttribute(lower)) return String(el.getAttribute(lower) || '').trim();
            }
            return '';
        };

        const toSafeText = (value, maxLen = 240) => {
            const s = String(value ?? '').replace(/\s+/g, ' ').trim();
            if (!s) return '';
            return s.length > maxLen ? s.slice(0, maxLen).trim() : s;
        };

        const transformComponents = (root) => {
            if (!root || typeof root.querySelectorAll !== 'function') return;

            const replaceWith = (from, to) => {
                const parent = from?.parentNode;
                if (!parent || !to) return;
                parent.replaceChild(to, from);
            };

            const moveChildren = (from, to) => {
                if (!from || !to) return;
                while (from.firstChild) to.appendChild(from.firstChild);
            };

            const hasRenderedMarkdown = (el) => {
                if (!el || typeof el.querySelector !== 'function') return false;
                return !!el.querySelector(
                    'p, strong, em, table, thead, tbody, tr, ul, ol, pre, code, h1, h2, h3, h4, h5, h6, blockquote'
                );
            };

            const isInsideCodeBlock = (el) => {
                let cur = el;
                while (cur && cur.nodeType === Node.ELEMENT_NODE) {
                    const tag = String(cur.tagName || '').toLowerCase();
                    if (tag === 'pre' || tag === 'code') return true;
                    cur = cur.parentElement;
                }
                return false;
            };

            const extractMarkdownCandidate = (el) => {
                if (!el) return '';
                let text = '';
                try {
                    if (typeof el.innerText === 'string') text = el.innerText;
                } catch (_) {}
                if (!String(text || '').trim()) {
                    text = String(el.textContent || '');
                }
                return String(text || '').trim();
            };

            const customTagsForSerialize = new Set([
                'steps',
                'step',
                'tabs',
                'tab',
                'tabitem',
                'cardgroup',
                'card',
                'tip',
                'note',
                'info',
                'warning',
                'danger',
                'caution',
                'success'
            ]);

            const serializeMarkdownFromNode = (node) => {
                if (!node) return '';
                if (node.nodeType === Node.TEXT_NODE) return String(node.textContent || '');
                if (node.nodeType !== Node.ELEMENT_NODE) return '';

                const el = node;
                const tag = String(el.tagName || '').toLowerCase();
                if (tag === 'br') return '\n';
                if (tag === 'pre' || tag === 'code') return String(el.outerHTML || '');
                if (customTagsForSerialize.has(tag)) return String(el.outerHTML || '');

                if (tag === 'p' || tag === 'div') {
                    const inner = Array.from(el.childNodes || []).map(serializeMarkdownFromNode).join('');
                    return `\n${inner}\n`;
                }
                if (tag === 'span') {
                    return Array.from(el.childNodes || []).map(serializeMarkdownFromNode).join('');
                }

                return String(el.outerHTML || '');
            };

            const extractMarkdownSource = (el) => {
                if (!el) return '';
                const nodes = Array.from(el.childNodes || []);
                const serialized = nodes.map(serializeMarkdownFromNode).join('').trim();
                if (serialized) return serialized;
                return extractMarkdownCandidate(el);
            };

            const normalizeMarkdownText = (markdownText) => {
                const rawMd = String(markdownText ?? '');
                let md = rawMd.replace(/\r\n?/g, '\n');
                const lines = md.split('\n');
                while (lines.length && !String(lines[0] || '').trim()) lines.shift();
                while (lines.length && !String(lines[lines.length - 1] || '').trim()) lines.pop();
                let minIndent = Infinity;
                for (const line of lines) {
                    const l = String(line || '');
                    if (!l.trim()) continue;
                    const match = l.match(/^[\t ]+/);
                    if (!match) {
                        minIndent = 0;
                        break;
                    }
                    const indentText = match[0];
                    const indentWidth = indentText.replace(/\t/g, '    ').length;
                    if (indentWidth < minIndent) minIndent = indentWidth;
                }
                if (Number.isFinite(minIndent) && minIndent > 0) {
                    md = lines
                        .map((line) => {
                            let remaining = String(line || '');
                            let toRemove = minIndent;
                            while (toRemove > 0 && remaining) {
                                if (remaining[0] === ' ') {
                                    remaining = remaining.slice(1);
                                    toRemove -= 1;
                                    continue;
                                }
                                if (remaining[0] === '\t') {
                                    remaining = remaining.slice(1);
                                    toRemove -= 4;
                                    continue;
                                }
                                break;
                            }
                            return remaining;
                        })
                        .join('\n');
                } else {
                    md = lines.join('\n');
                }
                return String(md || '').trim();
            };

            const renderMarkdownInCustomTags = (rootEl) => {
                if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
                if (typeof marked === 'undefined' || typeof marked.parse !== 'function') return;

                const selector = [
                    'steps',
                    'step',
                    'tabs',
                    'cardgroup',
                    'card',
                    'tab',
                    'tabitem',
                    'tip',
                    'note',
                    'info',
                    'warning',
                    'danger',
                    'caution',
                    'success'
                ].join(',');

                for (let pass = 0; pass < 5; pass++) {
                    let changed = false;
                    const nodes = Array.from(rootEl.querySelectorAll(selector));
                    for (const el of nodes) {
                        if (!el || el.nodeType !== Node.ELEMENT_NODE) continue;
                        if (isInsideCodeBlock(el)) continue;
                        if (hasRenderedMarkdown(el)) continue;

                        const md = normalizeMarkdownText(extractMarkdownSource(el));
                        if (!String(md || '').trim()) continue;

                        const tpl = document.createElement('template');
                        try {
                            tpl.innerHTML = String(marked.parse(String(md), { gfm: true, breaks: true }) || '');
                        } catch (_) {
                            try {
                                tpl.innerHTML = String(marked.parse(String(md)) || '');
                            } catch (_) {
                                continue;
                            }
                        }

                        while (el.firstChild) el.removeChild(el.firstChild);
                        moveChildren(tpl.content, el);
                        changed = true;
                    }
                    if (!changed) break;
                }
            };

            const handleCardGroup = () => {
                const nodes = Array.from(root.querySelectorAll('cardgroup'));
                nodes.forEach((el) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'pet-card-group';
                    moveChildren(el, wrapper);
                    replaceWith(el, wrapper);
                });
            };

            const handleCard = () => {
                const nodes = Array.from(root.querySelectorAll('card'));
                nodes.forEach((el) => {
                    const title = toSafeText(pickAttr(el, ['title', 'name', 'header']));
                    const desc = toSafeText(pickAttr(el, ['desc', 'description', 'subtitle']), 400);
                    const icon = toSafeText(pickAttr(el, ['icon', 'emoji']), 24);
                    const hrefRaw = pickAttr(el, ['href', 'link', 'to', 'url']);
                    const href = hrefRaw ? String(hrefRaw).trim() : '';

                    const outer = href ? document.createElement('a') : document.createElement('div');
                    outer.className = 'pet-card';
                    if (href && outer.tagName === 'A') {
                        outer.setAttribute('href', href);
                        outer.setAttribute('target', '_blank');
                        outer.setAttribute('rel', 'noopener noreferrer');
                    }

                    const header = document.createElement('div');
                    header.className = 'pet-card__header';

                    if (icon) {
                        const iconEl = document.createElement('span');
                        iconEl.className = 'pet-card__icon';
                        iconEl.textContent = icon;
                        header.appendChild(iconEl);
                    }

                    if (title) {
                        const titleEl = document.createElement('span');
                        titleEl.className = 'pet-card__title';
                        titleEl.textContent = title;
                        header.appendChild(titleEl);
                    }

                    if (header.childNodes.length) outer.appendChild(header);

                    if (desc) {
                        const descEl = document.createElement('div');
                        descEl.className = 'pet-card__desc';
                        descEl.textContent = desc;
                        outer.appendChild(descEl);
                    }

                    const body = document.createElement('div');
                    body.className = 'pet-card__body';
                    moveChildren(el, body);
                    if (body.childNodes.length) outer.appendChild(body);

                    replaceWith(el, outer);
                });
            };

            const handleAdmonitions = () => {
                const tags = ['tip', 'note', 'info', 'warning', 'danger', 'caution', 'success'];
                const selector = tags.join(',');
                const nodes = Array.from(root.querySelectorAll(selector));
                nodes.forEach((el) => {
                    const tagName = String(el?.tagName || '').toLowerCase();
                    const defaultType =
                        tagName === 'tip'
                            ? 'tip'
                            : tagName === 'note'
                                ? 'note'
                                : tagName === 'warning'
                                    ? 'warning'
                                    : tagName === 'danger'
                                        ? 'danger'
                                        : tagName === 'caution'
                                            ? 'caution'
                                            : tagName === 'success'
                                                ? 'success'
                                                : 'info';

                    const rawType = toSafeText(pickAttr(el, ['type', 'kind', 'variant']), 32).toLowerCase();
                    const normalized = rawType || defaultType;
                    const type = ['info', 'tip', 'note', 'warning', 'danger', 'caution', 'success'].includes(normalized)
                        ? normalized
                        : defaultType;

                    const title = toSafeText(pickAttr(el, ['title', 'header']), 120);

                    const outer = document.createElement('div');
                    outer.className = `pet-tip pet-tip--${type}`;

                    const header = document.createElement('div');
                    header.className = 'pet-tip__header';

                    const iconEl = document.createElement('span');
                    iconEl.className = 'pet-tip__icon';
                    iconEl.textContent =
                        type === 'tip'
                            ? '💡'
                            : type === 'success'
                                ? '✅'
                                : type === 'warning' || type === 'caution'
                                    ? '⚠️'
                                    : type === 'danger'
                                        ? '⛔'
                                        : type === 'note'
                                            ? '📝'
                                            : 'ℹ️';
                    header.appendChild(iconEl);

                    if (title) {
                        const titleEl = document.createElement('div');
                        titleEl.className = 'pet-tip__title';
                        titleEl.textContent = title;
                        header.appendChild(titleEl);
                    }

                    outer.appendChild(header);

                    const content = document.createElement('div');
                    content.className = 'pet-tip__content';
                    moveChildren(el, content);
                    outer.appendChild(content);

                    replaceWith(el, outer);
                });
            };

            const handleSteps = () => {
                const nodes = Array.from(root.querySelectorAll('steps'));
                nodes.forEach((stepsEl) => {
                    const outer = document.createElement('ol');
                    outer.className = 'pet-steps';

                    const items = Array.from(stepsEl.querySelectorAll('step')).filter((stepEl) => {
                        if (typeof stepEl?.closest === 'function') return stepEl.closest('steps') === stepsEl;
                        return true;
                    });

                    const finalItems = items.length ? items : [stepsEl];
                    finalItems.forEach((itemEl, idx) => {
                        const title =
                            toSafeText(pickAttr(itemEl, ['title', 'label', 'name', 'header']), 120) ||
                            `Step ${idx + 1}`;

                        const li = document.createElement('li');
                        li.className = 'pet-step';

                        const header = document.createElement('div');
                        header.className = 'pet-step__header';

                        const indexEl = document.createElement('div');
                        indexEl.className = 'pet-step__index';
                        indexEl.textContent = String(idx + 1);
                        header.appendChild(indexEl);

                        if (title) {
                            const titleEl = document.createElement('div');
                            titleEl.className = 'pet-step__title';
                            titleEl.textContent = title;
                            header.appendChild(titleEl);
                        }

                        const content = document.createElement('div');
                        content.className = 'pet-step__content';
                        const sourceEl = itemEl === stepsEl ? stepsEl : itemEl;
                        moveChildren(sourceEl, content);

                        li.appendChild(header);
                        li.appendChild(content);
                        outer.appendChild(li);
                    });

                    replaceWith(stepsEl, outer);
                });
            };

            const handleStandaloneStep = () => {
                const nodes = Array.from(root.querySelectorAll('step'));
                nodes.forEach((stepEl, idx) => {
                    if (typeof stepEl.closest === 'function' && stepEl.closest('steps')) return;

                    const wrapper = stepEl.parentElement;
                    const wrapperTag = normalizeComponentName(wrapper);
                    const wrapperIsSimple =
                        wrapper && (wrapperTag === 'p' || wrapperTag === 'div' || wrapperTag === 'span');

                    const wrapperIsSolo = (() => {
                        if (!wrapperIsSimple) return false;
                        const meaningful = Array.from(wrapper.childNodes || []).filter((n) => {
                            if (!n) return false;
                            if (n.nodeType === Node.ELEMENT_NODE) return true;
                            if (n.nodeType === Node.TEXT_NODE) return String(n.textContent || '').trim().length > 0;
                            return false;
                        });
                        return meaningful.length === 1 && meaningful[0] === stepEl;
                    })();

                    const outer = document.createElement('ol');
                    outer.className = 'pet-steps';

                    const li = document.createElement('li');
                    li.className = 'pet-step';

                    const header = document.createElement('div');
                    header.className = 'pet-step__header';

                    const indexEl = document.createElement('div');
                    indexEl.className = 'pet-step__index';
                    indexEl.textContent = '1';
                    header.appendChild(indexEl);

                    const title =
                        toSafeText(pickAttr(stepEl, ['title', 'label', 'name', 'header']), 120) ||
                        `Step ${idx + 1}`;
                    if (title) {
                        const titleEl = document.createElement('div');
                        titleEl.className = 'pet-step__title';
                        titleEl.textContent = title;
                        header.appendChild(titleEl);
                    }

                    const content = document.createElement('div');
                    content.className = 'pet-step__content';
                    moveChildren(stepEl, content);

                    li.appendChild(header);
                    li.appendChild(content);
                    outer.appendChild(li);

                    replaceWith(wrapperIsSolo ? wrapper : stepEl, outer);
                });
            };

            const handleTabs = () => {
                const nodes = Array.from(root.querySelectorAll('tabs'));
                nodes.forEach((tabsEl) => {
                    const outer = document.createElement('div');
                    outer.className = 'pet-tabs';
                    const nav = document.createElement('div');
                    nav.className = 'pet-tabs__nav';
                    const panels = document.createElement('div');
                    panels.className = 'pet-tabs__panels';
                    const items = Array.from(tabsEl.querySelectorAll('tab, tabitem')).filter((tabEl) => {
                        if (typeof tabEl?.closest === 'function') return tabEl.closest('tabs') === tabsEl;
                        return true;
                    });

                    const finalItems = items.length ? items : [tabsEl];
                    finalItems.forEach((itemEl, idx) => {
                        const label =
                            toSafeText(pickAttr(itemEl, ['label', 'title', 'name', 'value']), 120) ||
                            `Tab ${idx + 1}`;
                        const tabEl = document.createElement('div');
                        tabEl.className = `pet-tabs__tab${idx === 0 ? ' is-active' : ''}`;
                        tabEl.textContent = label;
                        nav.appendChild(tabEl);

                        const panel = document.createElement('div');
                        panel.className = `pet-tabs__panel${idx === 0 ? ' is-active' : ''}`;
                        const sourceEl = itemEl === tabsEl ? tabsEl : itemEl;
                        moveChildren(sourceEl, panel);
                        panels.appendChild(panel);
                    });

                    outer.appendChild(nav);
                    outer.appendChild(panels);
                    replaceWith(tabsEl, outer);
                });
            };

            const handleStandaloneTab = () => {
                const nodes = Array.from(root.querySelectorAll('tab, tabitem'));
                nodes.forEach((tabEl, idx) => {
                    if (typeof tabEl.closest === 'function' && tabEl.closest('tabs')) return;

                    const wrapper = tabEl.parentElement;
                    const wrapperTag = normalizeComponentName(wrapper);
                    const wrapperIsSimple =
                        wrapper && (wrapperTag === 'p' || wrapperTag === 'div' || wrapperTag === 'span');

                    const wrapperIsSolo = (() => {
                        if (!wrapperIsSimple) return false;
                        const meaningful = Array.from(wrapper.childNodes || []).filter((n) => {
                            if (!n) return false;
                            if (n.nodeType === Node.ELEMENT_NODE) return true;
                            if (n.nodeType === Node.TEXT_NODE) return String(n.textContent || '').trim().length > 0;
                            return false;
                        });
                        return meaningful.length === 1 && meaningful[0] === tabEl;
                    })();

                    const outer = document.createElement('div');
                    outer.className = 'pet-tabs';

                    const nav = document.createElement('div');
                    nav.className = 'pet-tabs__nav';
                    const label = toSafeText(pickAttr(tabEl, ['label', 'title', 'name', 'value']), 120) || `Tab ${idx + 1}`;
                    const tabButton = document.createElement('div');
                    tabButton.className = 'pet-tabs__tab is-active';
                    tabButton.textContent = label;
                    nav.appendChild(tabButton);

                    const panels = document.createElement('div');
                    panels.className = 'pet-tabs__panels';
                    const panel = document.createElement('div');
                    panel.className = 'pet-tabs__panel is-active';
                    moveChildren(tabEl, panel);
                    panels.appendChild(panel);

                    outer.appendChild(nav);
                    outer.appendChild(panels);

                    replaceWith(wrapperIsSolo ? wrapper : tabEl, outer);
                });
            };

            renderMarkdownInCustomTags(root);
            handleCardGroup();
            handleSteps();
            handleStandaloneStep();
            handleTabs();
            handleStandaloneTab();
            handleCard();
            handleAdmonitions();
        };

        try {
            transformComponents(template.content);
        } catch (_) {}

        const allowedTags = new Set([
            'a', 'b', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'kbd', 'li',
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

                if (tag === 'input' && (name === 'type' || name === 'checked' || name === 'disabled')) {
                    if (name === 'type') {
                        const v = String(attr.value || '').toLowerCase();
                        if (v === 'checkbox') el.setAttribute('type', 'checkbox');
                        else el.removeAttribute('type');
                    } else {
                        el.setAttribute(name, '');
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

            if (tag === 'input') {
                const t = String(el.getAttribute('type') || '').toLowerCase();
                if (t !== 'checkbox') {
                    el.parentNode && el.parentNode.removeChild(el);
                    return;
                }
                el.setAttribute('type', 'checkbox');
                el.setAttribute('disabled', '');
                if (el.hasAttribute('checked')) el.setAttribute('checked', '');
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

    // 渲染 Markdown
    proto.renderMarkdown = function(markdown) {
        if (!markdown) return '';

        try {
            // 检查 marked 是否可用
            if (typeof marked !== 'undefined') {
                const renderer = new marked.Renderer();

                // 覆盖 link 渲染
                renderer.link = (href, title, text) => {
                    let resolvedHref = href;
                    let resolvedTitle = title;
                    let resolvedText = text;
                    if (href && typeof href === 'object') {
                        resolvedHref = href.href;
                        resolvedTitle = href.title;
                        resolvedText = href.text;
                    }

                    const safeHref = this._sanitizeUrl(resolvedHref);
                    const safeText = resolvedText || '';
                    if (!safeHref) return safeText;
                    const safeTitle = resolvedTitle ? ` title="${this.escapeHtml(resolvedTitle)}"` : '';
                    return `<a href="${this.escapeHtml(safeHref)}"${safeTitle} target="_blank" rel="noopener noreferrer">${safeText}</a>`;
                };

                // 覆盖 image 渲染
                renderer.image = (href, title, text) => {
                    let resolvedHref = href;
                    let resolvedTitle = title;
                    let resolvedAlt = text;
                    if (href && typeof href === 'object') {
                        resolvedHref = href.href;
                        resolvedTitle = href.title;
                        resolvedAlt = href.text;
                    }

                    const safeHref = this._sanitizeImageSrc ? this._sanitizeImageSrc(resolvedHref) : this._sanitizeUrl(resolvedHref);
                    const alt = this.escapeHtml(resolvedAlt || '');
                    if (!safeHref) return alt;
                    const safeTitle = resolvedTitle ? ` title="${this.escapeHtml(resolvedTitle)}"` : '';
                    return `<img src="${this.escapeHtml(safeHref)}" alt="${alt}" loading="lazy"${safeTitle} />`;
                };

                renderer.html = (token) => {
                    return (typeof token === 'string')
                        ? token
                        : (token && (token.raw || token.text)) || '';
                };

                // 覆盖 code 渲染 (处理 mermaid)
                renderer.code = (code, language, isEscaped) => {
                    let resolvedCode = code;
                    let resolvedLang = language;
                    if (code && typeof code === 'object') {
                        resolvedCode = code.text;
                        resolvedLang = code.lang;
                    }

                    const lang = (resolvedLang || '').trim().toLowerCase();
                    if (lang === 'mermaid') {
                        return `<div class="mermaid">${resolvedCode || ''}</div>`;
                    }
                    const escaped = this.escapeHtml(String(resolvedCode || ''));
                    const classAttr = lang ? ` class="language-${this.escapeHtml(lang)}"` : '';
                    return `<pre><code${classAttr}>${escaped}</code></pre>`;
                };

                // 配置 marked
                marked.setOptions({
                    renderer: renderer,
                    breaks: true,
                    gfm: true,
                    sanitize: false // 我们手动处理了 html
                });

                const rendered = marked.parse(markdown);
                return this._sanitizeMarkdownHtml(rendered);
            } else {
                // 如果 marked 不可用，返回转义的纯文本
                return this.escapeHtml(markdown);
            }
        } catch (error) {
            console.error('渲染 Markdown 失败:', error);
            return this.escapeHtml(markdown);
        }
    };

    proto.processTabs = function(container) {
        const root = container && container.nodeType === Node.ELEMENT_NODE ? container : null;
        if (!root || typeof root.querySelectorAll !== 'function') return;

        const tabsEls = Array.from(root.querySelectorAll('.pet-tabs'));
        tabsEls.forEach((tabsEl) => {
            if (!tabsEl || tabsEl.__petTabsBound) return;
            const nav = tabsEl.querySelector('.pet-tabs__nav');
            const panelsWrap = tabsEl.querySelector('.pet-tabs__panels');
            if (!nav || !panelsWrap) return;
            const tabButtons = Array.from(nav.querySelectorAll('.pet-tabs__tab'));
            const panels = Array.from(panelsWrap.querySelectorAll('.pet-tabs__panel'));
            if (!tabButtons.length || !panels.length) return;

            const activate = (index) => {
                const idx = Math.max(0, Math.min(index, Math.min(tabButtons.length, panels.length) - 1));
                tabButtons.forEach((btn, i) => {
                    btn.classList.toggle('is-active', i === idx);
                });
                panels.forEach((panel, i) => {
                    panel.classList.toggle('is-active', i === idx);
                });
            };

            let initial = tabButtons.findIndex((btn) => btn.classList.contains('is-active'));
            if (initial < 0) initial = 0;
            activate(initial);

            tabButtons.forEach((btn, i) => {
                btn.addEventListener('click', (e) => {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    activate(i);
                });
            });
            tabsEl.__petTabsBound = true;
        });
    };

    // 渲染 Markdown 并处理 Mermaid（完整流程）
    proto.renderMarkdownWithMermaid = async function(markdown, container) {
        // 先渲染 Markdown
        const html = this.renderMarkdown(markdown);
        
        // 如果提供了容器，处理其中的 Mermaid 代码块
        if (container) {
            // 需要等待 DOM 更新后再处理
            setTimeout(async () => {
                await this.processMermaidBlocks(container);
                if (typeof this.processTabs === 'function') this.processTabs(container);
            }, 100);
        }
        
        return html;
    };

})();
