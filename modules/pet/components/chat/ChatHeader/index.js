(function () {
  'use strict'

  if (!window.PetManager) window.PetManager = {}
  if (!window.PetManager.Components) window.PetManager.Components = {}

  const CHAT_HEADER_TEMPLATES_RESOURCE_PATH = 'modules/pet/components/chat/ChatHeader/index.html'
  let chatHeaderTemplateCache = ''

  function stopEvent (e) {
    e?.stopPropagation?.()
    e?.preventDefault?.()
  }

  async function loadTemplate () {
    if (chatHeaderTemplateCache) return chatHeaderTemplateCache
    const DomHelper = window.DomHelper
    if (!DomHelper || typeof DomHelper.loadHtmlTemplate !== 'function') return ''
    chatHeaderTemplateCache = await DomHelper.loadHtmlTemplate(
      CHAT_HEADER_TEMPLATES_RESOURCE_PATH,
      '#yi-pet-chat-header-template',
      'Failed to load ChatHeader template'
    )
    return chatHeaderTemplateCache
  }

  function createComponent (params) {
    const manager = params?.manager
    const template = params?.template
    const Vue = window.Vue || {}
    const { defineComponent } = Vue
    if (typeof defineComponent !== 'function') return null

    const resolvedTemplate = String(template || chatHeaderTemplateCache || '').trim()
    if (!resolvedTemplate) return null

    return defineComponent({
      name: 'YiPetChatHeader',
      props: {
        uiTick: { type: Number, required: true }
      },
      setup () {
        const onAuthClick = (e) => {
          stopEvent(e)
          if (typeof manager?.openAuth === 'function') manager.openAuth()
        }

        const onCloseClick = (e) => {
          stopEvent(e)
          if (typeof manager?.closeChatWindow === 'function') {
            manager.closeChatWindow()
            return
          }
          if (typeof manager?.toggleChatWindowVisibility === 'function') {
            manager.toggleChatWindowVisibility()
            return
          }
          const chatWindowElement = document.getElementById('pet-chat-window')
          if (chatWindowElement) {
            chatWindowElement.classList.add('js-hidden')
            chatWindowElement.setAttribute('hidden', '')
          }
        }

        return { onAuthClick, onCloseClick }
      },
      template: resolvedTemplate
    })
  }

  window.PetManager.Components.ChatHeader = {
    loadTemplate,
    createComponent
  }
})()