// 导出聊天记录为高清 PNG 图片

/**
 * 复制元素的计算样式
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
    loadingToast.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(59, 130, 246, 0.95) !important;
        color: white !important;
        padding: 16px 24px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 2147483650 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    `;
    loadingToast.textContent = '正在准备导出...';
    document.body.appendChild(loadingToast);

    try {
        // 检查 html2canvas 是否可用
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas 未加载，请刷新页面后重试');
        }
        
        // 更新提示
        loadingToast.textContent = '正在生成超高清图片...';

        // 创建一个临时容器来准备导出内容（使用更大的尺寸以获得更高清晰度）
        const exportContainer = document.createElement('div');
        exportContainer.style.cssText = `
            position: fixed !important;
            left: -9999px !important;
            top: 0 !important;
            width: 1200px !important;
            background: white !important;
            padding: 40px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            box-sizing: border-box !important;
        `;

        // 创建标题（更大的字体以匹配高清晰度）
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 32px !important;
            font-weight: 600 !important;
            color: #1f2937 !important;
            margin-bottom: 25px !important;
            text-align: center !important;
            padding-bottom: 20px !important;
            border-bottom: 3px solid #e5e7eb !important;
        `;
        title.textContent = sessionName;
        exportContainer.appendChild(title);

        // 克隆消息内容
        const messagesClone = messagesContainer.cloneNode(true);
        messagesClone.style.cssText = `
            max-height: none !important;
            overflow: visible !important;
            padding: 25px 0 !important;
            background: transparent !important;
        `;

        // 获取所有消息div（不依赖 data-message-type 属性）
        const messageElements = Array.from(messagesClone.children);
        
        messageElements.forEach((messageDiv, index) => {
            // 确保消息div可见（增加间距以适应高清晰度）
            messageDiv.style.opacity = '1';
            messageDiv.style.display = 'flex';
            messageDiv.style.marginBottom = '20px';
            messageDiv.style.width = '100%';
            messageDiv.style.boxSizing = 'border-box';
            
            // 查找宠物消息气泡和用户消息气泡（通过 style 或 className 识别）
            const petBubble = messageDiv.querySelector('[data-message-type="pet-bubble"]');
            const userBubble = messageDiv.querySelector('[data-message-type="user-bubble"]');
            
            // 如果找不到带属性的，尝试通过其他方式识别
            let bubbleElement = petBubble || userBubble;
            if (!bubbleElement) {
                // 查找包含样式的气泡元素
                const allDivs = messageDiv.querySelectorAll('div');
                for (let div of allDivs) {
                    const style = div.getAttribute('style') || '';
                    if (style.includes('background') && style.includes('padding') && style.includes('border-radius')) {
                        bubbleElement = div;
                        // 通过样式特征判断是宠物还是用户消息
                        if (messageDiv.style.justifyContent === 'flex-end' || 
                            style.includes('f093fb') || 
                            style.includes('f5576c')) {
                            userBubble = div;
                        } else {
                            petBubble = div;
                        }
                        break;
                    }
                }
            }
            
            if (petBubble) {
                // 宠物消息样式
                messageDiv.style.flexDirection = 'row';
                messageDiv.style.justifyContent = 'flex-start';
                messageDiv.style.alignItems = 'flex-start';
                messageDiv.style.gap = '10px';
                
                // 保留原有样式，只增强关键属性
                const currentStyle = petBubble.getAttribute('style') || '';
                petBubble.style.cssText = currentStyle;
                petBubble.style.maxWidth = '70%';
                petBubble.style.wordWrap = 'break-word';
                petBubble.style.overflowWrap = 'break-word';
                petBubble.style.whiteSpace = 'pre-wrap';
                
                // 确保图标可见（如果有）
                const icon = messageDiv.querySelector('span[style*="font-size: 32px"], span[style*="font-size: 30px"]');
                if (icon) {
                    icon.style.flexShrink = '0';
                }
            } else if (userBubble) {
                // 用户消息样式
                messageDiv.style.flexDirection = 'row-reverse';
                messageDiv.style.justifyContent = 'flex-start';
                messageDiv.style.alignItems = 'flex-start';
                messageDiv.style.gap = '10px';
                
                // 保留原有样式，只增强关键属性
                const currentStyle = userBubble.getAttribute('style') || '';
                userBubble.style.cssText = currentStyle;
                userBubble.style.maxWidth = '70%';
                userBubble.style.wordWrap = 'break-word';
                userBubble.style.overflowWrap = 'break-word';
                userBubble.style.whiteSpace = 'pre-wrap';
                
                // 确保图标可见（如果有）
                const icon = messageDiv.querySelector('span[style*="font-size: 32px"], span[style*="font-size: 30px"]');
                if (icon) {
                    icon.style.flexShrink = '0';
                }
            }
            
            // 处理图片
            const images = messageDiv.querySelectorAll('img');
            images.forEach(img => {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
            });
            
            // 处理 Markdown 渲染的内容（增加字体大小以获得更清晰的渲染）
            const markdownContent = messageDiv.querySelector('.markdown-content');
            if (markdownContent) {
                markdownContent.style.fontSize = '16px';
                markdownContent.style.lineHeight = '1.6';
                markdownContent.style.color = 'inherit';
            }
            
            // 移除可能影响显示的动画和过渡效果
            const allElements = messageDiv.querySelectorAll('*');
            allElements.forEach(el => {
                el.style.animation = 'none';
                el.style.transition = 'none';
            });
        });

        exportContainer.appendChild(messagesClone);

        // 添加底部时间戳（增大字体以匹配高清晰度）
        const timestamp = document.createElement('div');
        timestamp.style.cssText = `
            margin-top: 25px !important;
            padding-top: 20px !important;
            border-top: 2px solid #e5e7eb !important;
            text-align: center !important;
            font-size: 14px !important;
            color: #6b7280 !important;
        `;
        timestamp.textContent = `导出时间：${new Date().toLocaleString('zh-CN')}`;
        exportContainer.appendChild(timestamp);

        // 临时添加到页面
        document.body.appendChild(exportContainer);

        // 等待更长时间确保所有样式和图片加载完成
        await new Promise(resolve => setTimeout(resolve, 800));

        // 使用 html2canvas 生成图片（超高清设置）
        const canvas = await html2canvas(exportContainer, {
            scale: 5, // 5倍缩放，获得超高清图片（6000px 宽度）
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1200,
            width: 1200,
            height: exportContainer.scrollHeight,
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
    toast.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(34, 197, 94, 0.95) !important;
        color: white !important;
        padding: 16px 24px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 2147483650 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        animation: fadeInOut 2s ease-in-out !important;
    `;
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
    toast.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(239, 68, 68, 0.95) !important;
        color: white !important;
        padding: 16px 24px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 2147483650 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        animation: fadeInOut 3s ease-in-out !important;
    `;
    toast.textContent = `✗ 导出失败: ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, 3000);
}

// 添加淡入淡出动画
if (!document.getElementById('export-chat-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'export-chat-animation-styles';
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
    `;
    document.head.appendChild(style);
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
    loadingToast.style.cssText = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(59, 130, 246, 0.95) !important;
        color: white !important;
        padding: 16px 24px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 2147483650 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    `;
    loadingToast.textContent = '正在生成超高清图片...';
    document.body.appendChild(loadingToast);

    try {
        // 检查 html2canvas 是否可用
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas 未加载，请刷新页面后重试');
        }

        // 自动检测消息类型
        if (!messageType) {
            const petBubble = messageElement.querySelector('[data-message-type="pet-bubble"]');
            const userBubble = messageElement.querySelector('[data-message-type="user-bubble"]');
            messageType = petBubble ? 'pet' : (userBubble ? 'user' : 'user');
        }

        // 更新提示
        loadingToast.textContent = '正在生成超高清图片...';

        // 创建一个临时容器来准备导出内容
        const exportContainer = document.createElement('div');
        exportContainer.style.cssText = `
            position: fixed !important;
            left: -9999px !important;
            top: 0 !important;
            width: 1200px !important;
            background: white !important;
            padding: 40px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            box-sizing: border-box !important;
        `;

        // 在克隆前收集 iframe 信息，以便替换为占位符
        const originalIframes = Array.from(messageElement.querySelectorAll('iframe'));
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

        // 克隆消息元素
        const messageClone = messageElement.cloneNode(true);
        
        // 清理克隆元素中的按钮和操作元素
        const buttonsToRemove = messageClone.querySelectorAll('.edit-button, .delete-button, .resend-button, .copy-button, .export-message-button, [data-copy-button-container], [data-try-again-button-container]');
        buttonsToRemove.forEach(btn => {
            const container = btn.closest('[data-copy-button-container], [data-try-again-button-container]');
            if (container) {
                container.remove();
            } else {
                btn.remove();
            }
        });

        // 调整消息样式
        messageClone.style.cssText = `
            display: flex !important;
            margin-bottom: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            opacity: 1 !important;
        `;

        // 查找消息气泡
        const petBubble = messageClone.querySelector('[data-message-type="pet-bubble"]');
        const userBubble = messageClone.querySelector('[data-message-type="user-bubble"]');
        const bubble = petBubble || userBubble;

        if (bubble) {
            // 保留原有样式，只增强关键属性
            const currentStyle = bubble.getAttribute('style') || '';
            bubble.style.cssText = currentStyle;
            bubble.style.maxWidth = '100%';
            bubble.style.wordWrap = 'break-word';
            bubble.style.overflowWrap = 'break-word';
            bubble.style.whiteSpace = 'pre-wrap';
        }

        // 处理图片
        const images = messageClone.querySelectorAll('img');
        images.forEach(img => {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
        });

        // 处理 Markdown 渲染的内容
        const markdownContent = messageClone.querySelector('.markdown-content');
        if (markdownContent) {
            markdownContent.style.fontSize = '16px';
            markdownContent.style.lineHeight = '1.6';
            markdownContent.style.color = 'inherit';
        }

        // 移除可能影响显示的动画和过渡效果
        const allElements = messageClone.querySelectorAll('*');
        allElements.forEach(el => {
            el.style.animation = 'none';
            el.style.transition = 'none';
        });

        // 替换克隆中的 iframe，避免 html2canvas 在处理 iframe 时抛出错误
        const clonedIframes = messageClone.querySelectorAll('iframe');
        clonedIframes.forEach((iframe, idx) => {
            const info = iframeInfos[idx] || { width: 200, height: 150, title: '' };
            const placeholderWidth = Math.max(Number.isFinite(info.width) ? info.width : 200, 50);
            const placeholderHeight = Math.max(Number.isFinite(info.height) ? info.height : 150, 30);
            const placeholder = document.createElement('div');
            placeholder.style.cssText = `
                width: ${placeholderWidth}px !important;
                height: ${placeholderHeight}px !important;
                min-width: ${placeholderWidth}px !important;
                min-height: ${placeholderHeight}px !important;
                background: #f3f4f6 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: #6b7280 !important;
                font-size: 12px !important;
                text-align: center !important;
                padding: 8px !important;
                box-sizing: border-box !important;
            `;
            placeholder.textContent = info.title ? `[iframe: ${info.title}]` : '[iframe 内容]';
            if (iframe.parentNode) {
                iframe.parentNode.replaceChild(placeholder, iframe);
            } else {
                iframe.remove();
            }
        });

        exportContainer.appendChild(messageClone);

        // 将临时容器添加到 DOM（html2canvas 需要元素在 DOM 中）
        document.body.appendChild(exportContainer);

        // 等待更长时间确保所有样式和图片加载完成
        await new Promise(resolve => setTimeout(resolve, 800));

        // 使用 html2canvas 生成图片（超高清设置）
        const canvas = await html2canvas(exportContainer, {
            scale: 5, // 5倍缩放，获得超高清图片（6000px 宽度）
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1200,
            width: 1200,
            height: exportContainer.scrollHeight,
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
        const exportContainer = document.querySelector('[style*="left: -9999px"]');
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


