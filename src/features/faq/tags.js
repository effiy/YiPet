;(function() {
  'use strict';
  if (typeof window.PetManager === 'undefined') return;
  const proto = window.PetManager.prototype;

  proto.openFaqTagManager = function(faqIndex) {
        const modal = this.chatWindow?.querySelector('#pet-faq-manager');
        if (!modal || !modal._currentFaqs) return;

        const faq = modal._currentFaqs[faqIndex];
        if (!faq) return;

        const currentTags = faq.tags || [];

        this.ensureFaqTagManagerUi();
        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        if (!tagModal) {
            console.error('常见问题标签管理弹窗未找到');
            return;
        }

        tagModal.dataset.faqIndex = faqIndex;

        tagModal.hidden = false;
        if (typeof this.setHeaderToggleButtonsHidden === 'function') {
            this.setHeaderToggleButtonsHidden(true, 'faq-tag-manager');
        } else {
            const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
            const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
            if (sidebarToggleBtn) sidebarToggleBtn.hidden = true;
            if (inputToggleBtn) inputToggleBtn.hidden = true;
        }

        this.loadFaqTagsIntoManager(faqIndex, currentTags);

        const closeBtn = tagModal.querySelector('.faq-tag-manager-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeFaqTagManager();
        }

        const saveBtn = tagModal.querySelector('.faq-tag-manager-save');
        if (saveBtn) {
            saveBtn.onclick = () => this.saveFaqTags(faqIndex);
        }

        const tagInput = tagModal.querySelector('.faq-tag-manager-input');
        if (tagInput) {
            if (tagInput._isComposing === undefined) {
                tagInput._isComposing = false;
                tagInput.addEventListener('compositionstart', () => {
                    tagInput._isComposing = true;
                });
                tagInput.addEventListener('compositionend', () => {
                    tagInput._isComposing = false;
                });
            }

            const existingHandler = tagInput._enterKeyHandler;
            if (existingHandler) {
                tagInput.removeEventListener('keydown', existingHandler);
            }

            const enterKeyHandler = (e) => {
                if (tagInput._isComposing) {
                    return;
                }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addFaqTagFromInput(faqIndex);
                }
            };

            tagInput._enterKeyHandler = enterKeyHandler;
            tagInput.addEventListener('keydown', enterKeyHandler);

            tagInput.focus();
        }

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeFaqTagManager();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        tagModal._escHandler = escHandler;
    };

  proto.closeFaqTagManager = function() {
        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        if (!tagModal) return;

        tagModal.hidden = true;
        if (typeof this.setHeaderToggleButtonsHidden === 'function') {
            this.setHeaderToggleButtonsHidden(false, 'faq-tag-manager');
        } else {
            const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
            const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
            if (sidebarToggleBtn) sidebarToggleBtn.hidden = false;
            if (inputToggleBtn) inputToggleBtn.hidden = false;
        }

        const escHandler = tagModal._escHandler;
        if (escHandler) {
            document.removeEventListener('keydown', escHandler);
            tagModal._escHandler = null;
        }
    };

  proto.ensureFaqTagManagerUi = function() {
        if (!this.chatWindow) return;
        if (this.chatWindow.querySelector('#pet-faq-tag-manager')) return;

        const modal = document.createElement('div');
        modal.id = 'pet-faq-tag-manager';
        modal.className = 'tw-fixed tw-inset-0 tw-bg-black-25 tw-flex tw-items-center tw-justify-center tw-z-modal';
        modal.hidden = true;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeFaqTagManager();
            }
        });

        const panel = document.createElement('div');
        panel.className = 'tw-bg-white tw-rounded-lg tw-p-4 tw-w-full tw-max-w-90 tw-max-h-80vh tw-overflow-y-auto tw-shadow';

        const header = document.createElement('div');
        header.className = 'tw-flex tw-justify-between tw-items-center tw-mb-2';

        const title = document.createElement('h3');
        title.textContent = '管理标签';
        title.className = 'tw-text-base tw-font-semibold tw-text-gray-700';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.className = 'tw-btn tw-btn-light';
        closeBtn.classList.add('faq-tag-manager-close');

        header.appendChild(title);
        header.appendChild(closeBtn);

        const inputGroup = document.createElement('div');
        inputGroup.className = 'faq-tag-manager-input-group';
        inputGroup.className = 'faq-tag-manager-input-group tw-flex tw-gap-2 tw-mb-2';

        const tagInput = document.createElement('input');
        tagInput.type = 'text';
        tagInput.placeholder = '输入标签名称，按回车添加';
        tagInput.className = 'faq-tag-manager-input tw-input';

        tagInput._isComposing = false;
        tagInput.addEventListener('compositionstart', () => {
            tagInput._isComposing = true;
        });
        tagInput.addEventListener('compositionend', () => {
            tagInput._isComposing = false;
        });

        const addBtn = document.createElement('button');
        addBtn.textContent = '添加';
        addBtn.className = 'faq-tag-manager-add-btn tw-btn';
        addBtn.addEventListener('click', () => {
            const faqIndex = modal.dataset.faqIndex;
            if (faqIndex !== undefined) {
                this.addFaqTagFromInput(parseInt(faqIndex));
            }
        });

        const smartGenerateBtn = document.createElement('button');
        smartGenerateBtn.textContent = '✨ 智能生成';
        smartGenerateBtn.className = 'faq-tag-manager-smart-generate tw-btn';
        smartGenerateBtn.addEventListener('click', () => {
            const faqIndex = modal.dataset.faqIndex;
            if (faqIndex !== undefined) {
                this.generateFaqSmartTags(parseInt(faqIndex), smartGenerateBtn);
            }
        });

        inputGroup.appendChild(tagInput);
        inputGroup.appendChild(addBtn);
        inputGroup.appendChild(smartGenerateBtn);

        const quickTagsContainer = document.createElement('div');
        quickTagsContainer.className = 'faq-tag-manager-quick-tags';
        quickTagsContainer.className = 'faq-tag-manager-quick-tags tw-flex tw-flex-wrap tw-gap-2 tw-mb-2';

        const quickTags = ['工具', '开源项目', '家庭', '工作', '娱乐', '文档', '日记'];
        quickTags.forEach(tagName => {
            const quickTagBtn = document.createElement('button');
            quickTagBtn.textContent = tagName;
            quickTagBtn.className = 'faq-tag-manager-quick-tag-btn';
            quickTagBtn.dataset.tagName = tagName;
            quickTagBtn.className = 'faq-tag-manager-quick-tag-btn tw-chip';
            quickTagBtn.addEventListener('click', () => {
                const faqIndex = modal.dataset.faqIndex;
                if (faqIndex !== undefined) {
                    this.addFaqQuickTag(parseInt(faqIndex), tagName);
                }
            });
            quickTagsContainer.appendChild(quickTagBtn);
        });

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'faq-tag-manager-tags tw-overflow-y-auto faq-tag-manager-tags-box';

        const footer = document.createElement('div');
        footer.className = 'tw-flex tw-justify-end tw-gap-2';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'tw-btn tw-btn-light';
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.classList.add('tw-transition');
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.classList.remove('tw-transition');
        });
        cancelBtn.addEventListener('click', () => this.closeFaqTagManager());

        const saveBtn = document.createElement('button');
        saveBtn.className = 'faq-tag-manager-save';
        saveBtn.textContent = '保存';
        saveBtn.className = 'faq-tag-manager-save tw-btn faq-tag-manager-save-btn';

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        panel.appendChild(header);
        panel.appendChild(inputGroup);
        panel.appendChild(quickTagsContainer);
        panel.appendChild(tagsContainer);
        panel.appendChild(footer);
        modal.appendChild(panel);
        this.chatWindow.appendChild(modal);
    };

  proto.loadFaqTagsIntoManager = function(faqIndex, tags) {
        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        if (!tagModal) return;

        if (!tags) {
            tags = [];
        }
        tagModal._currentTags = tags.map(tag => tag ? tag.trim() : '').filter(tag => tag.length > 0);

        const tagsContainer = tagModal.querySelector('.faq-tag-manager-tags');
        if (tagsContainer) {
            tagsContainer.innerHTML = '';
        }

        this.ensureFaqManagerUi();
        const faqModal = this.chatWindow?.querySelector('#pet-faq-manager');
        const modal = faqModal;
        if (!modal || !modal._currentFaqs) return;

        const faq = modal._currentFaqs[faqIndex];
        if (!faq) return;

        const createTagChip = (tagName, index) => {
            const tagChip = document.createElement('div');
            tagChip.className = 'faq-tag-chip';

            const tagLabel = document.createElement('span');
            tagLabel.textContent = tagName;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.title = '删除标签';
            removeBtn.className = 'faq-tag-chip-remove';
            removeBtn.addEventListener('click', () => this.removeFaqTag(faqIndex, index));

            tagChip.appendChild(tagLabel);
            tagChip.appendChild(removeBtn);
            return tagChip;
        };

        if (tagsContainer) {
            tagModal._currentTags.forEach((tagName, index) => {
                const tagChip = createTagChip(tagName, index);
                tagsContainer.appendChild(tagChip);
            });
        }

        const quickTagButtons = tagModal.querySelectorAll('.faq-tag-manager-quick-tag-btn');
        quickTagButtons.forEach(btn => {
            const tagName = btn.dataset.tagName || btn.textContent;
            if (tagModal._currentTags.includes(tagName)) {
                btn.classList.add('is-selected');
                btn.disabled = true;
            } else {
                btn.classList.remove('is-selected');
                btn.disabled = false;
            }
        });
    };

  proto.addFaqTagFromInput = function(faqIndex) {
        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        if (!tagModal) return;

        const tagInput = tagModal.querySelector('.faq-tag-manager-input');
        if (!tagInput) return;

        const tagName = tagInput.value.trim();
        if (!tagName) return;

        if (!tagModal._currentTags) {
            tagModal._currentTags = [];
        }

        if (tagModal._currentTags.includes(tagName)) {
            tagInput.value = '';
            tagInput.focus();
            return;
        }

        tagModal._currentTags.push(tagName);
        tagInput.value = '';
        tagInput.focus();
        this.loadFaqTagsIntoManager(faqIndex, tagModal._currentTags);
    };

  proto.addFaqQuickTag = function(faqIndex, tagName) {
        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        if (!tagModal) return;

        if (!tagModal._currentTags) {
            tagModal._currentTags = [];
        }

        if (tagModal._currentTags.includes(tagName)) {
            return;
        }

        tagModal._currentTags.push(tagName);
        this.loadFaqTagsIntoManager(faqIndex, tagModal._currentTags);
    };

  proto.removeFaqTag = function(faqIndex, index) {
        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        if (!tagModal || !tagModal._currentTags) return;

        tagModal._currentTags.splice(index, 1);
        this.loadFaqTagsIntoManager(faqIndex, tagModal._currentTags);
    };

  proto.saveFaqTags = async function(faqIndex) {
        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        const modal = this.chatWindow?.querySelector('#pet-faq-manager');
        if (!tagModal || !modal || !modal._currentFaqs) return;

        const faq = modal._currentFaqs[faqIndex];
        if (!faq) return;

        const newTags = (tagModal._currentTags || [])
            .map(tag => tag ? tag.trim() : '')
            .filter(tag => tag.length > 0);
        faq.tags = [...new Set(newTags)];

        try {
            if (this.faqApi && this.faqApi.isEnabled()) {
                // 使用 key 作为标识符（参考 YiWeb 实现）
                const key = String(faq?.key || '').trim();
                if (!key) {
                    throw new Error('无法确定常见问题的标识符');
                }
                await this.faqApi.updateFaq(key, {
                    tags: faq.tags
                });

                if (this.faqApi.clearGetCache) {
                    this.faqApi.clearGetCache();
                }
                const targetFaq = modal._currentFaqs.find(f => f.key === faq.key);
                if (targetFaq) {
                    targetFaq.tags = faq.tags;
                }
                await this.loadFaqsIntoManager();
                this.updateFaqTagFilterUI();
                this.closeFaqTagManager();
                this.showNotification('标签已保存', 'success');
            } else {
                await this.saveFaqs(modal._currentFaqs);
                await this.loadFaqsIntoManager();
                this.updateFaqTagFilterUI();
                this.closeFaqTagManager();
                this.showNotification('标签已保存', 'success');
            }
        } catch (error) {
            console.error('保存标签失败:', error);
            this.showNotification('保存失败，请重试', 'error');
        }
    };

  proto.generateFaqSmartTags = async function(faqIndex, buttonElement) {
        const modal = this.chatWindow?.querySelector('#pet-faq-manager');
        if (!modal || !modal._currentFaqs) {
            console.warn('常见问题管理器未找到，无法生成标签');
            return;
        }

        const faq = modal._currentFaqs[faqIndex];
        if (!faq) {
            console.warn('常见问题不存在，无法生成标签:', faqIndex);
            return;
        }

        const tagModal = this.chatWindow?.querySelector('#pet-faq-tag-manager');
        if (!tagModal) {
            console.error('常见问题标签管理弹窗未找到');
            return;
        }

        if (buttonElement) {
            buttonElement.disabled = true;
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '生成中...';

            try {
                const systemPrompt = `你是一个专业的标签生成助手。根据用户提供的常见问题内容，生成合适的标签。

标签要求：
1. 标签应该简洁明了，每个标签2-6个汉字或3-12个英文字符
2. 标签应该准确反映问题的核心主题
3. 生成3-8个标签
4. 标签之间用逗号分隔
5. 只返回标签，不要返回其他说明文字
6. 如果已有标签，避免生成重复的标签

输出格式示例：技术,编程,前端开发,JavaScript`;

                let userPrompt = `常见问题内容：\n${faq.text || ''}`;
                const currentTags = tagModal._currentTags || [];
                if (currentTags.length > 0) {
                    userPrompt += `\n\n已有标签：${currentTags.join(', ')}\n请避免生成重复的标签。`;
                }
                userPrompt += `\n\n请根据以上信息生成合适的标签。`;
            } catch (e) {
            } finally {
                if (buttonElement) {
                    buttonElement.disabled = false;
                    buttonElement.textContent = '✨ 智能生成';
                }
            }
        }
    };
})();
