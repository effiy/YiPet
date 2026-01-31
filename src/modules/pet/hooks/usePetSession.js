/**
 * Pet Session Management Hook
 * 宠物会话管理Hook
 */

import React from 'react';
import { usePetState } from './usePetState.js';
import { petStateManager } from '../core/PetStateManager.js';
import { generateSessionId, generateMessageId } from '../utils/index.js';

/**
 * 会话管理Hook
 */
export function usePetSession() {
    const [sessions, setSessions] = usePetState('sessions', state => state.sessions || []);
    const [currentSessionId, setCurrentSessionId] = usePetState('currentSessionId');

    /**
     * 创建新会话
     */
    const createSession = React.useCallback((name = null, options = {}) => {
        const sessionId = generateSessionId();
        const sessionName = name || `会话 ${sessions.length + 1}`;
        const now = Date.now();
        
        const newSession = {
            id: sessionId,
            name: sessionName,
            createdAt: now,
            lastMessageTime: now,
            messages: [],
            metadata: {
                role: options.role || '教师',
                color: options.color || PET_CONFIG.pet.defaultColor,
                ...options.metadata
            }
        };

        setSessions(prev => [...prev, newSession]);
        setCurrentSessionId(sessionId);
        
        return sessionId;
    }, [sessions, setSessions, setCurrentSessionId]);

    /**
     * 删除会话
     */
    const deleteSession = React.useCallback((sessionId) => {
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        
        // 如果删除的是当前会话，切换到第一个会话或创建新会话
        if (currentSessionId === sessionId) {
            const remainingSessions = sessions.filter(s => s.id !== sessionId);
            if (remainingSessions.length > 0) {
                setCurrentSessionId(remainingSessions[0].id);
            } else {
                createSession();
            }
        }
    }, [sessions, setSessions, currentSessionId, setCurrentSessionId, createSession]);

    /**
     * 切换会话
     */
    const switchSession = React.useCallback((sessionId) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            setCurrentSessionId(sessionId);
            return true;
        }
        return false;
    }, [sessions, setCurrentSessionId]);

    /**
     * 重命名会话
     */
    const renameSession = React.useCallback((sessionId, newName) => {
        setSessions(prev => prev.map(session => 
            session.id === sessionId 
                ? { ...session, name: newName }
                : session
        ));
    }, [setSessions]);

    /**
     * 获取当前会话
     */
    const getCurrentSession = React.useCallback(() => {
        return sessions.find(session => session.id === currentSessionId) || null;
    }, [sessions, currentSessionId]);

    /**
     * 添加消息到当前会话
     */
    const addMessageToCurrentSession = React.useCallback((message) => {
        const messageId = generateMessageId();
        const now = Date.now();
        
        const messageWithMetadata = {
            id: messageId,
            ...message,
            timestamp: now,
            sessionId: currentSessionId
        };

        setSessions(prev => prev.map(session => 
            session.id === currentSessionId
                ? {
                    ...session,
                    messages: [...session.messages, messageWithMetadata],
                    lastMessageTime: now
                }
                : session
        ));

        return messageId;
    }, [currentSessionId, setSessions]);

    /**
     * 从当前会话删除消息
     */
    const removeMessageFromCurrentSession = React.useCallback((messageId) => {
        setSessions(prev => prev.map(session => 
            session.id === currentSessionId
                ? {
                    ...session,
                    messages: session.messages.filter(msg => msg.id !== messageId)
                }
                : session
        ));
    }, [currentSessionId, setSessions]);

    /**
     * 更新当前会话中的消息
     */
    const updateMessageInCurrentSession = React.useCallback((messageId, updates) => {
        setSessions(prev => prev.map(session => 
            session.id === currentSessionId
                ? {
                    ...session,
                    messages: session.messages.map(msg => 
                        msg.id === messageId 
                            ? { ...msg, ...updates }
                            : msg
                    )
                }
                : session
        ));
    }, [currentSessionId, setSessions]);

    /**
     * 清空当前会话的消息
     */
    const clearCurrentSession = React.useCallback(() => {
        setSessions(prev => prev.map(session => 
            session.id === currentSessionId
                ? { ...session, messages: [], lastMessageTime: Date.now() }
                : session
        ));
    }, [currentSessionId, setSessions]);

    /**
     * 搜索会话
     */
    const searchSessions = React.useCallback((query) => {
        if (!query.trim()) return sessions;
        
        const lowerQuery = query.toLowerCase();
        return sessions.filter(session => 
            session.name.toLowerCase().includes(lowerQuery) ||
            session.messages.some(msg => 
                msg.content && msg.content.toLowerCase().includes(lowerQuery)
            )
        );
    }, [sessions]);

    /**
     * 获取会话统计信息
     */
    const getSessionStats = React.useCallback(() => {
        const totalSessions = sessions.length;
        const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);
        const activeSessions = sessions.filter(s => s.messages.length > 0).length;
        const oldestSession = sessions.reduce((oldest, session) => 
            !oldest || session.createdAt < oldest.createdAt ? session : oldest, null
        );
        const newestSession = sessions.reduce((newest, session) => 
            !newest || session.createdAt > newest.createdAt ? session : newest, null
        );

        return {
            totalSessions,
            totalMessages,
            activeSessions,
            oldestSession: oldestSession ? {
                id: oldestSession.id,
                name: oldestSession.name,
                createdAt: oldestSession.createdAt
            } : null,
            newestSession: newestSession ? {
                id: newestSession.id,
                name: newestSession.name,
                createdAt: newestSession.createdAt
            } : null
        };
    }, [sessions]);

    /**
     * 导出会话数据
     */
    const exportSessions = React.useCallback((sessionIds = null) => {
        const sessionsToExport = sessionIds 
            ? sessions.filter(s => sessionIds.includes(s.id))
            : sessions;

        const exportData = {
            version: '1.0',
            exportTime: Date.now(),
            sessions: sessionsToExport,
            currentSessionId
        };

        return JSON.stringify(exportData, null, 2);
    }, [sessions, currentSessionId]);

    /**
     * 导入会话数据
     */
    const importSessions = React.useCallback((jsonData) => {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.sessions || !Array.isArray(data.sessions)) {
                throw new Error('无效的会话数据格式');
            }

            // 验证会话数据
            const validSessions = data.sessions.filter(session => 
                session.id && session.name && session.createdAt
            );

            if (validSessions.length === 0) {
                throw new Error('没有有效的会话数据');
            }

            // 生成新的会话ID以避免冲突
            const importedSessions = validSessions.map(session => ({
                ...session,
                id: generateSessionId(),
                importedAt: Date.now()
            }));

            setSessions(prev => [...prev, ...importedSessions]);

            return {
                success: true,
                importedCount: importedSessions.length,
                skippedCount: data.sessions.length - validSessions.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }, [setSessions]);

    return {
        // 状态
        sessions,
        currentSessionId,
        currentSession: getCurrentSession(),
        
        // 会话管理
        createSession,
        deleteSession,
        switchSession,
        renameSession,
        
        // 消息管理
        addMessageToCurrentSession,
        removeMessageFromCurrentSession,
        updateMessageInCurrentSession,
        clearCurrentSession,
        
        // 工具函数
        searchSessions,
        getSessionStats,
        exportSessions,
        importSessions
    };
}