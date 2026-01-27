/**
 * PetManager - 事件监听相关逻辑（从 `content/petManager.core.js` 拆分）
 * 说明：不使用 ESModule，通过给 `window.PetManager.prototype` 挂方法实现拆分。
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.PetManager === 'undefined') {
        return;
    }

    const proto = window.PetManager.prototype;

    // 设置标题变化监听（带防抖优化）
    proto.setupTitleChangeListener = function() {
        let titleUpdateTimer = null;
        let lastTitle = document.title;
        const debounceTime = this.SESSION_UPDATE_DEBOUNCE || 1000;

        // 防抖的会话更新函数
        const debouncedUpdateSession = () => {
            if (titleUpdateTimer) {
                clearTimeout(titleUpdateTimer);
            }
            titleUpdateTimer = setTimeout(() => {
                if (typeof this.initSession === 'function') {
                    this.initSession();
                }
            }, debounceTime);
        };

        // 使用 MutationObserver 监听标题变化
        const titleObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const currentTitle = document.title;
                    // 只有标题真的变化了才触发更新
                    if (currentTitle !== lastTitle) {
                        lastTitle = currentTitle;
                        debouncedUpdateSession();
                    }
                }
            });
        });

        // 观察 title 元素的变化
        const titleElement = document.querySelector('title');
        if (titleElement) {
            titleObserver.observe(titleElement, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }

        // 也监听 document.title 的直接变化（某些动态页面会直接修改）
        // 使用更长的检查间隔，减少不必要的检查
        setInterval(() => {
            const currentTitle = document.title;
            if (currentTitle !== lastTitle) {
                lastTitle = currentTitle;
                debouncedUpdateSession();
            }
        }, 2000); // 每2秒检查一次标题变化（降低频率）
    };

    // 设置URL变化监听，用于单页应用（SPA）的路由变化（带防抖优化）
    proto.setupUrlChangeListener = function() {
        let lastUrl = window.location.href;
        let urlUpdateTimer = null;
        const self = this;
        const debounceTime = this.SESSION_UPDATE_DEBOUNCE || 1000;

        // 防抖的会话更新函数
        const debouncedUpdateSession = (reason = '') => {
            if (urlUpdateTimer) {
                clearTimeout(urlUpdateTimer);
            }
            urlUpdateTimer = setTimeout(() => {
                if (typeof self.initSession === 'function') {
                    self.initSession();
                }
            }, debounceTime);
        };

        // 监听popstate事件（浏览器前进/后退）
        window.addEventListener('popstate', () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（popstate）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                debouncedUpdateSession('popstate');
            }
        });

        // 监听pushState和replaceState（单页应用路由变化）
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（pushState）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                // 延迟执行，确保页面已更新，并使用防抖
                setTimeout(() => {
                    debouncedUpdateSession('pushState');
                }, 100);
            }
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（replaceState）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                // 延迟执行，确保页面已更新，并使用防抖
                setTimeout(() => {
                    debouncedUpdateSession('replaceState');
                }, 100);
            }
        };

        // 定期检查URL变化（防止某些边缘情况）
        // 降低检查频率，减少性能开销
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（定期检查）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                debouncedUpdateSession('periodic');
            }
        }, 3000); // 每3秒检查一次（降低频率）
    };

    // 设置键盘快捷键
    proto.setupKeyboardShortcuts = function() {
        if (typeof this.quickCommentShortcutEnabled !== 'boolean') {
            this.quickCommentShortcutEnabled = true;
        }

        const notifyShortcutToggle = (enabled) => {
            const message = enabled ? 'Command+K 已启用' : 'Command+K 已禁用';
            if (typeof this.showNotification === 'function') {
                this.showNotification(message, 'info');
            } else {
                console.log(message);
            }
        };

        const loadQuickCommentShortcutEnabled = () => {
            try {
                chrome.storage.local.get(['petSettings'], (result) => {
                    const settings = result && result.petSettings ? result.petSettings : null;
                    const enabled = settings ? settings.quickCommentShortcutEnabled : undefined;
                    if (typeof enabled === 'boolean') {
                        this.quickCommentShortcutEnabled = enabled;
                    } else if (enabled === 'false') {
                        this.quickCommentShortcutEnabled = false;
                    } else if (enabled === 'true') {
                        this.quickCommentShortcutEnabled = true;
                    }
                });
            } catch (e) {}
        };

        const persistQuickCommentShortcutEnabled = (enabled) => {
            try {
                chrome.storage.local.get(['petSettings'], (result) => {
                    const settings = (result && result.petSettings) ? result.petSettings : {};
                    chrome.storage.local.set({
                        petSettings: {
                            ...settings,
                            quickCommentShortcutEnabled: enabled
                        }
                    });
                });
            } catch (e) {}
        };

        loadQuickCommentShortcutEnabled();

        // 使用箭头函数确保 this 绑定正确
        const handleKeyDown = (e) => {
            // 检查是否按下了 Ctrl+Shift+S (截图快捷键)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('检测到截图快捷键 Ctrl+Shift+S');

                // 直接进行截图，不需要打开聊天窗口
                this.takeScreenshot();

                return false;
            }

            // 检查是否按下了 Ctrl+Shift+X (切换聊天窗口快捷键)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('检测到聊天快捷键 Ctrl+Shift+X');

                // 仅切换显示/隐藏，不影响其他功能
                if (typeof this.toggleChatWindowVisibility === 'function') {
                    this.toggleChatWindowVisibility();
                }
                return false;
            }

            // 检查是否按下了 Ctrl+Shift+P (切换宠物显示/隐藏快捷键)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'p' || e.code === 'KeyP')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('检测到切换宠物显示/隐藏快捷键 Ctrl+Shift+P');
                this.toggleVisibility();
                return false;
            }
            
            // 检查是否按下了 Esc (关闭聊天窗口)
            if (e.key === 'Escape' && this.isChatOpen) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.closeChatWindow();
                return false;
            }

            // 检查是否按下了 Cmd/Ctrl + Shift + K (切换 Cmd/Ctrl + K 快捷键启用状态)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
                const nextEnabled = !this.quickCommentShortcutEnabled;
                this.quickCommentShortcutEnabled = nextEnabled;
                persistQuickCommentShortcutEnabled(nextEnabled);
                notifyShortcutToggle(nextEnabled);

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }

            // 检查是否按下了 Cmd/Ctrl + K (打开划词评论弹框)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                if (this.quickCommentShortcutEnabled === false) {
                    return;
                }

                // 如果评论弹框已打开，则聚焦输入框
                if (this.commentState && this.commentState.showQuickComment) {
                    const textarea = document.getElementById('pet-quick-comment-textarea');
                    if (textarea) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        textarea.focus();
                        return false;
                    }
                }
                
                // 打开评论弹框
                if (typeof this.openQuickCommentFromShortcut === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    this.openQuickCommentFromShortcut();
                    return false;
                }
            }
        };

        // 同时监听 window 和 document，确保能够捕获所有键盘事件
        window.addEventListener('keydown', handleKeyDown, true); // 使用捕获阶段
        document.addEventListener('keydown', handleKeyDown, true); // 使用捕获阶段

        // 保存事件处理器引用，以便后续清理
        this._keyboardShortcutHandler = handleKeyDown;

        console.log('键盘快捷键已设置 (petManager.events.js)：');
        console.log('  - Ctrl+Shift+S：截图');
        console.log('  - Ctrl+Shift+X：切换聊天窗口');
        console.log('  - Ctrl+Shift+P：切换宠物显示/隐藏');
        console.log('  - Ctrl/Cmd+K：打开划词评论弹框');
        console.log('  - Esc：关闭聊天窗口');
    };

})();
