(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 加载JSZip库（参考loadMermaid的方式）
    proto._loadJSZip = async function() {
        // 检查是否已经加载
        if (this.jszipLoaded || this.jszipLoading) {
            return this.jszipLoaded;
        }

        this.jszipLoading = true;

        return new Promise((resolve, reject) => {
            // 检查是否已经在页面上下文中加载
            const checkLoaded = () => {
                return window.__JSZIP_LOADED__ || window.__JSZIP_READY__;
            };

            if (checkLoaded()) {
                this.jszipLoaded = true;
                this.jszipLoading = false;
                console.log('JSZip已在页面上下文中加载');
                resolve(true);
                return;
            }

            // 检查扩展上下文是否有效
            let scriptUrl, loadScriptUrl;
            try {
                // 检查 chrome 对象和 runtime 是否存在
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    throw new Error('扩展上下文无效：chrome.runtime 不可用');
                }

                // 直接尝试获取脚本 URL（不先检查 runtime.id，因为 getURL 更可靠）
                try {
                    scriptUrl = chrome.runtime.getURL('src/libs/jszip.min.js');
                    loadScriptUrl = chrome.runtime.getURL('src/features/session/load-jszip.js');

                    // 验证 URL 是否有效
                    if (!scriptUrl || !loadScriptUrl) {
                        throw new Error('扩展上下文无效：无法获取脚本 URL');
                    }
                } catch (getUrlError) {
                    const errorMsg = (getUrlError.message || getUrlError.toString() || '').toLowerCase();
                    if (errorMsg.includes('extension context invalidated') ||
                        errorMsg.includes('context invalidated') ||
                        errorMsg.includes('could not establish connection')) {
                        const contextError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                            ? PET_CONFIG.constants.ERROR_MESSAGES.CONTEXT_INVALIDATED 
                            : '扩展上下文已失效';
                        throw new Error(contextError);
                    }
                    throw new Error('扩展上下文无效：无法获取脚本 URL');
                }
            } catch (error) {
                this.jszipLoading = false;
                const errorMsg = error.message || '扩展上下文无效';
                console.error('获取JSZip脚本URL失败:', error);
                reject(new Error(errorMsg));
                return;
            }

            console.log('尝试在页面上下文中加载 JSZip.js，URL:', scriptUrl);

            // 通过 data 属性传递 URL（避免内联脚本）
            const urlContainer = document.createElement('div');
            urlContainer.id = '__jszip_url_container__';
            urlContainer.style.display = 'none';
            urlContainer.setAttribute('data-jszip-url', scriptUrl);
            (document.head || document.documentElement).appendChild(urlContainer);

            // 加载外部脚本文件（避免 CSP 限制）
            const injectedScript = document.createElement('script');
            injectedScript.src = loadScriptUrl;
            injectedScript.charset = 'UTF-8';
            injectedScript.async = false;

            // 监听页面中的 JSZip 加载事件（在脚本加载前设置）
            const handleJSZipLoaded = () => {
                console.log('[Content] 收到 JSZip 加载完成事件');
                this.jszipLoaded = true;
                this.jszipLoading = false;
                console.log('[Content] JSZip.js 在页面上下文中已加载');
                window.removeEventListener('jszip-loaded', handleJSZipLoaded);
                window.removeEventListener('jszip-error', handleJSZipError);
                resolve(true);
            };

            const handleJSZipError = (event) => {
                console.error('[Content] 收到 JSZip 加载失败事件', event);
                this.jszipLoading = false;
                window.removeEventListener('jszip-loaded', handleJSZipLoaded);
                window.removeEventListener('jszip-error', handleJSZipError);
                const errorMsg = event && event.detail && event.detail.error ? event.detail.error : '页面上下文中的 JSZip.js 加载失败';
                reject(new Error(errorMsg));
            };

            // 监听页面事件（通过注入的事件监听器）
            window.addEventListener('jszip-loaded', handleJSZipLoaded);
            window.addEventListener('jszip-error', handleJSZipError);

            // 注入脚本到页面上下文
            (document.head || document.documentElement).appendChild(injectedScript);

            // 清理注入的脚本
            setTimeout(() => {
                if (injectedScript.parentNode) {
                    injectedScript.parentNode.removeChild(injectedScript);
                }
            }, 1000);
        });
    };

    // 根据标签和标题查找会话
    proto._findSessionByTagsAndTitle = function(tags, title) {
        const allSessions = this._getSessionsFromLocal();

        // 将标签数组转换为字符串用于比较（排序后比较，确保顺序一致）
        const normalizedTags = [...tags].sort().join(',');

        for (const session of allSessions) {
            const sessionTags = session.tags || [];
            const sessionNormalizedTags = [...sessionTags].sort().join(',');

            // 比较标签和标题
            if (sessionNormalizedTags === normalizedTags &&
                session.pageTitle === title) {
                return session;
            }
        }

        return null;
    };

    // 导入会话从ZIP文件
    proto.importSessionsFromZip = async function(file) {
        try {
            // 显示加载提示
            this.showNotification('正在准备导入...', 'info');

            // 加载JSZip库（在页面上下文中）
            await this._loadJSZip();

            // 读取文件为base64
            const fileReader = new FileReader();
            const fileData = await new Promise((resolve, reject) => {
                fileReader.onload = (e) => resolve(e.target.result);
                fileReader.onerror = (e) => reject(new Error('读取文件失败'));
                fileReader.readAsDataURL(file);
            });

            // 提取base64数据（去掉data:application/zip;base64,前缀）
            const base64Data = fileData.split(',')[1];

            if (!base64Data) {
                throw new Error('无法读取文件数据');
            }

            // 在页面上下文中执行导入逻辑
            this.showNotification('正在解析ZIP文件...', 'info');

            // 根据文件大小动态计算超时时间（最小5分钟，每MB增加1分钟，最大30分钟）
            const fileSizeMB = file.size / (1024 * 1024);
            const baseTimeout = 5 * 60 * 1000; // 5分钟基础超时
            const sizeBasedTimeout = Math.min(fileSizeMB * 60 * 1000, 25 * 60 * 1000); // 每MB增加1分钟，最多25分钟
            const timeoutDuration = Math.max(baseTimeout + sizeBasedTimeout, 5 * 60 * 1000); // 最少5分钟
            const maxTimeout = 30 * 60 * 1000; // 最多30分钟
            const finalTimeout = Math.min(timeoutDuration, maxTimeout);

            console.log(`导入超时时间设置为: ${Math.round(finalTimeout / 1000)}秒 (文件大小: ${fileSizeMB.toFixed(2)}MB)`);

            // 检查扩展上下文是否有效
            let importScriptUrl;
            try {
                // 检查 chrome 对象和 runtime 是否存在
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    throw new Error('扩展上下文无效：chrome.runtime 不可用');
                }

                // 直接尝试获取脚本 URL（不先检查 runtime.id，因为 getURL 更可靠）
                try {
                    importScriptUrl = chrome.runtime.getURL('src/features/session/import-sessions.js');

                    // 验证 URL 是否有效
                    if (!importScriptUrl) {
                        throw new Error('扩展上下文无效：无法获取脚本 URL');
                    }
                } catch (getUrlError) {
                    const errorMsg = (getUrlError.message || getUrlError.toString() || '').toLowerCase();
                    if (errorMsg.includes('extension context invalidated') ||
                        errorMsg.includes('context invalidated') ||
                        errorMsg.includes('could not establish connection')) {
                        const contextError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                            ? PET_CONFIG.constants.ERROR_MESSAGES.CONTEXT_INVALIDATED 
                            : '扩展上下文已失效';
                        throw new Error(contextError);
                    }
                    throw new Error('扩展上下文无效：无法获取脚本 URL');
                }
            } catch (error) {
                const errorMsg = error.message || '扩展上下文无效';
                console.error('获取导入脚本URL失败:', error);
                const importError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED 
                    : '导入失败';
                this.showNotification(`${importError}: ${errorMsg}`, 'error');
                throw new Error(errorMsg);
            }

            return new Promise((resolve, reject) => {
                // 创建数据容器
                const dataContainer = document.createElement('div');
                dataContainer.id = '__jszip_import_data__';
                dataContainer.style.display = 'none';
                dataContainer.setAttribute('data-import', base64Data);
                (document.head || document.documentElement).appendChild(dataContainer);

                // 加载外部导入脚本
                const importScript = document.createElement('script');
                importScript.src = importScriptUrl;
                importScript.charset = 'UTF-8';
                importScript.async = false;

                // 超时定时器引用
                let timeoutTimer = null;

                // 清理函数
                const cleanup = () => {
                    if (timeoutTimer) {
                        clearTimeout(timeoutTimer);
                        timeoutTimer = null;
                    }
                    window.removeEventListener('jszip-import-success', handleSuccess);
                    window.removeEventListener('jszip-import-error', handleError);

                    // 清理DOM元素
                    if (importScript.parentNode) {
                        importScript.parentNode.removeChild(importScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                };

                // 监听导入结果
                const handleSuccess = async (event) => {
                    cleanup();

                    try {
                        const importData = event.detail.importData;
                        if (!importData || importData.length === 0) {
                            throw new Error('没有找到可导入的会话');
                        }

                        this.showNotification(`正在导入 ${importData.length} 个会话...`, 'info');

                        // 处理每个导入的会话
                        let createdCount = 0;
                        let updatedCount = 0;
                        let errorCount = 0;
                        // 记录已处理的会话ID，用于后续同步
                        const processedSessionIds = [];

                        for (let i = 0; i < importData.length; i++) {
                            const item = importData[i];
                            let processedSessionId = null;

                            try {
                                // 解析markdown内容
                                const parsed = this._parseMarkdownContent(item.pageContent);

                                // 使用导入的标签（如果markdown中没有标签，使用目录结构中的标签）
                                let tags = parsed.tags.length > 0 ? parsed.tags : item.tags;

                                // 过滤掉"未分类"标签，根目录和"未分类"目录不需要创建标签
                                tags = tags.filter(tag => tag !== '未分类');

                                // 使用导入的标题（如果markdown中没有标题，使用文件名）
                                const title = parsed.pageTitle || item.title;

                                // 查找是否存在相同的会话（根据标签和标题）
                                const existingSession = this._findSessionByTagsAndTitle(tags, title);

                                if (existingSession) {
                                    // 更新现有会话
                                    const sessionId = existingSession.id;
                                    const session = this.sessions[sessionId];

                                    if (session) {
                                        // 更新会话信息
                                        session.pageTitle = title;
                                        session.pageDescription = parsed.pageDescription || session.pageDescription || '';
                                        // 用新文件里面的内容覆盖原来会话的页面上下文内容
                                        session.pageContent = parsed.pageContent || item.pageContent || '';
                                        session.tags = tags;

                                        // 生成唯一的随机URL（参考手动创建会话的方式）
                                        if (!parsed.url && !session.url) {
                                            const timestamp = Date.now();
                                            const randomStr = Math.random().toString(36).substring(2, 11); // 9位随机字符串
                                            let uniqueUrl = `import-session://${timestamp}-${randomStr}`;

                                            // 确保URL唯一：检查是否已存在相同URL的会话
                                            let urlAttempts = 0;
                                            while (Object.values(this.sessions).some(s => s && s.url === uniqueUrl) && urlAttempts < 10) {
                                                const newTimestamp = Date.now();
                                                const newRandomStr = Math.random().toString(36).substring(2, 11);
                                                uniqueUrl = `import-session://${newTimestamp}-${newRandomStr}`;
                                                urlAttempts++;
                                            }
                                            session.url = uniqueUrl;
                                        } else {
                                            session.url = parsed.url || session.url;
                                        }

                                        // 更新消息（如果导入的内容中有消息）
                                        if (parsed.messages && parsed.messages.length > 0) {
                                            session.messages = parsed.messages.map(msg => ({
                                                type: msg.type,
                                                content: msg.content,
                                                timestamp: msg.timestamp || Date.now()
                                            }));
                                        }

                                        session.updatedAt = parsed.updatedAt || Date.now();

                                        // 确保会话ID正确设置
                                        if (!session.id) {
                                            session.id = sessionId;
                                        }

                                        // 确保更新后的会话被保存到 this.sessions
                                        this.sessions[sessionId] = session;

                                        // 记录已处理的会话ID
                                        processedSessionId = sessionId;

                                        updatedCount++;
                                    }
                                } else {
                                    // 创建新会话
                                    // 生成唯一的会话ID（使用标题和标签生成唯一标识）
                                    const tagsStr = tags.length > 0 ? tags.join('_') : 'no_tags';
                                    const uniqueId = `import_${title}_${tagsStr}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                                    const sessionId = await this.generateSessionId(uniqueId);

                                    // 检查会话ID是否已存在，如果存在则重新生成
                                    let finalSessionId = sessionId;
                                    let attempts = 0;
                                    while (this.sessions[finalSessionId] && attempts < 10) {
                                        const newTagsStr = tags.length > 0 ? tags.join('_') : 'no_tags';
                                        const newUniqueId = `import_${title}_${newTagsStr}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                                        finalSessionId = await this.generateSessionId(newUniqueId);
                                        attempts++;
                                    }

                                    // 生成唯一的随机URL（参考手动创建会话的方式）
                                    let uniqueUrl;
                                    if (!parsed.url) {
                                        const timestamp = Date.now();
                                        const randomStr = Math.random().toString(36).substring(2, 11); // 9位随机字符串
                                        uniqueUrl = `import-session://${timestamp}-${randomStr}`;

                                        // 确保URL唯一：检查是否已存在相同URL的会话
                                        let urlAttempts = 0;
                                        while (Object.values(this.sessions).some(s => s && s.url === uniqueUrl) && urlAttempts < 10) {
                                            const newTimestamp = Date.now();
                                            const newRandomStr = Math.random().toString(36).substring(2, 11);
                                            uniqueUrl = `import-session://${newTimestamp}-${newRandomStr}`;
                                            urlAttempts++;
                                        }
                                    } else {
                                        uniqueUrl = parsed.url;
                                    }

                                    const pageInfo = {
                                        url: uniqueUrl,
                                        title: title,
                                        pageTitle: title,
                                        description: parsed.pageDescription || '',
                                        pageDescription: parsed.pageDescription || '',
                                        // 优先使用解析出的页面内容，如果没有则使用原始导入内容
                                        content: parsed.pageContent || item.pageContent || '',
                                        pageContent: parsed.pageContent || item.pageContent || ''
                                    };

                                    // 使用createSessionObject创建会话对象
                                    const newSession = this.createSessionObject(pageInfo);
                                    newSession.tags = tags;

                                    // 更新消息（如果导入的内容中有消息）
                                    if (parsed.messages && parsed.messages.length > 0) {
                                        newSession.messages = parsed.messages.map(msg => ({
                                            type: msg.type,
                                            content: msg.content,
                                            timestamp: msg.timestamp || Date.now()
                                        }));
                                    }

                                    newSession.createdAt = parsed.createdAt || Date.now();
                                    newSession.updatedAt = parsed.updatedAt || Date.now();

                                    this.sessions[finalSessionId] = newSession;

                                    // 记录已处理的会话ID
                                    processedSessionId = finalSessionId;

                                    createdCount++;
                                }

                                if (processedSessionId) {
                                    processedSessionIds.push(processedSessionId);
                                }
                            } catch (e) {
                                console.error(`处理导入项失败: ${item.title}`, e);
                                errorCount++;
                            }
                        }

                        // 不进行本地缓存

                        // 强制更新UI
                        await this.updateSessionUI({
                            updateSidebar: true,
                            updateTitle: true
                        });

                        // 显示结果通知
                        const resultMsg = `导入完成: 新增 ${createdCount} 个, 更新 ${updatedCount} 个, 失败 ${errorCount} 个`;
                        this.showNotification(resultMsg, errorCount > 0 ? 'warning' : 'success');

                        // 2秒后重新加载会话列表，确保显示最新数据
                        setTimeout(async () => {
                            if (this.isChatOpen) {
                                await this.loadAllSessions();
                            }
                            await this.updateSessionUI({ updateSidebar: true });
                        }, 2000);

                    } catch (error) {
                        this.showNotification('导入处理失败: ' + error.message, 'error');
                        console.error('导入处理错误:', error);
                    }
                };

                const handleError = (event) => {
                    cleanup();
                    const errorMsg = event && event.detail && event.detail.error ? event.detail.error : 'ZIP文件解析失败';
                    this.showNotification('导入失败: ' + errorMsg, 'error');
                };

                // 监听页面事件
                window.addEventListener('jszip-import-success', handleSuccess);
                window.addEventListener('jszip-import-error', handleError);

                // 设置超时
                timeoutTimer = setTimeout(() => {
                    cleanup();
                    this.showNotification('导入超时，请重试', 'error');
                }, finalTimeout);

                // 注入脚本到页面上下文
                (document.head || document.documentElement).appendChild(importScript);

            });

        } catch (error) {
            console.error('导入ZIP文件失败:', error);
            this.showNotification('导入失败: ' + error.message, 'error');
        }
    };

    // 导出会话为ZIP文件（使用页面上下文中的JSZip）
    proto.exportSessionsToZip = async function() {
        try {
            // 显示加载提示
            this.showNotification('正在准备导出...', 'info');

            // 加载JSZip库（在页面上下文中）
            await this._loadJSZip();

            // 判断当前视图模式
            const sessionList = this.sessionSidebar?.querySelector('.session-list');

            // 总是导出普通会话列表
            let sessions = [];
            // Check if _getFilteredSessions exists, otherwise fallback to local sessions
            if (typeof this._getFilteredSessions === 'function') {
                sessions = this._getFilteredSessions();
            } else {
                sessions = this._getSessionsFromLocal();
            }

            if (sessions.length === 0) {
                this.showNotification('没有可导出的会话', 'error');
                return;
            }

            // 显示进度提示
            this.showNotification(`正在获取 ${sessions.length} 个会话的完整数据...`, 'info');

            // 遍历每个会话，从后端API获取完整数据（包括页面上下文和聊天消息）
            const exportData = [];
            for (let i = 0; i < sessions.length; i++) {
                const session = sessions[i];
                const sessionId = session.id || session.session_id;

                let fullSessionData = session; // 默认使用本地数据

                // 如果启用了后端同步，尝试从后端获取完整的会话数据
                if (sessionId && this.sessionApi && this.sessionApi.isEnabled()) {
                    try {
                        // 强制刷新，获取最新的完整会话数据
                        const backendSession = await this.sessionApi.getSession(sessionId, true);

                        if (backendSession) {
                            // 合并数据：后端数据优先，但保留本地数据中可能缺失的字段
                            fullSessionData = {
                                ...session, // 先使用本地数据
                                ...backendSession, // 后端数据覆盖（包含完整的 pageContent 和 messages）
                                id: sessionId, // 确保 ID 一致
                            };
                            console.log(`已从后端获取会话 ${sessionId} 的完整数据`);
                        }
                    } catch (error) {
                        console.warn(`获取会话 ${sessionId} 的完整数据失败，使用本地数据:`, error.message);
                        // 如果获取失败，继续使用本地数据
                    }
                }

                // 生成导出数据
                const timestamp = fullSessionData.updatedAt || fullSessionData.createdAt || Date.now();
                const title = this._sanitizeFileName(fullSessionData.pageTitle || '未命名会话');
                const tags = fullSessionData.tags || [];

                // 生成页面上下文内容（合并 context 和 chat）
                const contextMd = this._generateContextMd(fullSessionData);
                const chatMd = this._generateChatMd(fullSessionData);
                const pageContent = contextMd + '\n\n' + chatMd;

                exportData.push({
                    tags: tags,
                    title: title,
                    pageContent: pageContent
                });

                // 更新进度提示（每10个会话更新一次）
                if ((i + 1) % 10 === 0 || (i + 1) === sessions.length) {
                    this.showNotification(`已处理 ${i + 1}/${sessions.length} 个会话...`, 'info');
                }
            }

            // 在页面上下文中执行导出逻辑
            this.showNotification('正在生成ZIP文件...', 'info');

            // 检查扩展上下文是否有效
            let exportScriptUrl;
            try {
                // 检查 chrome 对象和 runtime 是否存在
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    throw new Error('扩展上下文无效：chrome.runtime 不可用');
                }

                // 直接尝试获取脚本 URL（不先检查 runtime.id，因为 getURL 更可靠）
                try {
                    exportScriptUrl = chrome.runtime.getURL('src/features/session/export-sessions.js');

                    // 验证 URL 是否有效
                    if (!exportScriptUrl) {
                        throw new Error('扩展上下文无效：无法获取脚本 URL');
                    }
                } catch (getUrlError) {
                    const errorMsg = (getUrlError.message || getUrlError.toString() || '').toLowerCase();
                    if (errorMsg.includes('extension context invalidated') ||
                        errorMsg.includes('context invalidated') ||
                        errorMsg.includes('could not establish connection')) {
                        const contextError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                            ? PET_CONFIG.constants.ERROR_MESSAGES.CONTEXT_INVALIDATED 
                            : '扩展上下文已失效';
                        throw new Error(contextError);
                    }
                    throw new Error('扩展上下文无效：无法获取脚本 URL');
                }
            } catch (error) {
                const errorMsg = error.message || '扩展上下文无效';
                console.error('获取导出脚本URL失败:', error);
                const exportError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                    ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED 
                    : '导出失败';
                this.showNotification(`${exportError}: ${errorMsg}`, 'error');
                throw new Error(errorMsg);
            }

            // 使用注入外部脚本的方式（避免CSP限制）
            return new Promise((resolve, reject) => {
                // 创建数据容器（通过data属性传递数据，避免内联脚本）
                const dataContainer = document.createElement('div');
                dataContainer.id = '__jszip_export_data__';
                dataContainer.style.display = 'none';
                dataContainer.setAttribute('data-export', JSON.stringify(exportData));
                dataContainer.setAttribute('data-export-type', 'session');
                (document.head || document.documentElement).appendChild(dataContainer);

                // 加载外部导出脚本
                const exportScript = document.createElement('script');
                exportScript.src = exportScriptUrl;
                exportScript.charset = 'UTF-8';
                exportScript.async = false;

                // 监听导出结果
                const handleSuccess = (event) => {
                    window.removeEventListener('jszip-export-success', handleSuccess);
                    window.removeEventListener('jszip-export-error', handleError);
                    // 清理
                    if (exportScript.parentNode) {
                        exportScript.parentNode.removeChild(exportScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                    this.showNotification(`成功导出 ${event.detail.count} 个会话`, 'success');
                    resolve();
                };

                const handleError = (event) => {
                    window.removeEventListener('jszip-export-success', handleSuccess);
                    window.removeEventListener('jszip-export-error', handleError);
                    // 清理
                    if (exportScript.parentNode) {
                        exportScript.parentNode.removeChild(exportScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                    const errorMsg = event.detail && event.detail.error ? event.detail.error : '导出失败';
                    reject(new Error(errorMsg));
                };

                window.addEventListener('jszip-export-success', handleSuccess);
                window.addEventListener('jszip-export-error', handleError);

                // 注入脚本
                (document.head || document.documentElement).appendChild(exportScript);

                // 设置超时
                setTimeout(() => {
                    window.removeEventListener('jszip-export-success', handleSuccess);
                    window.removeEventListener('jszip-export-error', handleError);
                    if (exportScript.parentNode) {
                        exportScript.parentNode.removeChild(exportScript);
                    }
                    if (dataContainer.parentNode) {
                        dataContainer.parentNode.removeChild(dataContainer);
                    }
                    reject(new Error('导出超时'));
                }, 30000);
            });
        } catch (error) {
            console.error('导出会话失败:', error);
            throw error;
        }
    };

})();
