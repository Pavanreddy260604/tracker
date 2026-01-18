import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Code2,
    Server,
    FolderGit2,
    BarChart3,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
    collapsed?: boolean;
    onToggle?: () => void;
    className?: string;
}

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/', active: true },
    { icon: Code2, label: 'DSA Problems', href: '/dsa' },
    { icon: Server, label: 'Backend Topics', href: '/backend' },
    { icon: FolderGit2, label: 'Project Studies', href: '/projects' },
    { icon: BarChart3, label: 'Analytics', href: '/analytics' },
];

export function Sidebar({ collapsed = false, onToggle, className }: SidebarProps) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <motion.aside
            className={cn(
                'fixed left-0 top-0 h-screen z-50',
                'bg-white/95 dark:bg-[#0a0d12]/95 backdrop-blur-xl',
                'border-r border-gray-200 dark:border-white/[0.06]',
                'flex flex-col',
                'transition-all duration-300 ease-out',
                collapsed ? 'w-[72px]' : 'w-[260px]',
                className
            )}
            initial={false}
            animate={{ width: collapsed ? 72 : 260 }}
        >
            {/* Logo */}
            <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-white/[0.06]">
                <motion.div
                    className="flex items-center gap-3"
                    animate={{ opacity: collapsed ? 0 : 1 }}
                >
                    <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center shadow-sm">
                        <Sparkles size={20} className="text-gray-700 dark:text-white" />
                    </div>
                    {!collapsed && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                        >
                            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Learning OS</h1>
                            <p className="text-[10px] text-gray-500 -mt-0.5">Track • Learn • Grow</p>
                        </motion.div>
                    )}
                </motion.div>

                {collapsed && (
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
                        <Sparkles size={20} className="text-gray-900 dark:text-white" />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item, index) => (
                    <motion.div
                        key={item.label}
                        onClick={() => navigate(item.href)}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer',
                            'transition-all duration-200',
                            'group relative',
                            item.active
                                ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                        )}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        role="link"
                        tabIndex={0}
                    >
                        {/* Active indicator */}
                        {item.active && (
                            <motion.div
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gray-900 dark:bg-gray-700"
                                layoutId="activeIndicator"
                            />
                        )}

                        <item.icon size={20} className={cn(
                            'flex-shrink-0 transition-colors',
                            item.active && 'text-gray-900 dark:text-gray-300'
                        )} />

                        {!collapsed && (
                            <motion.span
                                className="text-sm font-medium"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {item.label}
                            </motion.span>
                        )}

                        {/* Tooltip for collapsed state */}
                        {collapsed && (
                            <div className="absolute left-full ml-3 px-3 py-1.5 bg-white dark:bg-[#1c2128] rounded-lg text-sm text-gray-900 dark:text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap border border-gray-200 dark:border-white/10 shadow-xl">
                                {item.label}
                            </div>
                        )}
                    </motion.div>
                ))}
            </nav>

            {/* User & Settings */}
            <div className="p-3 border-t border-gray-200 dark:border-white/[0.06] space-y-1">
                <div
                    onClick={() => navigate('/settings')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all cursor-pointer"
                    role="link"
                    tabIndex={0}
                >
                    <Settings size={20} />
                    {!collapsed && <span className="text-sm">Settings</span>}
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                >
                    <LogOut size={20} />
                    {!collapsed && <span className="text-sm">Logout</span>}
                </button>
            </div>

            {/* User Profile */}
            {!collapsed && user && (
                <div className="p-4 border-t border-gray-200 dark:border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-900 dark:text-white font-bold text-sm">
                            {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#2d333b] transition-colors shadow-lg"
            >
                {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
        </motion.aside>
    );
}
