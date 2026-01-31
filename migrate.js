/**
 * Migration Script
 * 迁移脚本 - 自动迁移现有代码到新结构
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 迁移配置
 */
const MIGRATION_CONFIG = {
    // 源目录
    sourceDir: './src-old',
    
    // 目标目录
    targetDir: './src',
    
    // 文件映射
    fileMappings: {
        // 组件文件
        'components/Pet.js': 'modules/pet/ui/PetAvatar.js',
        'components/Chat.js': 'modules/chat/ui/ChatWindow.js',
        'components/Screenshot.js': 'modules/screenshot/ui/ScreenshotTool.js',
        'components/Mermaid.js': 'modules/mermaid/ui/MermaidEditor.js',
        'components/FAQ.js': 'modules/faq/ui/FAQList.js',
        'components/Session.js': 'modules/session/ui/SessionManager.js',
        
        // 工具文件
        'utils/api.js': 'shared/api/index.js',
        'utils/storage.js': 'shared/utils/storage/index.js',
        'utils/common.js': 'shared/utils/common/index.js',
        'utils/validation.js': 'shared/utils/validation/index.js',
        'utils/format.js': 'shared/utils/format/index.js',
        
        // 常量文件
        'constants.js': 'shared/constants/index.js',
        
        // 类型文件
        'types.js': 'shared/types/index.js',
        
        // 背景脚本
        'background.js': 'pages/background/index.js',
        'content.js': 'pages/content/index.js',
        'options.js': 'pages/options/index.js',
        'popup.js': 'pages/popup/index.js',
        
        // 主入口文件
        'index.js': 'app.js'
    },
    
    // 导入映射
    importMappings: {
        // 旧的导入 -> 新的导入
        "import Pet from './components/Pet'": "import { PetAvatar } from '../modules/pet/ui/index.js'",
        "import Chat from './components/Chat'": "import { ChatWindow } from '../modules/chat/ui/index.js'",
        "import { apiRequest } from './utils/api'": "import { APIClient } from '../shared/api/index.js'",
        "import { STORAGE_KEYS } from './constants'": "import { SharedConstants } from '../shared/constants/index.js'"
    },
    
    // 代码模式替换
    codeReplacements: [
        {
            pattern: /class\s+(\w+)\s+extends\s+Component/g,
            replacement: 'function $1()',
            description: '将类组件转换为函数组件'
        },
        {
            pattern: /this\.state\s*=\s*\{([^}]+)\}/g,
            replacement: 'const [$1State, set$1State] = useState({$1})',
            description: '将类组件状态转换为useState'
        },
        {
            pattern: /this\.props\./g,
            replacement: '',
            description: '移除this.props引用'
        },
        {
            pattern: /componentDidMount\(\)\s*\{([^}]+)\}/g,
            replacement: 'useEffect(() => {$1}, [])',
            description: '将componentDidMount转换为useEffect'
        },
        {
            pattern: /componentWillUnmount\(\)\s*\{([^}]+)\}/g,
            replacement: 'useEffect(() => { return () => {$1} }, [])',
            description: '将componentWillUnmount转换为useEffect清理函数'
        }
    ]
};

/**
 * 迁移器类
 */
class MigrationRunner {
    constructor(config) {
        this.config = config;
        this.stats = {
            totalFiles: 0,
            migratedFiles: 0,
            failedFiles: 0,
            warnings: []
        };
    }
    
    /**
     * 运行迁移
     */
    async run() {
        console.log('开始迁移现有代码...');
        console.log('迁移配置:', this.config);
        
        try {
            // 检查源目录
            await this.validateSourceDirectory();
            
            // 创建目标目录结构
            await this.createTargetStructure();
            
            // 迁移文件
            await this.migrateFiles();
            
            // 更新导入语句
            await this.updateImports();
            
            // 更新代码结构
            await this.updateCodeStructure();
            
            // 生成迁移报告
            const report = this.generateReport();
            
            console.log('迁移完成！');
            console.log('迁移报告:', report);
            
            return report;
            
        } catch (error) {
            console.error('迁移失败:', error);
            throw error;
        }
    }
    
