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
    const URL_CHANGE_EVENT = 'yi-pet:urlchange';

    const ensureHistoryHook = () => {
        try {
            if (!window.history) return;
            if (window.history.__yiPetHookedUrlChange__) return;

            const originalPushState = window.history.pushState;
            const originalReplaceState = window.history.replaceState;

            const emit = (type) => {
                try {
                    window.dispatchEvent(new CustomEvent(URL_CHANGE_EVENT, { detail: { type } }));
                } catch (e) {}
            };

            window.history.pushState = function (...args) {
                const res = originalPushState && originalPushState.apply(this, args);
                emit('pushState');
                return res;
            };

            window.history.replaceState = function (...args) {
                const res = originalReplaceState && originalReplaceState.apply(this, args);
                emit('replaceState');
                return res;
            };

            window.history.__yiPetHookedUrlChange__ = true;
            window.history.__yiPetOriginalPushState__ = originalPushState;
            window.history.__yiPetOriginalReplaceState__ = originalReplaceState;
        } catch (e) {}
    };

    // 设置标题变化监听（带防抖优化）
    proto.setupTitleChangeListener = function() {
        if (this._titleChangeListenerReady) return;
        this._titleChangeListenerReady = true;

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
        this._titleChangeObserver = titleObserver;

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
        const intervalId = setInterval(() => {
            const currentTitle = document.title;
            if (currentTitle !== lastTitle) {
                lastTitle = currentTitle;
                debouncedUpdateSession();
            }
        }, 2000); // 每2秒检查一次标题变化（降低频率）
        this._titleChangeIntervalId = intervalId;
    };

    // 设置URL变化监听，用于单页应用（SPA）的路由变化（带防抖优化）
    proto.setupUrlChangeListener = function() {
        if (this._urlChangeListenerReady) return;
        this._urlChangeListenerReady = true;

        ensureHistoryHook();

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
        const onPopState = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（popstate）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                debouncedUpdateSession('popstate');
            }
        };
        window.addEventListener('popstate', onPopState);
        this._urlPopStateHandler = onPopState;

        const onHistoryChange = (e) => {
            const currentUrl = window.location.href;
            if (currentUrl === lastUrl) return;
            console.log('检测到URL变化（history）:', lastUrl, '->', currentUrl);
            lastUrl = currentUrl;
            const reason = (e && e.detail && e.detail.type) ? e.detail.type : 'history';
            setTimeout(() => {
                debouncedUpdateSession(reason);
            }, 100);
        };
        window.addEventListener(URL_CHANGE_EVENT, onHistoryChange);
        this._urlHistoryChangeHandler = onHistoryChange;

        // 定期检查URL变化（防止某些边缘情况）
        // 降低检查频率，减少性能开销
        const intervalId = setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('检测到URL变化（定期检查）:', lastUrl, '->', currentUrl);
                lastUrl = currentUrl;
                debouncedUpdateSession('periodic');
            }
        }, 3000); // 每3秒检查一次（降低频率）
        this._urlChangeIntervalId = intervalId;
    };

    // 设置键盘快捷键
    proto.setupKeyboardShortcuts = function() {
        if (this._keyboardShortcutHandler) {
            return;
        }

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
        console.log('  - Esc：关闭聊天窗口');
    };

    proto.teardownTitleChangeListener = function() {
        if (this._titleChangeObserver) {
            try {
                this._titleChangeObserver.disconnect();
            } catch (e) {}
            this._titleChangeObserver = null;
        }
        if (this._titleChangeIntervalId) {
            try {
                clearInterval(this._titleChangeIntervalId);
            } catch (e) {}
            this._titleChangeIntervalId = null;
        }
        this._titleChangeListenerReady = false;
    };

    proto.teardownUrlChangeListener = function() {
        if (this._urlPopStateHandler) {
            try {
                window.removeEventListener('popstate', this._urlPopStateHandler);
            } catch (e) {}
            this._urlPopStateHandler = null;
        }
        if (this._urlHistoryChangeHandler) {
            try {
                window.removeEventListener(URL_CHANGE_EVENT, this._urlHistoryChangeHandler);
            } catch (e) {}
            this._urlHistoryChangeHandler = null;
        }
        if (this._urlChangeIntervalId) {
            try {
                clearInterval(this._urlChangeIntervalId);
            } catch (e) {}
            this._urlChangeIntervalId = null;
        }
        this._urlChangeListenerReady = false;
    };

    proto.teardownKeyboardShortcuts = function() {
        if (!this._keyboardShortcutHandler) return;
        try {
            window.removeEventListener('keydown', this._keyboardShortcutHandler, true);
        } catch (e) {}
        try {
            document.removeEventListener('keydown', this._keyboardShortcutHandler, true);
        } catch (e) {}
        this._keyboardShortcutHandler = null;
    };

})();
