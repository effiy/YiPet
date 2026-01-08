(function () {
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return;
  }
  const proto = window.PetManager.prototype;

  proto.attachTagDragStyles = function () {
    if (document.getElementById('tag-drag-styles')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'tag-drag-styles';
    style.textContent = `
      .tag-filter-item {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      .tag-filter-item:hover:not(.dragging) {
        transform: translateY(-1px) !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
      }
      .tag-filter-item.dragging {
        opacity: 0.5 !important;
        transform: scale(0.92) rotate(2deg) !important;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
        cursor: grabbing !important;
        z-index: 1000 !important;
      }
      .tag-filter-item.drag-over-top {
        border-top: 3px solid #4CAF50 !important;
        margin-top: 4px !important;
        padding-top: 2px !important;
        animation: pulse-top 0.3s ease !important;
      }
      .tag-filter-item.drag-over-bottom {
        border-bottom: 3px solid #4CAF50 !important;
        margin-bottom: 4px !important;
        padding-bottom: 2px !important;
        animation: pulse-bottom 0.3s ease !important;
      }
      @keyframes pulse-top {
        0%, 100% { border-top-width: 3px; margin-top: 4px; }
        50% { border-top-width: 4px; margin-top: 6px; }
      }
      @keyframes pulse-bottom {
        0%, 100% { border-bottom-width: 3px; margin-bottom: 4px; }
        50% { border-bottom-width: 4px; margin-bottom: 6px; }
      }
      .tag-filter-item.drag-hover {
        background: #f0fdf4 !important;
        border-color: #86efac !important;
        transform: scale(1.05) !important;
      }
    `;
    document.head.appendChild(style);
  };

  proto.attachDragHandlersToTag = function (tagBtn, tag) {
    if (!tagBtn || !tag) return;
    tagBtn.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', tagBtn.outerHTML);
      e.dataTransfer.setData('text/plain', tag);
      tagBtn.classList.add('dragging');
      const dragImage = tagBtn.cloneNode(true);
      dragImage.style.opacity = '0.8';
      dragImage.style.transform = 'rotate(3deg)';
      dragImage.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
      setTimeout(() => {
        if (dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage);
        }
      }, 0);
    });
    tagBtn.addEventListener('dragend', () => {
      tagBtn.classList.remove('dragging');
      tagBtn.style.cursor = 'grab';
      document.querySelectorAll('.tag-filter-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
        item.style.borderTop = '';
        item.style.borderBottom = '';
        item.style.marginTop = '';
        item.style.marginBottom = '';
        item.style.paddingTop = '';
        item.style.paddingBottom = '';
      });
    });
    tagBtn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (tagBtn.classList.contains('dragging')) {
        return;
      }
      const rect = tagBtn.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      document.querySelectorAll('.tag-filter-item').forEach(item => {
        if (!item.classList.contains('dragging')) {
          item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
        }
      });
      if (e.clientY < midY) {
        tagBtn.classList.add('drag-over-top');
        tagBtn.classList.remove('drag-over-bottom');
      } else {
        tagBtn.classList.add('drag-over-bottom');
        tagBtn.classList.remove('drag-over-top');
      }
      tagBtn.classList.add('drag-hover');
    });
    tagBtn.addEventListener('dragleave', (e) => {
      const rect = tagBtn.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        tagBtn.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-hover');
      }
    });
    tagBtn.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedTag = e.dataTransfer.getData('text/plain');
      const targetTag = tagBtn.dataset.tagName;
      if (draggedTag === targetTag) {
        return;
      }
      const allTags = this.getAllTags();
      const draggedIndex = allTags.indexOf(draggedTag);
      const targetIndex = allTags.indexOf(targetTag);
      if (draggedIndex === -1 || targetIndex === -1) {
        return;
      }
      const rect = tagBtn.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      let insertIndex = targetIndex;
      insertIndex = e.clientY < midY ? targetIndex : targetIndex + 1;
      if (draggedIndex < insertIndex) {
        insertIndex -= 1;
      }
      const newOrder = [...allTags];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(insertIndex, 0, draggedTag);
      this.saveTagOrder(newOrder);
      this.showNotification('标签顺序已更新', 'success');
      setTimeout(() => {
        this.updateTagFilterUI();
      }, 100);
    });
    tagBtn.addEventListener('mouseenter', () => {
      if (document.querySelector('.tag-filter-item.dragging')) {
        return;
      }
      const isSelected = this.selectedFilterTags && this.selectedFilterTags.includes(tag);
      if (!isSelected) {
        tagBtn.style.borderColor = '#4CAF50';
        tagBtn.style.background = '#f0fdf4';
        tagBtn.style.color = '#4CAF50';
      } else {
        tagBtn.style.opacity = '0.95';
      }
    });
    tagBtn.addEventListener('mouseleave', () => {
      if (document.querySelector('.tag-filter-item.dragging')) {
        return;
      }
      const isSelected = this.selectedFilterTags && this.selectedFilterTags.includes(tag);
      if (!isSelected) {
        tagBtn.style.borderColor = '#e5e7eb';
        tagBtn.style.background = '#f9fafb';
        tagBtn.style.color = '#6b7280';
      } else {
        tagBtn.style.opacity = '1';
      }
    });
    tagBtn.addEventListener('click', (e) => {
      if (e.detail === 0) {
        return;
      }
      if (this.selectedFilterTags === undefined) {
        this.selectedFilterTags = [];
      }
      if (this.tagFilterNoTags === undefined) {
        this.tagFilterNoTags = false;
      }
      const index = this.selectedFilterTags.indexOf(tag);
      if (index > -1) {
        this.selectedFilterTags.splice(index, 1);
      } else {
        this.selectedFilterTags.push(tag);
      }
      this.updateTagFilterUI();
      this.updateSessionSidebar();
    });
  };

  proto.addInteractions = function() {
    if (!this.pet) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    this.pet.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = this.position.x;
        startTop = this.position.y;
        this.pet.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging && this.pet) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            this.position.x = Math.max(0, Math.min(window.innerWidth - this.size, startLeft + deltaX));
            this.position.y = Math.max(0, Math.min(window.innerHeight - this.size, startTop + deltaY));
            this.pet.style.left = this.position.x + 'px';
            this.pet.style.top = this.position.y + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        if (this.pet) {
            this.pet.style.cursor = 'grab';
            this.saveState(); // 拖拽结束后保存状态
            // 立即同步到全局状态
            this.syncToGlobalState();
        }
    });

    this.pet.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.pet.style.transform = 'scale(1.1)';
        setTimeout(() => {
            if (this.pet) {
                this.pet.style.transform = 'scale(1)';
            }
        }, 150);

        // 切换聊天窗口
        this.toggleChatWindow();
    });
  };
  proto.addInteractions = function() {
    if (!this.pet) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    this.pet.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = this.position.x;
        startTop = this.position.y;
        this.pet.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging && this.pet) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            this.position.x = Math.max(0, Math.min(window.innerWidth - this.size, startLeft + deltaX));
            this.position.y = Math.max(0, Math.min(window.innerHeight - this.size, startTop + deltaY));
            this.pet.style.left = this.position.x + 'px';
            this.pet.style.top = this.position.y + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        if (this.pet) {
            this.pet.style.cursor = 'grab';
            this.saveState(); // 拖拽结束后保存状态
            // 立即同步到全局状态
            this.syncToGlobalState();
        }
    });

    this.pet.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.pet.style.transform = 'scale(1.1)';
        setTimeout(() => {
            if (this.pet) {
                this.pet.style.transform = 'scale(1)';
            }
        }, 150);

        // 切换聊天窗口
        this.toggleChatWindow();
    });
  };
})();

