// 导出聊天记录为高清 PNG 图片

/**
 * 复制元素的计算样式（特别是行间距相关）
 * @param {HTMLElement} source - 源元素
 * @param {HTMLElement} target - 目标元素
 */
function copyComputedStyles(source, target) {
    const computedStyle = window.getComputedStyle(source);
    const importantStyles = [
        'display', 'position', 'top', 'left', 'right', 'bottom',
        'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'border', 'border-radius',
        'background', 'background-color', 'background-image', 'background-size',
        'color', 'font-size', 'font-family', 'font-weight', 'line-height',
        'text-align', 'text-decoration', 'white-space', 'word-wrap', 'word-break',
        'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
        'opacity', 'z-index', 'overflow', 'box-sizing'
    ];
    
    importantStyles.forEach(prop => {
        try {
            const value = computedStyle.getPropertyValue(prop);
            if (value) {
                target.style.setProperty(prop, value, 'important');
            }
        } catch (e) {
            // 忽略设置失败的属性
        }
    });
}

/**
 * 递归复制所有子元素的样式，特别是行间距相关的样式
 * @param {HTMLElement} sourceElement - 源元素
 * @param {HTMLElement} targetElement - 目标元素
 */
function copyAllElementStyles(sourceElement, targetElement) {
    if (!sourceElement || !targetElement) return;
    
    // 复制当前元素的样式
    const sourceStyle = window.getComputedStyle(sourceElement);
    const spacingStyles = [
        'line-height', 'font-size', 'font-family', 'font-weight',
        'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'letter-spacing', 'word-spacing', 'color'
    ];
    
    spacingStyles.forEach(prop => {
        try {
            const value = sourceStyle.getPropertyValue(prop);
            // 只复制有意义的非零值
            if (value && 
                value !== 'normal' && 
                value !== '0px' && 
                value !== '0' && 
                value !== 'none' &&
                !value.includes('rgba(0, 0, 0, 0)')) {
                targetElement.style.setProperty(prop, value, 'important');
            }
        } catch (e) {
            // 忽略设置失败的属性
        }
    });
    
    // 递归处理所有子元素
    const sourceChildren = Array.from(sourceElement.children);
    const targetChildren = Array.from(targetElement.children);
    
    for (let i = 0; i < Math.min(sourceChildren.length, targetChildren.length); i++) {
        copyAllElementStyles(sourceChildren[i], targetChildren[i]);
    }
    
    // 处理文本节点（如果有直接文本内容）
    if (sourceElement.childNodes.length > 0) {
        const sourceTextNodes = Array.from(sourceElement.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        const targetTextNodes = Array.from(targetElement.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        
        // 确保文本节点的样式一致
        if (sourceTextNodes.length > 0 && targetTextNodes.length > 0) {
            // 文本节点的样式继承自父元素，所以不需要单独处理
        }
    }
}

/**
 * 导出聊天记录为高清 PNG
 * @param {HTMLElement} messagesContainer - 聊天消息容器元素
 * @param {string} sessionName - 会话名称
 */
async function exportChatToPNG(messagesContainer, sessionName = '聊天记录') {
    if (!messagesContainer) {
        console.error('未找到聊天消息容器');
        showExportError('未找到聊天消息容器');
        return;
    }

    // 显示加载提示
    const loadingToast = document.createElement('div');
    loadingToast.className = 'pet-export-toast is-loading';
    loadingToast.textContent = '正在准备导出...';
    document.body.appendChild(loadingToast);

    try {
        // 检查 html2canvas 是否可用
        if (typeof html2canvas === 'undefined') {
            const errorMsg = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED 
                : 'html2canvas 未加载';
            throw new Error(errorMsg);
        }
        
        // 更新提示
        loadingToast.textContent = '正在生成适合手机阅读的图片...';

        // 创建一个临时容器来准备导出内容（使用适合手机阅读的尺寸）
        const exportContainer = document.createElement('div');
        exportContainer.className = 'export-container';

        // 克隆消息内容
        const messagesClone = messagesContainer.cloneNode(true);
        
        // 获取原始容器的计算样式
        const originalStyle = window.getComputedStyle(messagesContainer);
        
        messagesClone.className = 'export-messages-clone';

        // 获取所有消息div（不依赖 data-message-type 属性）
        const messageElements = Array.from(messagesClone.children);
        
        // 创建一个新的容器来存放只包含 markdown-content 的元素
        const contentOnlyContainer = document.createElement('div');
        contentOnlyContainer.className = 'export-content-only-container';
        
        messageElements.forEach((messageDiv, index) => {
            // 获取原始消息元素（用于复制样式）
            const originalMessageDiv = messagesContainer.children[index];
            
            // 查找 markdown-content 元素
            const markdownContent = messageDiv.querySelector('.markdown-content');
            
            if (!markdownContent) {
                // 如果没有 markdown-content，跳过这条消息
                return;
            }
            
            // 克隆 markdown-content 元素
            const markdownClone = markdownContent.cloneNode(true);
            
            // 获取原始 markdown-content 的计算样式
            const originalMarkdownStyle = window.getComputedStyle(markdownContent);
            
            // 创建一个容器来包装 markdown-content
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'export-content-wrapper';
            
            // 保留原始的间距（如果是第一条消息则不加间距）
            if (index > 0) {
                contentWrapper.classList.add('has-top-gap');
            }
            
            // 递归复制原始 markdown-content 及其所有子元素的样式
            copyAllElementStyles(markdownContent, markdownClone);
            markdownClone.classList.add('export-markdown', 'is-light-text');
            
            // 将 markdown-content 添加到包装容器
            contentWrapper.appendChild(markdownClone);
            contentOnlyContainer.appendChild(contentWrapper);
        });
        
        // 用只包含 markdown-content 的容器替换原来的消息容器
        messagesClone.innerHTML = '';
        messagesClone.appendChild(contentOnlyContainer);

        exportContainer.appendChild(messagesClone);

        // 临时添加到页面
        document.body.appendChild(exportContainer);

        // 等待更长时间确保所有样式和图片加载完成
        await new Promise(resolve => setTimeout(resolve, 800));

        // 等待所有图片加载完成
        const images = exportContainer.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000); // 超时保护
            });
        }));

        // 获取实际内容高度，确保完整包含所有内容
        const contentHeight = exportContainer.scrollHeight;
        const contentWidth = 750;

        // 使用 html2canvas 生成图片（适合移动端的高清设置）
        const canvas = await html2canvas(exportContainer, {
            scale: 2, // 2倍缩放，生成1500px宽度的高清图片，适合手机查看
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0f172a',  /* 深空黑 - 导出图片背景 */
            logging: false,
            windowWidth: contentWidth,
            windowHeight: contentHeight,
            width: contentWidth,
            height: contentHeight,
            imageTimeout: 0,
            removeContainer: false,
            foreignObjectRendering: false,
            letterRendering: true,
            // 添加额外的质量设置
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
        });

        // 移除临时容器
        document.body.removeChild(exportContainer);

        // 将 canvas 转换为 blob
        canvas.toBlob((blob) => {
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const fileName = `${sessionName}_${new Date().getTime()}.png`;
            link.href = url;
            link.download = fileName;
            link.click();

            // 清理
            URL.revokeObjectURL(url);

            // 移除加载提示
            if (loadingToast && loadingToast.parentNode) {
                loadingToast.parentNode.removeChild(loadingToast);
            }

            // 显示成功提示
            showExportSuccess(fileName);
        }, 'image/png', 1.0);

    } catch (error) {
        console.error('导出聊天记录失败:', error);
        
        // 移除加载提示
        if (loadingToast && loadingToast.parentNode) {
            loadingToast.parentNode.removeChild(loadingToast);
        }
        
        showExportError(error.message);
    }
}

