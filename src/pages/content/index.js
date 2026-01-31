/**
 * Content Scripts Index
 * 内容脚本入口文件
 */

// 内容服务
export { ContentService } from './services/ContentService.js';
export { DOMManager } from './services/DOMManager.js';
export { EventManager } from './services/EventManager.js';
export { SelectionManager } from './services/SelectionManager.js';
export { InjectionManager } from './services/InjectionManager.js';

// 内容工具
export { 
    injectScript,
    injectStyle,
    removeScript,
    removeStyle,
    getSelectionText,
    getSelectionHTML,
    getSelectionContext,
    createSelectionMenu,
    showSelectionMenu,
    hideSelectionMenu,
    handleSelectionChange,
    handleRightClick,
    handleKeyPress,
    handleMouseMove,
    handleScroll,
    handleResize,
    addEventListener,
    removeEventListener,
    dispatchCustomEvent,
    createCustomEvent,
    findElements,
    getElementText,
    getElementHTML,
    getElementAttributes,
    setElementAttributes,
    addElementClass,
    removeElementClass,
    toggleElementClass,
    createElement,
    appendElement,
    removeElement,
    insertBefore,
    insertAfter,
    getComputedStyle,
    getElementPosition,
    getElementSize,
    scrollToElement,
    highlightElement,
    unhighlightElement
} from './utils/contentUtils.js';

// 内容常量
export { 
    CONTENT_CONSTANTS,
    INJECTION_TYPES,
    EVENT_TYPES,
    SELECTOR_TYPES,
    CONTENT_SETTINGS
} from './constants/index.js';

// 内容类型
export { 
    ContentMessageType,
    InjectionType,
    EventType,
    SelectorType,
    ElementActionType,
    ContentSettingsType
} from './types/index.js';

// 默认导出
export default {
    // 服务
    ContentService,
    DOMManager,
    EventManager,
    SelectionManager,
    InjectionManager,
    
    // 工具
    injectScript,
    injectStyle,
    removeScript,
    removeStyle,
    getSelectionText,
    getSelectionHTML,
    getSelectionContext,
    createSelectionMenu,
    showSelectionMenu,
    hideSelectionMenu,
    handleSelectionChange,
    handleRightClick,
    handleKeyPress,
    handleMouseMove,
    handleScroll,
    handleResize,
    addEventListener,
    removeEventListener,
    dispatchCustomEvent,
    createCustomEvent,
    findElements,
    getElementText,
    getElementHTML,
    getElementAttributes,
    setElementAttributes,
    addElementClass,
    removeElementClass,
    toggleElementClass,
    createElement,
    appendElement,
    removeElement,
    insertBefore,
    insertAfter,
    getComputedStyle,
    getElementPosition,
    getElementSize,
    scrollToElement,
    highlightElement,
    unhighlightElement,
    
    // 常量
    CONTENT_CONSTANTS,
    INJECTION_TYPES,
    EVENT_TYPES,
    SELECTOR_TYPES,
    CONTENT_SETTINGS,
    
    // 类型
    ContentMessageType,
    InjectionType,
    EventType,
    SelectorType,
    ElementActionType,
    ContentSettingsType
};