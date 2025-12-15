/**
 * 注入服务
 * 统一管理content script和宠物的注入逻辑
 */

class InjectionService {
    /**
     * 直接注入content script到指定标签页
     * @param {number} tabId - 标签页ID
     * @returns {Promise<boolean>} 是否注入成功
     */
    async injectContentScript(tabId) {
        try {
            console.log('直接注入content script到标签页:', tabId);
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            console.log('Content script 注入成功');
            return true;
        } catch (error) {
            console.log('Content script 注入失败:', error);
            return false;
        }
    }

    /**
     * 向指定标签页发送消息（必要时自动注入 content script 并重试一次）
     * @param {number} tabId
     * @param {Object} message
     * @returns {Promise<{ok: boolean, response?: any, error?: string, injected?: boolean}>}
     */
    async sendMessageToTabWithAutoInject(tabId, message) {
        const helper = typeof self !== 'undefined' ? self.TabMessaging : null;
        if (!helper || typeof helper.sendMessageToTabWithAutoInject !== 'function') {
            // 降级：直接发送一次
            return new Promise((resolve) => {
                try {
                    chrome.tabs.sendMessage(tabId, message, (response) => {
                        if (chrome.runtime.lastError) {
                            resolve({ ok: false, error: chrome.runtime.lastError.message });
                        } else {
                            resolve({ ok: true, response });
                        }
                    });
                } catch (e) {
                    resolve({ ok: false, error: e?.message || String(e) });
                }
            });
        }

        return await helper.sendMessageToTabWithAutoInject(tabId, message, {
            injectContentScript: (id) => this.injectContentScript(id),
            retryDelayMs: CONSTANTS?.TIMING?.INJECT_PET_DELAY
        });
    }

    /**
     * 向指定标签页注入宠物
     * 如果content script未加载，会先尝试注入content script
     * @param {number} tabId - 标签页ID
     */
    injectPetToTab(tabId) {
        console.log('尝试注入宠物到标签页:', tabId);
        this.sendMessageToTabWithAutoInject(tabId, { action: 'initPet' }).then((result) => {
            if (!result.ok) {
                console.log('无法注入宠物到标签页:', result.error);
            } else {
                console.log('宠物注入成功:', result.response);
            }
        });
    }

    /**
     * 从指定标签页移除宠物
     * @param {number} tabId - 标签页ID
     */
    removePetFromTab(tabId) {
        const helper = typeof self !== 'undefined' ? self.TabMessaging : null;
        if (helper && typeof helper.sendMessageToTab === 'function') {
            helper.sendMessageToTab(tabId, { action: 'removePet' }).then((result) => {
                if (!result.ok) {
                    console.log('无法从标签页移除宠物:', result.error);
                }
            });
            return;
        }

        chrome.tabs.sendMessage(tabId, { action: 'removePet' }, () => {
            if (chrome.runtime.lastError) {
                console.log('无法从标签页移除宠物:', chrome.runtime.lastError.message);
            }
        });
    }

    /**
     * 获取所有浏览器标签页
     * @returns {Promise<Array>} 标签页数组
     */
    async getAllBrowserTabs() {
        return new Promise((resolve) => {
            chrome.tabs.query({}, (tabs) => {
                resolve(tabs);
            });
        });
    }

    /**
     * 在所有标签页中执行操作
     * @param {string} action - 要执行的操作
     * @param {Object} data - 附加数据
     * @returns {Promise<Array>} 执行结果数组
     */
    async executeActionInAllTabs(action, data = {}) {
        const tabs = await this.getAllBrowserTabs();
        const promises = tabs.map(tab => {
            return new Promise((resolve) => {
                const helper = typeof self !== 'undefined' ? self.TabMessaging : null;
                if (helper && typeof helper.sendMessageToTab === 'function') {
                    helper.sendMessageToTab(tab.id, { action, ...data }).then((result) => {
                        resolve({ tabId: tab.id, success: !!result.ok });
                    });
                    return;
                }
                chrome.tabs.sendMessage(tab.id, { action, ...data }, () => {
                    resolve({ tabId: tab.id, success: !chrome.runtime.lastError });
                });
            });
        });
        
        return Promise.all(promises);
    }
}

// 导出单例
if (typeof module !== "undefined" && module.exports) {
    module.exports = InjectionService;
} else {
    if (typeof self !== "undefined") {
        self.InjectionService = new InjectionService();
    }
}

