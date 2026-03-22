import { ChevronRight, Save, Home, FileText, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';

export function InfiniteTopbar() {
    const navigate = useNavigate();
    const {
        activeProject,
        activeScene,
        setActiveProject,
        uiState,
        setViewMode
    } = useScriptWriter();

    const handleBackToDashboard = () => {
        setActiveProject(null);
        navigate('/script-writer');
    };

    return (
        <div className="h-10 border-b border-border-subtle flex items-center px-4 bg-console-bg justify-between select-none">
            {/* Left Control Group */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleBackToDashboard}
                    className="p-1.5 hover:bg-console-surface rounded text-text-tertiary hover:text-text-primary transition-colors"
                    title="Back to Dashboard"
                >
                    <Home size={16} />
                </button>

                <div className="w-px h-4 bg-border-subtle mx-1" />

                {/* Breadcrumbs */}
                <div className="flex items-center text-xs">
                    <span className="text-text-tertiary font-medium">Script</span>
                    <ChevronRight size={12} className="text-border-subtle mx-2" />
                    <span className={activeProject ? 'text-text-secondary' : 'text-text-tertiary italic'}>
                        {activeProject?.title || 'No Project'}
                    </span>
                    <ChevronRight size={12} className="text-border-subtle mx-2" />
                    <span className={activeScene ? 'text-accent-primary' : 'text-text-tertiary italic'}>
                        {activeScene?.slugline || 'Select a Scene'}
                    </span>
                </div>
            </div>

            {/* Right Control Group */}
            <div className="flex items-center gap-3">
                <div className="flex bg-console-surface/50 p-0.5 rounded-lg border border-border-subtle mr-2">
                    <button
                        onClick={() => setViewMode('editor')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${uiState.viewMode === 'editor' ? 'bg-console-surface-2 text-accent-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
                    >
                        <FileText size={12} />
                        <span>Editor</span>
                    </button>
                    <button
                        onClick={() => setViewMode('bible')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${uiState.viewMode === 'bible' ? 'bg-console-surface-2 text-accent-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
                    >
                        <Globe size={12} />
                        <span>Bible</span>
                    </button>
                </div>

                <div className="flex items-center text-xs text-text-tertiary gap-2 mr-2">
                    <Save size={12} />
                    <span>Saved</span>
                </div>
            </div>
        </div>
    );
}
