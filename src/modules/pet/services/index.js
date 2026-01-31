/**
 * Pet Services Module Index
 * 导出宠物相关的服务模块
 */

import { PetAuthService, petAuthService } from './PetAuthService.js';
import { PetAIService, petAIService } from './PetAIService.js';

// 导出服务和实例
export {
    PetAuthService,
    PetAIService,
    petAuthService,
    petAIService
};

// 默认导出
export default {
    PetAuthService,
    PetAIService,
    petAuthService,
    petAIService
};