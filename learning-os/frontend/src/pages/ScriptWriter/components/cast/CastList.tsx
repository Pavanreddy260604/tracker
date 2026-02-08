import { Users, Plus } from 'lucide-react';
import type { Character } from '../../../../services/character.api';

interface CastListProps {
    characters: Character[];
    loadingCharacters: boolean;
    activeCharacterId: string | null;
    onAddCharacter: () => void;
    onSelectCharacter: (id: string) => void;
}

export function CastList({
    characters,
    loadingCharacters,
    activeCharacterId,
    onAddCharacter,
    onSelectCharacter
}: CastListProps) {
    return (
        <div className="cast-grid-view">
            <div className="cast-header">
                <div>
                    <h2>Cast</h2>
                    <p>{characters.length} character{characters.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                    className="ide-btn ide-btn-primary"
                    onClick={onAddCharacter}
                >
                    <Plus size={16} />
                    Add Character
                </button>
            </div>

            {loadingCharacters ? (
                <div className="loading-state">Loading cast...</div>
            ) : characters.length === 0 ? (
                <div className="empty-state">
                    <Users size={48} strokeWidth={1} />
                    <p>No characters yet. Add your first character to get started.</p>
                </div>
            ) : (
                <div className="character-grid">
                    {characters.map((character) => (
                        <button
                            key={character._id}
                            className={`character-card ${activeCharacterId === character._id ? 'active' : ''}`}
                            onClick={() => onSelectCharacter(character._id)}
                        >
                            <div className="card-avatar">
                                {character.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="card-info">
                                <div className="card-name">{character.name}</div>
                                <div className="card-role">{character.role}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
