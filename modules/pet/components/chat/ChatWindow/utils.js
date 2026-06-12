/**
 * ChatWindow Shared Utilities
 * Common helper functions used across chat components.
 */
;(function () {
  'use strict'

  if (!window.PetManager) window.PetManager = {}
  const utils = {}

  utils.safeCall = function (fn, fallbackValue) {
    try {
      return fn()
    } catch (_) {
      return arguments.length > 1 ? fallbackValue : null
    }
  }

  utils.safeCallAsync = async function (fn, fallbackValue) {
    try {
      return await fn()
    } catch (_) {
      return arguments.length > 1 ? fallbackValue : null
    }
  }

  utils.getVueApi = function (Vue) {
    if (
      !Vue ||
      typeof Vue.createApp !== 'function' ||
      typeof Vue.defineComponent !== 'function' ||
      typeof Vue.ref !== 'function' ||
      typeof Vue.onMounted !== 'function'
    ) {
      return null
    }
    return {
      createApp: Vue.createApp,
      defineComponent: Vue.defineComponent,
      ref: Vue.ref,
      onMounted: Vue.onMounted,
    }
  }

  utils.canUseVueTemplate = function (Vue) {
    if (typeof Vue?.compile !== 'function') return false
    return utils.safeCall(function () {
      Function('return 1')()
      return true
    }, false)
  }

  utils.getComponentModule = function (name) {
    return window.PetManager?.Components?.[name] || null
  }

  utils.loadTemplateIfAvailable = async function (mod) {
    if (!mod || typeof mod.loadTemplate !== 'function') return ''
    return String(
      (await utils.safeCallAsync(function () {
        return mod.loadTemplate()
      }, '')) || '',
    )
  }

  utils.toRgbFromHex = function (hex) {
    const normalized = String(hex || '').trim()
    const match = normalized.match(/^#([0-9a-fA-F]{6})$/)
    if (!match) return null
    const value = match[1]
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    if (
      ![r, g, b].every(function (n) {
        return Number.isFinite(n)
      })
    ) {
      return null
    }
    return { r, g, b }
  }

  utils.clampInt = function (n, min, max) {
    const x = Math.round(Number(n))
    if (!Number.isFinite(x)) return min
    return Math.min(Math.max(x, min), max)
  }

  utils.shadeHexColor = function (hex, ratio) {
    const rgb = utils.toRgbFromHex(hex)
    if (!rgb) return null
    const t = ratio < 0 ? 0 : 255
    const p = Math.abs(Number(ratio))
    if (!Number.isFinite(p)) return null
    const r = utils.clampInt((t - rgb.r) * p + rgb.r, 0, 255)
    const g = utils.clampInt((t - rgb.g) * p + rgb.g, 0, 255)
    const b = utils.clampInt((t - rgb.b) * p + rgb.b, 0, 255)
    return `#${[r, g, b]
      .map(function (c) {
        return c.toString(16).padStart(2, '0')
      })
      .join('')}`
  }

  window.PetManager.Components.ChatWindowUtils = utils
})()
