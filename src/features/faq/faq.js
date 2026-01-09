;(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return;
  }
  const proto = window.PetManager.prototype;

  proto.ensureFaqManagerUi = function() {
    if (!this.chatWindow) return;
    if (this.chatWindow.querySelector('#pet-faq-manager')) return;

    const modal = document.createElement('div');
    modal.id = 'pet-faq-manager';
    modal.className = 'tw-absolute tw-inset-0 tw-bg-black-25 tw-hidden tw-items-center tw-justify-center tw-z-modal';

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeFaqManagerOnly();
      }
    });

    const panel = document.createElement('div');
    panel.className = 'panel';

    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h3');
    title.textContent = '💡 常见问题';
    title.className = 'title';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'faq-manager-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = '关闭（ESC）';
    closeBtn.classList.add('tw-btn', 'tw-btn-light');
    closeBtn.style.width = '28px';
    closeBtn.style.height = '28px';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.classList.add('tw-btn-light');
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.classList.remove('tw-btn-light');
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const searchFilterGroup = document.createElement('div');
    searchFilterGroup.className = 'tw-flex tw-flex-col tw-gap-2 tw-mb-2';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'faq-search-input';
    searchInput.placeholder = '搜索常见问题...';
    searchInput.classList.add('tw-input', 'tw-w-full');

    const clearSearchBtn = document.createElement('button');
    clearSearchBtn.textContent = '清除';
    clearSearchBtn.className = 'tw-btn tw-btn-light';

    const updateClearSearchBtn = () => {
      const hasValue = (this.faqSearchFilter || '').trim().length > 0;
      clearSearchBtn.style.opacity = hasValue ? '0.9' : '0.4';
      clearSearchBtn.style.cursor = hasValue ? 'pointer' : 'default';
    };
    updateClearSearchBtn();

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      updateClearSearchBtn();
      this.faqSearchFilter = '';
      this.loadFaqsIntoManager();
      searchInput.focus();
    });

    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      this.faqSearchFilter = value;
      updateClearSearchBtn();
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        this.loadFaqsIntoManager();
      }, 300);
    });

    const tagFilterContainer = document.createElement('div');
    tagFilterContainer.className = 'faq-tag-filter-container';
    tagFilterContainer.classList.add('tw-flex', 'tw-flex-col', 'tw-gap-1');

    const tagFilterActions = document.createElement('div');
    tagFilterActions.className = 'tw-flex tw-items-center tw-gap-2';

    const reverseFilterBtn = document.createElement('button');
    reverseFilterBtn.textContent = '反选';
    reverseFilterBtn.title = '不包含选中标签';
    reverseFilterBtn.className = 'tw-btn tw-btn-light';

    const noTagsFilterBtn = document.createElement('button');
    noTagsFilterBtn.textContent = '无标签';
    noTagsFilterBtn.title = '只显示无标签问题';
    noTagsFilterBtn.className = 'tw-btn tw-btn-light';

    const clearFilterBtn = document.createElement('button');
    clearFilterBtn.textContent = '清除标签筛选';
    clearFilterBtn.className = 'tw-btn tw-btn-light';

    tagFilterActions.appendChild(reverseFilterBtn);
    tagFilterActions.appendChild(noTagsFilterBtn);
    tagFilterActions.appendChild(clearFilterBtn);
    tagFilterContainer.appendChild(tagFilterActions);
    searchFilterGroup.appendChild(searchInput);
    searchFilterGroup.appendChild(clearSearchBtn);
    searchFilterGroup.appendChild(tagFilterContainer);

    const tagFilterList = document.createElement('div');
    tagFilterList.className = 'faq-tag-filter-list';
    tagFilterList.className = 'faq-tag-filter-list tw-flex tw-flex-wrap tw-gap-1 tw-mt-1';
    tagFilterContainer.appendChild(tagFilterList);

    const inputGroup = document.createElement('div');
    inputGroup.className = 'tw-flex tw-items-center tw-gap-2 tw-mb-2';

    const mainColor = this.getMainColorFromGradient(this.colors[this.colorIndex]);
    const faqInput = document.createElement('textarea');
    faqInput.className = 'faq-manager-input';
    faqInput.placeholder = '输入问题内容，按 Ctrl+Enter 或 Shift+Enter 添加';
    faqInput.className = 'faq-manager-input tw-textarea tw-min-h-64 tw-max-h-160';
    faqInput.style.flex = '1';

    faqInput._isComposing = false;
    faqInput.addEventListener('compositionstart', () => { faqInput._isComposing = true; });
    faqInput.addEventListener('compositionend', () => { faqInput._isComposing = false; });
    faqInput.addEventListener('focus', () => {
      faqInput.style.borderColor = mainColor;
      faqInput.style.boxShadow = `0 0 0 3px ${mainColor}20`;
    });
    faqInput.addEventListener('blur', () => {
      faqInput.style.borderColor = '#e2e8f0';
      faqInput.style.boxShadow = 'none';
    });
    inputGroup.appendChild(faqInput);

    const faqsContainer = document.createElement('div');
    faqsContainer.className = 'faq-manager-faqs';
    faqsContainer.className = 'faq-manager-faqs faqs';
    const style = document.createElement('style');
    style.textContent = `
      #pet-faq-manager .faq-manager-faqs::-webkit-scrollbar { width: 6px; }
      #pet-faq-manager .faq-manager-faqs::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
      #pet-faq-manager .faq-manager-faqs::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      #pet-faq-manager .faq-manager-faqs::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    `;
    document.head.appendChild(style);

    const footer = document.createElement('div');
    footer.className = 'tw-flex tw-justify-center';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'faq-manager-cancel';
    cancelBtn.textContent = '关闭';
    cancelBtn.title = '关闭';
    cancelBtn.className = 'tw-btn tw-btn-gray';
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.classList.add('tw-transition');
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.classList.remove('tw-transition');
    });
    cancelBtn.addEventListener('click', () => this.closeFaqManagerOnly());
    footer.appendChild(cancelBtn);

    panel.appendChild(header);
    panel.appendChild(searchFilterGroup);
    panel.appendChild(inputGroup);
    panel.appendChild(faqsContainer);
    panel.appendChild(footer);
    modal.appendChild(panel);

    const updateTagFilterButtons = () => {
      reverseFilterBtn.style.color = this.faqTagFilterReverse ? '#4CAF50' : '#9ca3af';
      reverseFilterBtn.style.opacity = this.faqTagFilterReverse ? '1' : '0.6';
      noTagsFilterBtn.style.color = this.faqTagFilterNoTags ? '#4CAF50' : '#9ca3af';
      noTagsFilterBtn.style.opacity = this.faqTagFilterNoTags ? '1' : '0.6';
      const hasActiveFilter = (this.faqSelectedFilterTags && this.faqSelectedFilterTags.length > 0) || this.faqTagFilterNoTags;
      clearFilterBtn.style.opacity = hasActiveFilter ? '0.8' : '0.4';
      clearFilterBtn.style.cursor = hasActiveFilter ? 'pointer' : 'default';
    };
    modal._updateTagFilterButtons = updateTagFilterButtons;

    if (!this.faqSelectedFilterTags) this.faqSelectedFilterTags = [];
    if (this.faqTagFilterReverse === undefined) this.faqTagFilterReverse = false;
    if (this.faqTagFilterNoTags === undefined) this.faqTagFilterNoTags = false;

    reverseFilterBtn.addEventListener('click', () => {
      this.faqTagFilterReverse = !this.faqTagFilterReverse;
      updateTagFilterButtons();
      this.loadFaqsIntoManager();
    });

    noTagsFilterBtn.addEventListener('click', () => {
      this.faqTagFilterNoTags = !this.faqTagFilterNoTags;
      updateTagFilterButtons();
      this.loadFaqsIntoManager();
    });

    clearFilterBtn.addEventListener('click', () => {
      this.faqSelectedFilterTags = [];
      this.faqTagFilterReverse = false;
      this.faqTagFilterNoTags = false;
      updateTagFilterButtons();
      this.updateFaqTagFilterUI();
      this.loadFaqsIntoManager();
    });

    this.chatWindow.appendChild(modal);
  };

  proto.openFaqManager = async function() {
    this.ensureFaqManagerUi();
    const modal = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!modal) {
      console.error('常见问题管理弹窗未找到');
      return;
    }
    modal.style.display = 'flex';
    const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
    const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
    if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
    if (inputToggleBtn) inputToggleBtn.style.display = 'none';
    this.updateFaqTagFilterUI();
    await this.loadFaqsIntoManager();
    const closeBtn = modal.querySelector('.faq-manager-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeFaqManagerOnly();
    }
    const cancelBtn = modal.querySelector('.faq-manager-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.closeFaqManagerOnly();
    }
    const faqInput = modal.querySelector('.faq-manager-input');
    if (faqInput) {
      const existingHandler = faqInput._enterKeyHandler;
      if (existingHandler) {
        faqInput.removeEventListener('keydown', existingHandler);
      }
      const enterKeyHandler = (e) => {
        if (faqInput._isComposing) return;
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
          e.preventDefault();
          this.addFaqFromInput();
        }
      };
      faqInput._enterKeyHandler = enterKeyHandler;
      faqInput.addEventListener('keydown', enterKeyHandler);
      faqInput.focus();
    }
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeFaqManagerOnly();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    modal._escHandler = escHandler;
  };

  proto.closeFaqManagerOnly = function() {
    const modal = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!modal) return;
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      delete modal._escHandler;
    }
    const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
    const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
    if (sidebarToggleBtn) sidebarToggleBtn.style.display = '';
    if (inputToggleBtn) inputToggleBtn.style.display = '';
    modal.style.display = 'none';
    const faqInput = modal.querySelector('.faq-manager-input');
    if (faqInput) {
      faqInput.value = '';
    }
  };

  proto.getAllFaqTags = function() {
    const modal = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!modal || !modal._currentFaqs) return [];
    const tagSet = new Set();
    modal._currentFaqs.forEach(faq => {
      const tags = faq.tags || [];
      tags.forEach(tag => {
        const trimmed = tag ? tag.trim() : '';
        if (trimmed.length > 0) tagSet.add(trimmed);
      });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' }));
  };

  proto.updateFaqTagFilterUI = function() {
    const modal = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!modal) return;
    const tagFilterList = modal.querySelector('.faq-tag-filter-list');
    if (!tagFilterList) return;
    tagFilterList.innerHTML = '';
    const allTags = this.getAllFaqTags();
    if (allTags.length === 0) return;
    const selectedTags = this.faqSelectedFilterTags || [];
    const isReverse = !!this.faqTagFilterReverse;
    const createTagButton = (tagName) => {
      const btn = document.createElement('button');
      btn.className = 'faq-tag-filter-btn tw-chip';
      btn.textContent = tagName;
      const isSelected = selectedTags.includes(tagName);
      if (isSelected) {
        btn.classList.add('tw-chip-active');
      }
      btn.addEventListener('click', () => {
        const idx = selectedTags.indexOf(tagName);
        if (idx >= 0) selectedTags.splice(idx, 1);
        else selectedTags.push(tagName);
        this.faqSelectedFilterTags = selectedTags.slice();
        this.updateFaqTagFilterUI();
        this.loadFaqsIntoManager();
      });
      return btn;
    };
    allTags.forEach(tag => {
      const btn = createTagButton(tag);
      tagFilterList.appendChild(btn);
    });
    if (modal._updateTagFilterButtons) {
      modal._updateTagFilterButtons();
    }
  };

  proto.loadFaqsIntoManager = async function() {
    const modal = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!modal) return;
    const faqsContainer = modal.querySelector('.faq-manager-faqs');
    if (!faqsContainer) return;

    try {
        if (!this.faqApi) {
             console.error('FAQ API 未初始化');
             return;
        }

        const faqs = await this.faqApi.getFaqs();
        modal._allFaqs = faqs;
        
        let filteredFaqs = faqs;

        const searchKeyword = (this.faqSearchFilter || '').toLowerCase().trim();
        if (searchKeyword) {
            filteredFaqs = filteredFaqs.filter(faq => 
                (faq.text || '').toLowerCase().includes(searchKeyword)
            );
        }

        const selectedTags = this.faqSelectedFilterTags || [];
        const isReverse = !!this.faqTagFilterReverse;
        const noTags = !!this.faqTagFilterNoTags;

        if (noTags) {
             filteredFaqs = filteredFaqs.filter(faq => !faq.tags || faq.tags.length === 0);
        } else if (selectedTags.length > 0) {
            if (isReverse) {
                filteredFaqs = filteredFaqs.filter(faq => 
                    !faq.tags || !faq.tags.some(tag => selectedTags.includes(tag))
                );
            } else {
                filteredFaqs = filteredFaqs.filter(faq => 
                    faq.tags && faq.tags.some(tag => selectedTags.includes(tag))
                );
            }
        }

        modal._currentFaqs = filteredFaqs;

        faqsContainer.innerHTML = '';
        if (filteredFaqs.length === 0) {
             const empty = document.createElement('div');
             empty.className = 'tw-p-8 tw-text-center tw-text-gray-400 tw-text-sm';
             empty.textContent = '暂无常见问题';
             faqsContainer.appendChild(empty);
        } else {
             filteredFaqs.forEach((faq, index) => {
                 const el = this.createFaqElement(faq, index);
                 faqsContainer.appendChild(el);
             });
        }

        this.updateFaqTagFilterUI();

    } catch (err) {
        console.error('加载常见问题失败:', err);
        faqsContainer.innerHTML = `<div class="tw-p-4 tw-text-center tw-text-red-500">加载失败: ${err.message}</div>`;
    }
  };

  proto.createFaqElement = function(faq, index) {
      const item = document.createElement('div');
      item.className = 'faq-item tw-p-3 tw-border-b tw-border-gray-100 hover:tw-bg-gray-50 tw-group tw-relative tw-transition-colors tw-cursor-pointer';
      
      const content = document.createElement('div');
      content.className = 'tw-flex tw-flex-col tw-gap-1.5';
      
      const text = faq.text || '';
      const lines = text.split('\n');
      const titleText = lines[0];
      const bodyText = lines.slice(1).join('\n');

      const title = document.createElement('div');
      title.className = 'tw-font-medium tw-text-gray-800 tw-text-sm';
      title.textContent = titleText;
      content.appendChild(title);

      if (bodyText) {
          const body = document.createElement('div');
          body.className = 'tw-text-xs tw-text-gray-500 tw-line-clamp-2 tw-whitespace-pre-wrap';
          body.textContent = bodyText;
          content.appendChild(body);
      }
      
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'tw-flex tw-flex-wrap tw-gap-1.5 tw-mt-0.5';
      if (faq.tags && faq.tags.length > 0) {
          faq.tags.forEach(tag => {
              const tagSpan = document.createElement('span');
              tagSpan.className = 'tw-text-[10px] tw-px-1.5 tw-py-0.5 tw-bg-gray-100 tw-text-gray-500 tw-rounded';
              tagSpan.textContent = tag;
              tagsContainer.appendChild(tagSpan);
          });
      }
      content.appendChild(tagsContainer);

      const actions = document.createElement('div');
      actions.className = 'tw-absolute tw-right-2 tw-top-2 tw-hidden group-hover:tw-flex tw-gap-1 tw-bg-white/90 tw-backdrop-blur-sm tw-rounded tw-shadow-sm tw-p-0.5 tw-border tw-border-gray-100';
      
      const createBtn = (icon, title, onClick, colorClass) => {
          const btn = document.createElement('button');
          btn.className = `tw-p-1.5 tw-rounded hover:tw-bg-gray-100 tw-transition ${colorClass}`;
          btn.title = title;
          btn.innerHTML = icon;
          btn.onclick = (e) => {
              e.stopPropagation();
              onClick();
          };
          return btn;
      };

      actions.appendChild(createBtn(
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
          '管理标签',
          () => this.openFaqTagManager(index),
          'tw-text-gray-500 hover:tw-text-blue-500'
      ));

      actions.appendChild(createBtn(
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
          '删除',
          () => this.deleteFaq(faq.text),
          'tw-text-gray-400 hover:tw-text-red-500'
      ));

      item.appendChild(content);
      item.appendChild(actions);

      item.addEventListener('click', () => {
           const chatInput = this.chatWindow?.querySelector('#pet-chat-input');
           if (chatInput) {
               chatInput.value = faq.text;
               chatInput.focus();
               chatInput.dispatchEvent(new Event('input', { bubbles: true }));
               this.closeFaqManagerOnly();
           }
      });

      return item;
  };

  proto.addFaqFromInput = async function() {
      const modal = this.chatWindow?.querySelector('#pet-faq-manager');
      if (!modal) return;
      const input = modal.querySelector('.faq-manager-input');
      if (!input) return;
      
      const text = input.value.trim();
      if (!text) return;

      try {
          if (this.faqApi) {
              await this.faqApi.createFaq({ text });
              input.value = '';
              await this.loadFaqsIntoManager();
          }
      } catch (err) {
          console.error('添加常见问题失败:', err);
          alert('添加失败: ' + err.message);
      }
  };

  proto.deleteFaq = async function(key) {
      if (!confirm('确定要删除这条常见问题吗？')) return;
      try {
          if (this.faqApi) {
              await this.faqApi.deleteFaq(key);
              await this.loadFaqsIntoManager();
          }
      } catch (err) {
          console.error('删除常见问题失败:', err);
          alert('删除失败: ' + err.message);
      }
  };
})();

