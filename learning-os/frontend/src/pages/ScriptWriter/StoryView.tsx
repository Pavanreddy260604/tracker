import { Brain, Sparkles, Save, Wand2 } from 'lucide-react';
import type { Bible } from '../../services/project.api';
import type { Act, Treatment } from '../../services/treatment.api';

interface StoryViewProps {
    activeProject: Bible | null;
    treatments: Treatment[];
    treatmentPreview: Act[] | null;
    treatmentLogline: string;
    treatmentStyle: string;
    onTreatmentLoglineChange: (value: string) => void;
    onTreatmentStyleChange: (value: string) => void;
    onGenerateTreatment: () => void;
    onSaveTreatment: () => void;
    onConvertTreatment: (id: string) => void;
    treatmentLoading: boolean;
}

export function StoryView({
    activeProject,
    treatments,
    treatmentPreview,
    treatmentLogline,
    treatmentStyle,
    onTreatmentLoglineChange,
    onTreatmentStyleChange,
    onGenerateTreatment,
    onSaveTreatment,
    onConvertTreatment,
    treatmentLoading
}: StoryViewProps) {
    if (!activeProject) {
        return (
            <div className="studio-view-empty">
                <Brain size={48} strokeWidth={1} />
                <h2>Story Structure</h2>
                <p>Select a project from the explorer to plan your story.</p>
            </div>
        );
    }

    return (
        <div className="story-view">
            {/* Generator Panel */}
            <div className="story-generator">
                <h2>Treatment Blueprint</h2>
                <p className="helper-text">Generate a structured treatment based on classic story frameworks.</p>

                <div className="form-field">
                    <label>Logline / Story Concept</label>
                    <textarea
                        className="form-textarea"
                        rows={4}
                        value={treatmentLogline}
                        onChange={(e) => onTreatmentLoglineChange(e.target.value)}
                        placeholder="Describe the core story arc you want to map out..."
                    />
                </div>

                <div className="form-field">
                    <label>Story Framework</label>
                    <select
                        className="form-select"
                        value={treatmentStyle}
                        onChange={(e) => onTreatmentStyleChange(e.target.value)}
                    >
                        <option value="Save The Cat">Save The Cat</option>
                        <option value="Hero's Journey">Hero's Journey</option>
                        <option value="Three Act">Three Act Structure</option>
                        <option value="TV Beat Sheet">TV Beat Sheet</option>
                    </select>
                </div>

                <div className="btn-row">
                    <button
                        className="btn btn-primary"
                        onClick={onGenerateTreatment}
                        disabled={treatmentLoading || !treatmentLogline.trim()}
                    >
                        <Sparkles size={16} />
                        {treatmentLoading ? 'Generating...' : 'Generate Treatment'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={onSaveTreatment}
                        disabled={!treatmentPreview || treatmentLoading}
                    >
                        <Save size={16} />
                        Save Blueprint
                    </button>
                </div>
            </div>

            {/* Preview Panel */}
            {treatmentPreview && (
                <div className="treatment-preview">
                    <h3>Generated Structure</h3>
                    <div className="acts-grid">
                        {treatmentPreview.map((act, index) => (
                            <div key={index} className="act-card">
                                <div className="act-header">{act.name}</div>
                                <ul className="beat-list">
                                    {act.beats.map((beat, beatIndex) => (
                                        <li key={beatIndex}>
                                            <strong>{beat.name}</strong>
                                            <span>{beat.description}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Saved Treatments */}
            {treatments.length > 0 && (
                <div className="saved-treatments">
                    <h3>Saved Treatments</h3>
                    <div className="treatment-list">
                        {treatments.map((treatment) => (
                            <div key={treatment._id} className="treatment-item">
                                <div className="treatment-info">
                                    <div className="treatment-title">{treatment.logline || 'Untitled'}</div>
                                    <div className="treatment-meta">{treatment.acts.length} acts • {treatment.style}</div>
                                </div>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => onConvertTreatment(treatment._id)}
                                    disabled={treatmentLoading}
                                >
                                    <Wand2 size={14} />
                                    Convert to Scenes
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
