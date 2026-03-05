import {
    useRef,
    useState,
    useCallback,
    useEffect,
    type ReactNode,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import '../../styles/liquid-glass.css';

interface LiquidGlassProps {
    /** Content to display inside the glass panel */
    children: ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Enable drag-to-move with elastic bounce-back */
    draggable?: boolean;
    /** Enable click to expand/collapse */
    expandable?: boolean;
    /** Initial/collapsed width */
    width?: number | string;
    /** Initial/collapsed height */
    height?: number | string;
    /** Inline style overrides */
    style?: CSSProperties;
    /** Click handler */
    onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
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
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isBouncing, setIsBouncing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragStart = useRef({ x: 0, y: 0 });

    // Drag handlers
    const handleMouseDown = useCallback(
        (e: ReactMouseEvent<HTMLDivElement>) => {
            if (!draggable) return;
            e.preventDefault();
            setIsDragging(true);
            setIsBouncing(false);
            dragStart.current = {
                x: e.clientX - offset.x,
                y: e.clientY - offset.y,
            };
        },
        [draggable, offset]
    );

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: globalThis.MouseEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setOffset({ x: dx, y: dy });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            // Trigger elastic bounce-back
            if (ref.current) {
                ref.current.style.setProperty('--dx', `${offset.x}px`);
                ref.current.style.setProperty('--dy', `${offset.y}px`);
            }
            setIsBouncing(true);
            setOffset({ x: 0, y: 0 });
            setTimeout(() => setIsBouncing(false), 500);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, offset]);

    // Touch drag handlers
    useEffect(() => {
        const el = ref.current;
        if (!el || !draggable) return;

        let touchOffset = { x: 0, y: 0 };

        const handleTouchStart = (e: TouchEvent) => {
            dragStart.current = {
                x: e.touches[0].clientX - offset.x,
                y: e.touches[0].clientY - offset.y,
            };
            setIsDragging(true);
            setIsBouncing(false);
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            const dx = e.touches[0].clientX - dragStart.current.x;
            const dy = e.touches[0].clientY - dragStart.current.y;
            touchOffset = { x: dx, y: dy };
            setOffset({ x: dx, y: dy });
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
            if (ref.current) {
                ref.current.style.setProperty('--dx', `${touchOffset.x}px`);
                ref.current.style.setProperty('--dy', `${touchOffset.y}px`);
            }
            setIsBouncing(true);
            setOffset({ x: 0, y: 0 });
            setTimeout(() => setIsBouncing(false), 500);
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd);

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
        };
    }, [draggable, offset]);

    const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (expandable) {
            setIsExpanded((prev) => !prev);
        }
        onClick?.(e);
    };

    const classes = [
        'liquid-glass',
        isDragging && 'is-dragging',
        isBouncing && 'is-bouncing',
        isExpanded && 'is-expanded',
        expandable && 'is-expandable',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    const computedStyle: CSSProperties = {
        ...style,
        width: isExpanded ? '100%' : width,
        height: isExpanded ? 'auto' : height,
        transform: isDragging
            ? `translate(${offset.x}px, ${offset.y}px) scale(1.02)`
            : undefined,
        cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : expandable ? 'pointer' : undefined,
    };

    return (
        <div
            ref={ref}
            className={classes}
            style={computedStyle}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
        >
            <div className="liquid-glass__content">{children}</div>
        </div>
    );
}

export default LiquidGlass;
