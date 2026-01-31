/**
 * Pet Theme Hook
 * 宠物主题Hook
 */

import React from 'react';
import { usePetStorage } from './usePetStorage.js';
import { THEME_CONFIG, ThemeTypes } from '../constants/index.js';

/**
 * 主题管理器
 */
class PetThemeManager {
    constructor() {
        this.themes = THEME_CONFIG.modes;
        this.currentTheme = THEME_CONFIG.defaultMode;
        this.listeners = new Set();
        this.mediaQuery = null;
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        // 监听系统主题变化
        if (window.matchMedia) {
            this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));
        }
        
        // 应用当前主题
        this.applyTheme(this.currentTheme);
    }

    /**
     * 处理系统主题变化
     */
    handleSystemThemeChange(e) {
        if (this.currentTheme === ThemeTypes.AUTO) {
            const systemTheme = e.matches ? ThemeTypes.DARK : ThemeTypes.LIGHT;
            this.applyTheme(systemTheme, true);
        }
    }

    /**
     * 获取主题
     */
    getTheme(themeName = null) {
        const theme = themeName || this.currentTheme;
        
        if (theme === ThemeTypes.AUTO) {
            return this.getSystemTheme();
        }
        
        return this.themes[theme] || this.themes[THEME_CONFIG.defaultMode];
    }

    /**
     * 获取系统主题
     */
    getSystemTheme() {
        if (this.mediaQuery && this.mediaQuery.matches) {
            return this.themes[ThemeTypes.DARK];
        }
        return this.themes[ThemeTypes.LIGHT];
    }

    /**
     * 设置主题
     */
    setTheme(themeName) {
        if (this.themes[themeName] || themeName === ThemeTypes.AUTO) {
            const oldTheme = this.currentTheme;
            this.currentTheme = themeName;
            
            this.applyTheme(themeName);
            this.notifyListeners('themeChanged', {
                oldTheme,
                newTheme: themeName,
                theme: this.getTheme()
            });
            
            return true;
        }
        return false;
    }

    /**
     * 应用主题
     */
    applyTheme(themeName, isSystem = false) {
        const theme = this.getTheme(themeName);
        const themeClass = theme.className;
        
        // 移除旧的主题类
        document.documentElement.classList.remove(
            ...Object.values(this.themes).map(t => t.className)
        );
        
        // 添加新的主题类
        document.documentElement.classList.add(themeClass);
        
        // 应用CSS变量
        this.applyCSSVariables(theme.colors);
        
        // 触发自定义事件
        if (!isSystem) {
            const event = new CustomEvent('pet:theme:changed', {
                detail: {
                    theme: themeName,
                    themeData: theme,
                    isSystem: false
                }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * 应用CSS变量
     */
    applyCSSVariables(colors) {
        const root = document.documentElement;
        
        Object.entries(colors).forEach(([key, value]) => {
            const cssVar = `--pet-color-${key}`;
            root.style.setProperty(cssVar, value);
        });
        
        // 设置额外的CSS变量
        root.style.setProperty('--pet-theme-transition', '0.3s ease');
    }

    /**
     * 添加监听器
     */
    addListener(callback) {
        this.listeners.add(callback);
        
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * 移除监听器
     */
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * 通知监听器
     */
    notifyListeners(eventType, data) {
        this.listeners.forEach(callback => {
            try {
                callback(eventType, data);
            } catch (error) {
                console.error('主题监听器错误:', error);
            }
        });
    }

    /**
     * 获取当前主题名称
     */
    getCurrentThemeName() {
        return this.currentTheme;
    }

    /**
     * 获取所有可用主题
     */
    getAvailableThemes() {
        return Object.keys(this.themes);
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.mediaQuery) {
            this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange.bind(this));
        }
        this.listeners.clear();
    }
}

// 全局主题管理器实例
export const petThemeManager = new PetThemeManager();

/**
 * 宠物主题Hook
 */
export function usePetTheme() {
    const [theme, setTheme] = React.useState(() => petThemeManager.getTheme());
    const [themeName, setThemeName] = React.useState(() => petThemeManager.getCurrentThemeName());

    React.useEffect(() => {
        const unsubscribe = petThemeManager.addListener((eventType, data) => {
            if (eventType === 'themeChanged') {
                setTheme(data.theme);
                setThemeName(data.newTheme);
            }
        });

        return unsubscribe;
    }, []);

    const setCurrentTheme = React.useCallback((newThemeName) => {
        return petThemeManager.setTheme(newThemeName);
    }, []);

    const toggleTheme = React.useCallback(() => {
        const availableThemes = petThemeManager.getAvailableThemes();
        const currentIndex = availableThemes.indexOf(themeName);
        const nextIndex = (currentIndex + 1) % availableThemes.length;
        const nextTheme = availableThemes[nextIndex];
        
        return petThemeManager.setTheme(nextTheme);
    }, [themeName]);

    const getSystemTheme = React.useCallback(() => {
        return petThemeManager.getSystemTheme();
    }, []);

    return {
        theme,
        themeName,
        setTheme: setCurrentTheme,
        toggleTheme,
        getSystemTheme,
        availableThemes: petThemeManager.getAvailableThemes()
    };
}

/**
 * 宠物主题切换Hook
 */
export function usePetThemeToggle() {
    const { themeName, toggleTheme } = usePetTheme();
    
    const isDark = React.useMemo(() => {
        return themeName === ThemeTypes.DARK || 
               (themeName === ThemeTypes.AUTO && petThemeManager.getSystemTheme().name === '深色');
    }, [themeName]);

    return {
        isDark,
        themeName,
        toggleTheme
    };
}

/**
 * 宠物CSS变量Hook
 */
export function usePetCSSVariables(variables = []) {
    const [cssVariables, setCssVariables] = React.useState({});

    React.useEffect(() => {
        const updateVariables = () => {
            const computedStyle = getComputedStyle(document.documentElement);
            const vars = {};
            
            variables.forEach(variable => {
                const cssVar = variable.startsWith('--') ? variable : `--pet-${variable}`;
                vars[variable] = computedStyle.getPropertyValue(cssVar).trim();
            });
            
            setCssVariables(vars);
        };

        updateVariables();
        
        // 监听主题变化
        const handleThemeChange = () => updateVariables();
        document.addEventListener('pet:theme:changed', handleThemeChange);
        
        return () => {
            document.removeEventListener('pet:theme:changed', handleThemeChange);
        };
    }, [variables]);

    return cssVariables;
}

/**
 * 宠物主题偏好Hook
 */
export function usePetThemePreference() {
    const [themePreference, setThemePreference] = usePetStorage('theme-preference', THEME_CONFIG.defaultMode);
    
    React.useEffect(() => {
        if (themePreference !== petThemeManager.getCurrentThemeName()) {
            petThemeManager.setTheme(themePreference);
        }
    }, [themePreference]);

    const setPreference = React.useCallback((newPreference) => {
        setThemePreference(newPreference);
        petThemeManager.setTheme(newPreference);
    }, [setThemePreference]);

    return {
        preference: themePreference,
        setPreference,
        isAuto: themePreference === ThemeTypes.AUTO
    };
}