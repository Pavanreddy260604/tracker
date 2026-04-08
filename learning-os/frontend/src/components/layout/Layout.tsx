import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PanelLeftClose,
    PanelLeftOpen,
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
    Film,
    ChevronDown,
    GraduationCap,
    Wrench,
    X
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useAI } from '../../contexts/AIContext';
import { ShortcutsModal } from '../ui/ShortcutsModal';
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts';
import { useMobile } from '../../hooks/useMobile';
import { cn } from '../../lib/utils';
import { BottomNav } from './BottomNav';
import { Breadcrumb } from '../ui/Breadcrumb';

interface LayoutProps {
    children: React.ReactNode;
    banner?: React.ReactNode;
}

const learningItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Code2, label: 'DSA Tracking', href: '/dsa' },
    { icon: Server, label: 'Backend Topics', href: '/backend' },
    { icon: FolderGit2, label: 'Projects', href: '/projects' },
    { icon: Map, label: 'Roadmap', href: '/roadmap' },
    { icon: BarChart2, label: 'Analytics', href: '/analytics' },
];

const toolItems = [
    { icon: MessageSquare, label: 'AI Chat', href: '/chat' },
    { icon: Bot, label: 'Interview Simulator', href: '/interview' },
    { icon: Film, label: 'Script Writer', href: '/script-writer', openNewWindow: true },
];

