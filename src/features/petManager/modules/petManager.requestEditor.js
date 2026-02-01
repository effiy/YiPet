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
            group.className = 'pet-request-form-group';

            const label = document.createElement('label');
            label.textContent = labelText;
            label.className = 'pet-request-form-label';

            let input;
            if (inputType === 'textarea') {
                input = document.createElement('textarea');
                input.rows = rows;
            } else {
                input = document.createElement('input');
                input.type = inputType;
            }
            input.className = inputClass || '';
            input.classList.add('pet-request-form-input');
            input.placeholder = placeholder;

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
            addBtn.className = 'pet-request-headers-add-btn';
            addBtn.addEventListener('click', () => {
                const newRow = this.createHeaderRow('', '', true, headerRows.length);
                container.insertBefore(newRow, addBtn);
            });
            container.appendChild(addBtn);
        };

        // 创建Header行
        proto.createHeaderRow = function(key, value, enabled, index) {
            const row = document.createElement('div');
            row.className = 'pet-request-header-row';

            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.placeholder = 'Header名称';
            keyInput.value = key;
            keyInput.className = 'pet-request-header-key';

            const valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.placeholder = 'Header值';
            valueInput.value = value;
            valueInput.className = 'pet-request-header-value';

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '✕';
            deleteBtn.className = 'pet-request-header-delete';
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
                textarea.classList.add('js-hidden');
                textarea.value = '';
            } else {
                textarea.classList.remove('js-hidden');

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
