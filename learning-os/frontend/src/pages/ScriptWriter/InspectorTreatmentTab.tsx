import { ClipboardList, Save, Sparkles, Wand2 } from 'lucide-react';
import type { Bible } from '../../services/project.api';
import type { Act, Treatment } from '../../services/treatment.api';

interface InspectorTreatmentTabProps {
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

export function InspectorTreatmentTab({
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
}: InspectorTreatmentTabProps) {
    if (!activeProject) {
        return <div className="ide-empty-hint">Select a project to work with treatments.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="ide-section">
                <div className="ide-section-title">Treatment Blueprint</div>
                <div className="ide-field">
                    <label className="ide-label flex flex-col">
                        Logline & Synopsis
                        <span className="text-[9px] text-zinc-500 font-normal mt-0.5">Define your core story. We will use this to generate a full act-by-act beat sheet.</span>
                    </label>
                    <textarea
                        className="ide-textarea ide-textarea-sm"
                        value={treatmentLogline}
                        onChange={(event) => onTreatmentLoglineChange(event.target.value)}
                        placeholder="Describe the story arc you want to map."
                    />
                </div>
                <div className="ide-field">
                    <label className="ide-label">Framework</label>
                    <select
                        className="ide-select"
                        value={treatmentStyle}
                        onChange={(event) => onTreatmentStyleChange(event.target.value)}
                    >
                        <option value="Save The Cat">Save The Cat</option>
                        <option value="Hero's Journey">Hero's Journey</option>
                        <option value="Three Act">Three Act</option>
                        <option value="TV Beat Sheet">TV Beat Sheet</option>
                    </select>
                </div>
                <div className="ide-inline-actions">
                    <button
                        className="ide-btn ide-btn-primary ide-btn-full"
                        onClick={onGenerateTreatment}
                        disabled={treatmentLoading}
                    >
                        <Sparkles size={14} /> {treatmentLoading ? 'Generating...' : 'Generate Treatment'}
                    </button>
                    <button
                        className="ide-btn ide-btn-secondary ide-btn-full"
                        onClick={onSaveTreatment}
                        disabled={!treatmentPreview || treatmentLoading}
                    >
                        <Save size={14} /> Save Blueprint
                    </button>
                </div>
            </div>

            {treatmentPreview && (
                <div className="ide-card">
                    <div className="ide-section-title">Preview</div>
                    <div className="ide-treatment-preview">
                        {treatmentPreview.map((act, index) => (
                            <div key={index} className="ide-treatment-act">
                                <div className="ide-treatment-title">{act.name}</div>
                                <ul>
                                    {act.beats.map((beat, beatIndex) => (
                                        <li key={beatIndex}>
                                            <strong>{beat.name}:</strong> {beat.description}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="ide-section">
                <div className="ide-section-title">Saved Treatments</div>
                {treatments.length === 0 ? (
                    <div className="ide-empty-hint">No treatments saved yet.</div>
                ) : (
                    <div className="ide-treatment-list">
                        {treatments.map((treatment) => (
                            <div key={treatment._id} className="ide-treatment-item">
                                <div>
                                    <div className="ide-treatment-title">{treatment.logline || 'Untitled Treatment'}</div>
                                    <div className="ide-treatment-meta">
                                        <ClipboardList size={12} /> {treatment.acts.length} acts • {treatment.style}
                                    </div>
                                </div>
                                <button
                                    className="ide-btn ide-btn-secondary ide-btn-sm"
                                    onClick={() => onConvertTreatment(treatment._id)}
                                    disabled={treatmentLoading}
                                >
                                    <Wand2 size={12} /> Convert to Scenes
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
