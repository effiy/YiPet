(function registerBackgroundApp () {
  const root = typeof self !== 'undefined' ? self : globalThis

  const getInjectionService = () => (root && root.InjectionService ? root.InjectionService : null)

  const initLoggerMute = () => {
    try {
      const LoggerUtils = root && root.LoggerUtils ? root.LoggerUtils : (typeof LoggerUtils !== 'undefined' ? LoggerUtils : null)
      if (!LoggerUtils || typeof LoggerUtils.initMuteLogger !== 'function') return

      const keyName =
                root?.PET_CONFIG?.constants?.storageKeys?.devMode
                  ? root.PET_CONFIG.constants.storageKeys.devMode
                  : 'petDevMode'
      LoggerUtils.initMuteLogger(keyName, false)
    } catch (_) {}
  }

  initLoggerMute()

  chrome.runtime.onInstalled.addListener((details) => {
    chrome.storage.local.set({
      petSettings: {
        size: 260,
        color: 0,
        visible: false,
        autoStart: true
      }
    })

    chrome.storage.local.set({
      petGlobalState: {
        visible: false,
        color: 0,
        size: 260,
        timestamp: Date.now()
      }
    })

    if (details.reason === 'update') {
      // console.log('扩展已更新到版本:', chrome.runtime.getManifest().version);
    }
  })

  const initializeMessageRouter = () => {
    const router = new MessageRouter()

    router.register('getExtensionInfo', (request, sender, sendResponse) => {
      ExtensionHandler.handleGetExtensionInfo(sendResponse)
    })

    router.register('openOptionsPage', (request, sender, sendResponse) => {
      ExtensionHandler.handleOpenOptionsPage(sendResponse)
    })

    router.register(
      'getActiveTab',
      (request, sender, sendResponse) => {
        ExtensionHandler.handleGetActiveTab(sendResponse)
      },
      true
    )

    router.register('injectPet', (request, sender, sendResponse) => {
      PetHandler.handleInjectPet(request, sender, sendResponse)
    })

    router.register('removePet', (request, sender, sendResponse) => {
      PetHandler.handleRemovePet(request, sender, sendResponse)
    })


    router.register(
      'forwardToContentScript',
      (request, sender, sendResponse) => {
        MessageForwardHandler.handleForwardToContentScript(request, sendResponse)
      },
      true
    )

    router.register(
      'sendToWeWorkRobot',
      (request, sender, sendResponse) => {
        WeWorkHandler.handleSendToWeWorkRobot(request, sendResponse)
      },
      true
    )

    router.register(
      'openLinkInNewTab',
      (request, sender, sendResponse) => {
        TabHandler.handleOpenLinkInNewTab(request, sendResponse)
      },
      true
    )

    return router
  }

  const messageRouter = initializeMessageRouter()

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    return messageRouter.handle(request, sender, sendResponse)
  })

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const isSystemPage =
            tab?.url &&
            root?.PET_CONFIG?.constants?.URLS?.isSystemPage &&
            root.PET_CONFIG.constants.URLS.isSystemPage(tab.url)

    if (changeInfo.status !== 'complete' || !tab?.url || isSystemPage) {
      return
    }

    chrome.storage.local.get(['petSettings'], (result) => {
      const settings = result.petSettings || { autoStart: true, visible: false }

      if (!settings.autoStart || settings.visible === false) {
        return
      }

      const delayMs = root?.PET_CONFIG?.constants?.TIMING?.INJECT_PET_DELAY ?? 1000
      setTimeout(() => {
        const injectionService = getInjectionService()
        if (!injectionService) {
          return
        }
        injectionService.injectPetToTab(tabId)
      }, delayMs)
    })
  })

  chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleVisibility' })
  })

  const notifyAllTabs = (action, data) => {
    const injectionService = getInjectionService()
    if (injectionService) {
      injectionService.executeActionInAllTabs(action, data)
    }
  }

  const handleStorageChange = (changes, namespace) => {
    if (namespace !== 'local') return

    if (changes.petSettings) {
      notifyAllTabs('settingsUpdated', changes.petSettings.newValue)
    }

    if (changes.petGlobalState) {
      notifyAllTabs('globalStateUpdated', changes.petGlobalState.newValue)

      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          const isSystemPage =
                        tab?.url &&
                        root?.PET_CONFIG?.constants?.URLS?.isSystemPage &&
                        root.PET_CONFIG.constants.URLS.isSystemPage(tab.url)
          if (isSystemPage) return

          chrome.tabs.sendMessage(
            tab.id,
            { action: 'globalStateUpdated', data: changes.petGlobalState.newValue },
            () => {
              if (chrome.runtime.lastError) {
                console.log('同步状态到标签页失败:', tab.id, chrome.runtime.lastError.message)
              }
            }
          )
        })
      })
    }
  }

  chrome.storage.onChanged.addListener(handleStorageChange)

  const sendMessageToActiveTab = (message) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message)
      }
    })
  }

  const KEYBOARD_COMMANDS = {
    'toggle-pet': { action: 'toggleVisibility' },
    'open-chat': { action: 'toggleChatWindow' }
  }

  try {
    if (chrome && chrome.commands && typeof chrome.commands.onCommand === 'object' && chrome.commands.onCommand.addListener) {
      chrome.commands.onCommand.addListener((command) => {
        const commandConfig = KEYBOARD_COMMANDS[command]
        if (!commandConfig) {
          return
        }
        sendMessageToActiveTab(commandConfig)
      })
    }
  } catch (error) {
    // Ignore errors
  }

  const cleanupAgeMs = root?.PET_CONFIG?.constants?.TIMING?.STORAGE_CLEANUP_AGE ?? 604800000
  const cleanupIntervalMs = root?.PET_CONFIG?.constants?.TIMING?.STORAGE_CLEANUP_INTERVAL ?? 86400000
  setInterval(() => {
    chrome.storage.local.get(null, (items) => {
      const now = Date.now()
      const cutoff = now - cleanupAgeMs

      Object.keys(items).forEach((key) => {
        if (key.startsWith('petPosition_') && items[key].timestamp < cutoff) {
          chrome.storage.local.remove(key)
        }
      })
    })
  }, cleanupIntervalMs)
})()
