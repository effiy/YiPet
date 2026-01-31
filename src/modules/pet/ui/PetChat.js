/**
 * Pet Chat Component
 * 宠物聊天组件
 */

import React from 'react';
import { usePetChat, usePetChatInput, usePetChatScroll } from '../hooks/index.js';
import { formatMessageTime, detectMessageType, groupMessagesByTime } from '../utils/index.js';

/**
 * 聊天消息组件
 */
export function ChatMessage({ message, roleConfig }) {
    const messageType = detectMessageType(message.content);
    const isUser = message.role === 'user';
    
    return (
        <div className={`chat-message ${isUser ? 'user-message' : 'assistant-message'} message-type-${messageType}`}>
            <div className="message-avatar">
                {isUser ? '👤' : roleConfig.icon}
            </div>
            <div className="message-content">
                <div className="message-header">
                    <span className="message-sender">
                        {isUser ? '我' : roleConfig.name}
                    </span>
                    <span className="message-time">
                        {formatMessageTime(message.timestamp)}
                    </span>
                </div>
                <div className="message-body">
                    {renderMessageContent(message.content, messageType)}
                </div>
                {message.status === 'error' && (
                    <div className="message-error">
                        <span className="error-icon">⚠️</span>
                        <span className="error-text">发送失败</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 渲染消息内容
 */
function renderMessageContent(content, type) {
    switch (type) {
        case 'code':
            return renderCodeContent(content);
        case 'mermaid':
            return renderMermaidContent(content);
        case 'url':
            return renderUrlContent(content);
        case 'image':
            return renderImageContent(content);
        default:
            return renderTextContent(content);
    }
}

/**
 * 渲染文本内容
 */
function renderTextContent(content) {
    return (
        <div className="text-content">
            {content.split('\n').map((line, index) => (
                <div key={index} className="text-line">
                    {line}
                </div>
            ))}
        </div>
    );
}

/**
 * 渲染代码内容
 */
function renderCodeContent(content) {
    const codeBlocks = extractCodeBlocks(content);
    
    return (
        <div className="code-content">
            {codeBlocks.map((block, index) => (
                <div key={index} className="code-block">
                    <div className="code-header">
                        <span className="code-language">{block.language || 'text'}</span>
                        <button className="copy-button" onClick={() => copyToClipboard(block.code)}>
                            复制
                        </button>
                    </div>
                    <pre className="code-body">
                        <code dangerouslySetInnerHTML={{ __html: highlightCode(block.code, block.language) }} />
                    </pre>
                </div>
            ))}
            {codeBlocks.length === 0 && renderTextContent(content)}
        </div>
    );
}

/**
 * 渲染Mermaid图表内容
 */
function renderMermaidContent(content) {
    return (
        <div className="mermaid-content">
            <div className="mermaid-chart" data-mermaid={content}>
                {content}
            </div>
        </div>
    );
}

/**
 * 渲染URL内容
 */
function renderUrlContent(content) {
    return (
        <div className="url-content">
            <a href={content} target="_blank" rel="noopener noreferrer" className="url-link">
                {content}
            </a>
        </div>
    );
}

/**
 * 渲染图片内容
 */
function renderImageContent(content) {
    return (
        <div className="image-content">
            <img src={content} alt="用户分享的图片" className="message-image" />
        </div>
    );
}

/**
 * 提取代码块
 */
function extractCodeBlocks(content) {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        blocks.push({
            language: match[1] || 'text',
            code: match[2].trim()
        });
    }

    return blocks;
}

/**
 * 高亮代码
 */
function highlightCode(code, language = 'text') {
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
 * 复制到剪贴板
 */
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
        });
    } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

/**
 * 聊天输入组件
 */
export function ChatInput({ onSendMessage, disabled = false }) {
    const { inputValue, setInputValue, handleKeyDown, handleSubmit } = usePetChatInput({
        onSendMessage
    });

    return (
        <div className="chat-input-container">
            <textarea
                className="chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息..."
                disabled={disabled}
                rows={1}
                autoFocus
            />
            <button 
                className="send-button" 
                onClick={handleSubmit}
                disabled={disabled || !inputValue.trim()}
            >
                发送
            </button>
        </div>
    );
}

/**
 * 聊天会话列表组件
 */
export function ChatSessionList({ sessions, currentSessionId, onSwitchSession, onDeleteSession }) {
    return (
        <div className="chat-session-list">
            {sessions.map(session => (
                <div 
                    key={session.id}
                    className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                    onClick={() => onSwitchSession(session.id)}
                >
                    <div className="session-info">
                        <div className="session-name">{session.name}</div>
                        <div className="session-time">
                            {formatMessageTime(session.lastMessageTime || session.createdAt)}
                        </div>
                    </div>
                    <button 
                        className="delete-session-button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                        }}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

/**
 * 聊天头部组件
 */
export function ChatHeader({ roleConfig, onClose, onNewSession }) {
    return (
        <div className="chat-header">
            <div className="chat-title">
                <span className="role-icon">{roleConfig.icon}</span>
                <span className="role-name">{roleConfig.name}</span>
            </div>
            <div className="chat-actions">
                <button className="new-session-button" onClick={onNewSession}>
                    新会话
                </button>
                <button className="close-button" onClick={onClose}>
                    ×
                </button>
            </div>
        </div>
    );
}

/**
 * 宠物聊天主组件
 */
export function PetChat({ roleConfig }) {
    const {
        messages,
        sessions,
        currentSessionId,
        isProcessing,
        sendMessage,
        deleteMessage,
        editMessage,
        resendMessage
    } = usePetChat();

    const { scrollRef, scrollToBottom } = usePetChatScroll();

    const handleSendMessage = React.useCallback(async (content) => {
        try {
            await sendMessage(content);
            scrollToBottom();
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }, [sendMessage, scrollToBottom]);

    const messageGroups = React.useMemo(() => {
        return groupMessagesByTime(messages);
    }, [messages]);

    return (
        <div className="pet-chat-container">
            <ChatHeader 
                roleConfig={roleConfig}
                onClose={() => { /* 关闭聊天 */ }}
                onNewSession={() => { /* 创建新会话 */ }}
            />
            
            <div className="chat-body">
                <div className="chat-sidebar">
                    <ChatSessionList 
                        sessions={sessions}
                        currentSessionId={currentSessionId}
                        onSwitchSession={() => { /* 切换会话 */ }}
                        onDeleteSession={() => { /* 删除会话 */ }}
                    />
                </div>
                
                <div className="chat-main">
                    <div className="chat-messages" ref={scrollRef}>
                        {messageGroups.map(group => (
                            <div key={group.id} className="message-group">
                                {group.messages.map(message => (
                                    <ChatMessage 
                                        key={message.id}
                                        message={message}
                                        roleConfig={roleConfig}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                    
                    <div className="chat-footer">
                        <ChatInput 
                            onSendMessage={handleSendMessage}
                            disabled={isProcessing}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}