/**
 * 显示导出成功提示
 */
function showExportSuccess(fileName) {
    const toast = document.createElement('div');
    toast.className = 'pet-export-toast is-success';
    toast.textContent = `✓ 导出成功: ${fileName}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, 2000);
}

/**
 * 显示导出失败提示
 */
function showExportError(message) {
    const toast = document.createElement('div');
    toast.className = 'pet-export-toast is-error';
    toast.textContent = `✗ 导出失败: ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, 3000);
}

/**
 * 导出单条消息为高清 PNG
 * @param {HTMLElement} messageElement - 消息元素（包含消息气泡的 div）
 * @param {string} messageType - 消息类型：'user' 或 'pet'，如果为 null 则自动检测
 */
async function exportSingleMessageToPNG(messageElement, messageType = null) {
    if (!messageElement) {
        console.error('未找到消息元素');
        showExportError('未找到消息元素');
        return;
    }

    // 显示加载提示
    const loadingToast = document.createElement('div');
    loadingToast.className = 'pet-export-toast is-loading';
    loadingToast.textContent = '正在生成超高清图片...';
    document.body.appendChild(loadingToast);

    try {
        // 检查 html2canvas 是否可用
        if (typeof html2canvas === 'undefined') {
            const errorMsg = (typeof PET_CONFIG !== 'undefined' && PET_CONFIG.constants && PET_CONFIG.constants.ERROR_MESSAGES) 
                ? PET_CONFIG.constants.ERROR_MESSAGES.OPERATION_FAILED 
                : 'html2canvas 未加载';
            throw new Error(errorMsg);
        }

        // 自动检测消息类型
        if (!messageType) {
            const petBubble = messageElement.querySelector('[data-message-type="pet-bubble"]');
            const userBubble = messageElement.querySelector('[data-message-type="user-bubble"]');
            messageType = petBubble ? 'pet' : (userBubble ? 'user' : 'user');
        }

        // 更新提示
        loadingToast.textContent = '正在生成适合手机阅读的图片...';

        // 创建一个临时容器来准备导出内容（使用适合手机阅读的尺寸）
        const exportContainer = document.createElement('div');
        exportContainer.className = 'export-container';

        // 查找 markdown-content 元素
        const markdownContent = messageElement.querySelector('.markdown-content');
        
        if (!markdownContent) {
            throw new Error('未找到 markdown-content 元素');
        }
        
        // 在克隆前收集 markdown-content 内的 iframe 信息，以便替换为占位符
        const originalIframes = Array.from(markdownContent.querySelectorAll('iframe'));
        const iframeInfos = originalIframes.map((iframe, index) => {
            const rect = iframe.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(iframe);
            return {
                width: rect.width || parseFloat(computedStyle.width) || parseFloat(iframe.getAttribute('width')) || 200,
                height: rect.height || parseFloat(computedStyle.height) || parseFloat(iframe.getAttribute('height')) || 150,
                index,
                title: iframe.getAttribute('title') || '',
                dataset: { ...iframe.dataset }
            };
        });
        
        // 克隆 markdown-content 元素
        const markdownClone = markdownContent.cloneNode(true);
        
        // 创建一个容器来包装 markdown-content
        const messageClone = document.createElement('div');
        messageClone.className = 'export-message-clone';
        
        // 递归复制原始 markdown-content 及其所有子元素的样式
        copyAllElementStyles(markdownContent, markdownClone);
        
        markdownClone.classList.add('export-markdown', 'is-dark-text');
        
        // 替换克隆中的 iframe，避免 html2canvas 在处理 iframe 时抛出错误
        const clonedIframes = markdownClone.querySelectorAll('iframe');
        clonedIframes.forEach((iframe, idx) => {
            const info = iframeInfos[idx] || { width: 200, height: 150, title: '' };
            const placeholderWidth = Math.max(Number.isFinite(info.width) ? info.width : 200, 50);
            const placeholderHeight = Math.max(Number.isFinite(info.height) ? info.height : 150, 30);
            const placeholder = document.createElement('div');
            placeholder.className = 'export-iframe-placeholder';
            placeholder.style.setProperty('width', `${placeholderWidth}px`, 'important');
            placeholder.style.setProperty('height', `${placeholderHeight}px`, 'important');
            placeholder.style.setProperty('min-width', `${placeholderWidth}px`, 'important');
            placeholder.style.setProperty('min-height', `${placeholderHeight}px`, 'important');
            placeholder.textContent = info.title ? `[iframe: ${info.title}]` : '[iframe 内容]';
            if (iframe.parentNode) {
                iframe.parentNode.replaceChild(placeholder, iframe);
            } else {
                iframe.remove();
            }
        });
        
        // 将 markdown-content 添加到容器
        messageClone.appendChild(markdownClone);
        exportContainer.appendChild(messageClone);

        // 将临时容器添加到 DOM（html2canvas 需要元素在 DOM 中）
        document.body.appendChild(exportContainer);

        // 等待更长时间确保所有样式和图片加载完成
        await new Promise(resolve => setTimeout(resolve, 800));

        // 等待所有图片加载完成
        const imagesToLoad = exportContainer.querySelectorAll('img');
        await Promise.all(Array.from(imagesToLoad).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000); // 超时保护
            });
        }));

        // 获取实际内容高度，确保完整包含所有内容
        const contentHeight = exportContainer.scrollHeight;
        const contentWidth = 750;

        // 使用 html2canvas 生成图片（适合移动端的高清设置）
        const canvas = await html2canvas(exportContainer, {
            scale: 2, // 2倍缩放，生成1500px宽度的高清图片，适合手机查看
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#0f172a',  /* 深空黑 - 导出图片背景 */
            logging: false,
            windowWidth: contentWidth,
            windowHeight: contentHeight,
            width: contentWidth,
            height: contentHeight,
            imageTimeout: 0,
            removeContainer: false,
            foreignObjectRendering: false,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            ignoreElements: (element) => element.tagName === 'IFRAME'
        });

        // 移除临时容器
        document.body.removeChild(exportContainer);

        // 将 canvas 转换为 blob
        canvas.toBlob((blob) => {
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const fileName = `消息_${messageType}_${new Date().getTime()}.png`;
            link.href = url;
            link.download = fileName;
            link.click();

            // 清理
            URL.revokeObjectURL(url);

            // 移除加载提示
            if (loadingToast && loadingToast.parentNode) {
                loadingToast.parentNode.removeChild(loadingToast);
            }

            // 显示成功提示
            showExportSuccess(fileName);
        }, 'image/png', 1.0);

    } catch (error) {
        console.error('导出消息失败:', error);
        
        // 移除临时容器（如果存在）
        const exportContainer = document.querySelector('.export-container');
        if (exportContainer && exportContainer.parentNode) {
            try {
                exportContainer.parentNode.removeChild(exportContainer);
            } catch (e) {
                // 忽略移除错误
            }
        }
        
        // 移除加载提示
        if (loadingToast && loadingToast.parentNode) {
            loadingToast.parentNode.removeChild(loadingToast);
        }
        
        showExportError(error.message);
    }
}

// 导出函数供外部使用
window.exportChatToPNG = exportChatToPNG;
window.exportSingleMessageToPNG = exportSingleMessageToPNG;
