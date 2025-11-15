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
        loadingToast.textContent = '正在生成适合手机阅读的图片...';

        // 创建一个临时容器来准备导出内容（使用适合手机阅读的尺寸）
        const exportContainer = document.createElement('div');
        exportContainer.style.cssText = `
            position: fixed !important;
            left: -9999px !important;
            top: 0 !important;
            width: 750px !important;
            background: white !important;
            padding: 20px !important;
            margin: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif !important;
            box-sizing: border-box !important;
            line-height: 1.8 !important;
        `;

        // 克隆消息内容
        const messagesClone = messagesContainer.cloneNode(true);
        
        // 获取原始容器的计算样式
        const originalStyle = window.getComputedStyle(messagesContainer);
        
        messagesClone.style.cssText = `
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            width: 100% !important;
        `;

        // 获取所有消息div（不依赖 data-message-type 属性）
        const messageElements = Array.from(messagesClone.children);
        
        // 创建一个新的容器来存放只包含 markdown-content 的元素
        const contentOnlyContainer = document.createElement('div');
        contentOnlyContainer.style.cssText = `
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
        `;
        
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
            contentWrapper.style.cssText = `
                width: 100% !important;
                margin: 0 !important;
                padding: 16px !important;
                box-sizing: border-box !important;
                background: #f8f9fa !important;
                border-radius: 12px !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
            `;
            
            // 保留原始的间距（如果是第一条消息则不加间距）
            if (index > 0) {
                contentWrapper.style.marginTop = '20px';
            }
            
            // 递归复制原始 markdown-content 及其所有子元素的样式
            copyAllElementStyles(markdownContent, markdownClone);
            
            // 设置必要的样式（优化移动端阅读体验）
            markdownClone.style.setProperty('width', '100%', 'important');
            markdownClone.style.setProperty('max-width', '100%', 'important');
            markdownClone.style.setProperty('word-wrap', 'break-word', 'important');
            markdownClone.style.setProperty('overflow-wrap', 'break-word', 'important');
            markdownClone.style.setProperty('white-space', 'pre-wrap', 'important');
            markdownClone.style.setProperty('font-size', '16px', 'important');
            markdownClone.style.setProperty('line-height', '1.8', 'important');
            markdownClone.style.setProperty('color', '#333', 'important');
            
            // 优化标题样式
            const headings = markdownClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headings.forEach(heading => {
                heading.style.setProperty('margin', '1.2em 0 0.6em 0', 'important');
                heading.style.setProperty('line-height', '1.4', 'important');
                heading.style.setProperty('font-weight', '600', 'important');
                heading.style.setProperty('color', '#222', 'important');
            });
            
            // 优化段落样式
            const paragraphs = markdownClone.querySelectorAll('p');
            paragraphs.forEach(p => {
                p.style.setProperty('margin', '0.8em 0', 'important');
                p.style.setProperty('line-height', '1.8', 'important');
            });
            
            // 优化列表样式
            const lists = markdownClone.querySelectorAll('ul, ol');
            lists.forEach(list => {
                list.style.setProperty('padding-left', '1.8em', 'important');
                list.style.setProperty('margin', '0.8em 0', 'important');
            });
            
            const listItems = markdownClone.querySelectorAll('li');
            listItems.forEach(li => {
                li.style.setProperty('margin', '0.4em 0', 'important');
                li.style.setProperty('line-height', '1.8', 'important');
            });
            
            // 优化代码块样式
            const codeBlocks = markdownClone.querySelectorAll('pre');
            codeBlocks.forEach(pre => {
                pre.style.setProperty('background', '#2d3748', 'important');
                pre.style.setProperty('color', '#e2e8f0', 'important');
                pre.style.setProperty('padding', '16px', 'important');
                pre.style.setProperty('border-radius', '8px', 'important');
                pre.style.setProperty('overflow-x', 'auto', 'important');
                pre.style.setProperty('margin', '1em 0', 'important');
                pre.style.setProperty('font-size', '14px', 'important');
                pre.style.setProperty('line-height', '1.6', 'important');
            });
            
            const inlineCodes = markdownClone.querySelectorAll('code:not(pre code)');
            inlineCodes.forEach(code => {
                code.style.setProperty('background', '#f1f5f9', 'important');
                code.style.setProperty('color', '#e53e3e', 'important');
                code.style.setProperty('padding', '2px 6px', 'important');
                code.style.setProperty('border-radius', '4px', 'important');
                code.style.setProperty('font-size', '0.9em', 'important');
            });
            
            // 优化表格样式
            const tables = markdownClone.querySelectorAll('table');
            tables.forEach(table => {
                table.style.setProperty('width', '100%', 'important');
                table.style.setProperty('border-collapse', 'collapse', 'important');
                table.style.setProperty('margin', '1em 0', 'important');
                table.style.setProperty('font-size', '14px', 'important');
            });
            
            const tableCells = markdownClone.querySelectorAll('th, td');
            tableCells.forEach(cell => {
                cell.style.setProperty('border', '1px solid #e2e8f0', 'important');
                cell.style.setProperty('padding', '10px', 'important');
                cell.style.setProperty('text-align', 'left', 'important');
            });
            
            const tableHeaders = markdownClone.querySelectorAll('th');
            tableHeaders.forEach(th => {
                th.style.setProperty('background', '#f7fafc', 'important');
                th.style.setProperty('font-weight', '600', 'important');
            });
            
            // 优化引用块样式
            const blockquotes = markdownClone.querySelectorAll('blockquote');
            blockquotes.forEach(blockquote => {
                blockquote.style.setProperty('border-left', '4px solid #4299e1', 'important');
                blockquote.style.setProperty('padding-left', '16px', 'important');
                blockquote.style.setProperty('margin', '1em 0', 'important');
                blockquote.style.setProperty('color', '#4a5568', 'important');
                blockquote.style.setProperty('font-style', 'italic', 'important');
            });
            
            // 处理图片
            const images = markdownClone.querySelectorAll('img');
            images.forEach(img => {
                img.style.setProperty('max-width', '100%', 'important');
                img.style.setProperty('height', 'auto', 'important');
                img.style.setProperty('display', 'block', 'important');
                img.style.setProperty('margin', '1em auto', 'important');
                img.style.setProperty('border-radius', '8px', 'important');
            });
            
            // 优化链接样式
            const links = markdownClone.querySelectorAll('a');
            links.forEach(link => {
                link.style.setProperty('color', '#3182ce', 'important');
                link.style.setProperty('text-decoration', 'underline', 'important');
            });
            
            // 移除可能影响显示的动画和过渡效果
            const allElements = markdownClone.querySelectorAll('*');
            allElements.forEach(el => {
                el.style.animation = 'none';
                el.style.transition = 'none';
            });
            
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
            backgroundColor: '#ffffff',
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
        loadingToast.textContent = '正在生成适合手机阅读的图片...';

        // 创建一个临时容器来准备导出内容（使用适合手机阅读的尺寸）
        const exportContainer = document.createElement('div');
        exportContainer.style.cssText = `
            position: fixed !important;
            left: -9999px !important;
            top: 0 !important;
            width: 750px !important;
            background: white !important;
            padding: 20px !important;
            margin: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif !important;
            box-sizing: border-box !important;
            line-height: 1.8 !important;
        `;

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
        messageClone.style.cssText = `
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-sizing: border-box !important;
            opacity: 1 !important;
            background: #f8f9fa !important;
            border-radius: 12px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        `;
        
        // 递归复制原始 markdown-content 及其所有子元素的样式
        copyAllElementStyles(markdownContent, markdownClone);
        
        // 设置必要的样式（优化移动端阅读体验）
        markdownClone.style.setProperty('width', '100%', 'important');
        markdownClone.style.setProperty('max-width', '100%', 'important');
        markdownClone.style.setProperty('word-wrap', 'break-word', 'important');
        markdownClone.style.setProperty('overflow-wrap', 'break-word', 'important');
        markdownClone.style.setProperty('white-space', 'pre-wrap', 'important');
        markdownClone.style.setProperty('font-size', '16px', 'important');
        markdownClone.style.setProperty('line-height', '1.8', 'important');
        markdownClone.style.setProperty('color', '#333', 'important');
        
        // 优化标题样式
        const headings = markdownClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach(heading => {
            heading.style.setProperty('margin', '1.2em 0 0.6em 0', 'important');
            heading.style.setProperty('line-height', '1.4', 'important');
            heading.style.setProperty('font-weight', '600', 'important');
            heading.style.setProperty('color', '#222', 'important');
        });
        
        // 优化段落样式
        const paragraphs = markdownClone.querySelectorAll('p');
        paragraphs.forEach(p => {
            p.style.setProperty('margin', '0.8em 0', 'important');
            p.style.setProperty('line-height', '1.8', 'important');
        });
        
        // 优化列表样式
        const lists = markdownClone.querySelectorAll('ul, ol');
        lists.forEach(list => {
            list.style.setProperty('padding-left', '1.8em', 'important');
            list.style.setProperty('margin', '0.8em 0', 'important');
        });
        
        const listItems = markdownClone.querySelectorAll('li');
        listItems.forEach(li => {
            li.style.setProperty('margin', '0.4em 0', 'important');
            li.style.setProperty('line-height', '1.8', 'important');
        });
        
        // 优化代码块样式
        const codeBlocks = markdownClone.querySelectorAll('pre');
        codeBlocks.forEach(pre => {
            pre.style.setProperty('background', '#2d3748', 'important');
            pre.style.setProperty('color', '#e2e8f0', 'important');
            pre.style.setProperty('padding', '16px', 'important');
            pre.style.setProperty('border-radius', '8px', 'important');
            pre.style.setProperty('overflow-x', 'auto', 'important');
            pre.style.setProperty('margin', '1em 0', 'important');
            pre.style.setProperty('font-size', '14px', 'important');
            pre.style.setProperty('line-height', '1.6', 'important');
        });
        
        const inlineCodes = markdownClone.querySelectorAll('code:not(pre code)');
        inlineCodes.forEach(code => {
            code.style.setProperty('background', '#f1f5f9', 'important');
            code.style.setProperty('color', '#e53e3e', 'important');
            code.style.setProperty('padding', '2px 6px', 'important');
            code.style.setProperty('border-radius', '4px', 'important');
            code.style.setProperty('font-size', '0.9em', 'important');
        });
        
        // 优化表格样式
        const tables = markdownClone.querySelectorAll('table');
        tables.forEach(table => {
            table.style.setProperty('width', '100%', 'important');
            table.style.setProperty('border-collapse', 'collapse', 'important');
            table.style.setProperty('margin', '1em 0', 'important');
            table.style.setProperty('font-size', '14px', 'important');
        });
        
        const tableCells = markdownClone.querySelectorAll('th, td');
        tableCells.forEach(cell => {
            cell.style.setProperty('border', '1px solid #e2e8f0', 'important');
            cell.style.setProperty('padding', '10px', 'important');
            cell.style.setProperty('text-align', 'left', 'important');
        });
        
        const tableHeaders = markdownClone.querySelectorAll('th');
        tableHeaders.forEach(th => {
            th.style.setProperty('background', '#f7fafc', 'important');
            th.style.setProperty('font-weight', '600', 'important');
        });
        
        // 优化引用块样式
        const blockquotes = markdownClone.querySelectorAll('blockquote');
        blockquotes.forEach(blockquote => {
            blockquote.style.setProperty('border-left', '4px solid #4299e1', 'important');
            blockquote.style.setProperty('padding-left', '16px', 'important');
            blockquote.style.setProperty('margin', '1em 0', 'important');
            blockquote.style.setProperty('color', '#4a5568', 'important');
            blockquote.style.setProperty('font-style', 'italic', 'important');
        });
        
        // 处理图片
        const images = markdownClone.querySelectorAll('img');
        images.forEach(img => {
            img.style.setProperty('max-width', '100%', 'important');
            img.style.setProperty('height', 'auto', 'important');
            img.style.setProperty('display', 'block', 'important');
            img.style.setProperty('margin', '1em auto', 'important');
            img.style.setProperty('border-radius', '8px', 'important');
        });
        
        // 优化链接样式
        const links = markdownClone.querySelectorAll('a');
        links.forEach(link => {
            link.style.setProperty('color', '#3182ce', 'important');
            link.style.setProperty('text-decoration', 'underline', 'important');
        });
        
        // 移除可能影响显示的动画和过渡效果
        const allElements = markdownClone.querySelectorAll('*');
        allElements.forEach(el => {
            el.style.animation = 'none';
            el.style.transition = 'none';
        });
        
        // 替换克隆中的 iframe，避免 html2canvas 在处理 iframe 时抛出错误
        const clonedIframes = markdownClone.querySelectorAll('iframe');
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
            backgroundColor: '#ffffff',
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


