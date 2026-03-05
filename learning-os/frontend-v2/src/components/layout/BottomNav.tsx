import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Code2,
    Server,
    Bot,
    MoreHorizontal,
    FolderGit2,
    BarChart2,
    Map,
    Settings,
    MessageSquare,
    Film,
    X
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
    className?: string;
}

const primaryItems = [
    { icon: LayoutDashboard, label: 'Home', href: '/' },
    { icon: Code2, label: 'DSA', href: '/dsa' },
    { icon: Bot, label: 'Interview', href: '/interview' },
    { icon: Server, label: 'Backend', href: '/backend' },
];

const moreItems = [
    { icon: Map, label: 'Roadmap', href: '/roadmap' },
    { icon: FolderGit2, label: 'Projects', href: '/projects' },
    { icon: BarChart2, label: 'Analytics', href: '/analytics' },
    { icon: MessageSquare, label: 'AI Chat', href: '/chat' },
    { icon: Film, label: 'Script Writer', href: '/script-writer' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

export function BottomNav({ className }: BottomNavProps) {
    const location = useLocation();
    const [showMore, setShowMore] = useState(false);

    // Check if current route is in "more" items
    const isMoreActive = moreItems.some(item =>
        item.href === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.href)
    );

    return (
        <>
            {/* More Menu Overlay */}
            <AnimatePresence>
                {showMore && (
                    <>
                        <motion.div
                            className="fixed inset-0 z-40 bg-black/60 md:hidden gpu-accelerated"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMore(false)}
                        />
                        <motion.div
                            className="fixed bottom-[var(--bottom-nav-height)] left-3 right-3 z-50 md:hidden rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#0f1115] shadow-2xl overflow-hidden gpu-accelerated contain-strict"
                            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/[0.06]">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">More</span>
                                <button
                                    onClick={() => setShowMore(false)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1 p-3">
                                {moreItems.map((item) => {
                                    const isActive = item.href === '/'
                                        ? location.pathname === '/'
                                        : location.pathname.startsWith(item.href);
                                    return (
                                        <NavLink
                                            key={item.label}
                                            to={item.href}
                                            onClick={() => setShowMore(false)}
                                            className={cn(
                                                'flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl',
                                                'transition-all duration-200 min-h-[60px]',
                                                isActive
                                                    ? 'bg-blue-500/10 dark:bg-white/5 text-blue-600 dark:text-white'
                                                    : 'text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-white/5'
                                            )}
                                        >
                                            <item.icon size={20} />
                                            <span className="text-[11px] font-medium">{item.label}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom Tab Bar */}
            <motion.nav
                className={cn(
                    'fixed bottom-0 left-0 right-0 z-50 md:hidden',
                    'bg-white dark:bg-[#09090b]', /* Removed backdrop-blur for mobile performance */
                    'border-t border-gray-200 dark:border-white/[0.06]',
                    'px-2 gpu-accelerated contain-strict',
                    className
                )}
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="flex items-center justify-around pt-2">
                    {primaryItems.map((item) => {
                        const isActive = item.href === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.href);

                        return (
                            <NavLink
                                key={item.label}
                                to={item.href}
                                onClick={() => setShowMore(false)}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] rounded-xl',
                                    'transition-colors duration-150', /* Used specific transition instead of all */
                                    'active:scale-[0.92]', /* Offloaded tap animation to CSS */
                                    'relative',
                                    isActive
                                        ? 'text-blue-600 dark:text-white'
                                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                                )}
                            >
                                {/* Active background glow */}
                                {isActive && (
                                    <motion.div
                                        className="absolute inset-0 bg-blue-500/8 dark:bg-gray-500/10 rounded-xl"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.15 }}
                                    />
                                )}

                                <div className="relative z-10 flex items-center justify-center">
                                    <item.icon
                                        size={20}
                                        className={cn(
                                            'transition-colors duration-150',
                                            isActive && 'text-blue-600 dark:text-gray-200'
                                        )}
                                    />
                                </div>

                                <span className={cn(
                                    'text-[10px] font-medium relative z-10',
                                    isActive ? 'text-blue-600 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
                                )}>
                                    {item.label}
                                </span>

                                {/* Active dot indicator */}
                                {isActive && (
                                    <motion.div
                                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </NavLink>
                        );
                    })}

                    {/* More Button */}
                    <button
                        onClick={() => setShowMore(!showMore)}
                        className={cn(
                            'flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] rounded-xl',
                            'transition-colors duration-150 active:scale-[0.92]',
                            'relative',
                            showMore || isMoreActive
                                ? 'text-blue-600 dark:text-white'
                                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
                        )}
                    >
                        {(showMore || isMoreActive) && (
                            <motion.div
                                className="absolute inset-0 bg-blue-500/8 dark:bg-gray-500/10 rounded-xl"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.15 }}
                            />
                        )}
                        <div className="relative z-10 flex items-center justify-center">
                            <MoreHorizontal size={20} />
                        </div>
                        <span className={cn(
                            'text-[10px] font-medium relative z-10',
                            showMore || isMoreActive ? 'text-blue-600 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
                        )}>
                            More
                        </span>
                    </button>
                </div>
            </motion.nav>
        </>
    );
}

