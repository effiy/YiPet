/**
 * PetManager - 划词评论功能模块
 * 说明：实现类似YiWeb中的快捷键调用划词评论弹框功能
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // AI预设数据
    proto.getQuickCommentPresets = function() {
        return [
            {
                id: 'analyze',
                label: '代码分析',
                icon: 'fa-code',
                prompt: '请对这段代码进行详细分析，包括：\n1. 代码功能和逻辑\n2. 潜在问题和风险\n3. 优化建议\n4. 最佳实践建议'
            },
            {
                id: 'review',
                label: '代码审查',
                icon: 'fa-check-circle',
                prompt: '请对这段代码进行代码审查，重点关注：\n1. 代码质量和可读性\n2. 性能问题\n3. 安全性问题\n4. 是否符合编码规范'
            },
            {
                id: 'explain',
                label: '代码解释',
                icon: 'fa-question-circle',
                prompt: '请详细解释这段代码的工作原理，包括：\n1. 代码的执行流程\n2. 关键概念和原理\n3. 各个部分的作用\n4. 使用场景和示例'
            },
            {
                id: 'optimize',
                label: '性能优化',
                icon: 'fa-tachometer-alt',
                prompt: '请分析这段代码的性能问题并提供优化建议：\n1. 性能瓶颈识别\n2. 优化方案\n3. 优化后的预期效果\n4. 注意事项'
            },
            {
                id: 'refactor',
                label: '重构建议',
                icon: 'fa-sync-alt',
                prompt: '请提供代码重构建议：\n1. 代码结构问题\n2. 重构方案\n3. 重构步骤\n4. 重构后的优势'
            },
            {
                id: 'bug-fix',
                label: 'Bug修复',
                icon: 'fa-bug',
                prompt: '请分析这段代码可能存在的Bug：\n1. 潜在的Bug点\n2. Bug原因分析\n3. 修复方案\n4. 预防措施'
            },
            {
                id: 'test',
                label: '测试建议',
                icon: 'fa-vial',
                prompt: '请为这段代码提供测试建议：\n1. 测试用例设计\n2. 边界情况测试\n3. 测试覆盖范围\n4. 测试工具推荐'
            },
            {
                id: 'document',
                label: '文档生成',
                icon: 'fa-file-alt',
                prompt: '请为这段代码生成文档：\n1. 功能说明\n2. 参数说明\n3. 返回值说明\n4. 使用示例'
            }
        ];
    };

    // 加载Font Awesome CSS
    proto.loadFontAwesome = function() {
        // 检查是否已加载
        if (document.getElementById('pet-fa-stylesheet')) {
            return;
        }

        // 创建link标签加载Font Awesome
        const link = document.createElement('link');
        link.id = 'pet-fa-stylesheet';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    };

    // 初始化划词评论功能
    proto.initCommentFeature = function() {
        // 加载Font Awesome CSS（如果尚未加载）
        this.loadFontAwesome();
        
        // 创建评论弹框容器
        this.createCommentContainer();
        
        // 监听文本选择变化
        this.setupSelectionListener();
        
        // 初始化状态
        this.commentState = {
            showQuickComment: false,
            quickCommentText: '',
            quickCommentQuote: '',
            quickCommentError: '',
            quickCommentSubmitting: false,
            lastSelectionText: '',
            lastSelectionRange: null,
            quickCommentPosition: {
                left: 0,
                top: 0,
                width: 600,
                height: 450
            },
            isDraggingQuickComment: false,
            isResizingQuickComment: false,
            quickCommentAnimating: false,
            _quickCommentOutsideClickHandler: null
        };

        console.log('[PetManager] 划词评论功能已初始化');
    };

    // 创建评论弹框容器
    proto.createCommentContainer = function() {
        // 检查是否已存在
        if (document.getElementById('pet-quick-comment-container')) {
            return;
        }

        const container = document.createElement('div');
        container.id = 'pet-quick-comment-container';
        container.className = 'pet-quick-comment-container';
        container.style.display = 'none';
        document.body.appendChild(container);

        // 创建HTML结构
        container.innerHTML = `
            <div class="quick-comment-header" data-drag-handle>
                <div class="quick-comment-title">
                    <i class="fas fa-comment-dots"></i>
                    <span>添加评论</span>
                </div>
                <div class="quick-comment-header-actions">
                    <button type="button" class="quick-comment-close" title="关闭 (Esc)" aria-label="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <div class="quick-comment-quote" id="pet-quick-comment-quote" style="display: none;">
                <div class="quick-comment-quote-label">
                    <i class="fas fa-code"></i>
                    <span>引用代码</span>
                </div>
                <div class="quick-comment-quote-code" id="pet-quick-comment-quote-code"></div>
            </div>

            <div class="quick-comment-body manual-mode" id="pet-quick-comment-body">
                <!-- 手动模式输入区域 -->
                <div class="quick-comment-input-wrapper" id="pet-quick-comment-input-wrapper">
                    <textarea 
                        id="pet-quick-comment-textarea" 
                        class="quick-comment-textarea" 
                        placeholder="输入评论内容，支持 Markdown..." 
                        rows="1"
                    ></textarea>
                    <div class="quick-comment-error" id="pet-quick-comment-error" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <span></span>
                    </div>
                </div>
            </div>

            <!-- AI 结果展示区域（在 footer 上方） -->
            <div class="quick-comment-ai-response" id="pet-quick-comment-ai-response" style="display: none;">
                <div class="quick-comment-ai-response-header">
                    <div class="quick-comment-ai-response-title">
                        <i class="fas fa-sparkles"></i>
                        <span>AI 回复</span>
                    </div>
                    <button type="button" class="quick-comment-ai-response-close" id="pet-quick-comment-ai-response-close" title="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="quick-comment-ai-response-content" id="pet-quick-comment-ai-response-content">
                    <!-- Markdown 渲染的内容将显示在这里 -->
                </div>
            </div>

            <div class="quick-comment-footer">
                <div class="quick-comment-hint">
                    <kbd>⌘</kbd><span>+</span><kbd>↵</kbd>
                    <span>提交</span>
                    <span class="separator">·</span>
                    <kbd>Esc</kbd>
                    <span>关闭</span>
                    <span class="separator">·</span>
                    <kbd>⌘</kbd><span>+</span><kbd>⇧</kbd><span>+</span><kbd>K</kbd>
                    <span>打开</span>
                </div>
                <button type="button" class="quick-comment-submit-btn" id="pet-quick-comment-submit">
                    <i class="fas fa-paper-plane"></i>
                    <span>提交</span>
                </button>
            </div>
            
            <!-- 四个角的缩放手柄 -->
            <div class="quick-comment-resize-handle resize-handle-ne" data-resize="ne" title="拖拽调整大小"></div>
            <div class="quick-comment-resize-handle resize-handle-nw" data-resize="nw" title="拖拽调整大小"></div>
            <div class="quick-comment-resize-handle resize-handle-se" data-resize="se" title="拖拽调整大小"></div>
            <div class="quick-comment-resize-handle resize-handle-sw" data-resize="sw" title="拖拽调整大小"></div>
        `;

        // 绑定事件
        this.bindCommentEvents(container);
    };

    // 绑定评论弹框事件
    proto.bindCommentEvents = function(container) {
        const self = this;

        // 关闭按钮
        const closeBtn = container.querySelector('.quick-comment-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                self.closeQuickComment();
            });
        }


        // 拖拽功能
        const header = container.querySelector('.quick-comment-header');
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('button') || e.target.closest('.quick-comment-header-actions')) {
                    return;
                }
                self.startDragQuickComment(e);
            });
        }

        // 提交按钮
        const submitBtn = container.querySelector('#pet-quick-comment-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                self.submitQuickComment();
            });
        }

        // 文本域键盘事件
        const textarea = container.querySelector('#pet-quick-comment-textarea');
        if (textarea) {
            textarea.addEventListener('keydown', (e) => {
                self.handleQuickCommentKeydown(e);
            });
            textarea.addEventListener('input', () => {
                self.autoResizeQuickCommentTextarea();
            });
        }

        // AI 回复关闭按钮
        const aiResponseCloseBtn = container.querySelector('#pet-quick-comment-ai-response-close');
        if (aiResponseCloseBtn) {
            aiResponseCloseBtn.addEventListener('click', () => {
                const responseContainer = document.getElementById('pet-quick-comment-ai-response');
                if (responseContainer) {
                    responseContainer.style.display = 'none';
                }
            });
        }

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && self.commentState.showQuickComment) {
                self.closeQuickComment();
            }
        });

        // 缩放手柄事件
        const resizeHandles = container.querySelectorAll('.quick-comment-resize-handle');
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                const position = handle.dataset.resize;
                self.initResizeQuickComment(e, position);
            });
        });
    };

    // 设置文本选择监听
    proto.setupSelectionListener = function() {
        const self = this;
        
        // 监听选择变化
        document.addEventListener('mouseup', () => {
            setTimeout(() => {
                self.onSelectionChange();
            }, 10);
        });

        document.addEventListener('selectionchange', () => {
            self.onSelectionChange();
        });
    };

    // 处理选择变化
    proto.onSelectionChange = function() {
        try {
            if (typeof this.getActiveElementSelectedText === 'function') {
                const activeSel = this.getActiveElementSelectedText();
                if (activeSel && activeSel.text) {
                    this.commentState.lastSelectionText = activeSel.text;
                    this.commentState.lastSelectionRange = null;
                    this.commentState._quickCommentReferenceRect = activeSel.rect || null;
                    return;
                }
            }

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
                this.commentState.lastSelectionText = '';
                this.commentState.lastSelectionRange = null;
                this.commentState._quickCommentReferenceRect = null;
                return;
            }

            const range = sel.getRangeAt(0);
            const text = String(sel.toString() || '').trim();
            
            if (!text) {
                this.commentState.lastSelectionText = '';
                this.commentState.lastSelectionRange = null;
                this.commentState._quickCommentReferenceRect = null;
                return;
            }

            // 保存选择信息
            this.commentState.lastSelectionText = text;
            this.commentState.lastSelectionRange = {
                startContainer: range.startContainer,
                endContainer: range.endContainer,
                startOffset: range.startOffset,
                endOffset: range.endOffset
            };
            this.commentState._quickCommentReferenceRect = range.getBoundingClientRect ? range.getBoundingClientRect() : null;

            console.log('[PetManager] 检测到文本选择:', {
                text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                textLength: text.length
            });
        } catch (error) {
            console.error('[PetManager] 处理选择变化时出错:', error);
        }
    };

    proto.getActiveElementSelectedText = function() {
        try {
            const el = document.activeElement;
            if (!el) return null;

            const tag = (el.tagName || '').toUpperCase();
            if (tag !== 'TEXTAREA' && tag !== 'INPUT') return null;

            const start = el.selectionStart;
            const end = el.selectionEnd;
            if (typeof start !== 'number' || typeof end !== 'number') return null;
            if (start === end) return null;

            const value = typeof el.value === 'string' ? el.value : '';
            const s = Math.min(start, end);
            const e = Math.max(start, end);
            const selected = value.slice(s, e);
            const text = String(selected || '').trim();
            if (!text) return null;

            const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
            return { text, rect };
        } catch (e) {
            return null;
        }
    };

    // 从快捷键打开评论弹框
    proto.openQuickCommentFromShortcut = function() {
        if (!this.commentState) {
            if (typeof this.initCommentFeature === 'function') {
                this.initCommentFeature();
            }
            if (!this.commentState) {
                return;
            }
        }

        if (typeof this.onSelectionChange === 'function') {
            this.onSelectionChange();
        }
        this.openQuickComment();
    };

    // 打开评论弹框
    proto.openQuickComment = function() {
        const container = document.getElementById('pet-quick-comment-container');
        if (!container) {
            this.createCommentContainer();
            return this.openQuickComment();
        }

        document.body.appendChild(container);
        container.style.zIndex = '2147483652';

        // 获取选择位置
        let referenceRect = null;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            referenceRect = range.getBoundingClientRect();
        }
        if ((!referenceRect || referenceRect.width <= 0) && this.commentState && this.commentState._quickCommentReferenceRect) {
            referenceRect = this.commentState._quickCommentReferenceRect;
        }

        // 计算位置
        if (referenceRect && referenceRect.width > 0) {
            this.calculateQuickCommentPosition(referenceRect);
        } else {
            // 默认位置：视口中心偏上
            const defaultWidth = this.commentState.quickCommentPosition.width || 600;
            const defaultHeight = this.commentState.quickCommentPosition.height || 450;
            this.commentState.quickCommentPosition = {
                ...this.commentState.quickCommentPosition,
                left: Math.max(16, (window.innerWidth - defaultWidth) / 2),
                top: Math.max(100, (window.innerHeight - defaultHeight) / 3)
            };
        }

        // 设置引用代码
        const quoteCode = container.querySelector('#pet-quick-comment-quote-code');
        const quoteContainer = container.querySelector('#pet-quick-comment-quote');
        if (quoteCode && this.commentState.lastSelectionText) {
            quoteCode.textContent = this.commentState.lastSelectionText;
            quoteContainer.style.display = 'flex';
        } else {
            quoteContainer.style.display = 'none';
        }

        // 重置状态
        const textarea = container.querySelector('#pet-quick-comment-textarea');
        if (textarea) {
            textarea.value = '';
        }
        this.commentState.quickCommentText = '';
        this.commentState.quickCommentError = '';
        this.commentState.quickCommentSubmitting = false;
        
        // 隐藏 AI 回复区域
        const aiResponse = container.querySelector('#pet-quick-comment-ai-response');
        if (aiResponse) {
            aiResponse.style.display = 'none';
        }

        // 显示弹框
        this.commentState.quickCommentAnimating = true;
        this.commentState.showQuickComment = true;
        container.style.display = 'flex';
        container.style.left = `${this.commentState.quickCommentPosition.left}px`;
        container.style.top = `${this.commentState.quickCommentPosition.top}px`;
        container.style.width = `${this.commentState.quickCommentPosition.width}px`;
        container.style.height = `${this.commentState.quickCommentPosition.height}px`;
        container.classList.add('visible', 'animate-in');

        // 聚焦输入框
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
            }
            this.commentState.quickCommentAnimating = false;
            container.classList.remove('animate-in');
        }, 200);

        // 添加点击外部关闭的监听
        this.commentState._quickCommentOutsideClickHandler = (e) => {
            if (!container.contains(e.target)) {
                this.closeQuickComment();
            }
        };
        setTimeout(() => {
            if (this.commentState.showQuickComment) {
                document.addEventListener('mousedown', this.commentState._quickCommentOutsideClickHandler);
            }
        }, 100);

        console.log('[PetManager] Quick Comment 已打开');
    };

    // 关闭评论弹框
    proto.closeQuickComment = function() {
        const container = document.getElementById('pet-quick-comment-container');
        if (!container) return;

        this.commentState.showQuickComment = false;
        this.commentState.quickCommentText = '';
        this.commentState.quickCommentQuote = '';
        this.commentState.quickCommentError = '';
        this.commentState.quickCommentSubmitting = false;
        this.commentState._quickCommentReferenceRect = null;

        container.style.display = 'none';
        container.classList.remove('visible', 'animate-in', 'ai-generating');

        // 移除点击外部关闭的监听
        if (this.commentState._quickCommentOutsideClickHandler) {
            document.removeEventListener('mousedown', this.commentState._quickCommentOutsideClickHandler);
            this.commentState._quickCommentOutsideClickHandler = null;
        }

        console.log('[PetManager] Quick Comment 已关闭');
    };

    // 计算评论弹框位置
    proto.calculateQuickCommentPosition = function(referenceRect) {
        const padding = 12;
        const containerWidth = this.commentState.quickCommentPosition.width || 600;
        const containerHeight = this.commentState.quickCommentPosition.height || 450;
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;

        let left = referenceRect.right + padding;
        let top = referenceRect.top;

        // 如果右侧空间不足，放在左侧
        if (left + containerWidth > vw - padding) {
            left = referenceRect.left - containerWidth - padding;
            if (left < padding) {
                left = Math.max(padding, (vw - containerWidth) / 2);
            }
        }

        // 确保不超出视口
        if (top + containerHeight > vh - padding) {
            top = Math.max(padding, vh - containerHeight - padding);
        }
        if (top < padding) {
            top = padding;
        }

        this.commentState.quickCommentPosition = {
            ...this.commentState.quickCommentPosition,
            left: left,
            top: top
        };
    };

    // 设置评论模式
    proto.setQuickCommentMode = function(mode) {
        this.commentState.quickCommentMode = mode;
        const container = document.getElementById('pet-quick-comment-container');
        if (!container) return;

        // 更新模式按钮状态
        const modeBtns = container.querySelectorAll('.mode-switch-btn');
        modeBtns.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

    };

    // 渲染 AI 预设按钮
    proto.renderQuickCommentPresets = function() {
        const presetsList = document.getElementById('pet-quick-comment-ai-presets-list');
        if (!presetsList) return;

        // 清空现有内容
        presetsList.innerHTML = '';

        // 根据 YiWeb 的预设配置，定义要显示的预设
        const presetConfig = [
            { id: 'review', icon: 'fa-search', label: '代码审查' },
            { id: 'optimize', icon: 'fa-lightbulb', label: '改进建议' },
            { id: 'explain', icon: 'fa-info-circle', label: '解释代码' },
            { id: 'bug-fix', icon: 'fa-bug', label: '查找问题' }
        ];

        presetConfig.forEach(config => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ai-preset-btn';
            btn.dataset.presetId = config.id;
            btn.innerHTML = `<i class="fas ${config.icon}"></i> ${config.label}`;
            
            // 绑定点击事件
            btn.addEventListener('click', () => {
                this.useAiPreset(config.id);
            });
            
            presetsList.appendChild(btn);
        });
    };

    // 使用 AI 预设
    proto.useAiPreset = function(presetId) {
        // 预设配置（与 YiWeb 保持一致）
        const presets = {
            'review': {
                prompt: '请审查这段代码，指出潜在的问题和改进建议',
                systemPrompt: `你是一个专业的代码审查助手。用户会提供一段代码，请审查代码并指出潜在的问题和改进建议。
要求：
1. 评论要专业、具体、有建设性
2. 使用 Markdown 格式，保持简洁
3. 指出代码中的潜在问题、性能问题、安全问题等
4. 提供具体的改进建议
5. 评论语言与用户输入语言保持一致`
            },
            'optimize': {
                prompt: '请为这段代码提供优化和改进建议，包括性能优化、代码质量提升、最佳实践等',
                systemPrompt: `你是一个专业的代码优化助手。用户会提供一段代码，请提供优化和改进建议。
要求：
1. 分析代码的性能瓶颈和优化空间
2. 提供具体的优化建议和改进方案
3. 如果适用，可以提供改进后的代码示例（使用代码块格式）
4. 使用 Markdown 格式，保持结构清晰
5. 评论语言与用户输入语言保持一致
6. 确保输出的是可以直接使用的评论内容，不要包含额外的说明文字`
            },
            'explain': {
                prompt: '请详细解释这段代码的功能、工作原理、设计思路和关键逻辑',
                systemPrompt: `你是一个专业的代码解释助手。用户会提供一段代码，请详细解释代码的功能和工作原理。
要求：
1. 解释代码的整体功能和目的
2. 说明代码的工作原理和关键逻辑
3. 解释重要的设计思路和实现细节
4. 使用 Markdown 格式，保持结构清晰
5. 评论语言与用户输入语言保持一致
6. 确保输出的是可以直接使用的评论内容，不要包含额外的说明文字`
            },
            'bug-fix': {
                prompt: '请检查这段代码中可能存在的 bug、错误或潜在问题',
                systemPrompt: `你是一个专业的代码调试助手。用户会提供一段代码，请检查代码中可能存在的 bug 或错误。
要求：
1. 仔细分析代码逻辑，找出可能的 bug
2. 指出边界条件处理问题
3. 检查类型错误、空值处理等问题
4. 使用 Markdown 格式，保持简洁
5. 评论语言与用户输入语言保持一致`
            }
        };

        const presetConfig = presets[presetId];
        if (!presetConfig) {
            console.warn('[PetManager] 未知的预设类型:', presetId);
            return;
        }

        console.log('[PetManager] 使用 AI 预设:', presetId, presetConfig.prompt);
        
        // 设置预设提示词
        this.commentState.quickCommentAiPrompt = presetConfig.prompt;
        this.commentState._currentPresetType = presetId;
        this.commentState._currentSystemPrompt = presetConfig.systemPrompt;
        this.commentState.quickCommentAiError = '';
        this.commentState.quickCommentAiResult = '';
        
        // 更新输入框
        const aiInput = document.getElementById('pet-quick-comment-ai-input');
        if (aiInput) {
            aiInput.value = presetConfig.prompt;
        }
        
        // 更新预设按钮状态
        const presetBtns = document.querySelectorAll('.ai-preset-btn');
        presetBtns.forEach(btn => {
            if (btn.dataset.presetId === presetId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 确保在 AI 模式
        if (this.commentState.quickCommentMode !== 'ai') {
            this.setQuickCommentMode('ai');
        }

        // 延迟生成，确保 UI 已更新
        setTimeout(() => {
            this.generateAiComment();
        }, 100);
    };

    // 处理 AI 模式键盘事件
    proto.handleQuickCommentAiKeydown = function(event) {
        // Cmd/Ctrl + Enter 生成或提交
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            if (this.commentState.quickCommentAiResult && !this.commentState.quickCommentAiGenerating && !this.commentState.quickCommentSubmitting) {
                this.submitAiComment();
            } else if (this.commentState.quickCommentAiPrompt.trim() && !this.commentState.quickCommentAiGenerating) {
                this.generateAiComment();
            }
            return;
        }

        // Esc 关闭
        if (event.key === 'Escape') {
            event.preventDefault();
            if (this.commentState.quickCommentAiGenerating) {
                this.stopAiGeneration();
            } else {
                this.closeQuickComment();
            }
            return;
        }
    };

    // 自动调整 AI 输入框高度
    proto.autoResizeQuickCommentAiInput = function() {
        const aiInput = document.getElementById('pet-quick-comment-ai-input');
        if (!aiInput) return;

        aiInput.style.height = 'auto';
        aiInput.style.height = Math.min(aiInput.scrollHeight, 80) + 'px';
    };

    // 生成 AI 评论
    proto.generateAiComment = async function() {
        const prompt = (this.commentState.quickCommentAiPrompt || '').trim();
        if (!prompt) {
            this.showCommentAiError('请输入描述');
            return;
        }

        this.commentState.quickCommentAiGenerating = true;
        this.commentState.quickCommentAiError = '';
        this.commentState.quickCommentAiResult = '';
        
        // 更新 UI
        this.updateAiGeneratingUI(true);

        let accumulated = '';

        try {
            // 检查并确保token已设置
            if (typeof this.ensureTokenSet === 'function') {
                const hasToken = await this.ensureTokenSet();
                if (!hasToken) {
                    throw new Error('请先设置 X-Token');
                }
            } else {
                const token = this.getApiToken ? this.getApiToken() : '';
                if (!token || !token.trim()) {
                    throw new Error('请先设置 X-Token');
                }
            }

            // 确保有当前会话
            if (!this.currentSessionId && typeof this.initSession === 'function') {
                await this.initSession();
            }

            // 使用预设的系统提示词，如果没有则使用默认的
            const systemPrompt = this.commentState._currentSystemPrompt || `你是一个专业的代码审查助手。用户会提供一段代码，请根据用户的要求给出评论或建议。
要求：
1. 评论要专业、具体、有建设性
2. 使用 Markdown 格式，保持简洁
3. 如果是代码改进建议，可以提供改进后的代码示例
4. 评论语言与用户输入语言保持一致
5. 确保输出的是可以直接使用的评论内容，不要包含额外的说明文字`;

            // 构建用户提示
            const codeContext = this.commentState.lastSelectionText
                ? `\n\n代码片段：\n\`\`\`\n${this.commentState.lastSelectionText}\n\`\`\``
                : '';
            const userPrompt = `${prompt}${codeContext}`;

            // 创建 AbortController
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            this.commentState.quickCommentAiAbortController = controller;

            // 构建 payload
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: systemPrompt,
                    user: userPrompt,
                    stream: true
                }
            };

            // 添加模型参数 - 使用 chatModels 的 default 字段
            if (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) {
                payload.parameters.model = PET_CONFIG.chatModels.default;
            }

            // 添加会话ID
            if (this.currentSessionId) {
                payload.parameters.conversation_id = this.currentSessionId;
            }

            // 获取认证头
            if (typeof this.getAuthHeaders !== 'function') {
                throw new Error('getAuthHeaders 方法不可用');
            }

            const authHeaders = this.getAuthHeaders();
            if (!authHeaders || !authHeaders['X-Token']) {
                throw new Error('未设置 X-Token，请先设置 Token');
            }

            // 调用流式 API
            const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
                body: JSON.stringify(payload),
                signal: controller ? controller.signal : undefined
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                // 检查是否已中止
                if (controller && controller.signal.aborted) {
                    reader.cancel();
                    break;
                }

                const { done, value } = await reader.read();
                if (done) break;

                // 解码数据并添加到缓冲区
                buffer += decoder.decode(value, { stream: true });

                // 处理完整的 SSE 消息（SSE 格式使用 \n\n 分隔消息）
                const messages = buffer.split('\n\n');
                buffer = messages.pop() || '';

                for (const message of messages) {
                    if (message.startsWith('data: ')) {
                        try {
                            const dataStr = message.substring(6).trim();
                            if (dataStr === '[DONE]' || dataStr === '') {
                                continue;
                            }

                            const chunk = JSON.parse(dataStr);

                            // 检查是否完成
                            if (chunk.done === true) {
                                break;
                            }

                            // 处理错误
                            if (chunk.type === 'error' || chunk.error) {
                                const errorMsg = chunk.data || chunk.error || '未知错误';
                                throw new Error(errorMsg);
                            }

                            // 支持 Ollama 格式: chunk.message.content
                            if (chunk.message && chunk.message.content) {
                                accumulated += chunk.message.content;
                            }
                            // 支持嵌套格式: chunk.data.message
                            else if (chunk.data && chunk.data.message) {
                                accumulated += chunk.data.message;
                            }
                            // 支持通用格式: chunk.content
                            else if (chunk.content) {
                                accumulated += chunk.content;
                            }
                            // 支持旧的自定义格式: data.type === 'content'
                            else if (chunk.type === 'content' && chunk.data) {
                                accumulated += chunk.data;
                            }
                            // 支持直接字符串格式: chunk.data (string)
                            else if (chunk.data && typeof chunk.data === 'string') {
                                accumulated += chunk.data;
                            }

                            // 实时更新结果（节流更新，每 100ms 更新一次）
                            if (accumulated) {
                                this.commentState.quickCommentAiResult = accumulated;
                                const now = Date.now();
                                if (!this._lastAiUpdate || now - this._lastAiUpdate > 100) {
                                    // 确保结果包装器和结果区域可见
                                    const aiResultWrapper = document.getElementById('pet-quick-comment-ai-result-wrapper');
                                    const aiResult = document.getElementById('pet-quick-comment-ai-result');
                                    if (aiResultWrapper) {
                                        aiResultWrapper.style.display = 'block';
                                    }
                                    if (aiResult) {
                                        aiResult.style.display = 'flex';
                                    }
                                    // 隐藏状态指示器，显示结果
                                    const aiStatus = document.getElementById('pet-quick-comment-ai-status');
                                    if (aiStatus) {
                                        aiStatus.style.display = 'none';
                                    }
                                    this.updateAiResultUI();
                                    this._lastAiUpdate = now;
                                }
                            }
                        } catch (e) {
                            // 如果不是 JSON 解析错误，重新抛出
                            if (e.message && !e.message.includes('JSON')) {
                                throw e;
                            }
                            console.warn('[PetManager] 解析 SSE 消息失败:', message, e);
                        }
                    }
                }
            }

            // 处理最后的缓冲区消息
            if (buffer.trim()) {
                const message = buffer.trim();
                if (message.startsWith('data: ')) {
                    try {
                        const dataStr = message.substring(6).trim();
                        if (dataStr !== '[DONE]' && dataStr) {
                            const chunk = JSON.parse(dataStr);
                            
                            if (chunk.done === true) {
                                // 完成
                            } else if (chunk.type === 'error' || chunk.error) {
                                const errorMsg = chunk.data || chunk.error || '未知错误';
                                throw new Error(errorMsg);
                            } else if (chunk.message && chunk.message.content) {
                                accumulated += chunk.message.content;
                            } else if (chunk.data && chunk.data.message) {
                                accumulated += chunk.data.message;
                            } else if (chunk.content) {
                                accumulated += chunk.content;
                            } else if (chunk.type === 'content' && chunk.data) {
                                accumulated += chunk.data;
                            } else if (chunk.data && typeof chunk.data === 'string') {
                                accumulated += chunk.data;
                            }
                        }
                    } catch (e) {
                        if (e.message && !e.message.includes('JSON')) {
                            throw e;
                        }
                        console.warn('[PetManager] 解析最后的 SSE 消息失败:', e);
                    }
                }
            }

            // 清理结果
            if (accumulated && accumulated.trim()) {
                let cleanedResult = accumulated.trim();
                cleanedResult = cleanedResult
                    .replace(/^```[\w]*\n?/g, '')
                    .replace(/\n?```$/g, '')
                    .trim();
                cleanedResult = cleanedResult.replace(/^(评论|建议|说明|解释)[：:]\s*/i, '');
                this.commentState.quickCommentAiResult = cleanedResult;
                
                console.log('[PetManager] AI 评论生成完成:', {
                    resultLength: cleanedResult.length,
                    resultPreview: cleanedResult.substring(0, 100)
                });
            } else {
                console.warn('[PetManager] AI 生成结果为空');
                this.commentState.quickCommentAiError = 'AI 生成结果为空，请重试';
            }
            
            // 确保最终结果被正确设置并更新 UI
            if (accumulated && accumulated.trim() && !this.commentState.quickCommentAiResult) {
                this.commentState.quickCommentAiResult = accumulated.trim();
            }

        } catch (error) {
            const isAbort = error?.name === 'AbortError' ||
                error?.message?.includes('abort') ||
                error?.message?.includes('cancel');

            if (isAbort) {
                console.log('[PetManager] AI 生成已停止');
                if (!this.commentState.quickCommentAiResult && accumulated) {
                    this.commentState.quickCommentAiResult = accumulated.trim();
                }
            } else {
                console.error('[PetManager] AI 评论生成失败:', error);
                this.showCommentAiError(error.message || 'AI 生成失败，请重试');
                if (accumulated && accumulated.trim()) {
                    this.commentState.quickCommentAiResult = accumulated.trim();
                }
            }
        } finally {
            this.commentState.quickCommentAiGenerating = false;
            this.commentState.quickCommentAiAbortController = null;
            this.commentState._currentPresetType = null;
            this.commentState._currentSystemPrompt = null;
            this._lastAiUpdate = null;
            
            // 更新 UI 状态
            this.updateAiGeneratingUI(false);
            // 确保最终结果被显示
            this.updateAiResultUI();
            
            console.log('[PetManager] AI 生成流程完成，最终状态:', {
                hasResult: !!(this.commentState.quickCommentAiResult && this.commentState.quickCommentAiResult.trim()),
                resultLength: this.commentState.quickCommentAiResult?.length || 0,
                hasError: !!this.commentState.quickCommentAiError
            });
        }
    };

    // 停止 AI 生成
    proto.stopAiGeneration = function() {
        if (this.commentState.quickCommentAiAbortController) {
            try {
                this.commentState.quickCommentAiAbortController.abort();
            } catch (_) { }
            this.commentState.quickCommentAiAbortController = null;
        }
        this.commentState.quickCommentAiGenerating = false;
        this.updateAiGeneratingUI(false);
    };

    // 清空 AI 结果
    proto.clearAiResult = function() {
        this.commentState.quickCommentAiResult = '';
        this.commentState.quickCommentAiError = '';
        if (this.commentState.quickCommentAiAbortController) {
            try {
                this.commentState.quickCommentAiAbortController.abort();
            } catch (_) { }
            this.commentState.quickCommentAiAbortController = null;
        }
        this.commentState.quickCommentAiGenerating = false;
        // 隐藏状态指示器和结果区域
        const aiStatus = document.getElementById('pet-quick-comment-ai-status');
        const aiResultWrapper = document.getElementById('pet-quick-comment-ai-result-wrapper');
        if (aiStatus) aiStatus.style.display = 'none';
        if (aiResultWrapper) aiResultWrapper.style.display = 'none';
        this.updateAiResultUI();
        console.log('[PetManager] 已清空 AI 生成结果');
    };

    // 重新生成 AI 评论
    proto.regenerateAiComment = function() {
        this.commentState.quickCommentAiResult = '';
        this.commentState.quickCommentAiError = '';
        this.generateAiComment();
    };

    // 复制 AI 结果
    proto.copyAiResult = async function() {
        try {
            await navigator.clipboard.writeText(this.commentState.quickCommentAiResult);
            if (typeof this.showNotification === 'function') {
                this.showNotification('已复制到剪贴板', 'success');
            }
        } catch (error) {
            console.error('[PetManager] 复制失败:', error);
        }
    };

    // 提交 AI 评论
    proto.submitAiComment = async function() {
        if (this.commentState.quickCommentSubmitting) {
            return;
        }
        if (this.commentState.quickCommentAiGenerating) {
            return;
        }

        const aiResult = (this.commentState.quickCommentAiResult || '').trim();
        if (!aiResult) {
            this.showCommentAiError('请先生成 AI 评论');
            return;
        }

        // 将 AI 结果填入手动输入框并提交
        const textarea = document.getElementById('pet-quick-comment-textarea');
        if (textarea) {
            textarea.value = aiResult;
            this.commentState.quickCommentText = aiResult;
        }

        // 切换到手动模式并提交
        this.setQuickCommentMode('manual');
        await this.submitQuickComment();
    };

    // 更新 AI 生成中的 UI
    proto.updateAiGeneratingUI = function(isGenerating) {
        const container = document.getElementById('pet-quick-comment-container');
        const aiInput = document.getElementById('pet-quick-comment-ai-input');
        const generateBtn = document.getElementById('pet-quick-comment-ai-generate');
        const stopBtn = document.getElementById('pet-quick-comment-ai-stop');
        const aiResultWrapper = document.getElementById('pet-quick-comment-ai-result-wrapper');
        const aiStatus = document.getElementById('pet-quick-comment-ai-status');
        const aiResult = document.getElementById('pet-quick-comment-ai-result');
        const presets = document.getElementById('pet-quick-comment-ai-presets');

        if (isGenerating) {
            if (container) container.classList.add('ai-generating');
            if (aiInput) aiInput.disabled = true;
            if (generateBtn) generateBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'flex';
            // 显示结果包装器和状态指示器
            if (aiResultWrapper) aiResultWrapper.style.display = 'block';
            if (aiStatus) aiStatus.style.display = 'flex';
            if (presets) presets.style.display = 'none';
            // 更新结果 UI 以显示生成状态
            this.updateAiResultUI();
        } else {
            if (container) container.classList.remove('ai-generating');
            if (aiInput) aiInput.disabled = false;
            if (generateBtn) generateBtn.style.display = 'flex';
            if (stopBtn) stopBtn.style.display = 'none';
            // 隐藏状态指示器
            if (aiStatus) aiStatus.style.display = 'none';
            // 更新结果 UI 以显示最终状态
            this.updateAiResultUI();
        }
    };

    // 更新 AI 结果 UI
    proto.updateAiResultUI = function() {
        const aiResultWrapper = document.getElementById('pet-quick-comment-ai-result-wrapper');
        const aiResult = document.getElementById('pet-quick-comment-ai-result');
        const aiResultText = document.getElementById('pet-quick-comment-ai-result-text');
        const aiResultContent = document.getElementById('pet-quick-comment-ai-result-content');
        const presets = document.getElementById('pet-quick-comment-ai-presets');
        const aiActions = document.getElementById('pet-quick-comment-ai-actions');

        if (!aiResultWrapper || !aiResultContent) {
            console.warn('[PetManager] AI 结果 UI 元素不存在');
            return;
        }

        const isGenerating = this.commentState.quickCommentAiGenerating;
        const hasResult = this.commentState.quickCommentAiResult && this.commentState.quickCommentAiResult.trim();

        if (hasResult || isGenerating) {
            // 显示结果包装器
            aiResultWrapper.style.display = 'block';
            
            if (hasResult) {
                // 有结果，显示结果内容（即使正在生成也显示部分结果）
                aiResult.style.display = 'flex';
                aiResultContent.classList.remove('generating');
                
                // 确保 aiResultText 元素存在
                let resultTextEl = aiResultText;
                if (!resultTextEl) {
                    // 如果不存在，创建它
                    resultTextEl = document.createElement('div');
                    resultTextEl.id = 'pet-quick-comment-ai-result-text';
                    resultTextEl.className = 'ai-result-text';
                    aiResultContent.innerHTML = '';
                    aiResultContent.appendChild(resultTextEl);
                }
                
                // 渲染并显示结果 - 显示 services.ai.chat_service 接口返回的内容
                const html = this.renderQuickCommentAiResult(this.commentState.quickCommentAiResult);
                resultTextEl.innerHTML = html;
                
                if (presets) presets.style.display = 'none';
                if (aiActions) aiActions.style.display = isGenerating ? 'none' : 'flex';
            } else if (isGenerating) {
                // 正在生成但没有结果，不显示结果区域（状态指示器会显示）
                aiResult.style.display = 'none';
            }
        } else {
            // 没有结果且不在生成中，隐藏结果区域，显示预设
            aiResultWrapper.style.display = 'none';
            if (presets) presets.style.display = 'flex';
        }

        // 更新错误提示
        const aiError = document.getElementById('pet-quick-comment-ai-error');
        if (aiError) {
            if (this.commentState.quickCommentAiError) {
                const span = aiError.querySelector('span');
                if (span) span.textContent = this.commentState.quickCommentAiError;
                aiError.style.display = 'flex';
                // 确保错误提示可见
                if (aiResultWrapper) aiResultWrapper.style.display = 'block';
            } else {
                aiError.style.display = 'none';
            }
        }
        
        console.log('[PetManager] AI 结果 UI 已更新:', {
            isGenerating,
            hasResult,
            resultLength: this.commentState.quickCommentAiResult?.length || 0,
            hasError: !!this.commentState.quickCommentAiError
        });
    };

    // 显示 AI 错误
    proto.showCommentAiError = function(message) {
        this.commentState.quickCommentAiError = message;
        this.updateAiResultUI();
        
        setTimeout(() => {
            this.commentState.quickCommentAiError = '';
            this.updateAiResultUI();
        }, 3000);
    };

    // 渲染 AI 结果（简单的 Markdown 渲染）
    proto.renderQuickCommentAiResult = function(text) {
        if (!text) return '';
        
        // 简单的 Markdown 渲染（如果没有 marked.js）
        let html = String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 代码块
        html = html.replace(/```([\w]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        
        // 行内代码
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 粗体
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        
        // 斜体
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        // 换行
        html = html.replace(/\n/g, '<br>');
        
        return html;
    };

    // 处理键盘事件
    proto.handleQuickCommentKeydown = function(event) {
        // Cmd/Ctrl + Enter 提交
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            this.submitQuickComment();
            return;
        }

        // ESC 关闭
        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeQuickComment();
            return;
        }
    };

    // 自动调整文本域高度
    proto.autoResizeQuickCommentTextarea = function() {
        const textarea = document.getElementById('pet-quick-comment-textarea');
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
    };

    // 开始拖拽
    proto.startDragQuickComment = function(event) {
        event.preventDefault();
        event.stopPropagation();

        // 如果正在缩放，不启动拖拽
        if (this.commentState.isResizingQuickComment) {
            return;
        }

        this.commentState.isDraggingQuickComment = true;

        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = this.commentState.quickCommentPosition.left;
        const startTop = this.commentState.quickCommentPosition.top;

        const container = document.getElementById('pet-quick-comment-container');
        if (!container) return;

        const containerWidth = this.commentState.quickCommentPosition.width || container.offsetWidth;
        const containerHeight = this.commentState.quickCommentPosition.height || container.offsetHeight;
        const padding = 16;

        const onMouseMove = (e) => {
            if (!this.commentState.isDraggingQuickComment) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const minLeft = padding;
            const minTop = padding;
            const maxLeft = vw - containerWidth - padding;
            const maxTop = vh - containerHeight - padding;

            newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
            newTop = Math.max(minTop, Math.min(newTop, maxTop));

            this.commentState.quickCommentPosition.left = newLeft;
            this.commentState.quickCommentPosition.top = newTop;

            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
            container.style.transition = 'none';
        };

        const onMouseUp = () => {
            this.commentState.isDraggingQuickComment = false;
            if (container) {
                container.style.transition = '';
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // 初始化缩放
    proto.initResizeQuickComment = function(event, position) {
        event.preventDefault();
        event.stopPropagation();

        // 如果正在拖拽，不启动缩放
        if (this.commentState.isDraggingQuickComment) {
            return;
        }

        this.commentState.isResizingQuickComment = true;

        const container = document.getElementById('pet-quick-comment-container');
        if (!container) return;

        container.classList.add('resizing');

        const startX = event.clientX;
        const startY = event.clientY;
        const startRect = container.getBoundingClientRect();
        const minWidth = 400;
        const minHeight = 300;
        const maxWidth = window.innerWidth * 0.95;
        const maxHeight = window.innerHeight * 0.95;

        const onMouseMove = (e) => {
            if (!this.commentState.isResizingQuickComment) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newWidth = startRect.width;
            let newHeight = startRect.height;
            let newLeft = startRect.left;
            let newTop = startRect.top;

            // 根据位置调整
            if (position.includes('e')) {
                // 右侧
                newWidth = Math.min(maxWidth, Math.max(minWidth, startRect.width + dx));
            }
            if (position.includes('s')) {
                // 下侧
                newHeight = Math.min(maxHeight, Math.max(minHeight, startRect.height + dy));
            }
            if (position.includes('w')) {
                // 左侧
                const width = Math.min(maxWidth, Math.max(minWidth, startRect.width - dx));
                newLeft = startRect.left + (startRect.width - width);
                newWidth = width;
            }
            if (position.includes('n')) {
                // 上侧
                const height = Math.min(maxHeight, Math.max(minHeight, startRect.height - dy));
                newTop = startRect.top + (startRect.height - height);
                newHeight = height;
            }

            // 确保不超出视口
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const padding = 16;

            if (newLeft < padding) {
                newLeft = padding;
                if (position.includes('w')) {
                    newWidth = startRect.right - padding;
                }
            }
            if (newTop < padding) {
                newTop = padding;
                if (position.includes('n')) {
                    newHeight = startRect.bottom - padding;
                }
            }
            if (newLeft + newWidth > vw - padding) {
                newWidth = vw - newLeft - padding;
            }
            if (newTop + newHeight > vh - padding) {
                newHeight = vh - newTop - padding;
            }

            // 应用新尺寸和位置
            container.style.width = `${newWidth}px`;
            container.style.height = `${newHeight}px`;
            container.style.left = `${newLeft}px`;
            container.style.top = `${newTop}px`;
            container.style.transition = 'none';

            // 更新状态
            this.commentState.quickCommentPosition = {
                ...this.commentState.quickCommentPosition,
                left: newLeft,
                top: newTop,
                width: newWidth,
                height: newHeight
            };
        };

        const onMouseUp = () => {
            this.commentState.isResizingQuickComment = false;
            if (container) {
                container.classList.remove('resizing');
                container.style.transition = '';
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // 提交评论
    proto.submitQuickComment = async function() {
        const textarea = document.getElementById('pet-quick-comment-textarea');
        if (!textarea) return;

        const text = textarea.value.trim();
        
        // 检查是否有引用代码
        const quoteCodeElement = document.getElementById('pet-quick-comment-quote-code');
        const quotedCode = quoteCodeElement ? quoteCodeElement.textContent || quoteCodeElement.innerText || '' : '';
        const quotedCodeTrimmed = quotedCode.trim();
        
        // 如果没有评论内容也没有引用代码，则提示错误
        if (!text && !quotedCodeTrimmed) {
            this.showCommentError('请输入评论内容或选中需要评论的代码');
            return;
        }

        // 检查并确保token已设置（在设置提交状态之前）
        if (typeof this.ensureTokenSet === 'function') {
            const hasToken = await this.ensureTokenSet();
            if (!hasToken) {
                this.showCommentError('请先设置 X-Token');
                return;
            }
        } else {
            // 降级检查：直接检查token
            const token = this.getApiToken ? this.getApiToken() : '';
            if (!token || !token.trim()) {
                this.showCommentError('请先设置 X-Token');
                if (typeof this.openAuth === 'function') {
                    this.openAuth();
                }
                return;
            }
        }

        this.commentState.quickCommentSubmitting = true;
        const submitBtn = document.getElementById('pet-quick-comment-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            const icon = submitBtn.querySelector('i');
            const span = submitBtn.querySelector('span');
            if (icon) icon.className = 'fas fa-spinner fa-spin';
            if (span) span.textContent = '提交中...';
        }

        try {

            // 确保有当前会话
            if (!this.currentSessionId && typeof this.initSession === 'function') {
                await this.initSession();
            }
            
            // 构建系统提示词，根据是否有引用代码调整
            let systemPrompt = '你是一个专业的评论助手，能够对用户提供的内容进行专业的评论和分析。';
            if (quotedCodeTrimmed && text) {
                systemPrompt = '你是一个专业的评论助手，能够对用户选中的代码进行专业的评论和分析。请结合用户提供的评论内容，对引用代码进行深入分析。';
            } else if (quotedCodeTrimmed) {
                systemPrompt = '你是一个专业的代码分析助手，能够对用户选中的代码进行专业的分析和评论。请对提供的代码进行详细分析，包括代码逻辑、潜在问题、优化建议等。';
            }

            // 直接构建 user 参数，确保引用代码完整包含
            let userParam = '';
            
            // 如果有引用代码内容，将其作为主要内容放在user参数中
            if (quotedCodeTrimmed) {
                // 使用结构化格式：引用代码 + 评论内容
                if (text) {
                    userParam = `【引用代码】\n\`\`\`\n${quotedCodeTrimmed}\n\`\`\`\n\n【评论】\n${text}`;
                } else {
                    // 如果只有引用代码没有评论，使用代码块格式
                    userParam = `【引用代码】\n\`\`\`\n${quotedCodeTrimmed}\n\`\`\``;
                }
            } else {
                // 如果没有引用代码，直接使用评论内容
                userParam = text;
            }

            // 直接构建 payload，不使用 buildPromptPayload（避免清理逻辑影响引用代码）
            const payload = {
                module_name: 'services.ai.chat_service',
                method_name: 'chat',
                parameters: {
                    system: systemPrompt,
                    user: userParam, // 直接使用构建的user参数，确保引用代码完整包含
                    stream: false
                }
            };

            // 添加模型参数 - 使用 chatModels 的 default 字段
            if (PET_CONFIG.chatModels && PET_CONFIG.chatModels.default) {
                payload.parameters.model = PET_CONFIG.chatModels.default;
            }

            // 添加会话ID
            if (this.currentSessionId) {
                payload.parameters.conversation_id = this.currentSessionId;
            }

            // 获取认证头
            if (typeof this.getAuthHeaders !== 'function') {
                throw new Error('getAuthHeaders 方法不可用');
            }

            const authHeaders = this.getAuthHeaders();
            if (!authHeaders || !authHeaders['X-Token']) {
                throw new Error('未设置 X-Token，请先设置 Token');
            }

            // 调试日志：确保引用代码已包含在user参数中
            const userParamFull = payload.parameters.user;
            const userParamPreview = userParamFull.length > 300 
                ? userParamFull.substring(0, 300) + '...' 
                : userParamFull;
            console.log('[PetManager] 提交评论请求:', {
                url: PET_CONFIG.api.yiaiBaseUrl,
                hasQuotedCode: !!quotedCodeTrimmed,
                quotedCodeLength: quotedCodeTrimmed.length,
                quotedCodeFromDOM: quotedCodeTrimmed.substring(0, 100) + (quotedCodeTrimmed.length > 100 ? '...' : ''),
                userParamLength: userParamFull.length,
                userParamContainsQuotedCode: userParamFull.includes(quotedCodeTrimmed),
                userParamPreview: userParamPreview,
                userParamFull: userParamFull // 完整内容用于调试
            });

            // 调用 services.ai.chat_service 接口
            const response = await fetch(PET_CONFIG.api.yiaiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}: ${errorText || response.statusText}`;
                
                // 针对401错误提供更友好的提示
                if (response.status === 401) {
                    errorMessage = '认证失败，请检查 X-Token 是否正确设置';
                    // 如果token可能无效，提示用户重新设置
                    if (typeof this.openAuth === 'function') {
                        setTimeout(() => {
                            if (confirm('Token 可能已失效，是否重新设置？')) {
                                this.openAuth();
                            }
                        }, 100);
                    }
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            if (!result || typeof result !== 'object') {
                throw new Error('响应格式错误');
            }
            if (result.code !== 0) {
                throw new Error(result.message || `请求失败 (code=${result.code})`);
            }

            console.log('[PetManager] 评论提交成功:', result);

            // 提取返回的 message
            const data = result.data || {};
            let messageContent =
                (typeof data.message === 'string' ? data.message : '') ||
                (typeof data.content === 'string' ? data.content : '') ||
                (typeof result.content === 'string' ? result.content : '');

            // 如果有返回的 message，渲染到 AI 结果区域
            if (messageContent && messageContent.trim()) {
                this.renderAiResponse(messageContent);
            }

            // 显示成功提示
            if (typeof this.showNotification === 'function') {
                this.showNotification('评论已提交', 'success');
            }

            // 不清空引用代码，保持弹框打开，只清空输入框
            const textarea = document.getElementById('pet-quick-comment-textarea');
            if (textarea) {
                textarea.value = '';
                // 重置高度
                textarea.style.height = 'auto';
                // 重新聚焦输入框，方便继续输入
                setTimeout(() => {
                    textarea.focus();
                }, 100);
            }
            
            // 清空错误信息和状态
            this.commentState.quickCommentError = '';
            this.commentState.quickCommentText = '';
            const errorEl = document.getElementById('pet-quick-comment-error');
            if (errorEl) {
                errorEl.style.display = 'none';
            }

            // 保持弹框打开，不清空引用代码，允许继续输入
            // 不调用 closeQuickComment()
            // 引用代码保持显示，方便用户继续评论同一段代码
            console.log('[PetManager] 评论提交成功，弹框保持打开，可继续输入');

        } catch (error) {
            console.error('[PetManager] 提交评论失败:', error);
            this.showCommentError(error.message || '提交失败，请重试');
        } finally {
            this.commentState.quickCommentSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                const icon = submitBtn.querySelector('i');
                const span = submitBtn.querySelector('span');
                if (icon) icon.className = 'fas fa-paper-plane';
                if (span) span.textContent = '提交';
            }
        }
    };

    // 显示错误信息
    proto.showCommentError = function(message) {
        const errorEl = document.getElementById('pet-quick-comment-error');
        if (errorEl) {
            const span = errorEl.querySelector('span');
            if (span) span.textContent = message;
            errorEl.style.display = 'flex';
            
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 3000);
        }
    };

    // 渲染 AI 回复结果
    proto.renderAiResponse = function(message) {
        const responseContainer = document.getElementById('pet-quick-comment-ai-response');
        const responseContent = document.getElementById('pet-quick-comment-ai-response-content');
        
        if (!responseContainer || !responseContent) {
            console.warn('[PetManager] AI 回复容器不存在');
            return;
        }

        // 使用 Markdown 渲染
        const html = this.renderQuickCommentAiResult(message);
        responseContent.innerHTML = html;
        
        // 显示容器
        responseContainer.style.display = 'block';
        
        // 滚动到结果区域
        setTimeout(() => {
            responseContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    };

    // 清理资源
    proto.cleanupCommentFeature = function() {
        if (this.commentState._quickCommentOutsideClickHandler) {
            document.removeEventListener('mousedown', this.commentState._quickCommentOutsideClickHandler);
        }
        
        const container = document.getElementById('pet-quick-comment-container');
        if (container) {
            container.remove();
        }
    };

})();

