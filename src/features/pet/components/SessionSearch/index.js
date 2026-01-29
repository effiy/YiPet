(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const SESSION_SEARCH_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/SessionSearch/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            SESSION_SEARCH_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-session-search-template',
            'Failed to load SessionSearch template'
        );
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

        const resolvedTemplate = String(template || '').trim() || fallbackTemplate;

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

    /**
     * 创建 fallback 模式下的 session-search DOM（无 Vue 时使用，如 ChatWindow.createSidebar）
     * 事件由 ChatWindow._bindSidebarDomEvents 在侧栏上统一绑定。
     * @param {Object} manager - PetManager 实例
     * @returns {HTMLElement} session-sidebar-search-row 根元素
     */
    function createSearchElement(manager) {
        const firstRow = document.createElement('div');
        firstRow.className = 'session-sidebar-search-row';

        const searchContainer = document.createElement('div');
        searchContainer.className = 'session-search-container';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '搜索会话...';
        searchInput.value = manager?.sessionTitleFilter || '';
        searchInput.id = 'session-search-input';
        searchInput.className = 'session-search-input';

        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '✕';
        clearBtn.type = 'button';
        clearBtn.className = 'session-search-clear-btn';

        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(clearBtn);
        firstRow.appendChild(searchContainer);

        return firstRow;
    }

    window.PetManager.Components.SessionSearch = {
        loadTemplate,
        createComponent,
        createSearchElement
    };
})();
