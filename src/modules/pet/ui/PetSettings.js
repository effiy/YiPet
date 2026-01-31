/**
 * Pet Settings Component
 * 宠物设置组件
 */

import React from 'react';
import { usePetState } from '../hooks/index.js';
import { PET_CONFIG, CHAT_CONFIG, DRAG_CONFIG, STATE_CONFIG, THEME_CONFIG } from '../constants/index.js';

/**
 * 设置项组件
 */
export function SettingItem({ 
    label, 
    type = 'text',
    value,
    onChange,
    options = [],
    min,
    max,
    step,
    disabled = false,
    description = '',
    className = ''
}) {
    const renderInput = () => {
        switch (type) {
            case 'text':
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        className="setting-input"
                    />
                );
            
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        min={min}
                        max={max}
                        step={step}
                        disabled={disabled}
                        className="setting-input"
                    />
                );
            
            case 'checkbox':
                return (
                    <label className="setting-checkbox-label">
                        <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => onChange(e.target.checked)}
                            disabled={disabled}
                            className="setting-checkbox"
                        />
                        <span className="checkbox-slider"></span>
                    </label>
                );
            
            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        className="setting-select"
                    >
                        {options.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );
            
            case 'range':
                return (
                    <div className="setting-range-container">
                        <input
                            type="range"
                            value={value}
                            onChange={(e) => onChange(parseFloat(e.target.value))}
                            min={min}
                            max={max}
                            step={step}
                            disabled={disabled}
                            className="setting-range"
                        />
                        <span className="range-value">{value}</span>
                    </div>
                );
            
            case 'color':
                return (
                    <div className="setting-color-container">
                        <input
                            type="color"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            disabled={disabled}
                            className="setting-color"
                        />
                        <span className="color-value">{value}</span>
                    </div>
                );
            
            default:
                return null;
        }
    };

    return (
        <div className={`setting-item ${className}`}>
            <div className="setting-label-container">
                <label className="setting-label">{label}</label>
                {description && (
                    <div className="setting-description">{description}</div>
                )}
            </div>
            <div className="setting-control">
                {renderInput()}
            </div>
        </div>
    );
}

/**
 * 设置分组组件
 */
export function SettingGroup({ title, children, className = '' }) {
    return (
        <div className={`setting-group ${className}`}>
            <div className="setting-group-header">
                <h3 className="setting-group-title">{title}</h3>
            </div>
            <div className="setting-group-content">
                {children}
            </div>
        </div>
    );
}

/**
 * 宠物设置主组件
 */
