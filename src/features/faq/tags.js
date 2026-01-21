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

        tagModal.style.display = 'flex';
        tagModal.dataset.faqIndex = faqIndex;

        const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
        if (inputToggleBtn) inputToggleBtn.style.display = 'none';

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

  proto.ensureFaqTagManagerUi = function() {
        if (!this.chatWindow) return;
        if (this.chatWindow.querySelector('#pet-faq-tag-manager')) return;

        const modal = document.createElement('div');
        modal.id = 'pet-faq-tag-manager';
        modal.className = 'tw-fixed tw-inset-0 tw-bg-black-25 tw-hidden tw-items-center tw-justify-center tw-z-modal';

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
        closeBtn.className = 'faq-tag-manager-close';
        closeBtn.innerHTML = '✕';
        closeBtn.className = 'tw-btn tw-btn-light';
        closeBtn.style.width = '30px';
        closeBtn.style.height = '30px';
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.classList.add('tw-transition');
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.classList.remove('tw-transition');
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        const inputGroup = document.createElement('div');
        inputGroup.className = 'faq-tag-manager-input-group';
        inputGroup.className = 'faq-tag-manager-input-group tw-flex tw-gap-2 tw-mb-2';

        const tagInput = document.createElement('input');
        tagInput.className = 'faq-tag-manager-input';
        tagInput.type = 'text';
        tagInput.placeholder = '输入标签名称，按回车添加';
        tagInput.className = 'faq-tag-manager-input tw-input';
        tagInput.style.flex = '1';

        tagInput._isComposing = false;
        tagInput.addEventListener('compositionstart', () => {
            tagInput._isComposing = true;
        });
        tagInput.addEventListener('compositionend', () => {
            tagInput._isComposing = false;
        });

        tagInput.addEventListener('focus', () => {
            tagInput.style.borderColor = '#22c55e';  /* 现代绿 */
        });
        tagInput.addEventListener('blur', () => {
            tagInput.style.borderColor = '#e0e0e0';
        });

        const addBtn = document.createElement('button');
        addBtn.textContent = '添加';
        addBtn.className = 'tw-btn';
        addBtn.style.background = '#4CAF50';
        addBtn.style.color = '#fff';
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.background = '#45a049';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.background = '#22c55e';  /* 现代绿 */
        });
        addBtn.addEventListener('click', () => {
            const faqIndex = modal.dataset.faqIndex;
            if (faqIndex !== undefined) {
                this.addFaqTagFromInput(parseInt(faqIndex));
            }
        });

        const smartGenerateBtn = document.createElement('button');
        smartGenerateBtn.className = 'faq-tag-manager-smart-generate';
        smartGenerateBtn.textContent = '✨ 智能生成';
        smartGenerateBtn.className = 'tw-btn';
        smartGenerateBtn.style.background = '#9C27B0';
        smartGenerateBtn.style.color = '#fff';
        smartGenerateBtn.style.whiteSpace = 'nowrap';
        smartGenerateBtn.addEventListener('mouseenter', () => {
            if (!smartGenerateBtn.disabled) {
                smartGenerateBtn.style.background = '#7B1FA2';
            }
        });
        smartGenerateBtn.addEventListener('mouseleave', () => {
            if (!smartGenerateBtn.disabled) {
                smartGenerateBtn.style.background = '#9C27B0';
            }
        });
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
            quickTagBtn.className = 'tw-chip';
            quickTagBtn.addEventListener('mouseenter', () => {
                if (quickTagBtn.style.background === 'rgb(76, 175, 80)') {
                    return;
                }
                quickTagBtn.style.borderColor = '#22c55e';  /* 现代绿 */
            });
            quickTagBtn.addEventListener('mouseleave', () => {
                if (quickTagBtn.style.background === 'rgb(76, 175, 80)') {
                    return;
                }
            });
            quickTagBtn.addEventListener('click', () => {
                if (quickTagBtn.style.cursor === 'not-allowed') {
                    return;
                }
                const faqIndex = modal.dataset.faqIndex;
                if (faqIndex !== undefined) {
                    this.addFaqQuickTag(parseInt(faqIndex), tagName);
                }
            });
            quickTagsContainer.appendChild(quickTagBtn);
        });

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'faq-tag-manager-tags';
        tagsContainer.className = 'faq-tag-manager-tags tw-overflow-y-auto';
        tagsContainer.style.minHeight = '100px';
        tagsContainer.style.maxHeight = '300px';
        tagsContainer.style.marginBottom = '20px';
        tagsContainer.style.padding = '12px';
        tagsContainer.style.background = '#0f172a';  /* 深空黑 */
        tagsContainer.style.borderRadius = '6px';

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
        saveBtn.className = 'tw-btn';
        saveBtn.style.background = '#3b82f6';  /* 信息蓝 */
        saveBtn.style.color = '#fff';
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = '#1976D2';
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = '#3b82f6';  /* 信息蓝 */
        });

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
            tagChip.style.cssText = `
                display: inline-flex !important;
                align-items: center !important;
                gap: 8px !important;
                padding: 6px 12px !important;
                margin: 6px !important;
                background: #e8f5e9 !important;
                color: #2e7d32 !important;
                border: 1px solid #c8e6c9 !important;
                border-radius: 16px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
                transition: all 0.2s ease !important;
            `;

            const tagLabel = document.createElement('span');
            tagLabel.textContent = tagName;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.title = '删除标签';
            removeBtn.style.cssText = `
                background: transparent !important;
                border: none !important;
                color: #2e7d32 !important;
                cursor: pointer !important;
                font-size: 13px !important;
                padding: 0 !important;
                width: 18px !important;
                height: 18px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 50% !important;
                transition: all 0.2s ease !important;
            `;
            removeBtn.addEventListener('mouseenter', () => {
                removeBtn.style.background = 'rgba(46, 125, 50, 0.1)';
            });
            removeBtn.addEventListener('mouseleave', () => {
                removeBtn.style.background = 'transparent';
            });
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
                btn.style.background = '#22c55e';  /* 现代绿 */
                btn.style.color = 'white';
                btn.style.borderColor = '#22c55e';
                btn.style.cursor = 'not-allowed';
                btn.style.opacity = '0.8';
            } else {
                btn.style.cursor = 'pointer';
                btn.style.opacity = '1';
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
            buttonElement.style.background = '#ccc';
            buttonElement.style.cursor = 'not-allowed';
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
                    buttonElement.style.background = '#9C27B0';
                    buttonElement.style.cursor = 'pointer';
                    buttonElement.textContent = '✨ 智能生成';
                }
            }
        }
    };
})();

