/**
 * Screenshot Module - Main Entry
 * 截图模块主入口
 */

// 截图核心功能
export { ScreenshotManager } from './core/ScreenshotManager.js';
export { CaptureEngine } from './core/CaptureEngine.js';

// 截图服务
export { ScreenshotService } from './services/ScreenshotService.js';
export { OCRService } from './services/OCRService.js';
export { AnnotationService } from './services/AnnotationService.js';

// 截图Hooks
export { useScreenshot } from './hooks/useScreenshot.js';
export { useCapture } from './hooks/useCapture.js';
export { useAnnotation } from './hooks/useAnnotation.js';
export { useOCR } from './hooks/useOCR.js';

// 截图UI组件
export { ScreenshotToolbar } from './ui/ScreenshotToolbar.js';
export { CaptureArea } from './ui/CaptureArea.js';
export { AnnotationPanel } from './ui/AnnotationPanel.js';
export { ScreenshotPreview } from './ui/ScreenshotPreview.js';

// 截图工具
export { 
    captureScreen,
    captureArea,
    captureElement,
    captureFullPage,
    downloadScreenshot,
    copyScreenshot,
    saveScreenshot
} from './utils/captureUtils.js';

export { 
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    clearAnnotations,
    exportAnnotations,
    importAnnotations
} from './utils/annotationUtils.js';

export { 
    recognizeText,
    extractText,
    processOCR,
    getSupportedLanguages,
    setOCROptions
} from './utils/ocrUtils.js';

// 截图常量
export { 
    SCREENSHOT_CONSTANTS,
    CAPTURE_MODES,
    ANNOTATION_TYPES,
    OCR_LANGUAGES,
    SCREENSHOT_SETTINGS
} from './constants/index.js';

// 截图类型
export { 
    ScreenshotModeType,
    AnnotationType,
    OCROptionsType,
    CaptureOptionsType,
    ScreenshotSettingsType
} from './types/index.js';

// 默认导出
export default {
    // 核心
    ScreenshotManager,
    CaptureEngine,
    
    // 服务
    ScreenshotService,
    OCRService,
    AnnotationService,
    
    // Hooks
    useScreenshot,
    useCapture,
    useAnnotation,
    useOCR,
    
    // UI
    ScreenshotToolbar,
    CaptureArea,
    AnnotationPanel,
    ScreenshotPreview,
    
    // 工具
    captureScreen,
    captureArea,
    captureElement,
    captureFullPage,
    downloadScreenshot,
    copyScreenshot,
    saveScreenshot,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
    clearAnnotations,
    exportAnnotations,
    importAnnotations,
    recognizeText,
    extractText,
    processOCR,
    getSupportedLanguages,
    setOCROptions,
    
    // 常量
    SCREENSHOT_CONSTANTS,
    CAPTURE_MODES,
    ANNOTATION_TYPES,
    OCR_LANGUAGES,
    SCREENSHOT_SETTINGS,
    
    // 类型
    ScreenshotModeType,
    AnnotationType,
    OCROptionsType,
    CaptureOptionsType,
    ScreenshotSettingsType
};