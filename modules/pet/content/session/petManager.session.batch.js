/**
 * Session Batch Module
 * 会话批量操作模块
 */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = window.PetManager.prototype

  proto.getSelectedSessions = function () {
    if (!this.selectedSessionIds || !Array.isArray(this.selectedSessionIds)) {
      return []
    }
    return this.selectedSessionIds
      .map(id => this.sessions[id])
      .filter(Boolean)
  }

  proto.clearSessionSelection = function () {
    this.selectedSessionIds = []
    this.updateSessionUI({ updateSidebar: true })
  }

  proto.toggleSessionSelection = function (sessionId) {
    if (!this.selectedSessionIds || !Array.isArray(this.selectedSessionIds)) {
      this.selectedSessionIds = []
    }
    const index = this.selectedSessionIds.indexOf(sessionId)
    if (index === -1) {
      this.selectedSessionIds.push(sessionId)
    } else {
      this.selectedSessionIds.splice(index, 1)
    }
    this.updateSessionUI({ updateSidebar: true })
  }

  proto.batchDeleteSessions = async function (sessionIds) {
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return
    }

    const confirmDelete = confirm(`确定要删除选中的 ${sessionIds.length} 个会话吗？`)
    if (!confirmDelete) return

    let deletedCount = 0
    for (const sessionId of sessionIds) {
      try {
        await this.deleteSession(sessionId, true)
        deletedCount++
      } catch (error) {
        console.warn('删除会话失败:', sessionId, error)
      }
    }

    this.clearSessionSelection()
    this.showNotification(`已删除 ${deletedCount} 个会话`, 'success')
  }

  proto.batchSetFavorite = async function (sessionIds, isFavorite) {
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return
    }

    for (const sessionId of sessionIds) {
      try {
        const session = this.sessions[sessionId]
        if (session) {
          session.isFavorite = isFavorite
          session.updatedAt = Date.now()
          if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
            await this.syncSessionToBackend(sessionId, true)
          }
        }
      } catch (error) {
        console.warn('更新会话收藏状态失败:', sessionId, error)
      }
    }

    this.updateSessionUI({ updateSidebar: true })
    const action = isFavorite ? '收藏' : '取消收藏'
    this.showNotification(`已${action} ${sessionIds.length} 个会话`, 'success')
  }

  proto.batchAddTag = async function (sessionIds, tag) {
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0 || !tag || !tag.trim()) {
      return
    }

    const cleanTag = tag.trim()
    for (const sessionId of sessionIds) {
      try {
        const session = this.sessions[sessionId]
        if (session) {
          if (!session.tags) {
            session.tags = []
          }
          if (!session.tags.includes(cleanTag)) {
            session.tags.push(cleanTag)
            session.updatedAt = Date.now()
            if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
              await this.syncSessionToBackend(sessionId, true)
            }
          }
        }
      } catch (error) {
        console.warn('添加标签失败:', sessionId, error)
      }
    }

    this.updateSessionUI({ updateSidebar: true })
    this.showNotification(`已为 ${sessionIds.length} 个会话添加标签 "${cleanTag}"`, 'success')
  }

  proto.batchRemoveTag = async function (sessionIds, tag) {
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0 || !tag || !tag.trim()) {
      return
    }

    const cleanTag = tag.trim()
    for (const sessionId of sessionIds) {
      try {
        const session = this.sessions[sessionId]
        if (session && session.tags && Array.isArray(session.tags)) {
          const index = session.tags.indexOf(cleanTag)
          if (index !== -1) {
            session.tags.splice(index, 1)
            session.updatedAt = Date.now()
            if (this.isChatOpen && this.sessionApi && PET_CONFIG.api.syncSessionsToBackend) {
              await this.syncSessionToBackend(sessionId, true)
            }
          }
        }
      } catch (error) {
        console.warn('移除标签失败:', sessionId, error)
      }
    }

    this.updateSessionUI({ updateSidebar: true })
    this.showNotification(`已从 ${sessionIds.length} 个会话移除标签 "${cleanTag}"`, 'success')
  }

  console.log('[PetManager] Session Batch module loaded')
})()
