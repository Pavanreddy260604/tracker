import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { FileQuestion, Plus } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <motion.div
            className={cn(
                'flex flex-col items-center justify-center py-16 px-6 text-center',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
                {icon || <FileQuestion size={32} className="text-gray-500" />}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-gray-400 max-w-sm mb-6">{description}</p>
            )}
            {action && (
                <Button onClick={action.onClick} leftIcon={<Plus size={18} />}>
                    {action.label}
                </Button>
            )}
        </motion.div>
    );
}
