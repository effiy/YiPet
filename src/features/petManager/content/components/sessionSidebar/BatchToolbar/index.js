(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const BATCH_TOOLBAR_TEMPLATES_RESOURCE_PATH =
        'src/features/petManager/content/components/sessionSidebar/BatchToolbar/index.html';
    let batchToolbarTemplateCache = '';

    async function loadTemplate() {
        if (batchToolbarTemplateCache) return batchToolbarTemplateCache;
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        batchToolbarTemplateCache = await DomHelper.loadHtmlTemplate(
            BATCH_TOOLBAR_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-batch-toolbar-template',
            'Failed to load BatchToolbar template'
        );
        return batchToolbarTemplateCache;
    }

    function createComponent(params) {
        const manager = params?.manager;
        const bumpUiTick = typeof params?.bumpUiTick === 'function' ? params.bumpUiTick : null;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, computed, ref } = Vue;
        if (typeof defineComponent !== 'function' || typeof computed !== 'function' || typeof ref !== 'function') return null;

        const resolvedTemplate = String(template || batchToolbarTemplateCache || '').trim();
        if (!resolvedTemplate) return null;

        return defineComponent({
            name: 'YiPetBatchToolbar',
            props: {
                uiTick: { type: Number, required: true }
            },
            setup(props) {
                const isDeleting = ref(false);

                const selectedCount = computed(() => {
                    props.uiTick;
                    return manager?.selectedSessionIds?.size ? manager.selectedSessionIds.size : 0;
                });

                const allSelected = computed(() => {
                    props.uiTick;
                    const filteredSessions = typeof manager?._getFilteredSessions === 'function' ? manager._getFilteredSessions() : [];
                    const list = Array.isArray(filteredSessions) ? filteredSessions : [];
                    if (!list.length) return false;
                    return list.every((session) => session?.key && manager?.selectedSessionIds?.has?.(session.key));
                });

                const onSelectAllChange = () => {
                    if (typeof manager?.toggleSelectAll === 'function') manager.toggleSelectAll();
                    if (bumpUiTick) bumpUiTick();
                };

                const onDeleteClick = async () => {
                    if (selectedCount.value === 0) return;
                    if (typeof manager?.batchDeleteSessions !== 'function') return;
                    if (isDeleting.value) return;
                    isDeleting.value = true;
                    try {
                        await manager.batchDeleteSessions();
                    } finally {
                        isDeleting.value = false;
                        if (bumpUiTick) bumpUiTick();
                    }
                };

                const onCancelClick = () => {
                    if (typeof manager?.exitBatchMode === 'function') manager.exitBatchMode();
                    if (bumpUiTick) bumpUiTick();
                };

                return {
                    isDeleting,
                    selectedCount,
                    allSelected,
                    onSelectAllChange,
                    onDeleteClick,
                    onCancelClick
                };
            },
            template: resolvedTemplate
        });
    }

    window.PetManager.Components.BatchToolbar = {
        loadTemplate,
        createComponent
    };
})();
