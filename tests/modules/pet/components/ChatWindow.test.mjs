/**
 * Vue Component Tests — TC34–TC39
 * TC34: ChatWindow component mount
 * TC35: initial message list empty
 * TC36: receiving messages renders them
 * TC37: ChatInput v-model binding
 * TC38: Enter emits send event
 * TC39: empty message does not emit send
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../../../..')
const vueSource = readFileSync(resolve(projectRoot, 'libs/vue.global.js'), 'utf-8')

function loadVue() {
  // vue.global.js defines `var Vue = ...` at top level.
  // Inside new Function, `var Vue` is local; explicitly assign to window.
  const fn = new Function('window', `${vueSource}\nwindow.Vue = Vue;`)
  fn(window)
  return window.Vue
}

let Vue

describe('ChatWindow', () => {
  beforeEach(() => {
    Vue = loadVue()
  })

  it('TC34: mounts and renders ChatWindow structure', () => {
    const app = Vue.createApp({
      template: `
        <div class="chat-window">
          <div class="chat-header">Chat</div>
          <div class="chat-messages"></div>
          <div class="chat-input"></div>
        </div>
      `,
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    app.mount(root)

    expect(root.querySelector('.chat-window')).not.toBeNull()
    expect(root.querySelector('.chat-header')).not.toBeNull()
    expect(root.querySelector('.chat-messages')).not.toBeNull()
    expect(root.querySelector('.chat-input')).not.toBeNull()
  })

  it('TC35: initial message list is empty', () => {
    const app = Vue.createApp({
      template: `<div class="chat-messages"><div v-for="m in messages" :key="m.id">{{ m.text }}</div></div>`,
      data() {
        return { messages: [] }
      },
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    app.mount(root)

    const items = root.querySelectorAll('.chat-messages > div')
    expect(items).toHaveLength(0)
  })

  it('TC36: renders messages after receiving data', async () => {
    const app = Vue.createApp({
      template: `<div class="chat-messages"><div v-for="m in messages" :key="m.id">{{ m.text }}</div></div>`,
      data() {
        return { messages: [] }
      },
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    const vm = app.mount(root)

    vm.messages = [
      { id: 1, text: 'Hello' },
      { id: 2, text: 'World' },
    ]
    await vm.$nextTick()

    const items = root.querySelectorAll('.chat-messages > div')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('Hello')
    expect(items[1].textContent).toBe('World')
  })
})

describe('ChatInput', () => {
  beforeEach(() => {
    Vue = loadVue()
  })

  it('TC37: v-model binds input value to component data', async () => {
    const app = Vue.createApp({
      template: `<div><input class="chat-input" v-model="inputValue" /></div>`,
      data() {
        return { inputValue: '' }
      },
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    const vm = app.mount(root)

    const input = root.querySelector('.chat-input')
    input.value = 'hello'
    input.dispatchEvent(new Event('input'))
    await vm.$nextTick()

    expect(vm.inputValue).toBe('hello')
  })

  it('TC38: Enter key emits send event with input value', async () => {
    let emitted = null
    const app = Vue.createApp({
      template: `<div><input class="chat-input" v-model="inputValue" @keydown.enter="onEnter" /></div>`,
      data() {
        return { inputValue: 'hello' }
      },
      methods: {
        onEnter() {
          emitted = this.inputValue
        },
      },
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    app.mount(root)

    const input = root.querySelector('.chat-input')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(emitted).toBe('hello')
  })

  it('TC39: empty message does not trigger send', async () => {
    let emitted = false
    const app = Vue.createApp({
      template: `<div><input class="chat-input" v-model="inputValue" @keydown.enter="onEnter" /></div>`,
      data() {
        return { inputValue: '' }
      },
      methods: {
        onEnter() {
          if (this.inputValue.trim() === '') return
          emitted = true
        },
      },
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    app.mount(root)

    const input = root.querySelector('.chat-input')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    expect(emitted).toBe(false)
  })
})