export function Layout({ children, banner }: LayoutProps) {
    const { isMobile } = useMobile();
    const [isDrawerOpen, setDrawerOpen] = useState(!isMobile);
    const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    // Collapsible Sidebar Sections mapped to folder state
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        learning: true,
        tools: window.location.pathname.startsWith('/interview'),
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const { user, logout } = useAuthStore();
    const { toggleOpen, isOpen } = useAI();

    const location = useLocation();
    const navigate = useNavigate();
    const profileDropdownRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const mainRef = useRef<HTMLElement>(null);

    // Sync drawer with mobile state on initial load
    useEffect(() => {
        setDrawerOpen(!isMobile);
    }, [isMobile]);

    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [location.pathname]);

    // Lock body scroll when mobile drawer is open
    useEffect(() => {
        if (isMobile && isDrawerOpen) {
            document.body.style.overflow = 'hidden';
            // Also prevent touchmove on the document body to stop iOS bounce
            const preventTouchMove = (e: TouchEvent) => e.preventDefault();
            document.addEventListener('touchmove', preventTouchMove, { passive: false });
            return () => {
                document.body.style.overflow = '';
                document.removeEventListener('touchmove', preventTouchMove);
            };
        } else {
            document.body.style.overflow = '';
        }
    }, [isMobile, isDrawerOpen]);

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
        <div className="app-shell" data-drawer={isDrawerOpen ? 'open' : 'closed'}>
            {banner}
            <header className="app-header">
                <div className="app-header__left">
                    {!isMobile && (
                        <button
                            onClick={toggleDrawer}
                            className="app-icon-btn"
                            aria-label={isDrawerOpen ? 'Collapse navigation' : 'Expand navigation'}
                        >
                            {isDrawerOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                    )}

                    <div className="app-brand">
                        <span className="app-brand__title">Learning OS</span>
                    </div>
                </div>

                <div className={cn("app-header__center", isMobileSearchOpen && "is-mobile-visible")}>
                    {(isMobileSearchOpen || !isMobile) && (
                        <div className="app-search w-full">
                            <Search size={18} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder={isMobile ? "Search..." : `Search resources... (Ctrl + ${SHORTCUTS.SEARCH.key.toUpperCase()})`}
                                className="app-search__input"
                            />
                            {!isMobile && <div className="app-search__key">/</div>}
                            {isMobile && (
                                <button 
                                    onClick={() => setIsMobileSearchOpen(false)}
                                    className="p-1 text-text-secondary"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="app-header__right">
                    {isMobile && (
                        <button
                            onClick={() => {
                                setIsMobileSearchOpen(true);
                                setTimeout(() => searchInputRef.current?.focus(), 100);
                            }}
                            className="app-icon-btn"
                            aria-label="Search"
                        >
                            <Search size={20} />
                        </button>
                    )}

                    {!isMobile && (
                        <button
                            onClick={() => setShowShortcuts(true)}
                            className="app-icon-btn"
                            title="Keyboard Shortcuts"
                        >
                            <Keyboard size={20} />
                        </button>
                    )}

                    {/* Notifications Dropdown (Hidden on Mobile) */}
                    {!isMobile && (
                        <div className="relative" ref={notificationsRef}>
                            <button
                                onClick={() => setNotificationsOpen(!isNotificationsOpen)}
                                className="app-icon-btn"
                                aria-label="Notifications"
                            >
                                <Bell size={20} />
                                <span className="app-notification-dot"></span>
                            </button>

                            {isNotificationsOpen && (
                                <>
                                    <div className="app-dropdown absolute bottom-auto top-[calc(100%+10px)] left-auto right-0 w-[280px] rounded-2xl z-50 p-3 flex flex-col gap-2.5">
                                        <div className="flex items-center justify-between text-xs text-text-secondary pb-2 border-none">
                                            <span>Notifications</span>
                                            <button className="text-accent-primary font-semibold hover:text-accent-dark">Mark all read</button>
                                        </div>
                                        <div className="text-center py-4 flex flex-col items-center gap-2">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent-soft text-accent-primary">
                                                <Bell size={20} />
                                            </div>
                                            <p className="text-sm font-medium text-text-primary">No new notifications</p>
                                            <span className="text-xs text-text-secondary">You're all caught up.</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <button
                        onClick={toggleOpen}
                        className={cn(
                            "app-icon-btn",
                            isOpen && "is-active",
                            "flex"
                        )}
                        title="Ask AI"
                    >
                        <Brain size={isMobile ? 18 : 20} />
                    </button>

                    {/* Profile Dropdown (Hidden on Mobile) */}
                    {!isMobile && (
                        <div className="relative" ref={profileDropdownRef}>
                            <button
                                onClick={() => setProfileDropdownOpen(!isProfileDropdownOpen)}
                                className="app-avatar"
                                title="Account"
                                aria-label="User menu"
                                aria-haspopup="true"
                                aria-expanded={isProfileDropdownOpen}
                            >
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileDropdownOpen && (
                                <>
                                    <div className="app-dropdown absolute bottom-auto top-[calc(100%+10px)] left-auto right-0 w-[280px] rounded-2xl z-50 p-3 flex flex-col gap-2.5" role="menu">
                                        <div className="grid grid-cols-[auto_1fr] gap-3 items-center p-2 mb-2 border-none">
                                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 border border-border-subtle text-text-primary font-bold text-lg flex items-center justify-center">
                                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                                <p className="app-dropdown__name">{user?.name || 'User'}</p>
                                                <p className="app-dropdown__email">{user?.email || ''}</p>
                                            </div>
                                        </div>

                                        <Link
                                            to="/settings"
                                            onClick={() => setProfileDropdownOpen(false)}
                                            className="app-dropdown__item"
                                            role="menuitem"
                                        >
                                            <Settings size={16} />
                                            Settings
                                        </Link>

                                        <button
                                            onClick={handleLogout}
                                            className="app-dropdown__item app-dropdown__item--danger"
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
                                </>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <div className="app-body">
                {!isMobile && (
                    <aside
                        className={`app-sidebar ${isDrawerOpen ? 'is-open' : 'is-closed'}`}
                    >
                        <div className="app-sidebar__inner">
                            <div className="app-sidebar__search md:hidden">
                                <div className="app-search">
                                    <Search size={18} />
                                    <input type="text" placeholder="Search..." className="app-search__input" />
                                </div>
                            </div>

                            {/* Learning Accordion Folder */}
                            <button
                                onClick={() => toggleSection('learning')}
                                className={cn(
                                    "w-full flex items-center px-3 py-2.5 rounded-xl text-text-secondary hover:bg-console-surface-2 hover:text-text-primary transition-all group mt-2",
                                    isDrawerOpen ? "justify-between" : "justify-center"
                                )}
                                title="Learning Core"
                            >
                                <div className="flex items-center gap-3">
                                    <GraduationCap size={18} className={cn("transition-colors", expandedSections.learning ? "text-accent-primary" : "")} />
                                    {isDrawerOpen && <span className="text-[11px] font-bold uppercase tracking-wider">Learning</span>}
                                </div>
                                {isDrawerOpen && (
                                    <ChevronDown size={14} className={cn("transition-transform duration-200", expandedSections.learning ? "rotate-180" : "rotate-0")} />
                                )}
                            </button>

                            {expandedSections.learning && (
                                <div className={cn("flex flex-col mt-0.5", isDrawerOpen && "pl-5 relative")}>
                                    {isDrawerOpen && <div className="absolute left-[20px] top-1 bottom-1 w-px bg-border-subtle/50" />}
                                    {learningItems.map((item) => {
                                        const isActive = location.pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                to={item.href}
                                                onClick={() => window.innerWidth < 768 && setDrawerOpen(false)}
                                                className={`app-nav-item ${isActive ? 'is-active' : ''} !py-2 !min-h-[36px]`}
                                            >
                                                <item.icon size={16} className="app-nav-item__icon" />
                                                {isDrawerOpen && item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Tools Accordion Folder */}
                            <button
                                onClick={() => toggleSection('tools')}
                                className={cn(
                                    "w-full flex items-center px-3 py-2.5 rounded-xl text-text-secondary hover:bg-console-surface-2 hover:text-text-primary transition-all group mt-1",
                                    isDrawerOpen ? "justify-between" : "justify-center"
                                )}
                                title="Tools Engine"
                            >
                                <div className="flex items-center gap-3">
                                    <Wrench size={18} className={cn("transition-colors", expandedSections.tools ? "text-accent-primary" : "")} />
                                    {isDrawerOpen && <span className="text-[11px] font-bold uppercase tracking-wider">Tools</span>}
                                </div>
                                {isDrawerOpen && (
                                    <ChevronDown size={14} className={cn("transition-transform duration-200", expandedSections.tools ? "rotate-180" : "rotate-0")} />
                                )}
                            </button>

                            {expandedSections.tools && (
                                <div className={cn("flex flex-col mt-0.5", isDrawerOpen && "pl-5 relative")}>
                                    {toolItems.map((item) => {
                                        const isActive = location.pathname === item.href;
                                         if (item.openNewWindow) {
                                            return (
                                                <Link
                                                    key={item.href}
                                                    to={item.href}
                                                    onClick={() => {
                                                        if (window.innerWidth < 768) setDrawerOpen(false);
                                                    }}
                                                    className={cn("app-nav-item !py-2 !min-h-[36px]", isActive && "is-active")}
                                                >
                                                    <item.icon size={16} className="app-nav-item__icon" />
                                                    {isDrawerOpen && item.label}
                                                </Link>
                                            );
                                        }

                                        return (
                                            <Link
                                                key={item.href}
                                                to={item.href}
                                                onClick={() => window.innerWidth < 768 && setDrawerOpen(false)}
                                                className={`app-nav-item ${isActive ? 'is-active' : ''} !py-2 !min-h-[36px]`}
                                            >
                                                <item.icon size={16} className="app-nav-item__icon" />
                                                {isDrawerOpen && item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Remove divider */}

                            {/* System Settings - Uncollapsible */}
                            {isDrawerOpen && (
                                <div className="px-3 py-2 text-[10px] font-bold text-text-secondary uppercase tracking-wider mt-1 mb-1">
                                    System
                                </div>
                            )}
                            <Link
                                to="/settings"
                                className={`app-nav-item ${location.pathname === '/settings' ? 'is-active' : ''}`}
                            >
                                <Settings size={18} className="app-nav-item__icon" />
                                {isDrawerOpen && 'Settings'}
                            </Link>
                        </div>
                    </aside>
                )}

                {/* Drawer Overlay for Mobile - Removed since sidebar is hidden on mobile */}

                {/* Main Content Area */}
                <main ref={mainRef} className="app-main overflow-x-hidden">
                    <div className="app-content px-4 sm:px-6 lg:px-8 py-6">
                        <Breadcrumb
                            items={[
                                { label: location.pathname === '/' ? 'Home' : location.pathname.split('/')[1].charAt(0).toUpperCase() + location.pathname.split('/')[1].slice(1), active: location.pathname.split('/').length === 2 },
                                ...(location.pathname.split('/').length > 2 ? [
                                    { 
                                        label: location.pathname.split('/')[2] === 'new' ? 'New' : 
                                               location.pathname.split('/')[2] === 'setup' ? 'Setup' : 'Detail', 
                                        active: true 
                                    }
                                ] : [])
                            ].filter(i => i.label !== '')}
                            className="mb-6"
                        />

                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                                className="w-full"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>

                {/* Bottom Navigation for Mobile (Hidden on /chat or when AI widget is open) */}
                {isMobile && (!isOpen && location.pathname !== '/chat') && <BottomNav />}

                <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
            </div>
        </div >
    );
}
