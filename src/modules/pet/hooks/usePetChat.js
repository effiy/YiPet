/**
 * Pet Chat Hook
 * 用于管理宠物聊天功能的自定义Hook
 */

import { petAIService } from '../services/index.js';
import { petStateManager } from '../core/index.js';
import { usePetState } from './usePetState.js';

/**
 * 使用聊天功能
 */
export function usePetChat() {
    const [isChatOpen] = usePetState('isChatOpen');
    const [currentSessionId] = usePetState('currentSessionId');
    const [sessions, setSessions] = usePetState('sessions');
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [typingUsers, setTypingUsers] = React.useState(new Set());

    /**
     * 发送消息
     */
    const sendMessage = React.useCallback(async (message, options = {}) => {
        if (!message.trim()) {
            throw new Error('消息不能为空');
        }

        if (isProcessing) {
            throw new Error('正在处理其他消息，请稍后再试');
        }

        if (!currentSessionId) {
            throw new Error('没有活动的会话');
        }

        setIsProcessing(true);

        try {
            // 添加用户消息到会话
            const userMessage = {
                id: generateMessageId(),
                role: 'user',
                content: message,
                timestamp: Date.now(),
                status: 'sent'
            };

            addMessageToSession(currentSessionId, userMessage);

            // 设置AI正在输入状态
            setTypingUsers(prev => new Set([...prev, 'ai']));

            // 发送消息到AI
            const aiResponse = await petAIService.sendMessage(message, {
                role: petStateManager.getState('role'),
                ...options
            });

            // 添加AI响应到会话
            const aiMessage = {
                id: generateMessageId(),
                role: 'assistant',
                content: aiResponse.content,
                timestamp: Date.now(),
                status: 'sent',
                model: aiResponse.model,
                usage: aiResponse.usage
            };

            addMessageToSession(currentSessionId, aiMessage);

            // 移除AI输入状态
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete('ai');
                return newSet;
            });

            return {
                userMessage,
                aiMessage,
                response: aiResponse
            };

        } catch (error) {
            console.error('[usePetChat] 发送消息失败:', error);
            
            // 添加错误消息
            const errorMessage = {
                id: generateMessageId(),
                role: 'system',
                content: `消息发送失败: ${error.message}`,
                timestamp: Date.now(),
                status: 'error',
                error: error.message
            };

            addMessageToSession(currentSessionId, errorMessage);
            throw error;

        } finally {
            setIsProcessing(false);
            setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete('ai');
                return newSet;
            });
        }
    }, [currentSessionId, isProcessing]);

    /**
     * 添加消息到会话
     */
    const addMessageToSession = React.useCallback((sessionId, message) => {
        setSessions(prevSessions => {
            const updatedSessions = { ...prevSessions };
            const session = updatedSessions[sessionId];
            
            if (session) {
                session.messages = [...(session.messages || []), message];
                session.lastMessageTime = message.timestamp;
                session.lastMessageContent = message.content;
                session.updatedAt = Date.now();
            }
            
            return updatedSessions;
        });
    }, [setSessions]);

    /**
     * 删除消息
     */
    const deleteMessage = React.useCallback((sessionId, messageId) => {
        setSessions(prevSessions => {
            const updatedSessions = { ...prevSessions };
            const session = updatedSessions[sessionId];
            
            if (session && session.messages) {
                session.messages = session.messages.filter(msg => msg.id !== messageId);
                session.updatedAt = Date.now();
            }
            
            return updatedSessions;
        });
    }, [setSessions]);

    /**
     * 编辑消息
     */
    const editMessage = React.useCallback((sessionId, messageId, newContent) => {
        setSessions(prevSessions => {
            const updatedSessions = { ...prevSessions };
            const session = updatedSessions[sessionId];
            
            if (session && session.messages) {
                const messageIndex = session.messages.findIndex(msg => msg.id === messageId);
                if (messageIndex !== -1) {
                    session.messages[messageIndex] = {
                        ...session.messages[messageIndex],
                        content: newContent,
                        edited: true,
                        editedAt: Date.now()
                    };
                    session.updatedAt = Date.now();
                }
            }
            
            return updatedSessions;
        });
    }, [setSessions]);

    /**
     * 重新发送消息
     */
    const resendMessage = React.useCallback(async (sessionId, messageId) => {
        const session = sessions[sessionId];
        if (!session || !session.messages) {
            throw new Error('会话不存在');
        }

        const message = session.messages.find(msg => msg.id === messageId);
        if (!message || message.role !== 'user') {
            throw new Error('只能重新发送用户消息');
        }

        // 删除原消息及之后的所有消息
        const messageIndex = session.messages.indexOf(message);
        session.messages = session.messages.slice(0, messageIndex);

        // 重新发送
        return await sendMessage(message.content);
    }, [sessions, sendMessage]);

    /**
     * 获取当前会话的消息
     */
    const getCurrentMessages = React.useCallback(() => {
        if (!currentSessionId || !sessions[currentSessionId]) {
            return [];
        }
        return sessions[currentSessionId].messages || [];
    }, [currentSessionId, sessions]);

    /**
     * 设置输入状态
     */
    const setTyping = React.useCallback((userId, isTyping) => {
        setTypingUsers(prev => {
            const newSet = new Set(prev);
            if (isTyping) {
                newSet.add(userId);
            } else {
                newSet.delete(userId);
            }
            return newSet;
        });
    }, []);

    /**
     * 打开/关闭聊天窗口
     */
    const toggleChat = React.useCallback(() => {
        petStateManager.setState('isChatOpen', !isChatOpen);
    }, [isChatOpen]);

    /**
     * 清除当前会话的消息
     */
    const clearCurrentMessages = React.useCallback(() => {
        if (!currentSessionId) return;

        setSessions(prevSessions => {
            const updatedSessions = { ...prevSessions };
            const session = updatedSessions[currentSessionId];
            
            if (session) {
                session.messages = [];
                session.lastMessageTime = null;
                session.lastMessageContent = null;
                session.updatedAt = Date.now();
            }
            
            return updatedSessions;
        });
    }, [currentSessionId, setSessions]);

    /**
     * 生成消息ID
     */
    function generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    return {
        // 状态
        isChatOpen,
        isProcessing,
        typingUsers: Array.from(typingUsers),
        currentMessages: getCurrentMessages(),
        
        // 方法
        sendMessage,
        deleteMessage,
        editMessage,
        resendMessage,
        setTyping,
        toggleChat,
        clearCurrentMessages
    };
}

