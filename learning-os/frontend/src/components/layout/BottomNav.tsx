import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Code2,
    Server,
    FolderGit2,
    User
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
    className?: string;
}

const navItems = [
    { icon: LayoutDashboard, label: 'Home', href: '/', active: true },
    { icon: Code2, label: 'DSA', href: '/dsa' },
    { icon: Server, label: 'Backend', href: '/backend' },
    { icon: FolderGit2, label: 'Projects', href: '/projects' },
    { icon: User, label: 'Profile', href: '/profile' },
];

export function BottomNav({ className }: BottomNavProps) {
    return (
        <motion.nav
            className={cn(
                'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
                'bg-[#0a0d12]/95 backdrop-blur-xl',
                'border-t border-white/[0.06]',
                'px-2 pb-safe',
                className
            )}
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            <div className="flex items-center justify-around py-2">
                {navItems.map((item) => (
                    <a
                        key={item.label}
                        href={item.href}
                        className={cn(
                            'flex flex-col items-center gap-1 px-4 py-2 rounded-xl',
                            'transition-all duration-200',
                            'relative',
                            item.active
                                ? 'text-white'
                                : 'text-gray-500'
                        )}
                    >
                        {/* Active background glow */}
                        {item.active && (
                            <motion.div
                                className="absolute inset-0 bg-gray-500/20 rounded-xl"
                                layoutId="bottomNavActive"
                            />
                        )}

                        <motion.div
                            className="relative z-10"
                            whileTap={{ scale: 0.9 }}
                        >
                            <item.icon
                                size={22}
                                className={cn(
                                    'transition-colors',
                                    item.active && 'text-gray-300'
                                )}
                            />
                        </motion.div>

                        <span className={cn(
                            'text-[10px] font-medium relative z-10',
                            item.active ? 'text-gray-300' : 'text-gray-500'
                        )}>
                            {item.label}
                        </span>

                        {/* Active dot indicator */}
                        {item.active && (
                            <motion.div
                                className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gray-600"
                                layoutId="bottomNavDot"
                            />
                        )}
                    </a>
                ))}
            </div>
        </motion.nav>
    );
}
