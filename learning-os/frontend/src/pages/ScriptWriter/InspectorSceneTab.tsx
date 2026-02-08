import { Brain, Sparkles } from 'lucide-react';
import type { Scene, CritiqueResult } from '../../services/project.api';
import type { GenerationOptions, SceneForm } from './types';

interface InspectorSceneTabProps {
    activeScene: Scene | null;
    sceneForm: SceneForm;
    onSceneFormChange: (field: keyof SceneForm, value: string) => void;
    generationOptions: GenerationOptions;
    onGenerationOptionChange: (field: keyof GenerationOptions, value: string) => void;
    onGenerateScene: () => void;
    onCritiqueScene: () => void;
    isGenerating: boolean;
    isCritiquing: boolean;
    critique: CritiqueResult | null;
}

export function InspectorSceneTab({
    activeScene,
    sceneForm,
    onSceneFormChange,
    generationOptions,
    onGenerationOptionChange,
    onGenerateScene,
    onCritiqueScene,
    isGenerating,
    isCritiquing,
    critique
}: InspectorSceneTabProps) {
    if (!activeScene) {
        return <div className="ide-empty-hint">Select a scene to edit metadata.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="ide-field">
                <label className="ide-label">Slugline</label>
                <input
                    className="ide-input"
                    value={sceneForm.slugline}
                    onChange={(event) => onSceneFormChange('slugline', event.target.value)}
                />
            </div>
            <div className="ide-field">
                <label className="ide-label">Summary</label>
                <textarea
                    className="ide-textarea ide-textarea-sm"
                    value={sceneForm.summary}
                    onChange={(event) => onSceneFormChange('summary', event.target.value)}
                />
            </div>
            <div className="ide-field">
                <label className="ide-label">Goal</label>
                <textarea
                    className="ide-textarea ide-textarea-sm"
                    value={sceneForm.goal}
                    onChange={(event) => onSceneFormChange('goal', event.target.value)}
                />
            </div>
            <div className="ide-field">
                <label className="ide-label">Status</label>
                <select
                    className="ide-select"
                    value={sceneForm.status}
                    onChange={(event) => onSceneFormChange('status', event.target.value as Scene['status'])}
                >
                    <option value="planned">Planned</option>
                    <option value="drafted">Drafted</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="final">Final</option>
                </select>
            </div>
            <div className="ide-field">
                <label className="ide-label">Generation Format</label>
                <select
                    className="ide-select"
                    value={generationOptions.format}
                    onChange={(event) => onGenerationOptionChange('format', event.target.value)}
                >
                    <option value="film">Feature Film</option>
                    <option value="short">Short Film</option>
                    <option value="youtube">YouTube</option>
                    <option value="commercial">Commercial</option>
                    <option value="tv-episode">TV Episode</option>
                </select>
            </div>
            <div className="ide-field">
                <label className="ide-label">Generation Style</label>
                <select
                    className="ide-select"
                    value={generationOptions.style}
                    onChange={(event) => onGenerationOptionChange('style', event.target.value)}
                >
                    <option value="classic">Classic Screenplay</option>
                    <option value="dialogue-driven">Dialogue Driven</option>
                    <option value="visual-minimal">Visual Minimal</option>
                    <option value="action-heavy">Action Heavy</option>
                    <option value="experimental">Experimental</option>
                </select>
            </div>
            <div className="ide-field">
                <label className="ide-label">Scene Length</label>
                <select
                    className="ide-select"
                    value={generationOptions.sceneLength}
                    onChange={(event) => onGenerationOptionChange('sceneLength', event.target.value)}
                >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                    <option value="extended">Extended</option>
                </select>
            </div>
            <div className="ide-inline-actions">
                <button
                    className="ide-btn ide-btn-primary ide-btn-full"
                    onClick={onGenerateScene}
                    disabled={isGenerating}
                >
                    <Sparkles size={14} /> {isGenerating ? 'Generating...' : 'Generate Scene'}
                </button>
                <button
                    className="ide-btn ide-btn-secondary ide-btn-full"
                    onClick={onCritiqueScene}
                    disabled={isCritiquing}
                >
                    <Brain size={14} /> {isCritiquing ? 'Critiquing...' : 'Critique Scene'}
                </button>
            </div>
            {critique && (
                <div className="ide-critique-card">
                    <div className="ide-critique-header">
                        <Brain size={16} />
                        <div>
                            <div className="ide-critique-title">AI Critique</div>
                            <div className="ide-critique-score">Score: {critique.score}/100 ({critique.grade})</div>
                        </div>
                    </div>
                    <p className="ide-critique-summary">{critique.summary}</p>
                    <div className="ide-critique-section">
                        <span>Suggestions</span>
                        <ul>
                            {critique.suggestions.map((tip, index) => (
                                <li key={index}>{tip}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