/**
 * 使用聊天输入
 */
export function usePetChatInput() {
    const [inputValue, setInputValue] = React.useState('');
    const [isTyping, setIsTyping] = React.useState(false);
    const typingTimeoutRef = React.useRef(null);

    /**
     * 处理输入变化
     */
    const handleInputChange = React.useCallback((value) => {
        setInputValue(value);
        
        // 设置输入状态
        if (!isTyping && value.trim()) {
            setIsTyping(true);
            window.petEventManager.emit('chat:typing', { isTyping: true });
        }
        
        // 清除之前的定时器
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        
        // 设置新的定时器
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            window.petEventManager.emit('chat:typing', { isTyping: false });
        }, 1000);
    }, [isTyping]);

    /**
     * 清除输入
     */
    const clearInput = React.useCallback(() => {
        setInputValue('');
        setIsTyping(false);
        
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        
        window.petEventManager.emit('chat:typing', { isTyping: false });
    }, []);

    /**
     * 清理
     */
    React.useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    return {
        inputValue,
        isTyping,
        handleInputChange,
        clearInput
    };
}

/**
 * 使用聊天滚动
 */
export function usePetChatScroll() {
    const messagesEndRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const [isAutoScroll, setIsAutoScroll] = React.useState(true);

    /**
     * 滚动到底部
     */
    const scrollToBottom = React.useCallback((smooth = true) => {
        if (messagesEndRef.current && containerRef.current) {
            const container = containerRef.current;
            const endElement = messagesEndRef.current;
            
            if (smooth) {
                endElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
            } else {
                container.scrollTop = container.scrollHeight;
            }
        }
    }, []);

    /**
     * 处理滚动事件
     */
    const handleScroll = React.useCallback(() => {
        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const threshold = 100; // 距离底部100px以内认为是自动滚动
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        
        setIsAutoScroll(isNearBottom);
    }, []);

    /**
     * 设置容器引用
     */
    const setContainerRef = React.useCallback((ref) => {
        containerRef.current = ref;
        if (ref) {
            ref.addEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    /**
     * 清理事件监听
     */
    React.useEffect(() => {
        return () => {
            if (containerRef.current) {
                containerRef.current.removeEventListener('scroll', handleScroll);
            }
        };
    }, [handleScroll]);

    return {
        messagesEndRef,
        containerRef,
        isAutoScroll,
        scrollToBottom,
        setContainerRef
    };
}