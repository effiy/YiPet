(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const SESSION_SEARCH_TEMPLATES_RESOURCE_PATH =
        'src/features/petManager/content/components/sessionSidebar/SessionSearch/index.html';
    let sessionSearchTemplateCache = '';

    async function loadTemplate() {
        if (sessionSearchTemplateCache) return sessionSearchTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        sessionSearchTemplateCache = await DomHelper.loadHtmlTemplate(
            SESSION_SEARCH_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-search-template',
            'Failed to load SessionSearch template'
        );
        return sessionSearchTemplateCache;
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

        const resolvedTemplate = String(template || sessionSearchTemplateCache || '').trim();
        if (!resolvedTemplate) return null;

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
