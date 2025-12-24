/**
 * PetManager - 宠物显示和交互相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 创建宠物
    proto.createPet = function() {
        // 防止重复创建
        if (document.getElementById('minimal-pet')) {
            console.log('宠物已存在，跳过创建');
            // 如果宠物已存在，确保样式是最新的
            this.pet = document.getElementById('minimal-pet');
            this.updatePetStyle();
            return;
        }

        console.log('开始创建宠物...');
        console.log('当前可见性状态:', this.isVisible);

        // 创建宠物容器
        this.pet = document.createElement('div');
        this.pet.id = 'minimal-pet';
        this.updatePetStyle();

        // 使用 icon.png 作为宠物图标，不需要添加眼睛和嘴巴

        // 添加到页面
        this.addPetToPage();

        // 添加交互功能
        this.addInteractions();

        console.log('宠物创建成功！');
        console.log('宠物显示状态:', this.isVisible ? '显示' : '隐藏');
    };

    // 添加宠物到页面
    proto.addPetToPage = function() {
        console.log('尝试添加宠物到页面...');
        console.log('document.body 存在:', !!document.body);
        console.log('document.readyState:', document.readyState);

        if (document.body) {
            console.log('直接添加到 body');
            document.body.appendChild(this.pet);
            console.log('宠物已添加到页面');
            // 确保样式已更新
            this.updatePetStyle();
        } else {
            console.log('body 不存在，等待 DOMContentLoaded');
            // 如果body还没有加载，等待DOM加载完成
            const handleDOMReady = () => {
                console.log('DOMContentLoaded 事件触发');
                if (document.body && this.pet) {
                    console.log('现在添加到 body');
                    document.body.appendChild(this.pet);
                    console.log('宠物已添加到页面（延迟）');
                    // 确保样式已更新
                    this.updatePetStyle();
                } else {
                    console.log('DOMContentLoaded 后仍然无法添加宠物');
                }
            };
            
            // 检查是否已经加载完成
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', handleDOMReady);
            } else {
                // 如果已经加载完成，直接执行
                setTimeout(handleDOMReady, 0);
            }
        }
    };

    // 更新宠物样式
    proto.updatePetStyle = function() {
        if (!this.pet) return;

        // 根据角色获取对应的图标URL，默认使用教师角色
        const role = this.role || '教师';
        const iconUrl = chrome.runtime.getURL(`roles/${role}/icon.png`);

        this.pet.style.cssText = `
            position: fixed !important;
            top: ${this.position.y}px !important;
            left: ${this.position.x}px !important;
            width: ${this.size}px !important;
            height: ${this.size}px !important;
            background: url(${iconUrl}) center/contain no-repeat !important;
            border-radius: 12px !important;
            z-index: ${PET_CONFIG.ui.zIndex.pet} !important;
            cursor: grab !important;
            pointer-events: auto !important;
            box-shadow: none !important;
            transition: all 0.3s ease !important;
            display: ${this.isVisible ? 'block' : 'none'} !important;
            background-color: transparent !important;
        `;
    };

    // 显示加载动画（使用角色run目录下的连续图片，优化版：避免重复请求）
    proto.showLoadingAnimation = async function() {
        if (!this.pet) return;
        
        // 如果当前已经有动画在运行，不重复启动
        if (this.loadingAnimationInterval) {
            return;
        }
        
        const role = this.role || '教师';
        
        // 保存原始背景图片
        if (!this.originalBackgroundImage) {
            try {
                const iconImg = await window.imageResourceManager?.loadRoleIcon(role);
                if (iconImg && iconImg.src) {
                    this.originalBackgroundImage = iconImg.src;
                } else {
                    this.originalBackgroundImage = chrome.runtime.getURL(`roles/${role}/icon.png`);
                }
            } catch (error) {
                console.warn('加载角色图标失败，使用默认URL:', error);
                this.originalBackgroundImage = chrome.runtime.getURL(`roles/${role}/icon.png`);
            }
        }
        
        // 预加载所有动画帧（使用图片资源管理器，避免重复请求）
        let runFrameUrls = [];
        try {
            if (window.imageResourceManager) {
                // 预加载所有帧
                await window.imageResourceManager.preloadRunFrames(role, 3);
                
                // 获取所有帧的 URL（优先使用 data URL）
                const framePromises = [1, 2, 3].map(frame => 
                    window.imageResourceManager.getRunFrameUrl(role, frame)
                );
                runFrameUrls = await Promise.all(framePromises);
            } else {
                // 降级：使用原始 URL
                runFrameUrls = [
                    chrome.runtime.getURL(`roles/${role}/run/1.png`),
                    chrome.runtime.getURL(`roles/${role}/run/2.png`),
                    chrome.runtime.getURL(`roles/${role}/run/3.png`)
                ];
            }
        } catch (error) {
            console.warn('预加载动画帧失败，使用原始URL:', error);
            runFrameUrls = [
                chrome.runtime.getURL(`roles/${role}/run/1.png`),
                chrome.runtime.getURL(`roles/${role}/run/2.png`),
                chrome.runtime.getURL(`roles/${role}/run/3.png`)
            ];
        }
        
        if (runFrameUrls.length === 0 || !runFrameUrls[0]) {
            console.warn('无法获取动画帧URL，取消显示动画');
            return;
        }
        
        let currentFrame = 0;
        let lastSetUrl = null; // 记录上次设置的 URL，避免重复设置
        
        // 设置初始帧
        const initialUrl = runFrameUrls[currentFrame];
        if (initialUrl && initialUrl !== lastSetUrl) {
            this.pet.style.backgroundImage = `url(${initialUrl})`;
            this.pet.style.backgroundSize = 'contain';
            this.pet.style.backgroundPosition = 'center';
            this.pet.style.backgroundRepeat = 'no-repeat';
            lastSetUrl = initialUrl;
        }
        
        // 创建动画循环（每200ms切换一帧）
        this.loadingAnimationInterval = setInterval(() => {
            if (!this.pet) {
                this.stopLoadingAnimation();
                return;
            }
            
            currentFrame = (currentFrame + 1) % runFrameUrls.length;
            const frameUrl = runFrameUrls[currentFrame];
            
            // 避免重复设置相同的 URL（防止触发重复请求）
            if (frameUrl && frameUrl !== lastSetUrl) {
                this.pet.style.backgroundImage = `url(${frameUrl})`;
                lastSetUrl = frameUrl;
            }
        }, 200);
        
        console.log('开始显示加载动画（已预加载）');
    };

    // 停止加载动画，恢复原始图片
    proto.stopLoadingAnimation = function() {
        if (this.loadingAnimationInterval) {
            clearInterval(this.loadingAnimationInterval);
            this.loadingAnimationInterval = null;
        }
        
        if (this.pet && this.originalBackgroundImage) {
            this.pet.style.backgroundImage = `url(${this.originalBackgroundImage})`;
            this.pet.style.backgroundSize = 'contain';
            this.pet.style.backgroundPosition = 'center';
            this.pet.style.backgroundRepeat = 'no-repeat';
        }
        
        console.log('停止加载动画');
    };

    // 添加交互功能
    proto.addInteractions = function() {
        if (!this.pet) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        this.pet.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = this.position.x;
            startTop = this.position.y;
            this.pet.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging && this.pet) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                this.position.x = Math.max(0, Math.min(window.innerWidth - this.size, startLeft + deltaX));
                this.position.y = Math.max(0, Math.min(window.innerHeight - this.size, startTop + deltaY));
                this.pet.style.left = this.position.x + 'px';
                this.pet.style.top = this.position.y + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            if (this.pet) {
                this.pet.style.cursor = 'grab';
                this.saveState(); // 拖拽结束后保存状态
                // 立即同步到全局状态
                this.syncToGlobalState();
            }
        });

        this.pet.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.pet.style.transform = 'scale(1.1)';
            setTimeout(() => {
                if (this.pet) {
                    this.pet.style.transform = 'scale(1)';
                }
            }, 150);

            // 切换聊天窗口
            this.toggleChatWindow();
        });
    };

    // 切换可见性
    proto.toggleVisibility = function() {
        this.isVisible = !this.isVisible;
        this.updatePetStyle();
        this.saveState(); // 保存状态
        this.syncToGlobalState(); // 同步到全局状态
        console.log('宠物可见性切换为:', this.isVisible);
    };

    // 切换颜色
    proto.changeColor = function() {
        this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        this.updatePetStyle();
        this.updateChatWindowColor();
        console.log('宠物颜色切换为:', this.colorIndex);
    };

    // 设置颜色
    proto.setColor = function(colorIndex) {
        if (colorIndex >= 0 && colorIndex < this.colors.length) {
            this.colorIndex = colorIndex;
            this.updatePetStyle();
            this.updateChatWindowColor();
            this.saveState();
            this.syncToGlobalState();
            console.log('宠物颜色设置为:', this.colorIndex);
        }
    };

    // 设置大小
    proto.setSize = function(size) {
        this.size = Math.max(PET_CONFIG.pet.sizeLimits.min, Math.min(PET_CONFIG.pet.sizeLimits.max, size));
        this.updatePetStyle();
        this.saveState();
        this.syncToGlobalState();
        console.log('宠物大小设置为:', this.size);
    };

    // 设置角色
    proto.setRole = function(role) {
        // 验证角色是否有效（检查 roles 文件夹中是否存在对应的文件夹）
        const validRoles = ['教师', '医生', '甜品师', '警察'];
        if (validRoles.includes(role)) {
            this.role = role;
            this.updatePetStyle();
            this.saveState();
            this.syncToGlobalState();
            console.log('宠物角色设置为:', this.role);
        } else {
            console.warn('无效的角色，使用默认角色教师:', role);
            this.role = '教师';
            this.updatePetStyle();
        }
    };


    // 重置位置
    proto.resetPosition = function() {
        this.position = getPetDefaultPosition();
        this.updatePetStyle();
        this.saveState();
        this.syncToGlobalState();
        console.log('宠物位置已重置');
    };

    // 居中宠物
    proto.centerPet = function() {
        const centerX = getCenterPosition(this.size, window.innerWidth);
        const centerY = getCenterPosition(this.size, window.innerHeight);
        this.position = { x: centerX, y: centerY };
        this.updatePetStyle();
        this.saveState();
        this.syncToGlobalState();
        console.log('宠物已居中，位置:', this.position);
    };

    // 移除宠物
    proto.removePet = function() {
        if (this.pet && this.pet.parentNode) {
            this.pet.parentNode.removeChild(this.pet);
            this.pet = null;
            console.log('宠物已移除');
        }
    };

})();


