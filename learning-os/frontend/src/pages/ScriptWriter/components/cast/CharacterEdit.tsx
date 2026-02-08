import { Trash2, ChevronLeft, UploadCloud } from 'lucide-react';
import type { Character } from '../../../../services/character.api';
import type { CharacterForm } from '../../types';

interface CharacterEditProps {
    isCreatingNew: boolean;
    editingCharacter?: Character;
    characterForm: CharacterForm;
    onBack: () => void;
    onChange: (field: keyof CharacterForm, value: string) => void;
    onSave: () => void;
    onDelete: () => void;
    isSaving: boolean;

    // Voice Props
    voiceFile: File | null;
    onVoiceFileChange: (file: File | null) => void;
    onVoiceIngest: () => void;
    voiceStatus: string | null;
    isIngesting: boolean;
}

export function CharacterEdit({
    isCreatingNew,
    editingCharacter,
    characterForm,
    onBack,
    onChange,
    onSave,
    onDelete,
    isSaving,
    voiceFile,
    onVoiceFileChange,
    onVoiceIngest,
    voiceStatus,
    isIngesting
}: CharacterEditProps) {
    return (
        <div className="cast-focus-view">
            <button className="back-btn" onClick={onBack}>
                <ChevronLeft size={18} />
                Back to Cast
            </button>

            <div className="character-edit-form">
                <h2>{isCreatingNew ? 'New Character' : `Edit: ${editingCharacter?.name || ''}`}</h2>

                <div className="form-grid">
                    <div className="form-section">
                        <h3>Basic Info</h3>
                        <div className="form-field">
                            <label>Name</label>
                            <input
                                className="ide-input"
                                value={characterForm.name}
                                onChange={(e) => onChange('name', e.target.value)}
                                placeholder="Character name"
                            />
                        </div>
                        <div className="form-field">
                            <label>Role</label>
                            <select
                                className="ide-select"
                                value={characterForm.role}
                                onChange={(e) => onChange('role', e.target.value)}
                            >
                                <option value="protagonist">Protagonist</option>
                                <option value="antagonist">Antagonist</option>
                                <option value="supporting">Supporting</option>
                                <option value="minor">Minor</option>
                            </select>
                        </div>
                        <div className="form-field">
                            <label>Traits (comma separated)</label>
                            <input
                                className="ide-input"
                                value={characterForm.traits}
                                onChange={(e) => onChange('traits', e.target.value)}
                                placeholder="e.g. Brooding, Sarcastic, Loyal"
                            />
                        </div>
                        <div className="form-field">
                            <label>Motivation</label>
                            <textarea
                                className="ide-textarea"
                                rows={3}
                                value={characterForm.motivation}
                                onChange={(e) => onChange('motivation', e.target.value)}
                                placeholder="What drives this character?"
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Voice & Dialogue</h3>
                        <div className="form-field">
                            <label>Voice Description</label>
                            <textarea
                                className="ide-textarea"
                                rows={3}
                                value={characterForm.voiceDescription}
                                onChange={(e) => onChange('voiceDescription', e.target.value)}
                                placeholder="e.g. Gruff, uses simple words, Brooklyn accent"
                            />
                        </div>
                        <div className="form-field">
                            <label>Accent</label>
                            <input
                                className="ide-input"
                                value={characterForm.voiceAccent}
                                onChange={(e) => onChange('voiceAccent', e.target.value)}
                                placeholder="e.g. Southern, British, etc."
                            />
                        </div>
                    </div>
                </div>

                {!isCreatingNew && (
                    <div className="voice-training-section">
                        <h3>Voice Training (RAG)</h3>
                        <p className="helper-text">Upload screenplay PDFs or text files to train this character's voice.</p>
                        <div className="upload-row">
                            <input
                                type="file"
                                accept=".pdf,.txt"
                                onChange={(e) => onVoiceFileChange(e.target.files?.[0] || null)}
                                className="ide-input"
                            />
                            <button
                                className="ide-btn"
                                onClick={onVoiceIngest}
                                disabled={!voiceFile || isIngesting}
                            >
                                <UploadCloud size={16} />
                                {isIngesting ? 'Uploading...' : 'Ingest'}
                            </button>
                        </div>
                        {voiceStatus && <div className="voice-status">{voiceStatus}</div>}
                    </div>
                )}

                <div className="form-actions">
                    <button
                        className="ide-btn ide-btn-primary"
                        onClick={onSave}
                        disabled={isSaving || !characterForm.name.trim()}
                    >
                        {isSaving ? 'Saving...' : isCreatingNew ? 'Create Character' : 'Save Changes'}
                    </button>
                    {!isCreatingNew && (
                        <button
                            className="ide-btn ide-btn-danger"
                            onClick={onDelete}
                            disabled={isSaving}
                        >
                            <Trash2 size={16} />
                            Delete
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
