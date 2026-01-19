(function () {
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return;
  }
  const proto = window.PetManager.prototype;

  proto.updateTagFilterUI = function () {
    if (!this.sessionSidebar) return;
    const tagList = this.sessionSidebar.querySelector('.tag-filter-list');
    if (!tagList) return;
    const reverseBtn = this.sessionSidebar.querySelector('.tag-filter-reverse');
    const noTagsBtn = this.sessionSidebar.querySelector('.tag-filter-no-tags');
    const clearBtn = this.sessionSidebar.querySelector('.tag-filter-clear');
    const searchInput = this.sessionSidebar.querySelector('.tag-filter-search');
    const searchIcon = this.sessionSidebar.querySelector('.tag-filter-search-container span');
    const allTags = typeof this.getAllTags === 'function' ? this.getAllTags() : [];
    const keyword = (this.tagFilterSearchKeyword || '').trim().toLowerCase();
    const filtered = keyword ? allTags.filter(t => t.toLowerCase().includes(keyword)) : allTags;
    const visibleCount = typeof this.tagFilterVisibleCount === 'number' ? this.tagFilterVisibleCount : 8;
    if (reverseBtn) {
      reverseBtn.style.color = this.tagFilterReverse ? '#22c55e' : '#9ca3af';  /* 现代绿 */
      reverseBtn.style.opacity = this.tagFilterReverse ? '1' : '0.6';
    }
    if (noTagsBtn) {
      noTagsBtn.style.color = this.tagFilterNoTags ? '#22c55e' : '#9ca3af';  /* 现代绿 */
      noTagsBtn.style.opacity = this.tagFilterNoTags ? '1' : '0.6';
      if (!noTagsBtn._bound) {
        noTagsBtn.addEventListener('click', () => {
          this.tagFilterNoTags = !this.tagFilterNoTags;
          this.updateTagFilterUI();
          this.updateSessionSidebar();
        });
        noTagsBtn._bound = true;
      }
    }
    if (clearBtn) {
      const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0;
      const hasSearchKeyword = keyword.length > 0;
      const hasActiveFilter = hasSelectedTags || this.tagFilterNoTags || hasSearchKeyword;
      clearBtn.style.opacity = hasActiveFilter ? '0.8' : '0.4';
    }
    if (searchInput && searchIcon) {
      searchIcon.style.opacity = keyword ? '0.8' : '0.5';
    }
    tagList.innerHTML = '';

    // Calculate tag counts and no-tags count
    const tagCounts = {};
    let noTagsCount = 0;
    const allSessions = this._getSessionsFromLocal(); // Get all sessions
    allSessions.forEach(session => {
      if (Array.isArray(session.tags) && session.tags.length > 0) {
        session.tags.forEach(tag => {
          if (tag) {
            const t = tag.trim();
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          }
        });
      } else {
        noTagsCount++;
      }
    });

    const selected = Array.isArray(this.selectedFilterTags) ? this.selectedFilterTags : [];
    const hasMoreTags = !this.tagFilterExpanded && filtered.length > visibleCount;
    const tagsToShow = this.tagFilterExpanded ? filtered : filtered.slice(0, visibleCount);

    if (typeof this.attachTagDragStyles === 'function') {
      this.attachTagDragStyles();
    }

    // 添加"无标签"按钮（如果有无标签的会话）
    if (noTagsCount > 0) {
      const noTagsBtn = document.createElement('button');
      noTagsBtn.className = 'tag-filter-item tag-no-tags';
      noTagsBtn.textContent = `没有标签 (${noTagsCount})`;
      noTagsBtn.dataset.tagName = '__no_tags__';
      noTagsBtn.draggable = false;
      if (this.tagFilterNoTags) {
        noTagsBtn.classList.add('selected');
      }
      noTagsBtn.title = this.tagFilterNoTags ? '取消筛选无标签会话' : '筛选没有标签的会话';
      noTagsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tagFilterNoTags = !this.tagFilterNoTags;
        this.updateTagFilterUI();
        this.updateSessionSidebar();
      });
      tagList.appendChild(noTagsBtn);
    }

    // 添加标签项
    tagsToShow.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-filter-item';
      const count = tagCounts[tag] || 0;
      btn.textContent = `${tag} (${count})`;
      btn.dataset.tagName = tag;
      const isSelected = selected.includes(tag);
      if (isSelected) {
        btn.classList.add('selected');
      }
      btn.title = isSelected ? '取消选择 | 拖拽调整顺序' : '选择标签 | 拖拽调整顺序';
      btn.draggable = true;
      if (typeof this.attachDragHandlersToTag === 'function') {
        this.attachDragHandlersToTag(btn, tag);
      }
      tagList.appendChild(btn);
    });

    // 添加展开/折叠按钮（如果有更多标签且没有搜索关键词）
    if (hasMoreTags && !keyword) {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'tag-filter-item tag-expand-btn';
      expandBtn.draggable = false;
      const remainingCount = filtered.length - visibleCount;
      expandBtn.textContent = this.tagFilterExpanded ? '收起' : `展开 (${remainingCount})`;
      expandBtn.title = this.tagFilterExpanded ? '收起标签' : '展开标签';
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tagFilterExpanded = !this.tagFilterExpanded;
        if (typeof this.updateTagFilterUI === 'function') this.updateTagFilterUI();
      });
      tagList.appendChild(expandBtn);
    }
  };

  proto.createSearchInput = function (options) {
    const container = document.createElement('div');
    container.className = 'tag-filter-search-container';

    const icon = document.createElement('span');
    icon.className = 'tag-filter-search-icon';
    icon.textContent = '🔍';

    const input = document.createElement('input');
    if (options.className) input.className = options.className;
    input.classList.add('tag-filter-search-input');
    input.type = 'text';
    input.placeholder = options.placeholder || '';
    input.value = options.value || '';

    input.addEventListener('focus', () => {
      container.classList.add('focused');
    });
    input.addEventListener('blur', () => {
      container.classList.remove('focused');
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'tag-filter-search-clear';
    if (input.value) {
      clearBtn.classList.add('visible');
    }
    clearBtn.textContent = '✕';
    clearBtn.title = '清除';

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      clearBtn.classList.remove('visible');
      if (typeof options.onClear === 'function') options.onClear();
    });

    let timer = null;
    const debounceMs = typeof options.debounce === 'number' ? options.debounce : 300;
    input.addEventListener('input', (e) => {
      const v = e.target.value || '';
      if (v) {
        clearBtn.classList.add('visible');
      } else {
        clearBtn.classList.remove('visible');
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (typeof options.onChange === 'function') options.onChange(v);
      }, debounceMs);
    });

    container.appendChild(icon);
    container.appendChild(input);
    container.appendChild(clearBtn);
    return { container, input, clearBtn };
  };

  proto.createButton = function (options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const classes = [];
    if (options.className) classes.push(options.className);
    if (options.variant) classes.push(`ui-btn--${options.variant}`);
    if (options.size) classes.push(`ui-btn--${options.size}`);
    classes.push('ui-btn');
    btn.className = classes.join(' ');
    if (options.text) btn.textContent = options.text;
    if (options.icon) btn.innerHTML = options.icon + (options.text ? ` ${options.text}` : '');
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([k, v]) => btn.setAttribute(k, v));
    }
    if (options.onClick) {
      btn.addEventListener('click', options.onClick);
    }
    if (options.style) {
      Object.assign(btn.style, options.style);
    }
    return btn;
  };

  proto.applyViewMode = function () {
    if (!this.sessionSidebar) return;
    const btnSession = this.sessionSidebar.querySelector('#view-toggle-session');
    if (!btnSession) return;
    const currentColor = this.colors[this.colorIndex];
    const currentMainColor = this.getMainColorFromGradient(currentColor);
    const resetBtn = (b) => {
      if (!b) return;
      b.style.background = 'transparent';
      b.style.color = '#6b7280';
      b.style.border = 'none';
    };
    const activateBtn = (b) => {
      if (!b) return;
      b.style.background = currentMainColor;
      b.style.color = '#fff';
      b.style.border = 'none';
    };
    activateBtn(btnSession);
  };
  proto.updateSessionSidebar = async function (forceRefresh = false, skipBackendRefresh = false) {
    if (!this.sessionSidebar) {
      console.log('会话侧边栏未创建，跳过更新');
      return;
    }
    const apiRequestList = this.sessionSidebar.querySelector('.api-request-list');
    if (apiRequestList) {
      apiRequestList.style.display = 'none';
    }
    const apiRequestTagFilterContainer = this.sessionSidebar.querySelector('.api-request-tag-filter-container');
    if (apiRequestTagFilterContainer) {
      apiRequestTagFilterContainer.style.display = 'none';
    }
    const tagFilterContainer = this.sessionSidebar.querySelector('.tag-filter-container');
    const batchToolbar = this.sessionSidebar.querySelector('#batch-toolbar');
    const scrollableContent = this.sessionSidebar.querySelector('.session-sidebar-scrollable-content');
    if (tagFilterContainer) {
      tagFilterContainer.style.display = 'block';
    }
    if (batchToolbar) {
      if (this.batchMode) {
        batchToolbar.classList.add('visible');
        if (this.sessionSidebar) this.sessionSidebar.classList.add('batch-mode-active');
      } else {
        batchToolbar.classList.remove('visible');
        if (this.sessionSidebar) this.sessionSidebar.classList.remove('batch-mode-active');
      }
    }
    if (scrollableContent) {
      scrollableContent.style.display = 'flex';
    }
    const searchInput = this.sessionSidebar.querySelector('#session-search-input');
    if (searchInput) {
      searchInput.placeholder = '搜索会话...';
    }
    if (this.tagFilterNoTags === undefined) {
      this.tagFilterNoTags = false;
    }
    this.updateTagFilterUI();
    if (typeof this.applyViewMode === 'function') {
      this.applyViewMode();
    }
    const sessionList = this.sessionSidebar.querySelector('.session-list');
    if (!sessionList) {
      console.log('会话列表容器未找到，跳过更新');
      return;
    }
    sessionList.style.display = 'block';
    let allSessions = this._getFilteredSessions();
    sessionList.innerHTML = '';
    console.log('当前会话数量:', allSessions.length);
    if (allSessions.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'session-list-empty';
      emptyMsg.textContent = '暂无会话';
      sessionList.appendChild(emptyMsg);
      return;
    }
    const q = (this.sessionTitleFilter || '').trim();
    const hasFilter = q ||
      (this.selectedFilterTags && this.selectedFilterTags.length > 0) ||
      this.tagFilterNoTags ||
      this.dateRangeFilter;
    const sortedSessions = allSessions.sort((a, b) => {
      const aTags = Array.isArray(a.tags) ? a.tags.map((t) => String(t).trim()) : [];
      const bTags = Array.isArray(b.tags) ? b.tags.map((t) => String(t).trim()) : [];
      const aHasNoTags = aTags.length === 0 || !aTags.some((t) => t);
      const bHasNoTags = bTags.length === 0 || !bTags.some((t) => t);
      const aFavorite = a.isFavorite || false;
      const bFavorite = b.isFavorite || false;
      if (aFavorite !== bFavorite) {
        return bFavorite ? 1 : -1;
      }
      if (aHasNoTags !== bHasNoTags) {
        return aHasNoTags ? -1 : 1;
      }
      const aTime = a.lastAccessTime || a.lastActiveAt || a.updatedAt || a.createdAt || 0;
      const bTime = b.lastAccessTime || b.lastActiveAt || b.updatedAt || b.createdAt || 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      const aTitle = String(a.pageTitle || a.id || '').trim();
      const bTitle = String(b.pageTitle || b.id || '').trim();
      return aTitle.localeCompare(bTitle);
    });
    for (const session of sortedSessions) {
      if (window.PetManager && window.PetManager.Components && window.PetManager.Components.SessionItem) {
        const sessionItem = new window.PetManager.Components.SessionItem(this, session);
        sessionList.appendChild(sessionItem.create());
      }
    }
    console.log('会话侧边栏已更新，显示', sortedSessions.length, '个会话');
  };

  proto.updateSessionUI = async function (options = {}) {
    const {
      updateSidebar = false,
      updateTitle = false,
      loadMessages = false,
      keepApiRequestListView = false
    } = options;

    if (updateSidebar && typeof this.updateSessionSidebar === 'function') {
      await this.updateSessionSidebar(false, false);
    }

    if (updateTitle && typeof this.updateChatHeaderTitle === 'function') {
      this.updateChatHeaderTitle();
    }

    if (loadMessages && typeof this.loadSessionMessages === 'function') {
      await this.loadSessionMessages();
    }
  };

  proto.loadSidebarWidth = function () {
    try {
      chrome.storage.local.get(['sessionSidebarWidth'], (result) => {
        if (result.sessionSidebarWidth && typeof result.sessionSidebarWidth === 'number') {
          const width = Math.max(150, Math.min(500, result.sessionSidebarWidth));
          this.sidebarWidth = width;
          if (this.sessionSidebar) {
            this.sessionSidebar.style.setProperty('width', `${width}px`, 'important');
          }
        }
      });
    } catch (error) { }
  };
  proto.saveSidebarWidth = function () {
    try {
      chrome.storage.local.set({ sessionSidebarWidth: this.sidebarWidth }, () => { });
    } catch (error) { }
  };
  proto.loadSidebarCollapsed = function () {
    try {
      chrome.storage.local.get(['sessionSidebarCollapsed'], (result) => {
        if (result.sessionSidebarCollapsed !== undefined) {
          this.sidebarCollapsed = result.sessionSidebarCollapsed;
          if (this.sessionSidebar) {
            this.applySidebarCollapsedState();
          }
        }
      });
    } catch (error) { }
  };
  proto.saveSidebarCollapsed = function () {
    try {
      chrome.storage.local.set({ sessionSidebarCollapsed: this.sidebarCollapsed }, () => { });
    } catch (error) { }
  };
  proto.applySidebarCollapsedState = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.setSidebarCollapsed === 'function') {
      this.chatWindowComponent.setSidebarCollapsed(this.sidebarCollapsed);
      return;
    }
    // Fallback for legacy or if component not ready
    if (!this.sessionSidebar) return;
    if (this.sidebarCollapsed) {
      this.sessionSidebar.style.setProperty('display', 'none', 'important');
    } else {
      this.sessionSidebar.style.setProperty('display', 'flex', 'important');
    }
  };
  proto.toggleSidebar = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.toggleSidebar === 'function') {
      this.chatWindowComponent.toggleSidebar();
      return;
    }
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.applySidebarCollapsedState();
    this.saveSidebarCollapsed();
  };
  proto.loadInputContainerCollapsed = function () {
    try {
      chrome.storage.local.get(['chatInputContainerCollapsed'], (result) => {
        if (result.chatInputContainerCollapsed !== undefined) {
          this.inputContainerCollapsed = result.chatInputContainerCollapsed;
          if (this.chatWindow) {
            this.applyInputContainerCollapsedState();
          }
        }
      });
    } catch (error) { }
  };
  proto.saveInputContainerCollapsed = function () {
    try {
      chrome.storage.local.set({ chatInputContainerCollapsed: this.inputContainerCollapsed }, () => { });
    } catch (error) { }
  };
  proto.applyInputContainerCollapsedState = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.setInputContainerCollapsed === 'function') {
      this.chatWindowComponent.setInputContainerCollapsed(this.inputContainerCollapsed);
      return;
    }
    // Fallback
    if (!this.chatWindow) return;
    const inputContainer = this.chatWindow.querySelector('.chat-input-container');
    if (!inputContainer) return;
    if (this.inputContainerCollapsed) {
      inputContainer.style.setProperty('display', 'none', 'important');
    } else {
      inputContainer.style.setProperty('display', 'flex', 'important');
    }
  };
  proto.toggleInputContainer = function () {
    if (this.chatWindowComponent && typeof this.chatWindowComponent.toggleInputContainer === 'function') {
      this.chatWindowComponent.toggleInputContainer();
      return;
    }
    this.inputContainerCollapsed = !this.inputContainerCollapsed;
    this.applyInputContainerCollapsedState();
    this.saveInputContainerCollapsed();
  };
  proto.updateBatchToolbar = function () {
    const selectedCount = document.getElementById('selected-count');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const selectAllBtn = document.getElementById('select-all-btn');

    // 判断当前显示的是会话列表、文件列表还是请求接口列表
    const sessionList = this.sessionSidebar.querySelector('.session-list');

    const count = this.selectedSessionIds.size;

    if (selectedCount) {
      selectedCount.textContent = `已选择 ${count} 个`;

      // 根据选中数量更新样式
      if (count > 0) {
        selectedCount.classList.add('has-selection');
      } else {
        selectedCount.classList.remove('has-selection');
      }
    }

    if (batchDeleteBtn) {
      const hasSelection = count > 0;
      batchDeleteBtn.disabled = !hasSelection;
    }

    // 更新全选按钮状态
    if (selectAllBtn) {
      let allSelected = false;
      const filteredSessions = this._getFilteredSessions();
      allSelected = filteredSessions.length > 0 &&
        filteredSessions.every(session => session.key && this.selectedSessionIds.has(session.key));

      if (allSelected) {
        selectAllBtn.textContent = '取消全选';
        selectAllBtn.classList.add('batch-toolbar-btn--active');
        selectAllBtn.classList.remove('batch-toolbar-btn--default');
      } else {
        selectAllBtn.textContent = '全选';
        selectAllBtn.classList.remove('batch-toolbar-btn--active');
        selectAllBtn.classList.add('batch-toolbar-btn--default');
      }
    }
  };

  // 切换全选/取消全选
  proto.toggleSelectAll = function () {
    // 会话列表模式
    const filteredSessions = this._getFilteredSessions();
    const allSelected = filteredSessions.length > 0 &&
      filteredSessions.every(session => session.key && this.selectedSessionIds.has(session.key));

    if (allSelected) {
      // 取消全选：只取消当前显示的会话
      filteredSessions.forEach(session => {
        if (session.key) {
          this.selectedSessionIds.delete(session.key);
        }
      });
    } else {
      // 全选：选中所有当前显示的会话
      filteredSessions.forEach(session => {
        if (session.key) {
          this.selectedSessionIds.add(session.key);
        }
      });
    }

    // 更新所有复选框状态
    const sessionItems = this.sessionSidebar.querySelectorAll('.session-item');
    sessionItems.forEach(item => {
      const sessionId = item.dataset.sessionId;
      const checkbox = item.querySelector('.session-checkbox input[type="checkbox"]');
      const isSelected = this.selectedSessionIds.has(sessionId);

      if (checkbox) {
        checkbox.checked = isSelected;
      }

      if (isSelected) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    // 更新批量工具栏
    this.updateBatchToolbar();
  };

  proto.buildBatchToolbar = function () {
    const toolbar = document.createElement('div');
    toolbar.id = 'batch-toolbar';
    toolbar.className = 'batch-toolbar';

    const selectedCount = document.createElement('span');
    selectedCount.id = 'selected-count';
    selectedCount.className = 'batch-selected-count';
    selectedCount.textContent = '已选择 0 个';

    const selectAllBtn = this.createButton({
      text: '全选',
      className: 'batch-toolbar-btn batch-toolbar-btn--default',
      onClick: () => {
        this.toggleSelectAll();
      }
    });
    selectAllBtn.id = 'select-all-btn';

    const batchDeleteBtn = this.createButton({
      className: 'batch-toolbar-btn batch-toolbar-btn--danger'
    });
    batchDeleteBtn.id = 'batch-delete-btn';
    const deleteLoader = document.createElement('span');
    deleteLoader.className = 'delete-loader';

    const deleteIcon = document.createElement('span');
    deleteIcon.textContent = '🗑️';
    deleteIcon.className = 'batch-action-icon';

    const deleteText = document.createElement('span');
    deleteText.textContent = '删除';
    batchDeleteBtn.appendChild(deleteLoader);
    batchDeleteBtn.appendChild(deleteIcon);
    batchDeleteBtn.appendChild(deleteText);

    batchDeleteBtn.addEventListener('click', async () => {
      if (batchDeleteBtn.disabled) return;
      const loader = batchDeleteBtn.querySelector('.delete-loader');
      const spans = batchDeleteBtn.querySelectorAll('span:not(.delete-loader)');
      const iconEl = spans[0];
      const textEl = spans[1];
      if (loader) loader.classList.add('visible');
      if (iconEl) iconEl.style.display = 'none';
      if (textEl) textEl.textContent = '删除中...';
      batchDeleteBtn.disabled = true;
      batchDeleteBtn.classList.add('loading');
      try {
        await this.batchDeleteSessions();
      } finally {
        if (loader) loader.classList.remove('visible');
        if (iconEl) iconEl.style.display = 'inline';
        if (textEl) textEl.textContent = '删除';
        batchDeleteBtn.disabled = false;
        batchDeleteBtn.classList.remove('loading');
      }
    });

    const cancelBatchBtn = this.createButton({
      text: '取消',
      className: 'batch-toolbar-btn batch-toolbar-btn--default'
    });
    const cancelIcon = document.createElement('span');
    cancelIcon.textContent = '✕';
    cancelIcon.className = 'batch-cancel-icon';

    const cancelTextNode = document.createTextNode('取消');
    cancelBatchBtn.textContent = '';
    cancelBatchBtn.appendChild(cancelIcon);
    cancelBatchBtn.appendChild(cancelTextNode);

    cancelBatchBtn.addEventListener('click', () => {
      this.exitBatchMode();
    });

    toolbar.appendChild(selectedCount);
    toolbar.appendChild(selectAllBtn);
    toolbar.appendChild(batchDeleteBtn);
    toolbar.appendChild(cancelBatchBtn);
    return toolbar;
  };
  // 批量删除（支持会话、文件和请求接口）
  proto.batchDeleteSessions = async function () {
    const sessionList = this.sessionSidebar.querySelector('.session-list');
    // 批量删除会话
    if (this.selectedSessionIds.size === 0) {
      this.showNotification('请先选择要删除的会话', 'error');
      return;
    }

    const count = this.selectedSessionIds.size;
    const confirmMessage = `确定要删除选中的 ${count} 个会话吗？此操作不可撤销。`;
    if (!confirm(confirmMessage)) {
      return;
    }

    const sessionIds = Array.from(this.selectedSessionIds);

    try {
      // 同时收集会话信息用于删除 aicr 项目文件
      const sessionsToDelete = [];
      sessionIds.forEach(sessionId => {
        const session = this.sessions[sessionId];
        if (session) {
          sessionsToDelete.push({
            sessionId,
            unifiedSessionId: session.key || sessionId
          });
        }
      });

      // 从本地删除
      sessionIds.forEach(sessionId => {
        if (this.sessions[sessionId]) {
          delete this.sessions[sessionId];
        }
        // 如果删除的是当前会话，清空当前会话ID
        if (sessionId === this.currentSessionId) {
          this.currentSessionId = null;
          this.hasAutoCreatedSessionForPage = false;
        }
      });

      // 保存本地更改
      if (this.sessionManager) {
        // 使用 SessionManager 批量删除
        for (const sessionId of sessionIds) {
          await this.sessionManager.deleteSession(sessionId);
        }
      } else {
        // 保存到本地存储
        await this.saveAllSessions(true);
      }

      // 从后端删除（如果启用了后端同步）
      if (this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
        try {
          await this.sessionApi.deleteSessions(sessionIds);
          console.log('批量删除会话已同步到后端:', sessionIds);
        } catch (error) {
          console.warn('从后端批量删除会话失败:', error);
          // 即使后端删除失败，也继续执行，因为本地已删除
        }
      }

      // 清空选中状态
      this.selectedSessionIds.clear();

      // 退出批量模式
      this.exitBatchMode();

      // 刷新会话列表
      await this.updateSessionSidebar(true);

      // 显示成功通知
      this.showNotification(`已成功删除 ${count} 个会话`, 'success');

    } catch (error) {
      console.error('批量删除会话失败:', error);
      this.showNotification('批量删除会话失败: ' + error.message, 'error');
    }
  };

  // 创建侧边栏拖拽调整边框
  proto.createSidebarResizer = function () {
    if (!this.sessionSidebar) return;

    const resizer = document.createElement('div');
    resizer.className = 'sidebar-resizer';

    // 鼠标悬停效果
    resizer.addEventListener('mouseenter', () => {
      if (!this.isResizingSidebar) {
        resizer.classList.add('hover');
      }
    });

    resizer.addEventListener('mouseleave', () => {
      if (!this.isResizingSidebar) {
        resizer.classList.remove('hover');
      }
    });

    // 拖拽开始
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      this.isResizingSidebar = true;
      resizer.classList.add('dragging');
      resizer.classList.remove('hover');

      // 记录初始位置和宽度
      const startX = e.clientX;
      const startWidth = this.sidebarWidth;

      // 添加全局样式，禁用文本选择
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      // 拖拽中
      const handleMouseMove = (e) => {
        if (!this.isResizingSidebar) return;

        const diffX = e.clientX - startX;
        let newWidth = startWidth + diffX;

        // 限制宽度范围
        newWidth = Math.max(150, Math.min(500, newWidth));

        // 更新宽度
        this.sidebarWidth = newWidth;
        if (this.sessionSidebar) {
          this.sessionSidebar.style.setProperty('width', `${newWidth}px`, 'important');
        }

        // 更新折叠按钮位置（参考输入框折叠按钮的实现方式）
        const toggleBtn = this.chatWindow?.querySelector('#sidebar-toggle-btn');
        if (toggleBtn && !this.sidebarCollapsed) {
          toggleBtn.style.left = `${newWidth}px`;
          // 确保 transform 样式正确，按钮完全在外面（保留scale用于hover效果）
          const currentTransform = toggleBtn.style.transform;
          const baseTransform = 'translateY(-50%) translateX(14px)';
          if (!currentTransform.includes('scale')) {
            toggleBtn.style.transform = baseTransform;
          } else {
            const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
            if (scaleMatch) {
              toggleBtn.style.transform = `${baseTransform} ${scaleMatch[0]}`;
            } else {
              toggleBtn.style.transform = baseTransform;
            }
          }
        }
      };

      // 拖拽结束
      const handleMouseUp = () => {
        this.isResizingSidebar = false;
        resizer.classList.remove('dragging');
        resizer.classList.remove('hover');

        // 恢复全局样式
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        // 保存宽度
        this.saveSidebarWidth();

        // 移除事件监听器
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      // 添加全局事件监听器
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });

    this.sessionSidebar.appendChild(resizer);
  };

})();
