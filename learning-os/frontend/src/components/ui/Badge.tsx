import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'outline' | 'secondary';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-console-surface-2 text-text-secondary border-border-subtle',
    secondary: 'bg-console-surface-2 text-text-secondary border-border-subtle',
    outline: 'bg-transparent text-text-secondary border-border-subtle',
    success: 'bg-status-ok/10 text-status-ok border-status-ok/20',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    error: 'bg-status-error/10 text-status-error border-status-error/20',
    info: 'bg-accent-soft text-accent-primary border-accent-soft',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
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
