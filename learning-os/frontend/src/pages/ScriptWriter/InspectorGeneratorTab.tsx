import { BookOpen, Sparkles } from 'lucide-react';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { ScriptHistoryItem, ScriptTemplates } from '../../services/scriptWriter.api';

interface InspectorGeneratorTabProps {
    activeProject: Bible | null;
    scriptTemplates: ScriptTemplates | null;
    scriptIdea: string;
    onScriptIdeaChange: (value: string) => void;
    scriptFormat: string;
    onScriptFormatChange: (value: string) => void;
    scriptStyle: string;
    onScriptStyleChange: (value: string) => void;
    scriptOutput: string;
    scriptHistory: ScriptHistoryItem[];
    activeHistoryId: string | null;
    scriptLanguage: string;
    onScriptLanguageChange: (value: string) => void;
    onScriptHistorySelect: (id: string) => void;
    onGenerateScript: () => void;
    isScriptGenerating: boolean;
    characters: Character[];
    selectedScriptCharacterIds: string[];
    onToggleScriptCharacter: (id: string) => void;
}

export function InspectorGeneratorTab({
    activeProject,
    scriptTemplates,
    scriptIdea,
    onScriptIdeaChange,
    scriptFormat,
    onScriptFormatChange,
    scriptStyle,
    onScriptStyleChange,
    scriptOutput,
    scriptHistory,
    activeHistoryId,
    scriptLanguage,
    onScriptLanguageChange,
    onScriptHistorySelect,
    onGenerateScript,
    isScriptGenerating,
    characters,
    selectedScriptCharacterIds,
    onToggleScriptCharacter
}: InspectorGeneratorTabProps) {
    if (!activeProject) {
        return <div className="ide-empty-hint">Select a project to use the script generator.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="ide-section">
                <div className="ide-section-title">Script Generator</div>
                <div className="ide-field">
                    <label className="ide-label">Idea</label>
                    <textarea
                        className="ide-textarea ide-textarea-sm"
                        value={scriptIdea}
                        onChange={(event) => onScriptIdeaChange(event.target.value)}
                        placeholder="Describe the story, characters, and tone. Be specific about the conflict."
                    />
                </div>
                <div className="ide-field">
                    <label className="ide-label">Format</label>
                    <select
                        className="ide-select"
                        value={scriptFormat}
                        onChange={(event) => onScriptFormatChange(event.target.value)}
                    >
                        {!scriptTemplates?.formats?.length && (
                            <option value="" disabled>
                                Loading formats...
                            </option>
                        )}
                        {(scriptTemplates?.formats || []).map((format) => (
                            <option key={format.id} value={format.id}>
                                {format.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ide-field">
                    <label className="ide-label flex items-center justify-between">
                        Style
                        <span className="text-[9px] text-zinc-500 font-normal">Hollywood Directors</span>
                    </label>
                    <select
                        className="ide-select"
                        value={scriptStyle}
                        onChange={(event) => onScriptStyleChange(event.target.value)}
                    >
                        {!scriptTemplates?.styles?.length && (
                            <option value="" disabled>
                                Loading styles...
                            </option>
                        )}
                        {(scriptTemplates?.styles || []).map((style) => (
                            <option key={style.id} value={style.id}>
                                {style.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ide-field">
                    <label className="ide-label text-blue-400">Target Language</label>
                    <input
                        className="ide-select font-bold text-blue-300"
                        list="script-language-options-generator"
                        value={scriptLanguage}
                        onChange={(event) => onScriptLanguageChange(event.target.value)}
                        placeholder="English"
                    />
                    <datalist id="script-language-options-generator">
                        <option value="English" />
                        <option value="Telugu" />
                        <option value="Hindi" />
                        <option value="Tamil" />
                        <option value="Spanish" />
                        <option value="French" />
                    </datalist>
                </div>
                <div className="ide-field">
                    <label className="ide-label">Character RAG</label>
                    {characters.length === 0 ? (
                        <div className="ide-empty-hint">Add cast members to contextualize the script.</div>
                    ) : (
                        <div className="ide-chip-grid">
                            {characters.map((character) => (
                                <button
                                    key={character._id}
                                    className={`ide-chip ${selectedScriptCharacterIds.includes(character._id) ? 'is-active' : ''}`}
                                    onClick={() => onToggleScriptCharacter(character._id)}
                                >
                                    {character.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    className="ide-btn ide-btn-primary ide-btn-full"
                    onClick={onGenerateScript}
                    disabled={isScriptGenerating}
                >
                    <Sparkles size={14} /> {isScriptGenerating ? 'Generating...' : 'Generate Script'}
                </button>
            </div>

            <div className="ide-section">
                <div className="ide-section-title">Output</div>
                <div className="ide-script-output">
                    {scriptOutput || 'Generated script will appear here as it streams.'}
                </div>
            </div>

            <div className="ide-section">
                <div className="ide-section-title">History</div>
                {scriptHistory.length === 0 ? (
                    <div className="ide-empty-hint">No script generations yet.</div>
                ) : (
                    <div className="ide-history-list">
                        {scriptHistory.map((item) => (
                            <button
                                key={item._id}
                                className={`ide-history-item ${activeHistoryId === item._id ? 'is-active' : ''}`}
                                onClick={() => onScriptHistorySelect(item._id)}
                            >
                                <BookOpen size={14} />
                                <div>
                                    <div className="ide-history-title">{item.title || item.prompt}</div>
                                    <div className="ide-history-meta">{item.format} • {item.style}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
