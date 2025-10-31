const fs = require('fs');

// 读取文件
const content = fs.readFileSync('content.js', 'utf8');

// 创建通用的替换函数
function replaceMethod(methodName, roleName, description) {
    const oldPattern = new RegExp(
        `async ${methodName}\\(onContent\\) \\{[\\s\\S]*?const pageTitle = document\\.title \\|\\| '当前页面';[\\s\\S]*?const pageUrl = window\\.location\\.href;[\\s\\S]*?const metaDescription = document\\.querySelector\\('meta\\[name="description"\\]'\\);?[\\s\\S]*?const pageDescription = metaDescription \\? metaDescription\\.content : '';?[\\s\\S]*?let pageContent = this\\.getPageContentAsMarkdown\\(\\);?[\\s\\S]*?if \\(pageContent\\.length > 102400\\) \\{[\\s\\S]*?pageContent = pageContent\\.substring\\(0, 102400\\);?[\\s\\S]*?\\}?[\\s\\S]*?// 构建提示词[\\s\\S]*?const systemPrompt = \`[\\s\\S]*?\`;[\\s\\S]*?const userPrompt = \\`[\\s\\S]*?\\`;[\\s\\S]*?console\\.log\\('调用大模型生成${description}，页面标题:', pageTitle\\);?[\\s\\S]*?const apiUrl = PET_CONFIG\\.api\\.streamPromptUrl;[\\s\\S]*?const response = await fetch\\(apiUrl, [\\s\\S]*?body: JSON\\.stringify\\(\\{[\\s\\S]*?fromSystem: systemPrompt,[\\s\\S]*?fromUser: userPrompt,[\\s\\S]*?model: this\\.currentModel[\\s\\S]*?\\}\\)[\\s\\S]*?\\}\\);?[\\s\\S]*?if \\(!response\\.ok\\) \\{[\\s\\S]*?throw new Error\\(\\`HTTP \\$\\{response\\.status\\}\\`\\);?[\\s\\S]*?\\}[\\s\\S]*?const reader = response\\.body\\.getReader\\(\\);?[\\s\\S]*?const decoder = new TextDecoder\\(\\);?[\\s\\S]*?let buffer = '';[\\s\\S]*?let fullContent = '';[\\s\\S]*?while \\(true\\) \\{[\\s\\S]*?const \\{ done, value \\} = await reader\\.read\\(\\);?[\\s\\S]*?if \\(done\\) \\{[\\s\\S]*?break;[\\s\\S]*?\\}[\\s\\S]*?buffer \\+= decoder\\.decode\\(value, \\{ stream: true \\}\\);?[\\s\\S]*?const messages = buffer\\.split\\('\\\\n\\\\n'\\);?[\\s\\S]*?buffer = messages\\.pop\\(\\) \\|\\| '';[\\s\\S]*?for \\(const message of messages\\) \\{[\\s\\S]*?if \\(message\\.startsWith\\('data: '\\\\) \\) \\{[\\s\\S]*?try \\{[\\s\\S]*?const dataStr = message\\.substring\\(6\\);?[\\s\\S]*?const chunk = JSON\\.parse\\(dataStr\\);?[\\s\\S]*?if \\(chunk\\.message && chunk\\.message\\.content\\) \\{[\\s\\S]*?fullContent \\+= chunk\\.message\\.content;[\\s\\S]*?if \\(onContent\\) \\{[\\s\\S]*?onContent\\(chunk\\.message\\.content, fullContent\\);?[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?else if \\(chunk\\.type === 'content'\\) \\{[\\s\\S]*?fullContent \\+= chunk\\.data;[\\s\\S]*?if \\(onContent\\) \\{[\\s\\S]*?onContent\\(chunk\\.data, fullContent\\);?[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?else if \\(chunk\\.done === true\\) \\{[\\s\\S]*?console\\.log\\('流式响应完成'\\);?[\\s\\S]*?\\}[\\s\\S]*?else if \\(chunk\\.type === 'error' \\|\\| chunk\\.error\\) \\{[\\s\\S]*?console\\.error\\('流式响应错误:', chunk\\.data \\|\\| chunk\\.error\\);?[\\s\\S]*?throw new Error\\(chunk\\.data \\|\\| chunk\\.error \\|\\| '未知错误'\\);?[\\s\\S]*?\\}[\\s\\S]*?\\} catch \\(e\\) \\{[\\s\\S]*?console\\.warn\\('解析 SSE 消息失败:', message, e\\);?[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?if \\(buffer\\.trim\\(\\)\\) \\{[\\s\\S]*?const message = buffer\\.trim\\(\\);?[\\s\\S]*?if \\(message\\.startsWith\\('data: '\\\\) \\{ [\\s\\S]*?try \\{[\\s\\S]*?const chunk = JSON\\.parse\\(message\\.substring\\(6\\)\\);?[\\s\\S]*?if \\(chunk\\.done === true \\|\\| chunk\\.type === 'done'\\) \\{[\\s\\S]*?console\\.log\\('流式响应完成'\\);?[\\s\\S]*?\\} else if \\(chunk\\.type === 'error' \\|\\| chunk\\.error\\) \\{[\\s\\S]*?throw new Error\\(chunk\\.data \\|\\| chunk\\.error \\|\\| '未知错误'\\);?[\\s\\S]*?\\}[\\s\\S]*?\\} catch \\(e\\) \\{[\\s\\S]*?console\\.warn\\('解析最后的 SSE 消息失败:', message, e\\);?[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?return fullContent;[\\s\\S]*?\\} catch \\(error\\) \\{[\\s\\S]*?console\\.error\\('生成${description}失败:', error\\);?[\\s\\S]*?throw error;[\\s\\S]*?\\}[\\s\\S]*?\\}`,
        'g'
    );
    
    const newCode = `async ${methodName}(onContent) {
        try {
            // 获取页面信息
            const pageInfo = this.getPageInfo();
            
            // 从角色配置获取提示词
            const prompts = await this.getRolePromptForAction('${roleName}', pageInfo);
            
            console.log('调用大模型生成${description}，页面标题:', pageInfo.title);
            
            // 调用大模型 API（使用流式接口）
            const apiUrl = PET_CONFIG.api.streamPromptUrl;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fromSystem: prompts.systemPrompt,
                    fromUser: prompts.userPrompt,
                    model: this.currentModel
                })
            });
            
            // 使用通用的流式响应处理
            return await this.processStreamingResponse(response, onContent);
        } catch (error) {
            console.error('生成${description}失败:', error);
            throw error;
        }
    }`;
    
    return content.replace(oldPattern, newCode);
}

// 执行替换
let updated = content;
// updated = replaceMethod('generateFlashcardStream', 'flashcard', '闪卡');
// updated = replaceMethod('generateReportStream', 'report', '专项报告');
// updated = replaceMethod('generateBestPracticeStream', 'bestPractice', '最佳实践');

// 保存文件
// fs.writeFileSync('content.js', updated, 'utf8');
console.log('完成！');

