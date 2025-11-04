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
    
    // 检查JSZip是否已加载
    if (typeof JSZip === 'undefined' && !window.JSZip) {
        window.dispatchEvent(new CustomEvent('jszip-export-error', { 
            detail: { error: 'JSZip未加载' } 
        }));
        return;
    }
    
    const JSZipLib = window.JSZip || JSZip;
    const zip = new JSZipLib();
    
    // 添加文件到ZIP
    exportData.forEach(function(item) {
        const filePath = item.dateInfo.year + '/' + item.dateInfo.quarter + '/' + 
                        item.dateInfo.month + '/' + item.dateInfo.week + '/' + 
                        item.dateInfo.day + '/' + item.title + '/';
        zip.file(filePath + 'context.md', item.contextMd);
        zip.file(filePath + 'chat.md', item.chatMd);
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
        a.download = '会话导出_' + new Date().toISOString().slice(0, 10) + '.zip';
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


