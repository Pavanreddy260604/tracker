import { Download } from 'lucide-react';
import type { Bible } from '../../services/project.api';
import type { ProjectForm } from './types';

interface InspectorProjectTabProps {
    activeProject: Bible | null;
    projectForm: ProjectForm;
    projectDirty: boolean;
    onProjectFormChange: (field: keyof ProjectForm, value: string) => void;
    onSaveProject: () => void;
    onExport: (format: 'fountain' | 'txt' | 'json') => void;
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
                    className="ide-input font-bold text-blue-300"
                    value={projectForm.language}
                    onChange={(event) => onProjectFormChange('language', event.target.value)}
                >
                    <option value="English">English</option>
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                </select>
            </div>
            <div className="ide-inline-actions">
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
