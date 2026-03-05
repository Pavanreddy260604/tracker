import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CircularProgressProps {
    value: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: 'blue' | 'purple' | 'cyan' | 'green' | 'amber';
    label?: string;
    sublabel?: string;
    showValue?: boolean;
    className?: string;
}

const colors = {
    blue: {
        start: '#3b82f6',
        end: '#1d4ed8',
        glow: 'rgba(59, 130, 246, 0.4)',
    },
    purple: {
        start: '#8b5cf6',
        end: '#6d28d9',
        glow: 'rgba(139, 92, 246, 0.4)',
    },
    cyan: {
        start: '#06b6d4',
        end: '#0e7490',
        glow: 'rgba(6, 182, 212, 0.4)',
    },
    green: {
        start: '#22c55e',
        end: '#15803d',
        glow: 'rgba(34, 197, 94, 0.4)',
    },
    amber: {
        start: '#f59e0b',
        end: '#b45309',
        glow: 'rgba(245, 158, 11, 0.4)',
    },
};

export function CircularProgress({
    value,
    size = 120,
    strokeWidth = 8,
    color = 'blue',
    label,
    sublabel,
    showValue = true,
    className,
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;
    const colorConfig = colors[color];

    return (
        <div className={cn('relative inline-flex flex-col items-center', className)}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90 overflow-visible"
            >
                <defs>
                    <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={colorConfig.start} />
                        <stop offset="100%" stopColor={colorConfig.end} />
                    </linearGradient>
                    <filter id={`glow-${color}`}>
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#gradient-${color})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                    style={{ filter: value > 0 ? `drop-shadow(0 0 6px ${colorConfig.glow})` : undefined }}
                />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {showValue && (
                    <motion.span
                        className="text-2xl font-bold text-text-primary"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        {Math.round(value)}%
                    </motion.span>
                )}
                {sublabel && (
                    <span className="text-xs text-text-secondary mt-0.5">{sublabel}</span>
                )}
            </div>

            {/* Label below */}
            {label && (
                <span className="mt-3 text-sm font-medium text-text-secondary">{label}</span>
            )}
        </div>
    );
}
