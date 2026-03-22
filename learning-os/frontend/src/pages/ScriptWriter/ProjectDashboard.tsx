import { useState } from 'react';
import { Plus, FolderOpen, Clock, FileText, Loader2, Trash2, Calendar, Layout, Sparkles, Database } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { useDialog } from '../../hooks/useDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Bible } from '../../services/project.api';
import type { ProjectForm } from './types';
import { shouldOfferTransliteration } from './utils';

type DashboardFilter = 'all' | 'recent' | 'admin';

interface ProjectDashboardProps {
    projects: Bible[];
    loadingProjects: boolean;
    onProjectSelect: (projectId: string) => void;
    isCreatingProject: boolean;
    creatingProject: boolean;
    newProjectForm: ProjectForm;
    onNewProjectClick: () => void;
    onNewProjectCancel: () => void;
    onNewProjectFieldChange: <K extends keyof ProjectForm>(field: K, value: ProjectForm[K]) => void;
    onNewProjectSubmit: () => void;
    onProjectDelete?: (projectId: string) => void;
}

export function ProjectDashboard({
    projects,
    loadingProjects,
    onProjectSelect,
    isCreatingProject,
    creatingProject,
    newProjectForm,
    onNewProjectClick,
    onNewProjectCancel,
    onNewProjectFieldChange,
    onNewProjectSubmit,
    onProjectDelete
}: ProjectDashboardProps) {
    const { dialog, showConfirm, closeDialog } = useDialog();
    const [filter, setFilter] = useState<DashboardFilter>('all');
    const filterTabs: Array<{ id: DashboardFilter; label: string; icon: typeof Layout }> = [
        { id: 'all', label: 'All Projects', icon: Layout },
        { id: 'recent', label: 'Recent', icon: Clock },
        { id: 'admin', label: 'Master Feed', icon: Database }
    ];

    const projectsList = Array.isArray(projects) ? projects.filter(Boolean) : [];
    
    const sortedProjects = [...projectsList].sort((a, b) => {
        try {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        } catch (e) {
            return 0;
        }
    });

    const displayedProjects = filter === 'recent' ? sortedProjects.slice(0, 6) : sortedProjects;

    return (
        <div className="h-screen w-full overflow-y-auto bg-console-bg text-text-primary selection:bg-accent-primary/30">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-accent-primary font-bold tracking-tighter uppercase text-xs">
                            <Sparkles size={14} />
                            Infinite Desk
                        </div>
                        <h1 className="text-5xl font-black bg-gradient-to-r from-text-primary via-text-primary/80 to-text-secondary bg-clip-text text-transparent tracking-tight">
                            Studio Dashboard
                        </h1>
                        <p className="text-text-secondary text-lg max-w-2xl font-medium">
                            Your stories, organized. Select an existing manuscript or begin a new journey.
                        </p>
                    </div>

                    <button
                        onClick={onNewProjectClick}
                        className="group flex items-center gap-2 px-6 py-3 bg-accent-primary hover:bg-accent-primary-dark text-console-bg rounded-full font-bold transition-all shadow-lg shadow-accent-primary/20 active:scale-95 hover:scale-105"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        Create New Script
                    </button>
                </div>

                {/* Main Content Overlay */}
                <div className="bg-console-surface/50 border border-border-subtle/50 rounded-3xl backdrop-blur-md p-8">
                    {/* Filters & Actions */}
                    <div className="flex items-center justify-between mb-8 border-b border-border-subtle pb-6">
                        <div className="flex items-center gap-1 bg-console-bg/50 p-1 rounded-xl border border-border-subtle">
                            {filterTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                        ${filter === tab.id
                                            ? 'bg-console-surface text-text-primary shadow-inner'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-console-surface/50'}
                                    `}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="hidden md:flex items-center gap-4 text-xs text-text-secondary font-mono">
                            <div className="flex items-center gap-1.5 ">
                                <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
                                {projects.length} PROJECTS
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Content */}
                    {filter === 'admin' ? (
                        <AdminPanel />
                    ) : loadingProjects ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <Loader2 size={40} className="animate-spin text-accent-primary" />
                            <p className="text-text-secondary font-medium animate-pulse">Scanning Library...</p>
                        </div>
                    ) : displayedProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center pt-12 pb-32 text-center space-y-6">
                            <div className="w-20 h-20 bg-console-bg rounded-3xl flex items-center justify-center border border-border-subtle shadow-2xl">
                                <FolderOpen size={32} className="text-text-tertiary" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">The page is blank.</h3>
                                <p className="text-text-secondary max-w-xs">Every masterpiece starts with a single project. Create yours now.</p>
                            </div>
                            <button
                                onClick={onNewProjectClick}
                                className="px-6 py-2.5 bg-text-primary hover:bg-text-secondary text-console-bg rounded-full font-bold transition-colors shadow-xl"
                            >
                                Start Your Mission
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayedProjects.map((project) => (
                                <div
                                    key={project._id}
                                    className="group relative"
                                >
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onProjectSelect(project._id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onProjectSelect(project._id);
                                            }
                                        }}
                                        className="w-full text-left p-6 bg-console-bg/40 border border-border-subtle rounded-2xl hover:bg-console-surface/50 hover:border-accent-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-accent-primary/10 group-hover:-translate-y-1 block cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-console-surface rounded-xl border border-border-subtle group-hover:border-accent-primary/50 group-hover:bg-accent-primary/10 transition-all">
                                                    <FileText size={20} className="text-text-secondary group-hover:text-accent-primary" />
                                                </div>
                                                <div className="bg-console-bg px-2 py-1 rounded-md border border-border-subtle text-[10px] font-bold text-text-secondary group-hover:text-accent-primary transition-colors uppercase tracking-widest">
                                                    {project.genre}
                                                </div>
                                            </div>

                                            {onProjectDelete && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        showConfirm(
                                                            'Delete Project',
                                                            `Are you sure you want to delete "${project.title}"? This cannot be undone.`,
                                                            () => onProjectDelete(project._id)
                                                        );
                                                    }}
                                                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-status-error/10 hover:text-status-error text-text-tertiary rounded-xl transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-2 mb-6">
                                            <h3 className="text-xl font-bold text-text-primary transition-colors truncate">
                                                {project.title}
                                            </h3>
                                            {project.logline ? (
                                                <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed h-10 italic font-serif">
                                                    "{project.logline}"
                                                </p>
                                            ) : (
                                                <p className="text-sm text-text-tertiary italic h-10">No logline provided yet...</p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between border-t border-border-subtle/50 pt-4 mt-2">
                                            <div className="flex items-center gap-1.5 text-text-tertiary text-[10px] font-bold uppercase tracking-tighter">
                                                <Calendar size={12} />
                                                {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="text-accent-primary text-[11px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                OPEN STUDIO <Plus size={12} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Create Project Modal Overlay */}
            {isCreatingProject && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0 animate-in fade-in duration-300 backdrop-blur-xl bg-black/60"
                    onClick={onNewProjectCancel}
                >
                    <div
                        className="bg-console-bg border border-border-subtle w-full max-w-lg rounded-3xl shadow-2xl shadow-accent-primary/20 overflow-hidden animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-8 pb-4">
                            <h2 className="text-3xl font-black bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent mb-2">
                                Begin New Story
                            </h2>
                            <p className="text-text-secondary text-sm">Define the core parameters of your next masterpiece.</p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">Project Title</label>
                                <input
                                    className="w-full bg-console-surface/50 border border-border-subtle rounded-2xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none transition-all shadow-inner hover:border-text-secondary"
                                    value={newProjectForm.title}
                                    onChange={(e) => onNewProjectFieldChange('title', e.target.value)}
                                    placeholder="e.g. The Last Horizon"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">Primary Genre</label>
                                    <select
                                        className="w-full bg-console-surface/50 border border-border-subtle rounded-2xl px-4 py-3 text-text-primary outline-none focus:border-accent-primary transition-all cursor-pointer hover:border-text-secondary"
                                        value={newProjectForm.genre}
                                        onChange={(e) => onNewProjectFieldChange('genre', e.target.value)}
                                    >
                                        <option value="drama">Drama</option>
                                        <option value="comedy">Comedy</option>
                                        <option value="action">Action</option>
                                        <option value="thriller">Thriller</option>
                                        <option value="horror">Horror</option>
                                        <option value="sci-fi">Sci-Fi</option>
                                        <option value="romance">Romance</option>
                                        <option value="documentary">Documentary</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">Target Language</label>
                                    <select
                                        className="w-full bg-console-surface/50 border border-border-subtle rounded-2xl px-4 py-3 text-text-primary outline-none focus:border-accent-primary transition-all hover:border-text-secondary font-bold text-accent-primary cursor-pointer"
                                        value={newProjectForm.language}
                                        onChange={(e) => onNewProjectFieldChange('language', e.target.value)}
                                    >
                                        <option value="English">English</option>
                                        <option value="Telugu">Telugu</option>
                                        <option value="Hindi">Hindi</option>
                                        <option value="Tamil">Tamil</option>
                                        <option value="Kannada">Kannada</option>
                                        <option value="Malayalam">Malayalam</option>
                                        <option value="Spanish">Spanish</option>
                                        <option value="French">French</option>
                                        <option value="German">German</option>
                                    </select>
                                </div>
                            </div>

                            {shouldOfferTransliteration(newProjectForm.language || 'English') && (
                                <div className="flex items-center justify-between p-4 bg-accent-primary/10 border border-accent-primary/20 rounded-2xl">
                                    <div className="space-y-0.5">
                                        <div className="text-[10px] font-black text-accent-primary uppercase tracking-widest">Phonetic Transliteration</div>
                                        <div className="text-[11px] text-text-secondary font-medium">Use English alphabet for native dialogue</div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={newProjectForm.transliteration}
                                            onChange={(e) => onNewProjectFieldChange('transliteration', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-console-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border-subtle after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-white"></div>
                                    </label>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">Target Scene Count</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className="w-full bg-console-surface/50 border border-border-subtle rounded-2xl px-4 py-3 text-text-primary outline-none focus:border-accent-primary transition-all hover:border-text-secondary"
                                        value={newProjectForm.targetSceneCount || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            onNewProjectFieldChange('targetSceneCount', parseInt(val) || 0);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">Hook / Logline</label>
                                <textarea
                                    className="w-full bg-console-surface/50 border border-border-subtle rounded-2xl px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent-primary outline-none transition-all resize-none shadow-inner hover:border-text-secondary font-serif italic"
                                    value={newProjectForm.logline}
                                    onChange={(e) => onNewProjectFieldChange('logline', e.target.value)}
                                    placeholder="In a world where..."
                                    rows={4}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 pt-2 flex gap-3">
                            <button
                                className="flex-1 px-6 py-3 border border-border-subtle hover:bg-console-surface rounded-2xl text-text-secondary font-bold transition-all"
                                onClick={onNewProjectCancel}
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-[2] px-6 py-3 bg-accent-primary hover:bg-accent-primary-dark disabled:bg-console-surface-2 disabled:text-text-secondary text-console-bg rounded-2xl font-bold transition-all shadow-xl shadow-accent-primary/20 flex items-center justify-center gap-2"
                                onClick={onNewProjectSubmit}
                                disabled={creatingProject || !newProjectForm.title.trim()}
                            >
                                {creatingProject ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                {creatingProject ? 'Initializing...' : 'Commence Production'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => { })}
                title={dialog.title}
                description={dialog.description}
                variant="danger"
                confirmLabel="Delete Project"
            />
        </div>
    );
}
