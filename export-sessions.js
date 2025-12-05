// 在页面上下文中执行导出会话的脚本
(function() {
    'use strict';
    
    // 从 data 属性中获取导出数据
    const dataContainer = document.getElementById('__jszip_export_data__');
    if (!dataContainer) {
        window.dispatchEvent(new CustomEvent('jszip-export-error', { 
            detail: { error: '无法获取导出数据' } 
        }));
        return;
    }
    
    let exportData;
    try {
        exportData = JSON.parse(dataContainer.getAttribute('data-export'));
    } catch (e) {
        window.dispatchEvent(new CustomEvent('jszip-export-error', { 
            detail: { error: '导出数据格式错误' } 
        }));
        return;
    }
    
    // 获取导出类型（默认为会话）
    const exportType = dataContainer.getAttribute('data-export-type') || 'session';
    
    // 检查JSZip是否已加载
    if (typeof JSZip === 'undefined' && !window.JSZip) {
        window.dispatchEvent(new CustomEvent('jszip-export-error', { 
            detail: { error: 'JSZip未加载' } 
        }));
        return;
    }
    
    const JSZipLib = window.JSZip || JSZip;
    const zip = new JSZipLib();
    
    // 清理路径中的非法字符
    function sanitizePath(path) {
        return path.replace(/[<>:"|?*\x00-\x1f]/g, '_').trim();
    }
    
    // 用于跟踪已使用的文件路径，避免文件名冲突
    const usedPaths = new Map();
    
    // 添加文件到ZIP
    exportData.forEach(function(item, index) {
        // 获取标签数组，如果没有标签则使用"未分类"
        const tags = item.tags && Array.isArray(item.tags) && item.tags.length > 0 
            ? item.tags 
            : ['未分类'];
        
        // 按标签顺序建立目录层次
        // 每个标签作为一层目录
        let filePath = '';
        tags.forEach(function(tag) {
            const sanitizedTag = sanitizePath(tag);
            filePath += sanitizedTag + '/';
        });
        
        // 文件名为页面标题.md
        const baseFileName = sanitizePath(item.title || '未命名会话');
        let fileName = baseFileName + '.md';
        let fullPath = filePath + fileName;
        
        // 处理文件名冲突：如果路径已存在，添加序号
        if (usedPaths.has(fullPath)) {
            let counter = 1;
            do {
                fileName = baseFileName + '_' + counter + '.md';
                fullPath = filePath + fileName;
                counter++;
            } while (usedPaths.has(fullPath));
        }
        
        // 记录已使用的路径
        usedPaths.set(fullPath, true);
        
        // 添加文件，内容为页面上下文
        zip.file(fullPath, item.pageContent || '');
    });
    
    // 生成ZIP文件
    zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    }).then(function(blob) {
        // 在页面上下文中触发下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 根据导出类型生成不同的文件名
        let fileNamePrefix = '会话导出_';
        if (exportType === 'news') {
            fileNamePrefix = '新闻导出_';
        } else if (exportType === 'apiRequest') {
            fileNamePrefix = '请求接口导出_';
        }
        a.download = fileNamePrefix + new Date().toISOString().slice(0, 10) + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.dispatchEvent(new CustomEvent('jszip-export-success', { 
            detail: { count: exportData.length } 
        }));
    }).catch(function(error) {
        window.dispatchEvent(new CustomEvent('jszip-export-error', { 
            detail: { error: error.message || '导出失败' } 
        }));
    });
})();


