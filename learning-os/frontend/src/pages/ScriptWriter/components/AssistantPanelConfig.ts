import {
    Cpu,
    MessageSquare,
    type LucideIcon,
    Wand2
} from 'lucide-react';
import type { AssistantMode, AssistantScope } from '../types';

export type ModeConfig = {
    id: AssistantMode;
    label: string;
    icon: LucideIcon;
    accentClass: string;
    badgeClass: string;
};

export const MODES: ModeConfig[] = [
    { id: 'ask', label: 'Ask', icon: MessageSquare, accentClass: 'text-sky-300', badgeClass: 'border-sky-500/20 bg-sky-500/5 text-sky-300' },
    { id: 'edit', label: 'Edit', icon: Wand2, accentClass: 'text-amber-300', badgeClass: 'border-amber-500/20 bg-amber-500/5 text-amber-300' },
    { id: 'agent', label: 'Agent', icon: Cpu, accentClass: 'text-emerald-300', badgeClass: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' }
];

export function getModeConfig(mode?: AssistantMode): ModeConfig {
    return MODES.find((item) => item.id === mode) ?? MODES[0];
}

export function suggestions(mode: AssistantMode, scope: AssistantScope, hasSelection: boolean): string[] {
    if (mode === 'ask') {
        return hasSelection && scope === 'selection'
            ? ['What is weak in this selected section?', 'How would a pro tighten this?', 'Where is the subtext missing?']
            : ['Why is this scene weak?', 'What choice am I missing here?', 'How can this end harder without rewriting it?'];
    }

    if (scope === 'selection') {
        return ['Tighten this and add subtext.', 'Make this sharper and more cinematic.', 'Keep the meaning, cut the drag.'];
    }

    return ['Rewrite this scene with stronger conflict.', 'Improve pacing and sharpen the dialogue.', 'Make this feel like a finished screenplay scene.'];
}

export function placeholder(mode: AssistantMode, scope: AssistantScope, sceneName?: string): string {
    if (mode === 'ask') return sceneName ? `Ask about ${sceneName} or talk through the next choice...` : 'Ask a question, discuss a choice, or analyze what is not working...';
    if (scope === 'selection') return mode === 'agent' ? 'Tell the agent how to improve the selected lines...' : 'Describe the exact change for the selected lines...';
    return mode === 'agent' ? 'Describe the scene-level outcome you want...' : 'Describe the scene rewrite you want...';
}

export function statusText(mode: AssistantMode, scope: AssistantScope): string {
    if (mode === 'ask') return 'Thinking through your note...';
    if (scope === 'selection') return 'Preparing a local patch...';
    return 'Drafting a scene rewrite...';
}
