/**
 * Options Page Index
 * 选项页面入口文件
 */

// 选项服务
export { OptionsService } from './services/OptionsService.js';
export { SettingsManager } from './services/SettingsManager.js';
export { ThemeManager } from './services/ThemeManager.js';
export { LanguageManager } from './services/LanguageManager.js';

// 选项工具
export { 
    loadOptions,
    saveOptions,
    resetOptions,
    validateOptions,
    formatOptions,
    exportOptions,
    importOptions,
    syncOptions,
    getDefaultOptions,
    getOption,
    setOption,
    removeOption,
    hasOption,
    getAllOptions,
    updateOption,
    batchUpdateOptions
} from './utils/optionsUtils.js';

export { 
    createSettings,
    updateSettings,
    deleteSettings,
    resetSettings,
    validateSettings,
    formatSettings,
    exportSettings,
    importSettings,
    getSetting,
    setSetting,
    removeSetting,
    hasSetting,
    getAllSettings,
    batchUpdateSettings
} from './utils/settingsUtils.js';

export { 
    applyTheme,
    switchTheme,
    getTheme,
    setTheme,
    getAvailableThemes,
    getSystemTheme,
    detectSystemTheme,
    createTheme,
    updateTheme,
    deleteTheme,
    exportTheme,
    importTheme,
    validateTheme
} from './utils/themeUtils.js';

export { 
    getLanguage,
    setLanguage,
    getAvailableLanguages,
    detectLanguage,
    translate,
    localize,
    formatMessage,
    createLanguage,
    updateLanguage,
    deleteLanguage,
    exportLanguage,
    importLanguage,
    validateLanguage
} from './utils/languageUtils.js';

// 选项常量
export { 
    OPTIONS_CONSTANTS,
    SETTINGS_CATEGORIES,
    THEME_OPTIONS,
    LANGUAGE_OPTIONS,
    OPTIONS_SETTINGS
} from './constants/index.js';

// 选项类型
export { 
    OptionsType,
    SettingsType,
    ThemeType,
    LanguageType,
    OptionCategoryType,
    OptionsSettingsType
} from './types/index.js';

// 默认导出
export default {
    // 服务
    OptionsService,
    SettingsManager,
    ThemeManager,
    LanguageManager,
    
    // 工具
    loadOptions,
    saveOptions,
    resetOptions,
    validateOptions,
    formatOptions,
    exportOptions,
    importOptions,
    syncOptions,
    getDefaultOptions,
    getOption,
    setOption,
    removeOption,
    hasOption,
    getAllOptions,
    updateOption,
    batchUpdateOptions,
    createSettings,
    updateSettings,
    deleteSettings,
    resetSettings,
    validateSettings,
    formatSettings,
    exportSettings,
    importSettings,
    getSetting,
    setSetting,
    removeSetting,
    hasSetting,
    getAllSettings,
    batchUpdateSettings,
    applyTheme,
    switchTheme,
    getTheme,
    setTheme,
    getAvailableThemes,
    getSystemTheme,
    detectSystemTheme,
    createTheme,
    updateTheme,
    deleteTheme,
    exportTheme,
    importTheme,
    validateTheme,
    getLanguage,
    setLanguage,
    getAvailableLanguages,
    detectLanguage,
    translate,
    localize,
    formatMessage,
    createLanguage,
    updateLanguage,
    deleteLanguage,
    exportLanguage,
    importLanguage,
    validateLanguage,
    
    // 常量
    OPTIONS_CONSTANTS,
    SETTINGS_CATEGORIES,
    THEME_OPTIONS,
    LANGUAGE_OPTIONS,
    OPTIONS_SETTINGS,
    
    // 类型
    OptionsType,
    SettingsType,
    ThemeType,
    LanguageType,
    OptionCategoryType,
    OptionsSettingsType
};