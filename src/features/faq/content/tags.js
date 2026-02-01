;(function() {
  'use strict';
  if (typeof window.PetManager === 'undefined') return;
  const proto = window.PetManager.prototype;

  proto.openFaqTagManager = function(faqIndex) {
        if (!this.chatWindow) return;

        const list = typeof this.getFaqManagerFilteredFaqs === 'function' ? this.getFaqManagerFilteredFaqs() : [];
        const faq = list?.[faqIndex];
        if (!faq) return;

        const store = this.ensureFaqTagManagerUi();
        if (!store) return;

        const currentTags = Array.isArray(faq.tags) ? faq.tags : [];
        store.visible = true;
        store.faqIndex = faqIndex;
        store.inputValue = '';
        store.currentTags = currentTags.map((t) => String(t ?? '').trim()).filter((t) => t);
        if (typeof this.lockSidebarToggle === 'function') {
            this.lockSidebarToggle('faq-tag-manager');
        }
    };

  proto.closeFaqTagManager = function() {
        if (typeof this.unlockSidebarToggle === 'function') {
            this.unlockSidebarToggle('faq-tag-manager');
        }
        const store = this._faqTagManagerStore;
        if (store) {
            store.visible = false;
            store.faqIndex = -1;
            store.inputValue = '';
            store.currentTags = [];
            store.isSmartGenerating = false;
        }
    };

  proto.ensureFaqTagManagerStore = function() {
        if (this._faqTagManagerStore) return this._faqTagManagerStore;
        const Vue = window.Vue || {};
        const { reactive } = Vue;
        if (typeof reactive !== 'function') {
            if (typeof this.showNotification === 'function') {
                this.showNotification('无法打开标签管理：Vue 未初始化', 'error');
            }
            return;
        }

        const store = reactive({
            visible: false,
            faqIndex: -1,
            inputValue: '',
            currentTags: [],
            isSmartGenerating: false
        });

        this._faqTagManagerStore = store;
        return store;
    };

  proto.ensureFaqTagManagerUi = function() {
        const store = this.ensureFaqTagManagerStore();
        if (!store) return null;

        const mountParent = this.chatWindow || document.body;
        const existing =
            (this.chatWindow && this.chatWindow.querySelector && this.chatWindow.querySelector('.pet-faq-tag-manager')) ||
            document.querySelector('.pet-faq-tag-manager');
        if (existing) return store;

        const existingHost =
            (this.chatWindow && this.chatWindow.querySelector && this.chatWindow.querySelector('#pet-faq-tag-manager-host')) ||
            document.querySelector('#pet-faq-tag-manager-host');
        if (existingHost && existingHost._store === store) return store;

        const Vue = window.Vue || {};
        const { createApp } = Vue;
        if (typeof createApp !== 'function') return store;

        const canUseTemplate = (() => {
            if (typeof Vue?.compile !== 'function') return false;
            try {
                Function('return 1')();
                return true;
            } catch (_) {
                return false;
            }
        })();

        const host = document.createElement('div');
        host.id = 'pet-faq-tag-manager-host';
        host._store = store;
        try {
            if (typeof PET_CONFIG !== 'undefined' && PET_CONFIG?.ui?.zIndex?.modal != null) {
                host.style.setProperty('z-index', `${PET_CONFIG.ui.zIndex.modal}`, 'important');
            }
        } catch (_) {}

        host._mountPromise = (async () => {
            try {
                const mod = window.PetManager?.Components?.FaqTagManager;
                if (!mod || typeof mod.createComponent !== 'function') return;
                const template = canUseTemplate && typeof mod.loadTemplate === 'function' ? await mod.loadTemplate() : '';
                const ctor = mod.createComponent({ manager: this, store, template });
                if (!ctor) return;
                host._vueApp = createApp(ctor);
                host._vueInstance = host._vueApp.mount(host);
            } catch (_) {}
        })();

        try {
            mountParent.appendChild(host);
        } catch (_) {
            try {
                document.body.appendChild(host);
            } catch (_) {}
        }

        this._faqTagManagerUiHost = host;
        return store;
    };

  proto.loadFaqTagsIntoManager = function(faqIndex, tags) {
        const store = this._faqTagManagerStore;
        if (!store) return;
        const normalized = (Array.isArray(tags) ? tags : [])
            .map((t) => String(t ?? '').trim())
            .filter((t) => t);
        store.faqIndex = Number.isFinite(Number(faqIndex)) ? Number(faqIndex) : store.faqIndex;
        store.currentTags = normalized;
    };

  proto.addFaqTagFromInput = function(faqIndex) {
        const store = this._faqTagManagerStore;
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
    };

  proto.addFaqQuickTag = function(faqIndex, tagName) {
        const store = this._faqTagManagerStore;
        if (!store) return;
        const t = String(tagName ?? '').trim();
        if (!t) return;
        if (!Array.isArray(store.currentTags)) store.currentTags = [];
        if (store.currentTags.includes(t)) return;
        store.currentTags.push(t);
    };

  proto.removeFaqTag = function(faqIndex, index) {
        const store = this._faqTagManagerStore;
        if (!store || !Array.isArray(store.currentTags)) return;
        store.currentTags.splice(index, 1);
    };

  proto.saveFaqTags = async function(faqIndex) {
        const store = this._faqTagManagerStore;
        if (!store) return;

        const list = typeof this.getFaqManagerFilteredFaqs === 'function' ? this.getFaqManagerFilteredFaqs() : [];
        const faq = list?.[faqIndex];
        if (!faq) return;

        const newTags = (Array.isArray(store.currentTags) ? store.currentTags : [])
            .map((tag) => String(tag ?? '').trim())
            .filter((tag) => tag);
        const uniq = [...new Set(newTags)];

        try {
            if (this.faqApi && this.faqApi.isEnabled()) {
                // 使用 key 作为标识符（参考 YiWeb 实现）
                const key = String(faq?.key || '').trim();
                if (!key) {
                    throw new Error('无法确定常见问题的标识符');
                }
                await this.faqApi.updateFaq(key, {
                    tags: uniq
                });

                if (this.faqApi.clearGetCache) {
                    this.faqApi.clearGetCache();
                }
                await this.loadFaqsIntoManager(true);
                this.closeFaqTagManager();
                this.showNotification('标签已保存', 'success');
            } else {
                await this.loadFaqsIntoManager();
                this.closeFaqTagManager();
                this.showNotification('标签已保存', 'success');
            }
        } catch (error) {
            console.error('保存标签失败:', error);
            this.showNotification('保存失败，请重试', 'error');
        }
    };

  proto.generateFaqSmartTags = async function(faqIndex) {
        const list = typeof this.getFaqManagerFilteredFaqs === 'function' ? this.getFaqManagerFilteredFaqs() : [];
        const faq = list?.[faqIndex];
        if (!faq) {
            console.warn('常见问题不存在，无法生成标签:', faqIndex);
            return;
        }

        const store = this._faqTagManagerStore;
        if (!store) return;
        if (store.isSmartGenerating) return;
        store.isSmartGenerating = true;

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
            const currentTags = Array.isArray(store.currentTags) ? store.currentTags : [];
            if (currentTags.length > 0) {
                userPrompt += `\n\n已有标签：${currentTags.join(', ')}\n请避免生成重复的标签。`;
            }
            userPrompt += `\n\n请根据以上信息生成合适的标签。`;

            void systemPrompt;
            void userPrompt;
        } catch (e) {
        } finally {
            store.isSmartGenerating = false;
        }
    };
})();
