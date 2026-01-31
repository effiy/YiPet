/**
 * Pet Helper Utilities
 * 宠物相关的工具函数
 */

/**
 * 生成宠物ID
 */
export function generatePetId() {
    return `pet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成会话ID
 */
export function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成消息ID
 */
export function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) {
        return '刚刚';
    }

    // 小于1小时
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}分钟前`;
    }

    // 小于24小时
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}小时前`;
    }

    // 小于7天
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}天前`;
    }

    // 超过7天，显示具体日期
    return date.toLocaleDateString();
}

/**
 * 获取角色配置
 */
export function getRoleConfig(role) {
    return PET_CONFIG.roles[role] || PET_CONFIG.roles['教师'];
}

/**
 * 获取宠物颜色
 */
export function getPetColor(colorIndex) {
    const colors = PET_CONFIG.pet.colors;
    if (colorIndex >= 0 && colorIndex < colors.length) {
        return colors[colorIndex];
    }
    return colors[0];
}

/**
 * 计算两点之间的距离
 */
export function calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 检查位置是否在边界内
 */
export function isPositionInBounds(position, bounds) {
    const { x, y } = position;
    const { minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity } = bounds;
    
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * 约束位置在边界内
 */
export function constrainPosition(position, bounds) {
    const { x, y } = position;
    const { minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity } = bounds;
    
    return {
        x: Math.max(minX, Math.min(x, maxX)),
        y: Math.max(minY, Math.min(y, maxY))
    };
}

/**
 * 检测碰撞
 */
export function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

/**
 * 生成随机位置
 */
export function generateRandomPosition(bounds) {
    const { minX = 0, maxX = window.innerWidth, minY = 0, maxY = window.innerHeight } = bounds;
    
    return {
        x: Math.random() * (maxX - minX) + minX,
        y: Math.random() * (maxY - minY) + minY
    };
}

/**
 * 平滑移动到目标位置
 */
export function smoothMoveTo(element, targetPosition, options = {}) {
    const {
        duration = 500,
        easing = 'ease-out',
        onComplete = null
    } = options;

    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
        const startPosition = {
            x: parseInt(element.style.left) || 0,
            y: parseInt(element.style.top) || 0
        };

        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 应用缓动函数
            const easedProgress = applyEasing(progress, easing);

            const currentPosition = {
                x: startPosition.x + (targetPosition.x - startPosition.x) * easedProgress,
                y: startPosition.y + (targetPosition.y - startPosition.y) * easedProgress
            };

            element.style.left = `${currentPosition.x}px`;
            element.style.top = `${currentPosition.y}px`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
                resolve();
            }
        }

        requestAnimationFrame(animate);
    });
}

/**
 * 应用缓动函数
 */
function applyEasing(progress, easing) {
    switch (easing) {
        case 'linear':
            return progress;
        case 'ease-in':
            return progress * progress;
        case 'ease-out':
            return 1 - Math.pow(1 - progress, 2);
        case 'ease-in-out':
            return progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        default:
            return progress;
    }
}

/**
 * 解析表情符号
 */
export function parseEmojis(text) {
    const emojiMap = {
        ':)': '😊',
        ':D': '😃',
        ':(': '😢',
        ':P': '😛',
        ':o': '😮',
        ':|': '😐',
        ';)': '😉',
        ':*': '😘',
        '<3': '❤️',
        '</3': '💔'
    };

    let parsedText = text;
    for (const [code, emoji] of Object.entries(emojiMap)) {
        parsedText = parsedText.replace(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), emoji);
    }

    return parsedText;
}

/**
 * 验证消息内容
 */
export function validateMessage(message) {
    const errors = [];

    if (!message || typeof message !== 'string') {
        errors.push('消息必须是字符串');
        return { isValid: false, errors };
    }

    if (message.trim().length === 0) {
        errors.push('消息不能为空');
    }

    if (message.length > 1000) {
        errors.push('消息长度不能超过1000字符');
    }

    // 检查敏感词
    const sensitiveWords = ['spam', 'advertisement']; // 示例敏感词
    for (const word of sensitiveWords) {
        if (message.toLowerCase().includes(word)) {
            errors.push(`消息包含敏感词: ${word}`);
            break;
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * 清理消息内容
 */
export function sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
        return '';
    }

    return message
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
        .replace(/<[^>]*>/g, '') // 移除HTML标签
        .replace(/javascript:/gi, '') // 移除javascript协议
        .substring(0, 1000); // 限制长度
}

/**
 * 生成消息摘要
 */
export function generateMessageSummary(message, maxLength = 50) {
    if (!message) return '';

    const cleanedMessage = message.replace(/\s+/g, ' ').trim();
    
    if (cleanedMessage.length <= maxLength) {
        return cleanedMessage;
    }

    return cleanedMessage.substring(0, maxLength - 3) + '...';
}

/**
 * 计算文本相似度（简单版本）
 */
export function calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
}

/**
 * 检测是否为问候语
 */
export function isGreeting(message) {
    const greetings = [
        '你好', '您好', 'hi', 'hello', 'hey',
        '早上好', '下午好', '晚上好', '晚安'
    ];

    const lowerMessage = message.toLowerCase().trim();
    return greetings.some(greeting => lowerMessage.includes(greeting.toLowerCase()));
}

/**
 * 生成默认响应
 */
export function generateDefaultResponse(message, role = '教师') {
    const roleConfig = getRoleConfig(role);
    
    if (isGreeting(message)) {
        return `${roleConfig.greeting}，我是您的${role}伴侣，有什么可以帮助您的吗？😊`;
    }

    if (message.length < 2) {
        return `${roleConfig.name}收到了您的消息，可以再详细说说吗？`;
    }

    return `${roleConfig.name}正在思考如何更好地回答您的问题...`;
}