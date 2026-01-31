/**
 * Pet AI Service
 * 处理与AI相关的交互逻辑
 */

class PetAIService {
    constructor() {
        this.currentModel = null;
        this.models = PET_CONFIG.chatModels || {};
        this.conversationHistory = [];
        this.maxHistoryLength = 100;
        this.isProcessing = false;
        this.rateLimiter = new Map();
        
        this.init();
    }

    init() {
        this.loadCurrentModel();
        this.setupRateLimiting();
    }

    // 加载当前模型配置
    loadCurrentModel() {
        const savedModel = localStorage.getItem('petCurrentModel');
        this.currentModel = savedModel || this.models.default || 'qwen3';
    }

    // 保存当前模型
    saveCurrentModel() {
        localStorage.setItem('petCurrentModel', this.currentModel);
    }

    // 设置限流
    setupRateLimiting() {
        // 清理过期的限流记录
        setInterval(() => {
            const now = Date.now();
            for (const [key, timestamp] of this.rateLimiter.entries()) {
                if (now - timestamp > 60 * 1000) { // 1分钟过期
                    this.rateLimiter.delete(key);
                }
            }
        }, 30 * 1000); // 每30秒清理一次
    }

    // 检查限流
    checkRateLimit(identifier = 'default') {
        const now = Date.now();
        const key = `${identifier}_${this.currentModel}`;
        const lastRequest = this.rateLimiter.get(key);
        
        if (lastRequest) {
            const timeDiff = now - lastRequest;
            const minInterval = this.getModelConfig('rateLimitInterval', 1000); // 默认1秒
            
            if (timeDiff < minInterval) {
                return {
                    allowed: false,
                    remainingTime: minInterval - timeDiff
                };
            }
        }
        
        return { allowed: true, remainingTime: 0 };
    }

    // 记录请求时间
    recordRequest(identifier = 'default') {
        const key = `${identifier}_${this.currentModel}`;
        this.rateLimiter.set(key, Date.now());
    }

    // 获取模型配置
    getModelConfig(key, defaultValue = null) {
        const modelConfig = this.models[this.currentModel];
        if (!modelConfig) {
            return defaultValue;
        }
        
        return modelConfig[key] !== undefined ? modelConfig[key] : defaultValue;
    }

    // 发送AI请求
    async sendMessage(message, options = {}) {
        // 检查限流
        const rateLimit = this.checkRateLimit(options.identifier);
        if (!rateLimit.allowed) {
            throw new Error(`请求过于频繁，请等待 ${Math.ceil(rateLimit.remainingTime / 1000)} 秒`);
        }

        if (this.isProcessing) {
            throw new Error('AI正在处理其他请求，请稍后再试');
        }

        this.isProcessing = true;
        
        try {
            // 记录请求时间
            this.recordRequest(options.identifier);
            
            // 构建请求数据
            const requestData = this.buildRequestData(message, options);
            
            // 调用AI API
            const response = await this.callAIAPI(requestData);
            
            // 处理响应
            const result = await this.processAIResponse(response);
            
            // 更新对话历史
            this.updateConversationHistory(message, result);
            
            return result;
            
        } catch (error) {
            console.error('[PetAIService] AI请求失败:', error);
            throw this.handleAIError(error);
        } finally {
            this.isProcessing = false;
        }
    }

