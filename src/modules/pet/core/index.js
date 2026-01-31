/**
 * Pet Manager Core Module Index
 * 导出宠物管理器的核心模块
 */

// 核心管理器
import { PetManagerCore } from './PetManagerCore.js';
import { PetStateManager } from './PetStateManager.js';
import { PetEventManager } from './PetEventManager.js';

// 创建全局实例
const petManagerCore = new PetManagerCore();
const petStateManager = new PetStateManager();
const petEventManager = new PetEventManager();

// 导出实例和类
export {
    PetManagerCore,
    PetStateManager,
    PetEventManager,
    petManagerCore,
    petStateManager,
    petEventManager
};

// 默认导出
export default {
    PetManagerCore,
    PetStateManager,
    PetEventManager,
    petManagerCore,
    petStateManager,
    petEventManager
};