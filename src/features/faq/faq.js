;(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return;
  }
  const proto = window.PetManager.prototype;

  // 规范化标签
  const _normalizeFaqTags = (tags) => {
    if (!tags) return [];
    const raw = Array.isArray(tags) ? tags : String(tags).split(',');
    const seen = new Set();
    const out = [];
    for (const t of raw) {
      const s = String(t ?? '').trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  };

  // 规范化FAQ文档
  const _normalizeFaqDoc = (doc) => {
    // 优先使用 key，如果没有则使用 id/_id，最后使用 text 作为 key
    const key = String(doc?.key ?? doc?.id ?? doc?._id ?? doc?.text ?? '').trim();
    const text = String(doc?.text ?? '').trim();
    
    // 如果已有 title 和 prompt，直接使用；否则从 text 解析
    let title = String(doc?.title ?? '').trim();
    let prompt = String(doc?.prompt ?? '').trim();
    
    if (!title && !prompt && text) {
      // 从 text 解析：首行作为标题，余下作为正文
      const lines = text.split('\n');
      title = String(lines[0] ?? '').trim();
      prompt = String(lines.slice(1).join('\n') ?? '').trim();
    }
    
    // 如果只有 prompt 没有 title，使用 prompt 的前 40 个字符作为 title
    if (!title && prompt) {
      title = prompt.slice(0, 40);
    }
    
    // 如果都没有，使用默认值
    if (!title) {
      title = '常见问题';
    }
    
    return {
      key: key || `faq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title,
      prompt: prompt,
      text: text || (title && prompt ? `${title}\n\n${prompt}` : title),
      tags: _normalizeFaqTags(doc?.tags),
      order: Number.isFinite(Number(doc?.order)) ? Number(doc.order) : 0,
      updatedTime: doc?.updatedTime
    };
  };

  proto.ensureFaqManagerUi = function() {
    if (!this.chatWindow) {
      console.warn('ensureFaqManagerUi: chatWindow 未初始化');
      return;
    }
    if (this.chatWindow.querySelector('#pet-faq-manager')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pet-faq-manager';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '常见问题');
    overlay.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0,0,0,0.6) !important;
      backdrop-filter: blur(2px) !important;
      z-index: 1000 !important;
      display: none !important;
      flex-direction: column !important;
      animation: fadeIn 0.2s ease !important;
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeFaqManagerOnly();
      }
    });

    const modal = document.createElement('div');
    modal.style.cssText = `
      flex: 1 !important;
      background: #1a1b1e !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      margin: 0 !important;
      border-radius: 0 !important;
    `;

    // 头部
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      background: #25262b !important;
    `;

    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = '💡 常见问题 <span style="font-size: 12px; color: rgba(255,255,255,0.6);">（一键插入/发送）</span>';
    titleDiv.style.cssText = 'color: #fff !important; font-weight: 500 !important; font-size: 15px !important;';

    const closeBtn = document.createElement('div');
    closeBtn.className = 'pet-faq-modal-close';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.style.cssText = `
      color: rgba(255,255,255,0.5) !important;
      cursor: pointer !important;
      padding: 4px !important;
      font-size: 14px !important;
    `;
    closeBtn.onclick = () => this.closeFaqManagerOnly();

    header.appendChild(titleDiv);
    header.appendChild(closeBtn);

    // 内容区域
    const content = document.createElement('div');
    content.className = 'pet-faq-modal-content';
    content.style.cssText = `
      flex: 1 !important;
      overflow-y: auto !important;
      padding: 16px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 20px !important;
    `;

    const layout = document.createElement('div');
    layout.className = 'pet-faq-layout';

    // 左侧边栏
    const sidebar = document.createElement('div');
    sidebar.className = 'pet-faq-sidebar';
    sidebar.setAttribute('aria-label', '筛选与标签');

    // 搜索行
    const searchRow = document.createElement('div');
    searchRow.className = 'pet-faq-search-row';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'pet-faq-search-input';
    searchInput.placeholder = '搜索常见问题...';
    searchInput.setAttribute('aria-label', '搜索常见问题');

    const clearSearchBtn = document.createElement('button');
    clearSearchBtn.type = 'button';
    clearSearchBtn.className = 'pet-faq-search-clear';
    clearSearchBtn.textContent = '清除';
    clearSearchBtn.setAttribute('aria-label', '清除搜索');
    clearSearchBtn.title = '清除搜索';

    const updateClearSearchBtn = () => {
      const hasValue = (this.faqSearchFilter || '').trim().length > 0;
      clearSearchBtn.disabled = !hasValue;
    };
    updateClearSearchBtn();

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.faqSearchFilter = '';
      updateClearSearchBtn();
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

    searchRow.appendChild(searchInput);
    searchRow.appendChild(clearSearchBtn);

    // 筛选行
    const filterRow = document.createElement('div');
    filterRow.className = 'pet-faq-filter-row';
    filterRow.setAttribute('aria-label', '常见问题标签筛选');

    const filterActions = document.createElement('div');
    filterActions.className = 'pet-faq-filter-actions';

    const reverseFilterBtn = document.createElement('button');
    reverseFilterBtn.type = 'button';
    reverseFilterBtn.className = 'pet-faq-filter-btn';
    reverseFilterBtn.textContent = '反选';
    reverseFilterBtn.setAttribute('aria-label', '反选');
    reverseFilterBtn.title = '不包含选中标签';

    const noTagsFilterBtn = document.createElement('button');
    noTagsFilterBtn.type = 'button';
    noTagsFilterBtn.className = 'pet-faq-filter-btn';
    noTagsFilterBtn.textContent = '无标签';
    noTagsFilterBtn.setAttribute('aria-label', '无标签');
    noTagsFilterBtn.title = '只显示无标签问题';

    const clearFilterBtn = document.createElement('button');
    clearFilterBtn.type = 'button';
    clearFilterBtn.className = 'pet-faq-filter-btn';
    clearFilterBtn.textContent = '清除标签';
    clearFilterBtn.setAttribute('aria-label', '清除标签筛选');
    clearFilterBtn.title = '清除标签筛选';

    const tagManagerBtn = document.createElement('button');
    tagManagerBtn.type = 'button';
    tagManagerBtn.className = 'pet-faq-filter-btn';
    tagManagerBtn.textContent = '标签管理';
    tagManagerBtn.setAttribute('aria-label', '标签管理');
    tagManagerBtn.title = '标签管理';

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'pet-faq-filter-btn';
    refreshBtn.textContent = '刷新';
    refreshBtn.setAttribute('aria-label', '刷新');
    refreshBtn.title = '从接口刷新';

    filterActions.appendChild(reverseFilterBtn);
    filterActions.appendChild(noTagsFilterBtn);
    filterActions.appendChild(clearFilterBtn);
    filterActions.appendChild(tagManagerBtn);
    filterActions.appendChild(refreshBtn);

    // 标签搜索
    const tagSearch = document.createElement('div');
    tagSearch.className = 'pet-faq-tag-search';

    const tagSearchInput = document.createElement('input');
    tagSearchInput.type = 'text';
    tagSearchInput.className = 'pet-faq-tag-search-input';
    tagSearchInput.placeholder = '搜索标签...';
    tagSearchInput.setAttribute('aria-label', '搜索标签');

    const clearTagSearchBtn = document.createElement('button');
    clearTagSearchBtn.type = 'button';
    clearTagSearchBtn.className = 'pet-faq-filter-btn';
    clearTagSearchBtn.textContent = '清除';
    clearTagSearchBtn.setAttribute('aria-label', '清除标签搜索');
    clearTagSearchBtn.title = '清除标签搜索';

    const updateClearTagSearchBtn = () => {
      const hasValue = (this.faqTagFilterSearchKeyword || '').trim().length > 0;
      clearTagSearchBtn.disabled = !hasValue;
    };
    updateClearTagSearchBtn();

    clearTagSearchBtn.addEventListener('click', () => {
      tagSearchInput.value = '';
      this.faqTagFilterSearchKeyword = '';
      updateClearTagSearchBtn();
      this.updateFaqTagFilterUI();
    });

    let tagSearchDebounceTimer = null;
    tagSearchInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      this.faqTagFilterSearchKeyword = value;
      updateClearTagSearchBtn();
      if (tagSearchDebounceTimer) clearTimeout(tagSearchDebounceTimer);
      tagSearchDebounceTimer = setTimeout(() => {
        this.updateFaqTagFilterUI();
      }, 300);
    });

    tagSearch.appendChild(tagSearchInput);
    tagSearch.appendChild(clearTagSearchBtn);

    // 标签列表
    const tagList = document.createElement('div');
    tagList.className = 'pet-faq-tag-list';
    tagList.setAttribute('role', 'list');
    tagList.setAttribute('aria-label', '标签列表');

    // 标签管理面板
    const tagManager = document.createElement('div');
    tagManager.className = 'pet-faq-tag-manager';
    tagManager.style.display = 'none';
    tagManager.setAttribute('aria-label', '标签管理面板');

    const tagManagerHeader = document.createElement('div');
    tagManagerHeader.className = 'pet-faq-tag-manager-header';

    const tagManagerTitle = document.createElement('div');
    tagManagerTitle.className = 'pet-faq-tag-manager-title';
    tagManagerTitle.textContent = '标签管理';

    const closeTagManagerBtn = document.createElement('button');
    closeTagManagerBtn.type = 'button';
    closeTagManagerBtn.className = 'pet-faq-filter-btn';
    closeTagManagerBtn.textContent = '关闭';
    closeTagManagerBtn.setAttribute('aria-label', '关闭标签管理');

    tagManagerHeader.appendChild(tagManagerTitle);
    tagManagerHeader.appendChild(closeTagManagerBtn);

    const tagManagerList = document.createElement('div');
    tagManagerList.className = 'pet-faq-tag-manager-list';
    tagManagerList.setAttribute('role', 'list');
    tagManagerList.setAttribute('aria-label', '可管理标签列表');

    tagManager.appendChild(tagManagerHeader);
    tagManager.appendChild(tagManagerList);

    filterRow.appendChild(filterActions);
    filterRow.appendChild(tagSearch);
    filterRow.appendChild(tagList);
    filterRow.appendChild(tagManager);

    sidebar.appendChild(searchRow);
    sidebar.appendChild(filterRow);

    // 主内容区
    const main = document.createElement('div');
    main.className = 'pet-faq-main';
    main.setAttribute('aria-label', '常见问题列表');

    // 统计信息
    const summary = document.createElement('div');
    summary.className = 'pet-faq-summary';
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-label', '筛选结果');

    // 输入行
    const inputRow = document.createElement('div');
    inputRow.className = 'pet-faq-input-row';
    inputRow.setAttribute('aria-label', '添加常见问题');

    const faqInput = document.createElement('textarea');
    faqInput.className = 'pet-faq-input';
    faqInput.placeholder = '输入问题内容，按 Ctrl+Enter 或 Shift+Enter 添加';
    faqInput.setAttribute('aria-label', '新增常见问题');

    const inputHint = document.createElement('div');
    inputHint.className = 'pet-faq-input-hint';
    inputHint.textContent = '支持多行内容，首行作为标题，余下作为正文。';

    inputRow.appendChild(faqInput);
    inputRow.appendChild(inputHint);

    // 状态信息
    const statusDiv = document.createElement('div');
    statusDiv.className = 'pet-faq-status';
    statusDiv.style.display = 'none';
    statusDiv.setAttribute('role', 'status');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'pet-faq-error';
    errorDiv.style.display = 'none';
    errorDiv.setAttribute('role', 'status');

    // FAQ列表
    const faqList = document.createElement('div');
    faqList.className = 'pet-faq-list';
    faqList.setAttribute('role', 'list');
    faqList.setAttribute('aria-label', '常见问题列表');

    main.appendChild(summary);
    main.appendChild(inputRow);
    main.appendChild(statusDiv);
    main.appendChild(errorDiv);
    main.appendChild(faqList);

    layout.appendChild(sidebar);
    layout.appendChild(main);

    content.appendChild(layout);
    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);

    // 初始化状态
    if (!this.faqSelectedFilterTags) this.faqSelectedFilterTags = [];
    if (this.faqTagFilterReverse === undefined) this.faqTagFilterReverse = false;
    if (this.faqTagFilterNoTags === undefined) this.faqTagFilterNoTags = false;
    if (this.faqTagFilterExpanded === undefined) this.faqTagFilterExpanded = false;
    if (this.faqTagFilterVisibleCount === undefined) this.faqTagFilterVisibleCount = 20;
    if (this.faqTagManagerVisible === undefined) this.faqTagManagerVisible = false;
    if (this.faqTagFilterSearchKeyword === undefined) this.faqTagFilterSearchKeyword = '';

    // 更新按钮状态
    const updateTagFilterButtons = () => {
      reverseFilterBtn.classList.toggle('active', !!this.faqTagFilterReverse);
      noTagsFilterBtn.classList.toggle('active', !!this.faqTagFilterNoTags);
      const hasActiveFilter = (this.faqSelectedFilterTags && this.faqSelectedFilterTags.length > 0) || 
                              this.faqTagFilterNoTags || this.faqTagFilterReverse;
      clearFilterBtn.disabled = !hasActiveFilter;
      tagManagerBtn.classList.toggle('active', !!this.faqTagManagerVisible);
      tagManager.style.display = this.faqTagManagerVisible ? 'flex' : 'none';
      // 更新刷新按钮的禁用状态（当加载中时禁用）
      const isLoading = overlay._isLoading || false;
      refreshBtn.disabled = isLoading;
    };
    overlay._updateTagFilterButtons = updateTagFilterButtons;

    // 事件监听
    reverseFilterBtn.addEventListener('click', () => {
      this.faqTagFilterReverse = !this.faqTagFilterReverse;
      if (this.faqTagFilterNoTags) this.faqTagFilterNoTags = false;
      updateTagFilterButtons();
      this.loadFaqsIntoManager();
    });

    noTagsFilterBtn.addEventListener('click', () => {
      this.faqTagFilterNoTags = !this.faqTagFilterNoTags;
      if (this.faqTagFilterNoTags) {
        this.faqSelectedFilterTags = [];
        this.faqTagFilterReverse = false;
      }
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

    tagManagerBtn.addEventListener('click', () => {
      this.faqTagManagerVisible = !this.faqTagManagerVisible;
      updateTagFilterButtons();
      if (this.faqTagManagerVisible) {
        this.updateFaqTagManagerUI();
      }
    });

    closeTagManagerBtn.addEventListener('click', () => {
      this.faqTagManagerVisible = false;
      updateTagFilterButtons();
    });

    refreshBtn.addEventListener('click', () => {
      this.loadFaqsIntoManager(true);
    });

    // ESC 键处理
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeFaqManagerOnly();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    this.chatWindow.appendChild(overlay);
  };

  proto.openFaqManager = async function() {
    try {
      // 确保聊天窗口已打开
      if (!this.chatWindow) {
        console.log('常见问题：聊天窗口未初始化，尝试打开聊天窗口');
        if (typeof this.openChatWindow === 'function') {
          await this.openChatWindow();
          // 等待一下，确保聊天窗口完全初始化
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          const errorMsg = '无法打开聊天窗口：openChatWindow 方法不存在';
          console.error(errorMsg);
          if (typeof this.showNotification === 'function') {
            this.showNotification('无法打开常见问题：聊天窗口未初始化', 'error');
          }
          return;
        }
      }
      
      // 再次检查聊天窗口是否存在（可能在 openChatWindow 中创建失败）
      if (!this.chatWindow) {
        const errorMsg = '常见问题管理器：聊天窗口未初始化';
        console.error(errorMsg);
        if (typeof this.showNotification === 'function') {
          this.showNotification('无法打开常见问题：聊天窗口创建失败', 'error');
        }
        return;
      }
      
      // 确保常见问题管理器 UI 已创建
      this.ensureFaqManagerUi();
      const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
      if (!overlay) {
        const errorMsg = '常见问题管理弹窗未找到';
        console.error(errorMsg, 'chatWindow:', this.chatWindow);
        if (typeof this.showNotification === 'function') {
          this.showNotification('无法打开常见问题：UI 创建失败', 'error');
        }
        return;
      }
      
      // 显示弹窗
      overlay.style.display = 'flex';
      
      // 隐藏侧边栏和输入框的折叠按钮
      const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
      const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
      if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none';
      if (inputToggleBtn) inputToggleBtn.style.display = 'none';
      
      // 清空搜索关键词
      if (this.faqSearchFilter) {
        this.faqSearchFilter = '';
        const searchInput = overlay.querySelector('.pet-faq-search-input');
        if (searchInput) {
          searchInput.value = '';
        }
      }
      
      // 检查 FAQ API 是否已初始化
      if (!this.faqApi) {
        const errorMsg = '常见问题管理器：FAQ API 未初始化';
        console.error(errorMsg);
        if (typeof this.showNotification === 'function') {
          this.showNotification('常见问题功能未启用：FAQ API 未初始化', 'error');
        }
        overlay.style.display = 'none';
        // 恢复按钮显示
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = '';
        if (inputToggleBtn) inputToggleBtn.style.display = '';
        return;
      }
      
      // 检查 FAQ API 是否启用
      if (this.faqApi && typeof this.faqApi.isEnabled === 'function' && !this.faqApi.isEnabled()) {
        const errorMsg = '常见问题管理器：FAQ API 未启用';
        console.error(errorMsg);
        if (typeof this.showNotification === 'function') {
          this.showNotification('常见问题功能未启用：FAQ API 未启用', 'error');
        }
        overlay.style.display = 'none';
        // 恢复按钮显示
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = '';
        if (inputToggleBtn) inputToggleBtn.style.display = '';
        return;
      }
      
      // 如果已有数据，先更新 UI；否则加载数据
      const hasItems = overlay._allFaqs && Array.isArray(overlay._allFaqs) && overlay._allFaqs.length > 0;
      if (hasItems) {
        this.updateFaqTagFilterUI();
        await this.loadFaqsIntoManager(false);
      } else {
        await this.loadFaqsIntoManager(false);
      }
      
      // 将焦点设置到搜索输入框
      const searchInput = overlay.querySelector('.pet-faq-search-input');
      if (searchInput) {
        setTimeout(() => {
          try {
            searchInput.focus();
          } catch (focusError) {
            console.warn('设置搜索框焦点失败:', focusError);
          }
        }, 100);
      }

      // 设置添加常见问题的输入框快捷键
      const faqInput = overlay.querySelector('.pet-faq-input');
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
        faqInput._isComposing = false;
        faqInput.addEventListener('compositionstart', () => { faqInput._isComposing = true; });
        faqInput.addEventListener('compositionend', () => { faqInput._isComposing = false; });
        faqInput._enterKeyHandler = enterKeyHandler;
        faqInput.addEventListener('keydown', enterKeyHandler);
      }
    } catch (error) {
      console.error('打开常见问题管理器失败:', error);
      if (typeof this.showNotification === 'function') {
        this.showNotification(`打开常见问题失败：${error.message || '未知错误'}`, 'error');
      }
      // 确保弹窗关闭，按钮恢复显示
      const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
      if (overlay) {
        overlay.style.display = 'none';
      }
      const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
      const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
      if (sidebarToggleBtn) sidebarToggleBtn.style.display = '';
      if (inputToggleBtn) inputToggleBtn.style.display = '';
    }
  };

  proto.closeFaqManagerOnly = function() {
    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay) return;
    const sidebarToggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
    const inputToggleBtn = this.chatWindow?.querySelector('#input-container-toggle-btn');
    if (sidebarToggleBtn) sidebarToggleBtn.style.display = '';
    if (inputToggleBtn) inputToggleBtn.style.display = '';
    overlay.style.display = 'none';
    const faqInput = overlay.querySelector('.pet-faq-input');
    if (faqInput) {
      faqInput.value = '';
    }
    
    // 尝试将焦点返回到聊天输入框
    try {
      const chatInput = this.chatWindow?.querySelector('#pet-chat-input');
      if (chatInput && typeof chatInput.focus === 'function') {
        chatInput.focus();
        return;
      }
    } catch (_) {}
  };

  proto.getAllFaqTags = function() {
    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay || !overlay._allFaqs) return [];
    const tagSet = new Set();
    overlay._allFaqs.forEach(faq => {
      const tags = _normalizeFaqTags(faq?.tags);
      tags.forEach(tag => {
        const s = String(tag ?? '').trim();
        if (!s) return;
        const k = s.toLowerCase();
        tagSet.add(s);
      });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  };

  proto.getVisibleFaqTags = function() {
    const all = this.getAllFaqTags();
    const kw = String(this.faqTagFilterSearchKeyword || '').trim().toLowerCase();
    const filtered = kw ? all.filter(t => String(t).toLowerCase().includes(kw)) : all;
    const expanded = !!this.faqTagFilterExpanded;
    const visibleCount = Math.max(0, Number(this.faqTagFilterVisibleCount) || 20);
    return expanded ? filtered : filtered.slice(0, visibleCount);
  };

  proto.updateFaqTagFilterUI = function() {
    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay) return;
    const tagList = overlay.querySelector('.pet-faq-tag-list');
    if (!tagList) return;
    tagList.innerHTML = '';
    
    const allTags = this.getAllFaqTags();
    if (allTags.length === 0) return;
    
    const visibleTags = this.getVisibleFaqTags();
    const selectedTags = this.faqSelectedFilterTags || [];

    visibleTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pet-faq-tag';
      btn.textContent = tag;
      btn.setAttribute('role', 'listitem');
      btn.setAttribute('aria-label', `筛选标签：${tag}`);
      if (selectedTags.includes(tag)) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        this.toggleFaqTag(tag);
      });
      tagList.appendChild(btn);
    });

    // 更多/收起按钮
    if (allTags.length > visibleTags.length) {
      const moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'pet-faq-tag more';
      moreBtn.textContent = this.faqTagFilterExpanded ? '收起' : '更多';
      moreBtn.setAttribute('role', 'listitem');
      moreBtn.setAttribute('aria-label', '展开或收起标签');
      moreBtn.addEventListener('click', () => {
        this.faqTagFilterExpanded = !this.faqTagFilterExpanded;
        this.updateFaqTagFilterUI();
      });
      tagList.appendChild(moreBtn);
    }

    if (overlay._updateTagFilterButtons) {
      overlay._updateTagFilterButtons();
    }
  };

  proto.toggleFaqTag = function(tag) {
    const t = String(tag ?? '').trim();
    if (!t) return;
    if (!this.faqSelectedFilterTags) this.faqSelectedFilterTags = [];
    const current = [...this.faqSelectedFilterTags];
    const idx = current.indexOf(t);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(t);
    }
    this.faqSelectedFilterTags = current;
    if (this.faqTagFilterNoTags) this.faqTagFilterNoTags = false;
    this.updateFaqTagFilterUI();
    this.loadFaqsIntoManager();
  };

  proto.updateFaqTagManagerUI = function() {
    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay) return;
    const tagManagerList = overlay.querySelector('.pet-faq-tag-manager-list');
    if (!tagManagerList) return;
    tagManagerList.innerHTML = '';

    const allTags = this.getAllFaqTags();
    if (allTags.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pet-faq-tag-manager-empty';
      empty.textContent = '暂无标签';
      tagManagerList.appendChild(empty);
      return;
    }

    allTags.forEach(tag => {
      const item = document.createElement('div');
      item.className = 'pet-faq-tag-manager-item';
      item.setAttribute('role', 'listitem');

      const name = document.createElement('div');
      name.className = 'pet-faq-tag-manager-name';
      name.textContent = tag;

      const actions = document.createElement('div');
      actions.className = 'pet-faq-tag-manager-actions';

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'pet-faq-filter-btn';
      renameBtn.textContent = '重命名';
      renameBtn.setAttribute('aria-label', '重命名标签');
      const updateRenameBtnState = () => {
        const isLoading = overlay._isLoading || false;
        renameBtn.disabled = isLoading;
      };
      renameBtn.addEventListener('click', () => this.renameFaqTag(tag));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'pet-faq-filter-btn danger';
      deleteBtn.textContent = '删除';
      deleteBtn.setAttribute('aria-label', '删除标签');
      const updateDeleteBtnState = () => {
        const isLoading = overlay._isLoading || false;
        deleteBtn.disabled = isLoading;
      };
      deleteBtn.addEventListener('click', () => this.deleteFaqTag(tag));
      
      // 存储更新函数以便后续调用
      item._updateBtnStates = () => {
        updateRenameBtnState();
        updateDeleteBtnState();
      };
      // 立即设置初始状态
      item._updateBtnStates();

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(name);
      item.appendChild(actions);
      tagManagerList.appendChild(item);
    });
    
    // 更新所有按钮状态
    const items = tagManagerList.querySelectorAll('.pet-faq-tag-manager-item');
    items.forEach(item => {
      if (item._updateBtnStates) {
        item._updateBtnStates();
      }
    });
  };

  proto.renameFaqTag = async function(tag) {
    const oldTag = String(tag ?? '').trim();
    if (!oldTag) return;
    const nextRaw = window.prompt('重命名标签为：', oldTag);
    if (nextRaw == null) return;
    const newTag = String(nextRaw ?? '').trim();
    if (!newTag || newTag === oldTag) return;

    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay || !overlay._allFaqs) return;
    
    const affected = overlay._allFaqs.filter(faq => {
      const tags = _normalizeFaqTags(faq?.tags);
      return tags.includes(oldTag);
    });
    if (affected.length === 0) return;

    try {
      if (!this.faqApi || !this.faqApi.isEnabled()) {
        throw new Error('FAQ API 未启用');
      }
      
      for (const faq of affected) {
        const tags = _normalizeFaqTags(faq?.tags || []).map(t => (t === oldTag ? newTag : t));
        const key = faq.text || faq.key;
        if (!key) {
          console.warn('跳过缺少标识符的常见问题:', faq);
          continue;
        }
        await this.faqApi.updateFaq(key, {
          text: faq.text,
          tags: tags
        });
      }
      if (this.faqApi.clearGetCache) {
        this.faqApi.clearGetCache();
      }
      await this.loadFaqsIntoManager(true);
      this.showNotification('已重命名标签', 'success');
    } catch (e) {
      console.error('重命名标签失败:', e);
      this.showNotification('重命名标签失败: ' + (e?.message || '未知错误'), 'error');
    }
  };

  proto.deleteFaqTag = async function(tag) {
    const target = String(tag ?? '').trim();
    if (!target) return;
    if (!confirm(`确定删除标签「${target}」？会从所有常见问题中移除。`)) return;

    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay || !overlay._allFaqs) return;
    
    const affected = overlay._allFaqs.filter(faq => {
      const tags = _normalizeFaqTags(faq?.tags);
      return tags.includes(target);
    });
    if (affected.length === 0) return;

    try {
      if (!this.faqApi || !this.faqApi.isEnabled()) {
        throw new Error('FAQ API 未启用');
      }
      
      for (const faq of affected) {
        const tags = _normalizeFaqTags(faq?.tags || []).filter(t => t !== target);
        const key = faq.text || faq.key;
        if (!key) {
          console.warn('跳过缺少标识符的常见问题:', faq);
          continue;
        }
        await this.faqApi.updateFaq(key, {
          text: faq.text,
          tags: tags
        });
      }
      if (this.faqApi.clearGetCache) {
        this.faqApi.clearGetCache();
      }
      // 从选中的标签中移除
      if (this.faqSelectedFilterTags && this.faqSelectedFilterTags.includes(target)) {
        this.faqSelectedFilterTags = this.faqSelectedFilterTags.filter(t => t !== target);
      }
      await this.loadFaqsIntoManager(true);
      this.showNotification('已删除标签', 'success');
    } catch (e) {
      console.error('删除标签失败:', e);
      this.showNotification('删除标签失败: ' + (e?.message || '未知错误'), 'error');
    }
  };

  proto.loadFaqsIntoManager = async function(force = false) {
    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay) return;
    const faqsContainer = overlay.querySelector('.pet-faq-list');
    const statusDiv = overlay.querySelector('.pet-faq-status');
    const errorDiv = overlay.querySelector('.pet-faq-error');
    const summary = overlay.querySelector('.pet-faq-summary');
    if (!faqsContainer) return;

    try {
      overlay._isLoading = true;
      if (overlay._updateTagFilterButtons) {
        overlay._updateTagFilterButtons();
      }
      statusDiv.style.display = 'block';
      statusDiv.textContent = '正在加载常见问题...';
      errorDiv.style.display = 'none';

      if (!this.faqApi) {
        throw new Error('FAQ API 未初始化');
      }

      const faqs = await this.faqApi.getFaqs();
      const normalized = faqs.map(_normalizeFaqDoc).filter(i => i.key && (i.prompt || i.title));
      overlay._allFaqs = normalized;

      // 筛选
      let filteredFaqs = normalized;
      const searchKw = String(this.faqSearchFilter || '').trim().toLowerCase();
      if (searchKw) {
        filteredFaqs = filteredFaqs.filter(faq => {
          const hay = `${String(faq?.title || '')}\n${String(faq?.prompt || '')}`.toLowerCase();
          return hay.includes(searchKw);
        });
      }

      const selectedTags = this.faqSelectedFilterTags || [];
      const reverse = !!this.faqTagFilterReverse;
      const noTags = !!this.faqTagFilterNoTags;

      filteredFaqs = filteredFaqs.filter((faq) => {
        const tags = _normalizeFaqTags(faq?.tags);
        if (noTags) {
          return tags.length === 0;
        }
        if (selectedTags.length === 0) return true;
        const hasAny = tags.some(t => selectedTags.includes(t));
        return reverse ? !hasAny : hasAny;
      });

      overlay._currentFaqs = filteredFaqs;

      // 更新统计信息
      if (summary) {
        summary.textContent = `共 ${normalized.length} 条，匹配 ${filteredFaqs.length} 条`;
      }

      statusDiv.style.display = 'none';
      faqsContainer.innerHTML = '';

      if (filteredFaqs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'pet-faq-empty';
        empty.setAttribute('role', 'listitem');
        empty.textContent = '未找到匹配的常见问题';
        faqsContainer.appendChild(empty);
      } else {
        filteredFaqs.forEach((faq, index) => {
          const el = this.createFaqElement(faq, index);
          faqsContainer.appendChild(el);
        });
      }

      this.updateFaqTagFilterUI();
      if (this.faqTagManagerVisible) {
        this.updateFaqTagManagerUI();
        // 更新标签管理面板中所有按钮的状态
        const tagManagerList = overlay.querySelector('.pet-faq-tag-manager-list');
        if (tagManagerList) {
          const items = tagManagerList.querySelectorAll('.pet-faq-tag-manager-item');
          items.forEach(item => {
            if (item._updateBtnStates) {
              item._updateBtnStates();
            }
          });
        }
      }

    } catch (err) {
      console.error('加载常见问题失败:', err);
      statusDiv.style.display = 'none';
      errorDiv.style.display = 'block';
      const errorMessage = err.message || '加载常见问题失败';
      errorDiv.textContent = errorMessage;
      faqsContainer.innerHTML = '';
      
      // 显示通知（如果方法存在）
      if (typeof this.showNotification === 'function') {
        this.showNotification(`加载常见问题失败: ${errorMessage}`, 'error');
      }
    } finally {
      overlay._isLoading = false;
      if (overlay._updateTagFilterButtons) {
        overlay._updateTagFilterButtons();
      }
    }
  };

  proto.createFaqElement = function(faq, index) {
    const item = document.createElement('div');
    item.className = 'pet-faq-item';
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');

    const header = document.createElement('div');
    header.className = 'pet-faq-item-header';

    const title = document.createElement('div');
    title.className = 'pet-faq-item-title';
    title.textContent = faq.title || '常见问题';

    const actions = document.createElement('div');
    actions.className = 'pet-faq-item-actions';

    const tagBtn = document.createElement('button');
    tagBtn.type = 'button';
    tagBtn.className = 'pet-faq-item-btn';
    tagBtn.textContent = '标签';
    tagBtn.setAttribute('aria-label', '标签');
    tagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editFaqTags(faq);
    });

    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = 'pet-faq-item-btn';
    insertBtn.textContent = '插入';
    insertBtn.setAttribute('aria-label', '插入');
    insertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.applyFaqItem(faq, 'insert');
      this.closeFaqManagerOnly();
    });

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'pet-faq-item-btn primary';
    sendBtn.textContent = '发送';
    sendBtn.setAttribute('aria-label', '发送');
    sendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.applyFaqItem(faq, 'send');
      this.closeFaqManagerOnly();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'pet-faq-item-btn danger';
    deleteBtn.textContent = '删除';
    deleteBtn.setAttribute('aria-label', '删除');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteFaq(faq);
    });

    actions.appendChild(tagBtn);
    actions.appendChild(insertBtn);
    actions.appendChild(sendBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(title);
    header.appendChild(actions);

    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'pet-faq-item-tags';
    if (Array.isArray(faq.tags) && faq.tags.length > 0) {
      tagsContainer.setAttribute('aria-label', '问题标签');
      faq.tags.forEach(tag => {
        const tagBtn = document.createElement('button');
        tagBtn.type = 'button';
        tagBtn.className = 'pet-faq-item-tag';
        tagBtn.textContent = tag;
        tagBtn.setAttribute('aria-label', `筛选标签：${tag}`);
        tagBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleFaqTag(tag);
        });
        tagsContainer.appendChild(tagBtn);
      });
    }

    const prompt = document.createElement('div');
    prompt.className = 'pet-faq-item-prompt';
    prompt.textContent = faq.prompt || '';

    item.appendChild(header);
    if (tagsContainer.children.length > 0) {
      item.appendChild(tagsContainer);
    }
    item.appendChild(prompt);

    // 点击事件
    item.addEventListener('click', () => {
      this.applyFaqItem(faq, 'insert');
      this.closeFaqManagerOnly();
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd + Enter: 发送
          e.preventDefault();
          e.stopPropagation();
          this.applyFaqItem(faq, 'send');
          this.closeFaqManagerOnly();
        } else if (!e.shiftKey) {
          // Enter (非 Shift): 插入
          e.preventDefault();
          e.stopPropagation();
          this.applyFaqItem(faq, 'insert');
          this.closeFaqManagerOnly();
        }
      }
    });

    return item;
  };

  proto.applyFaqItem = function(faq, mode = 'insert') {
    // 提取标题和正文（参考 YiWeb 实现）
    let title = String(faq?.title || '').trim();
    let prompt = String(faq?.prompt || '').trim();
    
    // 如果没有title和prompt，尝试从text字段解析（兼容旧格式）
    if (!title && !prompt && faq?.text) {
      const lines = String(faq.text).split('\n');
      title = String(lines[0] || '').trim();
      prompt = String(lines.slice(1).join('\n') || '').trim();
    }
    
    // 组合文本：如果有标题和正文，用两个换行符分隔；否则使用正文或标题
    const text = title && prompt ? `${title}\n\n${prompt}` : (prompt || title);
    if (!text) return;
    
    const chatInput = this.chatWindow?.querySelector('#pet-chat-input');
    if (chatInput) {
      const current = String(chatInput.value || '');
      const next = current ? `${current}\n\n${text}` : text;
      chatInput.value = next;
      chatInput.focus();
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // 调整输入框高度（参考 YiWeb 实现）
      try {
        chatInput.style.height = 'auto';
        const min = 60;
        const max = 220;
        const nextH = Math.max(min, Math.min(max, chatInput.scrollHeight || min));
        chatInput.style.height = `${nextH}px`;
      } catch (_) {}
      
      // 如果是send模式，自动发送消息
      if (String(mode) === 'send') {
        setTimeout(() => {
          try {
            // 通过 chatWindowComponent 调用 sendMessage
            if (this.chatWindowComponent && typeof this.chatWindowComponent.sendMessage === 'function') {
              this.chatWindowComponent.sendMessage();
            } else if (typeof this.sendMessage === 'function') {
              this.sendMessage();
            }
          } catch (_) {}
        }, 0);
      }
    }
  };

  proto.editFaqTags = async function(faq) {
    const currentTags = _normalizeFaqTags(faq?.tags);
    const nextRaw = window.prompt('编辑标签（逗号分隔）：', currentTags.join(', '));
    if (nextRaw == null) return;
    const nextTags = _normalizeFaqTags(nextRaw);
    
    try {
      if (this.faqApi && this.faqApi.isEnabled()) {
        // 使用 key 作为标识符（参考 YiWeb 实现）
        const key = String(faq?.key || '').trim();
        if (!key) {
          throw new Error('无法确定常见问题的标识符');
        }
        await this.faqApi.updateFaq(key, {
          tags: nextTags
        });
        if (this.faqApi.clearGetCache) {
          this.faqApi.clearGetCache();
        }
        await this.loadFaqsIntoManager(true);
        this.showNotification('已更新标签', 'success');
      } else {
        throw new Error('FAQ API 未启用');
      }
    } catch (e) {
      console.error('更新标签失败:', e);
      this.showNotification('更新标签失败: ' + (e?.message || '未知错误'), 'error');
    }
  };

  proto.addFaqFromInput = async function() {
    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    if (!overlay) return;
    const input = overlay.querySelector('.pet-faq-input');
    if (!input) return;

    const raw = String(input.value || '').trim();
    if (!raw) return;
    
    // 解析标题和正文：首行作为标题，余下作为正文
    const lines = raw.split('\n');
    const title = String(lines[0] || '').trim();
    const prompt = String(lines.slice(1).join('\n') || '').trim();
    
    try {
      if (this.faqApi && this.faqApi.isEnabled()) {
        // 使用完整的 text 字段保存，API 会处理
        const data = {
          text: raw,  // 保存完整文本，包含标题和正文
          tags: []
        };
        await this.faqApi.createFaq(data);
        if (this.faqApi.clearGetCache) {
          this.faqApi.clearGetCache();
        }
        input.value = '';
        await this.loadFaqsIntoManager(true);
        this.showNotification('已添加常见问题', 'success');
        
        // 将焦点返回到搜索输入框
        const searchInput = overlay.querySelector('.pet-faq-search-input');
        if (searchInput) {
          setTimeout(() => searchInput.focus(), 0);
        }
      } else {
        throw new Error('FAQ API 未启用');
      }
    } catch (err) {
      console.error('添加常见问题失败:', err);
      this.showNotification('添加失败: ' + (err.message || '未知错误'), 'error');
    }
  };

  proto.deleteFaq = async function(faq) {
    const key = String(faq?.key || faq?.text || '').trim();
    if (!key) {
      if (typeof this.showNotification === 'function') {
        this.showNotification('无法删除：常见问题标识符无效', 'error');
      }
      return;
    }
    if (!confirm('确定要删除这条常见问题吗？')) return;
    
    // 查找对应的删除按钮并禁用
    const overlay = this.chatWindow?.querySelector('#pet-faq-manager');
    let deleteBtn = null;
    if (overlay) {
      const faqItems = overlay.querySelectorAll('.pet-faq-item');
      for (const item of faqItems) {
        const titleEl = item.querySelector('.pet-faq-item-title');
        if (titleEl && titleEl.textContent === (faq.title || '常见问题')) {
          deleteBtn = item.querySelector('.pet-faq-item-btn.danger');
          break;
        }
      }
    }
    
    // 禁用按钮并显示加载状态
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.dataset.deleting = 'true';
      const originalText = deleteBtn.textContent;
      deleteBtn.textContent = '删除中...';
    }
    
    try {
      if (!this.faqApi || !this.faqApi.isEnabled()) {
        throw new Error('FAQ API 未启用');
      }
      
      await this.faqApi.deleteFaq(key);
      if (this.faqApi.clearGetCache) {
        this.faqApi.clearGetCache();
      }
      await this.loadFaqsIntoManager(true);
      if (typeof this.showNotification === 'function') {
        this.showNotification('已删除常见问题', 'success');
      }
    } catch (err) {
      console.error('删除常见问题失败:', err);
      if (typeof this.showNotification === 'function') {
        this.showNotification('删除失败: ' + (err.message || '未知错误'), 'error');
      }
      // 恢复按钮状态
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.dataset.deleting = 'false';
        deleteBtn.textContent = '删除';
      }
    }
  };
})();
