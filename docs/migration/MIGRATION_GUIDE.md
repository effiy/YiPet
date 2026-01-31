/**
 * Migration Guide for Existing Code
 * 现有代码迁移指南
 */

/**
 * 迁移概述
 * 
 * 本指南帮助你将现有代码迁移到新的模块化结构中。
 * 新的结构采用功能模块化设计，每个功能模块包含：
 * - core/ - 核心逻辑
 * - services/ - 业务服务
 * - hooks/ - React Hooks
 * - ui/ - UI组件
 * - utils/ - 工具函数
 * - constants/ - 常量定义
 * - types/ - 类型定义
 */

/**
 * 1. 文件路径映射
 */
const PATH_MAPPINGS = {
    // 原有路径 -> 新路径映射
    'src/components/Pet.js': 'src/modules/pet/ui/PetAvatar.js',
    'src/components/Chat.js': 'src/modules/chat/ui/ChatWindow.js',
    'src/components/Screenshot.js': 'src/modules/screenshot/ui/ScreenshotTool.js',
    'src/components/Mermaid.js': 'src/modules/mermaid/ui/MermaidEditor.js',
    'src/components/FAQ.js': 'src/modules/faq/ui/FAQList.js',
    'src/components/Session.js': 'src/modules/session/ui/SessionManager.js',
    
    'src/utils/api.js': 'src/shared/api/index.js',
    'src/utils/storage.js': 'src/shared/utils/storage/index.js',
    'src/utils/common.js': 'src/shared/utils/common/index.js',
    
    'src/constants.js': 'src/shared/constants/index.js',
    'src/types.js': 'src/shared/types/index.js',
    
    'src/background.js': 'src/pages/background/index.js',
    'src/content.js': 'src/pages/content/index.js',
    'src/options.js': 'src/pages/options/index.js',
    'src/popup.js': 'src/pages/popup/index.js'
};

/**
 * 2. 导入语句更新示例
 */

// 旧的导入方式
import Pet from './components/Pet.js';
import Chat from './components/Chat.js';
import { apiRequest } from './utils/api.js';
import { STORAGE_KEYS } from './constants.js';

// 新的导入方式
import { PetModule } from '../modules/pet/index.js';
import { ChatModule } from '../modules/chat/index.js';
import { SharedAPI } from '../shared/api/index.js';
import { SharedConstants } from '../shared/constants/index.js';

// 或者使用解构导入具体功能
import { PetAvatar } from '../modules/pet/ui/index.js';
import { ChatWindow } from '../modules/chat/ui/index.js';
import { APIClient } from '../shared/api/index.js';
import { STORAGE_KEYS } from '../shared/constants/index.js';

/**
 * 3. 代码重构示例
 */

// 旧的代码结构
class OldPetManager {
    constructor() {
        this.pet = null;
        this.position = { x: 0, y: 0 };
        this.color = '#FF6B6B';
    }
    
    createPet() {
        // 直接操作DOM
        const petElement = document.createElement('div');
        petElement.className = 'pet';
        petElement.style.backgroundColor = this.color;
        document.body.appendChild(petElement);
        this.pet = petElement;
    }
    
    movePet(x, y) {
        if (this.pet) {
            this.pet.style.left = x + 'px';
            this.pet.style.top = y + 'px';
            this.position = { x, y };
        }
    }
}

// 新的代码结构
import { PetManagerCore } from '../modules/pet/core/PetManagerCore.js';
import { PetStateManager } from '../modules/pet/core/PetStateManager.js';
import { PetAvatar } from '../modules/pet/ui/PetAvatar.js';

class NewPetManager {
    constructor() {
        this.core = new PetManagerCore();
        this.stateManager = new PetStateManager();
        this.avatar = null;
    }
    
    async init() {
        // 使用状态管理器
        await this.stateManager.init();
        
        // 创建头像组件
        this.avatar = new PetAvatar({
            size: 80,
            animated: true
        });
        
        // 监听状态变化
        this.stateManager.subscribe('position', (position) => {
            this.core.updatePosition(position);
        });
    }
    
