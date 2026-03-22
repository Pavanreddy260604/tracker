import { useState, useRef } from 'react';
import { Users, FileText, Globe, Save, Sparkles, X } from 'lucide-react';
import { useDialog } from '../../../hooks/useDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { Bible } from '../../../services/project.api';
import type { Character } from '../../../services/character.api';
import type { CharacterForm } from '../types';

interface BiblePortalProps {
    activeProject: Bible | null;
    characters: Character[];
    onUpdateProject?: (id: string, updates: Partial<Bible>) => Promise<unknown> | void;
    onDeleteProject?: (id: string) => Promise<unknown> | void;
    // Character Handlers
    characterForm?: CharacterForm;
    isSavingCharacter?: boolean;
    onCreateCharacter?: () => Promise<void>;
    onUpdateCharacter?: () => Promise<void>;
    onDeleteCharacter?: (id?: string) => Promise<void>;
    onCharacterSelect?: (id: string | null) => void;
    activeCharacterId?: string | null;
    onCharacterFormChange?: (field: keyof CharacterForm, value: string) => void;
    // RAG Handlers
    ingestingCharacterIds?: string[];
    voiceStatus?: string | null;
    onVoiceIngest?: (file: File, characterId?: string) => Promise<unknown>;
}

export function BiblePortal({
    activeProject,
    characters,
    onUpdateProject,
    onDeleteProject,
    characterForm,
    isSavingCharacter,
    onCreateCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    onCharacterSelect,
    activeCharacterId,
    onCharacterFormChange,
    ingestingCharacterIds = [],
    voiceStatus,
    onVoiceIngest
}: BiblePortalProps) {
    const { dialog, showConfirm, closeDialog } = useDialog();
    const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
    const [isAddingCharacter, setIsAddingCharacter] = useState(false);
    const [uploadingCharacterId, setUploadingCharacterId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!activeProject) return null;

    const title = titleDrafts[activeProject._id] ?? activeProject.title ?? '';

    const handleFileUploadRequest = (characterId: string) => {
        setUploadingCharacterId(characterId);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Immediately trigger ingest with the file and current character ID
        await onVoiceIngest?.(file, uploadingCharacterId || undefined);

        setUploadingCharacterId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="flex-1 overflow-auto bg-console-bg p-8 custom-scrollbar">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,.pdf"
                onChange={handleFileChange}
            />
            <div className="max-w-5xl mx-auto space-y-12">
                {/* Header Section */}
                <header className="flex justify-between items-end border-b border-border-subtle pb-8">
                    <div>
                        <div className="flex items-center gap-3 text-accent-primary mb-2">
                            <Globe size={24} />
                            <span className="text-sm font-bold uppercase tracking-[0.2em]">Project Bible</span>
                        </div>
                        <h1 className="text-5xl font-bold text-text-primary tracking-tight">{activeProject.title}</h1>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Left Column: Metadata & Logline */}
                    <div className="lg:col-span-1 space-y-12">
                        <section className="space-y-4">
                            <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14} /> Narrative Overview
                            </h3>
                            <div className="p-6 bg-console-surface/30 rounded-2xl border border-border-subtle/50 backdrop-blur-sm">
                                <p className="text-text-secondary leading-relaxed italic text-lg font-serif">
                                    "{activeProject.logline || 'Establishing the core narrative engine...'}"
                                </p>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Key Cast & Management */}
                    <div className="lg:col-span-2 space-y-12">
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-text-primary flex items-center gap-3">
                                    <Users className="text-accent-primary" /> Cast Management & RAG Service
                                </h2>
                                <button
                                    onClick={() => {
                                        onCharacterSelect?.(null);
                                        setIsAddingCharacter(true);
                                    }}
                                    className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-dark text-console-bg rounded-lg text-xs font-bold transition-all shadow-lg shadow-accent-primary/20"
                                >
                                    + Add New Character
                                </button>
                            </div>

                            {isAddingCharacter && characterForm && (
                                <div className="p-6 bg-console-surface border border-accent-primary/30 rounded-2xl space-y-6 shadow-2xl shadow-accent-primary/10">
                                    <div className="flex justify-between items-center pb-4 border-b border-border-subtle">
                                        <div className="flex items-center gap-2 text-accent-primary">
                                            <Sparkles size={16} />
                                            <h3 className="text-sm font-bold uppercase tracking-wider">
                                                {activeCharacterId ? 'Edit Character Profile' : 'Register New Cast Member'}
                                            </h3>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsAddingCharacter(false);
                                                onCharacterSelect?.(null);
                                            }}
                                            className="p-1 hover:bg-console-surface-2 rounded transition-colors"
                                        >
                                            <X size={16} className="text-text-tertiary" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Full Name</label>
                                                <input
                                                    className="w-full bg-console-bg border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:border-accent-primary outline-none transition-all"
                                                    value={characterForm.name}
                                                    onChange={(e) => onCharacterFormChange?.('name', e.target.value)}
                                                    placeholder="Character Name"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Archetype / Role</label>
                                                <select
                                                    className="w-full bg-console-bg border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:border-accent-primary outline-none transition-all"
                                                    value={characterForm.role}
                                                    onChange={(e) => onCharacterFormChange?.('role', e.target.value)}
                                                >
                                                    <option value="protagonist">Protagonist</option>
                                                    <option value="antagonist">Antagonist</option>
                                                    <option value="supporting">Supporting</option>
                                                    <option value="cameo">Cameo</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Traits & Persona</label>
                                                <input
                                                    className="w-full bg-console-bg border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:border-accent-primary outline-none transition-all"
                                                    value={characterForm.traits}
                                                    onChange={(e) => onCharacterFormChange?.('traits', e.target.value)}
                                                    placeholder="Strong, Witty, Nervous..."
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Core Motivation</label>
                                                <textarea
                                                    className="w-full bg-console-bg border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:border-accent-primary outline-none transition-all resize-none h-[88px]"
                                                    value={characterForm.motivation}
                                                    onChange={(e) => onCharacterFormChange?.('motivation', e.target.value)}
                                                    placeholder="What drives this character?"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
                                        <button
                                            onClick={() => {
                                                setIsAddingCharacter(false);
                                                onCharacterSelect?.(null);
                                            }}
                                            className="px-6 py-2 rounded-lg text-xs font-bold text-text-tertiary uppercase tracking-wider hover:bg-console-surface-2 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={isSavingCharacter || !characterForm.name.trim()}
                                            onClick={async () => {
                                                if (activeCharacterId) {
                                                    await onUpdateCharacter?.();
                                                } else {
                                                    await onCreateCharacter?.();
                                                }
                                                setIsAddingCharacter(false);
                                                onCharacterSelect?.(null);
                                            }}
                                            className="px-6 py-2 bg-accent-primary hover:bg-accent-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-console-bg rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-accent-primary/20"
                                        >
                                            {isSavingCharacter ? (activeCharacterId ? 'Updating...' : 'Registering...') : (activeCharacterId ? 'Update Character' : 'Register Character')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {characters.map(char => (
                                    <div key={char._id} className="group flex flex-col p-6 bg-console-surface/50 border border-border-subtle rounded-2xl hover:border-accent-primary/30 transition-all hover:bg-console-surface">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="text-xl font-bold text-text-primary mb-1">{char.name}</h4>
                                                <span className="text-[10px] font-bold uppercase text-accent-primary tracking-wider">
                                                    {char.role}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        onCharacterSelect?.(char._id);
                                                        setIsAddingCharacter(true);
                                                    }}
                                                    className="p-2 hover:bg-console-surface-2 rounded-lg text-text-tertiary hover:text-accent-primary transition-colors"
                                                    title="Edit Character"
                                                >
                                                    <Sparkles size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        showConfirm(
                                                            'Delete Character',
                                                            `Are you sure you want to delete "${char.name}"? This action cannot be undone.`,
                                                            () => onDeleteCharacter?.(char._id)
                                                        );
                                                    }}
                                                    className="p-2 hover:bg-status-error/10 rounded-lg text-text-tertiary hover:text-status-error transition-colors"
                                                    title="Delete Character"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-sm text-text-secondary line-clamp-2 mb-6 min-h-[40px]">
                                            {char.motivation || 'Describe the deep motivation of this character...'}
                                        </p>

                                        <div className="mt-auto pt-6 border-t border-border-subtle/50">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-tighter">Knowledge Base (RAG)</span>
                                                {ingestingCharacterIds.includes(char._id) && (
                                                    <span className="text-[9px] text-accent-primary animate-pulse font-bold uppercase">Ingesting...</span>
                                                )}
                                                {voiceStatus && uploadingCharacterId === char._id && !ingestingCharacterIds.includes(char._id) && (
                                                    <span className="text-[9px] text-status-ok font-bold uppercase">{voiceStatus}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    disabled={ingestingCharacterIds.includes(char._id)}
                                                    className="flex-1 py-2 bg-console-surface hover:bg-console-surface-2 text-text-secondary rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50"
                                                >
                                                    Manage Sources
                                                </button>
                                                <button
                                                    onClick={() => handleFileUploadRequest(char._id)}
                                                    disabled={ingestingCharacterIds.includes(char._id)}
                                                    className="px-3 py-2 bg-console-surface hover:bg-console-surface-2 text-accent-primary rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50"
                                                >
                                                    {ingestingCharacterIds.includes(char._id) ? '...' : '+ Upload'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {characters.length === 0 && (
                                    <div className="col-span-full py-20 text-center bg-console-surface/20 border border-dashed border-border-subtle rounded-3xl">
                                        <Users size={48} className="mx-auto text-border-subtle mb-4" />
                                        <p className="text-text-tertiary font-medium">No characters registered. Start building your world.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Bottom Section: Vault & Settings */}
                <section className="pt-20 border-t border-border-subtle">
                    <div className="flex items-center gap-3 mb-8">
                        <Save className="text-text-tertiary" size={20} />
                        <h2 className="text-xl font-bold text-text-secondary uppercase tracking-widest">Vault & System Settings</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest px-1">Project Identity</label>
                                <div className="flex gap-4">
                                    <input
                                        className="flex-1 bg-console-surface/50 border border-border-subtle rounded-xl px-4 py-3 text-lg text-text-primary focus:border-accent-primary outline-none transition-all"
                                        value={title}
                                        onChange={(e) => {
                                            setTitleDrafts((prev) => ({
                                                ...prev,
                                                [activeProject._id]: e.target.value
                                            }));
                                        }}
                                        placeholder="Project Title"
                                    />
                                    <button
                                        onClick={() => onUpdateProject?.(activeProject._id, { title })}
                                        className="px-6 bg-console-surface hover:bg-console-surface-2 rounded-xl text-xs font-bold text-text-secondary uppercase tracking-widest transition-all"
                                    >
                                        Update
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-status-error-soft border border-status-error/20 rounded-2xl">
                            <h4 className="text-status-error text-xs font-bold uppercase tracking-widest mb-2">Danger Zone</h4>
                            <p className="text-text-tertiary text-xs mb-6">Archive or permanently delete this project Bible. This action is irreversible and will remove all associated scenes and RAG data.</p>
                            <button
                                onClick={() => {
                                    showConfirm(
                                        'Purge Project Bible',
                                        'Are you absolutely sure you want to purge this project? This will permanently delete all scenes and characters.',
                                        () => onDeleteProject?.(activeProject._id)
                                    );
                                }}
                                className="px-6 py-3 bg-console-surface hover:bg-status-error/12 border border-status-error/30 text-status-error rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                                Purge Project Bible
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <ConfirmDialog
                isOpen={dialog.isOpen && dialog.type === 'confirm'}
                onClose={closeDialog}
                onConfirm={dialog.onConfirm || (() => { })}
                title={dialog.title}
                description={dialog.description}
                variant="danger"
            />
        </div>
    );
}
