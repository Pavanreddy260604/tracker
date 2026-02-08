import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
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
        <div className="app-shell" data-drawer={isDrawerOpen ? 'open' : 'closed'}>
            <header className="app-header">
                <div className="app-header__left">
                    <button
                        onClick={toggleDrawer}
                        className="app-icon-btn"
                        aria-label={isDrawerOpen ? 'Collapse navigation' : 'Expand navigation'}
                    >
                        {isDrawerOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                    </button>

                    <div className="app-brand">
                        <span className="app-brand__title">Learning OS</span>
                        <span className="app-brand__chip">Studio</span>
                    </div>
                </div>

                <div className="app-header__center">
                    <div className="app-search">
                        <Search size={18} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder={`Search resources... (Ctrl + ${SHORTCUTS.SEARCH.key.toUpperCase()})`}
                            className="app-search__input"
                        />
                        <div className="app-search__key">/</div>
                    </div>
                </div>

                <div className="app-header__right">
                    <button
                        onClick={toggleOpen}
                        className={`app-icon-btn ${isOpen ? 'is-active' : ''}`}
                        title="Ask AI"
                    >
                        <Brain size={20} />
                    </button>
                    <button
                        onClick={() => setShowShortcuts(true)}
                        className="app-icon-btn"
                        title="Keyboard Shortcuts"
                    >
                        <Keyboard size={20} />
                    </button>

                    {/* Notifications Dropdown */}
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
                            <div className="app-dropdown">
                                <div className="app-dropdown__header">
                                    <span>Notifications</span>
                                    <button className="app-link">Mark all read</button>
                                </div>
                                <div className="app-dropdown__empty">
                                    <div className="app-dropdown__icon">
                                        <Bell size={20} />
                                    </div>
                                    <p>No new notifications</p>
                                    <span>You're all caught up.</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile Dropdown */}
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
                            <div className="app-dropdown" role="menu">
                                <div className="app-dropdown__profile">
                                    <div className="app-avatar app-avatar--large">
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
                        )}
                    </div>
                </div>
            </header>

            <div className="app-body">
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

                        <div className="app-sidebar__label">Pinned</div>

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
                                        className={`app-nav-item ${isActive ? 'is-active' : ''}`}
                                    >
                                        <item.icon size={18} className="app-nav-item__icon" />
                                        {isDrawerOpen && item.label}
                                    </button>
                                );
                            }

                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    onClick={() => window.innerWidth < 768 && setDrawerOpen(false)}
                                    className={`app-nav-item ${isActive ? 'is-active' : ''}`}
                                >
                                    <item.icon size={18} className="app-nav-item__icon" />
                                    {isDrawerOpen && item.label}
                                </Link>
                            );
                        })}

                        <div className="app-sidebar__divider" />

                        {isDrawerOpen && <div className="app-sidebar__label">More Products</div>}

                        <Link
                            to="/chat"
                            className="app-nav-item"
                        >
                            <MessageSquare size={18} className="app-nav-item__icon" />
                            {isDrawerOpen && 'AI Chat'}
                        </Link>

                        <Link
                            to="/settings"
                            className="app-nav-item"
                        >
                            <Settings size={18} className="app-nav-item__icon" />
                            {isDrawerOpen && 'Settings'}
                        </Link>
                    </div>
                </aside>

                {/* Drawer Overlay for Mobile */}
                {isDrawerOpen && <div className="app-overlay md:hidden" onClick={() => setDrawerOpen(false)} />}

                {/* Main Content Area */}
                <main className="app-main">
                    <div className="app-content">{children}</div>
                </main>

                <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
            </div>
        </div >
    );
}
