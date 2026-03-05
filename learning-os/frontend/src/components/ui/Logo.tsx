
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LogoProps {
    className?: string;
    showText?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
    sm: { container: 'w-8 h-8 rounded-lg', icon: 16, text: 'text-sm' },
    md: { container: 'w-10 h-10 rounded-xl', icon: 20, text: 'text-lg' },
    lg: { container: 'w-16 h-16 rounded-2xl', icon: 28, text: 'text-2xl sm:text-3xl' },
};

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
    const config = sizeConfig[size];

    return (
        <div className={cn("inline-flex items-center gap-3", className)}>
            <motion.div
                className={cn(
                    "inline-flex items-center justify-center bg-[color:var(--console-surface-2)] border border-white/10 shadow-lg",
                    config.container
                )}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
            >
                <Sparkles size={config.icon} className="text-white" />
            </motion.div>

            {showText && (
                <div className="flex flex-col items-start">
                    <h1 className={cn("font-semibold text-white tracking-tight", config.text)}>
                        Learning OS
                    </h1>
                </div>
            )}
        </div>
    );
}
