/**
 * PetManager - 截图/权限相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
    return
  }

  const proto = window.PetManager.prototype

  // 截图功能（支持区域选择）
  proto.takeScreenshot = async function () {
    try {
      console.log('开始截图...')

      // 检查Chrome API可用性
      if (!this.checkChromeAPIAvailability()) {
        const apiError = (PET_CONFIG && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES)
          ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED
          : 'Chrome API不可用'
        this.showScreenshotNotification(apiError, 'error')
        return
      }

      // 添加详细的权限诊断
      await this.diagnosePermissions()

      // 检查权限
      const hasPermission = await this.checkScreenshotPermission()
      if (!hasPermission) {
        this.showScreenshotNotification('权限不足，请重新加载扩展或手动授予权限', 'error')
        this.showPermissionHelp()
        return
      }

      // 检查当前页面是否允许截图
      if (this.isSystemPage()) {
        this.showScreenshotNotification('无法截取系统页面，请在其他网页中使用截图功能', 'error')
        return
      }

      // 隐藏聊天窗口以获取更清晰的截图
      const originalChatHidden = this.chatWindow
        ? (this.chatWindow.classList.contains('tw-hidden') || getComputedStyle(this.chatWindow).display === 'none')
        : false
      if (this.chatWindow) {
        this.chatWindow.classList.add('tw-hidden')
      }

      // 隐藏宠物（如果显示的话）
      const originalPetHidden = this.pet
        ? (this.pet.classList.contains('tw-hidden') || getComputedStyle(this.pet).display === 'none')
        : false
      if (this.pet) {
        this.pet.classList.add('tw-hidden')
      }

      // 等待一小段时间确保窗口完全隐藏
      await new Promise(resolve => setTimeout(resolve, 200))

      // 尝试使用Chrome的captureVisibleTab API截图
      let dataUrl = await this.captureVisibleTab()

      // 如果主要方法失败，尝试备用方法
      if (!dataUrl) {
        console.log('主要截图方法失败，尝试备用方法...')
        this.showScreenshotNotification('主要方法失败，尝试备用方法...', 'info')
        dataUrl = await this.fallbackScreenshot()
      }

      if (dataUrl) {
        // 保持聊天窗口和宠物隐藏，直到区域选择完成
        this.showAreaSelector(dataUrl, originalChatHidden, originalPetHidden)
      } else {
        // 如果截图失败，恢复显示
        this.restoreElements(originalChatHidden, originalPetHidden)
        this.showScreenshotNotification('截图失败，请检查权限设置或尝试刷新页面', 'error')
        this.showPermissionHelp()
      }
    } catch (error) {
      console.error('截图失败:', error)
      this.showScreenshotNotification('截图失败，请重试', 'error')

      // 确保聊天窗口和宠物恢复显示
      this.restoreElements(false, false)
    }
  }

  // 显示区域选择器
  proto.showAreaSelector = function (dataUrl, originalChatHidden = false, originalPetHidden = false) {
    // 创建区域选择器覆盖层
    const overlay = document.createElement('div')
    overlay.id = 'area-selector-overlay'
    // 样式已通过 CSS 类定义

    // 先加载图片以获取真实尺寸
    const img = new Image()
    img.src = dataUrl

    // 创建截图背景容器
    const screenshotBg = document.createElement('div')
    screenshotBg.className = 'screenshot-bg'

    // 创建实际图片元素
    const screenshotImg = document.createElement('img')
    screenshotImg.src = dataUrl

    screenshotBg.appendChild(screenshotImg)

    // 创建选择框
    const selectionBox = document.createElement('div')
    selectionBox.id = 'selection-box'
    // 样式已通过 CSS 类定义

    // 创建工具提示
    const tipText = document.createElement('div')
    tipText.id = 'selection-tip'
    tipText.textContent = '拖动鼠标选择截图区域，双击确认'
    // 样式已通过 CSS 类定义

    overlay.appendChild(screenshotBg)
    overlay.appendChild(selectionBox)
    overlay.appendChild(tipText)

    // 等待图片加载完成后再添加到页面并设置事件监听
    img.onload = () => {
      document.body.appendChild(overlay)
      setupEventListeners()
    }

    // 如果图片已经加载完成
    if (img.complete && img.naturalHeight !== 0) {
      document.body.appendChild(overlay)
      setupEventListeners()
    }

    let isSelecting = false
    let startX = 0
    let startY = 0

    // 设置事件监听器的函数
    const setupEventListeners = () => {
      // 鼠标按下事件
      overlay.addEventListener('mousedown', (e) => {
        isSelecting = true
        startX = e.clientX
        startY = e.clientY

        selectionBox.style.left = startX + 'px'
        selectionBox.style.top = startY + 'px'
        selectionBox.style.width = '0px'
        selectionBox.style.height = '0px'
        selectionBox.classList.add('js-visible')

        // 隐藏提示
        tipText.classList.add('js-hidden')

        e.preventDefault()
      })

      // 鼠标移动事件
      overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return

        const currentX = e.clientX
        const currentY = e.clientY

        const left = Math.min(startX, currentX)
        const top = Math.min(startY, currentY)
        const width = Math.abs(currentX - startX)
        const height = Math.abs(currentY - startY)

        selectionBox.style.left = left + 'px'
        selectionBox.style.top = top + 'px'
        selectionBox.style.width = width + 'px'
        selectionBox.style.height = height + 'px'
      })

      // 鼠标释放或双击事件
      const finishSelection = (e) => {
        if (!isSelecting) return
        isSelecting = false

        const rect = selectionBox.getBoundingClientRect()

        // 如果区域太小，关闭选择器并恢复显示
        if (rect.width < 10 || rect.height < 10) {
          if (tipText) tipText.remove()
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay)
          }
          // 恢复聊天窗口和宠物显示
          this.restoreElements(originalChatHidden, originalPetHidden)
          return
        }

        // 计算截取区域的相对坐标（相对于原始截图尺寸）
        // 使用已经加载的图片
        const imgRect = screenshotImg.getBoundingClientRect()

        // 计算图片在页面中的实际显示尺寸和位置
        const imgDisplayWidth = imgRect.width
        const imgDisplayHeight = imgRect.height
        const imgDisplayX = imgRect.left
        const imgDisplayY = imgRect.top

        // 计算原始图片和显示图片的缩放比例
        const scaleX = img.width / imgDisplayWidth
        const scaleY = img.height / imgDisplayHeight

        // 将选择框相对于图片的位置转换为原始图片的坐标
        const relativeX = rect.left - imgDisplayX
        const relativeY = rect.top - imgDisplayY
        const relativeWidth = rect.width
        const relativeHeight = rect.height

        // 转换为原始图片坐标
        const actualX = relativeX * scaleX
        const actualY = relativeY * scaleY
        const actualWidth = relativeWidth * scaleX
        const actualHeight = relativeHeight * scaleY

        // 移除选择器
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay)
        }

        // 恢复聊天窗口和宠物显示
        this.restoreElements(originalChatHidden, originalPetHidden)

        // 裁剪图片
        this.cropAndDisplayScreenshot(dataUrl, actualX, actualY, actualWidth, actualHeight)
      }

      overlay.addEventListener('mouseup', finishSelection)
      overlay.addEventListener('dblclick', finishSelection)

      // ESC键取消
      const cancelHandler = (e) => {
        if (e.key === 'Escape') {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay)
          }
          // 恢复聊天窗口和宠物显示
          this.restoreElements(originalChatHidden, originalPetHidden)
          window.removeEventListener('keydown', cancelHandler)
        }
      }
      window.addEventListener('keydown', cancelHandler)
    }
  }

  // 恢复元素显示
  proto.restoreElements = function (chatHidden, petHidden) {
    if (this.chatWindow) {
      if (chatHidden) {
        this.chatWindow.classList.add('tw-hidden')
      } else {
        this.chatWindow.classList.remove('tw-hidden')
      }
    }
    if (this.pet) {
      if (petHidden) {
        this.pet.classList.add('tw-hidden')
      } else {
        this.pet.classList.remove('tw-hidden')
      }
    }
  }

  // 裁剪并显示截图
  proto.cropAndDisplayScreenshot = function (dataUrl, x, y, width, height) {
    const img = new Image()
    img.src = dataUrl

    img.onload = () => {
      // 创建canvas进行裁剪
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height)

      // 转换为data URL
      const croppedDataUrl = canvas.toDataURL('image/png')

      this.showScreenshotPreview(croppedDataUrl)
    }
  }

  // 权限诊断
  proto.diagnosePermissions = async function () {
    console.log('=== 权限诊断开始 ===')

    // 检查Chrome API可用性
    console.log('Chrome API可用性:', {
      chrome: typeof chrome !== 'undefined',
      runtime: typeof chrome !== 'undefined' && !!chrome.runtime,
      tabs: typeof chrome !== 'undefined' && !!chrome.tabs,
      permissions: '通过background script检查'
    })

    // 检查当前页面信息
    console.log('当前页面信息:', {
      url: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      isSystemPage: this.isSystemPage()
    })

    // 检查扩展信息
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const manifest = chrome.runtime.getManifest()
        console.log('扩展信息:', {
          name: manifest.name,
          version: manifest.version,
          permissions: manifest.permissions,
          host_permissions: manifest.host_permissions
        })
      } catch (error) {
        console.error('获取扩展信息失败:', error)
      }
    }

    // 通过background script获取权限信息
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'checkPermissions'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('获取权限信息失败:', chrome.runtime.lastError.message)
        } else if (response && response.success) {
          console.log('权限状态:', response.permissions)
        }
      })
    }

    console.log('=== 权限诊断结束 ===')
  }

  // 显示权限帮助
  proto.showPermissionHelp = function () {
    const helpModal = document.createElement('div')
    helpModal.id = 'permission-help-modal'
    helpModal.className = 'pet-permission-help-modal'

    const helpContainer = document.createElement('div')
    helpContainer.className = 'pet-permission-help-container'

    helpContainer.innerHTML = `
            <h3 class="pet-permission-help-title">
                🔧 权限问题解决方案
            </h3>

            <div class="pet-permission-help-section">
                <h4 class="pet-permission-help-subtitle is-danger">📋 解决步骤：</h4>
                <ol class="pet-permission-help-list is-ordered">
                    <li>打开 Chrome 扩展管理页面：<code>chrome://extensions/</code></li>
                    <li>找到"温柔陪伴助手"扩展</li>
                    <li>点击"重新加载"按钮</li>
                    <li>确保"在所有网站上"权限已启用</li>
                    <li>刷新当前网页</li>
                    <li>重新尝试截图功能</li>
                </ol>
            </div>

            <div class="pet-permission-help-section">
                <h4 class="pet-permission-help-subtitle is-warning">⚠️ Chrome API问题：</h4>
                <ul class="pet-permission-help-list">
                    <li>如果显示"Chrome API不可用"，请刷新页面</li>
                    <li>确保在普通网页中使用（非系统页面）</li>
                    <li>检查浏览器是否是最新版本</li>
                    <li>尝试重启浏览器</li>
                </ul>
            </div>

            <div class="pet-permission-help-section">
                <h4 class="pet-permission-help-subtitle is-success">💡 其他解决方案：</h4>
                <ul class="pet-permission-help-list">
                    <li>尝试在其他网页中使用截图功能</li>
                    <li>检查浏览器是否是最新版本</li>
                    <li>暂时禁用其他可能冲突的扩展</li>
                    <li>重启浏览器后重试</li>
                </ul>
            </div>

            <div class="pet-permission-help-actions">
                <button id="open-extensions-page" class="pet-permission-help-btn is-primary">🚀 打开扩展管理页面</button>
                <button id="close-help-modal" class="pet-permission-help-btn is-danger">关闭</button>
            </div>
        `

    helpModal.appendChild(helpContainer)
    document.body.appendChild(helpModal)

    // 添加事件监听器
    document.getElementById('open-extensions-page').addEventListener('click', () => {
      window.open('chrome://extensions/', '_blank')
    })

    document.getElementById('close-help-modal').addEventListener('click', () => {
      this.closePermissionHelp()
    })

    // 点击背景关闭
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        this.closePermissionHelp()
      }
    })
  }

  // 关闭权限帮助
  proto.closePermissionHelp = function () {
    const modal = document.getElementById('permission-help-modal')
    if (modal) {
      modal.classList.add('is-closing')
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
        }
      }, 300)
    }
  }

  // 检查是否为系统页面
  proto.isSystemPage = function () {
    const url = window.location.href
    return url.startsWith('chrome://') ||
               url.startsWith('chrome-extension://') ||
               url.startsWith('moz-extension://') ||
               url.startsWith('about:') ||
               url.startsWith('edge://') ||
               url.startsWith('browser://')
  }

  // 检查Chrome API可用性
  proto.checkChromeAPIAvailability = function () {
    console.log('检查Chrome API可用性...')

    const apiStatus = {
      chrome: typeof chrome !== 'undefined',
      runtime: typeof chrome !== 'undefined' && !!chrome.runtime,
      tabs: typeof chrome !== 'undefined' && !!chrome.tabs
    }

    console.log('API状态:', apiStatus)

    if (!apiStatus.chrome) {
      console.error('Chrome对象不存在')
      return false
    }

    if (!apiStatus.runtime) {
      console.error('Chrome runtime API不可用')
      return false
    }

    // 测试runtime API是否正常工作
    try {
      const manifest = chrome.runtime.getManifest()
      if (!manifest || !manifest.name) {
        console.error('无法获取扩展manifest')
        return false
      }
      console.log('✅ Chrome API可用，扩展:', manifest.name)
      return true
    } catch (error) {
      console.error('Chrome runtime API测试失败:', error)
      return false
    }
  }

  // 检查截图权限
  proto.checkScreenshotPermission = async function () {
    return new Promise((resolve) => {
      console.log('开始检查截图权限...')

      // 检查chrome runtime API是否可用
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome runtime API不可用')
        resolve(false)
        return
      }

      // 通过background script检查权限
      chrome.runtime.sendMessage({
        action: 'checkPermissions'
      }, (response) => {
        console.log('权限检查响应:', response)

        if (chrome.runtime.lastError) {
          console.error('权限检查失败:', chrome.runtime.lastError.message)
          resolve(false)
          return
        }

        if (response && response.success && response.permissions) {
          const permissions = response.permissions
          console.log('当前权限列表:', permissions)

          // 检查是否有activeTab权限
          const hasActiveTab = permissions.permissions && permissions.permissions.includes('activeTab')
          console.log('activeTab权限状态:', hasActiveTab)

          if (hasActiveTab) {
            console.log('✅ activeTab权限已存在')
            resolve(true)
          } else {
            console.log('❌ activeTab权限不存在')
            resolve(false)
          }
        } else {
          console.error('权限检查响应无效:', response)
          resolve(false)
        }
      })
    })
  }

  // 备用截图方法
  proto.fallbackScreenshot = async function () {
    try {
      console.log('尝试备用截图方法...')

      // 方法1: 使用html2canvas库（如果可用）
      if (typeof html2canvas !== 'undefined') {
        console.log('使用html2canvas库截图...')
        try {
          const canvas = await html2canvas(document.body, {
            allowTaint: true,
            useCORS: true,
            scale: 0.5, // 降低分辨率以提高性能
            logging: false,
            width: window.innerWidth,
            height: window.innerHeight
          })
          return canvas.toDataURL('image/png')
        } catch (error) {
          console.error('html2canvas截图失败:', error)
        }
      }

      // 方法2: 使用getDisplayMedia API
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        console.log('尝试使用getDisplayMedia API...')
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              mediaSource: 'screen',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          })

          const video = document.createElement('video')
          video.srcObject = stream
          video.classList.add('pet-offscreen-invisible')
          document.body.appendChild(video)

          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.error('getDisplayMedia超时')
              // 清理资源
              stream.getTracks().forEach(track => track.stop())
              if (video.parentNode) {
                document.body.removeChild(video)
              }
              resolve(null)
            }, 10000) // 10秒超时

            video.addEventListener('loadedmetadata', () => {
              clearTimeout(timeout)
              try {
                const canvas = document.createElement('canvas')
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight

                const ctx = canvas.getContext('2d')
                ctx.drawImage(video, 0, 0)

                // 清理资源
                stream.getTracks().forEach(track => track.stop())
                if (video.parentNode) {
                  document.body.removeChild(video)
                }

                resolve(canvas.toDataURL('image/png'))
              } catch (error) {
                console.error('处理getDisplayMedia视频时出错:', error)
                // 清理资源
                stream.getTracks().forEach(track => track.stop())
                if (video.parentNode) {
                  document.body.removeChild(video)
                }
                resolve(null)
              }
            })

            video.addEventListener('error', (error) => {
              clearTimeout(timeout)
              console.error('视频加载错误:', error)
              // 清理资源
              stream.getTracks().forEach(track => track.stop())
              if (video.parentNode) {
                document.body.removeChild(video)
              }
              resolve(null)
            })

            video.play().catch(error => {
              clearTimeout(timeout)
              console.error('视频播放失败:', error)
              // 清理资源
              stream.getTracks().forEach(track => track.stop())
              if (video.parentNode) {
                document.body.removeChild(video)
              }
              resolve(null)
            })
          })
        } catch (error) {
          console.error('getDisplayMedia截图失败:', error)
          // 检查是否是权限被拒绝
          if (error.name === 'NotAllowedError') {
            console.log('用户拒绝了屏幕共享权限')
          }
        }
      }

      // 方法3: 简单的页面截图（仅可见区域）
      console.log('尝试简单页面截图...')
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // 设置画布大小为视口大小
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        // 填充背景色
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // 添加文本说明
        ctx.fillStyle = '#333333'
        ctx.font = '20px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('截图功能暂时不可用', canvas.width / 2, canvas.height / 2)
        ctx.fillText('请尝试刷新页面或重新加载扩展', canvas.width / 2, canvas.height / 2 + 30)

        return canvas.toDataURL('image/png')
      } catch (error) {
        console.error('简单截图失败:', error)
      }

      return null
    } catch (error) {
      console.error('备用截图方法失败:', error)
      return null
    }
  }

  // 使用Chrome API截图
  proto.captureVisibleTab = async function () {
    return new Promise((resolve) => {
      console.log('发送截图请求到background script...')

      // 检查chrome API是否可用
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Chrome API不可用')
        resolve(null)
        return
      }

      // 设置超时处理
      const timeout = setTimeout(() => {
        console.error('截图请求超时')
        resolve(null)
      }, 10000) // 10秒超时

      chrome.runtime.sendMessage({
        action: 'captureVisibleTab'
      }, (response) => {
        clearTimeout(timeout)
        console.log('收到background script响应:', response)

        if (chrome.runtime.lastError) {
          console.error('Chrome runtime错误:', chrome.runtime.lastError.message)
          console.error('错误详情:', chrome.runtime.lastError)

          // 检查是否是权限相关错误
          if (chrome.runtime.lastError.message.includes('permission') ||
                        chrome.runtime.lastError.message.includes('denied') ||
                        chrome.runtime.lastError.message.includes('not allowed')) {
            console.error('权限被拒绝，需要重新授权')
          }

          resolve(null)
        } else if (response && response.success) {
          console.log('截图成功，数据URL长度:', response.dataUrl ? response.dataUrl.length : 0)
          resolve(response.dataUrl)
        } else {
          console.error('截图API调用失败:', response)
          console.error('响应详情:', JSON.stringify(response, null, 2))
          resolve(null)
        }
      })
    })
  }

  // 显示截图预览
  proto.showScreenshotPreview = function (dataUrl) {
    // 创建截图预览模态框
    const modal = document.createElement('div')
    modal.id = 'screenshot-preview-modal'
    modal.className = 'pet-screenshot-preview-modal'

    // 创建预览容器
    const previewContainer = document.createElement('div')
    previewContainer.className = 'pet-screenshot-preview-container'

    // 创建标题
    const title = document.createElement('h3')
    title.innerHTML = '📷 截图预览'
    title.className = 'pet-screenshot-preview-title'

    // 创建图片预览
    const img = document.createElement('img')
    img.src = dataUrl
    img.className = 'pet-screenshot-preview-image'

    // 创建按钮容器
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'pet-screenshot-preview-buttons'

    // 保存按钮
    const saveButton = document.createElement('button')
    saveButton.innerHTML = '💾 保存图片'
    saveButton.className = 'pet-screenshot-preview-btn is-save'
    saveButton.addEventListener('click', () => {
      this.downloadScreenshot(dataUrl)
      this.closeScreenshotPreview()
    })

    // 复制按钮
    const copyButton = document.createElement('button')
    copyButton.innerHTML = '📋 复制'
    copyButton.className = 'pet-screenshot-preview-btn is-copy'
    copyButton.addEventListener('click', async () => {
      try {
        // 将图片转换为blob
        const response = await fetch(dataUrl)
        const blob = await response.blob()

        // 复制到剪贴板
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ])
      } catch (error) {
        console.error('复制失败:', error)
        this.showScreenshotNotification('复制失败，请使用保存功能', 'error')
      }
    })

    // 关闭按钮
    const closeButton = document.createElement('button')
    closeButton.textContent = '关闭'
    closeButton.className = 'pet-screenshot-preview-btn is-close'
    closeButton.addEventListener('click', () => {
      this.closeScreenshotPreview()
    })

    // 组装预览框
    buttonContainer.appendChild(saveButton)
    buttonContainer.appendChild(copyButton)
    buttonContainer.appendChild(closeButton)
    previewContainer.appendChild(title)
    previewContainer.appendChild(img)
    previewContainer.appendChild(buttonContainer)
    modal.appendChild(previewContainer)

    // 添加到页面
    document.body.appendChild(modal)

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeScreenshotPreview()
      }
    })
  }

  // 关闭截图预览
  proto.closeScreenshotPreview = function () {
    const modal = document.getElementById('screenshot-preview-modal')
    if (modal) {
      modal.classList.add('is-closing')
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal)
        }
      }, 300)
    }
  }

  // 下载截图
  proto.downloadScreenshot = function (dataUrl) {
    try {
      // 创建下载链接
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`

      // 触发下载
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      this.showScreenshotNotification('图片已保存到下载文件夹', 'success')
    } catch (error) {
      console.error('下载失败:', error)
      this.showScreenshotNotification('下载失败，请重试', 'error')
    }
  }

  // 显示通知
  // 显示通知（使用 NotificationUtils，保留兼容性）
  proto.showNotification = function (message, type = 'success') {
    if (typeof NotificationUtils !== 'undefined' && typeof NotificationUtils.show === 'function') {
      return NotificationUtils.show(message, type, { position: 'right' })
    }
    // 降级实现（保留原有逻辑以确保兼容性）
    const notification = document.createElement('div')
    notification.className = `pet-notification ${type}`
    notification.textContent = message

    document.body.appendChild(notification)

    // 3秒后移除通知
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('is-closing')
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification)
          }
        }, 300)
      }
    }, 3000)
  }

  // 显示截图通知（使用统一的 showNotification 方法，避免重复代码）
  proto.showScreenshotNotification = function (message, type = 'success') {
    return this.showNotification(message, type)
  }
})()
