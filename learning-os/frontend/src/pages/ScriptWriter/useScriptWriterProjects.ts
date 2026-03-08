import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Bible, IScene as Scene } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import type { ProjectForm } from './types';
import { DEFAULT_NEW_PROJECT } from './types';
import { getErrorMessage } from './utils';
import { toast } from '../../stores/toastStore';

interface UseScriptWriterProjectsProps {
    activeProjectId?: string | null;
    setActiveProjectId?: (id: string | null) => void;
    activeSceneId?: string | null;
    setActiveSceneId?: (id: string | null) => void;
    setError: (message: string | null) => void;
}

export function useScriptWriterProjects({
    activeProjectId: propsActiveProjectId,
    setActiveProjectId: propsSetActiveProjectId,
    activeSceneId: propsActiveSceneId,
    setActiveSceneId: propsSetActiveSceneId,
    setError
}: UseScriptWriterProjectsProps) {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Bible[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
    const [projectScenes, setProjectScenes] = useState<Record<string, Scene[]>>({});
    const [loadingScenes, setLoadingScenes] = useState<Record<string, boolean>>({});

    // Internal fallbacks if props not provided (though we will provide them in Infinite)
    const [internalActiveProjectId, setInternalActiveProjectId] = useState<string | null>(null);
    const [internalActiveSceneId, setInternalActiveSceneId] = useState<string | null>(null);

    const activeProjectId = propsActiveProjectId !== undefined ? propsActiveProjectId : internalActiveProjectId;
    const setActiveProjectId = propsSetActiveProjectId || setInternalActiveProjectId;
    const activeSceneId = propsActiveSceneId !== undefined ? propsActiveSceneId : internalActiveSceneId;
    const setActiveSceneId = propsSetActiveSceneId || setInternalActiveSceneId;

    const [searchTerm, setSearchTerm] = useState('');

    const [newProjectForm, setNewProjectForm] = useState<ProjectForm>(DEFAULT_NEW_PROJECT);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [creatingProject, setCreatingProject] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    useEffect(() => {
        if (!activeProjectId) return;
        if (!projectScenes[activeProjectId]) {
            loadScenes(activeProjectId, false); // DO NOT auto-select, it overwrites specific scene clicks
        }
    }, [activeProjectId]);

    useEffect(() => {
        if (!activeProjectId) {
            setActiveSceneId(null);
        }
    }, [activeProjectId]);

    const loadProjects = async () => {
        setLoadingProjects(true);
        setError(null);
        try {
            const data = await projectApi.listProjects();
            setProjects(data);
            // No auto-selection - let user pick from dashboard
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load projects'));
        } finally {
            setLoadingProjects(false);
        }
    };

    const loadScenes = async (projectId: string, autoSelect?: boolean) => {
        try {
            setLoadingScenes((prev) => ({ ...prev, [projectId]: true }));
            const scenes = await projectApi.listScenes(projectId);
            setProjectScenes((prev) => ({ ...prev, [projectId]: scenes }));
            if (autoSelect && scenes.length > 0) {
                // Only auto-select if we asked for it (e.g. clicking Project header)
                setActiveSceneId(scenes[0]._id);
            } else if (autoSelect) {
                setActiveSceneId(null);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load scenes'));
        } finally {
            setLoadingScenes((prev) => ({ ...prev, [projectId]: false }));
        }
    };

    const updateSceneInState = useCallback((updatedScene: Scene, projectId: string | null) => {
        if (!projectId) return;
        setProjectScenes((prev) => {
            const scenes = prev[projectId] || [];
            const index = scenes.findIndex((scene) => scene._id === updatedScene._id);
            if (index === -1) return prev;
            const nextScenes = [...scenes];
            nextScenes[index] = updatedScene;
            return { ...prev, [projectId]: nextScenes };
        });
    }, []);

    const updateProjectInState = useCallback((updatedProject: Bible) => {
        setProjects((prev) => prev.map((project) => (project._id === updatedProject._id ? updatedProject : project)));
    }, []);

    const handleProjectToggle = (projectId: string) => {
        setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
        setActiveProjectId(projectId);
        setError(null);
        if (!projectScenes[projectId]) {
            loadScenes(projectId, true);
        }
    };

    const handleSceneSelect = (scene: Scene, projectId: string) => {
        setActiveProjectId(projectId);
        setActiveSceneId(scene._id);
        setError(null);
    };

    const handleNewProject = async () => {
        if (!newProjectForm.title.trim()) return;
        setCreatingProject(true);
        setError(null);
        try {
            const project = await projectApi.createProject('current', {
                title: newProjectForm.title,
                logline: newProjectForm.logline,
                genre: newProjectForm.genre,
                tone: newProjectForm.tone
            });
            setProjects((prev) => [project, ...prev]);
            setActiveProjectId(project._id);
            setExpandedProjects((prev) => ({ ...prev, [project._id]: true }));
            setProjectScenes((prev) => ({ ...prev, [project._id]: [] }));
            setIsCreatingProject(false);
            setNewProjectForm(DEFAULT_NEW_PROJECT);
            toast.success('Project created successfully');
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to create project');
            setError(msg);
            toast.error(msg);
        } finally {
            setCreatingProject(false);
        }
    };

    const handleNewScene = async (projectId: string | null) => {
        if (!projectId) return;
        setError(null);
        try {
            const newScene = await projectApi.createScene(projectId, {
                slugline: 'INT. NEW SCENE - DAY',
                summary: 'Describe the moment that anchors this scene.'
            });
            setProjectScenes((prev) => {
                const scenes = prev[projectId] || [];
                return { ...prev, [projectId]: [...scenes, newScene] };
            });
            setExpandedProjects((prev) => ({ ...prev, [projectId]: true }));
            setActiveProjectId(projectId);
            setActiveSceneId(newScene._id);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to create scene'));
        }
    };

    const handleDeleteScene = async (projectId: string, sceneId: string) => {
        setError(null);
        try {
            await projectApi.deleteScene(sceneId);
            setProjectScenes((prev) => {
                const scenes = prev[projectId] || [];
                return { ...prev, [projectId]: scenes.filter(s => s._id !== sceneId) };
            });
            if (activeSceneId === sceneId) {
                setActiveSceneId(null);
            }
            toast.success('Scene deleted successfully');
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to delete scene');
            setError(msg);
            toast.error(msg);
        }
    };

    const handleUpdateProject = async (projectId: string, updates: Partial<ProjectForm>) => {
        setError(null);
        try {
            const updated = await projectApi.updateProject(projectId, updates);
            setProjects((prev) => prev.map(p => p._id === projectId ? updated : p));
            toast.success('Project updated successfully');
            return updated;
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to update project');
            setError(msg);
            toast.error(msg);
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        setError(null);
        try {
            await projectApi.deleteProject(projectId);
            setProjects((prev) => prev.filter(p => p._id !== projectId));
            if (activeProjectId === projectId) {
                setActiveProjectId(null);
                navigate('/script-writer');
            }
            toast.success('Project deleted successfully');
        } catch (err) {
            const msg = getErrorMessage(err, 'Failed to delete project');
            setError(msg);
            toast.error(msg);
        }
    };

    const filteredScenes = useCallback(
        (projectId: string) => {
            const scenes = projectScenes[projectId] || [];
            if (!searchTerm.trim()) return scenes;
            const query = searchTerm.trim().toLowerCase();
            return scenes.filter((scene) => {
                const slugline = (scene.slugline || '').toLowerCase();
                const summary = (scene.summary || '').toLowerCase();
                return slugline.includes(query) || summary.includes(query);
            });
        },
        [projectScenes, searchTerm]
    );

    return {
        projects,
        loadingProjects,
        expandedProjects,
        loadingScenes,
        projectScenes,
        activeProjectId,
        activeSceneId,
        searchTerm,
        newProjectForm,
        isCreatingProject,
        creatingProject,
        setSearchTerm,
        setActiveProjectId,
        setActiveSceneId,
        setExpandedProjects,
        setNewProjectForm,
        setIsCreatingProject,
        loadProjects,
        loadScenes,
        updateSceneInState,
        updateProjectInState,
        handleProjectToggle,
        handleSceneSelect,
        handleNewProject,
        handleNewScene,
        handleDeleteScene,
        handleUpdateProject,
        handleDeleteProject,
        filteredScenes
    };
}
