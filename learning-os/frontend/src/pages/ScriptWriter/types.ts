import type { AssistantPreferences, IScene } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { ScriptRequest } from '../../services/scriptWriter.api';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
export type InspectorTab = 'project' | 'scene';
export type StudioMode = 'write' | 'generate' | 'cast' | 'story';
export type AssistantTab = 'chat' | 'history';
export type AssistantMode = 'ask' | 'edit' | 'agent';
export type AssistantScope = 'scene' | 'selection';
export type AssistantIntent = 'chat' | 'selection_edit' | 'scene_edit' | 'ambiguous';

export type EditorSelection = {
    start: number;
    end: number;
    text: string;
    lineStart: number;
    lineEnd: number;
    lineCount: number;
    charCount: number;
    preview: string;
};

export type AssistantRequest = {
    content: string;
    mode: AssistantMode;
    scope: AssistantScope;
    selection?: EditorSelection | null;
};

export type AssistantMessage = {
    id: string;
    role: 'user' | 'assistant';
    type: 'instruction' | 'thought' | 'proposal' | 'chat';
    content: string;
    status?: 'streaming' | 'pending' | 'applied' | 'discarded' | 'error';
    timestamp: number;
    mode?: AssistantMode;
    scope?: AssistantScope;
    selectionLabel?: string;
    metadata?: {
        research?: string;
        plan?: string;
        explanation?: string;
        summary?: string;
        thoughtDuration?: number;
        analyzedFiles?: { name: string; type: string }[];
    };
};

export type PendingFixState = {
    content: string;
    critique?: IScene['critique'];
    auditNotes?: string;
    isSuperior?: boolean;
    benchmarkScore?: number;
    mode?: 'fix' | 'proposal';
    isStreaming?: boolean;
    proposalMessageId?: string;
    commitProposal?: () => Promise<void>;
    discardProposal?: () => Promise<void>;
};

export type SceneForm = {
    title: string;
    slugline: string;
    summary: string;
    goal: string;
    status: IScene['status'];
};

export type ProjectForm = {
    title: string;
    logline: string;
    genre: string;
    tone: string;
    language: string;
    transliteration: boolean;
    intendedRuntime?: number;
    targetSceneCount?: number;
    assistantPreferences: AssistantPreferences;
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
    transliteration: boolean;
    speedMode?: boolean;
};

export const DEFAULT_SCENE_FORM: SceneForm = {
    title: '',
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
    language: 'English',
    transliteration: false,
    targetSceneCount: 60,
    assistantPreferences: {
        defaultMode: 'ask',
        savedDirectives: []
    }
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
    language: 'English',
    transliteration: false,
    speedMode: false
};

export const DEFAULT_NEW_PROJECT: ProjectForm = {
    title: 'Untitled Script',
    logline: 'Add a logline to guide the story.',
    genre: 'Drama',
    tone: 'Cinematic',
    language: 'English',
    transliteration: false,
    intendedRuntime: 120,
    targetSceneCount: 60,
    assistantPreferences: {
        defaultMode: 'ask',
        savedDirectives: []
    }
};
