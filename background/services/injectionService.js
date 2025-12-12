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
     * 向指定标签页注入宠物
     * 如果content script未加载，会先尝试注入content script
     * @param {number} tabId - 标签页ID
     */
    injectPetToTab(tabId) {
        console.log('尝试注入宠物到标签页:', tabId);
        chrome.tabs.sendMessage(tabId, { action: 'initPet' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('无法注入宠物到标签页:', chrome.runtime.lastError.message);
                // 如果content script还没有加载，尝试重新注入
                if (chrome.runtime.lastError.message.includes('Could not establish connection')) {
                    console.log('Content script 可能未加载，尝试重新注入...');
                    this.injectContentScript(tabId).then(() => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, { action: 'initPet' }, (retryResponse) => {
                                if (chrome.runtime.lastError) {
                                    console.log('重试注入失败:', chrome.runtime.lastError.message);
                                } else {
                                    console.log('重试注入成功');
                                }
                            });
                        }, CONSTANTS.TIMING.INJECT_PET_DELAY);
                    });
                }
            } else {
                console.log('宠物注入成功:', response);
            }
        });
    }

    /**
     * 从指定标签页移除宠物
     * @param {number} tabId - 标签页ID
     */
    removePetFromTab(tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'removePet' }, (response) => {
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
                chrome.tabs.sendMessage(tab.id, { action, ...data }, (response) => {
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

