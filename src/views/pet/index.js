/**
 * Pet 视图主入口
 * 使用 Vue 3 重构
 * 参考 YiWeb 的设计模式
 * author: liangliang
 */

import { createStore } from './hooks/store.js';
import { useComputed } from './hooks/useComputed.js';
import { useMethods } from './hooks/useMethods.js';
import { createBaseView } from '../../utils/base/baseView.js';
import { logInfo, logWarn, logError } from '../../utils/base/log.js';

// 导入组件
import Pet from './components/Pet.vue.js';
import ChatWindow from './components/ChatWindow.vue.js';
import SessionList from './components/SessionList.vue.js';
import MessageList from './components/MessageList.vue.js';
import MessageInput from './components/MessageInput.vue.js';

// 创建 Pet 应用
(async function initPetApp() {
    try {
        logInfo('[Pet 视图] 开始初始化应用');

        // 确保 Vue 已加载
        if (typeof Vue === 'undefined') {
            logError('[Pet 视图] Vue 未加载，请确保已引入 Vue 3');
            return;
        }

        // 创建应用容器（如果不存在）
        let appContainer = document.getElementById('yi-pet-app');
        if (!appContainer) {
            appContainer = document.createElement('div');
            appContainer.id = 'yi-pet-app';
            appContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2147483647;
            `;
            document.body.appendChild(appContainer);
        }

        // 等待组件加载完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 注册组件到全局（供 baseView 使用）
        if (Pet) window.Pet = Pet.default || Pet;
        if (ChatWindow) window.ChatWindow = ChatWindow.default || ChatWindow;
        if (SessionList) window.SessionList = SessionList.default || SessionList;
        if (MessageList) window.MessageList = MessageList.default || MessageList;
        if (MessageInput) window.MessageInput = MessageInput.default || MessageInput;

        const app = await createBaseView({
            createStore,
            useComputed,
            useMethods,
            components: ['Pet', 'ChatWindow', 'SessionList', 'MessageList', 'MessageInput'],
            plugins: [],
            selector: '#yi-pet-app',
            onMounted: async (app) => {
                logInfo('[Pet 视图] 应用已挂载');
                logInfo('[Pet 视图] 挂载的应用实例:', app);

                // 暴露到全局，供其他模块使用
                window.yiPetApp = app;

                // 初始化应用
                if (typeof app.initApp === 'function') {
                    await app.initApp();
                }

                // 设置键盘快捷键
                setupKeyboardShortcuts(app);

                logInfo('[Pet 视图] 应用初始化完成');
            }
        });

    } catch (error) {
        logError('[Pet 视图] 应用初始化失败:', error);
    }
})();

/**
 * 设置键盘快捷键
 */
function setupKeyboardShortcuts(app) {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K: 打开/关闭聊天窗口
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (typeof app.toggleChatWindow === 'function') {
                app.toggleChatWindow();
            }
        }

        // ESC: 关闭聊天窗口
        if (e.key === 'Escape') {
            if (typeof app.closeChatWindow === 'function' && app.chatWindowVisible?.value) {
                app.closeChatWindow();
            }
        }

        // Ctrl/Cmd + N: 创建新会话
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            if (typeof app.createSession === 'function') {
                app.createSession();
            }
        }
    });

    logInfo('[Pet 视图] 键盘快捷键已设置');
}
