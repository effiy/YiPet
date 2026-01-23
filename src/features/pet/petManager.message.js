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

        // 如果索引匹配失败，回退到内容匹配（兼容旧逻辑）
        const isUserMessage = messageDiv.querySelector('[data-message-type="user-bubble"]');
        const messageBubble = isUserMessage 
            ? messageDiv.querySelector('[data-message-type="user-bubble"]')
            : messageDiv.querySelector('[data-message-type="pet-bubble"]');
        
        if (!messageBubble) {
            return null;
        }

        // 获取消息文本内容
        const messageContent = messageBubble.getAttribute('data-original-text') || 
                              messageBubble.innerText || 
                              messageBubble.textContent || '';
        
        // 获取消息类型
        const messageType = isUserMessage ? 'user' : 'pet';

        // 在会话消息列表中查找匹配的消息对象
        // 优先匹配内容和类型，如果有多条匹配，选择最近的一条
        for (let i = session.messages.length - 1; i >= 0; i--) {
            const msg = session.messages[i];
            if (msg.type === messageType) {
                // 比较消息内容（去除首尾空白）
                const msgContent = (msg.content || '').trim();
                const divContent = messageContent.trim();
                
                // 如果内容匹配，返回该消息对象
                if (msgContent === divContent || 
                    (msgContent && divContent && msgContent.includes(divContent)) ||
                    (divContent && msgContent && divContent.includes(msgContent))) {
                    return { message: msg, index: i };
                }
            }
        }

        // 如果找不到完全匹配的，返回最后一条同类型的消息
        for (let i = session.messages.length - 1; i >= 0; i--) {
            const msg = session.messages[i];
            if (msg.type === messageType) {
                return { message: msg, index: i };
            }
        }

        return null;
    };

    // HTML 转义辅助函数（使用 DomHelper，保留兼容性）
    proto.escapeHtml = function(text) {
        if (typeof DomHelper !== 'undefined' && typeof DomHelper.escapeHtml === 'function') {
            return DomHelper.escapeHtml(text);
        }
        // 降级实现（使用 replace 方法）
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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

    // 渲染 Markdown
    proto.renderMarkdown = function(markdown) {
        if (!markdown) return '';

        try {
            // 检查 marked 是否可用
            if (typeof marked !== 'undefined') {
                const renderer = new marked.Renderer();

                // 覆盖 link 渲染
                renderer.link = (href, title, text) => {
                    const safeHref = this._sanitizeUrl(href);
                    const safeText = text || '';
                    if (!safeHref) return safeText;
                    const safeTitle = title ? ` title="${this.escapeHtml(title)}"` : '';
                    return `<a href="${this.escapeHtml(safeHref)}"${safeTitle} target="_blank" rel="noopener noreferrer">${safeText}</a>`;
                };

                // 覆盖 image 渲染
                renderer.image = (href, title, text) => {
                    const safeHref = this._sanitizeUrl(href);
                    const alt = this.escapeHtml(text || '');
                    if (!safeHref) return alt;
                    const safeTitle = title ? ` title="${this.escapeHtml(title)}"` : '';
                    return `<img src="${this.escapeHtml(safeHref)}" alt="${alt}" loading="lazy"${safeTitle} />`;
                };

                // 覆盖 html 渲染 (转义 HTML)
                renderer.html = (html) => {
                    return this.escapeHtml(html);
                };

                // 覆盖 code 渲染 (处理 mermaid)
                renderer.code = (code, language, isEscaped) => {
                    const lang = (language || '').trim().toLowerCase();
                    if (lang === 'mermaid') {
                        return `<div class="mermaid">${code}</div>`;
                    }
                    return marked.Renderer.prototype.code.call(renderer, code, language, isEscaped);
                };

                // 配置 marked
                marked.setOptions({
                    renderer: renderer,
                    breaks: true,
                    gfm: true,
                    sanitize: false // 我们手动处理了 html
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
    proto.renderMarkdownWithMermaid = async function(markdown, container) {
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

})();
