import { Sparkles, History, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { ScriptHistoryItem, ScriptTemplates } from '../../services/scriptWriter.api';

interface GeneratorViewProps {
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
    onScriptHistorySelect: (id: string) => void;
    onGenerateScript: () => void;
    isScriptGenerating: boolean;
    characters: Character[];
    selectedScriptCharacterIds: string[];
    onToggleScriptCharacter: (id: string) => void;
}

export function GeneratorView({
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
    onScriptHistorySelect,
    onGenerateScript,
    isScriptGenerating,
    characters,
    selectedScriptCharacterIds,
    onToggleScriptCharacter
}: GeneratorViewProps) {
    const [historyOpen, setHistoryOpen] = useState(false);

    if (!activeProject) {
        return (
            <div className="studio-view-empty">
                <Sparkles size={48} strokeWidth={1} />
                <h2>Script Generator</h2>
                <p>Select a project from the explorer to generate scripts.</p>
            </div>
        );
    }

    return (
        <div className="generator-view">
            {/* Input Panel - 40% */}
            <div className="generator-input">
                <div className="generator-header">
                    <Sparkles size={20} />
                    <h2>Generate Script</h2>
                </div>

                <div className="generator-form">
                    <div className="form-field">
                        <label>Story Idea</label>
                        <textarea
                            className="form-textarea"
                            rows={6}
                            value={scriptIdea}
                            onChange={(e) => onScriptIdeaChange(e.target.value)}
                            placeholder="Describe your story, characters, and the tone you're going for..."
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label>Format</label>
                            <select
                                className="form-select"
                                value={scriptFormat}
                                onChange={(e) => onScriptFormatChange(e.target.value)}
                            >
                                {(scriptTemplates?.formats || []).map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-field">
                            <label>Style</label>
                            <select
                                className="form-select"
                                value={scriptStyle}
                                onChange={(e) => onScriptStyleChange(e.target.value)}
                            >
                                {(scriptTemplates?.styles || []).map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {characters.length > 0 && (
                        <div className="form-field">
                            <label>Include Characters (RAG)</label>
                            <div className="character-chips">
                                {characters.map((c) => (
                                    <button
                                        key={c._id}
                                        className={`character-chip ${selectedScriptCharacterIds.includes(c._id) ? 'selected' : ''}`}
                                        onClick={() => onToggleScriptCharacter(c._id)}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-primary btn-lg"
                        onClick={onGenerateScript}
                        disabled={isScriptGenerating || !scriptIdea.trim()}
                    >
                        <Sparkles size={18} />
                        {isScriptGenerating ? 'Generating...' : 'Generate Script'}
                    </button>
                </div>

                {/* Collapsible History */}
                <div className="generator-history">
                    <button
                        className="history-toggle"
                        onClick={() => setHistoryOpen(!historyOpen)}
                    >
                        <History size={16} />
                        <span>History ({scriptHistory.length})</span>
                        <ChevronDown size={16} className={historyOpen ? 'rotated' : ''} />
                    </button>
                    {historyOpen && (
                        <div className="history-list">
                            {scriptHistory.map((item) => (
                                <button
                                    key={item._id}
                                    className={`history-item ${activeHistoryId === item._id ? 'active' : ''}`}
                                    onClick={() => onScriptHistorySelect(item._id)}
                                >
                                    <div className="history-title">{item.title || item.prompt}</div>
                                    <div className="history-meta">{item.format} • {item.style}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Output Panel - 60% */}
            <div className="generator-output">
                <div className="output-header">
                    <span>Output</span>
                    {isScriptGenerating && <span className="streaming-indicator">● Streaming...</span>}
                </div>
                <div className="output-content">
                    {scriptOutput || (
                        <div className="output-placeholder">
                            Your generated script will appear here.
                            <br /><br />
                            Fill in your idea and click Generate to start.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
