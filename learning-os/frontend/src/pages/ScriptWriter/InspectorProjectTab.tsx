import { Download } from 'lucide-react';
import type { Bible } from '../../services/project.api';
import type { ProjectForm } from './types';

interface InspectorProjectTabProps {
    activeProject: Bible | null;
    projectForm: ProjectForm;
    projectDirty: boolean;
    onProjectFormChange: <K extends keyof ProjectForm>(field: K, value: ProjectForm[K]) => void;
    onSaveProject: () => void;
    onExport: (format: 'fountain' | 'txt' | 'json' | 'pdf') => void;
}

export function InspectorProjectTab({
    activeProject,
    projectForm,
    projectDirty,
    onProjectFormChange,
    onSaveProject,
    onExport
}: InspectorProjectTabProps) {
    if (!activeProject) {
        return <div className="ide-empty-hint">Select a project to view details.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="ide-field">
                <label className="ide-label">Title</label>
                <input
                    className="ide-input"
                    value={projectForm.title}
                    onChange={(event) => onProjectFormChange('title', event.target.value)}
                />
            </div>
            <div className="ide-field">
                <label className="ide-label">Logline</label>
                <textarea
                    className="ide-textarea ide-textarea-sm"
                    value={projectForm.logline}
                    onChange={(event) => onProjectFormChange('logline', event.target.value)}
                />
            </div>
            <div className="ide-field">
                <label className="ide-label">Genre</label>
                <input
                    className="ide-input"
                    value={projectForm.genre}
                    onChange={(event) => onProjectFormChange('genre', event.target.value)}
                />
            </div>
            <div className="ide-field">
                <label className="ide-label">Tone</label>
                <input
                    className="ide-input"
                    value={projectForm.tone}
                    onChange={(event) => onProjectFormChange('tone', event.target.value)}
                />
            </div>
            <div className="ide-field">
                <label className="ide-label text-blue-400">Target Language</label>
                <select
                    className="ide-select font-bold text-blue-300"
                    value={projectForm.language}
                    onChange={(event) => onProjectFormChange('language', event.target.value)}
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
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3">
                <div>
                    <label className="ide-label text-emerald-400">Assistant Preferences</label>
                    <p className="text-[10px] text-zinc-500 mt-1">These defaults guide the chat assistant before you ask for edits.</p>
                </div>
                <div className="ide-field">
                    <label className="ide-label">Reply Language</label>
                    <input
                        className="ide-input"
                        value={projectForm.assistantPreferences.replyLanguage || ''}
                        onChange={(event) => onProjectFormChange('assistantPreferences', {
                            ...projectForm.assistantPreferences,
                            replyLanguage: event.target.value
                        })}
                        placeholder="Leave blank to follow the active project language"
                    />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
                    <div>
                        <label className="ide-label">Assistant Transliteration</label>
                        <p className="text-[10px] text-zinc-500 mt-1">Use English letters for non-English replies when enabled.</p>
                    </div>
                    <input
                        type="checkbox"
                        checked={Boolean(projectForm.assistantPreferences.transliteration)}
                        onChange={(event) => onProjectFormChange('assistantPreferences', {
                            ...projectForm.assistantPreferences,
                            transliteration: event.target.checked
                        })}
                    />
                </div>
                <div className="ide-field">
                    <label className="ide-label">Saved Assistant Directives</label>
                    <textarea
                        className="ide-textarea ide-textarea-sm"
                        value={projectForm.assistantPreferences.savedDirectives.join('\n')}
                        onChange={(event) => onProjectFormChange('assistantPreferences', {
                            ...projectForm.assistantPreferences,
                            savedDirectives: event.target.value
                                .split('\n')
                                .map((line) => line.trim())
                                .filter(Boolean)
                        })}
                        placeholder="One stable instruction per line"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <label className="ide-label flex flex-col">
                    Export Options
                    <span className="text-[9px] text-zinc-500 font-normal mt-0.5">Generate industry-standard script formats.</span>
                </label>
                <div className="ide-inline-actions">
                    <button className="ide-btn ide-btn-primary ide-btn-sm bg-blue-600 hover:bg-blue-500 text-white" onClick={() => onExport('pdf')}>
                        <Download size={12} /> Export PDF
                    </button>
                    <button className="ide-btn ide-btn-secondary ide-btn-sm" onClick={() => onExport('fountain')}>
                        <Download size={12} /> Export Fountain
                    </button>
                    <button className="ide-btn ide-btn-secondary ide-btn-sm" onClick={() => onExport('txt')}>
                        <Download size={12} /> Export TXT
                    </button>
                    <button className="ide-btn ide-btn-secondary ide-btn-sm" onClick={() => onExport('json')}>
                        <Download size={12} /> Export JSON
                    </button>
                </div>
            </div>
            <button
                className="ide-btn ide-btn-primary ide-btn-full"
                onClick={onSaveProject}
                disabled={!projectDirty}
            >
                {projectDirty ? 'Save Project Changes' : 'Project Saved'}
            </button>
        </div>
    );
}
