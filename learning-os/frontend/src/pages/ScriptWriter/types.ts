import type { Scene } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { ScriptRequest } from '../../services/scriptWriter.api';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
export type InspectorTab = 'project' | 'scene';
export type StudioMode = 'write' | 'generate' | 'cast' | 'story';

export type SceneForm = {
    slugline: string;
    summary: string;
    goal: string;
    status: Scene['status'];
};

export type ProjectForm = {
    title: string;
    logline: string;
    genre: string;
    tone: string;
    language: string;
};

export type CharacterForm = {
    name: string;
    role: Character['role'];
    voiceDescription: string;
    voiceAccent: string;
    traits: string;
    motivation: string;
};

export type GenerationOptions = {
    style: string;
    format: string;
    sceneLength: ScriptRequest['sceneLength'];
    language: string;
};

export const DEFAULT_SCENE_FORM: SceneForm = {
    slugline: '',
    summary: '',
    goal: '',
    status: 'planned'
};

export const DEFAULT_PROJECT_FORM: ProjectForm = {
    title: '',
    logline: '',
    genre: 'Drama',
    tone: 'Cinematic',
    language: 'English'
};

export const DEFAULT_CHARACTER_FORM: CharacterForm = {
    name: '',
    role: 'supporting',
    voiceDescription: '',
    voiceAccent: '',
    traits: '',
    motivation: ''
};

export const DEFAULT_GENERATION: GenerationOptions = {
    style: 'classic',
    format: 'film',
    sceneLength: 'medium',
    language: 'English'
};

export const DEFAULT_NEW_PROJECT: ProjectForm = {
    title: 'Untitled Script',
    logline: 'Add a logline to guide the story.',
    genre: 'Drama',
    tone: 'Cinematic',
    language: 'English'
};
