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

        this.chatWindow.insertAdjacentHTML(
            'beforeend',
            `
                <div
                    id="pet-robot-settings"
                    class="js-visible"
                    role="dialog"
                    aria-modal="true"
                    aria-label="企微机器人设置"
                    tabindex="0"
                >
                    <div class="robot-settings-modal" role="document">
                        <div class="robot-settings-header">
                            <div class="robot-settings-title">🤖 企微机器人设置</div>
                            <button type="button" class="robot-settings-close" aria-label="关闭">✕</button>
                        </div>
                        <div class="robot-settings-content">
                            <button type="button" class="robot-add-btn">+ 新增机器人</button>
                            <div id="pet-robot-list" class="robot-list"></div>
                            <div id="pet-robot-form" class="robot-form"></div>
                        </div>
                    </div>
                </div>
            `.trim()
        );

        const overlay = this.chatWindow.querySelector('#pet-robot-settings');
        if (!overlay) return;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeWeWorkRobotSettingsModal();
        });
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.closeWeWorkRobotSettingsModal();
            }
        });

        const closeBtn = overlay.querySelector('.robot-settings-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeWeWorkRobotSettingsModal());

        const addBtn = overlay.querySelector('.robot-add-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.renderWeWorkRobotSettingsForm(null));

        this.chatWindow.classList.add('robot-settings-open');

        this.renderWeWorkRobotSettingsList();
        this.renderWeWorkRobotSettingsForm(editId, !editId); // 如果没有 editId，显示空白状态

        try {
            overlay.focus();
        } catch (_) {}
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

        if (!list._yiPetRobotListBound) {
            list._yiPetRobotListBound = true;

            list.addEventListener('click', async (e) => {
                const target = e?.target;
                if (!target) return;

                const delBtn = target.closest?.('.robot-list-item-delete-btn');
                if (delBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const item = delBtn.closest?.('.robot-list-item');
                    const id = item?.getAttribute?.('data-robot-id') || '';
                    if (!id) return;
                    if (!confirm('确定要删除这个机器人配置吗？')) return;
                    const configs = await this.getWeWorkRobotConfigs();
                    const next = configs.filter((x) => x && x.id !== id);
                    await this.setWeWorkRobotConfigs(next);
                    this.renderWeWorkRobotSettingsList();
                    this.renderWeWorkRobotSettingsForm(null, true);
                    await this.refreshWelcomeActionButtons();
                    return;
                }

                const item = target.closest?.('.robot-list-item');
                if (!item) return;
                const id = item.getAttribute('data-robot-id');
                if (!id) return;
                this.renderWeWorkRobotSettingsForm(id);
            });

            list.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const item = e?.target?.closest?.('.robot-list-item');
                if (!item) return;
                const id = item.getAttribute('data-robot-id');
                if (!id) return;
                e.preventDefault();
                this.renderWeWorkRobotSettingsForm(id);
            });
        }

        const configs = await this.getWeWorkRobotConfigs();
        if (!Array.isArray(configs) || configs.length === 0) {
            list.innerHTML = '<div class="robot-list-empty">暂无配置机器人</div>';
            return;
        }

        const escapeHtml = (text) =>
            String(text ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

        const rows = configs
            .map((config) => {
                const id = escapeHtml(config?.id || '');
                const icon = escapeHtml(config?.icon || '🤖');
                const name = escapeHtml(config?.name || '未命名机器人');
                const urlText = config?.webhookUrl
                    ? `${String(config.webhookUrl).substring(0, 30)}...`
                    : '未配置 Webhook';
                const url = escapeHtml(urlText);

                return `
                    <div class="robot-list-item" data-robot-id="${id}" role="button" tabindex="0">
                        <div class="robot-list-item-info">
                            <span class="robot-list-item-icon">${icon}</span>
                            <div class="robot-list-item-name">
                                <span class="robot-list-item-name-text">${name}</span>
                                <span class="robot-list-item-url-text">${url}</span>
                            </div>
                        </div>
                        <div class="robot-list-item-actions">
                            <button type="button" class="robot-list-item-delete-btn" title="删除" aria-label="删除">🗑️</button>
                        </div>
                    </div>
                `.trim();
            })
            .join('');

        list.innerHTML = rows;
    };

    proto.createWeWorkRobotListItem = function(config) {
        const escapeHtml = (text) =>
            String(text ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

        const id = escapeHtml(config?.id || '');
        const icon = escapeHtml(config?.icon || '🤖');
        const name = escapeHtml(config?.name || '未命名机器人');
        const urlText = config?.webhookUrl ? `${String(config.webhookUrl).substring(0, 30)}...` : '未配置 Webhook';
        const url = escapeHtml(urlText);

        const html = `
            <div class="robot-list-item" data-robot-id="${id}" role="button" tabindex="0">
                <div class="robot-list-item-info">
                    <span class="robot-list-item-icon">${icon}</span>
                    <div class="robot-list-item-name">
                        <span class="robot-list-item-name-text">${name}</span>
                        <span class="robot-list-item-url-text">${url}</span>
                    </div>
                </div>
                <div class="robot-list-item-actions">
                    <button type="button" class="robot-list-item-delete-btn" title="删除" aria-label="删除">🗑️</button>
                </div>
            </div>
        `.trim();

        try {
            const frag = document.createRange().createContextualFragment(html);
            return frag.firstElementChild || null;
        } catch (_) {
            return null;
        }
    };

    proto.renderWeWorkRobotSettingsForm = async function(editId = null, showEmptyState = false) {
        if (!this.chatWindow) return;
        const form = this.chatWindow.querySelector('#pet-robot-form');
        if (!form) return;

        if (showEmptyState) {
            form.innerHTML = '<div class="robot-form-empty">👈 请选择左侧列表进行编辑，或点击"新增机器人"</div>';
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

        const escapeHtml = (text) =>
            String(text ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

        form.setAttribute('data-edit-id', String(config.id || ''));
        form.innerHTML = `
            <div class="robot-config-field">
                <div class="robot-config-label">机器人名称</div>
                <input
                    type="text"
                    class="robot-config-input"
                    data-field="name"
                    value="${escapeHtml(config.name || '')}"
                    placeholder="例如：研发群助手"
                />
            </div>
            <div class="robot-config-field">
                <div class="robot-config-label">图标 (Emoji)</div>
                <input
                    type="text"
                    class="robot-config-input"
                    data-field="icon"
                    value="${escapeHtml(config.icon || '')}"
                    placeholder="例如：🤖"
                />
            </div>
            <div class="robot-config-field">
                <div class="robot-config-label">Webhook 地址</div>
                <input
                    type="text"
                    class="robot-config-input"
                    data-field="webhookUrl"
                    value="${escapeHtml(config.webhookUrl || '')}"
                    placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                />
            </div>
            <div class="robot-config-btn-row">
                <button type="button" class="robot-config-save-btn">保存配置</button>
            </div>
        `.trim();

        const saveBtn = form.querySelector('.robot-config-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const getField = (name) => {
                    const el = form.querySelector(`.robot-config-input[data-field="${name}"]`);
                    return String(el?.value || '').trim();
                };

                const nextConfig = {
                    id: String(config.id || Date.now()),
                    name: getField('name'),
                    icon: getField('icon') || '🤖',
                    webhookUrl: getField('webhookUrl')
                };

                if (!nextConfig.name || !nextConfig.webhookUrl) {
                    alert('请填写名称和 Webhook 地址');
                    return;
                }

                const all = await this.getWeWorkRobotConfigs();
                const idx = all.findIndex((c) => c && c.id === nextConfig.id);
                if (idx >= 0) all[idx] = nextConfig;
                else all.push(nextConfig);

                await this.setWeWorkRobotConfigs(all);
                this.renderWeWorkRobotSettingsList();
                this.showNotification('保存成功', 'success');
                await this.refreshWelcomeActionButtons();
            });
        }
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
            // 使用 chatModels 的 default 字段
            if (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) {
                payload.parameters.model = PET_CONFIG.chatModels.default;
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

            const result = await response.json();
            if (!result || typeof result !== 'object') {
                throw new Error('响应格式错误');
            }
            if (result.code !== 0) {
                throw new Error(result.message || `请求失败 (code=${result.code})`);
            }

            const data = result.data || {};
            let content =
                (typeof data.message === 'string' ? data.message : '') ||
                (typeof data.content === 'string' ? data.content : '') ||
                (typeof result.content === 'string' ? result.content : '');

            // 如果提取到了有效内容，去除 markdown 代码块标记
            if (content && content.trim()) {
                let cleanedContent = content.trim();

                // 去除开头的 ```markdown 或 ``` 标记
                cleanedContent = cleanedContent.replace(/^```(?:markdown)?\s*/i, '');

                // 去除结尾的 ``` 标记
                cleanedContent = cleanedContent.replace(/\s*```\s*$/, '');

                return cleanedContent.trim();
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

            const oldPayload = this.buildPromptPayload(
                systemPrompt,
                userPrompt
            );
    
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
            if (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) {
                payload.parameters.model = PET_CONFIG.chatModels.default;
            }
            if (oldPayload.conversation_id) {
                payload.parameters.conversation_id = oldPayload.conversation_id;
            }

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

            const result = await response.json();
            if (!result || typeof result !== 'object') {
                throw new Error('响应格式错误');
            }
            if (result.code !== 0) {
                throw new Error(result.message || `请求失败 (code=${result.code})`);
            }

            const data = result.data || {};
            const markdown =
                (typeof data.message === 'string' ? data.message : '') ||
                (typeof data.content === 'string' ? data.content : '') ||
                (typeof result.content === 'string' ? result.content : '');

            return (markdown && markdown.trim()) ? markdown.trim() : content;
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
