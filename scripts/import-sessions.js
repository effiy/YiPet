// 在页面上下文中执行导入会话的脚本
(function() {
    'use strict';
    
    // 从 data 属性中获取导入数据
    const dataContainer = document.getElementById('__jszip_import_data__');
    if (!dataContainer) {
        window.dispatchEvent(new CustomEvent('jszip-import-error', { 
            detail: { error: '无法获取导入数据' } 
        }));
        return;
    }
    
    let zipData;
    try {
        zipData = dataContainer.getAttribute('data-import');
    } catch (e) {
        window.dispatchEvent(new CustomEvent('jszip-import-error', { 
            detail: { error: '导入数据格式错误' } 
        }));
        return;
    }
    
    // 检查JSZip是否已加载
    if (typeof JSZip === 'undefined' && !window.JSZip) {
        window.dispatchEvent(new CustomEvent('jszip-import-error', { 
            detail: { error: 'JSZip未加载' } 
        }));
        return;
    }
    
    const JSZipLib = window.JSZip || JSZip;
    
    // 将base64数据转换为ArrayBuffer
    function base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    // 解析zip文件
    try {
        const arrayBuffer = base64ToArrayBuffer(zipData);
        JSZipLib.loadAsync(arrayBuffer).then(function(zip) {
            // 收集所有.md文件
            const mdFiles = [];
            zip.forEach(function(relativePath, file) {
                // 只处理.md文件
                if (!relativePath.endsWith('.md')) {
                    return;
                }
                
                // 跳过 macOS 系统创建的隐藏文件（以 ._ 开头）
                const pathParts = relativePath.split('/');
                const hasHiddenFile = pathParts.some(part => part.startsWith('._'));
                if (hasHiddenFile) {
                    return;
                }
                
                // 解析路径，获取标签和文件名
                const filteredPathParts = pathParts.filter(part => part.length > 0 && !part.startsWith('._'));
                if (filteredPathParts.length === 0) {
                    return;
                }
                
                // 最后一个部分是文件名（去掉.md扩展名）
                const fileName = filteredPathParts[filteredPathParts.length - 1];
                // 跳过以 ._ 开头的文件名
                if (fileName.startsWith('._')) {
                    return;
                }
                const title = fileName.replace(/\.md$/, '');
                
                // 前面的部分都是标签（目录层次），过滤掉 ._ 开头的目录
                // 第一个目录不算入标签，从第二个目录开始作为标签
                let tags = filteredPathParts.slice(1, -1).filter(tag => !tag.startsWith('._'));
                
                // 过滤掉"未分类"标签，根目录和"未分类"目录的文件不需要标签
                tags = tags.filter(tag => tag !== '未分类');
                
                mdFiles.push({
                    file: file,
                    tags: tags, // 根目录和"未分类"目录的文件 tags 为空数组
                    title: title
                });
            });
            
            // 如果没有找到任何.md文件
            if (mdFiles.length === 0) {
                window.dispatchEvent(new CustomEvent('jszip-import-error', { 
                    detail: { error: 'ZIP文件中没有找到.md文件' } 
                }));
                return;
            }
            
            // 并行读取所有文件内容
            const readPromises = mdFiles.map(function(item) {
                return item.file.async('string').then(function(content) {
                    return {
                        tags: item.tags,
                        title: item.title,
                        pageContent: content
                    };
                }).catch(function(error) {
                    console.error('读取文件失败:', item.title, error);
                    return null;
                });
            });
            
            // 等待所有文件读取完成
            Promise.all(readPromises).then(function(importData) {
                // 过滤掉读取失败的文件
                const validData = importData.filter(item => item !== null);
                
                if (validData.length === 0) {
                    window.dispatchEvent(new CustomEvent('jszip-import-error', { 
                        detail: { error: '没有成功读取任何文件' } 
                    }));
                    return;
                }
                
                // 发送导入数据
                window.dispatchEvent(new CustomEvent('jszip-import-success', { 
                    detail: { importData: validData } 
                }));
            }).catch(function(error) {
                console.error('读取文件失败:', error);
                window.dispatchEvent(new CustomEvent('jszip-import-error', { 
                    detail: { error: '读取文件失败: ' + (error.message || '未知错误') } 
                }));
            });
        }).catch(function(error) {
            console.error('解析ZIP文件失败:', error);
            window.dispatchEvent(new CustomEvent('jszip-import-error', { 
                detail: { error: '解析ZIP文件失败: ' + (error.message || '未知错误') } 
            }));
        });
    } catch (error) {
        console.error('处理导入数据失败:', error);
        window.dispatchEvent(new CustomEvent('jszip-import-error', { 
            detail: { error: '处理导入数据失败: ' + (error.message || '未知错误') } 
        }));
    }
})();


