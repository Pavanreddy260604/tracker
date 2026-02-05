import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
    Menu,
    Search,
    Bell,
    LayoutDashboard,
    Code2,
    Server,
    FolderGit2,
    BarChart2,
    Settings,
    Keyboard,
    Map,
    Bot,
    Brain,
    MessageSquare,
    Film
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useAI } from '../../contexts/AIContext';
import { ShortcutsModal } from '../ui/ShortcutsModal';
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

interface LayoutProps {
    children: ReactNode;
}

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Code2, label: 'DSA Tracking', href: '/dsa' },
    { icon: Server, label: 'Backend Topics', href: '/backend' },
    { icon: Map, label: 'Roadmap', href: '/roadmap' },
    { icon: FolderGit2, label: 'Projects', href: '/projects' },
    { icon: Bot, label: 'Interview Simulator', href: '/interview' },
    { icon: Film, label: 'Script Writer', href: '/script-writer', openNewWindow: true },
    { icon: BarChart2, label: 'Analytics', href: '/analytics' },
];

export function Layout({ children }: LayoutProps) {
    const [isDrawerOpen, setDrawerOpen] = useState(true); // Default open on desktop
    const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    const { user, logout } = useAuthStore();
    const { toggleOpen, isOpen } = useAI();

    const location = useLocation();
    const navigate = useNavigate();
    const profileDropdownRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const toggleDrawer = () => setDrawerOpen(!isDrawerOpen);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === SHORTCUTS.SEARCH.key.toLowerCase()) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
                setProfileDropdownOpen(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="app-shell flex flex-col min-h-screen text-gray-900 dark:text-white overflow-hidden">
            {/* GCP Top App Bar */}
            <header className="gcp-app-bar flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleDrawer}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-600 dark:text-gray-300"
                    >
                        <Menu size={20} />
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="font-medium text-lg tracking-tight text-gray-700 dark:text-gray-200">Learning OS</span>
                    </div>
                </div>

                {/* Search Box - Hidden on small mobile */}
                <div className="hidden md:flex flex-1 max-w-2xl mx-8">
                    <div className="gcp-search-box w-full">
                        <Search size={18} className="text-gray-500 dark:text-gray-400 mr-2" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={`Search resources... (Ctrl + ${SHORTCUTS.SEARCH.key.toUpperCase()})`}
                            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-[color:var(--text-disabled)] text-[color:var(--text-primary)]"
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">/</div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 text-gray-400">
                    <button
                        onClick={toggleOpen}
                        className={`p-2 rounded-full transition-colors ${isOpen
                            ? 'bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-white ring-1 ring-blue-500/20'
                            : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400'
                            }`}
                        title="Ask AI"
                    >
                        <Brain size={20} />
                    </button>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400"
                        title="Keyboard Shortcuts"
                    >
                        <Keyboard size={20} />
                    </button>

                    {/* Notifications Dropdown */}
                    <div className="relative" ref={notificationsRef}>
                        <button
                            onClick={() => setNotificationsOpen(!isNotificationsOpen)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400 relative"
                            aria-label="Notifications"
                        >
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-[#1f1f1f]"></span>
                        </button>

                        {isNotificationsOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#2d2d2d] rounded-lg shadow-xl border border-gray-200 dark:border-[#3c4043] py-2 z-50">
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-[#3c4043] flex justify-between items-center">
                                    <span className="font-semibold text-gray-900 dark:text-white">Notifications</span>
                                    <span className="text-xs text-blue-500 cursor-pointer hover:underline">Mark all read</span>
                                </div>
                                <div className="p-4 flex flex-col items-center justify-center text-center py-8">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                                        <Bell size={20} className="text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">No new notifications</p>
                                    <p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative" ref={profileDropdownRef}>
                        <button
                            onClick={() => setProfileDropdownOpen(!isProfileDropdownOpen)}
                            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-white text-sm font-semibold ml-2 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-900 transition-colors shadow-sm"
                            title="Account"
                            aria-label="User menu"
                            aria-haspopup="true"
                            aria-expanded={isProfileDropdownOpen}
                        >
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </button>

                        {/* Dropdown Menu */}
                        {isProfileDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#2d2d2d] rounded-lg shadow-xl border border-gray-200 dark:border-[#3c4043] py-2 z-50" role="menu">
                                {/* User Info */}
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-[#3c4043]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-white text-base font-semibold">
                                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || 'User'}</p>
                                            <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Settings Link */}
                                <Link
                                    to="/settings"
                                    onClick={() => setProfileDropdownOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                    role="menuitem"
                                >
                                    <Settings size={16} />
                                    Settings
                                </Link>

                                {/* Sign Out Button */}
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    role="menuitem"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header >

            <div className="flex flex-1 overflow-hidden relative">
                {/* Navigation Drawer */}
                {/* Navigation Drawer */}
                <aside
                    className={`
            gcp-drawer 
            fixed md:static 
            inset-y-0 left-0 z-40
            w-64 shrink-0
            flex flex-col
            transform transition-all duration-200 ease-in-out
            ${isDrawerOpen ? 'translate-x-0 md:ml-0' : '-translate-x-full md:-ml-64'}
          `}
                    style={{ top: 'var(--app-bar-height)' }} // Ignored when static (desktop)
                >
                    {/* Mobile Search - Visible only in drawer on mobile */}
                    <div className="md:hidden p-4">
                        <div className="gcp-search-box w-full">
                            <Search size={18} className="text-gray-500 dark:text-gray-400 mr-2" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-[color:var(--text-disabled)] text-[color:var(--text-primary)]"
                            />
                        </div>
                    </div>

                    <nav className="flex-1 py-2 overflow-y-auto">
                        <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Pinned
                        </div>

                        {navItems.map((item) => {
                            const isActive = location.pathname === item.href;

                            // Handle new window items differently
                            if (item.openNewWindow) {
                                return (
                                    <button
                                        key={item.href}
                                        onClick={() => {
                                            window.open(item.href, '_blank', 'noopener,noreferrer');
                                            if (window.innerWidth < 768) setDrawerOpen(false);
                                        }}
                                        className={`gcp-nav-item group mx-2 mb-0.5 w-[calc(100%-16px)] text-left ${isActive ? 'active' : ''}`}
                                    >
                                        <item.icon size={18} className={`mr-3 ${isActive ? 'text-[color:var(--accent-primary-dark)]' : 'text-gray-400 group-hover:text-gray-300'}`} />
                                        {item.label}
                                    </button>
                                );
                            }

                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    onClick={() => window.innerWidth < 768 && setDrawerOpen(false)}
                                    className={`gcp-nav-item group mx-2 mb-0.5 ${isActive ? 'active' : ''}`}
                                >
                                    <item.icon size={18} className={`mr-3 ${isActive ? 'text-[color:var(--accent-primary-dark)]' : 'text-gray-400 group-hover:text-gray-300'}`} />
                                    {item.label}
                                </Link>
                            );
                        })}

                        <div className="my-2 border-t border-gray-200 dark:border-[#3c4043]" />

                        <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            More Products
                        </div>

                        <Link
                            to="/chat"
                            className="gcp-nav-item group mx-2"
                        >
                            <MessageSquare size={18} className="mr-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                            AI Chat
                        </Link>

                        <Link
                            to="/settings"
                            className="gcp-nav-item group mx-2"
                        >
                            <Settings size={18} className="mr-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                            Settings
                        </Link>
                    </nav>
                </aside>

                {/* Drawer Overlay for Mobile */}
                {isDrawerOpen && (
                    <div
                        className="md:hidden fixed inset-0 bg-black/50 z-30"
                        onClick={() => setDrawerOpen(false)}
                        style={{ top: 'var(--app-bar-height)' }}
                    />
                )}

                {/* Main Content Area */}
                <main
                    className="app-main flex-1 overflow-auto min-w-0 relative"
                >
                    <div className="p-4 md:p-6">
                        {children}
                    </div>
                </main>

                <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
            </div>
        </div >
    );
}
