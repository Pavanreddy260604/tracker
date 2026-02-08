import { useEffect, useState } from 'react';
import type { Bible } from '../../services/project.api';
import type { Act, Treatment } from '../../services/treatment.api';
import { treatmentApi } from '../../services/treatment.api';
import { getErrorMessage } from './utils';

interface UseScriptWriterTreatmentsProps {
    activeProject: Bible | null;
    activeProjectId: string | null;
    setError: (message: string | null) => void;
    refreshScenes?: (projectId: string, autoSelect?: boolean) => Promise<void>;
}

export function useScriptWriterTreatments({
    activeProject,
    activeProjectId,
    setError,
    refreshScenes
}: UseScriptWriterTreatmentsProps) {
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [treatmentPreview, setTreatmentPreview] = useState<Act[] | null>(null);
    const [treatmentLogline, setTreatmentLogline] = useState('');
    const [treatmentStyle, setTreatmentStyle] = useState('Save The Cat');
    const [treatmentLoading, setTreatmentLoading] = useState(false);

    useEffect(() => {
        if (activeProject?.logline && !treatmentLogline) {
            setTreatmentLogline(activeProject.logline);
        }
    }, [activeProject?.logline]);

    useEffect(() => {
        if (!activeProjectId) {
            setTreatments([]);
            setTreatmentPreview(null);
            setTreatmentLogline('');
            return;
        }
        loadTreatments(activeProjectId);
    }, [activeProjectId]);

    const loadTreatments = async (projectId: string) => {
        setTreatmentLoading(true);
        try {
            const data = await treatmentApi.getTreatments(projectId);
            setTreatments(data);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load treatments'));
        } finally {
            setTreatmentLoading(false);
        }
    };

    const handleTreatmentGenerate = async () => {
        if (!treatmentLogline.trim()) return;
        setTreatmentLoading(true);
        try {
            const acts = await treatmentApi.generateTreatment(treatmentLogline, treatmentStyle);
            setTreatmentPreview(acts);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to generate treatment'));
        } finally {
            setTreatmentLoading(false);
        }
    };

    const handleTreatmentSave = async () => {
        if (!activeProjectId || !treatmentPreview) return;
        setTreatmentLoading(true);
        try {
            const saved = await treatmentApi.saveTreatment(activeProjectId, treatmentLogline, treatmentPreview, treatmentStyle);
            setTreatments((prev) => [saved, ...prev]);
            setTreatmentPreview(null);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save treatment'));
        } finally {
            setTreatmentLoading(false);
        }
    };

    const handleTreatmentConvert = async (treatmentId: string) => {
        if (!activeProjectId) return;
        setTreatmentLoading(true);
        try {
            await treatmentApi.convertToScenes(treatmentId);
            await loadTreatments(activeProjectId);
            if (refreshScenes) {
                await refreshScenes(activeProjectId, false);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to convert treatment'));
        } finally {
            setTreatmentLoading(false);
        }
    };

    return {
        treatments,
        treatmentPreview,
        treatmentLogline,
        treatmentStyle,
        treatmentLoading,
        setTreatmentLogline,
        setTreatmentStyle,
        handleTreatmentGenerate,
        handleTreatmentSave,
        handleTreatmentConvert
    };
}