export function PetSettings({ isOpen, onClose }) {
    const [role, setRole] = usePetState('role');
    const [color, setColor] = usePetState('color');
    const [petSize, setPetSize] = usePetState('petSize');
    const [autoSave, setAutoSave] = usePetState('autoSave');
    const [theme, setTheme] = usePetState('theme');
    const [language, setLanguage] = usePetState('language');
    const [animations, setAnimations] = usePetState('animations');
    const [sound, setSound] = usePetState('sound');

    if (!isOpen) return null;

    const roleOptions = Object.entries(PET_CONFIG.roles).map(([key, config]) => ({
        value: key,
        label: `${config.icon} ${config.name}`
    }));

    const themeOptions = Object.entries(THEME_CONFIG.modes).map(([key, config]) => ({
        value: key,
        label: config.name
    }));

    const languageOptions = [
        { value: 'zh-CN', label: '简体中文' },
        { value: 'zh-TW', label: '繁體中文' },
        { value: 'en-US', label: 'English' },
        { value: 'ja-JP', label: '日本語' },
        { value: 'ko-KR', label: '한국어' }
    ];

    const handleSave = () => {
        console.log('保存设置:', {
            role,
            color,
            petSize,
            autoSave,
            theme,
            language,
            animations,
            sound
        });
        onClose();
    };

    const handleReset = () => {
        setRole(PET_CONFIG.defaultRole);
        setColor(PET_CONFIG.pet.defaultColor);
        setPetSize(PET_CONFIG.pet.size.width);
        setAutoSave(STATE_CONFIG.persistence.enabled);
        setTheme(THEME_CONFIG.defaultMode);
        setLanguage('zh-CN');
        setAnimations(true);
        setSound(false);
    };

    const handleExport = () => {
        const settings = {
            role,
            color,
            petSize,
            autoSave,
            theme,
            language,
            animations,
            sound
        };
        
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'yi-pet-settings.json';
        link.click();
        
        URL.revokeObjectURL(url);
    };

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                
                if (settings.role) setRole(settings.role);
                if (settings.color) setColor(settings.color);
                if (settings.petSize) setPetSize(settings.petSize);
                if (settings.autoSave !== undefined) setAutoSave(settings.autoSave);
                if (settings.theme) setTheme(settings.theme);
                if (settings.language) setLanguage(settings.language);
                if (settings.animations !== undefined) setAnimations(settings.animations);
                if (settings.sound !== undefined) setSound(settings.sound);
                
                console.log('设置导入成功');
            } catch (error) {
                console.error('设置导入失败:', error);
                alert('设置文件格式错误');
            }
        };
        
        reader.readAsText(file);
    };

    return (
        <div className="pet-settings-overlay">
            <div className="pet-settings-modal">
                <div className="settings-header">
                    <h2 className="settings-title">Yi助手设置</h2>
                    <button className="settings-close" onClick={onClose}>×</button>
                </div>
                
                <div className="settings-content">
                    <SettingGroup title="外观设置">
                        <SettingItem
                            label="角色"
                            type="select"
                            value={role}
                            onChange={setRole}
                            options={roleOptions}
                            description="选择你的AI助手角色"
                        />
                        
                        <SettingItem
                            label="颜色"
                            type="color"
                            value={color}
                            onChange={setColor}
                            description="选择宠物颜色"
                        />
                        
                        <SettingItem
                            label="大小"
                            type="range"
                            value={petSize}
                            onChange={setPetSize}
                            min={40}
                            max={120}
                            step={5}
                            description="调整宠物大小"
                        />
                        
                        <SettingItem
                            label="主题"
                            type="select"
                            value={theme}
                            onChange={setTheme}
                            options={themeOptions}
                            description="选择界面主题"
                        />
                    </SettingGroup>
                    
                    <SettingGroup title="行为设置">
                        <SettingItem
                            label="动画效果"
                            type="checkbox"
                            value={animations}
                            onChange={setAnimations}
                            description="启用动画效果"
                        />
                        
                        <SettingItem
                            label="声音"
                            type="checkbox"
                            value={sound}
                            onChange={setSound}
                            description="启用声音提示"
                        />
                    </SettingGroup>
                    
                    <SettingGroup title="功能设置">
                        <SettingItem
                            label="自动保存"
                            type="checkbox"
                            value={autoSave}
                            onChange={setAutoSave}
                            description="自动保存聊天记录"
                        />
                        
                        <SettingItem
                            label="语言"
                            type="select"
                            value={language}
                            onChange={setLanguage}
                            options={languageOptions}
                            description="选择界面语言"
                        />
                    </SettingGroup>
                </div>
                
                <div className="settings-footer">
                    <div className="settings-actions-left">
                        <label className="import-button">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                style={{ display: 'none' }}
                            />
                            导入
                        </label>
                        <button className="export-button" onClick={handleExport}>
                            导出
                        </button>
                    </div>
                    
                    <div className="settings-actions-right">
                        <button className="reset-button" onClick={handleReset}>
                            重置
                        </button>
                        <button className="cancel-button" onClick={onClose}>
                            取消
                        </button>
                        <button className="save-button" onClick={handleSave}>
                            保存
                        </button>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{
                __html: `
                    .pet-settings-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    
                    .pet-settings-modal {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                        width: 90%;
                        max-width: 600px;
                        max-height: 80vh;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .settings-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 20px 24px;
                        border-bottom: 1px solid #eee;
                    }
                    
                    .settings-title {
                        margin: 0;
                        font-size: 20px;
                        font-weight: 600;
                        color: #333;
                    }
                    
                    .settings-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        color: #666;
                        cursor: pointer;
                        padding: 0;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 6px;
                        transition: background-color 0.2s ease;
                    }
                    
                    .settings-close:hover {
                        background-color: #f5f5f5;
                    }
                    
                    .settings-content {
                        flex: 1;
                        padding: 24px;
                        overflow-y: auto;
                    }
                    
                    .setting-group {
                        margin-bottom: 32px;
                    }
                    
                    .setting-group:last-child {
                        margin-bottom: 0;
                    }
                    
                    .setting-group-header {
                        margin-bottom: 16px;
                    }
                    
                    .setting-group-title {
                        margin: 0;
                        font-size: 16px;
                        font-weight: 600;
                        color: #333;
                    }
                    
                    .setting-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                        padding: 12px 0;
                    }
                    
                    .setting-label-container {
                        flex: 1;
                        margin-right: 16px;
                    }
                    
                    .setting-label {
                        font-weight: 500;
                        color: #333;
                        margin-bottom: 4px;
                    }
                    
                    .setting-description {
                        font-size: 12px;
                        color: #666;
                        line-height: 1.4;
                    }
                    
                    .setting-control {
                        min-width: 120px;
                    }
                    
                    .setting-input,
                    .setting-select {
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                        transition: border-color 0.2s ease;
                    }
                    
                    .setting-input:focus,
                    .setting-select:focus {
                        outline: none;
                        border-color: #007bff;
                        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
                    }
                    
                    .setting-checkbox-label {
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                    }
                    
                    .setting-checkbox {
                        display: none;
                    }
                    
                    .checkbox-slider {
                        width: 44px;
                        height: 24px;
                        background-color: #ccc;
                        border-radius: 12px;
                        position: relative;
                        transition: background-color 0.2s ease;
                    }
                    
                    .checkbox-slider::after {
                        content: '';
                        position: absolute;
                        width: 20px;
                        height: 20px;
                        background-color: white;
                        border-radius: 50%;
                        top: 2px;
                        left: 2px;
                        transition: transform 0.2s ease;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    
                    .setting-checkbox:checked + .checkbox-slider {
                        background-color: #007bff;
                    }
                    
                    .setting-checkbox:checked + .checkbox-slider::after {
                        transform: translateX(20px);
                    }
                    
                    .setting-range-container {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    
                    .setting-range {
                        flex: 1;
                        -webkit-appearance: none;
                        height: 6px;
                        background: #ddd;
                        border-radius: 3px;
                        outline: none;
                    }
                    
                    .setting-range::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        width: 20px;
                        height: 20px;
                        background: #007bff;
                        border-radius: 50%;
                        cursor: pointer;
                    }
                    
                    .range-value {
                        min-width: 40px;
                        text-align: center;
                        font-weight: 500;
                        color: #333;
                    }
                    
                    .setting-color-container {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    
                    .setting-color {
                        width: 40px;
                        height: 40px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        cursor: pointer;
                    }
                    
                    .color-value {
                        font-family: monospace;
                        font-size: 12px;
                        color: #666;
                    }
                    
                    .settings-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 20px 24px;
                        border-top: 1px solid #eee;
                        background-color: #f8f9fa;
                    }
                    
                    .settings-actions-left,
                    .settings-actions-right {
                        display: flex;
                        gap: 12px;
                    }
                    
                    .import-button,
                    .export-button,
                    .reset-button,
                    .cancel-button,
                    .save-button {
                        padding: 8px 16px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    .import-button,
                    .export-button,
                    .reset-button {
                        background-color: white;
                        color: #333;
                    }
                    
                    .import-button:hover,
                    .export-button:hover,
                    .reset-button:hover {
                        background-color: #f5f5f5;
                        border-color: #bbb;
                    }
                    
                    .cancel-button {
                        background-color: white;
                        color: #666;
                    }
                    
                    .cancel-button:hover {
                        background-color: #f5f5f5;
                    }
                    
                    .save-button {
                        background-color: #007bff;
                        color: white;
                        border-color: #007bff;
                    }
                    
                    .save-button:hover {
                        background-color: #0056b3;
                        border-color: #0056b3;
                    }
                `
            }} />
        </div>
    );
}