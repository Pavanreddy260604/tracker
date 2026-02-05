import { create } from 'zustand';
import { projectApi } from '../services/project.api';
import type { Bible, Scene } from '../services/project.api';

interface ProjectState {
    projects: Bible[];
    activeProject: Bible | null;
    scenes: Scene[];
    activeSceneId: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchProjects: (userId: string) => Promise<void>;
    createProject: (userId: string, data: Partial<Bible>) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    selectProject: (project: Bible) => Promise<void>;
    clearActiveProject: () => void;

    createScene: (data: Partial<Scene>) => Promise<void>;
    deleteScene: (sceneId: string) => Promise<void>;
    selectScene: (sceneId: string) => void;
    updateSceneLocal: (sceneId: string, updates: Partial<Scene>) => void;
    saveScene: (sceneId: string, updates: Partial<Scene>) => Promise<void>;
    critiqueScene: (sceneId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    activeProject: null,
    scenes: [],
    activeSceneId: null,
    isLoading: false,
    error: null,

    fetchProjects: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
            const projects = await projectApi.listProjects(userId);
            set({ projects, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    createProject: async (userId: string, data: Partial<Bible>) => {
        set({ isLoading: true, error: null });
        try {
            const newProject = await projectApi.createProject(userId, data);
            set(state => ({
                projects: [newProject, ...state.projects],
                activeProject: newProject,
                scenes: [],
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    deleteProject: async (projectId: string) => {
        set({ isLoading: true, error: null });
        try {
            await projectApi.deleteProject(projectId);
            set(state => ({
                projects: state.projects.filter(p => p._id !== projectId),
                // If deleting the active project, clear it
                activeProject: state.activeProject?._id === projectId ? null : state.activeProject,
                scenes: state.activeProject?._id === projectId ? [] : state.scenes,
                activeSceneId: state.activeProject?._id === projectId ? null : state.activeSceneId,
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    selectProject: async (project: Bible) => {
        set({ activeProject: project, isLoading: true, activeSceneId: null });
        try {
            const scenes = await projectApi.listScenes(project._id);
            set({ scenes, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    clearActiveProject: () => {
        set({
            activeProject: null,
            scenes: [],
            activeSceneId: null,
            isLoading: false,
            error: null
        });
    },

    createScene: async (data: Partial<Scene>) => {
        const { activeProject, scenes } = get();
        if (!activeProject) return;

        set({ isLoading: true });
        try {
            // Calculate next sequence if not provided
            const seq = data.sequenceNumber || (scenes.length > 0 ? scenes[scenes.length - 1].sequenceNumber + 1 : 1);

            const newScene = await projectApi.createScene(activeProject._id, { ...data, sequenceNumber: seq });
            set(state => ({
                scenes: [...state.scenes, newScene],
                activeSceneId: newScene._id,
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    deleteScene: async (sceneId: string) => {
        set({ isLoading: true, error: null });
        try {
            await projectApi.deleteScene(sceneId);
            set(state => {
                const newScenes = state.scenes.filter(s => s._id !== sceneId);
                // If deleting the active scene, select the first remaining scene or null
                const newActiveSceneId = state.activeSceneId === sceneId
                    ? (newScenes.length > 0 ? newScenes[0]._id : null)
                    : state.activeSceneId;
                return {
                    scenes: newScenes,
                    activeSceneId: newActiveSceneId,
                    isLoading: false
                };
            });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    selectScene: (sceneId: string) => {
        set({ activeSceneId: sceneId });
    },

    updateSceneLocal: (sceneId: string, updates: Partial<Scene>) => {
        set(state => ({
            scenes: state.scenes.map(s => s._id === sceneId ? { ...s, ...updates } : s)
        }));
    },

    saveScene: async (sceneId: string, updates: Partial<Scene>) => {
        try {
            const updated = await projectApi.updateScene(sceneId, updates);
            set(state => ({
                scenes: state.scenes.map(s => s._id === sceneId ? updated : s)
            }));
        } catch (err: any) {
            console.error("Failed to save scene", err);
        }
    },

    critiqueScene: async (sceneId: string) => {
        try {
            // Optimistic update status
            set(state => ({
                scenes: state.scenes.map(s => s._id === sceneId ? { ...s, status: 'reviewed' } : s)
            }));

            const critique = await projectApi.critiqueScene(sceneId);

            set(state => ({
                scenes: state.scenes.map(s => s._id === sceneId ? { ...s, critique } : s)
            }));
        } catch (err: any) {
            console.error("Failed to critique scene", err);
        }
    }
}));
