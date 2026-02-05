import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../../stores/characterStore';
import { useProjectStore } from '../../stores/projectStore';
import { VoiceUpload } from '../../pages/ScriptWriter/VoiceUpload';
import {
    Users,
    UserPlus,
    Mic2,
    Trash2,
    Info,
    CheckCircle2
} from 'lucide-react';
import type { Character } from '../../services/character.api';
import { cn } from '../../lib/utils';

export const CastManager: React.FC = () => {
    const { activeProject } = useProjectStore();
    const { characters, loadCharacters, createCharacter, deleteCharacter } = useCharacterStore();

    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<Character['role']>('supporting');
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

    useEffect(() => {
        if (activeProject) {
            loadCharacters(activeProject._id);
        }
    }, [activeProject, loadCharacters]);

    const handleCreate = async () => {
        if (!activeProject || !newName.trim()) return;
        await createCharacter(
            activeProject._id,
            newName,
            newRole
        );
        setNewName('');
        setIsAdding(false);
    };

    const selectedChar = characters.find(c => c._id === selectedCharId);

    return (
        <div className="flex h-full sw-split animate-in fade-in duration-500">
            <div className="sw-sidebar w-80 flex flex-col">
                <div className="sw-sidebar-header">
                    <div>
                        <h2 className="sw-sidebar-title">Cast</h2>
                        <p className="sw-sidebar-subtitle">Personnel management</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className="sw-icon-button is-primary"
                        aria-label="Add character"
                    >
                        <UserPlus size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isAdding && (
                        <div className="sw-card sw-card-muted p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                            <input
                                autoFocus
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Character name"
                                className="sw-input"
                            />
                            <select
                                value={newRole}
                                onChange={e => setNewRole(e.target.value as any)}
                                className="sw-select"
                            >
                                <option value="protagonist">Protagonist</option>
                                <option value="antagonist">Antagonist</option>
                                <option value="supporting">Supporting</option>
                                <option value="minor">Minor</option>
                            </select>
                            <div className="flex gap-2">
                                <button onClick={handleCreate} className="sw-btn sw-btn-primary flex-1 justify-center">Add</button>
                                <button onClick={() => setIsAdding(false)} className="sw-btn sw-btn-ghost flex-1 justify-center">Cancel</button>
                            </div>
                        </div>
                    )}

                    {characters.map(char => (
                        <div
                            key={char._id}
                            onClick={() => setSelectedCharId(char._id)}
                            className={cn("sw-list-item flex items-start justify-between", selectedCharId === char._id && "is-active")}
                        >
                            <div>
                                <h3 className="sw-item-title">{char.name}</h3>
                                <span className="sw-tag mt-2 inline-flex">{char.role}</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteCharacter(char._id); }}
                                className="sw-icon-button sw-icon-button-sm"
                                aria-label={`Delete ${char.name}`}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {!selectedCharId ? (
                    <div className="sw-empty h-full flex flex-col items-center justify-center p-8 text-center">
                        <Users size={64} className="opacity-40 mb-4" />
                        <h3 className="sw-section-title">Select a Character</h3>
                        <p className="sw-muted mt-2 max-w-xs">
                            Select a member of your cast to train their voice and manage their narrative identity.
                        </p>
                    </div>
                ) : (
                    <div className="sw-page max-w-4xl mx-auto space-y-10">
                        <div className="sw-detail-header">
                            <div>
                                <h2 className="sw-hero-title">{selectedChar?.name}</h2>
                                <p className="sw-status">
                                    <CheckCircle2 size={16} /> Narrative identity established
                                </p>
                            </div>
                            <span className="sw-tag">Archetype: {selectedChar?.role}</span>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-1">
                                <h3 className="sw-section-title flex items-center gap-3">
                                    <Mic2 className="sw-accent-text" /> VoiceLab & Training
                                </h3>
                                <p className="sw-muted">Upload script pages or dialogue samples unique to this character.</p>
                            </div>

                            <div className="sw-card p-8">
                                <VoiceUpload characterId={selectedCharId} />
                            </div>

                            <div className="sw-callout">
                                <div className="sw-callout-icon">
                                    <Info size={18} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="sw-callout-title">Character-Specific RAG Active</h4>
                                    <p className="sw-callout-text">
                                        When writing scenes featuring <span className="font-bold">{selectedChar?.name}</span>, the AI
                                        will prioritize the style and rhythm found in these uploaded samples.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
