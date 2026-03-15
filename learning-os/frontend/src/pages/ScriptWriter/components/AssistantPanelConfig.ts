import type { AssistantScope } from '../types';

export function suggestions(scope: AssistantScope, hasSelection: boolean): string[] {
    if (scope === 'selection' && hasSelection) {
        return ['Tighten these lines and add subtext.', 'Sharpen the conflict in this selection.', 'Keep the meaning but cut the drag.'];
    }

    return ['Critique the pacing and subtext of this scene.', 'Rewrite this scene with stronger conflict.', 'Improve the dialogue and tighten the ending.'];
}

export function placeholder(scope: AssistantScope, sceneName?: string): string {
    if (scope === 'selection') {
        return 'Tell me how to improve these selected lines...';
    }
    return sceneName
        ? `Ask for analysis or changes in ${sceneName}...`
        : 'Ask for analysis or tell me what to change in the scene...';
}

export function statusText(scope: AssistantScope): string {
    return scope === 'selection'
        ? 'Working on your selected lines...'
        : 'Working on your scene...';
}
