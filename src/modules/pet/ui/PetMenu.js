/**
 * Pet Menu Component
 * 宠物菜单组件
 */

import React from 'react';
import { usePetState } from '../hooks/index.js';
import { PET_CONFIG } from '../constants/index.js';

/**
 * 菜单项组件
 */
export function MenuItem({ 
    icon, 
    label, 
    onClick, 
    disabled = false, 
    className = '',
    shortcut = null,
    children = null
}) {
    const handleClick = (event) => {
        if (disabled) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        if (onClick) {
            onClick(event);
        }
    };

    const handleKeyDown = (event) => {
        if (disabled) return;
        
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick(event);
        }
    };

    return (
        <div 
            className={`menu-item ${disabled ? 'disabled' : ''} ${className}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={disabled ? -1 : 0}
            role="menuitem"
            aria-disabled={disabled}
        >
            {icon && <span className="menu-icon">{icon}</span>}
            <span className="menu-label">{label}</span>
            {shortcut && <span className="menu-shortcut">{shortcut}</span>}
            {children && <div className="menu-children">{children}</div>}
        </div>
    );
}

/**
 * 菜单分隔符
 */
export function MenuSeparator() {
    return <div className="menu-separator" role="separator" />;
}

/**
 * 菜单子菜单
 */
export function MenuSubmenu({ icon, label, items = [], disabled = false }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const submenuRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (submenuRef.current && !submenuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleMouseEnter = () => {
        if (!disabled) {
            setIsOpen(true);
        }
    };

    const handleMouseLeave = () => {
        setIsOpen(false);
    };

    return (
        <div 
            className={`menu-submenu ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}
            ref={submenuRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <MenuItem 
                icon={icon}
                label={label}
                disabled={disabled}
                className="submenu-trigger"
            />
            
            {isOpen && (
                <div className="submenu-items">
                    {items.map((item, index) => (
                        <MenuItem
                            key={index}
                            icon={item.icon}
                            label={item.label}
                            onClick={item.onClick}
                            disabled={item.disabled}
                            shortcut={item.shortcut}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * 主菜单组件
 */
export function PetMenu({ 
    isOpen, 
    onClose, 
    position = { x: 0, y: 0 },
    className = '',
    style = {}
}) {
    const [role] = usePetState('role');
    const [color] = usePetState('color');
    const [isChatOpen] = usePetState('isChatOpen');
    
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const handleRoleChange = (newRole) => {
        // 这里应该调用状态管理器来更改角色
        console.log(`切换到角色: ${newRole}`);
        onClose();
    };

    const handleColorChange = (newColor) => {
        // 这里应该调用状态管理器来更改颜色
        console.log(`切换到颜色: ${newColor}`);
        onClose();
    };

    const handleToggleChat = () => {
        // 这里应该调用状态管理器来切换聊天窗口
        console.log(`切换聊天窗口: ${!isChatOpen}`);
        onClose();
    };

    const roleItems = Object.entries(PET_CONFIG.roles).map(([key, config]) => ({
        icon: config.icon,
        label: config.name,
        onClick: () => handleRoleChange(key),
        disabled: key === role
    }));

    const colorItems = PET_CONFIG.pet.colors.map((petColor) => ({
        icon: '🎨',
        label: petColor,
        onClick: () => handleColorChange(petColor),
        disabled: petColor === color
    }));

    if (!isOpen) return null;

    const menuStyle = {
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '200px',
        ...style
    };

    return (
        <div 
            ref={menuRef}
            className={`pet-menu ${className}`}
            style={menuStyle}
            role="menu"
            aria-expanded={isOpen}
        >
            <div className="menu-header">
                <span className="menu-title">Yi助手设置</span>
            </div>
            
            <MenuSeparator />
            
            <MenuItem 
                icon={isChatOpen ? '💬' : '💬'}
                label={isChatOpen ? '关闭聊天' : '打开聊天'}
                onClick={handleToggleChat}
                shortcut="Ctrl+Shift+C"
            />
            
            <MenuSeparator />
            
            <MenuSubmenu 
                icon="👥"
                label="切换角色"
                items={roleItems}
            />
            
            <MenuSubmenu 
                icon="🎨"
                label="切换颜色"
                items={colorItems}
            />
            
            <MenuSeparator />
            
            <MenuItem 
                icon="⚙️"
                label="设置"
                onClick={() => {
                    console.log('打开设置');
                    onClose();
                }}
                shortcut="Ctrl+,"
            />
            
            <MenuItem 
                icon="ℹ️"
                label="关于"
                onClick={() => {
                    console.log('打开关于');
                    onClose();
                }}
            />
            
            <MenuSeparator />
            
            <MenuItem 
                icon="❌"
                label="退出"
                onClick={() => {
                    console.log('退出应用');
                    onClose();
                }}
                shortcut="Ctrl+Q"
            />
            
            <style dangerouslySetInnerHTML={{
                __html: `
                    .pet-menu {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        font-size: 14px;
                        line-height: 1.4;
                    }
                    
                    .menu-header {
                        padding: 12px 16px;
                        border-bottom: 1px solid #eee;
                        font-weight: 600;
                        color: #333;
                    }
                    
                    .menu-item {
                        display: flex;
                        align-items: center;
                        padding: 10px 16px;
                        cursor: pointer;
                        transition: background-color 0.2s ease;
                        user-select: none;
                        outline: none;
                    }
                    
                    .menu-item:hover:not(.disabled) {
                        background-color: #f5f5f5;
                    }
                    
                    .menu-item:focus:not(.disabled) {
                        background-color: #e8f4fd;
                        outline: 2px solid #007bff;
                        outline-offset: -2px;
                    }
                    
                    .menu-item.disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    
                    .menu-icon {
                        margin-right: 12px;
                        font-size: 16px;
                        width: 20px;
                        text-align: center;
                    }
                    
                    .menu-label {
                        flex: 1;
                        color: #333;
                    }
                    
                    .menu-shortcut {
                        color: #666;
                        font-size: 12px;
                        margin-left: 8px;
                    }
                    
                    .menu-separator {
                        height: 1px;
                        background-color: #eee;
                        margin: 4px 0;
                    }
                    
                    .menu-submenu {
                        position: relative;
                    }
                    
                    .submenu-items {
                        position: absolute;
                        left: 100%;
                        top: 0;
                        background-color: white;
                        border: 1px solid #ccc;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        min-width: '150px';
                        z-index: 1001;
                        margin-left: 4px;
                    }
                    
                    .submenu-trigger::after {
                        content: '▶';
                        margin-left: auto;
                        font-size: 10px;
                        color: #666;
                    }
                `
            }} />
        </div>
    );
}

/**
 * 菜单管理器
 */
export class MenuManager {
    constructor() {
        this.menus = new Map();
        this.currentMenu = null;
        this.globalShortcuts = new Map();
        
        this.setupGlobalShortcuts();
    }

    create(id, config) {
        this.menus.set(id, config);
        return id;
    }

    show(id, position = { x: 0, y: 0 }) {
        const menu = this.menus.get(id);
        if (!menu) {
            console.warn(`菜单不存在: ${id}`);
            return;
        }
        
        this.currentMenu = { id, position, config: menu };
        
        // 这里可以触发显示菜单的事件
        console.log(`显示菜单: ${id} 在位置 (${position.x}, ${position.y})`);
        
        return this.currentMenu;
    }

    hide() {
        if (this.currentMenu) {
            console.log(`隐藏菜单: ${this.currentMenu.id}`);
            this.currentMenu = null;
        }
    }

    isOpen() {
        return this.currentMenu !== null;
    }

    getCurrentMenu() {
        return this.currentMenu;
    }

    addGlobalShortcut(key, callback) {
        this.globalShortcuts.set(key.toLowerCase(), callback);
    }

    removeGlobalShortcut(key) {
        this.globalShortcuts.delete(key.toLowerCase());
    }

    setupGlobalShortcuts() {
        document.addEventListener('keydown', (event) => {
            const key = this.getKeyString(event);
            const callback = this.globalShortcuts.get(key);
            
            if (callback) {
                event.preventDefault();
                callback(event);
            }
        });
    }

    getKeyString(event) {
        const parts = [];
        
        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        if (event.metaKey) parts.push('meta');
        
        if (event.key && event.key !== 'Control' && event.key !== 'Alt' && 
            event.key !== 'Shift' && event.key !== 'Meta') {
            parts.push(event.key.toLowerCase());
        }
        
        return parts.join('+');
    }

    remove(id) {
        this.menus.delete(id);
        if (this.currentMenu && this.currentMenu.id === id) {
            this.hide();
        }
    }

    clear() {
        this.menus.clear();
        this.hide();
    }

    getAll() {
        return Array.from(this.menus.entries());
    }
}

// 全局菜单管理器实例
export const menuManager = new MenuManager();