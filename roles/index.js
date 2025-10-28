/**
 * 角色提示词统一导出
 * 将所有角色模块统一导出，提供统一的接口
 */

let PROMPT_ROLES = {};

// Node.js 环境：动态 require
if (typeof module !== 'undefined' && module.exports) {
    const summary = require('./summary');
    const mindmap = require('./mindmap');
    const flashcard = require('./flashcard');
    const report = require('./report');
    const bestPractice = require('./bestPractice');
    
    PROMPT_ROLES = {
        summary,
        mindmap,
        flashcard,
        report,
        bestPractice
    };
}

/**
 * 根据角色类型获取提示词
 * @param {string} roleName - 角色名称（'summary', 'mindmap', 'flashcard', 'report', 'bestPractice'）
 * @param {Object} pageInfo - 页面信息对象，包含 title, url, description, content
 * @returns {Object} 包含 systemPrompt 和 userPrompt 的对象
 */
function getPromptForRole(roleName, pageInfo) {
    // 浏览器环境：从 window.PROMPT_ROLES 获取（由各个角色文件设置）
    // Node.js 环境：从本文件的 PROMPT_ROLES 获取
    const rolesSource = typeof window !== 'undefined' ? window.PROMPT_ROLES : PROMPT_ROLES;
    
    const role = rolesSource[roleName];
    if (!role) {
        throw new Error(`未知的角色类型: ${roleName}`);
    }
    
    return {
        systemPrompt: role.systemPrompt,
        userPrompt: role.getUserPrompt(
            pageInfo.title,
            pageInfo.url,
            pageInfo.description,
            pageInfo.content
        )
    };
}

// 导出配置和函数
if (typeof module !== 'undefined' && module.exports) {
    // Node.js环境
    module.exports = {
        PROMPT_ROLES,
        getPromptForRole
    };
} else {
    // 浏览器环境：确保 window.PROMPT_ROLES 已初始化
    if (!window.PROMPT_ROLES) {
        window.PROMPT_ROLES = {};
    }
    window.getPromptForRole = getPromptForRole;
}


