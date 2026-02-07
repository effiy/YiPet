/**
 * PetManager 标签管理模块
 * 扩展 PetManager.prototype
 */
(function() {
    'use strict';

    if (typeof window === 'undefined') return;

    // 确保 PetManager 类已定义
    if (typeof window.PetManager === 'undefined') {
        console.error('[TagManager] PetManager 未定义，无法扩展 TagManager 模块');
        return;
    }

    const proto = window.PetManager.prototype;
    
    console.log('[TagManager] 开始扩展 PetManager 原型，添加 openTagManager 方法');

        /**
         * 根据标签名称生成颜色（确保相同标签颜色一致）
         */
        proto.getTagColor = function(tagName) {
            // 预定义的配色方案（柔和的渐变色）
            const colorPalettes = [
                // 蓝色系
                { background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', text: '#0369a1', border: '#7dd3fc' },
                // 绿色系
                { background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', text: '#166534', border: '#86efac' },
                // 紫色系
                { background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', text: '#6b21a8', border: '#c084fc' },
                // 粉色系
                { background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', text: '#9f1239', border: '#f9a8d4' },
                // 橙色系
                { background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', text: '#9a3412', border: '#fdba74' },
                // 青色系
                { background: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)', text: '#164e63', border: '#67e8f9' },
                // 红色系
                { background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', text: '#991b1b', border: '#fca5a5' },
                // 黄色系
                { background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)', text: '#854d0e', border: '#fde047' },
                // 靛蓝色系
                { background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', text: '#3730a3', border: '#a5b4fc' },
                // 玫瑰色系
                { background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', text: '#9f1239', border: '#fda4af' }
            ];

            // 使用简单的哈希函数将标签名称映射到颜色索引
            let hash = 0;
            for (let i = 0; i < tagName.length; i++) {
                hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
                hash = hash & hash; // 转换为32位整数
            }

            // 确保索引为正数并在范围内
            const index = Math.abs(hash) % colorPalettes.length;
            return colorPalettes[index];
        };

        /**
         * 打开标签管理弹窗
         */
        proto.openTagManager = function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法管理标签:', sessionId);
                return;
            }

            const session = this.sessions[sessionId];
            const currentTags = Array.isArray(session.tags) ? [...session.tags] : [];

            this.ensureTagManagerUi();
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store) {
                console.error('标签管理弹窗未初始化');
                return;
            }

            store.sessionId = sessionId;
            store.inputValue = '';
            store.currentTags = currentTags.map((t) => String(t ?? '').trim()).filter((t) => t);
            store.visible = true;
            this.refreshQuickTags();

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeTagManager();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        };

        /**
         * 获取所有会话的标签统计（用于标签建议）
         */
        proto.getAllTagsStatistics = function() {
            const tagStats = new Map();
            if (!this.sessions) return tagStats;

            Object.values(this.sessions).forEach(session => {
                if (session && session.tags && Array.isArray(session.tags)) {
                    session.tags.forEach(tag => {
                        if (tag && tag.trim()) {
                            const normalizedTag = tag.trim();
                            tagStats.set(normalizedTag, (tagStats.get(normalizedTag) || 0) + 1);
                        }
                    });
                }
            });

            return tagStats;
        };

        /**
         * 确保标签管理UI存在
         */
        proto.ensureTagManagerUi = function() {
            if (document.querySelector('#pet-tag-manager')) return;

            const Vue = window.Vue || {};
            const { createApp, reactive, watch } = Vue;
            if (typeof createApp !== 'function' || typeof reactive !== 'function') {
                if (typeof this.showNotification === 'function') {
                    this.showNotification('无法打开标签管理：Vue 未初始化', 'error');
                }
                return;
            }

            const canUseTemplate = (() => {
                if (typeof Vue?.compile !== 'function') return false;
                try {
                    Function('return 1')();
                    return true;
                } catch (_) {
                    return false;
                }
            })();

            const overlay = document.createElement('div');
            overlay.id = 'pet-tag-manager';
            const mountEl = document.createElement('div');
            overlay.appendChild(mountEl);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeTagManager();
                }
            });

            const store = reactive({
                visible: false,
                sessionId: '',
                inputValue: '',
                currentTags: [],
                quickTags: [],
                draggingIndex: -1,
                dragOverIndex: -1,
                dragOverPosition: ''
            });

            overlay._store = store;
            this._tagManagerStore = store;

            if (typeof watch === 'function') {
                watch(
                    () => store.visible,
                    (v) => {
                        overlay.classList.toggle('js-visible', !!v);
                    },
                    { immediate: true }
                );
            }

            overlay._mountPromise = (async () => {
                try {
                    const mod = window.PetManager?.Components?.SessionTagManager;
                    if (!mod || typeof mod.createComponent !== 'function') return;
                    const template = canUseTemplate && typeof mod.loadTemplate === 'function' ? await mod.loadTemplate() : '';
                    const ctor = mod.createComponent({ manager: this, store, template });
                    if (!ctor) return;
                    overlay._vueApp = createApp(ctor);
                    overlay._vueInstance = overlay._vueApp.mount(mountEl);
                } catch (e) {
                    try {
                        console.error('初始化会话标签组件失败:', e);
                    } catch (_) {}
                }
            })();

            if (this.chatWindow) this.chatWindow.appendChild(overlay);
            else document.body.appendChild(overlay);
        };

        /**
         * 加载标签到管理器
         */
        proto.loadTagsIntoManager = function(sessionId, tags) {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store) return;
            store.sessionId = String(sessionId || '').trim() || store.sessionId;
            const normalized = (Array.isArray(tags) ? tags : []).map((t) => String(t ?? '').trim()).filter((t) => t);
            store.currentTags = normalized;
        };

        /**
         * 更新快捷标签按钮状态
         */
        proto.updateQuickTagButtons = function(overlay, currentTags) {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store) return;
            store.quickTags = Array.isArray(store.quickTags) ? store.quickTags : [];
        };

        /**
         * 刷新快捷标签列表
         */
        proto.refreshQuickTags = function(overlay) {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store) return;
            const quickTags = typeof this.getAllTags === 'function' ? this.getAllTags() : [];
            store.quickTags = Array.isArray(quickTags) ? quickTags.map((t) => String(t ?? '').trim()).filter((t) => t) : [];
        };

        /**
         * 从输入框添加标签
         */
        proto.addTagFromInput = function(sessionId) {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store) return;
            const tagName = String(store.inputValue || '').trim();
            if (!tagName) return;
            if (!Array.isArray(store.currentTags)) store.currentTags = [];
            if (store.currentTags.includes(tagName)) {
                store.inputValue = '';
                return;
            }
            store.currentTags.push(tagName);
            store.inputValue = '';
            this.refreshQuickTags();
        };

        /**
         * 添加快捷标签
         */
        proto.addQuickTag = function(sessionId, tagName) {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store) return;
            const t = String(tagName ?? '').trim();
            if (!t) return;
            if (!Array.isArray(store.currentTags)) store.currentTags = [];
            if (store.currentTags.includes(t)) return;
            store.currentTags.push(t);
        };

        /**
         * 移除标签
         */
        proto.removeTag = function(sessionId, index) {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store || !Array.isArray(store.currentTags)) return;
            store.currentTags.splice(index, 1);
            this.refreshQuickTags();
        };

        proto.reorderTag = function (sessionId, fromIndex, toIndex) {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store || !Array.isArray(store.currentTags)) return;
            const tags = store.currentTags;
            const from = Number(fromIndex);
            let to = Number(toIndex);
            if (!Number.isFinite(from) || !Number.isFinite(to)) return;
            if (from < 0 || from >= tags.length) return;
            to = Math.max(0, Math.min(tags.length, to));
            if (to === from) return;
            const item = tags[from];
            tags.splice(from, 1);
            tags.splice(to, 0, item);
        };

        /**
         * 保存标签
         */
        proto.saveTags = async function(sessionId) {
            if (!sessionId || !this.sessions[sessionId]) {
                console.warn('会话不存在，无法保存标签:', sessionId);
                return;
            }

            try {
                const session = this.sessions[sessionId];
                
                let newTags = [];
                const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
                if (store && Array.isArray(store.currentTags)) {
                    newTags = [...store.currentTags];
                } else if (session.tags) {
                    newTags = [...session.tags];
                }

                // 规范化标签（trim处理，去重，过滤空标签）
                const normalizedTags = newTags
                    .map(tag => tag ? tag.trim() : '')
                    .filter(tag => tag.length > 0);
                const uniqueTags = [...new Set(normalizedTags)];

                // 构建文件路径的辅助函数
                const buildFilePath = (s, title) => {
                    // 优先从会话的 tags 构建路径
                    const tags = Array.isArray(s.tags) ? s.tags : [];
                    let currentPath = '';
                    tags.forEach((folderName) => {
                        if (!folderName || (folderName.toLowerCase && folderName.toLowerCase() === 'default')) return;
                        currentPath = currentPath ? currentPath + '/' + folderName : folderName;
                    });
                    
                    // 清理文件名（移除特殊字符，避免路径问题）
                    const sanitizeFileName = (name) => String(name || '').replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '-').trim();
                    let fileName = sanitizeFileName(title) || 'Untitled';
                    fileName = String(fileName).replace(/\//g, '-');
                    
                    let cleanPath = currentPath ? currentPath + '/' + fileName : fileName;
                    cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
                    if (cleanPath.startsWith('static/')) {
                        cleanPath = cleanPath.substring(7);
                    }
                    cleanPath = cleanPath.replace(/^\/+/, '');
                    
                    // 如果 cleanPath 仍然为空，尝试从 pageDescription 获取
                    if (!cleanPath) {
                        const pageDesc = s.pageDescription || '';
                        if (pageDesc && pageDesc.includes('文件：')) {
                            const filePath = pageDesc.replace('文件：', '').trim();
                            const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
                            cleanPath = dirPath + fileName;
                            cleanPath = cleanPath.replace(/\\/g, '/').replace(/^\/+/, '');
                            if (cleanPath.startsWith('static/')) {
                                cleanPath = cleanPath.substring(7);
                            }
                            cleanPath = cleanPath.replace(/^\/+/, '');
                        }
                    }
                    
                    return cleanPath;
                };

                // 记录旧路径
                const originalTitle = session.title || '未命名会话';
                const titleWithSuffix = (originalTitle.toLowerCase().endsWith('.md')) ? originalTitle : `${originalTitle}.md`;
                const oldPath = buildFilePath(session, titleWithSuffix);

                // 更新会话标签
                session.tags = uniqueTags;
                session.updatedAt = Date.now();

                // 记录新路径
                const newPath = buildFilePath(session, titleWithSuffix);

                // 如果路径不同，调用 rename-file 接口
                if (oldPath && newPath && oldPath !== newPath) {
                    console.log('[saveTags] 准备重命名文件:', oldPath, '->', newPath);
                    
                    // 获取 API 基础 URL
                    const apiBase = (window.API_URL && /^https?:\/\//i.test(window.API_URL)) 
                        ? String(window.API_URL).replace(/\/+$/, '') 
                        : (typeof PET_CONFIG !== 'undefined' ? PET_CONFIG?.api?.yiaiBaseUrl : '');
                    
                    if (apiBase) {
                        try {
                            const response = await fetch(`${apiBase}/rename-file`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(this.getAuthHeaders ? this.getAuthHeaders() : {}),
                                },
                                body: JSON.stringify({
                                    old_path: oldPath,
                                    new_path: newPath
                                })
                            });
                            
                            if (!response.ok) {
                                const errorText = await response.text();
                                throw new Error(`HTTP ${response.status}: ${errorText}`);
                            }
                            
                            const envelope = await response.json();
                            if (!envelope || typeof envelope !== 'object') {
                                throw new Error('响应格式错误');
                            }
                            if (envelope.code !== 0) {
                                throw new Error(envelope.message || `请求失败 (code=${envelope.code})`);
                            }

                            console.log('[saveTags] 文件重命名成功:', envelope.data);
                                
                            // 更新会话的 pageDescription 中的文件路径
                            if (session.pageDescription && session.pageDescription.includes('文件：')) {
                                session.pageDescription = session.pageDescription.replace(
                                    /文件：.*/,
                                    `文件：${newPath}`
                                );
                            }
                        } catch (renameError) {
                            console.error('[saveTags] 调用 rename-file 接口失败:', renameError);
                        }
                    } else {
                        console.warn('[saveTags] API_URL 未配置，跳过 rename-file 接口调用');
                    }
                }

                // 保存会话到本地
                await this.saveAllSessions(false, true);

                // 更新UI显示
                await this.updateSessionSidebar(true);

                if (this.sessionApi && typeof this.sessionApi.isEnabled === 'function' && this.sessionApi.isEnabled()) {
                    const apiUrl = this.sessionApi.baseUrl || (typeof PET_CONFIG !== 'undefined' ? PET_CONFIG.api.yiaiBaseUrl : '');
                    const base = String(apiUrl || '').replace(/\/+$/, '');
                    if (base) {
                        try {
                            const payload = {
                                module_name: 'services.database.data_service',
                                method_name: 'update_document',
                                parameters: {
                                    cname: 'sessions',
                                    key: sessionId,
                                    data: {
                                        key: sessionId,
                                        tags: uniqueTags,
                                        pageDescription: session.pageDescription || '',
                                        updatedAt: session.updatedAt || Date.now()
                                    }
                                }
                            };
                            const response = await fetch(`${base}/`, {
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

                            const envelope = await response.json();
                            if (!envelope || typeof envelope !== 'object') {
                                throw new Error('响应格式错误');
                            }
                            if (envelope.code !== 0) {
                                throw new Error(envelope.message || `请求失败 (code=${envelope.code})`);
                            }
                            console.log('[saveTags] update_document 接口调用成功');
                        } catch (updateError) {
                            console.error('[saveTags] 调用 update_document 接口失败:', updateError);
                        }
                    }
                }

                // 显示成功提示
                if (this.showNotification) {
                    this.showNotification('标签已保存', 'success');
                }

                // 关闭弹窗
                this.closeTagManager();

                console.log('标签已保存:', uniqueTags);
            } catch (error) {
                console.error('保存标签失败:', error);
                if (this.showNotification) {
                    this.showNotification('保存标签失败，请重试', 'error');
                } else {
                    alert('保存标签失败，请重试');
                }
            }
        };

        /**
         * 关闭标签管理器
         */
        proto.closeTagManager = async function() {
            const store = this._tagManagerStore || document.querySelector('#pet-tag-manager')?._store;
            if (!store) return;
            store.visible = false;
            store.sessionId = '';
            store.inputValue = '';
            store.currentTags = [];
            store.draggingIndex = -1;
            store.dragOverIndex = -1;
            store.dragOverPosition = '';
        };
    
    console.log('[TagManager] 所有方法已添加到原型');
})();
