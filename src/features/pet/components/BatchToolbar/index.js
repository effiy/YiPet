(function () {
    'use strict';

    if (!window.PetManager) window.PetManager = {};
    if (!window.PetManager.Components) window.PetManager.Components = {};

    const BATCH_TOOLBAR_TEMPLATES_RESOURCE_PATH = 'src/features/pet/components/BatchToolbar/index.html';

    async function loadTemplate() {
        const DomHelper = window.DomHelper;
        if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return '';
        return await DomHelper.loadHtmlTemplate(
            BATCH_TOOLBAR_TEMPLATES_RESOURCE_PATH,
            '#yi-pet-batch-toolbar-template',
            'Failed to load BatchToolbar template'
        );
    }

    function createComponent(params) {
        const manager = params?.manager;
        const bumpUiTick = typeof params?.bumpUiTick === 'function' ? params.bumpUiTick : null;
        const template = params?.template;
        const Vue = window.Vue || {};
        const { defineComponent, computed, ref } = Vue;
        if (typeof defineComponent !== 'function' || typeof computed !== 'function' || typeof ref !== 'function') return null;

        const fallbackTemplate = `
            <div id="batch-toolbar" class="session-batch-toolbar" data-pet-batch-toolbar="vue">
            <div class="session-batch-toolbar-inner">
                <div class="batch-toolbar-left">
                    <label class="batch-select-all">
                        <input type="checkbox" id="select-all-checkbox" :checked="allSelected" @change.stop="onSelectAllChange" />
                        <span>全选</span>
                    </label>
                    <span id="selected-count" class="batch-selected-count" :class="{ 'js-hidden': selectedCount === 0 }">
                        {{ selectedCount === 0 ? '' : \`已选 \${selectedCount} 项\` }}
                    </span>
                </div>
                <div class="batch-toolbar-right">
                    <button
                        type="button"
                        id="batch-delete-btn"
                        class="batch-action-btn batch-delete-btn"
                        :disabled="selectedCount === 0 || isDeleting"
                        title="删除选中会话"
                        @click.stop="onDeleteClick"
                    ><i :class="isDeleting ? 'fas fa-spinner fa-spin' : 'fas fa-trash-alt'"></i>{{ isDeleting ? ' 删除中...' : ' 删除' }}</button>
                    <button
                        type="button"
                        class="batch-action-btn batch-cancel-btn"
                        title="退出批量模式"
                        @click.stop="onCancelClick"
                    >取消</button>
                </div>
            </div>
            </div>
        `;

        const resolvedTemplate = String(template || '').trim() || fallbackTemplate;

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
