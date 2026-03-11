(function () {
  'use strict'

  if (!window.PetManager) return
  if (!window.PetManager.Components) window.PetManager.Components = {}

  const TEMPLATE_RESOURCE_PATH = 'cdn/components/modal/AiSettingsModal/index.html'
  let templateCache = ''

  function canUseVueTemplate (Vue) {
    if (typeof Vue?.compile !== 'function') return false
    try {
      Function('return 1')()
      return true
    } catch (_) {
      return false
    }
  }

  async function loadTemplate () {
    if (templateCache) return templateCache
    const DomHelper = window.DomHelper
    if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return ''
    templateCache = await DomHelper.loadHtmlTemplate(
      TEMPLATE_RESOURCE_PATH,
      '#yi-pet-ai-settings-modal-template',
      'Failed to load AiSettingsModal template'
    )
    return templateCache
  }

  function createComponent (params) {
    const manager = params?.manager
    const store = params?.store
    const template = params?.template
    const Vue = window.Vue || {}
    const { defineComponent, h } = Vue
    if (typeof defineComponent !== 'function' || !store) return null

    const useTemplate = canUseVueTemplate(Vue)
    const resolvedTemplate = useTemplate ? String(template || templateCache || '').trim() : ''
    if (useTemplate && !resolvedTemplate) return null
    if (!useTemplate && typeof h !== 'function') return null

    const componentOptions = {
      name: 'YiPetAiSettingsModal',
      setup () {
        const openToken = () => {
          try {
            manager?.openAuth?.()
          } catch (_) {}
        }

        const cancel = () => {
          manager?.closeAiSettingsModal?.()
        }

        const save = () => {
          const selected = String(store.selectedModel || '').trim()
          manager.currentModel = selected
          try {
            manager?.saveState?.()
          } catch (_) {}
          manager?.closeAiSettingsModal?.()
          try {
            manager?.showNotification?.('模型已更新', 'success')
          } catch (_) {}
        }

        if (useTemplate) return { store, openToken, cancel, save }

        return () =>
          h('div', { onClick: (e) => e?.stopPropagation?.() }, [
            h('div', { class: 'pet-ai-settings-title' }, '⚙️ AI 设置'),
            h('div', { class: 'pet-ai-settings-row' }, [
              h('label', { class: 'pet-ai-settings-label' }, '模型'),
              h(
                'input',
                {
                  type: 'text',
                  class: 'pet-ai-settings-input',
                  value: store.selectedModel || '',
                  placeholder: '请输入模型名称',
                  onInput: (evt) => {
                    store.selectedModel = evt?.target?.value || ''
                  }
                }
              )
            ]),
            h('div', { class: 'pet-ai-settings-buttons' }, [
              h('button', { type: 'button', class: 'pet-ai-settings-token-btn', onClick: openToken }, '设置 Token'),
              h('button', { type: 'button', class: 'pet-ai-settings-cancel-btn', onClick: cancel }, '取消'),
              h('button', { type: 'button', class: 'pet-ai-settings-save-btn', onClick: save }, '保存')
            ])
          ])
      },
      template: resolvedTemplate
    }

    return defineComponent(componentOptions)
  }

  window.PetManager.Components.AiSettingsModal = {
    loadTemplate,
    createComponent
  }
})()
