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
    { icon: Server, label: 'Backend', href: '/backend' },
    { icon: FolderGit2, label: 'Projects', href: '/projects' },
];

const learningMoreItems = [
    { icon: Map, label: 'Roadmap', href: '/roadmap' },
    { icon: BarChart2, label: 'Analytics', href: '/analytics' },
];

const toolItems = [
    { icon: MessageSquare, label: 'AI Chat', href: '/chat' },
    { icon: Bot, label: 'Interview', href: '/interview' },
    { icon: Film, label: 'Script Writer', href: '/script-writer' },
];

const systemItems = [
    { icon: Settings, label: 'Settings', href: '/settings' },
];

export function BottomNav({ className }: BottomNavProps) {
    const location = useLocation();
    const [showMore, setShowMore] = useState(false);

    // Check if current route is in "more" items
    const isMoreActive = [...learningMoreItems, ...toolItems, ...systemItems].some(item =>
        item.href === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.href)
    );

    const renderMenuItem = (item: any) => {
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
                        ? 'bg-accent-soft text-accent-primary'
                        : 'text-text-tertiary active:bg-console-surface-2'
                )}
            >
                <item.icon size={20} />
                <span className="text-[11px] font-medium">{item.label}</span>
            </NavLink>
        );
    };

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
                            className="fixed bottom-[var(--bottom-nav-height)] left-3 right-3 z-[60] md:hidden rounded-2xl border border-border-subtle bg-console-elevated/40 backdrop-blur-2xl shadow-premium overflow-hidden gpu-accelerated contain-strict liquid-glass glow-border"
                            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                                <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">More</span>
                                <button
                                    onClick={() => setShowMore(false)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-console-surface-2"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-3">
                                <div className="px-2 mb-2 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Learning</div>
                                <div className="grid grid-cols-4 gap-1 mb-4">
                                    {learningMoreItems.map(renderMenuItem)}
                                </div>
                                <div className="px-2 mb-2 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Tools</div>
                                <div className="grid grid-cols-4 gap-1 mb-4">
                                    {toolItems.map(renderMenuItem)}
                                </div>
                                <div className="px-2 mb-2 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">System</div>
                                <div className="grid grid-cols-4 gap-1">
                                    {systemItems.map(renderMenuItem)}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <motion.nav
                className={cn(
                    'app-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden',
                    'bg-console-bg/80 backdrop-blur-2xl',
                    'border-t border-border-subtle shadow-premium',
                    'px-2 gpu-accelerated contain-strict',
                    className
                )}
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="flex items-center justify-around pt-1">
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
                                    'flex flex-col items-center justify-center min-w-[50px] min-h-[38px] rounded-xl',
                                    'transition-colors duration-150', /* Used specific transition instead of all */
                                    'active:scale-[0.92]', /* Offloaded tap animation to CSS */
                                    'relative',
                                    isActive
                                        ? 'text-accent-primary'
                                        : 'text-text-tertiary hover:text-text-secondary'
                                )}
                            >
                                {/* Active background glow */}
                                {isActive && (
                                    <motion.div
                                        className="absolute inset-0 bg-accent-soft rounded-xl"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.15 }}
                                    />
                                )}

                                <div className="relative z-10 flex items-center justify-center mb-0.5">
                                    <item.icon
                                        size={16}
                                        className={cn(
                                            'transition-colors duration-150',
                                            isActive && 'text-accent-primary'
                                        )}
                                    />
                                </div>

                                <span className={cn(
                                    'text-[9px] font-normal relative z-10',
                                    isActive ? 'text-accent-primary' : 'text-text-tertiary'
                                )}>
                                    {item.label}
                                </span>

                                {/* Active dot indicator */}
                                {isActive && (
                                    <motion.div
                                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_8px_rgba(var(--accent-primary-rgb),0.5)]"
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
                            'flex flex-col items-center justify-center min-w-[50px] min-h-[38px] rounded-xl',
                            'transition-colors duration-150 active:scale-[0.92]',
                            'relative',
                            showMore || isMoreActive
                                ? 'text-accent-primary'
                                : 'text-text-tertiary hover:text-text-secondary'
                        )}
                    >
                        {(showMore || isMoreActive) && (
                            <motion.div
                                className="absolute inset-0 bg-accent-soft rounded-xl"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.15 }}
                            />
                        )}
                        <div className="relative z-10 flex items-center justify-center mb-0.5">
                            <MoreHorizontal size={16} />
                        </div>
                        <span className={cn(
                            'text-[9px] font-normal relative z-10',
                            showMore || isMoreActive ? 'text-accent-primary' : 'text-text-tertiary'
                        )}>
                            More
                        </span>
                    </button>
                </div>
            </motion.nav>
        </>
    );
}
