import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'outline' | 'secondary';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    secondary: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    outline: 'bg-transparent text-gray-400 border-gray-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center font-medium rounded-full border',
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </span>
    );
}

// Difficulty badge helper
export function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
    const variants: Record<string, BadgeVariant> = {
        easy: 'success',
        medium: 'warning',
        hard: 'error',
    };

    return (
        <Badge variant={variants[difficulty]}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
        </Badge>
    );
}

// Status badge helper
export function StatusBadge({ status }: { status: 'solved' | 'revisit' | 'attempted' | 'completed' | 'in_progress' | 'planned' }) {
    const variants: Record<string, BadgeVariant> = {
        solved: 'success',
        completed: 'success',
        revisit: 'warning',
        in_progress: 'info',
        attempted: 'info',
        planned: 'default',
    };

    const labels: Record<string, string> = {
        solved: 'Solved',
        completed: 'Completed',
        revisit: 'Revisit',
        in_progress: 'In Progress',
        attempted: 'Attempted',
        planned: 'Planned',
    };

    return (
        <Badge variant={variants[status] || 'default'}>
            {labels[status] || status}
        </Badge>
    );
}
