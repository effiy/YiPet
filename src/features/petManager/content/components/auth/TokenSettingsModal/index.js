(function () {
  'use strict';

  if (!window.PetManager) return;
  if (!window.PetManager.Components) window.PetManager.Components = {};

  const TEMPLATE_RESOURCE_PATH = 'src/features/petManager/content/components/auth/TokenSettingsModal/index.html';
  let templateCache = '';

  function canUseVueTemplate(Vue) {
    if (typeof Vue?.compile !== 'function') return false;
    try {
      Function('return 1')();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function loadTemplate() {
    if (templateCache) return templateCache;
    const DomHelper = window.DomHelper;
    if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
    templateCache = await DomHelper.loadHtmlTemplate(
      TEMPLATE_RESOURCE_PATH,
      '#yi-pet-token-settings-modal-template',
      'Failed to load TokenSettingsModal template'
    );
    return templateCache;
  }

  function createComponent(params) {
    const manager = params?.manager;
    const store = params?.store;
    const template = params?.template;
    const Vue = window.Vue || {};
    const { defineComponent, ref, onMounted, nextTick, h } = Vue;
    if (typeof defineComponent !== 'function' || !store) return null;

    const useTemplate = canUseVueTemplate(Vue);
    const resolvedTemplate = useTemplate ? String(template || templateCache || '').trim() : '';
    if (useTemplate && !resolvedTemplate) return null;
    if (!useTemplate && typeof h !== 'function') return null;

    const componentOptions = {
      name: 'YiPetTokenSettingsModal',
      setup() {
        const tokenInputEl = ref(null);

        const focusInput = () => {
          if (typeof nextTick !== 'function') return;
          nextTick(() => {
            try {
              tokenInputEl.value?.focus?.();
              tokenInputEl.value?.select?.();
            } catch (_) {}
          });
        };

        const cancel = () => {
          manager?.closeTokenSettingsModal?.(null);
        };

        const save = async () => {
          const token = String(store.token || '').trim();
          if (!token) {
            store.invalid = true;
            focusInput();
            return;
          }
          store.invalid = false;
          try {
            await manager?.saveApiToken?.(token);
          } catch (_) {}
          try {
            manager?.manualRefresh?.();
          } catch (_) {}
          manager?.closeTokenSettingsModal?.(token);
        };

        const onKeydown = (e) => {
          if (!e) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        };

        onMounted(() => {
          focusInput();
        });

        if (useTemplate) {
          return { store, tokenInputEl, save, cancel, onKeydown };
        }

        return () =>
          h('div', { class: 'token-settings-container' }, [
            h('h3', { class: 'token-settings-title' }, '🔑 设置 X-Token'),
            h('p', { class: 'token-settings-description' }, '请输入 X-Token 以访问 api.effiy.cn 服务'),
            h('div', { class: 'auth-input-container' }, [
              h('input', {
                ref: tokenInputEl,
                type: 'text',
                placeholder: '请输入 X-Token',
                class: `auth-input${store.invalid ? ' invalid' : ''}`,
                value: store.token || '',
                onInput: (evt) => {
                  store.token = evt?.target?.value || '';
                  store.invalid = false;
                },
                onKeydown
              })
            ]),
            h('div', { class: 'auth-button-container' }, [
              h('button', { type: 'button', class: 'auth-save-btn', onClick: save }, '保存'),
              h('button', { type: 'button', class: 'auth-cancel-btn', onClick: cancel }, '取消')
            ])
          ]);
      },
      template: resolvedTemplate
    };

    return defineComponent(componentOptions);
  }

  window.PetManager.Components.TokenSettingsModal = {
    loadTemplate,
    createComponent
  };
})();
