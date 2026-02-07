(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 清理文件名（移除非法字符）
    proto._sanitizeFileName = function(fileName) {
        // 移除或替换Windows/Linux文件名中的非法字符
        return String(fileName || '').replace(/\s+/g, '_').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    };

    // 生成context.md内容
    proto._generateContextMd = function(session) {
        let content = `# ${session.title || '未命名会话'}\n\n`;
        content += `**创建时间**: ${new Date(session.createdAt || Date.now()).toLocaleString('zh-CN')}\n\n`;
        content += `**更新时间**: ${new Date(session.updatedAt || session.createdAt || Date.now()).toLocaleString('zh-CN')}\n\n`;
        content += `**URL**: ${session.url || ''}\n\n`;

        if (session.pageDescription) {
            content += `**页面描述**: ${session.pageDescription}\n\n`;
        }

        if (session.tags && session.tags.length > 0) {
            content += `**标签**: ${session.tags.join(', ')}\n\n`;
        }

        if (session.pageContent) {
            content += `## 页面内容\n\n${session.pageContent}\n\n`;
        }

        return content;
    };

    // 生成chat.md内容
    proto._generateChatMd = function(session) {
        let content = `# 聊天记录\n\n`;

        if (!session.messages || session.messages.length === 0) {
            content += `暂无聊天记录。\n`;
            return content;
        }

        session.messages.forEach((message, index) => {
            const role = message.role || 'unknown';
            const text = message.content || message.text || '';
            const timestamp = message.timestamp || message.createdAt || '';

            content += `## 消息 ${index + 1}\n\n`;
            content += `**角色**: ${role}\n\n`;
            if (timestamp) {
                content += `**时间**: ${new Date(timestamp).toLocaleString('zh-CN')}\n\n`;
            }
            content += `**内容**:\n\n${text}\n\n`;
            content += `---\n\n`;
        });

        return content;
    };

    // 解析markdown内容，提取页面信息和聊天记录
    proto._parseMarkdownContent = function(markdownContent) {
        const ensureMdSuffix = (str) => {
            if (!str || !String(str).trim()) return '';
            const s = String(str).trim();
            return s.endsWith('.md') ? s : `${s}.md`;
        };

        const result = {
            title: '',
            url: '',
            pageDescription: '',
            pageContent: '',
            tags: [],
            messages: [],
            createdAt: null,
            updatedAt: null
        };

        if (!markdownContent || typeof markdownContent !== 'string') {
            return result;
        }

        // 分割内容：页面信息和聊天记录
        const chatRecordIndex = markdownContent.indexOf('# 聊天记录');
        const pageInfoContent = chatRecordIndex >= 0
            ? markdownContent.substring(0, chatRecordIndex).trim()
            : markdownContent.trim();
        const chatContent = chatRecordIndex >= 0
            ? markdownContent.substring(chatRecordIndex).trim()
            : '';

        // 解析页面信息部分
        // 提取标题（第一行的 # 标题）
        const titleMatch = pageInfoContent.match(/^#\s+(.+?)$/m);
        if (titleMatch) {
            result.title = ensureMdSuffix(titleMatch[1].trim().replace(/\s+/g, '_'));
        }

        // 提取创建时间
        const createdAtMatch = pageInfoContent.match(/\*\*创建时间\*\*:\s*(.+?)$/m);
        if (createdAtMatch) {
            try {
                result.createdAt = new Date(createdAtMatch[1].trim()).getTime();
            } catch (e) {
                // 忽略解析错误
            }
        }

        // 提取更新时间
        const updatedAtMatch = pageInfoContent.match(/\*\*更新时间\*\*:\s*(.+?)$/m);
        if (updatedAtMatch) {
            try {
                result.updatedAt = new Date(updatedAtMatch[1].trim()).getTime();
            } catch (e) {
                // 忽略解析错误
            }
        }

        // 提取URL
        const urlMatch = pageInfoContent.match(/\*\*URL\*\*:\s*(.+?)$/m);
        if (urlMatch) {
            result.url = urlMatch[1].trim();
        }

        // 提取页面描述
        const descMatch = pageInfoContent.match(/\*\*页面描述\*\*:\s*(.+?)$/m);
        if (descMatch) {
            result.pageDescription = descMatch[1].trim();
        }

        // 提取标签
        const tagsMatch = pageInfoContent.match(/\*\*标签\*\*:\s*(.+?)$/m);
        if (tagsMatch) {
            result.tags = tagsMatch[1].split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }

        // 提取页面内容（## 页面内容 之后的内容）
        const pageContentMatch = pageInfoContent.match(/##\s+页面内容\s*\n\n(.+?)(?:\n\n#|$)/s);
        if (pageContentMatch) {
            result.pageContent = pageContentMatch[1].trim();
        } else {
            // 如果没有明确的页面内容标记，尝试提取所有非元信息的内容
            const lines = pageInfoContent.split('\n');
            let inPageContent = false;
            let pageContentLines = [];
            for (const line of lines) {
                if (line.startsWith('## 页面内容')) {
                    inPageContent = true;
                    continue;
                }
                if (inPageContent && !line.match(/^\*\*/)) {
                    pageContentLines.push(line);
                }
            }
            if (pageContentLines.length > 0) {
                result.pageContent = pageContentLines.join('\n').trim();
            }
        }

        // 解析聊天记录部分
        if (chatContent) {
            // 使用正则表达式匹配每个消息
            const messagePattern = /##\s+消息\s+\d+\s*\n\n\*\*角色\*\*:\s*(.+?)\s*\n\n(?:\*\*时间\*\*:\s*(.+?)\s*\n\n)?\*\*内容\*\*:\s*\n\n(.+?)\n\n---/gs;
            let messageMatch;
            while ((messageMatch = messagePattern.exec(chatContent)) !== null) {
                const role = messageMatch[1].trim();
                const timestamp = messageMatch[2] ? new Date(messageMatch[2].trim()).getTime() : Date.now();
                const content = messageMatch[3].trim();

                // 将角色映射为type（user或pet）
                const type = role.toLowerCase().includes('user') || role.toLowerCase().includes('用户') ? 'user' : 'pet';

                result.messages.push({
                    type: type,
                    role: role,
                    content: content,
                    timestamp: timestamp
                });
            }
        }

        return result;
    };
})();
