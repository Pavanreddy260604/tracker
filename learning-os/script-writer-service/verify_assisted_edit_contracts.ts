import assert from 'node:assert/strict';
import { scriptGenerator } from './src/services/scriptGenerator.service';
import {
    cleanAssistantChatResponse,
    extractBestEffortAssistantAnswer,
    extractBestEffortScreenplay,
    extractStructuredAssistantSections,
    normalizeScreenplayWhitespace
} from './src/utils/screenplayFormatting';

const generator = scriptGenerator as unknown as {
    buildAssistantOutputContract: (
        mode: 'ask' | 'edit' | 'agent',
        target: 'scene' | 'selection',
        selection?: { text?: string } | null
    ) => string;
    classifyAskIntent: (
        instruction: string,
        target: 'scene' | 'selection',
        selection?: { text?: string } | null
    ) => 'chat' | 'selection_edit' | 'scene_edit' | 'ambiguous';
    buildAssistantPreferencesBlock: (
        preferences: {
            defaultMode?: 'ask' | 'edit' | 'agent';
            replyLanguage?: string;
            transliteration?: boolean;
            savedDirectives?: string[];
        },
        language: string,
        transliteration: boolean
    ) => string;
};

const askContract = generator.buildAssistantOutputContract('ask', 'scene');
assert.match(askContract, /Respond in markdown/i);
assert.doesNotMatch(askContract, /SCENE_SCRIPT:/i);
assert.match(askContract, /do not perform it in ASK mode/i);

const sceneEditContract = generator.buildAssistantOutputContract('edit', 'scene');
assert.match(sceneEditContract, /Output only the full revised screenplay content/i);
assert.doesNotMatch(sceneEditContract, /SCENE_SCRIPT:/i);

const selectionEditContract = generator.buildAssistantOutputContract('edit', 'selection', {
    text: 'ADHIRATHA\n(whispers)\nThis basket came from the river.'
});
assert.match(selectionEditContract, /script-edit/i);
assert.match(selectionEditContract, /<<<SEARCH>>>/);
assert.match(selectionEditContract, /<<<REPLACE>>>/);

const normalizedDialogue = normalizeScreenplayWhitespace(`

INT. ADHIRATHA'S HOUSE - DAY


ADHIRATHA

(quietly)

This basket came from the river.


RADHA

What child is this?

`);

assert.equal(
    normalizedDialogue,
    [
        "INT. ADHIRATHA'S HOUSE - DAY",
        '',
        'ADHIRATHA',
        '(quietly)',
        'This basket came from the river.',
        '',
        'RADHA',
        'What child is this?'
    ].join('\n')
);

const forcedBlank = normalizeScreenplayWhitespace(`CHARIOT\n  \nROLLS FORWARD`);
assert.equal(forcedBlank, `CHARIOT\n  \nROLLS FORWARD`);

const hybridResponse = extractStructuredAssistantSections(`
STORY_CONTEXT_SUMMARY:
The child arrives as a quiet omen.

SCENE_PLAN:
Adhiratha hides his fear behind restraint.

SCENE_SCRIPT:

INT. RIVERBANK - DAWN


ADHIRATHA

The river has sent us an answer.

CHARACTER_MEMORY_UPDATE (JSON):
{"updates":[]}

PLOT_STATE_UPDATE (JSON):
{"newEvents":[],"cluesRevealed":[]}
`);

assert.equal(hybridResponse.summary, 'The child arrives as a quiet omen.');
assert.equal(hybridResponse.plan, 'Adhiratha hides his fear behind restraint.');
assert.equal(
    hybridResponse.script,
    ['INT. RIVERBANK - DAWN', '', 'ADHIRATHA', 'The river has sent us an answer.'].join('\n')
);

assert.equal(cleanAssistantChatResponse('RESPONSE:\n\nUse a tighter cue here.'), 'Use a tighter cue here.');

assert.equal(
    extractBestEffortScreenplay(`
STORY_CONTEXT_SUMMARY:
The house is tense.

INT. ADHIRATHA'S HOUSE - DAY

RADHA
మన దారి ఇది కాదేమో.

CHARACTER_MEMORY_UPDATE (JSON):
{"updates":[]}
`),
    ['INT. ADHIRATHA\'S HOUSE - DAY', '', 'RADHA', 'మన దారి ఇది కాదేమో.'].join('\n')
);

const markdownStructuredResponse = `
### STORY_CONTEXT_SUMMARY
Karna enters the household under secrecy.

### SCENE_PLAN
Adhiratha chooses resolve over fear.

### SCENE_SCRIPT
FADE IN:

EXT. RIVERBANK - DAY

ADHIRATHA
ఈ బిడ్డ ఎవరిదో దేవుడికే తెలుసు.

### CHARACTER_MEMORY_UPDATE (JSON)
{"updates":[]}
`;

assert.equal(
    extractStructuredAssistantSections(markdownStructuredResponse).script,
    ['FADE IN:', '', 'EXT. RIVERBANK - DAY', '', 'ADHIRATHA', 'ఈ బిడ్డ ఎవరిదో దేవుడికే తెలుసు.'].join('\n')
);

assert.equal(
    extractBestEffortAssistantAnswer(markdownStructuredResponse),
    ['Karna enters the household under secrecy.', 'Adhiratha chooses resolve over fear.'].join('\n\n')
);

assert.equal(
    generator.classifyAskIntent('Why is this scene weak?', 'scene'),
    'chat'
);

assert.equal(
    generator.classifyAskIntent('Rewrite these lines tighter.', 'selection', {
        text: 'RADHA\nWhat child is this?'
    }),
    'selection_edit'
);

assert.equal(
    generator.classifyAskIntent('Rewrite this scene with stronger conflict.', 'scene'),
    'scene_edit'
);

assert.equal(
    generator.classifyAskIntent('How would you tighten this scene?', 'scene'),
    'ambiguous'
);

const assistantPreferencesBlock = generator.buildAssistantPreferencesBlock({
    defaultMode: 'ask',
    replyLanguage: 'Telugu',
    transliteration: false,
    savedDirectives: ['keep dialogue in Telugu', 'prefer elevated dramatic register']
}, 'Telugu', false);

assert.match(assistantPreferencesBlock, /Preferred reply language: Telugu/);
assert.match(assistantPreferencesBlock, /keep dialogue in Telugu/);

console.log('verify_assisted_edit_contracts: ok');
