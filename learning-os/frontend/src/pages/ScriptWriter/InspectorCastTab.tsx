import { Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { CharacterForm } from './types';

interface InspectorCastTabProps {
    activeProject: Bible | null;
    characters: Character[];
    loadingCharacters: boolean;
    activeCharacterId: string | null;
    characterForm: CharacterForm;
    onCharacterSelect: (id: string) => void;
    onCharacterFormChange: (field: keyof CharacterForm, value: string) => void;
    onCreateCharacter: () => void;
    onUpdateCharacter: () => void;
    onDeleteCharacter: () => void;
    isSavingCharacter: boolean;
    voiceFile: File | null;
    onVoiceFileChange: (file: File | null) => void;
    voiceCharacterId: string | null;
    onVoiceCharacterChange: (id: string | null) => void;
    onVoiceIngest: () => void;
    voiceStatus: string | null;
    isIngesting: boolean;
}

export function InspectorCastTab({
    activeProject,
    characters,
    loadingCharacters,
    activeCharacterId,
    characterForm,
    onCharacterSelect,
    onCharacterFormChange,
    onCreateCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    isSavingCharacter,
    voiceFile,
    onVoiceFileChange,
    voiceCharacterId,
    onVoiceCharacterChange,
    onVoiceIngest,
    voiceStatus,
    isIngesting
}: InspectorCastTabProps) {
    if (!activeProject) {
        return <div className="ide-empty-hint">Select a project to manage cast.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="ide-section">
                <div className="ide-section-title">Cast List</div>
                {loadingCharacters ? (
                    <div className="ide-empty-hint">
                        <Loader2 size={16} className="animate-spin" /> Loading cast...
                    </div>
                ) : characters.length === 0 ? (
                    <div className="ide-empty-hint">No cast yet. Add the first character.</div>
                ) : (
                    <div className="ide-character-list">
                        {characters.map((character) => (
                            <button
                                key={character._id}
                                className={`ide-character-item ${activeCharacterId === character._id ? 'is-active' : ''}`}
                                onClick={() => onCharacterSelect(character._id)}
                            >
                                <div>
                                    <div className="ide-character-name">{character.name}</div>
                                    <div className="ide-character-role">{character.role}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="ide-section">
                <div className="ide-section-title">Character Profile</div>
                <div className="ide-field">
                    <label className="ide-label">Name</label>
                    <input
                        className="ide-input"
                        value={characterForm.name}
                        onChange={(event) => onCharacterFormChange('name', event.target.value)}
                    />
                </div>
                <div className="ide-field">
                    <label className="ide-label">Role</label>
                    <select
                        className="ide-select"
                        value={characterForm.role}
                        onChange={(event) => onCharacterFormChange('role', event.target.value)}
                    >
                        <option value="protagonist">Protagonist</option>
                        <option value="antagonist">Antagonist</option>
                        <option value="supporting">Supporting</option>
                        <option value="minor">Minor</option>
                    </select>
                </div>
                <div className="ide-field">
                    <label className="ide-label">Voice Description</label>
                    <textarea
                        className="ide-textarea ide-textarea-sm"
                        value={characterForm.voiceDescription}
                        onChange={(event) => onCharacterFormChange('voiceDescription', event.target.value)}
                    />
                </div>
                <div className="ide-field">
                    <label className="ide-label">Accent</label>
                    <input
                        className="ide-input"
                        value={characterForm.voiceAccent}
                        onChange={(event) => onCharacterFormChange('voiceAccent', event.target.value)}
                    />
                </div>
                <div className="ide-field">
                    <label className="ide-label">Traits (comma separated)</label>
                    <input
                        className="ide-input"
                        value={characterForm.traits}
                        onChange={(event) => onCharacterFormChange('traits', event.target.value)}
                    />
                </div>
                <div className="ide-field">
                    <label className="ide-label">Motivation</label>
                    <textarea
                        className="ide-textarea ide-textarea-sm"
                        value={characterForm.motivation}
                        onChange={(event) => onCharacterFormChange('motivation', event.target.value)}
                    />
                </div>
                <div className="ide-inline-actions">
                    <button
                        className="ide-btn ide-btn-primary ide-btn-full"
                        onClick={activeCharacterId ? onUpdateCharacter : onCreateCharacter}
                        disabled={isSavingCharacter}
                    >
                        <Plus size={14} /> {activeCharacterId ? 'Save Character' : 'Add Character'}
                    </button>
                    {activeCharacterId && (
                        <button
                            className="ide-btn ide-btn-ghost ide-btn-full"
                            onClick={onDeleteCharacter}
                            disabled={isSavingCharacter}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    )}
                </div>
            </div>

            <div className="ide-section">
                <div className="ide-section-title">Voice Training (RAG)</div>
                <div className="ide-field">
                    <label className="ide-label">Attach to Character (optional)</label>
                    <select
                        className="ide-select"
                        value={voiceCharacterId || ''}
                        onChange={(event) => onVoiceCharacterChange(event.target.value || null)}
                    >
                        <option value="">All Characters</option>
                        {characters.map((character) => (
                            <option key={character._id} value={character._id}>{character.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ide-field">
                    <label className="ide-label">Upload PDF or Text</label>
                    <input
                        className="ide-file-input"
                        type="file"
                        accept=".pdf,.txt"
                        onChange={(event) => onVoiceFileChange(event.target.files?.[0] || null)}
                    />
                    {voiceFile && (
                        <div className="ide-file-meta">Selected: {voiceFile.name}</div>
                    )}
                </div>
                <button
                    className="ide-btn ide-btn-secondary ide-btn-full"
                    onClick={onVoiceIngest}
                    disabled={!voiceFile || isIngesting}
                >
                    <UploadCloud size={14} /> {isIngesting ? 'Uploading...' : 'Ingest Voice Samples'}
                </button>
                {voiceStatus && <div className="ide-helper">{voiceStatus}</div>}
            </div>
        </div>
    );
}
