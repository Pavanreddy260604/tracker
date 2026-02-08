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
        <div className="h-10 border-b border-zinc-800 flex items-center px-4 bg-zinc-950 justify-between select-none">
            {/* Left Control Group */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleBackToDashboard}
                    className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
                    title="Back to Dashboard"
                >
                    <Home size={16} />
                </button>

                <div className="w-px h-4 bg-zinc-800 mx-1" />

                {/* Breadcrumbs */}
                <div className="flex items-center text-xs">
                    <span className="text-zinc-500 font-medium">Script</span>
                    <ChevronRight size={12} className="text-zinc-700 mx-2" />
                    <span className={activeProject ? 'text-zinc-300' : 'text-zinc-600 italic'}>
                        {activeProject?.title || 'No Project'}
                    </span>
                    <ChevronRight size={12} className="text-zinc-700 mx-2" />
                    <span className={activeScene ? 'text-blue-200' : 'text-zinc-600 italic'}>
                        {activeScene?.slugline || 'Select a Scene'}
                    </span>
                </div>
            </div>

            {/* Right Control Group */}
            <div className="flex items-center gap-3">
                <div className="flex bg-zinc-900/50 p-0.5 rounded-lg border border-zinc-800 mr-2">
                    <button
                        onClick={() => setViewMode('editor')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${uiState.viewMode === 'editor' ? 'bg-zinc-800 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <FileText size={12} />
                        <span>Editor</span>
                    </button>
                    <button
                        onClick={() => setViewMode('bible')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${uiState.viewMode === 'bible' ? 'bg-zinc-800 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Globe size={12} />
                        <span>Bible</span>
                    </button>
                </div>

                <div className="flex items-center text-xs text-zinc-500 gap-2 mr-2">
                    <Save size={12} />
                    <span>Saved</span>
                </div>
            </div>
        </div>
    );
}
