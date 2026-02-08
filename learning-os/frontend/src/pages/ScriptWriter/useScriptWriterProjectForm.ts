import { useEffect, useState } from 'react';
import type { Bible } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import { DEFAULT_PROJECT_FORM, type ProjectForm } from './types';
import { getErrorMessage } from './utils';

interface UseScriptWriterProjectFormProps {
    activeProject: Bible | null;
    onProjectUpdated: (project: Bible) => void;
    setError: (message: string | null) => void;
}

export function useScriptWriterProjectForm({
    activeProject,
    onProjectUpdated,
    setError
}: UseScriptWriterProjectFormProps) {
    const [projectForm, setProjectForm] = useState<ProjectForm>(DEFAULT_PROJECT_FORM);
    const [projectDirty, setProjectDirty] = useState(false);

    useEffect(() => {
        if (!activeProject) return;
        setProjectForm({
            title: activeProject.title || '',
            logline: activeProject.logline || '',
            genre: activeProject.genre || 'Drama',
            tone: activeProject.tone || 'Cinematic',
            language: (activeProject as any).language || 'English'
        });
        setProjectDirty(false);
    }, [activeProject?._id]);

    const handleProjectFormChange = (field: keyof ProjectForm, value: string) => {
        setProjectForm((prev) => ({ ...prev, [field]: value }));
        setProjectDirty(true);
    };

    const handleSaveProject = async () => {
        if (!activeProject) return;
        try {
            const updated = await projectApi.updateProject(activeProject._id, projectForm);
            onProjectUpdated(updated);
            setProjectDirty(false);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to update project'));
        }
    };

    return {
        projectForm,
        projectDirty,
        handleProjectFormChange,
        handleSaveProject
    };
}
