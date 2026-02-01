(function initBackgroundImports() {
    const toUrl = (path) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
                return chrome.runtime.getURL(path);
            }
        } catch (_) {}
        return path;
    };

    const safeImport = (path) => {
        try {
            importScripts(toUrl(path));
        } catch (e) {
            try {
                console.error('无法加载脚本:', path, e);
            } catch (_) {}
        }
    };

    [
        'src/config.js',

        'src/utils/logging/loggerUtils.js',
        'src/utils/error/errorHandler.js',
        'src/utils/runtime/moduleUtils.js',
        'src/utils/runtime/globalAccessor.js',

        'src/background/services/tabMessaging.js',
        'src/background/services/injectionService.js',

        'src/background/integrations/wework/weworkService.js',

        'src/background/actions/extensionHandler.js',
        'src/background/actions/petHandler.js',
        'src/background/actions/screenshotHandler.js',
        'src/background/actions/messageForwardHandler.js',
        'src/background/actions/tabHandler.js',

        'src/background/integrations/wework/weworkHandler.js',

        'src/background/messaging/messageRouter.js'
    ].forEach(safeImport);
})();
