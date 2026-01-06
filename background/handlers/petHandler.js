/**
 * 宠物相关消息处理器
 * 处理宠物的注入、移除等操作
 */

/**
 * 获取注入服务实例
 * @returns {InjectionService|null} 注入服务实例或null
 */
function getInjectionService() {
    if (typeof self !== 'undefined' && self.InjectionService) {
        return self.InjectionService;
    }
    return null;
}

/**
 * 执行注入操作（带降级方案）
 * @param {number} tabId - 标签页ID
 * @param {Function} serviceMethod - 服务方法名（字符串）或方法引用
 * @param {Function} fallbackFunction - 降级函数（可选）
 * @param {string} errorMessage - 错误消息
 */
function executeInjection(tabId, serviceMethod, fallbackFunction, errorMessage) {
    const injectionService = getInjectionService();
    
    if (injectionService) {
        const method = typeof serviceMethod === 'string' 
            ? injectionService[serviceMethod] 
            : serviceMethod;
        
        if (typeof method === 'function') {
            method.call(injectionService, tabId);
            return true;
        }
    }
    
    // 降级方案：尝试调用全局函数（向后兼容）
    if (fallbackFunction && typeof fallbackFunction === 'function') {
        fallbackFunction(tabId);
        return true;
    }
    
    console.error(errorMessage);
    return false;
}

/**
 * 处理注入宠物请求
 */
function handleInjectPet(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab?.id;
    if (!tabId) {
        sendResponse({ success: false, error: '无法获取标签页ID' });
        return;
    }
    
    console.log('注入宠物到标签页:', tabId);
    
    const success = executeInjection(
        tabId,
        'injectPetToTab',
        typeof injectPetToTab === 'function' ? injectPetToTab : null,
        '无法注入宠物：InjectionService 未加载且 injectPetToTab 函数不存在'
    );
    
    sendResponse({ success });
}

/**
 * 处理移除宠物请求
 */
function handleRemovePet(request, sender, sendResponse) {
    const tabId = sender.tab?.id;
    if (!tabId) {
        sendResponse({ success: false, error: '无法获取标签页ID' });
        return;
    }
    
    const success = executeInjection(
        tabId,
        'removePetFromTab',
        typeof removePetFromTab === 'function' ? removePetFromTab : null,
        '无法移除宠物：InjectionService 未加载且 removePetFromTab 函数不存在'
    );
    
    sendResponse({ success });
}

// 导出处理器
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        handleInjectPet,
        handleRemovePet
    };
} else {
    if (typeof self !== "undefined") {
        self.PetHandler = {
            handleInjectPet,
            handleRemovePet
        };
    }
}


