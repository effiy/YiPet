(function (root) {
    const g = root || (typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));

    const Utils = {
        dom: {
            DomHelper: g.DomHelper
        },
        error: {
            ErrorHandler: g.ErrorHandler
        },
        logging: {
            LoggerUtils: g.LoggerUtils
        },
        media: {
            ImageResourceManager: g.ImageResourceManager,
            imageResourceManager: g.imageResourceManager
        },
        messaging: {
            MessageHelper: g.MessageHelper
        },
        runtime: {
            GlobalAccessor: g.GlobalAccessor,
            ModuleUtils: g.ModuleUtils
        },
        session: {
            SessionManager: g.SessionManager
        },
        storage: {
            StorageUtils: g.StorageUtils
        },
        time: {
            TimeUtils: g.TimeUtils
        },
        ui: {
            LoadingAnimation: g.LoadingAnimation,
            petLoadingAnimation: g.petLoadingAnimation,
            LoadingAnimationMixin: g.LoadingAnimationMixin,
            NotificationUtils: g.NotificationUtils
        },
        url: {
            UrlUtils: g.UrlUtils
        }
    };

    g.Utils = Utils;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
