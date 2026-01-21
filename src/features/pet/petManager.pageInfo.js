/**
 * PetManager - 页面信息模块
 * 负责获取和解析页面内容、标题、描述等信息
 */
(function() {
    'use strict';
    
    // 确保 PetManager 类已定义
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;
    
    const logger = (typeof window !== 'undefined' && window.LoggerUtils && typeof window.LoggerUtils.getLogger === 'function')
        ? window.LoggerUtils.getLogger('page')
        : console;

    /**
     * 计算两个文本的相似度（简化版）
     * @param {string} text1 - 文本1
     * @param {string} text2 - 文本2
     * @returns {number} 相似度 (0-1)
     */
    proto.calculateSimilarity = function(text1, text2) {
        if (text1 === text2) return 1.0;
        if (text1.length === 0 || text2.length === 0) return 0;

        // 使用简单的字符匹配度
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;

        if (longer.length === 0) return 1.0;

        // 计算相同字符的数量
        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (longer.includes(shorter[i])) {
                matches++;
            }
        }

        return matches / longer.length;
    };

    /**
     * 获取页面的完整正文内容
     * 尝试智能提取主要内容区域，如果失败则回退到提取所有文本
     * @returns {string} 页面正文文本
     */
    proto.getFullPageText = function() {
        try {
            // 定义需要排除的选择器
            const excludeSelectors = [
                'script', 'style', 'nav', 'header', 'footer', 'aside',
                'noscript', 'iframe', 'embed', 'svg', 'canvas',
                '.ad', '.advertisement', '.ads', '.advertisement-container',
                '.sidebar', '.menu', '.navigation', '.navbar', '.nav',
                '.header', '.footer', '.comment', '.comments', '.social-share',
                '.related-posts', '.related', '.widget', '.sidebar-widget',
                '[class*="ad"]', '[class*="banner"]', '[class*="promo"]',
                '[id*="ad"]', '[id*="banner"]', '[id*="promo"]',
                'iframe', 'embed', 'object', 'form', 'button', 'input',
                // 排除插件相关元素
                `#${(typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ids) ? PET_CONFIG.constants.ids.assistantElement : 'chat-assistant-element'}`, '[id^="pet-"]', '[class*="pet-"]',
                '[id*="pet-chat"]', '[class*="pet-chat"]',
                '[id*="pet-context"]', '[class*="pet-context"]',
                '[id*="pet-faq"]', '[class*="pet-faq"]',
                '[id*="pet-api"]', '[class*="pet-api"]',
                '[id*="pet-session"]', '[class*="pet-session"]'
            ];

            // 定义主要正文内容选择器，按优先级顺序
            const contentSelectors = [
                'main',
                'article',
                '[role="main"]',
                '.content', '.main-content', '.page-content',
                '.post-content', '.entry-content', '.article-content',
                '.post-body', '.text-content', '.article-body',
                '#content', '#main-content', '#main',
                '.article', '.blog-post', '.entry', '.post',
                '.content-area', '.content-wrapper',
                '.text-wrapper', '.text-container'
            ];

            // 尝试从主要内容区域获取
            let mainContent = null;
            for (const selector of contentSelectors) {
                mainContent = document.querySelector(selector);
                if (mainContent) {
                    logger.debug('找到主要内容区域', { selector });
                    break;
                }
            }

            // 如果找到了主要内容区域
            if (mainContent) {
                try {
                    // 克隆内容以避免修改原始DOM
                    const cloned = mainContent.cloneNode(true);

                    // 移除不需要的元素
                    excludeSelectors.forEach(sel => {
                        try {
                            const elements = cloned.querySelectorAll(sel);
                            elements.forEach(el => el.remove());
                        } catch (e) {
                            // 忽略无效的选择器
                        }
                    });

                    const textContent = cloned.textContent || cloned.innerText || '';
                    const trimmedText = textContent.trim();

                    // 如果内容足够长，返回
                    if (trimmedText.length > 100) {
                        return trimmedText;
                    }
                } catch (cloneError) {
                    // 如果克隆失败（例如元素已被移除），记录警告并继续使用其他方法
                    logger.debug('克隆主要内容区域失败，尝试其他方法', { 
                        error: String(cloneError && cloneError.message || cloneError) 
                    });
                }
            }

            // 如果没有足够的内容，获取页面中所有的文本段落
            const textElements = Array.from(document.querySelectorAll(
                'p, div, section, article, main, li, blockquote, ' +
                'h1, h2, h3, h4, h5, h6, span, pre, code, td, th, dd, dt, ' +
                'label, legend, caption, summary, details, address, time'
            ));

            const allTexts = textElements
                .map(el => (el.textContent || el.innerText || '').trim())
                .filter(text => {
                    // 进一步放宽文本长度要求：只要超过3个字符就保留
                    if (text.length < 3) return false;

                    // 只过滤明显的垃圾内容
                    const lowerText = text.toLowerCase();

                    // 只过滤最明显、最简短的无意义文本
                    if (text.length <= 5 &&
                        (lowerText === '更多' || lowerText === 'more' || lowerText === '点击')) {
                        return false;
                    }

                    return true;
                });

            // 去重并合并文本（使用更宽松的去重策略）
            const uniqueTexts = [];
            const seenTexts = new Set();

            for (const text of allTexts) {
                // 检查是否是确切的重复
                let isExactDuplicate = seenTexts.has(text);

                if (!isExactDuplicate) {
                    // 更宽松的去重：只在文本非常相似时视为重复
                    let isSimilar = false;
                    for (const seenText of seenTexts) {
                        // 只有当两个长文本几乎完全相同时才视为重复
                        if (text.length > 100 && seenText.length > 100) {
                            // 计算相似度：使用Levenshtein距离的简化版本
                            const similarity = this.calculateSimilarity(text, seenText);
                            if (similarity > 0.99) { // 99%以上相似才视为重复（几乎完全一致）
                                isSimilar = true;
                                break;
                            }
                        }
                    }

                    if (!isSimilar) {
                        seenTexts.add(text);
                        uniqueTexts.push(text);
                    }
                }
            }

            if (uniqueTexts.length > 0) {
                return uniqueTexts.join('\n\n').trim();
            }

            // 最后尝试从整个body获取
            const body = document.body;
            if (body) {
                try {
                    const clonedBody = body.cloneNode(true);

                    // 移除不需要的元素
                    excludeSelectors.forEach(sel => {
                        try {
                            const elements = clonedBody.querySelectorAll(sel);
                            elements.forEach(el => el.remove());
                        } catch (e) {
                            // 忽略无效的选择器
                        }
                    });

                    const textContent = clonedBody.textContent || clonedBody.innerText || '';
                    return textContent.trim();
                } catch (cloneError) {
                    // 如果克隆 body 失败，记录警告并返回空字符串
                    logger.debug('克隆 body 失败', { 
                        error: String(cloneError && cloneError.message || cloneError) 
                    });
                }
            }

            return '';
        } catch (error) {
            logger.error('获取页面内容时出错', { error: String(error && error.message || error) });
            return '';
        }
    };

    /**
     * 获取页面内容并转换为 Markdown
     * @returns {string} Markdown 格式的页面内容
     */
    proto.getPageContentAsMarkdown = function() {
        try {
            // 检查 Turndown 是否可用
            if (typeof TurndownService === 'undefined') {
                logger.warn('Turndown 未加载，返回纯文本内容');
                return this.getFullPageText();
            }

            // 定义需要排除的选择器
            const excludeSelectors = [
                'script', 'style', 'nav', 'header', 'footer', 'aside',
                'noscript', 'iframe', 'embed', 'svg', 'canvas',
                '.ad', '.advertisement', '.ads', '.advertisement-container',
                '.sidebar', '.menu', '.navigation', '.navbar', '.nav',
                '.header', '.footer', '.comment', '.comments', '.social-share',
                '.related-posts', '.related', '.widget', '.sidebar-widget',
                '[class*="ad"]', '[class*="banner"]', '[class*="promo"]',
                '[id*="ad"]', '[id*="banner"]', '[id*="promo"]',
                'iframe', 'embed', 'object', 'form', 'button', 'input',
                // 排除插件相关元素
                `#${(typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ids) ? PET_CONFIG.constants.ids.assistantElement : 'chat-assistant-element'}`, '[id^="pet-"]', '[class*="pet-"]',
                '[id*="pet-chat"]', '[class*="pet-chat"]',
                '[id*="pet-context"]', '[class*="pet-context"]',
                '[id*="pet-faq"]', '[class*="pet-faq"]',
                '[id*="pet-api"]', '[class*="pet-api"]',
                '[id*="pet-session"]', '[class*="pet-session"]'
            ];

            // 定义主要正文内容选择器
            const contentSelectors = [
                'main',
                'article',
                '[role="main"]',
                '.content', '.main-content', '.page-content',
                '.post-content', '.entry-content', '.article-content',
                '.post-body', '.text-content', '.article-body',
                '#content', '#main-content', '#main',
                '.article', '.blog-post', '.entry', '.post',
                '.content-area', '.content-wrapper',
                '.text-wrapper', '.text-container'
            ];

            // 尝试从主要内容区域获取
            let mainContent = null;
            for (const selector of contentSelectors) {
                try {
                    mainContent = document.querySelector(selector);
                    if (mainContent) break;
                } catch (e) {
                    // 忽略选择器错误
                    continue;
                }
            }

            // 如果没有找到主要内容区域，使用body
            if (!mainContent) {
                mainContent = document.body;
            }

            // 检查 mainContent 是否为 null（在某些情况下 document.body 可能为 null）
            if (!mainContent) {
                logger.warn('无法找到有效的内容元素（mainContent 和 document.body 均为 null），返回空字符串');
                return '';
            }

            // 克隆内容
            let cloned;
            try {
                cloned = mainContent.cloneNode(true);
            } catch (cloneError) {
                logger.warn('克隆内容失败，返回纯文本', { 
                    error: String(cloneError && cloneError.message || cloneError) 
                });
                // 如果克隆失败，尝试直接获取文本内容
                const textContent = mainContent.textContent || mainContent.innerText || '';
                return textContent.trim();
            }

            // 移除不需要的元素
            excludeSelectors.forEach(sel => {
                try {
                    const elements = cloned.querySelectorAll(sel);
                    elements.forEach(el => el.remove());
                } catch (e) {}
            });

            // 检查克隆的元素是否有效
            if (!cloned || !cloned.nodeType) {
                logger.warn('克隆的内容无效，返回纯文本');
                return this.getFullPageText();
            }

            // 使用 Turndown 转换
            let markdown;
            try {
                const turndownService = new TurndownService({
                    headingStyle: 'atx',
                    bulletListMarker: '-',
                    codeBlockStyle: 'fenced',
                    fence: '```',
                    emDelimiter: '*',
                    strongDelimiter: '**',
                    linkStyle: 'inlined',
                    linkReferenceStyle: 'collapsed'
                });

                markdown = turndownService.turndown(cloned);
            } catch (turndownError) {
                // Turndown 转换失败，记录警告并返回纯文本
                logger.warn('Turndown 转换失败，使用纯文本', { 
                    error: String(turndownError && turndownError.message || turndownError) 
                });
                const textContent = cloned.textContent || cloned.innerText || '';
                return textContent.trim();
            }

            // 如果 Markdown 内容太短或为空，返回纯文本
            if (!markdown || markdown.trim().length < 100) {
                const textContent = cloned.textContent || cloned.innerText || '';
                return textContent.trim();
            }

            return markdown.trim();
        } catch (error) {
            // 捕获所有其他错误，静默处理并返回纯文本
            logger.warn('转换为 Markdown 时出错，使用纯文本', { 
                error: String(error && error.message || error) 
            });
            // 出错时返回纯文本
            try {
                return this.getFullPageText();
            } catch (fallbackError) {
                // 如果连获取纯文本都失败，返回空字符串
                logger.warn('获取纯文本也失败', { 
                    error: String(fallbackError && fallbackError.message || fallbackError) 
                });
                return '';
            }
        }
    };

    /**
     * 统一获取页面信息的方法：标题、描述、URL、内容
     * @returns {Object} 页面信息对象
     */
    proto.getPageInfo = function() {
        const pageTitle = document.title || '未命名页面';
        const pageUrl = window.location.href;

        // 获取页面描述（meta description）
        const metaDescription = document.querySelector('meta[name="description"]');
        const pageDescription = metaDescription ? metaDescription.content.trim() : '';

        // 获取页面内容
        const pageContent = this.getPageContentAsMarkdown();

        return {
            title: pageTitle.trim(),
            url: pageUrl,
            description: pageDescription,
            content: pageContent
        };
    };

})();

