/**
 * Session Filter Module
 * 会话过滤和搜索模块
 */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = window.PetManager.prototype
  const normalizeNameSpaces = (value) => String(value ?? '').trim().replace(/\s+/g, '_')

  proto._getSessionsFromLocal = function () {
    if (!this.sessions) {
      this.sessions = {}
      return []
    }

    const sessionMap = new Map()
    for (const session of Object.values(this.sessions)) {
      if (!session.key) {
        session.key = this._generateUUID ? this._generateUUID() : Math.random().toString(36)
      }
      const uniqueKey = session.key
      if (!session || !uniqueKey) {
        continue
      }

      const sessionKey = String(uniqueKey)
      const existingSession = sessionMap.get(sessionKey)

      if (!existingSession) {
        sessionMap.set(sessionKey, session)
      } else {
        const existingUpdatedAt = existingSession.updatedAt || existingSession.createdAt || 0
        const currentUpdatedAt = session.updatedAt || session.createdAt || 0

        if (currentUpdatedAt > existingUpdatedAt) {
          sessionMap.set(sessionKey, session)
        }
      }
    }

    return Array.from(sessionMap.values())
  }

  proto._getFilteredSessions = function () {
    const allSessions = this._getSessionsFromLocal()

    const favoriteSessions = []
    const nonFavoriteSessions = []

    for (const session of allSessions) {
      if (session.isFavorite) {
        favoriteSessions.push(session)
      } else {
        nonFavoriteSessions.push(session)
      }
    }

    let filteredNonFavorite = nonFavoriteSessions

    const q = (this.sessionTitleFilter || '').trim().toLowerCase()
    if (q) {
      filteredNonFavorite = filteredNonFavorite.filter(session => {
        const title = session.title || ''
        const preview = session.preview || session.pageDescription || ''
        const url = session.url || ''
        const tags = Array.isArray(session.tags) ? session.tags.join(' ') : ''
        const hay = `${title} ${preview} ${url} ${tags}`.toLowerCase()
        return hay.includes(q)
      })
    }

    if (this.tagFilterNoTags || (this.selectedFilterTags && this.selectedFilterTags.length > 0)) {
      filteredNonFavorite = filteredNonFavorite.filter(session => {
        const sessionTags = Array.isArray(session.tags) ? session.tags.map((t) => String(t).trim()) : []
        const hasNoTags = sessionTags.length === 0 || !sessionTags.some((t) => t)
        const hasSelectedTags = this.selectedFilterTags && this.selectedFilterTags.length > 0 &&
                              this.selectedFilterTags.some((selectedTag) => sessionTags.includes(selectedTag))

        if (this.tagFilterReverse && this.selectedFilterTags && this.selectedFilterTags.length > 0) {
          if (hasSelectedTags) return false
          if (this.tagFilterNoTags && hasNoTags) return true
          return true
        } else {
          if (this.tagFilterNoTags && hasNoTags) return true
          if (this.selectedFilterTags && this.selectedFilterTags.length > 0 && hasSelectedTags) return true
          return false
        }
      })
    }

    const getTimestamp = (dateValue) => {
      if (!dateValue) return null
      if (typeof dateValue === 'number' && dateValue > 0) return dateValue
      if (typeof dateValue === 'string') {
        const d = new Date(dateValue)
        if (!isNaN(d.getTime())) return d.getTime()
      }
      if (dateValue instanceof Date) return dateValue.getTime()
      return null
    }

    const filterByDateRange = (sessions) => {
      if (!this.dateRangeFilter) return sessions

      if (this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
        const startDate = this.dateRangeFilter.startDate
        const endDate = this.dateRangeFilter.endDate
        const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
        const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() + 24 * 60 * 60 * 1000 - 1

        return sessions.filter(session => {
          const sessionTime = getTimestamp(session.updatedAt || session.lastAccessTime || session.lastActiveAt || session.createdAt)
          if (!sessionTime || sessionTime <= 0) return false
          return sessionTime >= startTime && sessionTime <= endTime
        })
      } else if (this.dateRangeFilter.startDate && !this.dateRangeFilter.endDate) {
        const startDate = this.dateRangeFilter.startDate
        const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
        const endTime = startTime + 24 * 60 * 60 * 1000 - 1

        return sessions.filter(session => {
          const sessionTime = getTimestamp(session.updatedAt || session.lastAccessTime || session.lastActiveAt || session.createdAt)
          if (!sessionTime || sessionTime <= 0) return false
          return sessionTime >= startTime && sessionTime <= endTime
        })
      } else if (!this.dateRangeFilter.startDate && this.dateRangeFilter.endDate) {
        const endDate = this.dateRangeFilter.endDate
        const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()

        return sessions.filter(session => {
          const sessionTime = getTimestamp(session.updatedAt || session.lastAccessTime || session.lastActiveAt || session.createdAt)
          if (!sessionTime || sessionTime <= 0) return false
          return sessionTime < endTime
        })
      }

      return sessions
    }

    const filteredFavorites = filterByDateRange(favoriteSessions)
    filteredNonFavorite = filterByDateRange(filteredNonFavorite)

    return [...filteredFavorites, ...filteredNonFavorite]
  }

  proto._getSessionDisplayTitle = function (session) {
    if (!session) return '未命名会话'

    let sessionTitle = session.title || '未命名会话'

    if (session._isBlankSession ||
        (session.url && (session.url.startsWith('blank-session://') || session.url.startsWith('aicr-session://')))) {
      if (!session.title || session.title === '新会话' || session.title === '未命名会话' || session.title === '新会话.md') {
        if (session.messages && session.messages.length > 0) {
          const firstUserMessage = session.messages.find(m => m.type === 'user')
          if (firstUserMessage && firstUserMessage.content) {
            const content = firstUserMessage.content.trim()
            const preview = content.length > 30 ? content.substring(0, 30) + '...' : content
            sessionTitle = preview
          } else {
            const createDate = new Date(session.createdAt || Date.now())
            sessionTitle = `新会话 ${createDate.toLocaleString()}`
          }
        } else {
          const createDate = new Date(session.createdAt || Date.now())
          sessionTitle = `新会话 ${createDate.toLocaleString()}`
        }
      }
    }

    return sessionTitle
  }

  console.log('[PetManager] Session Filter module loaded')
})()
