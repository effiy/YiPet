/**
 * PetManager - 截图/权限相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 截图功能（支持区域选择）
    proto.takeScreenshot = async function () {
        try {
            console.log('开始截图...');

            // 检查Chrome API可用性
            if (!this.checkChromeAPIAvailability()) {
                this.showScreenshotNotification('Chrome API不可用，请刷新页面后重试', 'error');
                return;
            }

            // 添加详细的权限诊断
            await this.diagnosePermissions();

            // 检查权限
            const hasPermission = await this.checkScreenshotPermission();
            if (!hasPermission) {
                this.showScreenshotNotification('权限不足，请重新加载扩展或手动授予权限', 'error');
                this.showPermissionHelp();
                return;
            }

            // 检查当前页面是否允许截图
            if (this.isSystemPage()) {
                this.showScreenshotNotification('无法截取系统页面，请在其他网页中使用截图功能', 'error');
                return;
            }

            // 隐藏聊天窗口以获取更清晰的截图
            const originalDisplay = this.chatWindow ? this.chatWindow.style.display : 'block';
            if (this.chatWindow) {
                this.chatWindow.style.display = 'none';
            }

            // 隐藏宠物（如果显示的话）
            const originalPetDisplay = this.pet ? this.pet.style.display : 'block';
            if (this.pet) {
                this.pet.style.display = 'none';
            }

            // 等待一小段时间确保窗口完全隐藏
            await new Promise(resolve => setTimeout(resolve, 200));

            // 尝试使用Chrome的captureVisibleTab API截图
            let dataUrl = await this.captureVisibleTab();

            // 如果主要方法失败，尝试备用方法
            if (!dataUrl) {
                console.log('主要截图方法失败，尝试备用方法...');
                this.showScreenshotNotification('主要方法失败，尝试备用方法...', 'info');
                dataUrl = await this.fallbackScreenshot();
            }

            if (dataUrl) {
                // 保持聊天窗口和宠物隐藏，直到区域选择完成
                this.showAreaSelector(dataUrl, originalDisplay, originalPetDisplay);
            } else {
                // 如果截图失败，恢复显示
                if (this.chatWindow) {
                    this.chatWindow.style.display = originalDisplay;
                }
                if (this.pet) {
                    this.pet.style.display = originalPetDisplay;
                }
                this.showScreenshotNotification('截图失败，请检查权限设置或尝试刷新页面', 'error');
                this.showPermissionHelp();
            }

        } catch (error) {
            console.error('截图失败:', error);
            this.showScreenshotNotification('截图失败，请重试', 'error');

            // 确保聊天窗口和宠物恢复显示
            if (this.chatWindow) {
                this.chatWindow.style.display = 'block';
            }
            if (this.pet) {
                this.pet.style.display = 'block';
            }
        }
    };

    // 显示区域选择器
    proto.showAreaSelector = function (dataUrl, originalChatDisplay = 'block', originalPetDisplay = 'block') {
        // 创建区域选择器覆盖层
        const overlay = document.createElement('div');
        overlay.id = 'area-selector-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 2147483651 !important;
            cursor: crosshair !important;
            user-select: none !important;
        `;

        // 先加载图片以获取真实尺寸
        const img = new Image();
        img.src = dataUrl;

        // 创建截图背景容器
        const screenshotBg = document.createElement('div');
        screenshotBg.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 0.7 !important;
        `;

        // 创建实际图片元素
        const screenshotImg = document.createElement('img');
        screenshotImg.src = dataUrl;
        screenshotImg.style.cssText = `
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
        `;

        screenshotBg.appendChild(screenshotImg);

        // 创建选择框
        const selectionBox = document.createElement('div');
        selectionBox.id = 'selection-box';
        selectionBox.style.cssText = `
            position: absolute !important;
            border: 2px solid #2196F3 !important;
            background: rgba(33, 150, 243, 0.1) !important;
            pointer-events: none !important;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3) !important;
            display: none !important;
        `;

        // 创建工具提示
        const tipText = document.createElement('div');
        tipText.id = 'selection-tip';
        tipText.textContent = '拖动鼠标选择截图区域，双击确认';
        tipText.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(0, 0, 0, 0.8) !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            pointer-events: none !important;
            z-index: 2147483652 !important;
        `;

        overlay.appendChild(screenshotBg);
        overlay.appendChild(selectionBox);
        overlay.appendChild(tipText);

        // 等待图片加载完成后再添加到页面并设置事件监听
        img.onload = () => {
            document.body.appendChild(overlay);
            setupEventListeners();
        };

        // 如果图片已经加载完成
        if (img.complete && img.naturalHeight !== 0) {
            document.body.appendChild(overlay);
            setupEventListeners();
        }

        let isSelecting = false;
        let startX = 0;
        let startY = 0;

        // 设置事件监听器的函数
        const setupEventListeners = () => {
            // 鼠标按下事件
            overlay.addEventListener('mousedown', (e) => {
                isSelecting = true;
                startX = e.clientX;
                startY = e.clientY;

                selectionBox.style.left = startX + 'px';
                selectionBox.style.top = startY + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                selectionBox.style.display = 'block';

                // 隐藏提示
                tipText.style.display = 'none';

                e.preventDefault();
            });

            // 鼠标移动事件
            overlay.addEventListener('mousemove', (e) => {
                if (!isSelecting) return;

                const currentX = e.clientX;
                const currentY = e.clientY;

                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);

                selectionBox.style.left = left + 'px';
                selectionBox.style.top = top + 'px';
                selectionBox.style.width = width + 'px';
                selectionBox.style.height = height + 'px';
            });

            // 鼠标释放或双击事件
            const finishSelection = (e) => {
                if (!isSelecting) return;
                isSelecting = false;

                const rect = selectionBox.getBoundingClientRect();

                // 如果区域太小，关闭选择器并恢复显示
                if (rect.width < 10 || rect.height < 10) {
                    if (tipText) tipText.remove();
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                    // 恢复聊天窗口和宠物显示
                    this.restoreElements(originalChatDisplay, originalPetDisplay);
                    return;
                }

                // 计算截取区域的相对坐标（相对于原始截图尺寸）
                // 使用已经加载的图片
                const imgRect = screenshotImg.getBoundingClientRect();

                // 计算图片在页面中的实际显示尺寸和位置
                const imgDisplayWidth = imgRect.width;
                const imgDisplayHeight = imgRect.height;
                const imgDisplayX = imgRect.left;
                const imgDisplayY = imgRect.top;

                // 计算原始图片和显示图片的缩放比例
                const scaleX = img.width / imgDisplayWidth;
                const scaleY = img.height / imgDisplayHeight;

                // 将选择框相对于图片的位置转换为原始图片的坐标
                const relativeX = rect.left - imgDisplayX;
                const relativeY = rect.top - imgDisplayY;
                const relativeWidth = rect.width;
                const relativeHeight = rect.height;

                // 转换为原始图片坐标
                const actualX = relativeX * scaleX;
                const actualY = relativeY * scaleY;
                const actualWidth = relativeWidth * scaleX;
                const actualHeight = relativeHeight * scaleY;

                // 移除选择器
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }

                // 恢复聊天窗口和宠物显示
                this.restoreElements(originalChatDisplay, originalPetDisplay);

                // 裁剪图片
                this.cropAndDisplayScreenshot(dataUrl, actualX, actualY, actualWidth, actualHeight);
            };

            overlay.addEventListener('mouseup', finishSelection);
            overlay.addEventListener('dblclick', finishSelection);

            // ESC键取消
            const cancelHandler = (e) => {
                if (e.key === 'Escape') {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                    // 恢复聊天窗口和宠物显示
                    this.restoreElements(originalChatDisplay, originalPetDisplay);
                    window.removeEventListener('keydown', cancelHandler);
                }
            };
            window.addEventListener('keydown', cancelHandler);
        };
    };

    // 恢复元素显示
    proto.restoreElements = function (chatDisplay, petDisplay) {
        if (this.chatWindow) {
            this.chatWindow.style.display = chatDisplay;
        }
        if (this.pet) {
            this.pet.style.display = petDisplay;
        }
    };

    // 裁剪并显示截图
    proto.cropAndDisplayScreenshot = function (dataUrl, x, y, width, height) {
        const img = new Image();
        img.src = dataUrl;

        img.onload = () => {
            // 创建canvas进行裁剪
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

            // 转换为data URL
            const croppedDataUrl = canvas.toDataURL('image/png');

            this.showScreenshotPreview(croppedDataUrl);
        };
    };

    // 权限诊断
    proto.diagnosePermissions = async function () {
        console.log('=== 权限诊断开始 ===');

        // 检查Chrome API可用性
        console.log('Chrome API可用性:', {
            chrome: typeof chrome !== 'undefined',
            runtime: typeof chrome !== 'undefined' && !!chrome.runtime,
            tabs: typeof chrome !== 'undefined' && !!chrome.tabs,
            permissions: '通过background script检查'
        });

        // 检查当前页面信息
        console.log('当前页面信息:', {
            url: window.location.href,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isSystemPage: this.isSystemPage()
        });

        // 检查扩展信息
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                const manifest = chrome.runtime.getManifest();
                console.log('扩展信息:', {
                    name: manifest.name,
                    version: manifest.version,
                    permissions: manifest.permissions,
                    host_permissions: manifest.host_permissions
                });
            } catch (error) {
                console.error('获取扩展信息失败:', error);
            }
        }

        // 通过background script获取权限信息
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'checkPermissions'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('获取权限信息失败:', chrome.runtime.lastError.message);
                } else if (response && response.success) {
                    console.log('权限状态:', response.permissions);
                }
            });
        }

        console.log('=== 权限诊断结束 ===');
    };

    // 显示权限帮助
    proto.showPermissionHelp = function () {
        const helpModal = document.createElement('div');
        helpModal.id = 'permission-help-modal';
        helpModal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.8) !important;
            z-index: 2147483651 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            animation: fadeIn 0.3s ease-out !important;
        `;

        const helpContainer = document.createElement('div');
        helpContainer.style.cssText = `
            background: white !important;
            border-radius: 16px !important;
            padding: 30px !important;
            max-width: 500px !important;
            max-height: 80% !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
            position: relative !important;
            animation: scaleIn 0.3s ease-out !important;
            overflow-y: auto !important;
        `;

        helpContainer.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333; font-size: 20px; font-weight: 600; text-align: center;">
                🔧 权限问题解决方案
            </h3>

            <div style="margin-bottom: 20px;">
                <h4 style="color: #ff6b6b; margin-bottom: 10px;">📋 解决步骤：</h4>
                <ol style="color: #666; line-height: 1.6; padding-left: 20px;">
                    <li>打开 Chrome 扩展管理页面：<code>chrome://extensions/</code></li>
                    <li>找到"温柔陪伴助手"扩展</li>
                    <li>点击"重新加载"按钮</li>
                    <li>确保"在所有网站上"权限已启用</li>
                    <li>刷新当前网页</li>
                    <li>重新尝试截图功能</li>
                </ol>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="color: #FF9800; margin-bottom: 10px;">⚠️ Chrome API问题：</h4>
                <ul style="color: #666; line-height: 1.6; padding-left: 20px;">
                    <li>如果显示"Chrome API不可用"，请刷新页面</li>
                    <li>确保在普通网页中使用（非系统页面）</li>
                    <li>检查浏览器是否是最新版本</li>
                    <li>尝试重启浏览器</li>
                </ul>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="color: #4CAF50; margin-bottom: 10px;">💡 其他解决方案：</h4>
                <ul style="color: #666; line-height: 1.6; padding-left: 20px;">
                    <li>尝试在其他网页中使用截图功能</li>
                    <li>检查浏览器是否是最新版本</li>
                    <li>暂时禁用其他可能冲突的扩展</li>
                    <li>重启浏览器后重试</li>
                </ul>
            </div>

            <div style="text-align: center;">
                <button id="open-extensions-page" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #2196F3, #1976D2);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-right: 10px;
                    transition: all 0.3s ease;
                ">🚀 打开扩展管理页面</button>

                <button id="close-help-modal" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #f44336, #d32f2f);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">关闭</button>
            </div>
        `;

        helpModal.appendChild(helpContainer);
        document.body.appendChild(helpModal);

        // 添加事件监听器
        document.getElementById('open-extensions-page').addEventListener('click', () => {
            window.open('chrome://extensions/', '_blank');
        });

        document.getElementById('close-help-modal').addEventListener('click', () => {
            this.closePermissionHelp();
        });

        // 点击背景关闭
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                this.closePermissionHelp();
            }
        });

        // 添加动画样式
        if (!document.getElementById('help-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'help-modal-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    };

    // 关闭权限帮助
    proto.closePermissionHelp = function () {
        const modal = document.getElementById('permission-help-modal');
        if (modal) {
            modal.style.animation = 'fadeIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    };

    // 检查是否为系统页面
    proto.isSystemPage = function () {
        const url = window.location.href;
        return url.startsWith('chrome://') ||
               url.startsWith('chrome-extension://') ||
               url.startsWith('moz-extension://') ||
               url.startsWith('about:') ||
               url.startsWith('edge://') ||
               url.startsWith('browser://');
    };

    // 检查Chrome API可用性
    proto.checkChromeAPIAvailability = function () {
        console.log('检查Chrome API可用性...');

        const apiStatus = {
            chrome: typeof chrome !== 'undefined',
            runtime: typeof chrome !== 'undefined' && !!chrome.runtime,
            tabs: typeof chrome !== 'undefined' && !!chrome.tabs
        };

        console.log('API状态:', apiStatus);

        if (!apiStatus.chrome) {
            console.error('Chrome对象不存在');
            return false;
        }

        if (!apiStatus.runtime) {
            console.error('Chrome runtime API不可用');
            return false;
        }

        // 测试runtime API是否正常工作
        try {
            const manifest = chrome.runtime.getManifest();
            if (!manifest || !manifest.name) {
                console.error('无法获取扩展manifest');
                return false;
            }
            console.log('✅ Chrome API可用，扩展:', manifest.name);
            return true;
        } catch (error) {
            console.error('Chrome runtime API测试失败:', error);
            return false;
        }
    };

    // 检查截图权限
    proto.checkScreenshotPermission = async function () {
        return new Promise((resolve) => {
            console.log('开始检查截图权限...');

            // 检查chrome runtime API是否可用
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.error('Chrome runtime API不可用');
                resolve(false);
                return;
            }

            // 通过background script检查权限
            chrome.runtime.sendMessage({
                action: 'checkPermissions'
            }, (response) => {
                console.log('权限检查响应:', response);

                if (chrome.runtime.lastError) {
                    console.error('权限检查失败:', chrome.runtime.lastError.message);
                    resolve(false);
                    return;
                }

                if (response && response.success && response.permissions) {
                    const permissions = response.permissions;
                    console.log('当前权限列表:', permissions);

                    // 检查是否有activeTab权限
                    const hasActiveTab = permissions.permissions && permissions.permissions.includes('activeTab');
                    console.log('activeTab权限状态:', hasActiveTab);

                    if (hasActiveTab) {
                        console.log('✅ activeTab权限已存在');
                        resolve(true);
                    } else {
                        console.log('❌ activeTab权限不存在');
                        resolve(false);
                    }
                } else {
                    console.error('权限检查响应无效:', response);
                    resolve(false);
                }
            });
        });
    };

    // 备用截图方法
    proto.fallbackScreenshot = async function () {
        try {
            console.log('尝试备用截图方法...');

            // 方法1: 使用html2canvas库（如果可用）
            if (typeof html2canvas !== 'undefined') {
                console.log('使用html2canvas库截图...');
                try {
                    const canvas = await html2canvas(document.body, {
                        allowTaint: true,
                        useCORS: true,
                        scale: 0.5, // 降低分辨率以提高性能
                        logging: false,
                        width: window.innerWidth,
                        height: window.innerHeight
                    });
                    return canvas.toDataURL('image/png');
                } catch (error) {
                    console.error('html2canvas截图失败:', error);
                }
            }

            // 方法2: 使用getDisplayMedia API
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                console.log('尝试使用getDisplayMedia API...');
                try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            mediaSource: 'screen',
                            width: { ideal: 1920 },
                            height: { ideal: 1080 }
                        }
                    });

                    const video = document.createElement('video');
                    video.srcObject = stream;
                    video.style.position = 'fixed';
                    video.style.top = '-9999px';
                    video.style.left = '-9999px';
                    video.style.opacity = '0';
                    video.style.pointerEvents = 'none';
                    document.body.appendChild(video);

                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            console.error('getDisplayMedia超时');
                            // 清理资源
                            stream.getTracks().forEach(track => track.stop());
                            if (video.parentNode) {
                                document.body.removeChild(video);
                            }
                            resolve(null);
                        }, 10000); // 10秒超时

                        video.addEventListener('loadedmetadata', () => {
                            clearTimeout(timeout);
                            try {
                                const canvas = document.createElement('canvas');
                                canvas.width = video.videoWidth;
                                canvas.height = video.videoHeight;

                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(video, 0, 0);

                                // 清理资源
                                stream.getTracks().forEach(track => track.stop());
                                if (video.parentNode) {
                                    document.body.removeChild(video);
                                }

                                resolve(canvas.toDataURL('image/png'));
                            } catch (error) {
                                console.error('处理getDisplayMedia视频时出错:', error);
                                // 清理资源
                                stream.getTracks().forEach(track => track.stop());
                                if (video.parentNode) {
                                    document.body.removeChild(video);
                                }
                                resolve(null);
                            }
                        });

                        video.addEventListener('error', (error) => {
                            clearTimeout(timeout);
                            console.error('视频加载错误:', error);
                            // 清理资源
                            stream.getTracks().forEach(track => track.stop());
                            if (video.parentNode) {
                                document.body.removeChild(video);
                            }
                            resolve(null);
                        });

                        video.play().catch(error => {
                            clearTimeout(timeout);
                            console.error('视频播放失败:', error);
                            // 清理资源
                            stream.getTracks().forEach(track => track.stop());
                            if (video.parentNode) {
                                document.body.removeChild(video);
                            }
                            resolve(null);
                        });
                    });
                } catch (error) {
                    console.error('getDisplayMedia截图失败:', error);
                    // 检查是否是权限被拒绝
                    if (error.name === 'NotAllowedError') {
                        console.log('用户拒绝了屏幕共享权限');
                    }
                }
            }

            // 方法3: 简单的页面截图（仅可见区域）
            console.log('尝试简单页面截图...');
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 设置画布大小为视口大小
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;

                // 填充背景色
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 添加文本说明
                ctx.fillStyle = '#333333';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('截图功能暂时不可用', canvas.width / 2, canvas.height / 2);
                ctx.fillText('请尝试刷新页面或重新加载扩展', canvas.width / 2, canvas.height / 2 + 30);

                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('简单截图失败:', error);
            }

            return null;
        } catch (error) {
            console.error('备用截图方法失败:', error);
            return null;
        }
    };

    // 使用Chrome API截图
    proto.captureVisibleTab = async function () {
        return new Promise((resolve) => {
            console.log('发送截图请求到background script...');

            // 检查chrome API是否可用
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.error('Chrome API不可用');
                resolve(null);
                return;
            }

            // 设置超时处理
            const timeout = setTimeout(() => {
                console.error('截图请求超时');
                resolve(null);
            }, 10000); // 10秒超时

            chrome.runtime.sendMessage({
                action: 'captureVisibleTab'
            }, (response) => {
                clearTimeout(timeout);
                console.log('收到background script响应:', response);

                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime错误:', chrome.runtime.lastError.message);
                    console.error('错误详情:', chrome.runtime.lastError);

                    // 检查是否是权限相关错误
                    if (chrome.runtime.lastError.message.includes('permission') ||
                        chrome.runtime.lastError.message.includes('denied') ||
                        chrome.runtime.lastError.message.includes('not allowed')) {
                        console.error('权限被拒绝，需要重新授权');
                    }

                    resolve(null);
                } else if (response && response.success) {
                    console.log('截图成功，数据URL长度:', response.dataUrl ? response.dataUrl.length : 0);
                    resolve(response.dataUrl);
                } else {
                    console.error('截图API调用失败:', response);
                    console.error('响应详情:', JSON.stringify(response, null, 2));
                    resolve(null);
                }
            });
        });
    };

    // 显示截图预览
    proto.showScreenshotPreview = function (dataUrl) {
        // 创建截图预览模态框
        const modal = document.createElement('div');
        modal.id = 'screenshot-preview-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.8) !important;
            z-index: 2147483649 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            animation: fadeIn 0.3s ease-out !important;
        `;

        // 创建预览容器
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            background: white !important;
            border-radius: 16px !important;
            padding: 20px !important;
            max-width: 90% !important;
            max-height: 90% !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3) !important;
            position: relative !important;
            animation: scaleIn 0.3s ease-out !important;
        `;

        // 创建标题
        const title = document.createElement('h3');
        title.innerHTML = '📷 截图预览';
        title.style.cssText = `
            margin: 0 0 20px 0 !important;
            color: #333 !important;
            font-size: 18px !important;
            font-weight: 600 !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
        `;

        // 创建图片预览
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = `
            max-width: 100% !important;
            max-height: 60vh !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        `;

        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex !important;
            gap: 12px !important;
            margin-top: 20px !important;
            justify-content: center !important;
        `;

        // 保存按钮
        const saveButton = document.createElement('button');
        saveButton.innerHTML = '💾 保存图片';
        saveButton.style.cssText = `
            padding: 12px 24px !important;
            background: linear-gradient(135deg, #4CAF50, #45a049) !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
        `;
        saveButton.addEventListener('click', () => {
            this.downloadScreenshot(dataUrl);
            this.closeScreenshotPreview();
        });

        // 复制按钮
        const copyButton = document.createElement('button');
        copyButton.innerHTML = '📋 复制';
        copyButton.style.cssText = `
            padding: 12px 24px !important;
            background: linear-gradient(135deg, #2196F3, #1976D2) !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
        `;
        copyButton.addEventListener('click', async () => {
            try {
                // 将图片转换为blob
                const response = await fetch(dataUrl);
                const blob = await response.blob();

                // 复制到剪贴板
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
            } catch (error) {
                console.error('复制失败:', error);
                this.showScreenshotNotification('复制失败，请使用保存功能', 'error');
            }
        });

        // 关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭';
        closeButton.style.cssText = `
            padding: 12px 24px !important;
            background: linear-gradient(135deg, #f44336, #d32f2f) !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
        `;
        closeButton.addEventListener('click', () => {
            this.closeScreenshotPreview();
        });

        // 添加悬停效果
        [saveButton, copyButton, closeButton].forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = 'none';
            });
        });

        // 组装预览框
        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(closeButton);
        previewContainer.appendChild(title);
        previewContainer.appendChild(img);
        previewContainer.appendChild(buttonContainer);
        modal.appendChild(previewContainer);

        // 添加到页面
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeScreenshotPreview();
            }
        });

        // 添加动画样式
        if (!document.getElementById('screenshot-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'screenshot-modal-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    };

    // 关闭截图预览
    proto.closeScreenshotPreview = function () {
        const modal = document.getElementById('screenshot-preview-modal');
        if (modal) {
            modal.style.animation = 'fadeIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    };

    // 下载截图
    proto.downloadScreenshot = function (dataUrl) {
        try {
            // 创建下载链接
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showScreenshotNotification('图片已保存到下载文件夹', 'success');
        } catch (error) {
            console.error('下载失败:', error);
            this.showScreenshotNotification('下载失败，请重试', 'error');
        }
    };

    // 显示通知
    proto.showNotification = function (message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `pet-notification ${type}`;
        notification.textContent = message;

        const backgroundColor = type === 'error' ? '#f44336' :
                               type === 'info' ? '#2196F3' : '#4CAF50';

        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: ${backgroundColor} !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            z-index: 2147483650 !important;
            animation: slideInRight 0.3s ease-out !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        `;

        // 添加动画样式
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // 3秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    };

    // 显示截图通知
    proto.showScreenshotNotification = function (message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `screenshot-notification ${type}`;
        notification.textContent = message;

        const backgroundColor = type === 'error' ? '#f44336' :
                               type === 'info' ? '#2196F3' : '#4CAF50';

        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: ${backgroundColor} !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            z-index: 2147483650 !important;
            animation: slideInRight 0.3s ease-out !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        `;

        // 添加动画样式
        if (!document.getElementById('screenshot-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'screenshot-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // 3秒后移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    };
})();

