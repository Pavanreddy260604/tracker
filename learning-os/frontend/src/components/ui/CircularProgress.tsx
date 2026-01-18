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
        stroke: '#3b82f6',
        glow: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))',
    },
    purple: {
        stroke: '#8b5cf6',
        glow: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))',
    },
    cyan: {
        stroke: '#06b6d4',
        glow: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))',
    },
    green: {
        stroke: '#22c55e',
        glow: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.5))',
    },
    amber: {
        stroke: '#f59e0b',
        glow: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))',
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
                className="transform -rotate-90"
                style={{ filter: value > 0 ? colorConfig.glow : undefined }}
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={colorConfig.stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {showValue && (
                    <motion.span
                        className="text-2xl font-bold text-white"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        {Math.round(value)}%
                    </motion.span>
                )}
                {sublabel && (
                    <span className="text-xs text-gray-500 mt-0.5">{sublabel}</span>
                )}
            </div>

            {/* Label below */}
            {label && (
                <span className="mt-3 text-sm font-medium text-gray-400">{label}</span>
            )}
        </div>
    );
}
