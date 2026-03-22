import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScriptWriterProjects } from './useScriptWriterProjects';
import { ProjectDashboard } from './ProjectDashboard';

export function ScriptWriterDashboard() {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    const {
        projects,
        loadingProjects,
        newProjectForm,
        isCreatingProject,
        creatingProject,
        setNewProjectForm,
        setIsCreatingProject,
        handleNewProject,
        handleDeleteProject,
    } = useScriptWriterProjects({
        setError,
        // No active project needed for dashboard
        activeProjectId: null,
        setActiveProjectId: () => { },
        activeSceneId: null,
        setActiveSceneId: () => { }
    });

    const handleProjectSelect = (projectId: string) => {
        // Navigate to the specific project route
        navigate(`/script-writer/${projectId}`);
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-console-bg text-status-error">
                Error: {error}
            </div>
        );
    }

    return (
        <ProjectDashboard
            projects={projects}
            loadingProjects={loadingProjects}
            onProjectSelect={handleProjectSelect}
            isCreatingProject={isCreatingProject}
            creatingProject={creatingProject}
            newProjectForm={newProjectForm}
            onNewProjectClick={() => setIsCreatingProject(true)}
            onNewProjectCancel={() => setIsCreatingProject(false)}
            onNewProjectFieldChange={(field, value) => setNewProjectForm((prev) => ({ ...prev, [field]: value }))}
            onNewProjectSubmit={handleNewProject}
            onProjectDelete={handleDeleteProject}
        />
    );
}
