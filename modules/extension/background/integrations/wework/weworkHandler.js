/**
 * 企微机器人相关消息处理器
 * 处理发送消息到企微机器人的操作
 */

/**
 * 处理发送消息到企微机器人请求
 */
function handleSendToWeWorkRobot (request, sendResponse) {
  // 使用企微服务
  const weworkService = typeof self !== 'undefined' && self.WeWorkService
    ? self.WeWorkService
    : null

  if (!weworkService || typeof weworkService.sendMessage !== 'function') {
    sendResponse({ success: false, error: 'WeWorkService 不可用' })
    return
  }
  weworkService.sendMessage(request.webhookUrl, request.content)
    .then((result) => {
      sendResponse({ success: true, result })
    })
    .catch((error) => {
      sendResponse({ success: false, error: error.message || '发送失败' })
    })
}

// 导出处理器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleSendToWeWorkRobot
  }
} else {
  if (typeof self !== 'undefined') {
    self.WeWorkHandler = {
      handleSendToWeWorkRobot
    }
  }
}
