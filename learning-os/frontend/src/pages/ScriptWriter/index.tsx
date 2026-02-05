import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { ProjectDashboard } from '../../components/script/ProjectDashboard';
import { SceneEditor } from '../../components/script/SceneEditor';
import { ScriptExplorer } from '../../components/script/ScriptExplorer';
import { StoryEngine } from '../../components/script/StoryEngine';
import { CastManager } from '../../components/script/CastManager';
import { cn } from '../../lib/utils';
import {
    Files, Settings, LayoutGrid, Users, LogOut
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                TOP NAVIGATION                              */
/* -------------------------------------------------------------------------- */
const TopNavigation = ({
    activeTab,
    onTabChange,
    projectTitle,
    onCloseProject
}: {
    activeTab: string,
    onTabChange: (tab: any) => void,
    projectTitle: string,
    onCloseProject: () => void
}) => {
    return (
        <div className="h-16 bg-[var(--sw-bg)] border-b border-[var(--sw-border)] flex items-center justify-between px-6 shrink-0 z-30">
            {/* LEFT: Branding & Project */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-[var(--sw-accent)]">
                    <div className="w-8 h-8 rounded-lg bg-[var(--sw-accent-soft)] flex items-center justify-center">
                        <Files size={18} />
                    </div>
                    <span className="font-bold tracking-tight text-lg text-[var(--sw-text)]">ScriptOS</span>
                </div>
                <div className="h-6 w-px bg-[var(--sw-border)]" />
                <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--sw-text-muted)] uppercase tracking-wider font-semibold">Current Project</span>
                    <span className="text-sm font-medium text-[var(--sw-text)]">{projectTitle}</span>
                </div>
            </div>

            {/* CENTER: Navigation Tabs */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center p-1 rounded-full bg-[var(--sw-surface)] border border-[var(--sw-border)]">
                {[
                    { id: 'editor', label: 'Write', icon: Files },
                    { id: 'map', label: 'Story Map', icon: LayoutGrid },
                    { id: 'cast', label: 'Cast', icon: Users },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                            activeTab === tab.id
                                ? "bg-[var(--sw-accent)] text-white shadow-lg shadow-blue-500/20"
                                : "text-[var(--sw-text-muted)] hover:text-[var(--sw-text)] hover:bg-[var(--sw-surface-2)]"
                        )}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* RIGHT: Actions */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => onTabChange('settings')}
                    className={cn(
                        "p-2 rounded-full text-[var(--sw-text-muted)] hover:bg-[var(--sw-surface-2)] transition-colors",
                        activeTab === 'settings' && "bg-[var(--sw-surface-2)] text-[var(--sw-text)]"
                    )}
                >
                    <Settings size={20} />
                </button>
                <button
                    onClick={onCloseProject}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--sw-text-muted)] hover:text-[#ff6b6b] hover:bg-[#ff6b6b]/10 transition-colors"
                >
                    <LogOut size={14} /> Exit
                </button>
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/*                                RESIZABLE PANEL                             */
/* -------------------------------------------------------------------------- */
const ResizableSidebar = ({ children, width, setWidth, visible }: { children: React.ReactNode, width: number, setWidth: (w: number) => void, visible: boolean }) => {
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = Math.max(200, Math.min(600, e.clientX)); // Adjusted limits for dashboard
            setWidth(newWidth);
        };
        const handleMouseUp = () => setIsResizing(false);
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, setWidth]);

    if (!visible) return null;

    return (
        <div className="relative h-full border-r border-[var(--sw-border)] bg-[var(--sw-surface)] flex flex-col" style={{ width: width, flexShrink: 0 }}>
            {children}
            <div
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[var(--sw-accent)] z-10 transition-colors opacity-0 hover:opacity-100"
                onMouseDown={() => setIsResizing(true)}
            />
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/*                                MAIN COMPONENT                              */
/* -------------------------------------------------------------------------- */
export function ScriptWriterPage() {
    const activeProject = useProjectStore(state => state.activeProject);
    const clearActiveProject = useProjectStore(state => state.clearActiveProject);

    // Navigation State
    const [viewMode, setViewMode] = useState<'editor' | 'map' | 'cast' | 'settings' | 'home'>('home');
    const [sidebarWidth, setSidebarWidth] = useState(280); // Slightly wider for premium feel

    // Sync view with project state
    useEffect(() => {
        if (!activeProject) {
            setViewMode('home');
        } else if (viewMode === 'home') {
            setViewMode('editor');
        }
    }, [activeProject]);

    // MODE 1: LANDING / DASHBOARD
    if (!activeProject || viewMode === 'home') {
        return (
            <div className="h-full bg-[var(--sw-bg)] text-[var(--sw-text)] flex flex-col font-sans">
                <div className="flex-1 overflow-hidden">
                    <ProjectDashboard />
                </div>
            </div>
        );
    }

    // MODE 2: PREMIUM DASHBOARD
    return (
        <div className="flex flex-col h-full bg-[var(--sw-bg)] text-[var(--sw-text)] font-sans antialiased overflow-hidden selection:bg-[var(--sw-accent-soft)]">

            <TopNavigation
                activeTab={viewMode}
                onTabChange={setViewMode}
                projectTitle={activeProject.title}
                onCloseProject={clearActiveProject}
            />

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex overflow-hidden">

                {/* SIDEBAR (Only visible in Editor mode) */}
                {viewMode === 'editor' && (
                    <ResizableSidebar width={sidebarWidth} setWidth={setSidebarWidth} visible={true}>
                        <ScriptExplorer />
                    </ResizableSidebar>
                )}

                {/* WORKSPACE */}
                <div className="flex-1 flex flex-col min-w-0 bg-[var(--sw-bg)] relative overflow-hidden">
                    {/* View Router */}
                    {viewMode === 'editor' && <SceneEditor />}

                    {viewMode === 'map' && (
                        <div className="h-full overflow-y-auto p-8 animate-in fade-in zoom-in-95 duration-300">
                            <div className="max-w-6xl mx-auto">
                                <StoryEngine />
                            </div>
                        </div>
                    )}

                    {viewMode === 'cast' && (
                        <div className="h-full overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
                            <CastManager />
                        </div>
                    )}

                    {viewMode === 'settings' && (
                        <div className="h-full overflow-y-auto p-12 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                            <h1 className="text-3xl font-light mb-8 text-[var(--sw-text)]">Settings</h1>
                            <div className="space-y-6">
                                <div className="p-6 rounded-xl border border-[var(--sw-border)] bg-[var(--sw-surface)]">
                                    <h3 className="text-lg font-medium mb-4 text-[var(--sw-text)]">Project: {activeProject.title}</h3>
                                    <p className="text-sm text-[var(--sw-text-muted)] mb-6">Manage your project settings and export options here.</p>
                                    <button className="px-4 py-2 bg-[var(--sw-surface-2)] border border-[var(--sw-border)] rounded-lg text-sm hover:bg-[var(--sw-border)] transition-colors">
                                        Export to PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
