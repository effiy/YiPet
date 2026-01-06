/**
 * Tab 消息发送工具（Background / Service Worker）
 *
 * 目的：
 * - 统一封装 chrome.tabs.sendMessage 的 lastError 处理
 * - 可选：当 content script 未连接时自动注入并重试
 *
 * 注意：
 * - 返回值使用 resolve，不抛异常，避免上层漏 catch 导致消息通道异常关闭
 */

(function initTabMessaging(global) {
    const root = global || (typeof self !== 'undefined' ? self : globalThis);

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function isNoConnectionErrorMessage(message) {
        if (!message || typeof message !== 'string') return false;
        return (
            message.includes('Could not establish connection') ||
            message.includes('The message port closed') ||
            message.toLowerCase().includes('extension context invalidated')
        );
    }

    /**
     * 发送消息到指定 tab
     * @returns {Promise<{ok: boolean, response?: any, error?: string}>}
     */
    function sendMessageToTab(tabId, message) {
        return new Promise((resolve) => {
            try {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    const lastError = chrome?.runtime?.lastError;
                    if (lastError) {
                        resolve({ ok: false, error: lastError.message || String(lastError) });
                        return;
                    }
                    resolve({ ok: true, response });
                });
            } catch (e) {
                resolve({ ok: false, error: e?.message || String(e) });
            }
        });
    }

    /**
     * 发送消息到 tab（必要时自动注入 content script 并重试一次）
     * @param {number} tabId
     * @param {any} message
     * @param {Object} options
     * @param {Function} options.injectContentScript - (tabId) => Promise<boolean>
     * @param {number} options.retryDelayMs
     * @returns {Promise<{ok: boolean, response?: any, error?: string, injected?: boolean}>}
     */
    async function sendMessageToTabWithAutoInject(tabId, message, options = {}) {
        const retryDelayMs =
            typeof options.retryDelayMs === 'number'
                ? options.retryDelayMs
                : (root?.PET_CONFIG?.constants?.TIMING?.INJECT_PET_DELAY ?? 1000);

        const first = await sendMessageToTab(tabId, message);
        if (first.ok) return first;

        const errMsg = first.error || '';
        const shouldInject = isNoConnectionErrorMessage(errMsg);
        const injectFn = options.injectContentScript;

        if (!shouldInject || typeof injectFn !== 'function') {
            return first;
        }

        const injectedOk = await (async () => {
            try {
                return await injectFn(tabId);
            } catch (e) {
                return false;
            }
        })();

        if (!injectedOk) {
            return { ok: false, error: errMsg, injected: false };
        }

        await sleep(retryDelayMs);
        const second = await sendMessageToTab(tabId, message);
        return { ...second, injected: true };
    }

    root.TabMessaging = {
        sendMessageToTab,
        sendMessageToTabWithAutoInject,
        isNoConnectionErrorMessage
    };
})(typeof self !== 'undefined' ? self : undefined);


