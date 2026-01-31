/**
 * Chat Helper Utilities
 * 聊天相关的工具函数
 */

/**
 * 生成消息ID
 */
export function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化消息时间
 */
export function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // 今天
    if (messageDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // 昨天
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.getTime() === yesterday.getTime()) {
        return `昨天 ${date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })}`;
    }

    // 本周内
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (messageDate.getTime() > weekAgo.getTime()) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${weekdays[date.getDay()]} ${date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })}`;
    }

    // 更早
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 分组消息（按时间）
 */
export function groupMessagesByTime(messages) {
    if (!messages || !Array.isArray(messages)) {
        return [];
    }

    const groups = [];
    let currentGroup = null;
    const timeThreshold = 5 * 60 * 1000; // 5分钟

    messages.forEach(message => {
        const messageTime = new Date(message.timestamp);
        
        if (!currentGroup || 
            messageTime - new Date(currentGroup.timestamp) > timeThreshold ||
            message.role !== currentGroup.role) {
            
            // 创建新组
            currentGroup = {
                id: `group_${message.id}`,
                role: message.role,
                timestamp: message.timestamp,
                messages: [message]
            };
            groups.push(currentGroup);
        } else {
            // 添加到当前组
            currentGroup.messages.push(message);
        }
    });

    return groups;
}

/**
 * 检测消息类型
 */
export function detectMessageType(content) {
    if (!content || typeof content !== 'string') {
        return 'text';
    }

    const trimmedContent = content.trim();

    // 代码块
    if (trimmedContent.includes('```')) {
        return 'code';
    }

    // Mermaid图表
    if (trimmedContent.includes('```mermaid') || 
        (trimmedContent.includes('graph') && trimmedContent.includes('->'))) {
        return 'mermaid';
    }

    // URL
    if (isValidUrl(trimmedContent)) {
        return 'url';
    }

    // 图片
    if (isImageUrl(trimmedContent)) {
        return 'image';
    }

    // 表情符号
    if (containsOnlyEmojis(trimmedContent)) {
        return 'emoji';
    }

    // 长文本
    if (trimmedContent.length > 500) {
        return 'longtext';
    }

    return 'text';
}

/**
 * 验证URL
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 检查是否为图片URL
 */
function isImageUrl(url) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowercaseUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowercaseUrl.endsWith(ext));
}

/**
 * 检查是否只包含表情符号
 */
function containsOnlyEmojis(text) {
    const emojiRegex = /^(?:[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|\s)+$/u;
    return emojiRegex.test(text);
}

/**
 * 提取代码块
 */
export function extractCodeBlocks(content) {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        blocks.push({
            language: match[1] || 'text',
            code: match[2].trim(),
            fullMatch: match[0]
        });
    }

    return blocks;
}

/**
 * 高亮代码
 */
export function highlightCode(code, language = 'text') {
    if (typeof hljs !== 'undefined' && hljs.getLanguage(language)) {
        try {
            return hljs.highlight(code, { language }).value;
        } catch (err) {
            console.warn('代码高亮失败:', err);
        }
    }

    // 简单的语法高亮
    return simpleHighlight(code, language);
}

/**
 * 简单的高亮实现
 */
function simpleHighlight(code, language) {
    let highlighted = code;

    if (language === 'javascript' || language === 'js') {
        // 关键字
        highlighted = highlighted.replace(
            /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|super|class|extends|import|export|default|async|await)\b/g,
            '<span class="keyword">$1</span>'
        );

        // 字符串
        highlighted = highlighted.replace(
            /(['"`])([^'"`]*?)\1/g,
            '<span class="string">$1$2$1</span>'
        );

        // 注释
        highlighted = highlighted.replace(
            /(\/\/.*$)/gm,
            '<span class="comment">$1</span>'
        );
    }

    return highlighted;
}

/**
 * 创建消息摘要
 */
export function createMessageSummary(message, maxLength = 100) {
    if (!message || !message.content) {
        return '';
    }

    const content = message.content.trim();
    
    if (content.length <= maxLength) {
        return content;
    }

    // 移除代码块
    let summary = content.replace(/```[\s\S]*?```/g, '[代码]');
    
    // 移除HTML标签
    summary = summary.replace(/<[^>]*>/g, '');
    
    // 截断并添加省略号
    if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
}

/**
 * 检测是否为系统消息
 */
export function isSystemMessage(message) {
    return message.role === 'system' || message.type === 'system';
}

/**
 * 检测是否为错误消息
 */
export function isErrorMessage(message) {
    return message.status === 'error' || message.type === 'error';
}

/**
 * 获取消息发送者信息
 */
export function getMessageSender(message, roleConfig) {
    switch (message.role) {
        case 'user':
            return {
                name: '我',
                avatar: null,
                color: '#007bff'
            };
        
        case 'assistant':
            return {
                name: roleConfig.name,
                avatar: roleConfig.icon,
                color: roleConfig.color || '#28a745'
            };
        
        case 'system':
            return {
                name: '系统',
                avatar: null,
                color: '#6c757d'
            };
        
        default:
            return {
                name: '未知',
                avatar: null,
                color: '#6c757d'
            };
    }
}

/**
 * 消息搜索和过滤
 */
export function searchMessages(messages, query) {
    if (!query || !messages) {
        return messages;
    }

    const lowerQuery = query.toLowerCase();
    
    return messages.filter(message => {
        if (!message.content) return false;
        
        const content = message.content.toLowerCase();
        return content.includes(lowerQuery);
    });
}

/**
 * 按角色过滤消息
 */
export function filterMessagesByRole(messages, roles) {
    if (!roles || roles.length === 0) {
        return messages;
    }

    return messages.filter(message => 
        roles.includes(message.role)
    );
}

/**
 * 按时间范围过滤消息
 */
export function filterMessagesByTimeRange(messages, startTime, endTime) {
    if (!startTime && !endTime) {
        return messages;
    }

    return messages.filter(message => {
        const timestamp = message.timestamp;
        
        if (startTime && timestamp < startTime) return false;
        if (endTime && timestamp > endTime) return false;
        
        return true;
    });
}

/**
 * 计算消息统计信息
 */
export function calculateMessageStats(messages) {
    if (!messages || messages.length === 0) {
        return {
            total: 0,
            byRole: {},
            byType: {},
            averageLength: 0,
            timeRange: null
        };
    }

    const stats = {
        total: messages.length,
        byRole: {},
        byType: {},
        totalLength: 0,
        timeRange: {
            start: messages[0].timestamp,
            end: messages[messages.length - 1].timestamp
        }
    };

    messages.forEach(message => {
        // 按角色统计
        stats.byRole[message.role] = (stats.byRole[message.role] || 0) + 1;
        
        // 按类型统计
        const type = detectMessageType(message.content);
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        
        // 总长度
        if (message.content) {
            stats.totalLength += message.content.length;
        }
    });

    stats.averageLength = stats.total / stats.totalLength;

    return stats;
}