    // 构建请求数据
    buildRequestData(message, options) {
        const modelConfig = this.models[this.currentModel];
        if (!modelConfig) {
            throw new Error(`模型 ${this.currentModel} 配置不存在`);
        }

        // 构建系统提示
        const systemPrompt = this.buildSystemPrompt(options);
        
        // 构建对话历史
        const conversationContext = this.buildConversationContext(options);
        
        return {
            model: this.currentModel,
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversationContext,
                { role: 'user', content: message }
            ],
            temperature: options.temperature || modelConfig.temperature || 0.7,
            max_tokens: options.maxTokens || modelConfig.maxTokens || 1000,
            stream: options.stream || false
        };
    }

    // 构建系统提示
    buildSystemPrompt(options) {
        const role = options.role || '教师';
        const roleConfig = PET_CONFIG.roles[role];
        
        if (!roleConfig) {
            return '你是一个智能助手，请友好地回答用户的问题。';
        }

        return `${roleConfig.personality}

角色特点：
${roleConfig.traits.join('\n')}

回答风格：
${roleConfig.style}

请注意：
1. 保持角色一致性
2. 回答要温柔体贴
3. 适当使用表情符号
4. 避免使用过于专业的术语`;
    }

    // 构建对话上下文
    buildConversationContext(options) {
        const maxContextMessages = options.maxContextMessages || 10;
        const recentHistory = this.conversationHistory.slice(-maxContextMessages);
        
        return recentHistory.map(item => ({
            role: item.role,
            content: item.content
        }));
    }

    // 调用AI API
    async callAIAPI(requestData) {
        const apiEndpoint = this.getModelConfig('apiEndpoint');
        if (!apiEndpoint) {
            throw new Error('AI API端点未配置');
        }

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.getAuthHeader()
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`AI API错误: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    // 处理AI响应
    async processAIResponse(response) {
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'AI处理错误');
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('AI响应格式错误');
        }

        return {
            content,
            model: data.model,
            usage: data.usage,
            finishReason: data.choices[0].finish_reason
        };
    }

    // 更新对话历史
    updateConversationHistory(userMessage, aiResponse) {
        // 添加用户消息
        this.conversationHistory.push({
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
        });

        // 添加AI响应
        this.conversationHistory.push({
            role: 'assistant',
            content: aiResponse.content,
            timestamp: Date.now()
        });

        // 限制历史长度
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }

        // 保存到存储
        this.saveConversationHistory();
    }

    // 保存对话历史
    saveConversationHistory() {
        try {
            localStorage.setItem('petConversationHistory', JSON.stringify(this.conversationHistory));
        } catch (error) {
            console.error('[PetAIService] 保存对话历史失败:', error);
        }
    }

    // 加载对话历史
    loadConversationHistory() {
        try {
            const saved = localStorage.getItem('petConversationHistory');
            if (saved) {
                this.conversationHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[PetAIService] 加载对话历史失败:', error);
            this.conversationHistory = [];
        }
    }

    // 处理AI错误
    handleAIError(error) {
        let errorMessage = 'AI服务暂时不可用，请稍后再试';
        
        if (error.message.includes('rate limit')) {
            errorMessage = '请求过于频繁，请稍后再试';
        } else if (error.message.includes('network')) {
            errorMessage = '网络连接错误，请检查网络连接';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'AI响应超时，请稍后再试';
        } else if (error.message.includes('quota')) {
            errorMessage = 'AI服务配额已用完，请稍后再试';
        }

        return new Error(errorMessage);
    }

    // 获取认证头
    getAuthHeader() {
        const apiKey = this.getModelConfig('apiKey');
        if (apiKey) {
            return `Bearer ${apiKey}`;
        }
        return '';
    }

    // 切换模型
    async switchModel(modelName) {
        if (!this.models[modelName]) {
            throw new Error(`模型 ${modelName} 不存在`);
        }

        this.currentModel = modelName;
        this.saveCurrentModel();
        
        console.log(`[PetAIService] 切换到模型: ${modelName}`);
    }

    // 获取可用模型
    getAvailableModels() {
        return Object.keys(this.models).filter(model => 
            this.models[model].enabled !== false
        );
    }

    // 清除对话历史
    clearConversationHistory() {
        this.conversationHistory = [];
        this.saveConversationHistory();
        
        console.log('[PetAIService] 对话历史已清除');
    }

    // 获取对话历史
    getConversationHistory(limit = null) {
        if (limit) {
            return this.conversationHistory.slice(-limit);
        }
        return [...this.conversationHistory];
    }

    // 获取AI服务状态
    getServiceStatus() {
        return {
            currentModel: this.currentModel,
            isProcessing: this.isProcessing,
            conversationHistoryLength: this.conversationHistory.length,
            availableModels: this.getAvailableModels(),
            modelConfig: this.getModelConfig()
        };
    }
}

// 创建全局实例
window.PetAIService = PetAIService;

// 防止重复初始化
if (typeof window.petAIService === 'undefined') {
    window.petAIService = new PetAIService();
}