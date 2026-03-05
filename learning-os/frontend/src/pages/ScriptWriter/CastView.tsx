import { Users } from 'lucide-react';
import { useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { CharacterForm } from './types';
import { CastList } from './components/cast/CastList';
import { CharacterEdit } from './components/cast/CharacterEdit';

interface CastViewProps {
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

export function CastView({
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
    onVoiceCharacterChange,
    onVoiceIngest,
    voiceStatus,
    isIngesting
}: CastViewProps) {
    const [focusedCharacter, setFocusedCharacter] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    if (!activeProject) {
        return (
            <div className="studio-view-empty">
                <Users size={48} strokeWidth={1} />
                <h2>Cast Manager</h2>
                <p>Select a project from the explorer to manage characters.</p>
            </div>
        );
    }

    const editMode = focusedCharacter || isCreatingNew;

    if (editMode) {
        const editingCharacter = characters.find(c => c._id === focusedCharacter);

        return (
            <CharacterEdit
                isCreatingNew={isCreatingNew}
                editingCharacter={editingCharacter}
                characterForm={characterForm}
                onBack={() => {
                    setFocusedCharacter(null);
                    setIsCreatingNew(false);
                }}
                onChange={onCharacterFormChange}
                onSave={isCreatingNew ? onCreateCharacter : onUpdateCharacter}
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
        );
    }

    return (
        <CastList
            characters={characters}
            loadingCharacters={loadingCharacters}
            activeCharacterId={activeCharacterId}
            onSelectCharacter={(id) => {
                onCharacterSelect(id);
                setFocusedCharacter(id);
            }}
            onAddCharacter={() => {
                // Reset form defaults
                onCharacterFormChange('name', '');
                onCharacterFormChange('role', 'supporting');
                onCharacterFormChange('voiceDescription', '');
                onCharacterFormChange('voiceAccent', '');
                onCharacterFormChange('traits', '');
                onCharacterFormChange('motivation', '');
                setIsCreatingNew(true);
            }}
        />
    );
}
