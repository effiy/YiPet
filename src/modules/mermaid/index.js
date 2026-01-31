/**
 * Mermaid Module - Main Entry
 * Mermaid图表模块主入口
 */

// Mermaid核心功能
export { MermaidManager } from './core/MermaidManager.js';
export { DiagramRenderer } from './core/DiagramRenderer.js';

// Mermaid服务
export { MermaidService } from './services/MermaidService.js';
export { DiagramService } from './services/DiagramService.js';

// MermaidHooks
export { useMermaid } from './hooks/useMermaid.js';
export { useDiagram } from './hooks/useDiagram.js';
export { useMermaidConfig } from './hooks/useMermaidConfig.js';

// MermaidUI组件
export { MermaidEditor } from './ui/MermaidEditor.js';
export { DiagramPreview } from './ui/DiagramPreview.js';
export { DiagramToolbar } from './ui/DiagramToolbar.js';
export { DiagramLibrary } from './ui/DiagramLibrary.js';

// Mermaid工具
export { 
    parseMermaidCode,
    validateMermaidSyntax,
    formatMermaidCode,
    detectDiagramType,
    convertDiagramType,
    optimizeMermaidCode
} from './utils/mermaidUtils.js';

export { 
    renderDiagram,
    exportDiagram,
    importDiagram,
    saveDiagram,
    loadDiagram,
    shareDiagram
} from './utils/diagramUtils.js';

export { 
    createDiagram,
    updateDiagram,
    deleteDiagram,
    duplicateDiagram,
    organizeDiagrams,
    searchDiagrams
} from './utils/diagramManager.js';

// Mermaid常量
export { 
    MERMAID_CONSTANTS,
    DIAGRAM_TYPES,
    RENDER_MODES,
    EXPORT_FORMATS,
    MERMAID_SETTINGS
} from './constants/index.js';

// Mermaid类型
export { 
    DiagramType,
    RenderModeType,
    ExportFormatType,
    MermaidConfigType,
    DiagramSettingsType
} from './types/index.js';

// 默认导出
export default {
    // 核心
    MermaidManager,
    DiagramRenderer,
    
    // 服务
    MermaidService,
    DiagramService,
    
    // Hooks
    useMermaid,
    useDiagram,
    useMermaidConfig,
    
    // UI
    MermaidEditor,
    DiagramPreview,
    DiagramToolbar,
    DiagramLibrary,
    
    // 工具
    parseMermaidCode,
    validateMermaidSyntax,
    formatMermaidCode,
    detectDiagramType,
    convertDiagramType,
    optimizeMermaidCode,
    renderDiagram,
    exportDiagram,
    importDiagram,
    saveDiagram,
    loadDiagram,
    shareDiagram,
    createDiagram,
    updateDiagram,
    deleteDiagram,
    duplicateDiagram,
    organizeDiagrams,
    searchDiagrams,
    
    // 常量
    MERMAID_CONSTANTS,
    DIAGRAM_TYPES,
    RENDER_MODES,
    EXPORT_FORMATS,
    MERMAID_SETTINGS,
    
    // 类型
    DiagramType,
    RenderModeType,
    ExportFormatType,
    MermaidConfigType,
    DiagramSettingsType
};