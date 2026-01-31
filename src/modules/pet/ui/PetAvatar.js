/**
 * Pet Avatar Component
 * 宠物头像组件
 */

import React from 'react';
import { usePetState } from '../hooks/index.js';

/**
 * 宠物头像组件
 */
export function PetAvatar({ size = 80, animated = true }) {
    const [color] = usePetState('color');
    const [role] = usePetState('role');
    const [isThinking] = usePetState('isThinking');
    const [isHappy] = usePetState('isHappy');
    const [isSad] = usePetState('isSad');

    const getAvatarStyle = () => {
        return {
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.4}px`,
            color: 'white',
            position: 'relative',
            cursor: 'pointer',
            transition: animated ? 'all 0.3s ease' : 'none',
            transform: getTransform(),
            animation: getAnimation()
        };
    };

    const getTransform = () => {
        let transform = '';
        
        if (isThinking) {
            transform += 'scale(1.1) ';
        }
        
        if (isHappy) {
            transform += 'scale(1.05) ';
        }
        
        if (isSad) {
            transform += 'scale(0.95) ';
        }

        return transform || 'none';
    };

    const getAnimation = () => {
        if (isThinking) return 'thinking 1s ease-in-out infinite';
        if (isHappy) return 'happy 0.5s ease-in-out';
        if (isSad) return 'sad 0.5s ease-in-out';
        return 'none';
    };

    const getRoleIcon = () => {
        const roleIcons = {
            '教师': '👨‍🏫',
            '学生': '👨‍🎓',
            '朋友': '👋',
            '专家': '🧠'
        };
        
        return roleIcons[role] || '🤖';
    };

    return (
        <div className="pet-avatar-container">
            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes thinking {
                        0%, 100% { transform: scale(1.1) rotate(0deg); }
                        25% { transform: scale(1.1) rotate(-5deg); }
                        75% { transform: scale(1.1) rotate(5deg); }
                    }
                    
                    @keyframes happy {
                        0%, 100% { transform: scale(1.05); }
                        50% { transform: scale(1.1); }
                    }
                    
                    @keyframes sad {
                        0%, 100% { transform: scale(0.95); }
                        50% { transform: scale(0.9); }
                    }
                    
                    .pet-avatar-container {
                        position: relative;
                        display: inline-block;
                    }
                    
                    .pet-avatar-status {
                        position: absolute;
                        bottom: -5px;
                        right: -5px;
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        border: 2px solid white;
                        z-index: 1;
                    }
                    
                    .status-online { background-color: #28a745; }
                    .status-thinking { background-color: #ffc107; animation: pulse 1s infinite; }
                    .status-error { background-color: #dc3545; }
                    .status-offline { background-color: #6c757d; }
                    
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }
                `
            }} />
            
            <div className="pet-avatar" style={getAvatarStyle()}>
                {getRoleIcon()}
            </div>
            
            <div className={`pet-avatar-status ${getStatusClass()}`} />
        </div>
    );

    function getStatusClass() {
        if (isThinking) return 'status-thinking';
        if (isHappy) return 'status-online';
        if (isSad) return 'status-error';
        return 'status-online';
    }
}

/**
 * 宠物状态指示器组件
 */
export function PetStatusIndicator({ size = 12 }) {
    const [isThinking] = usePetState('isThinking');
    const [isProcessing] = usePetState('isProcessing');
    const [isOnline] = usePetState('isOnline');

    const getStatus = () => {
        if (isProcessing) return 'processing';
        if (isThinking) return 'thinking';
        if (isOnline) return 'online';
        return 'offline';
    };

    const getStatusColor = () => {
        switch (getStatus()) {
            case 'online': return '#28a745';
            case 'thinking': return '#ffc107';
            case 'processing': return '#17a2b8';
            case 'offline': return '#6c757d';
            default: return '#6c757d';
        }
    };

    const getStatusStyle = () => {
        return {
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            border: '2px solid white',
            animation: getStatus() === 'processing' ? 'pulse 1s infinite' : 'none'
        };
    };

    return (
        <div className="pet-status-indicator" style={getStatusStyle()}>
            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes pulse {
                        0% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.7; transform: scale(1.1); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                `
            }} />
        </div>
    );
}

/**
 * 宠物表情组件
 */
export function PetExpression({ expression, size = 40 }) {
    const expressions = {
        normal: '😊',
        happy: '😄',
        sad: '😢',
        thinking: '🤔',
        surprised: '😮',
        angry: '😠',
        sleeping: '😴',
        excited: '🤩',
        confused: '😕',
        love: '🥰'
    };

    const style = {
        fontSize: `${size}px`,
        lineHeight: 1,
        display: 'inline-block'
    };

    return (
        <div className="pet-expression" style={style}>
            {expressions[expression] || expressions.normal}
        </div>
    );
}

/**
 * 宠物动画组件
 */
export function PetAnimation({ animation, children, duration = 1000 }) {
    const [isAnimating, setIsAnimating] = React.useState(false);

    React.useEffect(() => {
        if (animation) {
            setIsAnimating(true);
            const timer = setTimeout(() => {
                setIsAnimating(false);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [animation, duration]);

    const getAnimationClass = () => {
        if (!isAnimating) return '';
        
        switch (animation) {
            case 'bounce': return 'animate-bounce';
            case 'shake': return 'animate-shake';
            case 'pulse': return 'animate-pulse';
            case 'rotate': return 'animate-rotate';
            case 'tada': return 'animate-tada';
            case 'wobble': return 'animate-wobble';
            default: return '';
        }
    };

    return (
        <div className={`pet-animation ${getAnimationClass()}`}>
            <style dangerouslySetInnerHTML={{
                __html: `
                    @keyframes bounce {
                        0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
                        40%, 43% { transform: translate3d(0,-30px,0); }
                        70% { transform: translate3d(0,-15px,0); }
                        90% { transform: translate3d(0,-4px,0); }
                    }
                    
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                        20%, 40%, 60%, 80% { transform: translateX(10px); }
                    }
                    
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                    
                    @keyframes rotate {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @keyframes tada {
                        0% { transform: scale(1); }
                        10%, 20% { transform: scale(0.9) rotate(-3deg); }
                        30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); }
                        40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); }
                        100% { transform: scale(1) rotate(0); }
                    }
                    
                    @keyframes wobble {
                        0% { transform: translateX(0%); }
                        15% { transform: translateX(-25%) rotate(-5deg); }
                        30% { transform: translateX(20%) rotate(3deg); }
                        45% { transform: translateX(-15%) rotate(-3deg); }
                        60% { transform: translateX(10%) rotate(2deg); }
                        75% { transform: translateX(-5%) rotate(-1deg); }
                        100% { transform: translateX(0%); }
                    }
                    
                    .animate-bounce { animation: bounce 1s; }
                    .animate-shake { animation: shake 0.5s; }
                    .animate-pulse { animation: pulse 1s; }
                    .animate-rotate { animation: rotate 1s; }
                    .animate-tada { animation: tada 1s; }
                    .animate-wobble { animation: wobble 1s; }
                `
            }} />
            {children}
        </div>
    );
}