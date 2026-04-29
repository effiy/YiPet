/**
 * Session Tag Module
 * 会话标签管理模块
 */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = window.PetManager.prototype

  proto.loadTagOrder = async function () {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        this.tagOrder = null
        return
      }
      const value = await new Promise((resolve) => {
        chrome.storage.local.get(['pet_session_tag_order'], (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(null)
            return
          }
          resolve(result ? result.pet_session_tag_order : null)
        })
      })
      this.tagOrder = Array.isArray(value) ? value : null
    } catch (error) {
      console.warn('加载标签顺序失败:', error)
      this.tagOrder = null
    }
  }

  proto.saveTagOrder = function (tagOrder) {
    try {
      this.tagOrder = tagOrder
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return
      }
      chrome.storage.local.set({ pet_session_tag_order: tagOrder }, () => {})
    } catch (error) {
      console.warn('保存标签顺序失败:', error)
    }
  }

  proto.getAllTags = function () {
    const allSessions = this._getSessionsFromLocal ? this._getSessionsFromLocal() : Object.values(this.sessions || {})

    const tagSet = new Set()
    allSessions.forEach(session => {
      if (session.tags && Array.isArray(session.tags)) {
        session.tags.forEach(tag => {
          if (tag && tag.trim()) {
            tagSet.add(tag.trim())
          }
        })
      }
    })

    const allTags = Array.from(tagSet)

    if (this.tagOrder && Array.isArray(this.tagOrder)) {
      const orderedTags = []
      const unorderedTags = []

      this.tagOrder.forEach(tag => {
        if (allTags.includes(tag)) {
          orderedTags.push(tag)
        }
      })

      allTags.forEach(tag => {
        if (!this.tagOrder.includes(tag)) {
          unorderedTags.push(tag)
        }
      })
      unorderedTags.sort()

      return [...orderedTags, ...unorderedTags]
    }

    const priorityTags = ['chat', '文档', '工具', '工作', '家庭', '娱乐', '日记']
    const priorityTagSet = new Set(priorityTags)
    const priorityTagList = []
    const otherTags = []

    priorityTags.forEach(tag => {
      if (allTags.includes(tag)) {
        priorityTagList.push(tag)
      }
    })

    allTags.forEach(tag => {
      if (!priorityTagSet.has(tag)) {
        otherTags.push(tag)
      }
    })
    otherTags.sort()

    return [...priorityTagList, ...otherTags]
  }

  console.log('[PetManager] Session Tag module loaded')
})()
