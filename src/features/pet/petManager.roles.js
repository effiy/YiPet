(function(global) {
    const proto = global.PetManager.prototype;

    // 获取角色图标（优先自定义，其次从角色配置列表中查找）
    proto.getRoleIcon = function(roleConfig, allConfigs = null) {
        if (!roleConfig) return '🙂';

        // 优先使用配置中的自定义图标
        if (roleConfig.icon && typeof roleConfig.icon === 'string') {
            const icon = roleConfig.icon.trim();
            if (icon) return icon;
        }

        // 如果没有自定义图标，从角色配置列表中查找
        const actionKey = roleConfig.actionKey;
        if (actionKey && allConfigs && Array.isArray(allConfigs)) {
            const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey);
            if (foundConfig && foundConfig.icon && typeof foundConfig.icon === 'string') {
                const icon = foundConfig.icon.trim();
                if (icon) return icon;
            }
        }

        // 如果还是找不到，使用默认映射
        const defaultIcons = {
            'summary': '📝',
            'mindmap': '🧠',
            'flashcard': '🎴',
            'report': '📊',
            'bestPractice': '💡'
        };
        if (actionKey && defaultIcons[actionKey]) {
            return defaultIcons[actionKey];
        }

        return '🙂';
    };

    // 统一获取角色标签/名称（优先自定义，其次从角色配置列表中查找）
    proto.getRoleLabel = function(roleConfig, allConfigs = null) {
        if (!roleConfig) return '自定义角色';

        // 优先使用配置中的自定义标签
        if (roleConfig.label && typeof roleConfig.label === 'string') {
            const label = roleConfig.label.trim();
            if (label) return label;
        }

        // 如果没有自定义标签，从角色配置列表中查找
        const actionKey = roleConfig.actionKey;
        if (actionKey && allConfigs && Array.isArray(allConfigs)) {
            const foundConfig = allConfigs.find(c => c && c.actionKey === actionKey);
            if (foundConfig && foundConfig.label && typeof foundConfig.label === 'string') {
                const label = foundConfig.label.trim();
                if (label) return label;
            }
        }

        // 如果还是找不到，使用actionKey作为默认标签
        if (actionKey) {
            return actionKey;
        }

        return '自定义角色';
    };

    // 统一获取角色提示语（用于按钮的 title 属性，支持自定义）
    proto.getRoleTooltip = function(roleConfig) {
        // 优先使用配置中的自定义提示语
        if (roleConfig && roleConfig.tooltip && typeof roleConfig.tooltip === 'string') {
            const tooltip = roleConfig.tooltip.trim();
            if (tooltip) return tooltip;
        }

        // 如果没有自定义提示语，使用标签作为提示语
        return this.getRoleLabel(roleConfig);
    };

    // 统一获取角色完整信息（图标、标签、提示语等）
    proto.getRoleInfoForAction = async function(actionKey) {
        try {
            const configs = await this.getRoleConfigs();
            const cfg = Array.isArray(configs) ? configs.find(c => c && c.actionKey === actionKey) : null;

            return {
                icon: this.getRoleIcon(cfg || { actionKey }, configs),
                label: this.getRoleLabel(cfg || { actionKey }, configs),
                tooltip: this.getRoleTooltip(cfg || { actionKey }),
                config: cfg
            };
        } catch (error) {
            console.error('获取角色信息失败:', error);
            // 降级处理
            const fallbackConfig = { actionKey };
            return {
                icon: this.getRoleIcon(fallbackConfig, null),
                label: this.getRoleLabel(fallbackConfig, null),
                tooltip: this.getRoleTooltip(fallbackConfig),
                config: null
            };
        }
    };

    // 根据 actionKey 从角色配置中获取提示语（必须从角色配置中获取 prompt）
    proto.getRolePromptForAction = async function(actionKey, pageInfo) {
        // 获取角色信息（图标、标签等）
        const roleInfo = await this.getRoleInfoForAction(actionKey);
        const cfg = roleInfo.config;

        // 检查角色配置中是否有 prompt
        if (!cfg || !cfg.prompt || !cfg.prompt.trim()) {
            throw new Error(`角色 ${actionKey} 未配置 prompt，请在角色设置中配置提示词`);
        }

        const pageTitle = pageInfo.title || document.title || '当前页面';
        const pageUrl = pageInfo.url || window.location.href;
        const pageDescription = pageInfo.description || '';
        const pageContent = pageInfo.content || '';

        // 构建 userPrompt
        const userPrompt = `页面标题：${pageTitle}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`;

        return {
            systemPrompt: cfg.prompt.trim(),
            userPrompt: userPrompt,
            label: roleInfo.label,
            icon: roleInfo.icon
        };
    };

    // 将角色设置应用到欢迎消息下方的动作按钮（根据 actionKey 动态更新图标、标题和提示语）
    proto.applyRoleConfigToActionIcon = async function(iconEl, actionKey) {
        try {
            if (!iconEl || !actionKey) return;

            // 使用统一的角色信息获取函数
            const roleInfo = await this.getRoleInfoForAction(actionKey);

            // 更新按钮的图标、标题和提示语
            iconEl.innerHTML = roleInfo.icon || iconEl.innerHTML;
            iconEl.title = roleInfo.tooltip;
        } catch (_) { /* 忽略展示更新错误 */ }
    };

    // 创建动作按钮（根据角色配置动态创建）
    proto.createActionButton = async function(actionKey) {
        const button = document.createElement('span');
        button.setAttribute('data-action-key', actionKey);

        // 从角色配置中动态获取图标、标签和提示语
        try {
            const roleInfo = await this.getRoleInfoForAction(actionKey);
            button.innerHTML = roleInfo.icon || '🙂';
            button.title = roleInfo.tooltip;
        } catch (error) {
            // 降级到默认值
            const fallbackInfo = await this.getRoleInfoForAction(actionKey);
            button.innerHTML = fallbackInfo.icon || '🙂';
            button.title = fallbackInfo.tooltip;
        }

        // 统一的按钮样式
        button.style.cssText = `
            padding: 2px !important;
            cursor: pointer !important;
            font-size: 10px !important;
            color: #666 !important;
            font-weight: 300 !important;
            transition: all 0.2s ease !important;
            flex-shrink: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            user-select: none !important;
            width: 18px !important;
            height: 18px !important;
            line-height: 18px !important;
        `;

        return button;
    };

    // 获取按角色设置列表顺序排列的已绑定角色的 actionKey 列表
    // 此方法与 renderRoleSettingsList() 共享相同的顺序逻辑
    proto.getOrderedBoundRoleKeys = async function() {
        const configsRaw = await this.getRoleConfigs();
        const configs = Array.isArray(configsRaw) ? configsRaw : [];

        // 返回所有有 actionKey 的角色的 actionKey（保持配置中的顺序）
        const orderedKeys = [];
        const seenKeys = new Set();
        for (const config of configs) {
            if (config && config.actionKey && !seenKeys.has(config.actionKey)) {
                orderedKeys.push(config.actionKey);
                seenKeys.add(config.actionKey);
            }
        }

        return orderedKeys;
    };

    // 刷新欢迎消息操作按钮：显示角色列表作为按钮（设置按钮已移动到 chat-request-status-button 后面）
    proto.refreshWelcomeActionButtons = async function() {
        if (!this.chatWindow) return;
        const container = this.chatWindow.querySelector('#pet-welcome-actions');
        if (!container) return;

        // 重建容器
        container.innerHTML = '';

        // 确保按钮样式容器正确（横向排列）
        container.style.cssText = `
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
        `;

        // 获取所有角色配置
        const configsRaw = await this.getRoleConfigs();

        // 确保 actionIcons 和 buttonHandlers 已初始化
        if (!this.actionIcons) {
            this.actionIcons = {};
        }
        if (!this.buttonHandlers) {
            this.buttonHandlers = {};
        }
        // 用于存储没有 actionKey 的角色按钮
        if (!this.roleButtonsById) {
            this.roleButtonsById = {};
        }

        // 先显示已绑定按钮的角色（按按钮顺序）
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();

        for (const key of orderedKeys) {
            const config = (configsRaw || []).find(c => c && c.actionKey === key);
            if (config) {
                boundRoleIds.add(config.id);

                // 创建角色按钮
                let button = this.actionIcons[key];
                if (!button) {
                    button = await this.createActionButton(key);
                    this.actionIcons[key] = button;
                } else {
                    // 更新现有按钮的样式
                    await this.applyRoleConfigToActionIcon(button, key);
                }

                // 绑定点击事件（确保只绑定一次）
                if (!this.buttonHandlers[key]) {
                    // 使用 processingFlag 对象来传递状态
                    const processingFlag = { value: false };
                    this.buttonHandlers[key] = this.createRoleButtonHandler(key, button, processingFlag);
                    button.onclick = this.buttonHandlers[key];
                }

                container.appendChild(button);
            }
        }

        // 再显示其他角色（没有绑定按钮的角色）作为可点击按钮
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id));
        for (const config of otherRoles) {
            // 创建或复用角色按钮（没有 actionKey，点击时请求 /prompt 接口）
            let button = this.roleButtonsById[config.id];
            if (!button) {
                button = document.createElement('span');
                button.setAttribute('data-role-id', config.id);
                button.style.cssText = `
                    padding: 2px !important;
                    cursor: pointer !important;
                    font-size: 10px !important;
                    color: #94a3b8 !important;  /* 中量子灰 */
                    font-weight: 300 !important;
                    transition: all 0.2s ease !important;
                    flex-shrink: 0 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    user-select: none !important;
                    width: 18px !important;
                    height: 18px !important;
                    line-height: 18px !important;
                `;

                // 添加 hover 效果
                button.addEventListener('mouseenter', function() {
                    this.style.fontSize = '12px';
                    this.style.color = '#f8fafc';  /* 量子白 */
                    this.style.transform = 'scale(1.1)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.fontSize = '10px';
                    this.style.color = '#94a3b8';  /* 中量子灰 */
                    this.style.transform = 'scale(1)';
                });

                this.roleButtonsById[config.id] = button;
            }

            // 更新按钮内容
            const displayIcon = this.getRoleIcon(config, configsRaw);
            button.innerHTML = displayIcon || '🙂';
            button.title = config.label || '(未命名)';

            // 创建 processing flag 用于防止重复点击
            if (!this.roleButtonsProcessingFlags) {
                this.roleButtonsProcessingFlags = {};
            }
            if (!this.roleButtonsProcessingFlags[config.id]) {
                this.roleButtonsProcessingFlags[config.id] = { value: false };
            }
            const processingFlag = this.roleButtonsProcessingFlags[config.id];

            // 移除旧的点击事件（通过克隆节点来移除所有事件监听器）
            if (button.parentNode) {
                const oldButton = button;
                const newButton = oldButton.cloneNode(true);
                oldButton.parentNode.replaceChild(newButton, oldButton);
                button = newButton;
                this.roleButtonsById[config.id] = button;

                // 重新绑定 hover 效果
                button.addEventListener('mouseenter', function() {
                    this.style.fontSize = '12px';
                    this.style.color = '#f8fafc';  /* 量子白 */
                    this.style.transform = 'scale(1.1)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.fontSize = '10px';
                    this.style.color = '#94a3b8';  /* 中量子灰 */
                    this.style.transform = 'scale(1)';
                });
            }

            // 绑定点击事件
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (processingFlag.value) return;

                processingFlag.value = true;
                const originalIcon = button.innerHTML;

                // 获取消息容器
                const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                if (!messagesContainer) {
                    console.error('无法找到消息容器');
                    processingFlag.value = false;
                    return;
                }

                // 获取页面信息
                let pageInfo;
                if (this.currentSessionId && this.sessions && this.sessions[this.currentSessionId]) {
                    const session = this.sessions[this.currentSessionId];
                    pageInfo = {
                        title: session.pageTitle || document.title || '当前页面',
                        url: session.url || window.location.href,
                        description: session.pageDescription || '',
                        content: session.pageContent || ''
                    };
                } else {
                    pageInfo = this.getPageInfo();
                }

                // 准备角色提示词
                const roleLabel = this.getRoleLabel(config, configsRaw);
                let rolePrompt = config.prompt;
                if (!rolePrompt || !rolePrompt.trim()) {
                    rolePrompt = `你现在是${roleLabel}。请以${roleLabel}的身份和语气来回答用户的问题。`;
                }

                // 准备上下文信息
                const pageTitle = pageInfo.title || document.title || '当前页面';
                const pageUrl = pageInfo.url || window.location.href;
                const pageDescription = pageInfo.description || '';
                const pageContent = pageInfo.content || '';
                let baseUserPrompt = `页面标题：${pageTitle}
页面URL：${pageUrl}
${pageDescription ? `页面描述：${pageDescription}` : ''}

页面内容（Markdown 格式）：
${pageContent || '无内容'}

请根据以上信息进行分析和处理。`;

                // 构建 fromUser
                const fromUser = this.buildFromUserWithContext(baseUserPrompt, roleLabel);

                // 更新UI状态
                button.style.opacity = '0.5';
                button.style.cursor = 'wait';
                button.innerHTML = '⏳';

                try {
                    // 调用 AI 接口
                    const response = await this.callAiApi(
                        rolePrompt,
                        fromUser,
                        (text) => {}, // 不需要在流式输出中更新
                        null
                    );
                    
                    // 处理响应结果
                    let content = '';
                    if (response && response.content) {
                        content = response.content;
                    } else if (typeof response === 'string') {
                        content = response;
                    }

                    if (content) {
                        await this.addMessageToSession('pet', content, null, false);
                    }
                } catch (error) {
                    console.error('角色处理失败:', error);
                    this.showNotification('处理失败，请重试', 'error');
                } finally {
                    processingFlag.value = false;
                    button.innerHTML = originalIcon;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                }
            });

            container.appendChild(button);
        }

        // 添加企微机器人按钮到欢迎消息
        const robotConfigs = await this.getWeWorkRobotConfigs();
        for (const robotConfig of robotConfigs) {
            if (!robotConfig || !robotConfig.webhookUrl) continue;

            const robotButton = document.createElement('span');
            robotButton.setAttribute('data-robot-id', robotConfig.id);
            robotButton.style.cssText = `
                padding: 4px !important;
                cursor: pointer !important;
                font-size: 16px !important;
                color: #666 !important;
                font-weight: 300 !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                user-select: none !important;
                width: 22px !important;
                height: 22px !important;
                line-height: 22px !important;
            `;

            robotButton.innerHTML = robotConfig.icon || '🤖';
            robotButton.title = robotConfig.name || '企微机器人';

            robotButton.addEventListener('mouseenter', function() {
                this.style.fontSize = '18px';
                this.style.color = '#333';
                this.style.transform = 'scale(1.1)';
            });
            robotButton.addEventListener('mouseleave', function() {
                this.style.fontSize = '16px';
                this.style.color = '#666';
                this.style.transform = 'scale(1)';
            });

            robotButton.addEventListener('click', async (e) => {
                e.stopPropagation();

                // 获取欢迎消息的内容
                const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
                if (!messagesContainer) return;

                const welcomeMessage = messagesContainer.querySelector('[data-welcome-message]');
                if (!welcomeMessage) return;

                const messageBubble = welcomeMessage.querySelector('[data-message-type="pet-bubble"]');
                let messageContent = '';
                if (messageBubble) {
                    messageContent = messageBubble.getAttribute('data-original-text') ||
                                   messageBubble.innerText ||
                                   messageBubble.textContent || '';
                }

                if (!messageContent || !messageContent.trim()) {
                    this.showNotification('消息内容为空，无法发送', 'error');
                    return;
                }

                const trimmedContent = messageContent.trim();
                const originalIcon = robotButton.innerHTML;
                robotButton.innerHTML = '⏳';
                robotButton.style.color = '#3b82f6';  /* 信息蓝 */
                robotButton.style.cursor = 'default';

                try {
                    let finalContent = '';
                    if (this.isMarkdownFormat(trimmedContent)) {
                        finalContent = trimmedContent;
                    } else {
                        finalContent = await this.convertToMarkdown(trimmedContent);
                    }

                    await this.sendToWeWorkRobot(robotConfig.webhookUrl, finalContent);
                    robotButton.innerHTML = '✓';
                    robotButton.style.color = '#22c55e';  /* 现代绿 */
                    this.showNotification(`已发送到 ${robotConfig.name || '企微机器人'}`, 'success');

                    setTimeout(() => {
                        robotButton.innerHTML = originalIcon;
                        robotButton.style.color = '#94a3b8';  /* 中量子灰 */
                        robotButton.style.cursor = 'pointer';
                    }, 2000);
                } catch (error) {
                    console.error('发送到企微机器人失败:', error);
                    robotButton.innerHTML = '✕';
                    robotButton.style.color = '#ef4444';  /* 量子红 */
                    this.showNotification(`发送失败：${error.message || '未知错误'}`, 'error');

                    setTimeout(() => {
                        robotButton.innerHTML = originalIcon;
                        robotButton.style.color = '#94a3b8';  /* 中量子灰 */
                        robotButton.style.cursor = 'pointer';
                    }, 2000);
                }
            });

            container.appendChild(robotButton);
        }
    };

    // 刷新所有消息中的操作按钮（用于角色配置更新后同步所有按钮图标和提示语）
    proto.refreshAllMessageActionButtons = async function() {
        if (!this.chatWindow) return;

        const messagesContainer = this.chatWindow.querySelector('#pet-chat-messages');
        if (!messagesContainer) return;

        // 查找所有有按钮容器的消息（不包括第一条欢迎消息）
        const allMessages = Array.from(messagesContainer.children).filter(
            child => child.querySelector('[data-message-type="pet-bubble"]')
        );

        // 跳过第一条消息，从第二条开始刷新
        for (let i = 1; i < allMessages.length; i++) {
            const messageDiv = allMessages[i];
            // 强制刷新按钮
            await this.addActionButtonsToMessage(messageDiv, true);
        }
    };

    // 创建角色按钮点击处理函数
    proto.createRoleButtonHandler = function(actionKey, iconEl, processingFlag) {
        return async () => {
            if (processingFlag.value) return;

            processingFlag.value = true;

            // 获取消息容器
            const messagesContainer = this.chatWindow ? this.chatWindow.querySelector('#pet-chat-messages') : null;
            if (!messagesContainer) {
                console.error('无法找到消息容器');
                processingFlag.value = false;
                return;
            }

            // 获取页面信息：优先使用当前会话保存的页面上下文
            let pageInfo;
            if (this.currentSessionId && this.sessions[this.currentSessionId]) {
                const session = this.sessions[this.currentSessionId];
                pageInfo = {
                    title: session.pageTitle || document.title || '当前页面',
                    url: session.url || window.location.href,
                    description: session.pageDescription || '',
                    content: session.pageContent || '' // 使用会话保存的页面内容
                };
            } else {
                // 如果没有当前会话，使用当前页面信息
                pageInfo = this.getPageInfo();
            }

            // 从角色配置中获取提示语、名称、图标
            let roleInfo;
            try {
                roleInfo = await this.getRolePromptForAction(actionKey, pageInfo);
            } catch (error) {
                console.error('获取角色信息失败:', error);
                roleInfo = {
                    systemPrompt: '',
                    userPrompt: '',
                    label: '自定义角色',
                    icon: '🙂'
                };
            }

            // 构建包含会话上下文的 fromUser 参数（会使用会话保存的页面上下文）
            const fromUser = this.buildFromUserWithContext(roleInfo.userPrompt, roleInfo.label);

            // 找到按钮所在的消息元素（向上查找包含用户消息的元素）
            let userMessageDiv = null;
            let currentElement = iconEl;
            while (currentElement && currentElement !== messagesContainer) {
                // 检查当前元素是否包含 user-bubble
                if (currentElement.querySelector) {
                    const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]');
                    if (userBubble) {
                        userMessageDiv = currentElement;
                        break;
                    }
                }
                // 如果当前元素有 data-message-id 属性，也检查它是否包含 user-bubble（消息元素有该属性）
                if (currentElement.hasAttribute && currentElement.hasAttribute('data-message-id')) {
                    const userBubble = currentElement.querySelector('[data-message-type="user-bubble"]');
                    if (userBubble) {
                        userMessageDiv = currentElement;
                        break;
                    }
                }
                currentElement = currentElement.parentElement;
            }

            // 创建新的消息（按钮操作生成的消息）
            const message = this.createMessageElement('', 'pet');
            message.setAttribute('data-button-action', 'true'); // 标记为按钮操作生成
            messagesContainer.appendChild(message);
            const messageText = message.querySelector('[data-message-type="pet-bubble"]');
            const messageAvatar = message.querySelector('[data-message-type="pet-avatar"]');

            // 显示加载动画
            if (messageAvatar) {
                messageAvatar.style.animation = 'petTyping 1.2s ease-in-out infinite';
            }

            // 使用角色配置中的图标显示加载文本
            const loadingIcon = roleInfo.icon || '📖';
            if (messageText) {
                messageText.textContent = `${loadingIcon} 正在${roleInfo.label || '处理'}...`;
            }

            try {
                // 使用 /prompt 接口生成内容（非流式）
                console.log('调用大模型生成内容，角色:', roleInfo.label, '页面标题:', pageInfo.title || '当前页面');

                // 创建 AbortController 用于终止请求
                const abortController = new AbortController();

                // 设置标志，避免 prompt 调用后触发会话列表刷新接口
                this.skipSessionListRefresh = true;

                // 使用统一的 payload 构建函数，自动包含会话 ID
                // 如果找到了用户消息元素，将其传递给 buildPromptPayload，以便从正确的消息中提取图片
                const payload = this.buildPromptPayload(
                    roleInfo.systemPrompt,
                    fromUser,
                    { messageDiv: userMessageDiv }
                );

                const response = await fetch(PET_CONFIG.api.promptUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeaders(),
                    },
                    body: JSON.stringify(payload),
                    signal: abortController.signal
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }

                const result = await response.json();

                // 处理后端返回的会话 ID（如果返回了）
                if (result.conversation_id) {
                    const conversationId = result.conversation_id;
                    if (conversationId && !this.currentSessionId) {
                        // 如果当前没有会话 ID，使用后端返回的会话 ID
                        this.currentSessionId = conversationId;
                        console.log('从后端同步会话 ID:', conversationId);
                        // 确保会话存在
                        if (!this.sessions[this.currentSessionId]) {
                            // 创建基础会话对象
                            const pageInfo = this.getPageInfo();
                            const newSession = this.createSessionObject(pageInfo);
                            this.sessions[conversationId] = newSession;
                            // 标记当前页面已自动创建会话
                            this.hasAutoCreatedSessionForPage = true;
                            this.currentPageUrl = pageInfo.url;
                        }
                    } else if (conversationId && this.currentSessionId !== conversationId) {
                        // 如果后端返回的会话 ID 与当前不同，记录日志
                        console.log('后端返回的会话 ID 与当前不同:', conversationId, 'vs', this.currentSessionId);
                    }
                }

                // 适配响应格式: {status, msg, data, pagination}
                let content = '';
                if (result.status === 200 && result.data) {
                    // 成功响应，提取 data 字段
                    content = result.data;
                } else if (result.status !== 200) {
                    // API 返回错误，使用 msg 字段
                    content = result.msg || '抱歉，服务器返回了错误。';
                    throw new Error(content);
                } else if (result.content) {
                    content = result.content;
                } else if (result.message) {
                    content = result.message;
                } else if (typeof result === 'string') {
                    content = result;
                } else {
                    // 未知格式，尝试提取可能的文本内容
                    content = JSON.stringify(result);
                }

                // 停止加载动画
                if (messageAvatar) {
                    messageAvatar.style.animation = '';
                }

                // 显示生成的内容
                if (messageText) {
                    // 确保内容不为空
                    if (!content || !content.trim()) {
                        content = '抱歉，未能获取到有效内容。';
                    }
                    messageText.innerHTML = this.renderMarkdown(content);
                    // 更新原始文本用于复制功能
                    messageText.setAttribute('data-original-text', content);
                    // 添加复制按钮
                    if (content && content.trim()) {
                        const copyButtonContainer = message.querySelector('[data-copy-button-container]');
                        if (copyButtonContainer) {
                            this.addCopyButton(copyButtonContainer, messageText);
                        }
                        // 添加 try again 按钮（仅当不是第一条消息时）
                        const petMessages = Array.from(messagesContainer.children).filter(
                            child => child.querySelector('[data-message-type="pet-bubble"]')
                        );
                        if (petMessages.length > 1) {
                            const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                            if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                                this.addTryAgainButton(tryAgainContainer, message);
                            }
                        }
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                // 设置标志，避免触发会话列表刷新接口（prompt 接口调用完成后会触发 session/save）
                this.skipSessionListRefresh = true;
                if (content && content.trim()) {
                    await this.addMessageToSession('pet', content, null, false);
                }

                // 保存当前会话（同步DOM中的完整消息状态，确保数据一致性）
                await this.saveCurrentSession(false, false);

                // 请求结束后调用 session/save 保存会话到后端
                if (this.currentSessionId) {
                    if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
                        try {
                            await this.syncSessionToBackend(this.currentSessionId, true);
                            console.log(`角色按钮操作后，会话 ${this.currentSessionId} 已保存到后端`);
                        } catch (error) {
                            console.warn('保存会话到后端失败:', error);
                        }
                    } else {
                        console.warn('无法保存会话：sessionApi 未初始化或后端同步未启用');
                    }
                } else {
                    console.warn('无法保存会话：当前会话 ID 不存在');
                }

                iconEl.innerHTML = '✓';
                iconEl.style.cursor = 'default';
                iconEl.style.color = '#22c55e';  /* 现代绿 */

                // 2秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
                setTimeout(() => {
                    this.applyRoleConfigToActionIcon(iconEl, actionKey);
                    iconEl.style.color = '#94a3b8';  /* 中量子灰 */
                    iconEl.style.cursor = 'pointer';
                    iconEl.style.opacity = '1';
                    processingFlag.value = false;
                }, 2000);

            } catch (error) {
                // 检查是否是取消错误
                const isAbortError = error.name === 'AbortError' || error.message === '请求已取消';

                if (!isAbortError) {
                    console.error(`生成${roleInfo.label}失败:`, error);
                }

                // 显示错误消息（取消时不显示）
                if (!isAbortError && messageText) {
                    const errorMessage = error.message && error.message.includes('HTTP error')
                        ? `抱歉，请求失败（${error.message}）。请检查网络连接后重试。${loadingIcon}`
                        : `抱歉，无法生成"${pageInfo.title || '当前页面'}"的${roleInfo.label || '内容'}。${error.message ? `错误信息：${error.message}` : '请稍后重试。'}${loadingIcon}`;
                    messageText.innerHTML = this.renderMarkdown(errorMessage);
                    // 添加 try again 按钮（仅当不是第一条消息时）
                    const petMessages = Array.from(messagesContainer.children).filter(
                        child => child.querySelector('[data-message-type="pet-bubble"]')
                    );
                    if (petMessages.length > 1) {
                        const tryAgainContainer = message.querySelector('[data-try-again-button-container]');
                        if (tryAgainContainer && !tryAgainContainer.querySelector('.try-again-button')) {
                            this.addTryAgainButton(tryAgainContainer, message);
                        }
                    }
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                } else if (isAbortError && messageText) {
                    // 请求被取消，移除消息
                    message.remove();
                }

                if (!isAbortError) {
                    iconEl.innerHTML = '✕';
                    iconEl.style.cursor = 'default';
                    iconEl.style.color = '#ef4444';  /* 量子红 */

                    // 1.5秒后恢复初始状态，允许再次点击（根据角色设置恢复图标与标题）
                    setTimeout(() => {
                        this.applyRoleConfigToActionIcon(iconEl, actionKey);
                        iconEl.style.color = '#94a3b8';  /* 中量子灰 */
                        iconEl.style.cursor = 'pointer';
                        iconEl.style.opacity = '1';
                        processingFlag.value = false;
                    }, 1500);
                } else {
                    // 请求被取消，立即恢复状态
                    this.applyRoleConfigToActionIcon(iconEl, actionKey);
                    iconEl.style.color = '#94a3b8';  /* 中量子灰 */
                    iconEl.style.cursor = 'pointer';
                    iconEl.style.opacity = '1';
                    processingFlag.value = false;
                }
            } finally {
                // 确保停止加载动画
                if (messageAvatar) {
                    messageAvatar.style.animation = '';
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };
    }

    // -------- 角色设置弹框（新增/编辑/删除） --------
    proto.openRoleSettingsModal = function(editId = null) {
        if (!this.chatWindow) return;
        let overlay = this.chatWindow.querySelector('#pet-role-settings');
        const currentColor = this.colors[this.colorIndex];
        const mainColor = this.getMainColorFromGradient(currentColor);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pet-role-settings';
            const chatHeaderEl = this.chatWindow.querySelector('.chat-header');
            const headerH = chatHeaderEl ? chatHeaderEl.offsetHeight : 60;
            overlay.style.cssText = `
                position: absolute !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                top: ${headerH}px !important;
                background: transparent !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: ${PET_CONFIG.ui.zIndex.inputContainer + 1} !important;
                pointer-events: none !important;
            `;

            const panel = document.createElement('div');
            panel.id = 'pet-role-settings-panel';
            panel.style.cssText = `
                width: calc(100% - 24px) !important;
                height: calc(100% - 12px) !important;
                margin: 0 12px 12px 12px !important;
                background: #1f1f1f !important;
                color: #fff !important;
                border-radius: 12px !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.35) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                pointer-events: auto !important;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 16px 20px !important;
                border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                background: rgba(255,255,255,0.04) !important;
                flex-shrink: 0 !important;
            `;
            const title = document.createElement('div');
            title.textContent = '角色设置';
            title.style.cssText = 'font-weight: 600; font-size: 16px; color: #fff;';

            const headerBtns = document.createElement('div');
            headerBtns.style.cssText = 'display:flex; gap:10px; align-items:center;';
            const closeBtn = document.createElement('button');
            closeBtn.id = 'pet-role-settings-close-btn';
            closeBtn.setAttribute('aria-label', '关闭角色设置 (Esc)');
            closeBtn.setAttribute('title', '关闭 (Esc)');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                width: 32px !important;
                height: 32px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                font-size: 16px !important;
                transition: all 0.2s ease !important;
                outline: none !important;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                closeBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                closeBtn.style.color = '#ef4444';
                closeBtn.style.transform = 'translateY(-1px)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = 'rgba(255,255,255,0.06)';
                closeBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                closeBtn.style.color = '#e5e7eb';
                closeBtn.style.transform = 'translateY(0)';
            });
            closeBtn.addEventListener('mousedown', () => {
                closeBtn.style.transform = 'scale(0.96)';
            });
            closeBtn.addEventListener('mouseup', () => {
                closeBtn.style.transform = 'scale(1)';
            });
            closeBtn.addEventListener('click', () => this.closeRoleSettingsModal());
            headerBtns.appendChild(closeBtn);
            header.appendChild(title);
            header.appendChild(headerBtns);

            const body = document.createElement('div');
            body.id = 'pet-role-settings-body';
            body.style.cssText = `
                display: flex !important;
                gap: 16px !important;
                padding: 16px 20px !important;
                height: 100% !important;
                min-height: 0 !important;
                overflow: hidden !important;
            `;

            // 左侧：角色列表
            const listContainer = document.createElement('div');
            listContainer.style.cssText = `
                width: 38% !important;
                min-width: 280px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 12px !important;
            `;

            // 新增角色按钮（放在列表顶部）
            const addBtn = document.createElement('button');
            addBtn.textContent = '新增角色';
            addBtn.style.cssText = `
                padding: 8px 16px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 6px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                flex-shrink: 0 !important;
            `;
            addBtn.addEventListener('mouseenter', () => {
                addBtn.style.background = 'rgba(255,255,255,0.12)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                addBtn.style.transform = 'translateY(-1px)';
            });
            addBtn.addEventListener('mouseleave', () => {
                addBtn.style.background = 'rgba(255,255,255,0.06)';
                addBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                addBtn.style.transform = 'translateY(0)';
            });
            addBtn.addEventListener('click', () => this.renderRoleSettingsForm(null, false));
            listContainer.appendChild(addBtn);

            const list = document.createElement('div');
            list.id = 'pet-role-list';
            list.style.cssText = `
                flex: 1 !important;
                min-height: 0 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                padding: 12px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
            `;
            listContainer.appendChild(list);

            // 右侧：表单区
            const form = document.createElement('div');
            form.id = 'pet-role-form';
            form.style.cssText = `
                flex: 1 !important;
                background: #181818 !important;
                color: #e5e7eb !important;
                border: 1px solid rgba(255,255,255,0.12) !important;
                border-radius: 10px !important;
                padding: 20px !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 16px !important;
            `;

            body.appendChild(listContainer);
            body.appendChild(form);
            panel.appendChild(header);
            panel.appendChild(body);
            overlay.appendChild(panel);
            this.chatWindow.appendChild(overlay);
        }

        overlay.style.display = 'flex';

        // 隐藏折叠按钮（避免在弹框中显示两个折叠按钮）
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';

        // 直接渲染当前配置（不再强制补齐默认项，便于"删除"生效）
        this.renderRoleSettingsList();
        if (editId) {
            this.renderRoleSettingsForm(editId);
        } else {
            this.renderRoleSettingsForm(null, true); // 第二个参数表示显示空白状态
        }
    }

    proto.closeRoleSettingsModal = function() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-role-settings');
        if (overlay) overlay.style.display = 'none';

        // 显示折叠按钮
        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'flex';
        if (inputToggleBtn) inputToggleBtn.style.display = 'flex';
    }

    proto.renderRoleSettingsList = async function() {
        if (!this.chatWindow) return;
        const list = this.chatWindow.querySelector('#pet-role-list');
        if (!list) return;
        const configsRaw = await this.getRoleConfigs();
        list.innerHTML = '';

        // 先显示已绑定按钮的角色（按按钮顺序）
        // 使用 getOrderedBoundRoleKeys() 确保与 refreshWelcomeActionButtons() 顺序一致
        const orderedKeys = await this.getOrderedBoundRoleKeys();
        const boundRoleIds = new Set();
        for (const key of orderedKeys) {
            const config = (configsRaw || []).find(c => c && c.actionKey === key);
            if (config) {
                boundRoleIds.add(config.id);
                // 使用统一的角色信息获取函数获取标签
                const roleInfo = await this.getRoleInfoForAction(key);
                const row = this.createRoleListItem(config, roleInfo.label, configsRaw);
                list.appendChild(row);
            }
        }

        // 再显示其他角色（没有绑定按钮的角色）
        const otherRoles = (configsRaw || []).filter(c => c && c.id && !boundRoleIds.has(c.id));
        if (otherRoles.length > 0) {
            // 如果有已绑定的角色，添加分隔线
            if (orderedKeys.length > 0) {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: rgba(255,255,255,0.08);
                    margin: 4px 0;
                `;
                list.appendChild(separator);
            }

            otherRoles.forEach(config => {
                const row = this.createRoleListItem(config, '', configsRaw);
                list.appendChild(row);
            });
        }

        if (list.children.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = '暂无自定义角色。点击"新增角色"开始创建';
            empty.style.cssText = 'color: #64748b; font-size: 13px; padding: 24px 12px; text-align: center; line-height: 1.5;';
            list.appendChild(empty);
        }
    }

    proto.createRoleListItem = function(c, buttonLabel, allConfigs = null) {
        const row = document.createElement('div');
        row.style.cssText = `
            display:flex !important;
            align-items:center !important;
            justify-content: space-between !important;
            gap: 12px !important;
            padding: 12px !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px !important;
            background: rgba(255,255,255,0.02) !important;
            transition: all 0.2s ease !important;
            cursor: pointer !important;
        `;
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.borderColor = 'rgba(255,255,255,0.15)';
            row.style.transform = 'translateX(2px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'rgba(255,255,255,0.02)';
            row.style.borderColor = 'rgba(255,255,255,0.08)';
            row.style.transform = 'translateX(0)';
        });
        const info = document.createElement('div');
        info.style.cssText = 'display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;';
        const name = document.createElement('div');
        const displayIcon = this.getRoleIcon(c, allConfigs);
        name.textContent = `${displayIcon ? (displayIcon + ' ') : ''}${c.label || '(未命名)'}`;
        name.style.cssText = 'font-weight: 600; font-size: 13px; color: #fff; line-height: 1.4; word-break: break-word;';
        info.appendChild(name);
        if (buttonLabel && buttonLabel.trim()) {
            const sub = document.createElement('div');
            sub.textContent = buttonLabel;
            sub.style.cssText = 'color: #94a3b8; font-size: 11px; line-height: 1.3;';
            info.appendChild(sub);
        }

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:6px; flex-shrink:0;';
        const edit = document.createElement('button');
        edit.textContent = '编辑';
        edit.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        edit.addEventListener('mouseenter', () => {
            edit.style.background = 'rgba(59, 130, 246, 0.15)';
            edit.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            edit.style.color = '#60a5fa';
            edit.style.transform = 'translateY(-1px)';
        });
        edit.addEventListener('mouseleave', () => {
            edit.style.background = 'rgba(255,255,255,0.06)';
            edit.style.borderColor = 'rgba(255,255,255,0.15)';
            edit.style.color = '#e5e7eb';
            edit.style.transform = 'translateY(0)';
        });
        edit.addEventListener('click', () => this.renderRoleSettingsForm(c.id));
        const del = document.createElement('button');
        del.textContent = '删除';
        del.style.cssText = `
            padding: 6px 10px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        `;
        del.addEventListener('mouseenter', () => {
            del.style.background = 'rgba(239, 68, 68, 0.15)';
            del.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            del.style.color = '#f87171';
            del.style.transform = 'translateY(-1px)';
        });
        del.addEventListener('mouseleave', () => {
            del.style.background = 'rgba(255,255,255,0.06)';
            del.style.borderColor = 'rgba(255,255,255,0.15)';
            del.style.color = '#e5e7eb';
            del.style.transform = 'translateY(0)';
        });
        del.addEventListener('click', async () => {
            const next = (await this.getRoleConfigs()).filter(x => x.id !== c.id);
            await this.setRoleConfigs(next);
            this.renderRoleSettingsList();
            this.renderRoleSettingsForm(null, true); // 显示空白状态
            // 同步刷新欢迎消息下的动作按钮
            await this.refreshWelcomeActionButtons();
            // 刷新所有消息下的按钮
            await this.refreshAllMessageActionButtons();
        });
        btns.appendChild(edit);
        btns.appendChild(del);

        row.appendChild(info);
        row.appendChild(btns);
        return row;
    }

    proto.renderRoleSettingsForm = async function(editId = null, showEmptyState = false) {
        if (!this.chatWindow) return;
        const form = this.chatWindow.querySelector('#pet-role-form');
        if (!form) return;
        const configsAll = await this.getRoleConfigs();
        // 用于查找已绑定按钮的角色列表（用于检查占用情况）
        const configs = (configsAll || []).filter(c => c && c.actionKey);
        // 当前编辑的角色（从所有角色中查找）
        const current = editId ? (configsAll || []).find(c => c && c.id === editId) : null;

        form.innerHTML = '';

        // 如果显示空白状态（没有选中角色且不是主动新增）
        if (showEmptyState && !editId && !current) {
            const emptyState = document.createElement('div');
            emptyState.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                height: 100% !important;
                padding: 40px 20px !important;
                text-align: center !important;
            `;

            const icon = document.createElement('div');
            icon.textContent = '👤';
            icon.style.cssText = `
                font-size: 64px !important;
                margin-bottom: 20px !important;
                opacity: 0.6 !important;
            `;

            const title = document.createElement('div');
            title.textContent = '选择一个角色开始编辑';
            title.style.cssText = `
                font-weight: 600 !important;
                font-size: 16px !important;
                color: #e5e7eb !important;
                margin-bottom: 8px !important;
            `;

            const desc = document.createElement('div');
            desc.textContent = '从左侧列表选择角色进行编辑，或点击"新增角色"创建新角色';
            desc.style.cssText = `
                font-size: 13px !important;
                color: #94a3b8 !important;
                line-height: 1.6 !important;
                max-width: 320px !important;
            `;

            const actionBtn = document.createElement('button');
            actionBtn.textContent = '新增角色';
            actionBtn.style.cssText = `
                margin-top: 24px !important;
                padding: 10px 24px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                border-radius: 8px !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
                background: rgba(255,255,255,0.06) !important;
                color: #e5e7eb !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
            `;
            actionBtn.addEventListener('mouseenter', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.12)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.25)';
                actionBtn.style.transform = 'translateY(-2px)';
            });
            actionBtn.addEventListener('mouseleave', () => {
                actionBtn.style.background = 'rgba(255,255,255,0.06)';
                actionBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                actionBtn.style.transform = 'translateY(0)';
            });
            actionBtn.addEventListener('click', () => {
                this.renderRoleSettingsForm(null, false);
            });

            emptyState.appendChild(icon);
            emptyState.appendChild(title);
            emptyState.appendChild(desc);
            emptyState.appendChild(actionBtn);
            form.appendChild(emptyState);
            return;
        }

        const title = document.createElement('div');
        title.textContent = current ? '编辑角色' : '新增角色';
        title.style.cssText = 'font-weight: 600; font-size: 18px; color: #fff; margin-bottom: 4px;';

        const row = (labelText, inputEl) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
            const lab = document.createElement('label');
            lab.textContent = labelText;
            lab.style.cssText = 'font-size: 13px; font-weight: 500; color: #cbd5e1;';
            wrap.appendChild(lab);
            wrap.appendChild(inputEl);
            return wrap;
        };

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = current?.label || '';
        labelInput.placeholder = '角色名称，如：翻译官';
        labelInput.style.cssText = `
            padding: 10px 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            transition: all 0.2s ease !important;
        `;
        labelInput.addEventListener('focus', () => {
            labelInput.style.borderColor = 'rgba(255,255,255,0.25)';
            labelInput.style.background = '#1a1a1a';
        });
        labelInput.addEventListener('blur', () => {
            labelInput.style.borderColor = 'rgba(255,255,255,0.12)';
            labelInput.style.background = '#121212';
        });

        const iconInput = document.createElement('input');
        iconInput.type = 'text';
        iconInput.value = current?.icon || '🙂';
        iconInput.placeholder = '图标（Emoji）';
        iconInput.style.cssText = `
            padding: 10px 12px !important;
            width: 80px !important;
            text-align: center !important;
            font-size: 18px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            transition: all 0.2s ease !important;
        `;
        iconInput.addEventListener('focus', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.25)';
            iconInput.style.background = '#1a1a1a';
        });
        iconInput.addEventListener('blur', () => {
            iconInput.style.borderColor = 'rgba(255,255,255,0.12)';
            iconInput.style.background = '#121212';
        });

        const promptInput = document.createElement('textarea');
        promptInput.value = current?.prompt || '';
        promptInput.placeholder = '角色提示词（System Prompt）。\n例如：你是一个专业的翻译官，请将我发送的内容翻译成英文。';
        promptInput.style.cssText = `
            padding: 12px !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            border-radius: 8px !important;
            outline: none !important;
            background: #121212 !important;
            color: #fff !important;
            font-size: 13px !important;
            line-height: 1.6 !important;
            min-height: 120px !important;
            resize: vertical !important;
            transition: all 0.2s ease !important;
        `;
        promptInput.addEventListener('focus', () => {
            promptInput.style.borderColor = 'rgba(255,255,255,0.25)';
            promptInput.style.background = '#1a1a1a';
        });
        promptInput.addEventListener('blur', () => {
            promptInput.style.borderColor = 'rgba(255,255,255,0.12)';
            promptInput.style.background = '#121212';
        });

        // 按钮绑定部分（可选）
        const actionKeyWrap = document.createElement('div');
        actionKeyWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top: 4px;';
        
        const actionKeyLabel = document.createElement('div');
        actionKeyLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: #cbd5e1; display: flex; justify-content: space-between; align-items: center;';
        actionKeyLabel.textContent = '绑定到快捷按钮';
        
        // 添加提示信息
        const actionKeyTip = document.createElement('span');
        actionKeyTip.textContent = '开启后将在欢迎消息下方显示快捷按钮';
        actionKeyTip.style.cssText = 'font-size: 12px; color: #64748b; font-weight: 400;';
        actionKeyLabel.appendChild(actionKeyTip);
        
        const actionKeySwitch = document.createElement('div');
        actionKeySwitch.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.08);
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        const switchBtn = document.createElement('div');
        const isBound = !!current?.actionKey;
        switchBtn.style.cssText = `
            width: 36px;
            height: 20px;
            background: ${isBound ? '#3b82f6' : 'rgba(255,255,255,0.2)'};
            border-radius: 10px;
            position: relative;
            transition: all 0.3s ease;
        `;
        const switchDot = document.createElement('div');
        switchDot.style.cssText = `
            width: 16px;
            height: 16px;
            background: #1e293b;  /* 量子灰 */
            border-radius: 50%;
            position: absolute;
            top: 2px;
            left: ${isBound ? '18px' : '2px'};
            transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;
        switchBtn.appendChild(switchDot);
        
        const switchText = document.createElement('span');
        switchText.textContent = isBound ? '已启用' : '未启用';
        switchText.style.cssText = `
            font-size: 13px;
            color: ${isBound ? '#fff' : '#94a3b8'};
            font-weight: 500;
        `;
        
        actionKeySwitch.appendChild(switchBtn);
        actionKeySwitch.appendChild(switchText);
        
        let bindActionKey = isBound;
        actionKeySwitch.addEventListener('click', () => {
            bindActionKey = !bindActionKey;
            switchBtn.style.background = bindActionKey ? '#3b82f6' : 'rgba(255,255,255,0.2)';
            switchDot.style.left = bindActionKey ? '18px' : '2px';
            switchText.textContent = bindActionKey ? '已启用' : '未启用';
            switchText.style.color = bindActionKey ? '#fff' : '#94a3b8';
        });
        
        actionKeyWrap.appendChild(actionKeyLabel);
        actionKeyWrap.appendChild(actionKeySwitch);

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex; gap:10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(34, 197, 94, 0.3) !important;
            background: rgba(34, 197, 94, 0.15) !important;
            color: #4ade80 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.25)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.4)';
            saveBtn.style.transform = 'translateY(-1px)';
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = 'rgba(34, 197, 94, 0.15)';
            saveBtn.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            saveBtn.style.transform = 'translateY(0)';
        });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 10px 20px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 8px !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #e5e7eb !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex: 1 !important;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.12)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.25)';
            cancelBtn.style.transform = 'translateY(-1px)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.06)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            cancelBtn.style.transform = 'translateY(0)';
        });

        saveBtn.addEventListener('click', async () => {
            const originalText = saveBtn.textContent;
            const isLoading = saveBtn.dataset.loading === 'true';
            if (isLoading) return;

            saveBtn.dataset.loading = 'true';
            saveBtn.textContent = '保存中...';
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.style.cursor = 'not-allowed';

            try {
                if (!labelInput.value.trim()) {
                    throw new Error('角色名称不能为空');
                }
                if (!promptInput.value.trim()) {
                    throw new Error('角色提示词不能为空');
                }

                const next = {
                    id: current?.id || ('role_' + Math.random().toString(36).slice(2, 10)),
                    label: labelInput.value.trim(),
                    icon: iconInput.value.trim() || '🙂',
                    prompt: promptInput.value.trim(),
                    // 保持原有的 actionKey 或生成新的（如果绑定）
                    actionKey: bindActionKey ? (current?.actionKey || ('custom_' + Math.random().toString(36).slice(2, 8))) : null,
                    tooltip: labelInput.value.trim(),
                    includeCharts: current?.includeCharts || false
                };

                const arr = await this.getRoleConfigs();
                
                // 检查 actionKey 冲突（如果是绑定状态）
                if (next.actionKey) {
                    const conflict = arr.find(x => x.actionKey === next.actionKey && x.id !== next.id);
                    if (conflict) {
                        // 如果有冲突，重新生成一个
                        next.actionKey = 'custom_' + Math.random().toString(36).slice(2, 8);
                    }
                }

                const idx = arr.findIndex(x => x.id === next.id);
                const isEdit = idx >= 0;
                if (isEdit) {
                    arr[idx] = next;
                } else {
                    arr.push(next);
                }

                await this.setRoleConfigs(arr);
                
                // 稍微延迟一下，让动画效果更自然
                await new Promise(resolve => setTimeout(resolve, 300));

                this.renderRoleSettingsList();
                this.renderRoleSettingsForm(null, true); // 显示空白状态，提升体验

                // 同步刷新欢迎消息下的动作按钮
                await this.refreshWelcomeActionButtons();
                // 刷新所有消息下的按钮
                await this.refreshAllMessageActionButtons();
                
                const successMessage = isEdit ? `✅ 角色 "${next.label}" 已更新` : `✅ 角色 "${next.label}" 已创建`;
                this.showNotification(successMessage, 'success');

            } catch (error) {
                console.error('保存角色配置失败:', error);
                this.showNotification(`❌ 保存失败：${error.message || '未知错误'}`, 'error');
            } finally {
                saveBtn.dataset.loading = 'false';
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.renderRoleSettingsForm(null, true);
        });

        form.appendChild(title);
        form.appendChild(row('角色名称', labelInput));
        form.appendChild(row('图标', iconInput));
        form.appendChild(row('提示词 (System Prompt)', promptInput));
        form.appendChild(actionKeyWrap);
        form.appendChild(btns);
        btns.appendChild(saveBtn);
        btns.appendChild(cancelBtn);
    }

    proto.getRoleConfigs = async function() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['roleConfigs'], (result) => {
                resolve(Array.isArray(result.roleConfigs) ? result.roleConfigs : []);
            });
        });
    }

    proto.setRoleConfigs = async function(configs) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ roleConfigs: configs }, () => resolve(true));
        });
    }

    // 读取内置角色定义并转为默认配置（从已有配置中获取label、icon和prompt，如果没有则使用默认值）
    proto.buildDefaultRoleConfigsFromBuiltins = function(existingConfigs = null) {
        const keys = ['summary', 'mindmap', 'flashcard', 'report', 'bestPractice'];
        const includeChartsMap = {
            summary: false,
            mindmap: true,
            flashcard: false,
            report: true,
            bestPractice: true
        };
        const arr = [];
        keys.forEach(k => {
            // 从已有配置中查找对应的label、icon和prompt
            let label = k; // 默认使用actionKey
            let icon = ''; // 默认icon为空，由用户配置
            let prompt = ''; // 默认prompt为空，由用户配置
            if (existingConfigs && Array.isArray(existingConfigs)) {
                const existing = existingConfigs.find(c => c && c.actionKey === k);
                if (existing) {
                    if (existing.label && typeof existing.label === 'string') {
                        const trimmedLabel = existing.label.trim();
                        if (trimmedLabel) {
                            label = trimmedLabel;
                        }
                    }
                    if (existing.icon && typeof existing.icon === 'string') {
                        const trimmedIcon = existing.icon.trim();
                        if (trimmedIcon) {
                            icon = trimmedIcon;
                        }
                    }
                    if (existing.prompt && typeof existing.prompt === 'string') {
                        const trimmedPrompt = existing.prompt.trim();
                        if (trimmedPrompt) {
                            prompt = trimmedPrompt;
                        }
                    }
                }
            }
            arr.push({
                id: 'builtin_' + k,
                label: label,
                actionKey: k,
                icon: icon,
                includeCharts: includeChartsMap[k] || false,
                prompt: prompt
            });
        });
        return arr;
    }

    // 确保默认角色已存在（仅在为空或缺少时补齐）
    // 为消息添加动作按钮（复制、重试等）
    proto.addActionButtonsToMessage = function(messageDiv, messageId, content, isUser) {
        if (!messageDiv) return;

        // 查找或创建按钮容器
        let actionsContainer = messageDiv.querySelector('.message-actions');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'message-actions';
            actionsContainer.style.cssText = `
                display: flex;
                gap: 8px;
                margin-top: 4px;
                justify-content: flex-end;
                opacity: 0;
                transition: opacity 0.2s;
                padding-right: 4px;
            `;

            // 鼠标悬停显示按钮
            messageDiv.addEventListener('mouseenter', () => {
                actionsContainer.style.opacity = '1';
            });
            messageDiv.addEventListener('mouseleave', () => {
                actionsContainer.style.opacity = '0';
            });

            // 将按钮容器添加到消息内容后面
            // 注意：messageDiv 结构通常是: avatar + content-wrapper(bubble)
            const bubble = messageDiv.querySelector('.pet-message-bubble, .user-message-bubble') || messageDiv;
            bubble.appendChild(actionsContainer);
        }

        // 清空现有按钮
        actionsContainer.innerHTML = '';

        // 1. 复制按钮
        const copyBtn = document.createElement('span');
        copyBtn.innerHTML = '📋';
        copyBtn.title = '复制内容';
        copyBtn.style.cssText = `
            cursor: pointer;
            font-size: 12px;
            padding: 2px 4px;
            border-radius: 4px;
            background: rgba(240, 240, 240, 0.6);
            color: #94a3b8;  /* 中量子灰 */
            transition: all 0.2s;
        `;
        copyBtn.onmouseenter = () => { copyBtn.style.background = 'rgba(255, 255, 255, 0.1)'; copyBtn.style.color = '#f8fafc'; };  /* 量子白 */
        copyBtn.onmouseleave = () => { copyBtn.style.background = 'rgba(255, 255, 255, 0.05)'; copyBtn.style.color = '#94a3b8'; };  /* 中量子灰 */
        
        copyBtn.onclick = (e) => {
            e.stopPropagation();
            if (navigator.clipboard) {
                // 如果是 HTML 内容，尝试获取纯文本
                let textToCopy = content;
                if (content.includes('<') && content.includes('>')) {
                    const temp = document.createElement('div');
                    temp.innerHTML = content;
                    textToCopy = temp.textContent || temp.innerText || content;
                }
                
                navigator.clipboard.writeText(textToCopy).then(() => {
                    this.showNotification('已复制到剪贴板', 'success');
                }).catch(() => {
                    this.showNotification('复制失败', 'error');
                });
            }
        };
        actionsContainer.appendChild(copyBtn);

        // 2. 如果是 AI 消息，添加重试按钮（仅用于触发重新生成，逻辑需配合 chatUi）
        // 这里简化处理，仅添加复制按钮，因为重试逻辑比较复杂且依赖上下文
    };

    proto.ensureDefaultRoleConfigs = async function() {
        const existing = await this.getRoleConfigs();
        const defaults = this.buildDefaultRoleConfigsFromBuiltins(existing);
        if (!existing || existing.length === 0) {
            await this.setRoleConfigs(defaults);
            return true;
        }
        // 补齐缺失的内置项
        const haveKeys = new Set(existing.map(c => c.actionKey));
        let updated = false;
        defaults.forEach(d => {
            if (!haveKeys.has(d.actionKey)) {
                existing.push({
                    id: d.id,
                    label: d.label,
                    actionKey: d.actionKey,
                    icon: d.icon,
                    includeCharts: d.includeCharts,
                    prompt: d.prompt
                });
                updated = true;
            }
        });
        // 回填缺失图标（老数据兼容）
        for (const c of existing) {
            if ((!c.icon || !String(c.icon).trim()) && c.actionKey) {
                c.icon = this.getRoleIcon(c, existing);
                updated = true;
            }
        }
        if (updated) {
            await this.setRoleConfigs(existing);
        }
        return true;
    }

})(typeof window !== 'undefined' ? window : this);
