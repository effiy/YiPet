/**
 * Pet Tooltip Component
 * 宠物提示组件
 */

import React from 'react';
import { usePetState } from '../hooks/index.js';

/**
 * 提示组件
 */
export function PetTooltip({ 
    content, 
    position = 'top', 
    visible = true, 
    delay = 500,
    className = '',
    style = {}
}) {
    const [isVisible, setIsVisible] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const tooltipRef = React.useRef(null);
    const timeoutRef = React.useRef(null);

    React.useEffect(() => {
        if (visible && isHovered) {
            timeoutRef.current = setTimeout(() => {
                setIsVisible(true);
            }, delay);
        } else {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            setIsVisible(false);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [visible, isHovered, delay]);

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const getPositionStyle = () => {
        const baseStyle = {
            position: 'absolute',
            zIndex: 1000,
            backgroundColor: '#333',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            opacity: isVisible ? 1 : 0,
            visibility: isVisible ? 'visible' : 'hidden',
            transition: 'opacity 0.2s ease-in-out',
            pointerEvents: 'none'
        };

        switch (position) {
            case 'top':
                return {
                    ...baseStyle,
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%) translateY(-8px)',
                    marginBottom: '8px'
                };
            case 'bottom':
                return {
                    ...baseStyle,
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%) translateY(8px)',
                    marginTop: '8px'
                };
            case 'left':
                return {
                    ...baseStyle,
                    right: '100%',
                    top: '50%',
                    transform: 'translateY(-50%) translateX(-8px)',
                    marginRight: '8px'
                };
            case 'right':
                return {
                    ...baseStyle,
                    left: '100%',
                    top: '50%',
                    transform: 'translateY(-50%) translateX(8px)',
                    marginLeft: '8px'
                };
            default:
                return baseStyle;
        }
    };

    const getArrowStyle = () => {
        const arrowStyle = {
            position: 'absolute',
            width: 0,
            height: 0,
            borderStyle: 'solid'
        };

        switch (position) {
            case 'top':
                return {
                    ...arrowStyle,
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderWidth: '4px 4px 0 4px',
                    borderColor: '#333 transparent transparent transparent'
                };
            case 'bottom':
                return {
                    ...arrowStyle,
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderWidth: '0 4px 4px 4px',
                    borderColor: 'transparent transparent #333 transparent'
                };
            case 'left':
                return {
                    ...arrowStyle,
                    left: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    borderWidth: '4px 0 4px 4px',
                    borderColor: 'transparent transparent transparent #333'
                };
            case 'right':
                return {
                    ...arrowStyle,
                    right: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    borderWidth: '4px 4px 4px 0',
                    borderColor: 'transparent #333 transparent transparent'
                };
            default:
                return arrowStyle;
        }
    };

    return (
        <div 
            className={`pet-tooltip-wrapper ${className}`}
            style={{ position: 'relative', ...style }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div 
                ref={tooltipRef}
                className="pet-tooltip"
                style={getPositionStyle()}
            >
                {content}
                <div style={getArrowStyle()} />
            </div>
            
            <style dangerouslySetInnerHTML={{
                __html: `
                    .pet-tooltip-wrapper {
                        display: inline-block;
                    }
                    
                    .pet-tooltip {
                        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                    }
                `
            }} />
        </div>
    );
}

/**
 * 带提示的组件包装器
 */
export function withTooltip(Component, tooltipContent, tooltipOptions = {}) {
    return React.forwardRef((props, ref) => {
        return (
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <Component ref={ref} {...props} />
                <PetTooltip 
                    content={tooltipContent}
                    {...tooltipOptions}
                />
            </div>
        );
    });
}

/**
 * 提示管理器
 */
export class TooltipManager {
    constructor() {
        this.tooltips = new Map();
        this.globalOptions = {
            position: 'top',
            delay: 500,
            className: '',
            style: {}
        };
    }

    create(id, content, options = {}) {
        const tooltipOptions = { ...this.globalOptions, ...options };
        this.tooltips.set(id, { content, options: tooltipOptions });
        return id;
    }

    update(id, content, options = {}) {
        if (this.tooltips.has(id)) {
            const existing = this.tooltips.get(id);
            this.tooltips.set(id, {
                content: content || existing.content,
                options: { ...existing.options, ...options }
            });
        }
    }

    remove(id) {
        this.tooltips.delete(id);
    }

    get(id) {
        return this.tooltips.get(id);
    }

    show(id) {
        const tooltip = this.tooltips.get(id);
        if (tooltip) {
            // 这里可以实现显示逻辑
            console.log(`显示提示: ${id}`);
        }
    }

    hide(id) {
        const tooltip = this.tooltips.get(id);
        if (tooltip) {
            // 这里可以实现隐藏逻辑
            console.log(`隐藏提示: ${id}`);
        }
    }

    setGlobalOptions(options) {
        this.globalOptions = { ...this.globalOptions, ...options };
    }

    clear() {
        this.tooltips.clear();
    }

    getAll() {
        return Array.from(this.tooltips.entries());
    }
}

// 全局提示管理器实例
export const tooltipManager = new TooltipManager();