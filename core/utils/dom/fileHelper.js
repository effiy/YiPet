/**
 * 文件选择工具
 * 从 DomHelper 中提取，专注文件选择逻辑
 *
 * 使用示例：
 * ```javascript
 * const file = await FileHelper.pickFile({ accept: '.json' });
 * const files = await FileHelper.pickFile({ accept: 'image/*', multiple: true });
 * ```
 */
class FileHelper {
  /**
   * 打开文件选择对话框
   * @param {Object} options - 配置项
   * @param {string} [options.accept] - 接受的文件类型
   * @param {boolean} [options.multiple=false] - 是否允许多选
   * @returns {Promise<File|File[]|null>} 选中的文件
   */
  static pickFile(options = {}) {
    const accept = options?.accept
    const multiple = !!options?.multiple

    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      if (accept) input.accept = accept
      if (multiple) input.multiple = true
      input.className = 'js-hidden'

      const cleanup = () => {
        try {
          input.removeEventListener('change', onChange)
        } catch (_) {}
        try {
          if (input.parentNode) input.parentNode.removeChild(input)
        } catch (_) {}
      }

      const onChange = () => {
        const files = input.files
        cleanup()
        if (multiple) {
          resolve(files ? Array.from(files) : [])
          return
        }
        resolve(files && files[0] ? files[0] : null)
      }

      input.addEventListener('change', onChange)
      document.body.appendChild(input)

      try {
        input.click()
      } catch (_) {
        cleanup()
        resolve(multiple ? [] : null)
      }
    })
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileHelper
} else {
  window.FileHelper = FileHelper
}
