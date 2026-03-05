import { Plus, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { CharacterForm } from './types';
import { CharacterEdit } from './components/cast/CharacterEdit'; // Re-use CharacterEdit

interface CastPanelProps {
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

export function CastPanel({
    activeProject,
    characters,
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
    onVoiceCharacterChange,
    onVoiceIngest,
    voiceStatus,
    isIngesting
}: CastPanelProps) {
    const [focusedCharacter, setFocusedCharacter] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // If activeCharacterId changes externally (e.g. from script click), focus it
    if (activeCharacterId && activeCharacterId !== focusedCharacter && !isCreatingNew) {
        setFocusedCharacter(activeCharacterId);
    }

    if (!activeProject) {
        return (
            <div className="p-4 text-center text-zinc-500">
                <p>Select a project to see cast.</p>
            </div>
        );
    }

    const editMode = focusedCharacter || isCreatingNew;

    if (editMode) {
        const editingCharacter = characters.find(c => c._id === focusedCharacter);

        return (
            <div className="cast-panel-edit">
                <button
                    className="ide-btn ide-btn-secondary ide-btn-full mb-4"
                    onClick={() => {
                        setFocusedCharacter(null);
                        setIsCreatingNew(false);
                    }}
                >
                    <ArrowLeft size={14} /> Back to List
                </button>

                <CharacterEdit
                    isCreatingNew={isCreatingNew}
                    editingCharacter={editingCharacter}
                    characterForm={characterForm}
                    onBack={() => {
                        setFocusedCharacter(null);
                        setIsCreatingNew(false);
                    }}
                    onChange={onCharacterFormChange}
                    onSave={() => {
                        if (isCreatingNew) {
                            onCreateCharacter();
                            setIsCreatingNew(false);
                        } else {
                            onUpdateCharacter();
                        }
                    }}
                    onDelete={() => {
                        onDeleteCharacter();
                        setFocusedCharacter(null);
                    }}
                    isSaving={isSavingCharacter}
                    voiceFile={voiceFile}
                    onVoiceFileChange={(file) => {
                        onVoiceFileChange(file);
                        if (focusedCharacter) onVoiceCharacterChange(focusedCharacter);
                    }}
                    onVoiceIngest={onVoiceIngest}
                    voiceStatus={voiceStatus}
                    isIngesting={isIngesting}
                />
            </div>
        );
    }

    return (
        <div className="cast-panel-list">
            <button
                className="ide-btn ide-btn-primary ide-btn-full mb-4"
                onClick={() => {
                    // Reset defaults
                    onCharacterFormChange('name', '');
                    setIsCreatingNew(true);
                }}
            >
                <Plus size={14} /> Create Character
            </button>

            <div className="space-y-2">
                {characters.map(char => (
                    <div
                        key={char._id}
                        className="ide-card p-3 cursor-pointer hover:border-blue-500 transition-colors"
                        onClick={() => {
                            onCharacterSelect(char._id);
                            setFocusedCharacter(char._id);
                        }}
                    >
                        <div className="font-bold text-sm">{char.name}</div>
                        <div className="text-xs text-zinc-400 capitalize">{char.role}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
