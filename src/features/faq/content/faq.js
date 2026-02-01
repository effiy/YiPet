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

  proto.ensureFaqManagerStore = function() {
    if (this._faqManagerStore) return this._faqManagerStore;
    const Vue = window.Vue || {};
    const { reactive } = Vue;
    if (typeof reactive !== 'function') return null;

    const store = reactive({
      visible: false,
      allFaqs: [],
      searchFilter: '',
      selectedTags: [],
      tagFilterReverse: false,
      tagFilterNoTags: false,
      tagFilterExpanded: false,
      tagFilterVisibleCount: 20,
      tagFilterSearchKeyword: '',
      tagManagerVisible: false,
      isLoading: false,
      error: '',
      newFaqText: '',
      deletingFaqKeys: Object.create(null)
    });

    this._faqManagerStore = store;
    return store;
  };

  proto.ensureFaqManagerUi = function() {
    return this.ensureFaqManagerStore();
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
      
      const chatWindowComponent = this.chatWindowComponent;
      if (!chatWindowComponent || !chatWindowComponent._vueApp) {
        if (typeof this.showNotification === 'function') {
          this.showNotification('无法打开常见问题：当前页面未启用 Vue 模式', 'error');
        }
        return;
      }

      const store = this.ensureFaqManagerStore();
      if (!store) {
        if (typeof this.showNotification === 'function') {
          this.showNotification('无法打开常见问题：Vue 未初始化', 'error');
        }
        return;
      }
      
      if (typeof this.lockSidebarToggle === 'function') {
        this.lockSidebarToggle('faq-manager');
      }
      if (store) {
        store.visible = true;
        store.searchFilter = '';
        store.tagFilterSearchKeyword = '';
      }
      
      // 检查 FAQ API 是否已初始化
      if (!this.faqApi) {
        const errorMsg = '常见问题管理器：FAQ API 未初始化';
        console.error(errorMsg);
        if (typeof this.showNotification === 'function') {
          this.showNotification('常见问题功能未启用：FAQ API 未初始化', 'error');
        }
        if (store) store.visible = false;
        if (typeof this.unlockSidebarToggle === 'function') {
          this.unlockSidebarToggle('faq-manager');
        }
        return;
      }
      
      // 检查 FAQ API 是否启用
      if (this.faqApi && typeof this.faqApi.isEnabled === 'function' && !this.faqApi.isEnabled()) {
        const errorMsg = '常见问题管理器：FAQ API 未启用';
        console.error(errorMsg);
        if (typeof this.showNotification === 'function') {
          this.showNotification('常见问题功能未启用：FAQ API 未启用', 'error');
        }
        if (store) store.visible = false;
        if (typeof this.unlockSidebarToggle === 'function') {
          this.unlockSidebarToggle('faq-manager');
        }
        return;
      }

      await this.loadFaqsIntoManager(false);
    } catch (error) {
      console.error('打开常见问题管理器失败:', error);
      if (typeof this.showNotification === 'function') {
        this.showNotification(`打开常见问题失败：${error.message || '未知错误'}`, 'error');
      }
      // 确保弹窗关闭，按钮恢复显示
      const store = this._faqManagerStore;
      if (store) store.visible = false;
      if (typeof this.unlockSidebarToggle === 'function') {
        this.unlockSidebarToggle('faq-manager');
      }
    }
  };

  proto.closeFaqManagerOnly = function() {
    if (typeof this.unlockSidebarToggle === 'function') {
      this.unlockSidebarToggle('faq-manager');
    }
    const store = this._faqManagerStore;
    if (store) {
      store.visible = false;
      store.newFaqText = '';
    }
    
    // 尝试将焦点返回到聊天输入框
    try {
      const chatInput = this.chatWindowComponent?.messageInput;
      if (chatInput && typeof chatInput.focus === 'function') {
        chatInput.focus();
        return;
      }
    } catch (_) {}
  };

  proto._getFaqManagerStore = function() {
    return this._faqManagerStore || null;
  };

  proto.getFaqManagerFilteredFaqs = function() {
    const store = this._getFaqManagerStore();
    if (!store) return [];

    let out = Array.isArray(store.allFaqs) ? store.allFaqs : [];

    const searchKw = String(store.searchFilter || '').trim().toLowerCase();
    if (searchKw) {
      out = out.filter((faq) => {
        const hay = `${String(faq?.title || '')}\n${String(faq?.prompt || '')}`.toLowerCase();
        return hay.includes(searchKw);
      });
    }

    const selectedTags = Array.isArray(store.selectedTags) ? store.selectedTags : [];
    const reverse = !!store.tagFilterReverse;
    const noTags = !!store.tagFilterNoTags;

    out = out.filter((faq) => {
      const tags = _normalizeFaqTags(faq?.tags);
      if (noTags) return tags.length === 0;
      if (selectedTags.length === 0) return true;
      const hasAny = tags.some((t) => selectedTags.includes(t));
      return reverse ? !hasAny : hasAny;
    });

    return out;
  };

  proto.renameFaqTag = async function(tag) {
    const oldTag = String(tag ?? '').trim();
    if (!oldTag) return;
    const nextRaw = window.prompt('重命名标签为：', oldTag);
    if (nextRaw == null) return;
    const newTag = String(nextRaw ?? '').trim();
    if (!newTag || newTag === oldTag) return;
    const store = this._getFaqManagerStore();
    const allFaqs = Array.isArray(store?.allFaqs) ? store.allFaqs : [];

    const affected = allFaqs.filter((faq) => _normalizeFaqTags(faq?.tags).includes(oldTag));
    if (affected.length === 0) return;

    try {
      if (!this.faqApi || !this.faqApi.isEnabled()) {
        throw new Error('FAQ API 未启用');
      }
      
      for (const faq of affected) {
        const tags = _normalizeFaqTags(faq?.tags || []).map(t => (t === oldTag ? newTag : t));
        const key = faq.key;
        if (!key) {
          console.warn('跳过缺少标识符的常见问题:', faq);
          continue;
        }
        await this.faqApi.updateFaq(key, {
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
    const store = this._getFaqManagerStore();
    const allFaqs = Array.isArray(store?.allFaqs) ? store.allFaqs : [];

    const affected = allFaqs.filter((faq) => _normalizeFaqTags(faq?.tags).includes(target));
    if (affected.length === 0) return;

    try {
      if (!this.faqApi || !this.faqApi.isEnabled()) {
        throw new Error('FAQ API 未启用');
      }
      
      for (const faq of affected) {
        const tags = _normalizeFaqTags(faq?.tags || []).filter(t => t !== target);
        const key = faq.key;
        if (!key) {
          console.warn('跳过缺少标识符的常见问题:', faq);
          continue;
        }
        await this.faqApi.updateFaq(key, {
          tags: tags
        });
      }
      if (this.faqApi.clearGetCache) {
        this.faqApi.clearGetCache();
      }
      if (store && Array.isArray(store.selectedTags) && store.selectedTags.includes(target)) {
        store.selectedTags = store.selectedTags.filter((t) => t !== target);
      }
      await this.loadFaqsIntoManager(true);
      this.showNotification('已删除标签', 'success');
    } catch (e) {
      console.error('删除标签失败:', e);
      this.showNotification('删除标签失败: ' + (e?.message || '未知错误'), 'error');
    }
  };

  proto.loadFaqsIntoManager = async function(force = false) {
    const store = this._getFaqManagerStore();
    if (!store) return;

    try {
      store.isLoading = true;
      store.error = '';

      if (!this.faqApi) {
        throw new Error('FAQ API 未初始化');
      }
      if (force && typeof this.faqApi.clearGetCache === 'function') {
        this.faqApi.clearGetCache();
      }

      const faqs = await this.faqApi.getFaqs();
      const normalized = faqs.map(_normalizeFaqDoc).filter(i => i.key && (i.prompt || i.title));
      store.allFaqs = normalized;

    } catch (err) {
      console.error('加载常见问题失败:', err);
      const errorMessage = err.message || '加载常见问题失败';
      store.error = errorMessage;
      
      // 显示通知（如果方法存在）
      if (typeof this.showNotification === 'function') {
        this.showNotification(`加载常见问题失败: ${errorMessage}`, 'error');
      }
    } finally {
      store.isLoading = false;
    }
  };

  proto.applyFaqItem = function(faq, mode = 'insert') {
    // 提取标题和正文（参考 YiWeb 实现）
    let title = String(faq?.title || '').trim();
    let prompt = String(faq?.prompt || '').trim();
    
    // 组合文本：如果有标题和正文，用两个换行符分隔；否则使用正文或标题
    const text = title && prompt ? `${title}\n\n${prompt}` : (prompt || title);
    if (!text) return;
    
    const chatInput = this.chatWindowComponent?.messageInput;
    if (chatInput) {
      const current = String(chatInput.value || '');
      const next = current ? `${current}\n\n${text}` : text;
      chatInput.value = next;
      chatInput.focus();
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      
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
    const store = this._getFaqManagerStore();
    if (!store) return;
    const raw = String(store.newFaqText || '').trim();
    if (!raw) return;
    
    // 解析标题和正文：首行作为标题，余下作为正文
    const lines = raw.split('\n');
    const title = String(lines[0] || '').trim();
    const prompt = String(lines.slice(1).join('\n') || '').trim();
    
    try {
      if (this.faqApi && this.faqApi.isEnabled()) {
        const data = {
          title,
          prompt,
          tags: []
        };
        await this.faqApi.createFaq(data);
        if (this.faqApi.clearGetCache) {
          this.faqApi.clearGetCache();
        }
        store.newFaqText = '';
        await this.loadFaqsIntoManager(true);
        this.showNotification('已添加常见问题', 'success');
      } else {
        throw new Error('FAQ API 未启用');
      }
    } catch (err) {
      console.error('添加常见问题失败:', err);
      this.showNotification('添加失败: ' + (err.message || '未知错误'), 'error');
    }
  };

  proto.deleteFaq = async function(faq) {
    const key = String(faq?.key || '').trim();
    if (!key) {
      if (typeof this.showNotification === 'function') {
        this.showNotification('无法删除：常见问题标识符无效', 'error');
      }
      return;
    }
    if (!confirm('确定要删除这条常见问题吗？')) return;
    const store = this._getFaqManagerStore();
    if (store) {
      if (!store.deletingFaqKeys) store.deletingFaqKeys = Object.create(null);
      store.deletingFaqKeys[key] = true;
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
    } finally {
      if (store && store.deletingFaqKeys) {
        store.deletingFaqKeys[key] = false;
      }
    }
  };
})();