    /**
     * 验证源目录
     */
    async validateSourceDirectory() {
        console.log('验证源目录...');
        
        const sourcePath = path.resolve(this.config.sourceDir);
        
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`源目录不存在: ${sourcePath}`);
        }
        
        console.log('源目录验证通过');
    }
    
    /**
     * 创建目标目录结构
     */
    async createTargetStructure() {
        console.log('创建目标目录结构...');
        
        const directories = [
            'modules/pet/core',
            'modules/pet/services',
            'modules/pet/hooks',
            'modules/pet/ui',
            'modules/pet/utils',
            'modules/pet/constants',
            'modules/pet/types',
            'modules/chat',
            'modules/screenshot',
            'modules/mermaid',
            'modules/faq',
            'modules/session',
            'shared/utils',
            'shared/constants',
            'shared/types',
            'shared/api',
            'pages/background',
            'pages/content',
            'pages/options',
            'pages/popup',
            'core',
            'config'
        ];
        
        for (const dir of directories) {
            const dirPath = path.resolve(this.config.targetDir, dir);
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
        
        console.log('目标目录结构创建完成');
    }
    
    /**
     * 迁移文件
     */
    async migrateFiles() {
        console.log('开始迁移文件...');
        
        for (const [sourceFile, targetFile] of Object.entries(this.config.fileMappings)) {
            await this.migrateFile(sourceFile, targetFile);
        }
        
        console.log(`文件迁移完成: ${this.stats.migratedFiles}/${this.stats.totalFiles}`);
    }
    
    /**
     * 迁移单个文件
     */
    async migrateFile(sourceFile, targetFile) {
        const sourcePath = path.resolve(this.config.sourceDir, sourceFile);
        const targetPath = path.resolve(this.config.targetDir, targetFile);
        
        this.stats.totalFiles++;
        
        try {
            if (!fs.existsSync(sourcePath)) {
                this.stats.warnings.push(`源文件不存在: ${sourceFile}`);
                return;
            }
            
            // 读取源文件内容
            const content = await fs.promises.readFile(sourcePath, 'utf8');
            
            // 备份原始文件
            await this.backupFile(sourcePath, content);
            
            // 处理文件内容
            const processedContent = await this.processFileContent(content, sourceFile);
            
            // 写入目标文件
            await fs.promises.writeFile(targetPath, processedContent);
            
            this.stats.migratedFiles++;
            console.log(`✓ 迁移文件: ${sourceFile} -> ${targetFile}`);
            
        } catch (error) {
            this.stats.failedFiles++;
            console.error(`✗ 迁移文件失败: ${sourceFile}`, error);
        }
    }
    
    /**
     * 备份文件
     */
    async backupFile(filePath, content) {
        const backupDir = path.resolve('./backups', path.dirname(filePath));
        const backupPath = path.resolve(backupDir, path.basename(filePath));
        
        await fs.promises.mkdir(backupDir, { recursive: true });
        await fs.promises.writeFile(backupPath, content);
    }
    
    /**
     * 处理文件内容
     */
    async processFileContent(content, filePath) {
        let processedContent = content;
        
        // 根据文件类型进行不同的处理
        if (filePath.endsWith('.js')) {
            processedContent = await this.processJavaScriptFile(processedContent);
        } else if (filePath.endsWith('.jsx')) {
            processedContent = await this.processReactFile(processedContent);
        } else if (filePath.endsWith('.css')) {
            processedContent = await this.processCSSFile(processedContent);
        }
        
        return processedContent;
    }
    
    /**
     * 处理JavaScript文件
     */
    async processJavaScriptFile(content) {
        let processedContent = content;
        
        // 应用代码替换规则
        for (const replacement of this.config.codeReplacements) {
            processedContent = processedContent.replace(
                replacement.pattern,
                replacement.replacement
            );
        }
        
        return processedContent;
    }
    
    /**
     * 处理React文件
     */
    async processReactFile(content) {
        let processedContent = content;
        
        // 添加必要的导入
        if (!processedContent.includes('useState')) {
            processedContent = "import { useState } from 'react';\n" + processedContent;
        }
        
        if (!processedContent.includes('useEffect')) {
            processedContent = "import { useEffect } from 'react';\n" + processedContent;
        }
        
        return processedContent;
    }
    
    /**
     * 处理CSS文件
     */
    async processCSSFile(content) {
        // CSS文件主要进行路径更新
        return content;
    }
    
    /**
     * 更新导入语句
     */
    async updateImports() {
        console.log('更新导入语句...');
        
        for (const [sourceFile, targetFile] of Object.entries(this.config.fileMappings)) {
            await this.updateFileImports(targetFile);
        }
        
        console.log('导入语句更新完成');
    }
    
    /**
     * 更新文件导入
     */
    async updateFileImports(filePath) {
        const fullPath = path.resolve(this.config.targetDir, filePath);
        
        try {
            let content = await fs.promises.readFile(fullPath, 'utf8');
            
            // 应用导入映射
            for (const [oldImport, newImport] of Object.entries(this.config.importMappings)) {
                content = content.replace(oldImport, newImport);
            }
            
            // 更新相对路径
            content = this.updateRelativePaths(content, filePath);
            
            await fs.promises.writeFile(fullPath, content);
            
        } catch (error) {
            console.error(`更新导入语句失败: ${filePath}`, error);
        }
    }
    
    /**
     * 更新相对路径
     */
    updateRelativePaths(content, currentFile) {
        // 这里需要根据文件的新位置更新相对导入路径
        // 这是一个简化的实现，实际需要更复杂的逻辑
        return content.replace(/\.\.\//g, '../../../');
    }
    
    /**
     * 更新代码结构
     */
    async updateCodeStructure() {
        console.log('更新代码结构...');
        
        // 这里可以添加更复杂的代码结构更新逻辑
        // 例如：将类组件转换为函数组件、添加错误处理等
        
        console.log('代码结构更新完成');
    }
    
    /**
     * 生成迁移报告
     */
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            summary: {
                success: this.stats.failedFiles === 0,
                totalFiles: this.stats.totalFiles,
                migratedFiles: this.stats.migratedFiles,
                failedFiles: this.stats.failedFiles,
                successRate: this.stats.totalFiles > 0 
                    ? (this.stats.migratedFiles / this.stats.totalFiles * 100).toFixed(2) + '%'
                    : '0%'
            },
            warnings: this.stats.warnings,
            recommendations: this.generateRecommendations()
        };
    }
    
    /**
     * 生成建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.stats.failedFiles > 0) {
            recommendations.push('检查失败的文件并手动修复');
        }
        
        if (this.stats.warnings.length > 0) {
            recommendations.push('处理迁移警告');
        }
        
        recommendations.push('运行测试确保功能正常');
        recommendations.push('更新文档和注释');
        recommendations.push('进行代码审查');
        
        return recommendations;
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        const runner = new MigrationRunner(MIGRATION_CONFIG);
        const report = await runner.run();
        
        console.log('\n=== 迁移报告 ===');
        console.log(JSON.stringify(report, null, 2));
        
    } catch (error) {
        console.error('迁移失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

// 导出迁移器
export { MigrationRunner, MIGRATION_CONFIG };