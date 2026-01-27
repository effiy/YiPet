/**
 * 注入服务
 * 统一管理content script和宠物的注入逻辑
 */

class InjectionService {
    /**
     * 注入 content scripts 需要的文件列表（必须按依赖顺序）
     * 注意：这里要与 manifest.json 里的 content_scripts.js 保持一致，
     * 否则可能出现 window.PetManager 未定义等问题。
     */
    static CONTENT_SCRIPT_FILES = [
        'src/config.js',
        'src/libs/md5.js',
        'src/api/tokenUtils.js',
        'src/utils/helpers/imageResourceManager.js',
        'src/utils/helpers/loadingAnimationMixin.js',
        'src/api/baseApiManager.js',
        'src/utils/helpers/loadingAnimation.js',
        'src/api/sessionApi.js',
        'src/utils/helpers/sessionManager.js',

        'src/api/faqApi.js',
        'src/libs/turndown.js',
        'src/libs/marked.min.js',
        'src/libs/vue/vue.global.js',
        'src/libs/html2canvas.min.js',
        'src/features/chat/export-chat-to-png.js',
        'src/utils/helpers/loggerUtils.js',
        'src/utils/helpers/errorHandler.js',
        'src/utils/helpers/domHelper.js',
        'src/content/bootstrap.js',
        'src/features/pet/petManager.core.js',
        'src/features/pet/petManager.auth.js',
        'src/features/pet/petManager.roles.js',
        'src/features/pet/petManager.robot.js',
        'src/features/pet/petManager.ai.js',
        'src/features/pet/petManager.sessionEditor.js',
        'src/features/pet/petManager.requestEditor.js',
        'src/features/pet/petManager.editor.js',
        'src/features/pet/petManager.mermaid.js',
        'src/features/pet/petManager.tags.js',
        'src/features/pet/petManager.parser.js',
        'src/features/pet/petManager.io.js',
        'src/features/faq/faq.js',
        'src/features/faq/tags.js',
        'src/features/pet/petManager.messaging.js',
        'src/features/pet/petManager.pageInfo.js',
        'src/features/pet/petManager.session.js',
        'src/features/pet/components/SessionItem.js',
        'src/features/pet/components/ChatWindow/hooks/store.js',
        'src/features/pet/components/ChatWindow/hooks/useComputed.js',
        'src/features/pet/components/ChatWindow/hooks/useMethods.js',
        'src/features/pet/components/SessionSidebar/index.js',
        'src/features/pet/components/ChatWindow/index.js',
        'src/features/pet/petManager.ui.js',
        'src/features/pet/petManager.drag.js',
        'src/features/pet/petManager.pet.js',
        'src/features/pet/petManager.state.js',
        'src/features/pet/petManager.chat.js',
        'src/features/pet/petManager.chatUi.js',
        'src/features/pet/petManager.events.js',
        'src/features/pet/petManager.comment.js',
        'src/features/pet/petManager.media.js',
        'src/features/pet/petManager.message.js',
        'src/features/pet/petManager.screenshot.js',
        'src/features/pet/petManager.js',
        'src/content/index.js'
    ];

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
                files: InjectionService.CONTENT_SCRIPT_FILES
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
            return { ok: false, error: 'TabMessaging 不可用' };
        }

        return await helper.sendMessageToTabWithAutoInject(tabId, message, {
            injectContentScript: (id) => this.injectContentScript(id),
            retryDelayMs: (typeof self !== 'undefined' && self.PET_CONFIG && self.PET_CONFIG.constants && self.PET_CONFIG.constants.TIMING) ? self.PET_CONFIG.constants.TIMING.INJECT_PET_DELAY : 1000
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
        if (!helper || typeof helper.sendMessageToTab !== 'function') {
            console.error('无法从标签页移除宠物：TabMessaging 不可用');
            return;
        }
        helper.sendMessageToTab(tabId, { action: 'removePet' }).then((result) => {
            if (!result.ok) {
                console.log('无法从标签页移除宠物:', result.error);
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
                if (!helper || typeof helper.sendMessageToTab !== 'function') {
                    resolve({ tabId: tab.id, success: false });
                    return;
                }
                helper.sendMessageToTab(tab.id, { action, ...data }).then((result) => {
                    resolve({ tabId: tab.id, success: !!result.ok });
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
