import { useState } from 'react';
import { useTreatmentStore } from '../../stores/treatmentStore';
import { useProjectStore } from '../../stores/projectStore';
import { Loader2, Sparkles, LayoutGrid, CheckCircle2, AlertCircle } from 'lucide-react';

export function StoryEngine() {
    const { activeProject } = useProjectStore();
    const {
        currentPreview,
        isLoading,
        error,
        generatePreview,
        saveCurrentTreatment,
        convertToScenes,
        clearPreview
    } = useTreatmentStore();

    const [logline, setLogline] = useState(activeProject?.logline || '');
    const [conversionSuccess, setConversionSuccess] = useState(false);

    const handleGenerate = async () => {
        if (!logline.trim()) return;
        await generatePreview(logline);
    };

    const handleSaveAndConvert = async () => {
        if (!activeProject || !currentPreview) return;

        try {
            // 1. Save the treatment
            await saveCurrentTreatment(activeProject._id, logline);

            // 2. We need the ID of the saved treatment. 
            // In a real app the store would update, let's look at the latest treatment.
            const latest = useTreatmentStore.getState().treatments[0];
            if (latest) {
                await convertToScenes(latest._id);
                setConversionSuccess(true);
                setTimeout(() => setConversionSuccess(false), 3000);
            }
        } catch (err) {
            console.error('Save/Convert failed:', err);
        }
    };

    if (conversionSuccess) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="sw-status-icon is-success">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="sw-section-title mt-4">Story Applied</h3>
                <p className="sw-muted mt-2">
                    15 new scenes have been added to your project dashboard.
                </p>
                <button
                    onClick={() => clearPreview()}
                    className="sw-link mt-6"
                >
                    Generate another?
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* INPUT SECTION */}
            {!currentPreview && (
                <div className="space-y-4">
                    <div className="sw-callout">
                        <div className="sw-callout-icon">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="sw-callout-title">AI Story Architect</h3>
                            <p className="sw-callout-text">
                                Provide a logline and we will generate a complete 15-beat Save The Cat structure.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="sw-label">Logline / Concept</label>
                        <textarea
                            value={logline}
                            onChange={(e) => setLogline(e.target.value)}
                            placeholder="e.g. A failed detective discovers a conspiracy involving high-tech clones in 2049."
                            className="sw-textarea"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !logline.trim()}
                        className="sw-btn sw-btn-primary w-full justify-center"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        Build Story Foundation
                    </button>
                </div>
            )}

            {/* ERROR STATE */}
            {error && (
                <div className="sw-alert sw-alert-error">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* PREVIEW SECTION */}
            {currentPreview && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between">
                        <h3 className="sw-label">Treatment Preview</h3>
                        <button
                            onClick={() => clearPreview()}
                            className="sw-link is-danger"
                        >
                            Discard
                        </button>
                    </div>

                    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {currentPreview.map((act, actIdx) => (
                            <div key={actIdx} className="space-y-3">
                                <div className="sw-divider-row">
                                    <span>{act.name}</span>
                                </div>

                                {act.beats.map((beat, beatIdx) => (
                                    <div key={beatIdx} className="sw-card sw-card-hover p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="sw-step-indicator">
                                                {beatIdx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="sw-item-title">{beat.name}</h4>
                                                <p className="sw-item-subtitle mt-1">
                                                    {beat.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-[color:var(--border-subtle)] space-y-3">
                        <button
                            onClick={handleSaveAndConvert}
                            disabled={isLoading}
                            className="sw-btn sw-btn-primary w-full justify-center"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={14} /> : <LayoutGrid size={14} />}
                            Apply to Project (Create Scenes)
                        </button>
                        <p className="sw-muted text-xs text-center px-4">
                            This will save the treatment and create 15 planned scene documents in your dashboard.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
