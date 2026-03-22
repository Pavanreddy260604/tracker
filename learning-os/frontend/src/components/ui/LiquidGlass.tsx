import {
    useState,

    type ReactNode,
    type CSSProperties,
} from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import '../../styles/liquid-glass.css';

interface LiquidGlassProps {
    children: ReactNode;
    className?: string;
    draggable?: boolean;
    expandable?: boolean;
    width?: number | string;
    height?: number | string;
    style?: CSSProperties;
    onClick?: () => void;
}

export function LiquidGlass({
    children,
    className = '',
    draggable = false,
    expandable = false,
    width,
    height,
    style,
    onClick,
}: LiquidGlassProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring physics for the highlight
    const springConfig = { stiffness: 150, damping: 20 };
    const highlightX = useSpring(mouseX, springConfig);
    const highlightY = useSpring(mouseY, springConfig);

    // Map mouse position to highlight gradient
    const background = useTransform(
        [highlightX, highlightY],
        ([x, y]) => {
            const isLight = document.documentElement.classList.contains('light');
            const color = isLight ? 'var(--accent-primary-rgb)' : '255, 255, 255';
            const opacity = isLight ? '0.12' : '0.06';
            return `radial-gradient(600px circle at ${x}px ${y}px, rgba(${color}, ${opacity}), transparent 40%)`;
        }
    );

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
    };

    return (
        <motion.div
            layout
            drag={draggable}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
            onClick={() => {
                if (expandable) setIsExpanded(!isExpanded);
                onClick?.();
            }}
            onMouseMove={handleMouseMove}
            style={{
                ...style,
                width: isExpanded ? '100%' : width,
                height: isExpanded ? 'auto' : height,
                cursor: draggable ? 'grab' : expandable ? 'pointer' : 'default',
            }}
            className={`liquid-glass overflow-hidden relative ${className} ${isExpanded ? 'is-expanded' : ''}`}
            whileHover={{ scale: 1.01 }}
            whileTap={draggable ? { scale: 0.98, cursor: 'grabbing' } : {}}
        >
            {/* Dynamic Specular Highlight */}
            <motion.div 
                className="absolute inset-0 pointer-events-none z-10"
                style={{ background }}
            />
            
            <div className="liquid-glass__content relative z-20">
                {children}
            </div>
        </motion.div>
    );
}

export default LiquidGlass;

