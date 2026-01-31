/**
 * FAQ Module - Main Entry
 * FAQ模块主入口
 */

// FAQ核心功能
export { FAQManager } from './core/FAQManager.js';
export { QuestionManager } from './core/QuestionManager.js';

// FAQ服务
export { FAQService } from './services/FAQService.js';
export { SearchService } from './services/SearchService.js';

// FAQHooks
export { useFAQ } from './hooks/useFAQ.js';
export { useQuestion } from './hooks/useQuestion.js';
export { useSearch } from './hooks/useSearch.js';

// FAQUI组件
export { FAQSidebar } from './ui/FAQSidebar.js';
export { QuestionList } from './ui/QuestionList.js';
export { QuestionDetail } from './ui/QuestionDetail.js';
export { FAQSearch } from './ui/FAQSearch.js';

// FAQ工具
export { 
    categorizeQuestions,
    searchQuestions,
    filterQuestions,
    sortQuestions,
    groupQuestions,
    validateQuestion,
    formatQuestion,
    extractKeywords
} from './utils/faqUtils.js';

export { 
    addQuestion,
    updateQuestion,
    deleteQuestion,
    importQuestions,
    exportQuestions,
    syncQuestions
} from './utils/questionUtils.js';

export { 
    buildSearchIndex,
    searchWithIndex,
    fuzzySearch,
    semanticSearch,
    getSearchSuggestions
} from './utils/searchUtils.js';

// FAQ常量
export { 
    FAQ_CONSTANTS,
    QUESTION_CATEGORIES,
    SEARCH_MODES,
    FAQ_SETTINGS
} from './constants/index.js';

// FAQ类型
export { 
    QuestionType,
    CategoryType,
    SearchModeType,
    FAQSettingsType
} from './types/index.js';

// 默认导出
export default {
    // 核心
    FAQManager,
    QuestionManager,
    
    // 服务
    FAQService,
    SearchService,
    
    // Hooks
    useFAQ,
    useQuestion,
    useSearch,
    
    // UI
    FAQSidebar,
    QuestionList,
    QuestionDetail,
    FAQSearch,
    
    // 工具
    categorizeQuestions,
    searchQuestions,
    filterQuestions,
    sortQuestions,
    groupQuestions,
    validateQuestion,
    formatQuestion,
    extractKeywords,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    importQuestions,
    exportQuestions,
    syncQuestions,
    buildSearchIndex,
    searchWithIndex,
    fuzzySearch,
    semanticSearch,
    getSearchSuggestions,
    
    // 常量
    FAQ_CONSTANTS,
    QUESTION_CATEGORIES,
    SEARCH_MODES,
    FAQ_SETTINGS,
    
    // 类型
    QuestionType,
    CategoryType,
    SearchModeType,
    FAQSettingsType
};