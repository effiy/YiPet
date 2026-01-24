(function () {
    // 确保 PetManager 类已定义
    if (typeof window.PetManager === 'undefined') {
        console.error('PetManager 未定义，无法扩展 Session 模块');
        return;
    }

    const proto = window.PetManager.prototype;

    // ==================== 会话初始化与核心流程 ====================

    proto.initSession = async function () {
        const pageInfo = this.getPageInfo();
        const currentUrl = pageInfo.url;
        const isSamePage = this.currentPageUrl === currentUrl;

        // 加载所有会话数据
        await this.loadAllSessions();

        // 处理同一页面的情况：如果已选中会话，只更新一致性
        if (isSamePage && this.hasAutoCreatedSessionForPage && this.currentSessionId) {
            if (this.sessions[this.currentSessionId]) {
                const needsUpdate = this.ensureSessionConsistency(this.currentSessionId);
                if (needsUpdate) {
                    // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
                    await this.updateSessionUI({ updateTitle: true });
                } else {
                    // 更新访问时间（节流）
                    const session = this.sessions[this.currentSessionId];
                    const now = Date.now();
                    if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
                        session.lastAccessTime = now;
                    }
                }
                await this.updateSessionUI({ updateSidebar: true });
            }
            return this.currentSessionId;
        }

        // 处理新页面的情况
        if (!isSamePage) {
            this.currentPageUrl = currentUrl;
            this.hasAutoCreatedSessionForPage = false;
        }

        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存

        // 首先查找是否存在URL匹配的会话（遍历所有会话）
        let matchedSessionId = null;
        for (const [sessionId, session] of Object.entries(this.sessions)) {
            if (session && session.url === currentUrl) {
                matchedSessionId = sessionId;
                break;
            }
        }

        // 如果找到了匹配的会话，直接选中
        if (matchedSessionId) {
            const existingSession = this.sessions[matchedSessionId];
            if (existingSession) {
                // 更新会话页面信息
                this.updateSessionPageInfo(matchedSessionId, pageInfo);
                // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存

                // 自动选中匹配的会话
                await this.activateSession(matchedSessionId, {
                    saveCurrent: false, // 已经在前面保存了
                    updateConsistency: true,
                    updateUI: true
                });

                // 滚动到会话项位置（等待侧边栏更新完成）
                if (this.sessionSidebar && typeof this.scrollToSessionItem === 'function') {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await this.scrollToSessionItem(matchedSessionId);
                }

                console.log('找到URL匹配的会话，已自动选中:', matchedSessionId);
                return matchedSessionId;
            }
        }

        // 如果没有找到URL匹配的会话，使用URL生成会话ID
        const sessionId = await this.generateSessionId(currentUrl);

        // 查找是否存在该会话ID的会话
        let existingSession = this.sessions[sessionId];

        if (existingSession) {
            // 更新会话页面信息
            this.updateSessionPageInfo(sessionId, pageInfo);
            // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存

            // 自动选中匹配的会话
            await this.activateSession(sessionId, {
                saveCurrent: false, // 已经在前面保存了
                updateConsistency: true,
                updateUI: true
            });

            // 滚动到会话项位置（等待侧边栏更新完成）
            if (this.sessionSidebar && typeof this.scrollToSessionItem === 'function') {
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.scrollToSessionItem(sessionId);
            }

            console.log('找到基于URL的已有会话，已自动选中:', sessionId);
            return sessionId;
        } else {
            // 没有找到会话，使用URL作为会话ID自动创建新会话
            const newSession = this.createSessionObject(pageInfo);
            this.sessions[sessionId] = newSession;

            // 调用 write-file 接口写入页面上下文（参考 YiWeb 的 handleSessionCreate）
            // 即使页面内容为空，也需要创建文件
            if (typeof this.writeSessionPageContent === 'function') {
                await this.writeSessionPageContent(sessionId);
            }

            // 保存到本地
            await this.saveAllSessions(true, true);

            // 同步到后端（只在聊天窗口打开时）
            if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                await this.syncSessionToBackend(sessionId, true, true);
            }

            // 自动激活新创建的会话
            await this.activateSession(sessionId, {
                saveCurrent: false, // 已经在前面保存了
                updateConsistency: true,
                updateUI: true
            });

            // 滚动到会话项位置（等待侧边栏更新完成）
            if (this.sessionSidebar && typeof this.scrollToSessionItem === 'function') {
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.scrollToSessionItem(sessionId);
            }

            console.log('使用URL作为会话ID，已自动创建并保存新会话:', sessionId, 'URL:', currentUrl);

            return sessionId;
        }
    };

    proto.activateSession = async function (sessionId, options = {}) {
        const {
            saveCurrent = true,
            updateConsistency = true,
            updateUI = true,
            syncToBackend = true,
            skipBackendFetch = false, // 是否跳过从后端获取数据（用于新创建的空白会话）
            keepApiRequestListView = false, // 是否保持请求接口列表视图（不切换到会话列表）
            preserveOrder = false // 是否保持排列位置不变（不更新 lastAccessTime 和 updatedAt）
        } = options;

        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // 切换会话时不再自动保存

        // 切换到目标会话
        const targetSession = this.sessions[sessionId];
        if (!targetSession) {
            console.error('目标会话不存在:', sessionId);
            return;
        }

        this.currentSessionId = sessionId;
        this.currentPageUrl = targetSession.url || null;

        // 检查当前页面URL和目标会话URL是否匹配
        const pageInfo = this.getPageInfo();
        const isUrlMatched = targetSession.url === pageInfo.url;

        // 只有当URL匹配时，才标记为当前页面的会话
        // 如果URL不匹配（例如用户切换到其他页面的会话），不标记为自动创建
        this.hasAutoCreatedSessionForPage = isUrlMatched;

        // 当会话高亮时，调用 getSession 获取完整数据
        // 跳过情况：1. 明确指定跳过；2. 新创建的会话（创建时间很近，5秒内）
        // 注意：即使是空白会话，如果已经同步到后端，也应该尝试获取最新数据
        const isBlankSession = !targetSession.url ||
            targetSession.url.startsWith('blank-session://') ||
            targetSession._isBlankSession;
        const isNewSession = targetSession.createdAt && (Date.now() - targetSession.createdAt) < 5000; // 5秒内创建的会话视为新会话

        // 即使判定为空白会话，也应该尝试从后端获取数据（除非明确指定跳过或新创建）
        // 这样已同步到后端的空白会话也能获取最新数据
        // 只有在聊天窗口已经打开过的情况下才调用后端接口，避免页面刷新时自动调用
        if (!skipBackendFetch && !isNewSession && this.sessionApi && this.sessionApi.isEnabled() && !this.isChatWindowFirstOpen) {
            try {
                // 使用 session.key 作为查询参数，而不是 sessionId
                const sessionKey = targetSession.key || sessionId;

                // 防止重复查询：如果正在切换会话且已经查询过，跳过查询
                // 初始化查询缓存（如果不存在）
                if (!this._sessionQueryCache) {
                    this._sessionQueryCache = {};
                }

                // 检查是否在短时间内已经查询过（2秒内）
                const now = Date.now();
                const lastQueryTime = this._sessionQueryCache[sessionKey];
                const QUERY_CACHE_INTERVAL = 2000; // 2秒缓存间隔

                if (lastQueryTime && (now - lastQueryTime) < QUERY_CACHE_INTERVAL) {
                    console.log('会话最近已查询过，跳过重复查询:', sessionKey);
                } else {
                    console.log('会话高亮，正在从后端获取完整数据:', sessionKey);
                    const fullSession = await this.sessionApi.getSession(sessionKey, true); // 强制刷新

                    // 更新查询缓存
                    this._sessionQueryCache[sessionKey] = now;

                    if (fullSession) {
                        // 更新本地会话数据
                        const existingSession = this.sessions[sessionId];
                        if (existingSession) {
                            // 合并完整数据
                            if (fullSession.messages && Array.isArray(fullSession.messages)) {
                                existingSession.messages = fullSession.messages;
                            }
                            if (fullSession.pageDescription) {
                                existingSession.pageDescription = fullSession.pageDescription;
                            }
                            const isAicrSession = String(existingSession.url || '').startsWith('aicr-session://') ||
                                String(existingSession.pageDescription || '').includes('文件：');
                            if (!isAicrSession && fullSession.pageContent) {
                                existingSession.pageContent = fullSession.pageContent;
                            }
                            const title = fullSession.title || existingSession.title;
                            existingSession.title = title;
                            // 如果 preserveOrder 为 true，不更新时间戳，保持排列位置不变
                            if (!preserveOrder) {
                                existingSession.updatedAt = fullSession.updatedAt || existingSession.updatedAt;
                                existingSession.createdAt = fullSession.createdAt || existingSession.createdAt;
                                existingSession.lastAccessTime = fullSession.lastAccessTime || existingSession.lastAccessTime;
                            } else {
                                // preserveOrder 为 true 时，只更新数据，不更新时间戳
                                console.log('保持排列位置不变，不更新会话时间戳');
                            }

                        } else {
                            // 如果本地不存在，直接使用后端数据
                            const title = fullSession.title || '';
                            // 确保有 key
                            if (!fullSession.key) {
                                fullSession.key = this._generateUUID();
                            }
                            this.sessions[sessionId] = {
                                ...fullSession,
                                title: title
                            };
                        }

                        // 本地不再缓存会话数据

                        // 如果这是当前会话，立即更新UI标题
                        if (sessionId === this.currentSessionId && this.isChatOpen) {
                            this.updateChatHeaderTitle();
                        }
                    }
                }
            } catch (error) {
                // 优雅处理404错误和其他错误
                const is404 = error.message && (
                    error.message.includes('404') ||
                    error.message.includes('Not Found') ||
                    error.status === 404 ||
                    error.response?.status === 404
                );

                if (is404) {
                    // 404错误是正常的（会话可能还未同步到后端），静默处理
                    console.log('会话在后端不存在（可能还未同步），使用本地数据:', sessionId);
                } else {
                    // 其他错误才警告
                    console.warn('从后端获取会话完整数据失败:', error.message);
                }
                // 继续使用本地数据
            }
        } else if (skipBackendFetch || isNewSession) {
            if (skipBackendFetch) {
                console.log('跳过从后端获取数据（明确指定跳过）:', sessionId);
            } else if (isNewSession) {
                console.log('跳过从后端获取数据（新创建的会话）:', sessionId);
            }
        }

        // 更新会话一致性（只有在URL匹配时才更新，确保数据隔离）
        if (updateConsistency && isUrlMatched) {
            // 只有当目标会话的URL和当前页面URL匹配时，才更新一致性
            // 这样可以防止切换到不同URL的会话时，意外修改那个会话的页面信息
            const needsUpdate = this.ensureSessionConsistency(sessionId);
            if (needsUpdate) {
                // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
            }
        } else if (!isUrlMatched && !preserveOrder) {
            // URL不匹配时，只更新最后访问时间，不更新页面信息（保持数据隔离）
            // 但如果 preserveOrder 为 true，则不更新时间戳，保持排列位置不变
            console.log(`切换到会话 ${sessionId}：URL不匹配，不更新页面信息。会话URL: ${targetSession.url}, 当前页面URL: ${pageInfo.url}`);
            const now = Date.now();
            if (!targetSession.lastAccessTime || (now - targetSession.lastAccessTime) > 60000) {
                targetSession.lastAccessTime = now;
                // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
            }
        } else if (preserveOrder) {
            // preserveOrder 为 true 时，不更新任何时间戳，保持排列位置不变
            console.log(`切换到会话 ${sessionId}：保持排列位置不变，不更新时间戳`);
        }

        // 更新UI
        if (updateUI) {
            await this.updateSessionUI({
                updateSidebar: true,
                updateTitle: true,
                loadMessages: this.isChatOpen,
                keepApiRequestListView: keepApiRequestListView // 传递保持请求接口列表视图的选项
            });
        }
    };

    proto.createSessionObject = function (pageInfo, existingSession = null) {
        const now = Date.now();

        // 如果是已有会话，保留消息和创建时间，以及 key
        const messages = existingSession?.messages || [];
        const createdAt = existingSession?.createdAt || now;
        const lastAccessTime = now; // 每次创建或更新时都更新访问时间

        const rawTitle = pageInfo.title || '';
        let title = rawTitle || '新会话';

        // 初始化标签数组
        let tags = existingSession?.tags ? [...existingSession.tags] : [];

        // 如果是自动新建的会话（existingSession 为 null），在标题后面添加 .md 后缀，并添加域名标签
        if (!existingSession) {
            // 辅助函数：如果字符串不为空且没有 .md 后缀，则添加后缀
            const addMdSuffix = (str) => {
                if (!str || !str.trim()) return str;
                return str.trim().endsWith('.md') ? str.trim() : str.trim() + '.md';
            };

            if (rawTitle) {
                title = addMdSuffix(rawTitle);
            } else {
                title = '新会话.md';
            }

            // 从 URL 中提取域名并作为标签添加
            if (pageInfo.url && typeof pageInfo.url === 'string') {
                try {
                    // 跳过自定义协议（如 blank-session://, import-session:// 等）
                    const customProtocols = ['blank-session://', 'import-session://', 'aicr-session://'];
                    const isCustomProtocol = customProtocols.some(protocol => pageInfo.url.startsWith(protocol));

                    if (!isCustomProtocol) {
                        // 确保URL有协议
                        let urlToProcess = pageInfo.url;
                        if (!urlToProcess.startsWith('http://') && !urlToProcess.startsWith('https://')) {
                            urlToProcess = 'https://' + urlToProcess;
                        }

                        // 提取域名
                        const urlObj = new URL(urlToProcess);
                        const domain = urlObj.hostname;

                        // 去掉 www. 前缀（可选）
                        const mainDomain = domain.startsWith('www.') ? domain.substring(4) : domain;

                        // 如果域名存在且不在标签列表中，则添加
                        if (mainDomain && !tags.includes(mainDomain)) {
                            tags.push(mainDomain);
                        }
                    }
                } catch (error) {
                    // URL 解析失败，忽略错误
                    console.warn('[createSessionObject] 从URL提取域名失败:', pageInfo.url, error);
                }
            }
        }

        return {
            url: pageInfo.url, // 页面URL（用于查找会话，作为会话的唯一标识）
            title: title, // 会话标题（与 YiWeb 保持一致）
            pageDescription: pageInfo.description || '', // 页面描述（meta description）
            pageContent: pageInfo.content || '', // 页面内容（Markdown格式，用于AI理解上下文）
            messages: messages, // 聊天记录（该会话的所有对话）
            tags: tags, // 标签数组（与 YiWeb 保持一致）
            createdAt: createdAt, // 创建时间
            updatedAt: now, // 更新时间
            lastAccessTime: lastAccessTime // 最后访问时间
        };
    };

    proto.ensureSessionConsistency = function (sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            return false;
        }

        const session = this.sessions[sessionId];
        const pageInfo = this.getPageInfo();

        // 检查是否为空白会话（不应该更新页面信息）
        const isBlankSession = session._isBlankSession ||
            !session.url ||
            session.url.startsWith('blank-session://');

        if (isBlankSession) {
            console.log(`确保会话一致性 ${sessionId}：空白会话，跳过页面信息更新`);
            // 空白会话只需要确保基本结构存在，不更新页面内容
            let updated = false;
            if (!Array.isArray(session.messages)) {
                session.messages = [];
                updated = true;
            }
            if (!session.createdAt) {
                session.createdAt = Date.now();
                updated = true;
            }
            if (!session.updatedAt) {
                session.updatedAt = Date.now();
                updated = true;
            }
            return updated;
        }

        // 关键检查：只有当会话URL和当前页面URL匹配时，才更新一致性
        // 这样可以防止修改不同URL的会话数据
        if (session.url !== pageInfo.url) {
            console.log(`确保会话一致性 ${sessionId}：URL不匹配，跳过更新。会话URL: ${session.url}, 当前页面URL: ${pageInfo.url}`);
            return false; // URL不匹配，不更新，保持数据隔离
        }

        let updated = false;

        // 确保URL一致
        if (session.url !== pageInfo.url) {
            console.log(`修复会话 ${sessionId} 的URL不一致:`, session.url, '->', pageInfo.url);
            session.url = pageInfo.url;
            updated = true;
        }

        // 确保页面标题一致
        // 只有当会话的标题为空或者是默认值时，才用当前页面的标题更新
        // 这样可以保留从后端加载的有效标题，避免被当前页面标题覆盖
        const currentPageTitle = pageInfo.title || '';
        const sessionTitle = session.title || '';
        const isDefaultTitle = !sessionTitle ||
            sessionTitle.trim() === '' ||
            sessionTitle === '未命名会话' ||
            sessionTitle === '新会话' ||
            sessionTitle === '未命名页面' ||
            sessionTitle === '当前页面' ||
            sessionTitle === '新会话.md';

        const addMdSuffix = (str) => {
            if (!str || !str.trim()) return str;
            return str.trim().endsWith('.md') ? str.trim() : str.trim() + '.md';
        };

        const nextTitle = currentPageTitle ? addMdSuffix(currentPageTitle) : '';

        if (isDefaultTitle && nextTitle && nextTitle !== sessionTitle) {
            console.log(`修复会话 ${sessionId} 的标题（从默认值更新）:`, sessionTitle, '->', nextTitle);
            session.title = nextTitle;
            updated = true;
        } else if (!isDefaultTitle && sessionTitle !== nextTitle && currentPageTitle) {
            // 如果会话已经有有效标题，但当前页面标题不同，记录日志但不强制更新
            // 这样可以保留从后端加载的标题
            console.log(`会话 ${sessionId} 的标题与当前页面不同，保留会话标题:`, sessionTitle, '（当前页面标题:', currentPageTitle, '）');
        }

        // 确保页面描述一致
        const pageDescription = pageInfo.description || '';
        if (session.pageDescription !== pageDescription) {
            console.log(`修复会话 ${sessionId} 的页面描述不一致`);
            session.pageDescription = pageDescription;
            updated = true;
        }

        // 确保页面内容存在（如果缺失则补充）
        // 注意：空白会话不会进入这个分支，因为前面已经处理了
        if (!session.pageContent || session.pageContent.trim() === '') {
            console.log(`补充会话 ${sessionId} 的页面内容`);
            session.pageContent = pageInfo.content;
            updated = true;
        }

        // 确保messages数组存在
        if (!Array.isArray(session.messages)) {
            console.log(`修复会话 ${sessionId} 的消息数组`);
            session.messages = [];
            updated = true;
        }

        // 确保时间戳存在
        if (!session.createdAt) {
            session.createdAt = Date.now();
            updated = true;
        }
        if (!session.updatedAt) {
            session.updatedAt = Date.now();
            updated = true;
        }

        // 确保最后访问时间存在并更新（节流：至少间隔1分钟）
        const now = Date.now();
        if (!session.lastAccessTime || (now - session.lastAccessTime) > 60000) {
            session.lastAccessTime = now;
            updated = true;
        }

        return updated;
    };

    proto.updateSessionPageInfo = function (sessionId, pageInfo) {
        if (!this.sessions[sessionId]) return false;

        const session = this.sessions[sessionId];

        // 空白会话不应该更新URL、pageDescription和pageContent
        // 这些信息应该保持为创建时的信息
        const isBlankSession = session._isBlankSession ||
            !session.url ||
            session.url.startsWith('blank-session://');
        if (isBlankSession) {
            console.log(`更新会话页面信息 ${sessionId}：空白会话，跳过页面信息更新`);
            // 空白会话的页面信息不应该被更新，只更新访问时间
            const now = Date.now();
            Object.assign(session, {
                updatedAt: now,
                lastAccessTime: now
            });
            return true;
        }

        // 关键检查：只有当会话URL和页面URL匹配时，才更新页面信息
        // 这样可以防止意外修改不同URL的会话数据
        if (session.url !== pageInfo.url) {
            console.log(`更新会话页面信息 ${sessionId}：URL不匹配，跳过更新。会话URL: ${session.url}, 页面URL: ${pageInfo.url}`);
            return false; // URL不匹配，不更新，保持数据隔离
        }

        const sessionData = this.createSessionObject(pageInfo, session);
        const now = Date.now();

        // 更新所有页面相关信息，保留消息和其他会话数据
        Object.assign(session, {
            url: sessionData.url,
            title: sessionData.title, // 更新 title 字段（与 YiWeb 保持一致）
            pageDescription: sessionData.pageDescription || '',
            pageContent: sessionData.pageContent || session.pageContent || '', // 保留已有内容，但如果缺失则补充
            updatedAt: sessionData.updatedAt,
            lastAccessTime: now // 更新最后访问时间
        });

        return true;
    };

    // ==================== 页面信息获取 ====================
    // 相关逻辑已移动到 petManager.pageInfo.js，直接使用原型链上的方法
    // getPageInfo() - 已移除
    // getPageContentAsMarkdown() - 已移除
    // getFullPageText() - 已移除

    // ==================== 数据同步与持久化 ====================

    proto.loadAllSessions = async function () {
        // 从后端强制加载会话列表（只在聊天窗口打开时）
        if (this.isChatOpen) {
            await this.loadSessionsFromBackend(true);
        }

        // 如果后端没有加载到会话，初始化空对象
        if (!this.sessions) {
            this.sessions = {};
        }
    };

    proto.saveAllSessions = async function (force = false, syncToBackend = true) {
        const now = Date.now();

        // 如果不在强制模式下，且距离上次保存时间太短，则延迟保存
        if (!force && (now - this.lastSessionSaveTime) < this.SESSION_SAVE_THROTTLE) {
            // 标记有待处理的更新
            this.pendingSessionUpdate = true;

            // 如果已有定时器在等待，清除它
            if (this.sessionUpdateTimer) {
                clearTimeout(this.sessionUpdateTimer);
            }

            // 延迟保存
            return new Promise((resolve) => {
                this.sessionUpdateTimer = setTimeout(async () => {
                    this.pendingSessionUpdate = false;
                    await this._doSaveAllSessions(syncToBackend);
                    resolve();
                }, this.SESSION_SAVE_THROTTLE - (now - this.lastSessionSaveTime));
            });
        }

        // 立即保存
        this.pendingSessionUpdate = false;
        if (this.sessionUpdateTimer) {
            clearTimeout(this.sessionUpdateTimer);
            this.sessionUpdateTimer = null;
        }
        return await this._doSaveAllSessions(syncToBackend);
    };

    proto._doSaveAllSessions = async function (syncToBackend = true) {
        this.lastSessionSaveTime = Date.now();

        // 异步同步到后端（使用队列批量保存，不阻塞保存流程）
        // 只有在允许同步且启用后端同步时，才同步到后端
        // 只在聊天窗口打开时才调用接口
        if (this.isChatOpen && syncToBackend && PET_CONFIG.api.syncSessionsToBackend && this.currentSessionId) {
            // 使用队列批量保存，提高性能
            this.syncSessionToBackend(this.currentSessionId, false).catch(err => {
                console.warn('同步会话到后端失败:', err);
            });
        }
    };

    proto.syncSessionToBackend = async function (sessionId, immediate = false, includePageContent = false) {
        try {
            // 只在聊天窗口打开时才调用接口
            if (!this.isChatOpen) {
                console.debug('聊天窗口未打开，跳过同步会话到后端:', sessionId);
                return;
            }

            if (!PET_CONFIG.api.syncSessionsToBackend) {
                return;
            }

            const session = this.sessions[sessionId];
            if (!session) {
                console.warn('会话不存在，无法同步:', sessionId);
                return;
            }

            // 构建请求数据
            // 检查是否为空白会话（支持 blank-session:// 和 aicr-session:// 协议）
            const isBlankSession = session._isBlankSession ||
                !session.url ||
                session.url.startsWith('blank-session://') ||
                session.url.startsWith('aicr-session://');

            // 如果是空白会话，应该保持使用原始的协议URL，而不是当前页面URL
            let sessionUrl = '';
            if (isBlankSession) {
                // 对于空白会话，优先使用保存的原始URL，防止被意外更新为当前页面URL
                if (session._originalUrl && (session._originalUrl.startsWith('blank-session://') || session._originalUrl.startsWith('aicr-session://'))) {
                    sessionUrl = session._originalUrl;
                } else if (session.url && (session.url.startsWith('blank-session://') || session.url.startsWith('aicr-session://'))) {
                    sessionUrl = session.url;
                } else {
                    // 如果URL已经被更新，使用创建时的URL或重新生成一个 aicr-session:// URL（与新建会话保持一致）
                    sessionUrl = session._originalUrl || `aicr-session://${session.createdAt || Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                }
            } else {
                sessionUrl = session.url || '';
            }

            let pageDescription = session.pageDescription || '';
            let pageContent = session.pageContent || '';
            const title = session.title || '新会话';

            // 确保有 key 字段（使用 key 作为唯一标识符，与 YiWeb 保持一致）
            const sessionKey = session.key || this._generateUUID();
            if (!session.key) {
                // 如果会话没有 key，更新会话对象
                session.key = sessionKey;
            }

            const normalizeMessagesForBackend = (messages) => {
                const list = Array.isArray(messages) ? messages : [];
                return list.map((m) => {
                    const type = (m && m.type === 'pet') ? 'pet' : 'user';
                    const message = String(m?.message ?? m?.content ?? '').trim();
                    const timestamp = Number(m?.timestamp) || Date.now();
                    const imageDataUrls = Array.isArray(m?.imageDataUrls) ? m.imageDataUrls.filter(Boolean) : [];
                    const imageDataUrl = String(m?.imageDataUrl || '').trim();
                    const payload = {
                        type,
                        message,
                        timestamp
                    };
                    if (imageDataUrls.length > 0) {
                        payload.imageDataUrls = imageDataUrls;
                        payload.imageDataUrl = imageDataUrls[0];
                    } else if (imageDataUrl) {
                        payload.imageDataUrl = imageDataUrl;
                        payload.imageDataUrls = [imageDataUrl];
                    }
                    if (m?.error) payload.error = true;
                    if (m?.aborted) payload.aborted = true;
                    return payload;
                });
            };

            const sessionData = {
                key: sessionKey, // 使用 key 作为唯一标识符（与 YiWeb 保持一致）
                url: sessionUrl,
                title: title, // 会话标题（与 YiWeb 保持一致）
                pageDescription: pageDescription,
                messages: normalizeMessagesForBackend(session.messages),
                tags: session.tags || [],
                createdAt: session.createdAt || Date.now(),
                updatedAt: session.updatedAt || Date.now(),
                lastAccessTime: session.lastAccessTime || Date.now(),
                isFavorite: session.isFavorite !== undefined ? !!session.isFavorite : false
            };

            // 包含 pageContent 字段的情况：
            // 1. 手动保存页面上下文时（includePageContent = true）
            // 2. 接口会话中有pageContent时（即使includePageContent = false，也应该保存）
            const isAicrSession = String(sessionUrl || '').startsWith('aicr-session://') || String(pageDescription || '').includes('文件：');
            if (!isAicrSession && (includePageContent ||
                (session._isApiRequestSession && pageContent && pageContent.trim() !== ''))) {
                sessionData.pageContent = pageContent;
            }

            // 使用API管理器
            if (this.sessionApi) {
                if (immediate) {
                    // 立即保存（包括空白会话，创建新会话时需要立即发送请求）
                    try {
                        const result = await this.sessionApi.saveSession(sessionData);

                        // 如果返回了完整的会话数据，更新本地会话数据
                        if (result?.data?.session) {
                            const updatedSession = result.data.session;
                            if (this.sessions[sessionId]) {
                                const localSession = this.sessions[sessionId];
                                // 更新本地会话数据，但保留本地的 messages 和 pageContent（可能包含未同步的最新数据）
                                this.sessions[sessionId] = {
                                    ...updatedSession,
                                    // 如果本地消息更新，保留本地消息
                                    messages: localSession.messages?.length > updatedSession.messages?.length
                                        ? localSession.messages
                                        : updatedSession.messages,
                                    // 优先保留本地的 pageContent（如果本地有内容），避免页面上下文丢失
                                    pageContent: (localSession.pageContent && localSession.pageContent.trim() !== '')
                                        ? localSession.pageContent
                                        : (updatedSession.pageContent || localSession.pageContent || ''),
                                    // 优先保留本地的 isFavorite（如果本地有值），确保用户操作立即生效
                                    isFavorite: localSession.isFavorite !== undefined
                                        ? !!localSession.isFavorite
                                        : (updatedSession.isFavorite !== undefined ? !!updatedSession.isFavorite : false)
                                };
                                if (!this.sessions[sessionId].title) {
                                    this.sessions[sessionId].title = updatedSession.title || localSession.title || '新会话';
                                }
                            }
                        }

                        // 清除列表缓存，强制下次刷新时从接口获取最新数据
                        this.lastSessionListLoadTime = 0;

                        console.log(`会话 ${sessionId} 已立即同步到后端`);
                    } catch (error) {
                        // 如果立即保存失败，降级为队列保存
                        const is404 = error.message && (
                            error.message.includes('404') ||
                            error.message.includes('Not Found') ||
                            error.status === 404 ||
                            error.response?.status === 404
                        );

                        if (is404) {
                            console.log('立即保存失败（404），降级为队列保存:', sessionId);
                            this.sessionApi.queueSave(sessionId, sessionData);
                        } else {
                            throw error; // 重新抛出非404错误
                        }
                    }
                } else {
                    // 加入队列批量保存
                    this.sessionApi.queueSave(sessionId, sessionData);
                    console.log(`会话 ${sessionId} 已加入保存队列`);
                }
            } else {
                // 向后兼容：使用旧方式
                // session/save 调用已删除，跳过同步
                console.log(`会话 ${sessionId} 同步已跳过（sessionApi 未初始化）`);
            }
        } catch (error) {
            // 优雅处理错误，不阻塞主流程
            const is404 = error.message && (
                error.message.includes('404') ||
                error.message.includes('Not Found') ||
                error.status === 404 ||
                error.response?.status === 404
            );

            if (is404) {
                // 404错误是正常的（会话可能还未同步到后端），尝试使用队列保存
                if (this.sessionApi && session) {
                    try {
                        // 构建会话数据
                        // 检查是否为空白会话（支持 blank-session:// 和 aicr-session:// 协议）
                        const isBlankSession = session._isBlankSession ||
                            !session.url ||
                            session.url.startsWith('blank-session://') ||
                            session.url.startsWith('aicr-session://');

                        // 如果是接口会话，url应该使用接口的pageUrl或url，而不是session.url（可能被更新为当前页面URL）
                        // 如果是空白会话，应该保持使用原始的协议URL，而不是当前页面URL
                        let fallbackSessionUrl = '';
                        if (isBlankSession) {
                            // 对于空白会话，优先使用保存的原始URL，防止被意外更新为当前页面URL
                            if (session._originalUrl && (session._originalUrl.startsWith('blank-session://') || session._originalUrl.startsWith('aicr-session://'))) {
                                fallbackSessionUrl = session._originalUrl;
                            } else if (session.url && (session.url.startsWith('blank-session://') || session.url.startsWith('aicr-session://'))) {
                                fallbackSessionUrl = session.url;
                            } else {
                                // 如果URL已经被更新，使用创建时的URL或重新生成一个 aicr-session:// URL（与新建会话保持一致）
                                fallbackSessionUrl = session._originalUrl || `aicr-session://${session.createdAt || Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                            }
                        } else {
                            fallbackSessionUrl = session.url || '';
                        }

                        let fallbackTitle = session.title || '';
                        let fallbackPageDescription = session.pageDescription || '';
                        let fallbackPageContent = session.pageContent || '';

                        const sessionData = {
                            key: session.key || this._generateUUID(),
                            url: fallbackSessionUrl,
                            title: fallbackTitle,
                            pageDescription: fallbackPageDescription,
                            messages: session.messages || [],
                            tags: session.tags || [],
                            createdAt: session.createdAt || Date.now(),
                            updatedAt: session.updatedAt || Date.now(),
                            lastAccessTime: session.lastAccessTime || Date.now()
                        };

                        // 包含 pageContent 字段的情况：
                        // 1. 手动保存页面上下文时（includePageContent = true）
                        const isAicrSession = String(fallbackSessionUrl || '').startsWith('aicr-session://') || String(fallbackPageDescription || '').includes('文件：');
                        if (!isAicrSession && includePageContent) {
                            sessionData.pageContent = fallbackPageContent;
                        }

                        this.sessionApi.queueSave(sessionId, sessionData);
                        console.log('同步失败（404），已加入队列稍后重试:', sessionId);
                    } catch (queueError) {
                        console.warn('加入队列也失败:', queueError.message);
                    }
                }
            } else {
                console.warn('同步会话到后端时出错:', error.message);
            }
        }
    };

    proto.loadSessionsFromBackend = async function (forceRefresh = false) {
        try {
            // 检查是否需要刷新
            if (!forceRefresh) { return; }
            if (!this.isChatOpen) { return; }
            if (this.hasLoadedSessionsForChat && this.lastSessionListLoadTime && (Date.now() - this.lastSessionListLoadTime) < this.SESSION_LIST_RELOAD_INTERVAL) {
                return;
            }

            // 使用API管理器获取会话列表
            if (!this.sessionApi) {
                console.log('sessionApi 未初始化，跳过从后端加载');
                return;
            }

            console.log('从后端加载会话列表...');
            const backendSessions = await this.sessionApi.getSessionsList({ forceRefresh });

            if (!Array.isArray(backendSessions)) {
                console.warn('后端返回的会话列表格式不正确');
                return;
            }

            // 初始化 sessions 对象
            if (!this.sessions) {
                this.sessions = {};
            }

            // 辅助函数：解析时间
            const parseTime = (timeVal) => {
                if (!timeVal) return 0;
                if (typeof timeVal === 'number') return timeVal;
                if (typeof timeVal === 'string') {
                    const d = new Date(timeVal);
                    if (!isNaN(d.getTime())) return d.getTime();
                }
                return 0;
            };

            // 直接使用接口返回的结果，转换为本地格式
            const newSessions = {};
            for (const backendSession of backendSessions) {
                // 必须有 key 字段
                if (!backendSession.key) {
                    console.warn('会话缺少 key 字段，跳过:', backendSession);
                    continue;
                }

                const sessionUrl = backendSession.url || '';
                const isBlankSession = sessionUrl.startsWith('blank-session://') ||
                    sessionUrl.startsWith('aicr-session://') ||
                    backendSession._isBlankSession;

                // 解析时间字段
                const createdAt = parseTime(backendSession.createdAt) ||
                    parseTime(backendSession.createdTime) ||
                    parseTime(backendSession.created_time) ||
                    parseTime(backendSession.created_at) ||
                    Date.now();

                const updatedAt = parseTime(backendSession.updatedAt) ||
                    parseTime(backendSession.updatedTime) ||
                    parseTime(backendSession.updated_time) ||
                    parseTime(backendSession.updated_at) ||
                    Date.now();

                const lastAccessTime = parseTime(backendSession.lastAccessTime) ||
                    parseTime(backendSession.last_access_time) ||
                    updatedAt;

                // 构建本地会话对象
                const localSession = {
                    key: backendSession.key,
                    url: sessionUrl,
                    title: (backendSession.title || '新会话'),
                    pageDescription: backendSession.pageDescription || '',
                    pageContent: isBlankSession ? (backendSession.pageContent || '') : ((sessionUrl.startsWith('aicr-session://') || String(backendSession.pageDescription || '').includes('文件：')) ? '' : (backendSession.pageContent || '')),
                    messages: backendSession.messages || [],
                    tags: backendSession.tags || [],
                    createdAt: createdAt,
                    updatedAt: updatedAt,
                    lastAccessTime: lastAccessTime,
                    isFavorite: backendSession.isFavorite !== undefined ? !!backendSession.isFavorite : false
                };

                // 如果是空白会话，添加标记
                if (isBlankSession) {
                    localSession._isBlankSession = true;
                    localSession._originalUrl = sessionUrl;
                }
                newSessions[backendSession.key] = localSession;
            }

            // 直接替换 sessions
            this.sessions = newSessions;
            this.lastSessionListLoadTime = Date.now();
            this.hasLoadedSessionsForChat = true;

            // 更新UI
            await this.updateSessionUI({ updateSidebar: true });
            console.log('会话列表已从后端加载，当前会话数量:', Object.keys(this.sessions).length);
        } catch (error) {
            console.warn('从后端加载会话列表失败:', error);
        }
    };

    // ==================== 辅助方法 ====================

    proto.getCurrentSessionId = function () {
        const currentUrl = window.location.href;
        // 使用URL作为会话ID的基础，如果URL过长则使用hash
        // 为了保持向后兼容和唯一性，我们使用generateSessionId，但在initSession中通过URL查找
        return currentUrl;
    };

    proto.findSessionByUrl = function (url) {
        return Object.values(this.sessions).find(session => session.url === url) || null;
    };

    proto.generateSessionId = async function (url) {
        // 确保md5函数可用
        const md5Func = typeof md5 !== 'undefined' ? md5 :
            (typeof window !== 'undefined' && window.md5) ? window.md5 : null;

        if (!md5Func) {
            console.error('MD5函数未找到，请确保已加载md5.js');
            // 降级方案：生成32位十六进制字符串
            if (!url) {
                const input = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                let hash = 0;
                for (let i = 0; i < input.length; i++) {
                    const char = input.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                const hex = Math.abs(hash).toString(16).padStart(32, '0');
                return hex.substring(0, 32);
            }
            const hash = await this.hashString(url);
            return hash;
        }

        // 始终使用MD5，不管URL长度如何，确保所有会话ID都是统一的32位MD5格式
        return md5Func(url);
    };

    proto.hashString = async function (str) {
        // 使用 SHA-256 生成哈希
        const msgBuffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        // 截取前32位以匹配MD5长度
        return hashHex.substring(0, 32);
    };

    proto._getSessionsFromLocal = function () {
        // 确保 sessions 对象已初始化
        if (!this.sessions) {
            this.sessions = {};
            return [];
        }

        // 获取所有会话并去重（按 key 去重，保留 updatedAt 最新的）
        const sessionMap = new Map();
        for (const session of Object.values(this.sessions)) {
            // 兼容 key 和 id，优先使用 key
            // 确保会话有 key，如果没有则生成一个
            if (!session.key) {
                session.key = this._generateUUID();
            }
            const uniqueKey = session.key;
            if (!session || !uniqueKey) {
                continue;
            }

            const sessionKey = String(uniqueKey);
            const existingSession = sessionMap.get(sessionKey);

            if (!existingSession) {
                // 如果不存在，直接添加
                sessionMap.set(sessionKey, session);
            } else {
                // 如果已存在，比较 updatedAt，保留更新的版本
                const existingUpdatedAt = existingSession.updatedAt || existingSession.createdAt || 0;
                const currentUpdatedAt = session.updatedAt || session.createdAt || 0;

                if (currentUpdatedAt > existingUpdatedAt) {
                    sessionMap.set(sessionKey, session);
                }
            }
        }

        return Array.from(sessionMap.values());
    };

    proto._getFilteredSessions = function () {
        let allSessions = this._getSessionsFromLocal();

        // 分离收藏的会话和非收藏的会话
        const favoriteSessions = [];
        const nonFavoriteSessions = [];

        for (const session of allSessions) {
            if (session.isFavorite) {
                favoriteSessions.push(session);
            } else {
                nonFavoriteSessions.push(session);
            }
        }

        // 对非收藏的会话进行筛选
        let filteredNonFavorite = nonFavoriteSessions;

        // 搜索筛选：先进行搜索筛选（与YiH5保持一致）
        const q = (this.sessionTitleFilter || '').trim().toLowerCase();
        if (q) {
            filteredNonFavorite = filteredNonFavorite.filter(session => {
                // 与YiH5保持一致：搜索title, preview, url, tags
                const title = session.title || '';
                const preview = session.preview || session.pageDescription || '';
                const url = session.url || '';
                const tags = Array.isArray(session.tags) ? session.tags.join(' ') : '';
                const hay = `${title} ${preview} ${url} ${tags}`.toLowerCase();
                return hay.includes(q);
            });
        }

        // 标签筛选
        if (this.tagFilterNoTags || (this.selectedFilterTags && this.selectedFilterTags.length > 0)) {
            filteredNonFavorite = filteredNonFavorite.filter(session => {
                const sessionTags = Array.isArray(session.tags) ? session.tags.map((t) => String(t).trim()) : [];
                const hasNoTags = sessionTags.length === 0 || !sessionTags.some((t) => t);
                const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0 &&
                    this.selectedFilterTags.some((selectedTag) => sessionTags.includes(selectedTag));

                // 反向过滤逻辑
                if (this.tagFilterReverse && this.selectedFilterTags && this.selectedFilterTags.length > 0) {
                    if (hasSelectedTags) return false;
                    if (this.tagFilterNoTags && hasNoTags) return true;
                    return true;
                } else {
                    if (this.tagFilterNoTags && hasNoTags) return true;
                    if (this.selectedFilterTags && this.selectedFilterTags.length > 0 && hasSelectedTags) return true;
                    return false;
                }
            });
        }

        // 日期过滤
        const getTimestamp = (dateValue) => {
            if (!dateValue) return null;
            if (typeof dateValue === 'number' && dateValue > 0) return dateValue;
            if (typeof dateValue === 'string') {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) return date.getTime();
            }
            if (dateValue instanceof Date) return dateValue.getTime();
            return null;
        };

        const filterByDateRange = (sessions) => {
            if (!this.dateRangeFilter) return sessions;

            if (this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
                const startDate = this.dateRangeFilter.startDate;
                const endDate = this.dateRangeFilter.endDate;
                const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
                const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() + 24 * 60 * 60 * 1000 - 1;

                return sessions.filter(session => {
                    const sessionTime = getTimestamp(session.updatedAt || session.lastAccessTime || session.lastActiveAt || session.createdAt);
                    if (!sessionTime || sessionTime <= 0) return false;
                    return sessionTime >= startTime && sessionTime <= endTime;
                });
            } else if (this.dateRangeFilter.startDate && !this.dateRangeFilter.endDate) {
                const startDate = this.dateRangeFilter.startDate;
                const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
                const endTime = startTime + 24 * 60 * 60 * 1000 - 1;

                return sessions.filter(session => {
                    const sessionTime = getTimestamp(session.updatedAt || session.lastAccessTime || session.lastActiveAt || session.createdAt);
                    if (!sessionTime || sessionTime <= 0) return false;
                    return sessionTime >= startTime && sessionTime <= endTime;
                });
            } else if (!this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
                const endDate = this.dateRangeFilter.endDate;
                const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

                return sessions.filter(session => {
                    const sessionTime = getTimestamp(session.updatedAt || session.lastAccessTime || session.lastActiveAt || session.createdAt);
                    if (!sessionTime || sessionTime <= 0) return false;
                    return sessionTime < endTime;
                });
            }

            return sessions;
        };

        // 对收藏和非收藏会话都应用日期过滤
        const filteredFavorites = filterByDateRange(favoriteSessions);
        filteredNonFavorite = filterByDateRange(filteredNonFavorite);

        // 返回合并后的结果（收藏的在前）
        return [...filteredFavorites, ...filteredNonFavorite];
    };

    proto._getSessionDisplayTitle = function (session) {
        if (!session) return '未命名会话';

        // 优先使用会话的 title
        let sessionTitle = session.title || '未命名会话';

        // 如果是空白会话且标题是默认值，尝试生成更友好的标题（支持 blank-session:// 和 aicr-session:// 协议）
        if (session._isBlankSession ||
            (session.url && (session.url.startsWith('blank-session://') || session.url.startsWith('aicr-session://')))) {
            if (!session.title || session.title === '新会话' || session.title === '未命名会话' || session.title === '新会话.md') {
                // 如果有消息，使用第一条用户消息的前几个字
                if (session.messages && session.messages.length > 0) {
                    const firstUserMessage = session.messages.find(m => m.type === 'user');
                    if (firstUserMessage && firstUserMessage.content) {
                        const content = firstUserMessage.content.trim();
                        const preview = content.length > 30 ? content.substring(0, 30) + '...' : content;
                        sessionTitle = preview;
                    } else {
                        // 没有用户消息，使用创建时间
                        const createDate = new Date(session.createdAt || Date.now());
                        sessionTitle = `新会话 ${createDate.toLocaleString()}`;
                    }
                } else {
                    const createDate = new Date(session.createdAt || Date.now());
                    sessionTitle = `新会话 ${createDate.toLocaleString()}`;
                }
            }
        }

        return sessionTitle;
    };

    // Tag related methods
    proto.loadTagOrder = function () {
        try {
            const savedOrder = localStorage.getItem('pet_session_tag_order');
            if (savedOrder) {
                this.tagOrder = JSON.parse(savedOrder);
            } else {
                this.tagOrder = null;
            }
        } catch (error) {
            console.warn('加载标签顺序失败:', error);
            this.tagOrder = null;
        }
    };

    proto.saveTagOrder = function (tagOrder) {
        try {
            localStorage.setItem('pet_session_tag_order', JSON.stringify(tagOrder));
            this.tagOrder = tagOrder;
        } catch (error) {
            console.warn('保存标签顺序失败:', error);
        }
    };

    proto.getAllTags = function () {
        // 使用与updateSessionSidebar相同的过滤逻辑
        let allSessions = this._getSessionsFromLocal();

        const tagSet = new Set();
        allSessions.forEach(session => {
            if (session.tags && Array.isArray(session.tags)) {
                session.tags.forEach(tag => {
                    if (tag && tag.trim()) {
                        tagSet.add(tag.trim());
                    }
                });
            }
        });

        const allTags = Array.from(tagSet);

        if (this.tagOrder && Array.isArray(this.tagOrder)) {
            const orderedTags = [];
            const unorderedTags = [];

            this.tagOrder.forEach(tag => {
                if (allTags.includes(tag)) {
                    orderedTags.push(tag);
                }
            });

            allTags.forEach(tag => {
                if (!this.tagOrder.includes(tag)) {
                    unorderedTags.push(tag);
                }
            });
            unorderedTags.sort();

            return [...orderedTags, ...unorderedTags];
        }

        const priorityTags = ['chat', '文档', '工具', '工作', '家庭', '娱乐', '日记'];
        const priorityTagSet = new Set(priorityTags);
        const priorityTagList = [];
        const otherTags = [];

        priorityTags.forEach(tag => {
            if (allTags.includes(tag)) {
                priorityTagList.push(tag);
            }
        });

        allTags.forEach(tag => {
            if (!priorityTagSet.has(tag)) {
                otherTags.push(tag);
            }
        });
        otherTags.sort();

        return [...priorityTagList, ...otherTags];
    };

    proto.addMessageToSession = async function (type, content, timestamp = null, syncToBackend = true, imageDataUrl = null, allowEmpty = false) {
        if (!this.currentSessionId) {
            console.warn('没有当前会话，无法添加消息');
            return;
        }

        // 确保会话存在
        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在，无法添加消息:', this.currentSessionId);
            return;
        }

        const session = this.sessions[this.currentSessionId];

        // 确保messages数组存在
        if (!Array.isArray(session.messages)) {
            session.messages = [];
        }

        const hasTextContent = content && typeof content === 'string' && content.trim();
        const hasSingleImage = typeof imageDataUrl === 'string' && imageDataUrl.trim();
        const hasMultiImages = Array.isArray(imageDataUrl) && imageDataUrl.some(v => typeof v === 'string' && v.trim());
        const hasImage = hasSingleImage || hasMultiImages;

        if (!hasTextContent && !hasImage && !allowEmpty) {
            console.warn('消息内容为空或无效（既无文本也无图片），跳过保存');
            return;
        }

        // 创建消息对象
        const message = {
            type: type, // 'user' 或 'pet'
            content: hasTextContent ? content.trim() : '', // 去除首尾空白，如果没有文本则为空字符串
            message: hasTextContent ? content.trim() : '',
            timestamp: timestamp || Date.now()
        };

        // 如果有图片数据，添加到消息对象中
        if (hasImage) {
            if (hasSingleImage) {
                message.imageDataUrl = imageDataUrl.trim();
                message.imageDataUrls = [imageDataUrl.trim()];
            } else {
                const list = imageDataUrl
                    .filter(v => typeof v === 'string')
                    .map(v => v.trim())
                    .filter(Boolean);
                if (list.length > 0) {
                    message.imageDataUrls = list;
                    message.imageDataUrl = list[0];
                }
            }
        }

        // 检查是否重复（避免重复保存相同的消息）
        // 如果最后一条消息的类型和内容都相同，可能是重复添加，跳过
        const lastMessage = session.messages[session.messages.length - 1];
        if (lastMessage &&
            lastMessage.type === message.type &&
            String(lastMessage.content ?? lastMessage.message ?? '') === String(message.content ?? message.message ?? '') &&
            String(lastMessage.imageDataUrl || '') === String(message.imageDataUrl || '') &&
            (Date.now() - lastMessage.timestamp) < 1000) { // 1秒内的相同消息视为重复
            const previewText = hasTextContent ? message.content.substring(0, 30) : (hasImage ? '[图片]' : '');
            console.log('检测到重复消息，跳过保存:', previewText);
            return;
        }

        // 如果是欢迎消息（第一条宠物消息），不添加到会话中
        if (type === 'pet' && session.messages.length === 0) {
            // 检查是否是欢迎消息，如果是则不添加
            return;
        }

        // 添加消息到会话对象
        session.messages.push(message);
        session.updatedAt = Date.now();

        const previewText = hasTextContent ? message.content.substring(0, 50) : (hasImage ? '[图片消息]' : '');
        console.log(`消息已添加到会话 ${this.currentSessionId} (${session.messages.length} 条):`,
            message.type, previewText);

        // 如果是第一条消息（手动新建会话保存后的第一条消息），刷新欢迎消息以隐藏保存按钮
        if (session.messages.length === 1) {
            // 异步刷新欢迎消息，避免阻塞
            setTimeout(async () => {
                try {
                    await this.refreshWelcomeMessage();
                } catch (error) {
                    console.warn('刷新欢迎消息失败:', error);
                }
            }, 100);
        }

        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // addMessageToSession 不再自动保存，保存逻辑由 prompt 接口调用后统一处理
    };

    // 调用 update_document 接口更新会话（用于消息发送后）
    proto.callUpdateDocument = async function (sessionId, newMessages = []) {
        if (!sessionId) {
            console.warn('没有会话 ID，无法调用 update_document');
            return;
        }

        try {
            // 获取当前会话数据
            const session = this.sessions[sessionId] || {};
            const existingMessages = Array.isArray(session.messages) ? session.messages : [];

            // 合并新消息到现有消息列表
            const updatedMessages = [...existingMessages, ...newMessages];

            const normalizeMessagesForBackend = (messages) => {
                const list = Array.isArray(messages) ? messages : [];
                return list.map((m) => {
                    const type = (m && m.type === 'pet') ? 'pet' : 'user';
                    const message = String(m?.message ?? m?.content ?? '').trim();
                    const timestamp = Number(m?.timestamp) || Date.now();
                    const imageDataUrls = Array.isArray(m?.imageDataUrls) ? m.imageDataUrls.filter(Boolean) : [];
                    const imageDataUrl = String(m?.imageDataUrl || '').trim();
                    const payload = {
                        type,
                        message,
                        timestamp
                    };
                    if (imageDataUrls.length > 0) {
                        payload.imageDataUrls = imageDataUrls;
                        payload.imageDataUrl = imageDataUrls[0];
                    } else if (imageDataUrl) {
                        payload.imageDataUrl = imageDataUrl;
                        payload.imageDataUrls = [imageDataUrl];
                    }
                    if (m?.error) payload.error = true;
                    if (m?.aborted) payload.aborted = true;
                    return payload;
                });
            };

            const sessionUrl = session.url || '';
            const pageDescription = session.pageDescription || '';
            const now = Date.now();

            const localSessionData = {
                key: sessionId,
                url: sessionUrl,
                title: session.title || '',
                pageDescription: pageDescription,
                messages: updatedMessages,
                tags: Array.isArray(session.tags) ? session.tags : [],
                isFavorite: session.isFavorite !== undefined ? Boolean(session.isFavorite) : false,
                createdAt: session.createdAt || now,
                updatedAt: now,
                lastAccessTime: now
            };

            // 更新本地会话数据
            if (!this.sessions[sessionId]) {
                this.sessions[sessionId] = {};
            }
            Object.assign(this.sessions[sessionId], localSessionData);

            // 调用 update_document 接口
            if (this.sessionApi && this.sessionApi.isEnabled()) {
                const isAicrSession = String(sessionUrl || '').startsWith('aicr-session://') || String(pageDescription || '').includes('文件：');
                const backendSessionData = {
                    key: sessionId,
                    url: sessionUrl,
                    title: localSessionData.title,
                    pageDescription: pageDescription,
                    messages: normalizeMessagesForBackend(updatedMessages),
                    tags: localSessionData.tags,
                    isFavorite: localSessionData.isFavorite,
                    createdAt: localSessionData.createdAt,
                    updatedAt: localSessionData.updatedAt,
                    lastAccessTime: localSessionData.lastAccessTime
                };
                if (!isAicrSession && session._isApiRequestSession && session.pageContent && String(session.pageContent).trim() !== '') {
                    backendSessionData.pageContent = String(session.pageContent || '');
                }

                const payload = {
                    module_name: 'services.database.data_service',
                    method_name: 'update_document',
                    parameters: {
                        cname: 'sessions',
                        key: sessionId,
                        data: backendSessionData
                    }
                };

                const apiUrl = this.sessionApi.baseUrl || (typeof PET_CONFIG !== 'undefined' ? PET_CONFIG.api.yiaiBaseUrl : '');
                const response = await fetch(`${apiUrl}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.getAuthHeaders ? this.getAuthHeaders() : {})
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                console.log('[callUpdateDocument] update_document 接口调用成功:', sessionId);
                return result;
            } else {
                console.warn('[callUpdateDocument] 会话 API 未启用，跳过 update_document 调用');
            }
        } catch (error) {
            console.error('[callUpdateDocument] 调用 update_document 接口失败:', error);
            throw error;
        }
    };

    proto.saveCurrentSession = async function (force = false, syncToBackend = true) {
        if (!this.currentSessionId) return;

        // 确保会话存在
        if (!this.sessions[this.currentSessionId]) {
            console.warn('会话不存在，无法保存:', this.currentSessionId);
            return;
        }

        const session = this.sessions[this.currentSessionId];

        // 获取当前页面信息（添加错误处理，避免在删除消息等操作时因 DOM 变化导致错误）
        let pageInfo = null;
        let isUrlMatched = false;
        try {
            pageInfo = this.getPageInfo();
            // 关键检查：只有当会话URL和当前页面URL匹配时，才允许更新页面信息
            // 这样可以确保切换到不同URL的会话时，不会互相影响数据
            isUrlMatched = session.url === pageInfo.url;
        } catch (error) {
            // 如果获取页面信息失败（例如在删除消息时 DOM 正在变化），使用会话中已有的信息
            console.warn('获取页面信息失败，使用会话中已有的信息', {
                error: String(error && error.message || error)
            });
            // 不更新页面信息，保持会话中已有的信息不变
            pageInfo = {
                url: session.url || window.location.href,
                title: session.title || document.title || '未命名页面',
                description: session.pageDescription || '',
                content: session.pageContent || ''
            };
            isUrlMatched = session.url === pageInfo.url;
        }

        // 如果聊天窗口已打开，同步消息记录（从DOM中提取，确保完整性）
        if (this.chatWindow) {
            const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages');
            if (messagesContainer) {
                // 获取所有消息元素
                const messageElements = Array.from(messagesContainer.children);
                const messages = [];

                for (const msgEl of messageElements) {
                    const userBubble = msgEl.querySelector('[data-message-type="user-bubble"]');
                    const petBubble = msgEl.querySelector('[data-message-type="pet-bubble"]');

                    if (userBubble) {
                        // 提取文本内容（优先使用 data-original-text，如果没有则使用 textContent）
                        const content = userBubble.getAttribute('data-original-text') || userBubble.textContent || '';

                        // 查找图片元素（如果有）
                        const imgElement = userBubble.querySelector('img');
                        const imageDataUrl = imgElement ? imgElement.src : null;

                        // 如果有文本内容或图片，则保存消息
                        if (content.trim() || imageDataUrl) {
                            const message = {
                                type: 'user',
                                content: content.trim() || '', // 即使为空字符串也保存
                                timestamp: this.getMessageTimestamp(msgEl)
                            };

                            // 如果有图片，添加到消息对象中
                            if (imageDataUrl) {
                                message.imageDataUrl = imageDataUrl;
                            }

                            messages.push(message);
                        }
                    } else if (petBubble) {
                        // 跳过欢迎消息（第一条宠物消息）
                        const isWelcome = msgEl.hasAttribute('data-welcome-message');
                        if (!isWelcome) {
                            // 提取内容... 这里可以继续完善，但核心逻辑已在 addMessageToSession 中处理
                            // 主要用于从 DOM 恢复消息
                        }
                    }
                }
                // 注意：这里没有覆盖 session.messages，因为 addMessageToSession 已经维护了
                // 只有在需要从 DOM 恢复时才使用
            }
        }

        // 实际保存逻辑
        await this.saveAllSessions(force, syncToBackend);
    };

    // 创建空白新会话（手动添加）
    /**
     * 生成 UUID v4 格式的 key（与 YiWeb 保持一致）
     */
    proto._generateUUID = function () {
        // 优先使用 crypto.randomUUID（如果可用）
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // 兜底方案：生成类似 UUID 的字符串
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    /**
     * 创建空白会话（与 YiWeb 的 handleSessionCreate 保持一致）
     */
    proto.createBlankSession = async function () {
        // 使用 prompt 获取会话名称（与 YiWeb 保持一致）
        const title = window.prompt('新建会话名称：');
        if (!title || !title.trim()) {
            return; // 用户取消或输入为空
        }

        let sessionTitle = title.trim();

        // 辅助函数：如果字符串不为空且没有 .md 后缀，则添加后缀
        const addMdSuffix = (str) => {
            if (!str || !str.trim()) return str;
            return str.trim().endsWith('.md') ? str.trim() : str.trim() + '.md';
        };

        // 为标题添加 .md 后缀
        sessionTitle = addMdSuffix(sessionTitle);

        // 确保已加载所有会话
        await this.loadAllSessions();

        // 生成 UUID 格式的会话 key（与 YiWeb 保持一致）
        const sessionKey = this._generateUUID();

        // 生成唯一的随机 URL（使用 aicr-session:// 协议，与 YiWeb 保持一致）
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 11);
        const uniqueUrl = `aicr-session://${timestamp}-${randomStr}`;

        // 获取当前时间戳
        const now = Date.now();

        // 构建会话数据（与 YiWeb 保持一致）
        const sessionData = {
            key: sessionKey,
            url: uniqueUrl,
            title: sessionTitle,
            pageDescription: '',
            pageContent: '',
            messages: [],
            tags: [],
            createdAt: now,
            updatedAt: now,
            lastAccessTime: now,
            isFavorite: false
        };

        // 生成一个唯一的会话ID（用于本地存储的key，基于URL）
        const sessionId = await this.generateSessionId(uniqueUrl);

        // 检查会话ID是否已存在，如果存在则重新生成
        let finalSessionId = sessionId;
        let attempts = 0;
        while (this.sessions[finalSessionId] && attempts < 10) {
            const newTimestamp = Date.now();
            const newRandomStr = Math.random().toString(36).substring(2, 11);
            const newUrl = `aicr-session://${newTimestamp}-${newRandomStr}`;
            finalSessionId = await this.generateSessionId(newUrl);
            sessionData.url = newUrl; // 更新会话数据中的URL
            attempts++;
        }

        try {
            // 调用 create_document 接口创建会话（与 YiWeb 保持一致）
            if (this.sessionApi && this.sessionApi.isEnabled()) {
                try {
                    const result = await this.sessionApi.saveSession(sessionData);
                    console.log('[createBlankSession] 会话已通过 create_document 创建:', sessionKey);
                } catch (error) {
                    console.error('[createBlankSession] 创建会话失败:', error);
                    this.showNotification('创建会话失败：' + (error.message || '未知错误'), 'error');
                    return;
                }
            } else {
                // 如果没有启用后端同步，只保存到本地
                console.log('[createBlankSession] 后端同步未启用，仅保存到本地');
            }

            // 保存到本地存储
            this.sessions[finalSessionId] = sessionData;
            await this.saveAllSessions(false, true);

            // 调用 write-file 接口创建实际文件（与 YiWeb 保持一致，即使 pageContent 为空也创建文件）
            if (typeof this.writeSessionPageContent === 'function') {
                try {
                    await this.writeSessionPageContent(finalSessionId);
                    console.log('[createBlankSession] 文件已通过 write-file 创建');
                } catch (writeError) {
                    // write-file 调用失败不影响保存流程，只记录警告
                    console.warn('[createBlankSession] write-file 接口调用失败（已忽略）:', writeError?.message);
                }
            }

            // 刷新会话列表（从后端获取最新数据，与 YiWeb 保持一致）
            if (this.sessionApi && this.sessionApi.isEnabled()) {
                try {
                    await this.loadSessionsFromBackend(true);
                } catch (refreshError) {
                    console.warn('[createBlankSession] 刷新会话列表失败（已忽略）:', refreshError?.message);
                }
            }

            // 确保新会话存在于本地 sessions 中
            // 如果 loadSessionsFromBackend 覆盖了 this.sessions 且没有包含新会话（可能是后端延迟），我们需要手动添加回去
            // 使用 UUID 作为键，与后端返回的数据格式保持一致
            if (!this.sessions[sessionKey]) {
                console.log('[createBlankSession] 新会话未在后端列表中返回，手动添加到本地列表:', sessionKey);
                this.sessions[sessionKey] = sessionData;
            }

            // 更新会话侧边栏
            await this.updateSessionSidebar(true);

            // 自动选中新创建的会话（与 YiWeb 保持一致）
            // 等待会话列表刷新完成
            await new Promise(resolve => setTimeout(resolve, 100));

            // 激活新会话
            // 此时 this.sessions[sessionKey] 肯定存在（要么是后端返回的，要么是手动添加的）
            await this.activateSession(sessionKey, {
                saveCurrent: false,
                updateConsistency: false,
                updateUI: true,
                syncToBackend: false,
                skipBackendFetch: false // 从后端获取最新数据
            });

            // 滚动到会话项位置（等待侧边栏更新完成）
            if (this.sessionSidebar && typeof this.scrollToSessionItem === 'function') {
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.scrollToSessionItem(sessionKey);
            }

            // 显示成功通知
            this.showNotification('会话创建成功', 'success');

            return finalSessionId;
        } catch (error) {
            console.error('[createBlankSession] 创建会话失败:', error);
            this.showNotification('创建会话失败：' + (error.message || '未知错误'), 'error');
            throw error;
        }
    };

    // 延迟初始化会话：等待页面加载完成后1秒再执行
    proto.initSessionWithDelay = async function () {
        // 使用标志防止重复执行
        if (this.sessionInitPending) {
            return;
        }
        this.sessionInitPending = true;

        // 检查页面是否已经加载完成
        const isPageLoaded = document.readyState === 'complete';

        if (isPageLoaded) {
            // 页面已经加载完成，延迟1秒后初始化会话
            console.log('页面已加载完成，等待1秒后初始化会话');
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.initSession();
        } else {
            // 页面尚未加载完成，等待加载完成后再延迟1秒
            console.log('等待页面加载完成，然后延迟1秒后初始化会话');
            const handleLoad = async () => {
                // 移除事件监听器，避免重复执行
                window.removeEventListener('load', handleLoad);

                // 延迟1秒后初始化会话
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.initSession();
            };

            // 监听页面完全加载完成事件（包括所有资源）
            window.addEventListener('load', handleLoad);
        }
    };

    /**
     * 检查当前会话是否已存在于后端会话列表中
     * @param {string} sessionId - 会话ID（可选，默认使用当前会话ID）
     * @returns {Promise<boolean>} 如果会话已存在于后端列表中返回true，否则返回false
     */
    proto.isSessionInBackendList = async function (sessionId = null) {
        const targetSessionId = sessionId || this.currentSessionId;
        if (!targetSessionId) {
            return false;
        }

        // 如果后端列表还没有加载，且聊天窗口已经打开过（不是页面刷新时），才尝试加载
        // 避免在页面刷新时自动调用后端接口
        if (this.sessionApi && !this.isChatWindowFirstOpen) {
            try {
                // 尝试从后端获取最新的会话列表
                const backendSessions = await this.sessionApi.getSessionsList({ forceRefresh: false });

                // 检查当前页面URL是否在会话列表中，如果是则调用详情接口
                const currentPageUrl = window.location.href;
                for (const backendSession of backendSessions) {
                    if (backendSession.url === currentPageUrl) {
                        const sessionKey = backendSession.key || backendSession.conversation_id;
                        if (sessionKey) {
                            console.log('当前页面URL在会话列表中，正在加载会话详情:', sessionKey);
                            try {
                                const sessionDetail = await this.sessionApi.getSession(sessionKey, true);
                                if (sessionDetail) {
                                    console.log('会话详情加载成功:', sessionKey);
                                    // 更新本地会话数据
                                    // 使用 URL 生成 sessionId 作为键
                                    const sessionUrl = backendSession.url || '';
                                    if (sessionUrl && this.sessions) {
                                        const sessionId = await this.generateSessionId(sessionUrl);
                                        const title = sessionDetail.title || '';
                                        // 确保保留原有的 key（如果后端返回的 key 不存在或无效）
                                        const existingKey = this.sessions[sessionId]?.key;
                                        if (this.sessions[sessionId]) {
                                            this.sessions[sessionId] = {
                                                ...this.sessions[sessionId],
                                                ...sessionDetail,
                                                // 确保 key 字段存在（使用 key 作为唯一标识符，与 YiWeb 保持一致）
                                                key: sessionDetail.key || existingKey || this._generateUUID(),
                                                title: title || this.sessions[sessionId].title || ''
                                            };
                                        }
                                    }
                                }
                            } catch (error) {
                                console.warn('加载会话详情失败:', error);
                            }
                        }
                        break; // 找到匹配的会话后退出循环
                    }
                }

            } catch (error) {
                console.warn('获取后端会话列表失败:', error);
                // 如果获取失败，返回false，显示保存按钮
                return false;
            }
        }

        // 检查会话ID是否在后端列表中（通过查询后端接口）
        // 由于已移除 backendSessionIds 集合，这里直接返回 false，让欢迎消息显示保存按钮
        // 实际的后端检查由其他机制处理
        return false;
    };

    // 手动刷新
    proto.manualRefresh = async function (btnElement) {
        console.log('[petManager] manualRefresh called');
        const refreshBtn = btnElement || document.getElementById('yi-pet-chat-refresh-btn');
        if (!refreshBtn) {
            console.warn('[petManager] Refresh button not found: yi-pet-chat-refresh-btn');
            return;
        }

        // 防止重复刷新
        if (refreshBtn.classList.contains('is-spinning')) {
            console.log('[petManager] Already refreshing');
            return;
        }

        refreshBtn.classList.add('is-spinning');
        try {
            console.log('[petManager] Starting refresh...');
            // 重新加载所有会话（强制从后端获取）
            await this.loadAllSessions();
            
            console.log('手动刷新完成');
            this.showNotification('刷新成功', 'success');
        } catch (error) {
            console.warn('手动刷新失败:', error);
            this.showNotification('刷新失败: ' + error.message, 'error');
        } finally {
            refreshBtn.classList.remove('is-spinning');
        }
    };

    // 从消息元素获取时间戳
    proto.getMessageTimestamp = function (msgEl) {
        const timeEl = msgEl.querySelector('[data-message-time="true"]');
        if (timeEl) {
            const timeText = timeEl.textContent.trim();
            // 尝试解析时间戳，如果无法解析则使用当前时间
            return Date.now();
        }
        return Date.now();
    };

    // 切换到指定会话（确保数据一致性）
    // 注意：手动切换会话时不调用 session/save 接口
    proto.switchSession = async function (sessionId) {
        // 防抖：如果正在切换或点击的是当前会话，直接返回
        if (this.isSwitchingSession || sessionId === this.currentSessionId) {
            return;
        }

        // 验证会话是否存在
        if (!this.sessions[sessionId]) {
            console.error('会话不存在:', sessionId);
            this.showNotification('会话不存在', 'error');
            return;
        }

        // 设置切换状态
        this.isSwitchingSession = true;

        // 获取UI元素引用
        const clickedItem = this.sessionSidebar?.querySelector(`[data-session-id="${sessionId}"]`);
        const previousActiveItem = this.sessionSidebar?.querySelector('.session-item.active');
        const messagesContainer = this.chatWindow?.querySelector('#yi-pet-chat-messages');

        // 显示加载状态
        if (clickedItem) {
            clickedItem.classList.add('switching');
            if (previousActiveItem && previousActiveItem !== clickedItem) {
                previousActiveItem.classList.remove('active');
            }
        }

        // 添加淡出效果
        if (messagesContainer && this.isChatOpen) {
            messagesContainer.classList.add('pet-is-fading');
        }

        try {
            // 使用统一的激活会话方法
            // 注意：saveCurrent设为false，手动切换会话时不保存当前会话
            // syncToBackend设为false，手动切换会话时不调用 session/save 接口
            // preserveOrder设为true，不更新 lastAccessTime 和 updatedAt，保持排列位置不变
            await this.activateSession(sessionId, {
                saveCurrent: false, // 手动切换会话时不保存，避免调用 session/save 接口
                updateConsistency: false, // 不更新一致性，避免修改会话数据
                updateUI: false, // 稍后手动更新UI以便添加过渡效果
                syncToBackend: false, // 手动切换会话时不同步到后端，避免调用 session/save 接口
                preserveOrder: true // 保持排列位置不变，不更新时间戳
            });

            // 调用 read-file 接口获取页面上下文（参考 YiWeb 的 selectSessionForChat）
            await this.fetchSessionPageContent(sessionId);

            // 更新侧边栏
            await new Promise(resolve => {
                requestAnimationFrame(async () => {
                    await this.updateSessionSidebar();
                    resolve();
                });
            });

            // 加载消息并添加淡入效果（确保消息正确恢复）
            if (this.chatWindow && this.isChatOpen) {
                // 先确保会话数据已加载
                if (!this.sessions[sessionId]) {
                    await this.loadAllSessions();
                }

                // 加载会话消息（确保消息与会话一一对应）
                await this.loadSessionMessages();

                // 更新聊天窗口标题（显示当前会话名称）
                this.updateChatHeaderTitle();

                // 验证消息是否已正确加载
                const loadedMessagesCount = messagesContainer?.querySelectorAll('[data-message-type="user-bubble"], [data-message-type="pet-bubble"]:not([data-welcome-message])').length || 0;
                const sessionMessagesCount = this.sessions[sessionId]?.messages?.length || 0;
                console.log(`会话切换完成，已加载 ${loadedMessagesCount} 条消息（会话中存储了 ${sessionMessagesCount} 条）`);

                requestAnimationFrame(() => {
                    if (messagesContainer) {
                        messagesContainer.classList.remove('pet-is-fading');
                    }
                });
            }
        } catch (error) {
            console.error('切换会话时出错:', error);

            // 恢复UI状态
            if (previousActiveItem) {
                previousActiveItem.classList.add('active');
            }
            if (clickedItem) {
                clickedItem.classList.remove('switching');
            }
            if (messagesContainer) {
                messagesContainer.classList.remove('pet-is-fading');
            }

            this.showNotification('切换会话失败，请重试', 'error');
            throw error;
        } finally {
            // 清除加载状态
            if (clickedItem) {
                clickedItem.classList.remove('switching');
            }
            this.isSwitchingSession = false;
        }
    };

    // 调用 write-file 接口写入页面上下文（参考 YiWeb 的 handleSessionCreate）
    proto.writeSessionPageContent = async function (sessionId) {
        // 只有在聊天对话框打开时才调用 write-file 接口
        if (!this.isChatOpen) {
            console.log('[writeSessionPageContent] 聊天对话框未打开，跳过 write-file 接口调用');
            return;
        }

        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('[writeSessionPageContent] 会话不存在:', sessionId);
            return;
        }

        // 获取 API 基础 URL（参考 YiWeb 的实现）
        const apiBase = (window.API_URL && /^https?:\/\//i.test(window.API_URL))
            ? String(window.API_URL).replace(/\/+$/, '')
            : (PET_CONFIG?.api?.yiaiBaseUrl || '');

        if (!apiBase) {
            console.warn('[writeSessionPageContent] API_URL 未配置，跳过 write-file 接口调用');
            return;
        }

        // 构建文件路径（参考 YiWeb 的 handleSessionCreate 和 read-file 的逻辑）
        let cleanPath = '';

        // 优先从会话的 tags 构建路径
        const tags = Array.isArray(session.tags) ? session.tags : [];
        let currentPath = '';
        tags.forEach((folderName) => {
            if (!folderName || (folderName.toLowerCase && folderName.toLowerCase() === 'default')) return;
            currentPath = currentPath ? currentPath + '/' + folderName : folderName;
        });

        // 使用 title 作为文件名
        let fileName = session.title || 'Untitled';
        fileName = String(fileName).replace(/\//g, '-'); // 清理文件名中的斜杠
        cleanPath = currentPath ? currentPath + '/' + fileName : fileName;
        cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');

        // 移除 static/ 前缀（如果有）
        if (cleanPath.startsWith('static/')) {
            cleanPath = cleanPath.substring(7);
        }
        cleanPath = cleanPath.replace(/^\/+/, '');

        // 如果 cleanPath 仍然为空，使用会话的 key 作为文件名（作为最后的备选方案）
        if (!cleanPath && session.key) {
            cleanPath = `session_${session.key}.txt`;
        }

        // 确保有路径后才调用接口
        if (!cleanPath) {
            console.warn('[writeSessionPageContent] 无法确定文件路径，跳过 write-file 接口调用');
            return;
        }

        // 获取页面上下文内容
        const pageContent = session.pageContent || '';

        try {
            console.log('[writeSessionPageContent] 调用 write-file 接口，路径:', cleanPath, '内容长度:', pageContent.length);
            const res = await fetch(`${apiBase}/write-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_file: cleanPath,
                    content: pageContent,
                    is_base64: false
                })
            });

            if (res.ok) {
                const json = await res.json();
                if (json.code === 0 || json.code === 200) {
                    console.log('[writeSessionPageContent] write-file 接口调用成功，文件路径:', cleanPath);

                    // 刷新会话列表（调用 query_document 接口）
                    if (typeof this.loadSessionsFromBackend === 'function') {
                        try {
                            await this.loadSessionsFromBackend(true);
                            console.log('[writeSessionPageContent] write-file 后刷新会话列表成功');
                        } catch (refreshError) {
                            console.warn('[writeSessionPageContent] write-file 后刷新会话列表失败:', refreshError);
                        }
                    }
                } else {
                    console.warn('[writeSessionPageContent] write-file 接口返回异常:', json);
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.warn('[writeSessionPageContent] write-file 接口调用失败，状态码:', res.status, errorData.message || '');
            }
        } catch (error) {
            console.warn('[writeSessionPageContent] write-file 接口调用异常（已忽略）:', error?.message);
            // 不阻止流程继续，因为会话已创建
        }
    };

    // 调用 read-file 接口获取页面上下文（参考 YiWeb 的 selectSessionForChat）
    proto.fetchSessionPageContent = async function (sessionId) {
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('[fetchSessionPageContent] 会话不存在:', sessionId);
            return;
        }

        // 获取 API 基础 URL（参考 YiWeb 的实现）
        const apiBase = (window.API_URL && /^https?:\/\//i.test(window.API_URL))
            ? String(window.API_URL).replace(/\/+$/, '')
            : (PET_CONFIG?.api?.yiaiBaseUrl || '');

        if (!apiBase) {
            console.warn('[fetchSessionPageContent] API_URL 未配置，跳过 read-file 接口调用');
            return;
        }

        // 构建文件路径（参考 YiWeb 的逻辑）
        let cleanPath = '';

        // 优先从会话的 tags 构建路径
        const tags = Array.isArray(session.tags) ? session.tags : [];
        let currentPath = '';
        tags.forEach((folderName) => {
            if (!folderName || (folderName.toLowerCase && folderName.toLowerCase() === 'default')) return;
            currentPath = currentPath ? currentPath + '/' + folderName : folderName;
        });

        let fileName = session.title || 'Untitled';
        fileName = String(fileName).replace(/\//g, '-');
        cleanPath = currentPath ? currentPath + '/' + fileName : fileName;
        cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
        if (cleanPath.startsWith('static/')) {
            cleanPath = cleanPath.substring(7);
        }
        cleanPath = cleanPath.replace(/^\/+/, '');

        // 如果 cleanPath 仍然为空，使用会话的 pageDescription 或其他信息
        if (!cleanPath) {
            const pageDesc = session.pageDescription || '';
            if (pageDesc && pageDesc.includes('文件：')) {
                cleanPath = pageDesc.replace('文件：', '').trim();
                cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
                if (cleanPath.startsWith('static/')) {
                    cleanPath = cleanPath.substring(7);
                }
                cleanPath = cleanPath.replace(/^\/+/, '');
            }
        }

        // 如果还是没有路径，使用会话的 key 作为文件名（作为最后的备选方案）
        if (!cleanPath && session.key) {
            cleanPath = `session_${session.key}.txt`;
        }

        // 确保有路径后才调用接口
        if (!cleanPath) {
            console.warn('[fetchSessionPageContent] 无法确定文件路径，跳过 read-file 接口调用');
            return;
        }

        try {
            console.log('[fetchSessionPageContent] 调用 read-file 接口，路径:', cleanPath);
            const res = await fetch(`${apiBase}/read-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_file: cleanPath })
            });

            if (res.ok) {
                const json = await res.json();
                if ((json.code === 200 || json.code === 0) && json.data && json.data.content) {
                    if (json.data.type !== 'base64') {
                        const staticContent = json.data.content;
                        console.log('[fetchSessionPageContent] read-file 接口调用成功，内容长度:', staticContent.length);

                        // 更新会话的 pageContent（不更新时间戳，保持排列位置不变）
                        if (session) {
                            session.pageContent = staticContent;
                            console.log('[fetchSessionPageContent] 已更新会话页面上下文');
                        }
                    } else {
                        console.log('[fetchSessionPageContent] read-file 接口返回 base64 类型，跳过');
                    }
                } else {
                    console.warn('[fetchSessionPageContent] read-file 接口返回异常:', json);
                }
            } else {
                console.warn('[fetchSessionPageContent] read-file 接口调用失败，状态码:', res.status);
            }
        } catch (error) {
            console.error('[fetchSessionPageContent] read-file 接口调用异常:', error);
        }
    };

    // 调用 delete-file 接口删除会话对应的文件
    proto.deleteSessionFile = async function (sessionId) {
        const session = this.sessions[sessionId];
        if (!session) {
            console.warn('[deleteSessionFile] 会话不存在:', sessionId);
            return;
        }

        // 获取 API 基础 URL（参考 YiWeb 的实现）
        const apiBase = (window.API_URL && /^https?:\/\//i.test(window.API_URL))
            ? String(window.API_URL).replace(/\/+$/, '')
            : ((typeof PET_CONFIG !== 'undefined' ? PET_CONFIG?.api?.yiaiBaseUrl : '') || '');

        if (!apiBase) {
            console.warn('[deleteSessionFile] API_URL 未配置，跳过 delete-file 接口调用');
            return;
        }

        // 构建文件路径（参考 writeSessionPageContent 的逻辑）
        let cleanPath = '';

        // 优先从会话的 tags 构建路径
        const tags = Array.isArray(session.tags) ? session.tags : [];
        let currentPath = '';
        tags.forEach((folderName) => {
            if (!folderName || (folderName.toLowerCase && folderName.toLowerCase() === 'default')) return;
            currentPath = currentPath ? currentPath + '/' + folderName : folderName;
        });

        // 使用 title 作为文件名
        let fileName = session.title || 'Untitled';
        fileName = String(fileName).replace(/\//g, '-'); // 清理文件名中的斜杠
        cleanPath = currentPath ? currentPath + '/' + fileName : fileName;
        cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');

        // 移除 static/ 前缀（如果有）
        if (cleanPath.startsWith('static/')) {
            cleanPath = cleanPath.substring(7);
        }
        cleanPath = cleanPath.replace(/^\/+/, '');

        // 如果 cleanPath 仍然为空，使用会话的 key 作为文件名（作为最后的备选方案）
        if (!cleanPath && session.key) {
            cleanPath = `session_${session.key}.txt`;
        }

        // 确保有路径后才调用接口
        if (!cleanPath) {
            console.warn('[deleteSessionFile] 无法确定文件路径，跳过 delete-file 接口调用');
            return;
        }

        try {
            console.log('[deleteSessionFile] 调用 delete-file 接口，路径:', cleanPath);
            const res = await fetch(`${apiBase}/delete-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_file: cleanPath
                })
            });

            if (res.ok) {
                const json = await res.json();
                if (json.code === 0 || json.code === 200) {
                    console.log('[deleteSessionFile] delete-file 接口调用成功，文件路径:', cleanPath);
                } else {
                    console.warn('[deleteSessionFile] delete-file 接口返回异常:', json);
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.warn('[deleteSessionFile] delete-file 接口调用失败，状态码:', res.status, errorData.message || '');
            }
        } catch (error) {
            console.warn('[deleteSessionFile] delete-file 接口调用异常（已忽略）:', error?.message);
        }
    };

    // 删除会话
    proto.deleteSession = async function (sessionId, skipConfirm = false) {
        if (!sessionId || !this.sessions[sessionId]) return;

        // 获取会话标题用于提示
        const session = this.sessions[sessionId];
        const sessionTitle = session?.title || sessionId || '未命名会话';

        // 确认删除（如果未跳过确认）
        if (!skipConfirm) {
            const confirmDelete = confirm(`确定要删除会话"${sessionTitle}"吗？`);
            if (!confirmDelete) return;
        }

        // 调用 delete-file 接口删除对应的文件
        if (typeof this.deleteSessionFile === 'function') {
            await this.deleteSessionFile(sessionId);
        }

        // 记录是否删除的是当前会话
        const isCurrentSession = sessionId === this.currentSessionId;

        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // 删除会话前不再自动保存当前会话

        // 从后端删除会话（如果启用了后端同步）
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
                // 使用 session.key 删除
                const sessionKey = session.key;
                if (sessionKey) {
                    await this.sessionApi.deleteSession(sessionKey);
                    console.log('会话已从后端删除:', sessionKey);
                } else {
                    console.warn('会话缺少 key，无法从后端删除:', sessionId);
                }
            } catch (error) {
                console.warn('从后端删除会话失败:', error);
                // 即使后端删除失败，也继续本地删除，确保用户界面响应
            }
        }



        // 从本地删除会话
        delete this.sessions[sessionId];
        // 注意：已移除自动保存会话功能，仅在 prompt 接口调用后保存
        // 删除操作通过后端API完成持久化

        // 删除会话后，重新从接口获取会话列表（强制刷新）
        if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
                await this.loadSessionsFromBackend(true);
                console.log('会话列表已从后端刷新');
            } catch (error) {
                console.warn('刷新会话列表失败:', error);
            }
        }

        // 如果删除的是当前会话，切换到其他会话或清空
        if (isCurrentSession) {
            // 查找最新的其他会话
            const otherSessions = Object.values(this.sessions);

            if (otherSessions.length > 0) {
                // 切换到最近访问的会话（使用 lastAccessTime，更符合"最新使用"的概念）
                // 如果没有 lastAccessTime，则使用 createdAt 作为备选
                const latestSession = otherSessions.sort((a, b) => {
                    const aTime = a.lastAccessTime || a.createdAt || 0;
                    const bTime = b.lastAccessTime || b.createdAt || 0;
                    return bTime - aTime; // 最近访问的在前
                })[0];

                // 使用 key 作为会话标识符
                const latestSessionKey = latestSession.key;
                if (!latestSessionKey) {
                    console.warn('最新会话缺少 key 字段，无法切换:', latestSession);
                    return;
                }
                await this.activateSession(latestSessionKey, {
                    saveCurrent: false, // 已经在前面保存了
                    updateUI: true,
                    syncToBackend: false // 删除会话后的自动切换不调用 session/save 接口
                });
            } else {
                // 没有其他会话，清空当前会话
                this.currentSessionId = null;
                this.hasAutoCreatedSessionForPage = false;

                // 清空消息显示
                if (this.chatWindow && this.isChatOpen) {
                    const messagesContainer = this.chatWindow.querySelector('#yi-pet-chat-messages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = '';
                    }
                }
            }
        }

        // 更新侧边栏
        await this.updateSessionUI({ updateSidebar: true });

        console.log('会话已删除:', sessionId);
    };

    // 创建会话副本
    proto.duplicateSession = async function (sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            this.showNotification('会话不存在', 'error');
            return;
        }

        let sourceSession = this.sessions[sessionId];

        try {
            // 如果有 sessionApi，先从后端获取源会话的完整数据（包括页面上下文）
            if (this.sessionApi) {
                try {
                    const fullSessionData = await this.sessionApi.getSession(sessionId);
                    if (fullSessionData) {
                        // 使用后端返回的完整数据，优先使用后端的 pageContent
                        sourceSession = {
                            ...sourceSession,
                            ...fullSessionData,
                            // 确保 pageContent 使用后端返回的值（如果存在）
                            pageContent: fullSessionData.pageContent !== undefined ? fullSessionData.pageContent : sourceSession.pageContent
                        };
                        console.log('已从后端获取源会话完整数据，包含页面上下文');
                    }
                } catch (error) {
                    console.warn('从后端获取源会话详情失败，使用本地数据:', error);
                    // 如果获取失败，继续使用本地数据
                }
            }

            // 生成新的会话ID（基于时间戳和随机数）
            const newSessionId = await this.generateSessionId(`duplicate_${Date.now()}_${Math.random()}`);

            // 生成新的URL（添加副本标识）
            const newUrl = sourceSession.url ? `${sourceSession.url}#duplicate_${Date.now()}` : '';

            // 创建会话副本，复制所有数据，但messages为空数组
            const now = Date.now();
            const duplicatedSession = {
                key: this._generateUUID(), // 生成新的 UUID key
                url: newUrl,
                title: (() => {
                    const base = sourceSession.title || '新会话.md';
                    const s = String(base || '').trim();
                    if (!s) return '新会话 (副本).md';
                    if (s.endsWith('.md')) {
                        return `${s.slice(0, -3)} (副本).md`;
                    }
                    return `${s} (副本)`;
                })(),
                pageDescription: sourceSession.pageDescription || '',
                pageContent: sourceSession.pageContent || '',
                messages: [], // messages为空数组
                tags: sourceSession.tags ? [...sourceSession.tags] : [],
                isFavorite: sourceSession.isFavorite !== undefined ? sourceSession.isFavorite : false,
                createdAt: now,
                updatedAt: now,
                lastAccessTime: now
            };

            // 直接调用接口保存副本（只在聊天窗口打开时）
            if (this.isChatOpen && this.sessionApi) {
                try {
                    await this.sessionApi.saveSession(duplicatedSession);
                    console.log('会话副本已保存到后端:', newSessionId);

                    // 立即将副本添加到本地sessions，确保即使后端加载失败也能显示
                    this.sessions[newSessionId] = duplicatedSession;

                    // 保存后更新会话列表（从后端重新加载）
                    if (PET_CONFIG.api.syncSessionsToBackend && this.isChatOpen) {
                        try {
                            await this.loadSessionsFromBackend(true);
                        } catch (loadError) {
                            console.warn('从后端加载会话列表失败，使用本地数据:', loadError);
                            // 不进行本地缓存，仅更新UI
                        }
                    } else {
                        // 如果没有启用后端同步，也不进行本地缓存
                    }

                    // 刷新侧边栏UI
                    await this.updateSessionUI({ updateSidebar: true });

                    this.showNotification('会话副本已创建', 'success');
                } catch (error) {
                    console.error('保存会话副本到后端失败:', error);
                    this.showNotification('创建副本失败: ' + error.message, 'error');
                }
            } else {
                // 如果没有sessionApi，仅更新本地内存
                this.sessions[newSessionId] = duplicatedSession;

                // 更新侧边栏
                await this.updateSessionUI({ updateSidebar: true });

                this.showNotification('会话副本已创建', 'success');
            }
        } catch (error) {
            console.error('创建会话副本失败:', error);
            this.showNotification('创建副本失败: ' + error.message, 'error');
        }
    };

    // 格式化会话时间（使用 TimeUtils.formatRelativeTime）
    proto.formatSessionTime = function (timestamp) {
        if (typeof TimeUtils !== 'undefined' && typeof TimeUtils.formatRelativeTime === 'function') {
            return TimeUtils.formatRelativeTime(timestamp);
        }
        // 降级实现
        if (!timestamp) return '';
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return new Date(timestamp).toLocaleDateString('zh-CN');
    };

    // 编辑会话标题和描述
    proto.editSessionTitle = async function (sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法编辑标题:', sessionId);
            return;
        }

        const session = this.sessions[sessionId];
        const originalTitle = session.title || '未命名会话';
        const originalDescription = session.pageDescription || '';

        // 打开编辑对话框
        if (typeof this.openSessionInfoEditor === 'function') {
            this.openSessionInfoEditor(sessionId, originalTitle, originalDescription);
        } else {
            console.error('openSessionInfoEditor 方法不存在，请确保 petManager.sessionEditor.js 已正确加载');
            if (typeof this.showNotification === 'function') {
                this.showNotification('编辑功能不可用：编辑器模块未加载', 'error');
            }
        }
    };

    // 切换会话收藏状态
    proto.toggleSessionFavorite = async function (sessionId) {
        if (!sessionId || !this.sessions[sessionId]) {
            console.warn('会话不存在，无法切换收藏状态:', sessionId);
            return;
        }

        const session = this.sessions[sessionId];
        const currentFavorite = session.isFavorite || false;
        session.isFavorite = !currentFavorite;
        session.updatedAt = Date.now();

        // 同步到后端（只在聊天窗口打开时）
        if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            try {
                await this.syncSessionToBackend(sessionId, true);
                console.log(`会话 ${sessionId} 收藏状态已更新: ${session.isFavorite}`);
            } catch (error) {
                console.warn('同步收藏状态到后端失败:', error);
            }
        }

        // 更新侧边栏显示
        if (this.sessionSidebar) {
            await this.updateSessionSidebar();
        }
    };

})();
