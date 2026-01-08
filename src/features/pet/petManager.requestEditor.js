(function () {
    'use strict';

    function initRequestEditor() {
        if (typeof window === 'undefined') return;

        if (typeof window.PetManager === 'undefined') {
            // Retry if PetManager is not yet loaded
            setTimeout(initRequestEditor, 100);
            return;
        }

        const proto = window.PetManager.prototype;

        // 获取请求的唯一标识
        proto._getRequestKey = function(req) {
            if (!req) return null;
            // 只返回"可持久化"的唯一标识（来自后端/API的数据）
            // 规则：优先使用 req.key，其次 _id / id（并同步写回 req.key 以便后续一致使用）
            // 确保返回的 key 是有效的非空字符串
            if (req.key && typeof req.key === 'string' && req.key.trim() !== '') {
                return req.key;
            }
            if (req._id && typeof req._id === 'string' && req._id.trim() !== '') {
                req.key = req._id;
                return req.key;
            }
            if (req.id && typeof req.id === 'string' && req.id.trim() !== '') {
                req.key = req.id;
                return req.key;
            }
            // 非API数据（本地拦截/临时数据）不生成 key，避免重渲染后 key 变化导致"选中丢失/错位"
            return null;
        };

        /**
         * 确保请求有 key 字段（如果没有则生成一个）
         * @param {Object} req - 请求对象
         * @returns {string|null} key 值
         */
        proto._ensureRequestKey = function(req) {
            if (!req) return null;
            // 仅为后端/API数据补齐 key；不为本地/临时数据生成 key（避免 key 不稳定）
            // 如果已有 key，直接返回（确保是有效的非空字符串）
            if (req.key && typeof req.key === 'string' && req.key.trim() !== '') {
                return req.key;
            }
            // 如果有 _id，使用 _id 作为 key（确保是有效的非空字符串）
            if (req._id && typeof req._id === 'string' && req._id.trim() !== '') {
                req.key = req._id;
                return req.key;
            }
            // 如果有 id，使用 id 作为 key（确保是有效的非空字符串）
            if (req.id && typeof req.id === 'string' && req.id.trim() !== '') {
                req.key = req.id;
                return req.key;
            }
            return null;
        };

        // 创建表单组（辅助函数）
        proto.createFormGroup = function(labelText, inputType, inputClass, placeholder, rows = 1) {
            const group = document.createElement('div');
            group.style.cssText = `margin-bottom: 16px !important;`;

            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.cssText = `
                display: block !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                color: #374151 !important;
                margin-bottom: 8px !important;
            `;

            let input;
            if (inputType === 'textarea') {
                input = document.createElement('textarea');
                input.rows = rows;
            } else {
                input = document.createElement('input');
                input.type = inputType;
            }
            input.className = inputClass;
            input.placeholder = placeholder;
            input.style.cssText = `
                width: 100% !important;
                padding: 10px 12px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 8px !important;
                font-size: 14px !important;
                box-sizing: border-box !important;
                transition: border-color 0.2s ease !important;
                font-family: inherit !important;
            `;
            input.addEventListener('focus', () => {
                input.style.borderColor = '#3b82f6';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#d1d5db';
            });

            group.appendChild(label);
            group.appendChild(input);
            return group;
        };

        // 填充Headers编辑器
        proto.populateHeadersEditor = function(container, headers) {
            container.innerHTML = '';

            // 添加默认的Content-Type header（如果是POST/PUT等）
            const headerRows = [];
            if (headers && Object.keys(headers).length > 0) {
                Object.entries(headers).forEach(([key, value]) => {
                    headerRows.push({ key, value, enabled: true });
                });
            }

            // 如果没有headers，至少添加一行空行
            if (headerRows.length === 0) {
                headerRows.push({ key: '', value: '', enabled: true });
            }

            headerRows.forEach((row, index) => {
                const rowElement = this.createHeaderRow(row.key, row.value, row.enabled, index);
                container.appendChild(rowElement);
            });

            // 添加"添加Header"按钮
            const addBtn = document.createElement('button');
            addBtn.textContent = '+ 添加Header';
            addBtn.style.cssText = `
                width: 100% !important;
                padding: 10px !important;
                border: 1px dashed #d1d5db !important;
                border-top: none !important;
                background: white !important;
                color: #6b7280 !important;
                font-size: 13px !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
            `;
            addBtn.addEventListener('mouseenter', () => {
                addBtn.style.background = '#f9fafb';
                addBtn.style.borderColor = '#3b82f6';
                addBtn.style.color = '#3b82f6';
            });
            addBtn.addEventListener('mouseleave', () => {
                addBtn.style.background = 'white';
                addBtn.style.borderColor = '#d1d5db';
                addBtn.style.color = '#6b7280';
            });
            addBtn.addEventListener('click', () => {
                const newRow = this.createHeaderRow('', '', true, headerRows.length);
                container.insertBefore(newRow, addBtn);
            });
            container.appendChild(addBtn);
        };

        // 创建Header行
        proto.createHeaderRow = function(key, value, enabled, index) {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex !important;
                gap: 8px !important;
                padding: 8px !important;
                border-bottom: 1px solid #e5e7eb !important;
                align-items: center !important;
            `;

            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.placeholder = 'Header名称';
            keyInput.value = key;
            keyInput.style.cssText = `
                flex: 1 !important;
                padding: 6px 8px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                font-family: 'Monaco', 'Menlo', monospace !important;
            `;

            const valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.placeholder = 'Header值';
            valueInput.value = value;
            valueInput.style.cssText = `
                flex: 2 !important;
                padding: 6px 8px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                font-family: 'Monaco', 'Menlo', monospace !important;
            `;

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '✕';
            deleteBtn.style.cssText = `
                padding: 4px 8px !important;
                border: none !important;
                background: #ef4444 !important;
                color: white !important;
                border-radius: 4px !important;
                cursor: pointer !important;
                font-size: 12px !important;
                transition: all 0.2s ease !important;
            `;
            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = '#dc2626';
            });
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = '#ef4444';
            });
            deleteBtn.addEventListener('click', () => {
                row.remove();
            });

            row.appendChild(keyInput);
            row.appendChild(valueInput);
            row.appendChild(deleteBtn);

            return row;
        };

        // 检测Body类型
        proto.detectBodyType = function(body) {
            if (!body) return 'none';
            if (typeof body === 'string') {
                try {
                    JSON.parse(body);
                    return 'json';
                } catch {
                    return 'raw';
                }
            }
            if (typeof body === 'object') {
                return 'json';
            }
            return 'none';
        };

        // 更新Body编辑器
        proto.updateBodyEditor = function(typeSelect, textarea, body) {
            const type = typeSelect.value;

            if (type === 'none') {
                textarea.style.display = 'none';
                textarea.value = '';
            } else {
                textarea.style.display = 'block';

                if (body !== null && body !== undefined) {
                    if (type === 'json') {
                        if (typeof body === 'object') {
                            textarea.value = JSON.stringify(body, null, 2);
                        } else if (typeof body === 'string') {
                            try {
                                const parsed = JSON.parse(body);
                                textarea.value = JSON.stringify(parsed, null, 2);
                            } catch {
                                textarea.value = body;
                            }
                        } else {
                            textarea.value = '';
                        }
                    } else {
                        textarea.value = typeof body === 'string' ? body : JSON.stringify(body);
                    }
                } else {
                    if (type === 'json') {
                        textarea.value = '{\n  \n}';
                    } else {
                        textarea.value = '';
                    }
                }
            }
        };

        // 格式化JSON Body
        proto.formatJsonBody = function(textarea) {
            if (!textarea) {
                return;
            }

            const currentValue = textarea.value.trim();

            if (!currentValue) {
                // 如果为空，设置为空的JSON对象
                textarea.value = '{\n  \n}';
                return;
            }

            try {
                // 尝试解析JSON
                const parsed = JSON.parse(currentValue);
                // 格式化JSON（使用2个空格缩进）
                const formatted = JSON.stringify(parsed, null, 2);
                textarea.value = formatted;

                // 显示成功提示（可选）
                if (this.showApiRequestNotification) {
                    this.showApiRequestNotification('JSON格式化成功', 'success');
                }
            } catch (error) {
                // JSON格式错误，显示错误提示
                if (this.showApiRequestNotification) {
                    this.showApiRequestNotification('JSON格式错误：' + error.message, 'error');
                } else {
                    console.error('JSON格式错误：' + error.message);
                }
            }
        };

        console.log('PetManager request editor module loaded');
    }

    initRequestEditor();
})();
