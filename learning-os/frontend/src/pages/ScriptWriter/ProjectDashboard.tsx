import { useState } from 'react';
import { Plus, FolderOpen, Clock, FileText, Loader2, Trash2, Calendar, Layout, Sparkles } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Bible } from '../../services/project.api';
import type { ProjectForm } from './types';

interface ProjectDashboardProps {
    projects: Bible[];
    loadingProjects: boolean;
    onProjectSelect: (projectId: string) => void;
    isCreatingProject: boolean;
    creatingProject: boolean;
    newProjectForm: ProjectForm;
    onNewProjectClick: () => void;
    onNewProjectCancel: () => void;
    onNewProjectFieldChange: (field: keyof ProjectForm, value: string) => void;
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
    const [filter, setFilter] = useState<'all' | 'recent'>('all');

    const sortedProjects = [...projects].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const displayedProjects = filter === 'recent' ? sortedProjects.slice(0, 6) : sortedProjects;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-blue-500/30">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-tighter uppercase text-xs">
                            <Sparkles size={14} />
                            Infinite Desk
                        </div>
                        <h1 className="text-5xl font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent tracking-tight">
                            Studio Dashboard
                        </h1>
                        <p className="text-zinc-400 text-lg max-w-2xl font-medium">
                            Your stories, organized. Select an existing manuscript or begin a new journey.
                        </p>
                    </div>

                    <button
                        onClick={onNewProjectClick}
                        className="group flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95 hover:scale-105"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        Create New Script
                    </button>
                </div>

                {/* Main Content Overlay */}
                <div className="bg-zinc-900/20 border border-zinc-800/50 rounded-3xl backdrop-blur-md p-8">
                    {/* Filters & Actions */}
                    <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-6">
                        <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded-xl border border-zinc-800">
                            {[
                                { id: 'all', label: 'All Projects', icon: Layout },
                                { id: 'recent', label: 'Recent', icon: Clock }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id as any)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                        ${filter === tab.id
                                            ? 'bg-zinc-800 text-white shadow-inner'
                                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}
                                    `}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="hidden md:flex items-center gap-4 text-xs text-zinc-500 font-mono">
                            <div className="flex items-center gap-1.5 ">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                {projects.length} PROJECTS
                            </div>
                        </div>
                    </div>

                    {/* Projects Grid */}
                    {loadingProjects ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <Loader2 size={40} className="animate-spin text-blue-500" />
                            <p className="text-zinc-500 font-medium animate-pulse">Scanning Library...</p>
                        </div>
                    ) : displayedProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center pt-12 pb-32 text-center space-y-6">
                            <div className="w-20 h-20 bg-zinc-950 rounded-3xl flex items-center justify-center border border-zinc-800 shadow-2xl">
                                <FolderOpen size={32} className="text-zinc-700" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">The page is blank.</h3>
                                <p className="text-zinc-500 max-w-xs">Every masterpiece starts with a single project. Create yours now.</p>
                            </div>
                            <button
                                onClick={onNewProjectClick}
                                className="px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-full font-bold transition-colors shadow-xl"
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
                                        className="w-full text-left p-6 bg-zinc-950/40 border border-zinc-800 rounded-2xl hover:bg-zinc-900/50 hover:border-blue-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/10 group-hover:-translate-y-1 block cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 group-hover:border-blue-500/50 group-hover:bg-blue-950/20 transition-all">
                                                    <FileText size={20} className="text-zinc-400 group-hover:text-blue-400" />
                                                </div>
                                                <div className="bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800 text-[10px] font-bold text-zinc-500 group-hover:text-blue-400 transition-colors uppercase tracking-widest">
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
                                                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-950/30 hover:text-red-400 text-zinc-600 rounded-xl transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-2 mb-6">
                                            <h3 className="text-xl font-bold text-zinc-100 group-hover:text-white transition-colors truncate">
                                                {project.title}
                                            </h3>
                                            {project.logline ? (
                                                <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed h-10 italic font-serif">
                                                    "{project.logline}"
                                                </p>
                                            ) : (
                                                <p className="text-sm text-zinc-600 italic h-10">No logline provided yet...</p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-2">
                                            <div className="flex items-center gap-1.5 text-zinc-600 text-[10px] font-bold uppercase tracking-tighter">
                                                <Calendar size={12} />
                                                {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="text-blue-500 text-[11px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
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
                        className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl shadow-blue-900/20 overflow-hidden animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-8 pb-4">
                            <h2 className="text-3xl font-black bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent mb-2">
                                Begin New Story
                            </h2>
                            <p className="text-zinc-500 text-sm">Define the core parameters of your next masterpiece.</p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Project Title</label>
                                <input
                                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:border-blue-500 outline-none transition-all shadow-inner hover:border-zinc-700"
                                    value={newProjectForm.title}
                                    onChange={(e) => onNewProjectFieldChange('title', e.target.value)}
                                    placeholder="e.g. The Last Horizon"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Primary Genre</label>
                                    <select
                                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3 text-zinc-300 outline-none focus:border-blue-500 transition-all cursor-pointer hover:border-zinc-700"
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
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Target Language</label>
                                    <select
                                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3 text-zinc-300 outline-none focus:border-blue-500 transition-all cursor-pointer hover:border-zinc-700 font-bold text-blue-400"
                                        value={newProjectForm.language}
                                        onChange={(e) => onNewProjectFieldChange('language', e.target.value)}
                                    >
                                        <option value="English">English</option>
                                        <option value="Telugu">Telugu (తెలుగు)</option>
                                        <option value="Hindi">Hindi (हिन्दी)</option>
                                        <option value="Tamil">Tamil (தமிழ்)</option>
                                        <option value="Spanish">Spanish</option>
                                        <option value="French">French</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Hook / Logline</label>
                                <textarea
                                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:border-blue-500 outline-none transition-all resize-none shadow-inner hover:border-zinc-700 font-serif italic"
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
                                className="flex-1 px-6 py-3 border border-zinc-800 hover:bg-zinc-900 rounded-2xl text-zinc-400 font-bold transition-all"
                                onClick={onNewProjectCancel}
                            >
                                Cancel
                            </button>
                            <button
                                className="flex-[2] px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2"
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

