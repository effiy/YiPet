/**
 * PetManager - 企微机器人相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 企微机器人配置存储 Key
    const WEWORK_ROBOT_CONFIG_KEY = 'YiPet.weworkRobotConfigs';

    // 获取企微机器人配置
    proto.getWeWorkRobotConfigs = async function() {
        return new Promise((resolve) => {
            chrome.storage.local.get([WEWORK_ROBOT_CONFIG_KEY], (result) => {
                let configs = result[WEWORK_ROBOT_CONFIG_KEY];
                if (!Array.isArray(configs)) {
                    configs = [];
                }
                resolve(configs);
            });
        });
    };

    // 保存企微机器人配置
    proto.setWeWorkRobotConfigs = async function(configs) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [WEWORK_ROBOT_CONFIG_KEY]: configs }, () => {
                resolve();
            });
        });
    };

    // 打开微信机器人设置（别名方法，与 YiWeb 保持一致）
    proto.openWeChatSettings = function() {
        return this.openWeWorkRobotSettingsModal();
    };

    // 打开企微机器人设置弹窗
    proto.openWeWorkRobotSettingsModal = function(editId = null) {
        if (!this.chatWindow) return;

        // 如果已经存在弹窗，先移除
        const existing = this.chatWindow.querySelector('#pet-robot-settings');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'pet-robot-settings';
        overlay.classList.add('js-visible');
        // 样式已通过 CSS 类定义

        const modal = document.createElement('div');
        modal.className = 'robot-settings-modal';

        // 头部
        const header = document.createElement('div');
        header.className = 'robot-settings-header';
        
        const title = document.createElement('div');
        title.className = 'robot-settings-title';
        title.innerHTML = '🤖 企微机器人设置';
        
        const closeBtn = document.createElement('div');
        closeBtn.className = 'robot-settings-close';
        closeBtn.innerHTML = '✕';
        closeBtn.onclick = () => this.closeWeWorkRobotSettingsModal();
        
        header.appendChild(title);
        header.appendChild(closeBtn);

        // 内容区域
        const content = document.createElement('div');
        content.className = 'robot-settings-content';

        // 列表容器
        const listContainer = document.createElement('div');
        listContainer.id = 'pet-robot-list';
        listContainer.className = 'robot-list';

        // 表单容器
        const formContainer = document.createElement('div');
        formContainer.id = 'pet-robot-form';
        formContainer.className = 'robot-form';

        // 新增按钮
        const addBtn = document.createElement('button');
        addBtn.innerHTML = '+ 新增机器人';
        addBtn.className = 'robot-add-btn';
        addBtn.onclick = () => this.renderWeWorkRobotSettingsForm(null);

        content.appendChild(addBtn);
        content.appendChild(listContainer);
        content.appendChild(formContainer);

        modal.appendChild(header);
        modal.appendChild(content);
        overlay.appendChild(modal);
        this.chatWindow.appendChild(overlay);

        this.chatWindow.classList.add('robot-settings-open');

        this.renderWeWorkRobotSettingsList();
        this.renderWeWorkRobotSettingsForm(editId, !editId); // 如果没有 editId，显示空白状态
    };

    proto.closeWeWorkRobotSettingsModal = function() {
        if (!this.chatWindow) return;
        const overlay = this.chatWindow.querySelector('#pet-robot-settings');
        if (overlay) overlay.remove();
        this.chatWindow.classList.remove('robot-settings-open');
    };

    proto.renderWeWorkRobotSettingsList = async function() {
        if (!this.chatWindow) return;
        const list = this.chatWindow.querySelector('#pet-robot-list');
        if (!list) return;

        const configs = await this.getWeWorkRobotConfigs();
        list.innerHTML = '';

        if (configs.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = '暂无配置机器人';
            empty.className = 'robot-list-empty';
            list.appendChild(empty);
            return;
        }

        configs.forEach(config => {
            const row = this.createWeWorkRobotListItem(config);
            list.appendChild(row);
        });
    };

    proto.createWeWorkRobotListItem = function(config) {
        const row = document.createElement('div');
        row.className = 'robot-list-item';
        row.onclick = () => this.renderWeWorkRobotSettingsForm(config.id);

        const info = document.createElement('div');
        info.className = 'robot-list-item-info';
        
        const icon = document.createElement('span');
        icon.textContent = config.icon || '🤖';
        icon.className = 'robot-list-item-icon';
        
        const name = document.createElement('div');
        name.className = 'robot-list-item-name';
        
        const nameText = document.createElement('span');
        nameText.textContent = config.name || '未命名机器人';
        nameText.className = 'robot-list-item-name-text';
        
        const urlText = document.createElement('span');
        urlText.textContent = config.webhookUrl ? (config.webhookUrl.substring(0, 30) + '...') : '未配置 Webhook';
        urlText.className = 'robot-list-item-url-text';
        
        name.appendChild(nameText);
        name.appendChild(urlText);
        
        info.appendChild(icon);
        info.appendChild(name);

        const btns = document.createElement('div');
        btns.className = 'robot-list-item-actions';

        const del = document.createElement('button');
        del.innerHTML = '🗑️';
        del.title = '删除';
        del.className = 'robot-list-item-delete-btn';
        del.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('确定要删除这个机器人配置吗？')) {
                const configs = await this.getWeWorkRobotConfigs();
                const next = configs.filter(x => x.id !== config.id);
                await this.setWeWorkRobotConfigs(next);
                this.renderWeWorkRobotSettingsList();
                this.renderWeWorkRobotSettingsForm(null, true);
                
                // 刷新欢迎消息按钮
                await this.refreshWelcomeActionButtons();
            }
        };

        btns.appendChild(del);
        row.appendChild(info);
        row.appendChild(btns);

        return row;
    };

    proto.renderWeWorkRobotSettingsForm = async function(editId = null, showEmptyState = false) {
        if (!this.chatWindow) return;
        const form = this.chatWindow.querySelector('#pet-robot-form');
        if (!form) return;

        if (showEmptyState) {
            form.innerHTML = '';
            const empty = document.createElement('div');
            empty.textContent = '👈 请选择左侧列表进行编辑，或点击"新增机器人"';
            empty.className = 'robot-form-empty';
            form.appendChild(empty);
            return;
        }

        const configs = await this.getWeWorkRobotConfigs();
        const config = editId ? configs.find(c => c.id === editId) : {
            id: Date.now().toString(),
            name: '',
            icon: '🤖',
            webhookUrl: ''
        };

        if (!config && editId) {
            this.renderWeWorkRobotSettingsForm(null, true);
            return;
        }

        form.innerHTML = '';

        const createInput = (label, value, placeholder, key, type = 'text') => {
            const container = document.createElement('div');
            container.className = 'robot-config-field';
            
            const labelEl = document.createElement('div');
            labelEl.textContent = label;
            labelEl.className = 'robot-config-label';
            
            const input = document.createElement('input');
            input.type = type;
            input.value = value || '';
            input.placeholder = placeholder;
            input.className = 'robot-config-input';
            
            input.onchange = (e) => {
                config[key] = e.target.value;
            };
            
            container.appendChild(labelEl);
            container.appendChild(input);
            return container;
        };

        form.appendChild(createInput('机器人名称', config.name, '例如：研发群助手', 'name'));
        form.appendChild(createInput('图标 (Emoji)', config.icon, '例如：🤖', 'icon'));
        form.appendChild(createInput('Webhook 地址', config.webhookUrl, 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...', 'webhookUrl'));

        // 按钮区域
        const btnRow = document.createElement('div');
        btnRow.className = 'robot-config-btn-row';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存配置';
        saveBtn.className = 'robot-config-save-btn';
        saveBtn.onclick = async () => {
            if (!config.name || !config.webhookUrl) {
                alert('请填写名称和 Webhook 地址');
                return;
            }

            const all = await this.getWeWorkRobotConfigs();
            const idx = all.findIndex(c => c.id === config.id);
            if (idx >= 0) {
                all[idx] = config;
            } else {
                all.push(config);
            }
            
            await this.setWeWorkRobotConfigs(all);
            this.renderWeWorkRobotSettingsList();
            this.showNotification('保存成功', 'success');
            
            // 刷新欢迎消息按钮
            await this.refreshWelcomeActionButtons();
        };

        btnRow.appendChild(saveBtn);
        form.appendChild(btnRow);
    };

    // 处理消息内容，通过 prompt 接口处理并返回 md 格式
    proto.processMessageForRobot = async function(messageContent) {
        try {
            // 构建 system prompt，要求返回精简的 md 格式且严格不超过 4096 字符
            const systemPrompt = `你是一个内容精简专家。请将用户提供的消息内容进行**大幅精简和压缩**，并以 Markdown 格式返回。

**核心要求（必须严格遵守）：**
1. **长度限制是硬性要求**：最终输出内容（包括所有 Markdown 语法字符和表情符号）必须严格控制在 4096 字符以内，这是企业微信机器人的限制，超过会导致发送失败
2. **优先保留核心信息**：只保留最关键、最重要的信息，删除所有冗余、重复、次要的内容
3. **使用紧凑格式**：
   - 优先使用列表（有序/无序）而非段落
   - 使用标题层级（##、###）组织内容
   - 使用**加粗**突出关键点，避免冗长描述
   - 删除不必要的空行和装饰性内容
4. **精简策略**：
   - 合并相似内容，去除重复表达
   - 用关键词和短语替代完整句子
   - 删除示例、详细解释等非核心内容
   - 如果原内容过长，只保留摘要和要点
5. **格式要求**：
   - 如果原内容已经是 Markdown，大幅精简后保持格式
   - 如果原内容不是 Markdown，转换为精简的 Markdown 格式
   - 使用简洁的 Markdown 语法，避免复杂的嵌套结构
6. **表情符号使用（重要）**：
   - **适度使用表情符号**，让内容更生动有趣、更容易记忆
   - 在标题、关键点、重要信息处使用合适的表情符号
   - 常用表情符号语义映射：
     * 📋 报告/文档/总结
     * 📝 笔记/记录/要点
     * 💡 想法/建议/提示
     * 🔑 关键/核心/重点
     * ⚠️ 注意/警告/风险
     * ✅ 完成/成功/优势
     * ❌ 错误/问题/缺点
     * 📊 数据/统计/图表
     * 🎯 目标/目的/方向
     * 🚀 趋势/发展/提升
     * ⭐ 重要/亮点/推荐
     * 🔍 分析/研究/探索
     * 💬 观点/评论/讨论
     * 📌 标记/强调/固定
     * 🎉 庆祝/成就/好消息
     * 📈 增长/上升/积极
     * 📉 下降/减少/消极
     * 🔥 热门/紧急/重要
     * 💰 财务/成本/价值
     * 🎓 学习/教育/知识
     * ⏰ 时间/期限/计划
     * 🏆 成就/优秀/排名
     * 🌟 亮点/特色/突出
   - 表情符号使用原则：
     * 每个标题或关键点使用 1-2 个相关表情符号
     * 不要过度使用，保持内容简洁
     * 表情符号应该增强语义，而不是装饰

**重要提醒**：如果原内容很长，必须进行**大幅压缩**，只保留核心要点。宁可内容简短，也绝不能超过 4096 字符限制。表情符号的使用要适度，不能影响内容的精简。

请直接返回精简后的 Markdown 内容，不要添加任何说明文字、前缀或后缀。`;

            // 构建 userPrompt，添加精简和表情符号提示
            const userPrompt = `请将以下内容**大幅精简和压缩**为 Markdown 格式，确保最终输出严格控制在 4096 字符以内。

**要求**：
- 使用合适的表情符号让内容更生动有趣、更容易记忆
- 在标题、关键点、重要信息处添加相关表情符号
- 保持内容精简，表情符号要适度使用

内容：

${messageContent}`;

            // 构建 payload
            const oldPayload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 转换为 services.ai.chat_service 格式
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: oldPayload.fromSystem,
                    user: oldPayload.fromUser,
                    stream: false
                }
            };
            if (oldPayload.images && Array.isArray(oldPayload.images) && oldPayload.images.length > 0) {
                payload.parameters.images = oldPayload.images;
            }
            if (oldPayload.model) {
                payload.parameters.model = oldPayload.model;
            }
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

            // 调用 services.ai.chat_service 接口
            const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            // 读取响应文本
            const responseText = await response.text();
            let result;

            // 检查是否包含SSE格式（包含 "data: "）
            if (responseText.includes('data: ')) {
                // 处理SSE流式响应
                const lines = responseText.split('\n');
                let accumulatedData = '';
                let lastValidData = null;

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            // 尝试解析JSON
                            const chunk = JSON.parse(dataStr);

                            // 检查是否完成
                            if (chunk.done === true) {
                                break;
                            }

                            // 累积内容（处理流式内容块）
                            if (chunk.data) {
                                accumulatedData += chunk.data;
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                // Ollama格式
                                accumulatedData += chunk.message.content;
                            } else if (typeof chunk === 'string') {
                                accumulatedData += chunk;
                            }

                            // 保存最后一个有效的数据块
                            lastValidData = chunk;
                        } catch (e) {
                            // 如果不是JSON，可能是纯文本内容
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr && dataStr !== '[DONE]') {
                                accumulatedData += dataStr;
                            }
                        }
                    }
                }

                // 如果累积了内容，创建结果对象
                if (accumulatedData || lastValidData) {
                    if (lastValidData && lastValidData.status) {
                        result = {
                            ...lastValidData,
                            data: accumulatedData || lastValidData.data || '',
                            content: accumulatedData || lastValidData.content || ''
                        };
                    } else {
                        result = {
                            data: accumulatedData,
                            content: accumulatedData
                        };
                    }
                } else {
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析响应格式');
                    }
                }
            } else {
                // 非SSE格式，直接解析JSON
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    const sseMatch = responseText.match(/data:\s*({.+?})/s);
                    if (sseMatch) {
                        result = JSON.parse(sseMatch[1]);
                    } else {
                        throw new Error(`无法解析响应: ${responseText.substring(0, 100)}`);
                    }
                }
            }

            // 适配响应格式
            let content = '';
            if (result.data) {
                content = result.data;
            } else if (result.content) {
                content = result.content;
            } else if (result.message && result.message.content) {
                content = result.message.content;
            } else if (result.message && typeof result.message === 'string') {
                content = result.message;
            } else if (typeof result === 'string') {
                content = result;
            } else {
                content = JSON.stringify(result);
            }

            // 如果提取到了有效内容，去除 markdown 代码块标记
            if (content && content.trim()) {
                let cleanedContent = content.trim();

                // 去除开头的 ```markdown 或 ``` 标记
                cleanedContent = cleanedContent.replace(/^```(?:markdown)?\s*/i, '');

                // 去除结尾的 ``` 标记
                cleanedContent = cleanedContent.replace(/\s*```\s*$/, '');

                return cleanedContent.trim();
            } else if (result.status !== undefined && result.status !== 200) {
                const errorMsg = result.msg || '抱歉，服务器返回了错误。';
                throw new Error(errorMsg);
            } else if (result.msg && !content) {
                throw new Error(result.msg);
            } else {
                throw new Error('无法获取有效内容');
            }
        } catch (error) {
            console.error('处理消息内容失败:', error);
            throw error;
        }
    };

    // 转换为 Markdown 格式
    proto.convertToMarkdown = async function(content) {
        try {
            const systemPrompt = '你是一个专业的文本格式化助手。请将用户提供的内容转换为适合企业微信机器人的 markdown 格式。要求：\n1. 保持原意不变\n2. 使用合适的 markdown 语法（标题、加粗、列表等）\n3. 确保格式清晰易读\n4. 如果内容已经是 markdown 格式，直接返回原内容\n5. 输出纯 markdown 文本，不要添加任何解释';

            const userPrompt = `请将以下内容转换为 markdown 格式：\n\n${content}`;

            const payload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );

            // 使用全局配置 PET_CONFIG
            const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            let result;

            // 处理流式响应
            if (responseText.includes('data: ')) {
                const lines = responseText.split('\n');
                let accumulatedData = '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const dataStr = trimmedLine.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            const chunk = JSON.parse(dataStr);
                            if (chunk.done === true) {
                                break;
                            }

                            if (chunk.data) {
                                accumulatedData += chunk.data;
                            } else if (chunk.content) {
                                accumulatedData += chunk.content;
                            } else if (chunk.message && chunk.message.content) {
                                accumulatedData += chunk.message.content;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }

                result = accumulatedData || content;
            } else {
                // 处理非流式响应
                try {
                    const jsonResult = JSON.parse(responseText);
                    if (jsonResult.status === 200 && jsonResult.data) {
                        result = jsonResult.data;
                    } else if (jsonResult.content) {
                        result = jsonResult.content;
                    } else if (jsonResult.message) {
                        result = jsonResult.message;
                    } else {
                        result = content; // 如果无法解析，使用原内容
                    }
                } catch (e) {
                    result = content; // 如果解析失败，使用原内容
                }
            }

            // 如果转换结果为空，使用原内容
            return (result && result.trim()) ? result.trim() : content;
        } catch (error) {
            console.error('转换为 markdown 失败:', error);
            // 转换失败时返回原内容
            return content;
        }
    };

    // 限制 Markdown 长度
    proto.limitMarkdownLength = function(content, maxLength) {
        if (!content || content.length <= maxLength) return content;
        return content.substring(0, maxLength - 3) + '...';
    };

    // 发送到企微机器人
    proto.sendToWeWorkRobot = async function(webhookUrl, content) {
        try {
            // 参数验证
            if (!webhookUrl || typeof webhookUrl !== 'string') {
                throw new Error('webhookUrl 参数无效');
            }

            if (!content || typeof content !== 'string') {
                throw new Error('content 参数无效');
            }

            // 检查内容是否是 markdown 格式
            let markdownContent = content;

            if (!this.isMarkdownFormat(content)) {
                // 如果不是 markdown 格式，先转换为 markdown
                console.log('[企微机器人] 内容不是 markdown 格式，正在转换为 markdown...');
                markdownContent = await this.convertToMarkdown(content);
                console.log(`[企微机器人] 转换后长度: ${markdownContent.length}`);
            }

            // 不再限制消息长度，发送完整内容

            // 通过 background script 发送请求，避免 CORS 问题
            const response = await chrome.runtime.sendMessage({
                action: 'sendToWeWorkRobot',
                webhookUrl: webhookUrl,
                content: markdownContent
            });

            if (!response || !response.success) {
                throw new Error(response?.error || '发送失败');
            }

            return response.result;
        } catch (error) {
            console.error('发送到企微机器人失败:', error);
            throw error;
        }
    };

})();
