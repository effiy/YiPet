(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const SESSION_SEARCH_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/SessionSearch/index.html';
    let sessionSearchTemplatePromise = null;
    let sessionSearchTemplateCache = null;

    function resolveExtensionResourceUrl(relativePath) {
        try {
            if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) return chrome.runtime.getURL(relativePath);
        } catch (_) {}
        return relativePath;
    }

    async function loadTemplate() {
        if (sessionSearchTemplateCache) return sessionSearchTemplateCache;
        if (!sessionSearchTemplatePromise) {
            sessionSearchTemplatePromise = (async () => {
                const url = resolveExtensionResourceUrl(SESSION_SEARCH_TEMPLATES_RESOURCE_PATH);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Failed to load SessionSearch template: ${res.status}`);
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const el = doc.querySelector('#yi-pet-session-search-template');
                sessionSearchTemplateCache = el ? el.innerHTML : '';
                return sessionSearchTemplateCache;
            })();
        }
        return sessionSearchTemplatePromise;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const store = params?.store;
        const computedProps = params?.computedProps;
        const methods = params?.methods;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, computed } = Vue;
        if (typeof defineComponent !== 'function') return null;

        const fallbackTemplate = `
            <div class="session-sidebar-search-row">
                <div class="session-search-container">
                    <input id="session-search-input" class="session-search-input" type="text" placeholder="搜索会话..." :value="searchValue" @input="onSearchInput" @keydown="onSearchKeydown" @click.stop />
                    <button type="button" class="session-search-clear-btn" :class="{ visible: clearVisible }" @click.stop="clearSearch">✕</button>
                </div>
            </div>
        `;

        const resolvedTemplate = String(template || sessionSearchTemplateCache || '').trim() || fallbackTemplate;

        return defineComponent({
            name: 'YiPetSessionSearch',
            props: {
                uiTick: { type: Number, required: true }
            },
            setup(props) {
                const searchValue =
                    typeof computed === 'function'
                        ? computed(() => {
                              props.uiTick;
                              return String(store?.searchValue?.value || manager?.sessionTitleFilter || '');
                          })
                        : String(store?.searchValue?.value || manager?.sessionTitleFilter || '');

                const clearVisible =
                    typeof computed === 'function'
                        ? computed(() => {
                              props.uiTick;
                              const v = computedProps?.clearVisible;
                              if (v && typeof v === 'object' && 'value' in v) return !!v.value;
                              return !!v;
                          })
                        : computedProps?.clearVisible;

                return {
                    searchValue,
                    clearVisible,
                    clearSearch: methods?.clearSearch,
                    onSearchInput: methods?.onSearchInput,
                    onSearchKeydown: methods?.onSearchKeydown
                };
            },
            template: resolvedTemplate
        });
    }

    window.PetManager.Components.SessionSearch = {
        loadTemplate,
        createComponent
    };
})();
