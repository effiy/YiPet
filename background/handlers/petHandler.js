/**
 * 宠物相关消息处理器
 * 处理宠物的注入、移除等操作
 */

/**
 * 处理注入宠物请求
 */
function handleInjectPet(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab.id;
    console.log('注入宠物到标签页:', tabId);
    
    // 使用注入服务
    const injectionService = typeof self !== 'undefined' && self.InjectionService 
        ? self.InjectionService 
        : null;
    
    if (injectionService) {
        injectionService.injectPetToTab(tabId);
    } else {
        // 降级方案：尝试调用全局函数（向后兼容）
        if (typeof injectPetToTab === 'function') {
            injectPetToTab(tabId);
        } else {
            console.error('无法注入宠物：InjectionService 未加载且 injectPetToTab 函数不存在');
        }
    }
    
    sendResponse({ success: true });
}

/**
 * 处理移除宠物请求
 */
function handleRemovePet(request, sender, sendResponse) {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
        sendResponse({ success: false, error: '无法获取标签页ID' });
        return;
    }
    
    // 使用注入服务
    const injectionService = typeof self !== 'undefined' && self.InjectionService 
        ? self.InjectionService 
        : null;
    
    if (injectionService) {
        injectionService.removePetFromTab(tabId);
    } else {
        // 降级方案：尝试调用全局函数（向后兼容）
        if (typeof removePetFromTab === 'function') {
            removePetFromTab(tabId);
        } else {
            console.error('无法移除宠物：InjectionService 未加载且 removePetFromTab 函数不存在');
        }
    }
    
    sendResponse({ success: true });
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