    async createPet() {
        // 使用核心管理器创建宠物
        const petData = await this.core.createPet({
            color: '#FF6B6B',
            position: { x: 0, y: 0 }
        });
        
        // 更新状态
        this.stateManager.setState('pet', petData);
    }
    
    async movePet(x, y) {
        // 更新状态，UI自动响应
        await this.stateManager.setState('position', { x, y });
    }
}

/**
 * 4. 状态管理迁移
 */

// 旧的状态管理（直接操作）
let globalState = {
    pet: { visible: true, position: { x: 0, y: 0 } },
    chat: { open: false, messages: [] }
};

function updateState(key, value) {
    globalState[key] = value;
    // 手动触发更新
    notifyListeners(key, value);
}

// 新的状态管理（使用状态管理器）
import { PetStateManager } from '../modules/pet/core/PetStateManager.js';
import { ChatStateManager } from '../modules/chat/core/ChatStateManager.js';

// 创建状态管理器实例
const petStateManager = new PetStateManager();
const chatStateManager = new ChatStateManager();

// 初始化状态管理器
await petStateManager.init();
await chatStateManager.init();

// 使用状态管理器
await petStateManager.setState('visible', true);
await petStateManager.setState('position', { x: 100, y: 200 });

await chatStateManager.setState('open', true);
await chatStateManager.addMessage({ text: 'Hello', role: 'user' });

/**
 * 5. 事件系统迁移
 */

// 旧的事件系统（简单的事件监听）
const eventListeners = {};

function addEventListener(event, callback) {
    if (!eventListeners[event]) {
        eventListeners[event] = [];
    }
    eventListeners[event].push(callback);
}

function dispatchEvent(event, data) {
    if (eventListeners[event]) {
        eventListeners[event].forEach(callback => callback(data));
    }
}

// 新的事件系统（使用事件管理器）
import { PetEventManager } from '../modules/pet/core/PetEventManager.js';
import { ChatEventManager } from '../modules/chat/core/ChatEventManager.js';

// 创建事件管理器实例
const petEventManager = new PetEventManager();
const chatEventManager = new ChatEventManager();

// 监听事件
petEventManager.on('pet:position:changed', (position) => {
    console.log('宠物位置已改变:', position);
});

chatEventManager.on('chat:message:sent', (message) => {
    console.log('消息已发送:', message);
});

// 触发事件
petEventManager.emit('pet:position:changed', { x: 100, y: 200 });
chatEventManager.emit('chat:message:sent', { text: 'Hello', role: 'user' });

/**
 * 6. 组件迁移示例
 */

// 旧的React组件
function OldPetComponent({ position, color, onClick }) {
    return (
        <div 
            className="pet"
            style={{ 
                position: 'absolute',
                left: position.x,
                top: position.y,
                backgroundColor: color 
            }}
            onClick={onClick}
        >
            🐱
        </div>
    );
}

// 新的React组件（使用Hooks）
import { usePetState } from '../modules/pet/hooks/usePetState.js';
import { usePetDrag } from '../modules/pet/hooks/usePetDrag.js';
import { PetAvatar } from '../modules/pet/ui/PetAvatar.js';

function NewPetComponent() {
    const [position] = usePetState('position');
    const [color] = usePetState('color');
    const [isDragging] = usePetDrag();
    
    return (
        <div className="pet-container">
            <PetAvatar 
                size={80}
                animated={!isDragging}
            />
            <div className="pet-position">
                位置: ({position.x}, {position.y})
            </div>
        </div>
    );
}

/**
 * 7. 工具函数迁移
 */

// 旧的工具函数
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// 新的工具函数（使用共享工具）
import { SharedUtils } from '../shared/utils/index.js';

// 使用时间工具
const formattedTime = SharedUtils.formatTime(timestamp);
const relativeTime = SharedUtils.getRelativeTime(timestamp);

// 使用ID生成工具
const uniqueId = SharedUtils.generateUniqueId();
const sessionId = SharedUtils.generateSessionId();

/**
 * 8. API调用迁移
 */

// 旧的API调用
function oldApiCall(endpoint, data) {
    return fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .catch(error => {
        console.error('API调用失败:', error);
        throw error;
    });
}

// 新的API调用（使用API客户端）
import { SharedAPI } from '../shared/api/index.js';

// 创建API客户端
const apiClient = new SharedAPI.APIClient({
    baseURL: 'https://api.yipet.com',
    timeout: 30000
});

// 使用API客户端
const response = await apiClient.post(`/api/${endpoint}`, data);

// 或者使用工具函数
const result = await SharedAPI.createRequest({
    url: `/api/${endpoint}`,
    method: 'POST',
    data: data,
    timeout: 30000
});

/**
 * 9. 迁移检查清单
 */

const MIGRATION_CHECKLIST = {
    // 基础检查
    imports: {
        description: '检查所有导入语句是否更新',
        items: [
            '模块导入使用新的路径',
            '工具函数导入使用共享工具',
            '常量导入使用共享常量'
        ]
    },
    
    // 状态管理
    stateManagement: {
        description: '检查状态管理是否迁移',
        items: [
            '使用状态管理器替代全局变量',
            '状态更新通过管理器进行',
            'UI组件响应状态变化'
        ]
    },
    
    // 事件系统
    eventSystem: {
        description: '检查事件系统是否迁移',
        items: [
            '使用事件管理器替代简单事件',
            '事件命名遵循规范',
            '事件监听器正确注册和销毁'
        ]
    },
    
    // 组件结构
    componentStructure: {
        description: '检查组件结构是否符合新规范',
        items: [
            '组件文件放在对应模块的ui目录',
            '使用Hooks替代类组件',
            '组件props定义清晰'
        ]
    },
    
    // 工具函数
    utilities: {
        description: '检查工具函数是否迁移',
        items: [
            '通用工具函数移到共享工具',
            '模块特定工具函数放在模块内',
            '工具函数有适当的测试'
        ]
    },
    
    // API调用
    apiCalls: {
        description: '检查API调用是否迁移',
        items: [
            '使用API客户端替代fetch',
            '错误处理完善',
            '请求有适当的超时设置'
        ]
    }
};

/**
 * 10. 迁移工具
 */

export class MigrationHelper {
    constructor() {
        this.checklist = MIGRATION_CHECKLIST;
        this.results = {};
    }
    
    /**
     * 运行迁移检查
     */
    async runChecks() {
        console.log('开始迁移检查...');
        
        for (const [category, config] of Object.entries(this.checklist)) {
            console.log(`检查 ${category}: ${config.description}`);
            
            const results = await this.checkCategory(category, config);
            this.results[category] = results;
            
            console.log(`${category} 检查结果:`, results);
        }
        
        return this.results;
    }
    
    /**
     * 检查特定类别
     */
    async checkCategory(category, config) {
        const results = {
            passed: [],
            failed: [],
            warnings: []
        };
        
        // 这里可以添加具体的检查逻辑
        // 例如：扫描文件、分析代码、检查依赖等
        
        for (const item of config.items) {
            const result = await this.checkItem(category, item);
            
            if (result.status === 'passed') {
                results.passed.push(item);
            } else if (result.status === 'failed') {
                results.failed.push({ item, reason: result.reason });
            } else if (result.status === 'warning') {
                results.warnings.push({ item, reason: result.reason });
            }
        }
        
        return results;
    }
    
    /**
     * 检查特定项目
     */
    async checkItem(category, item) {
        // 这里添加具体的检查逻辑
        // 返回 { status: 'passed' | 'failed' | 'warning', reason?: string }
        
        return { status: 'passed' };
    }
    
    /**
     * 生成迁移报告
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            },
            details: this.results
        };
        
        // 计算统计信息
        for (const category of Object.values(this.results)) {
            report.summary.total += category.passed.length + category.failed.length + category.warnings.length;
            report.summary.passed += category.passed.length;
            report.summary.failed += category.failed.length;
            report.summary.warnings += category.warnings.length;
        }
        
        return report;
    }
}

// 导出迁移工具
export { MigrationHelper };