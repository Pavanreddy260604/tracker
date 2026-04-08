
import mongoose from 'mongoose';
import { aiServiceManager } from './ai.manager';
import { vectorService } from './vector.service';
import { buildScriptPrompt, FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood';
import { Script } from '../models/Script';
import { Character } from '../models/Character';
import { User } from '../models/User';
import { Bible } from '../models/Bible';
import { Scene } from '../models/Scene';
import { assistantRagService } from './assistantRag.service';
import { characterDiscoveryService } from './characterDiscovery.service';
import {
    cleanAssistantChatResponse,
    extractBestEffortAssistantAnswer,
    extractBestEffortScreenplay,
    extractStructuredAssistantSections,
    hasStructuredAssistantSections,
    normalizeScreenplayWhitespace
} from '../utils/screenplayFormatting';
import { intentService } from './intent.service';
import { storyPlannerService } from './storyPlanner.service';
import { stateManagerService } from './stateManager.service';

const ASSISTANT_V2_ENABLED = (process.env.SCRIPT_WRITER_ASSISTANT_V2 || 'true').toLowerCase() !== 'false';
const EXPLANATION_TEXT_LIMIT = 4000;

export interface ScriptRequest {
    userId: string;
    idea: string;
    format: keyof typeof FORMAT_TEMPLATES;
    style: keyof typeof STYLE_PROMPTS;
    genre?: string;
    tone?: string;
    language?: string;
    transliteration?: boolean;
    bibleId?: string;
    characterIds?: string[];
    previousContext?: string;
    sceneLength?: 'short' | 'medium' | 'long' | 'extended';
    era?: string;
    polarityShift?: string;
    centralTactic?: string;
    internalRhythm?: 'slow' | 'fast' | 'staccato' | 'fluid';
    useAdvancedCoherence?: boolean;
    model?: string;
    speedMode?: boolean;
}

interface AssistedEditSelection {
    text: string;
    start?: number;
    end?: number;
    lineStart?: number;
    lineEnd?: number;
    lineCount?: number;
    charCount?: number;
    preview?: string;
}

interface AssistedEditOptions {
    language?: string;
    mode?: 'ask' | 'edit' | 'agent';
    target?: 'scene' | 'selection';
    currentContent?: string;
    selection?: AssistedEditSelection | null;
    transliteration?: boolean;
    model?: string;
}

type AssistantPreferenceState = {
    defaultMode?: 'ask' | 'edit' | 'agent';
    replyLanguage?: string;
    transliteration?: boolean;
    savedDirectives?: string[];
};

type NormalizedAssistantPreferences = {
    defaultMode: 'ask' | 'edit' | 'agent';
    replyLanguage: string;
    transliteration?: boolean;
    savedDirectives: string[];
};

type AskIntent = 'chat' | 'selection_edit' | 'scene_edit' | 'ambiguous';

export class ScriptGeneratorService {
    private pendingTasks: Set<Promise<any>> = new Set();

    async *generateScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
        console.log(`[ScriptGen] Building prompt for: ${request.format} / ${request.style}`);

        if (request.useAdvancedCoherence) {
            yield* this.generateAdvancedScript(request);
            return;
        }

        let ownerId = request.userId || '000000000000000000000000';
        let targetLanguage = request.language;
        let transliteration = request.transliteration;

        if ((!targetLanguage || transliteration === undefined) && request.bibleId) {
            const bible = await Bible.findById(request.bibleId).lean();
            if (bible) {
                if (!targetLanguage) targetLanguage = (bible as any).language;
                if (transliteration === undefined) transliteration = (bible as any).transliteration;
            }
        }
        request.language = targetLanguage || 'English';
        request.transliteration = !!transliteration;

        const scriptDoc = new Script({
            userId: new mongoose.Types.ObjectId(ownerId),
            prompt: request.idea,
            format: request.format,
            style: request.style,
            language: request.language,
            status: 'generating',
            metadata: { genre: request.genre, tone: request.tone, bibleId: request.bibleId }
        });
        await scriptDoc.save();

        let similarSamples: any[] = [];
        if (!request.speedMode) {
            try {
                const userInterests = await this.getUserInterestsForBible({ userId: ownerId } as any);
                const pack = await assistantRagService.buildAssistantReferencePack({
                    instruction: request.idea,
                    mode: 'edit',
                    target: 'scene',
                    language: request.language,
                    bibleId: request.bibleId,
                    userInterests: userInterests ?? undefined
                } as any);
                similarSamples = (pack as any).retrievalMetadata?.chunks || [];
            } catch (err) {
                console.warn(`[ScriptGenerator] RAG Lookup failed: ${err}`);
            }
        }

        let castContext: any[] = [];
        if (request.characterIds?.length) {
            castContext = await Character.find({ _id: { $in: request.characterIds } }).lean();
        } else if (request.bibleId) {
            castContext = await Character.find({ bibleId: request.bibleId }).lean();
        }

        const fullPrompt = buildScriptPrompt(
            request.idea,
            request.format,
            request.style,
            {
                genre: request.genre,
                tone: request.tone,
                language: request.language,
                transliteration: request.transliteration,
                sceneLength: request.sceneLength,
                polarityShift: request.polarityShift
            },
            similarSamples,
            castContext
        );

        const stateGuidance = castContext.length > 0 ? '\n\n## CHARACTER CONTINUITY:\n' + stateManagerService.buildCharacterContext(castContext) + '\n' : '';
        const beatSheet = await storyPlannerService.generateBeatSheet(request, similarSamples, castContext);

        let finalPrompt = stateGuidance + fullPrompt;
        if (beatSheet) {
            finalPrompt += `\n\n## APPROVED BEAT SHEET:\n${JSON.stringify(beatSheet, null, 2)}\n\nNow write the scene.`;
        }

        const stream = aiServiceManager.chatStream([{ role: 'user', content: finalPrompt }]);
        let finalContent = '';

        try {
            for await (const chunk of stream) {
                finalContent += chunk;
                yield chunk;
            }

            scriptDoc.content = finalContent;
            scriptDoc.status = 'completed';
            await scriptDoc.save();

            if (request.bibleId) {
                this.pendingTasks.add(characterDiscoveryService.discoverAndSave(request.bibleId, finalContent));
            }
            this.pendingTasks.add(stateManagerService.extractAndSaveState(finalContent, castContext));

        } catch (error) {
            scriptDoc.status = 'failed';
            await scriptDoc.save();
            throw error;
        }
    }

    async *generateAdvancedScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
        const { ULTIMATE_COHERENCE_PROMPT } = require('../prompts/hollywood');
        const bible = request.bibleId ? await Bible.findById(request.bibleId) : null;
        if (bible) await storyPlannerService.ensureGlobalOutline(bible as any);

        const castContext = request.characterIds?.length ? await Character.find({ _id: { $in: request.characterIds } }).lean() : [];
        const characterMemoryText = stateManagerService.buildCharacterContext(castContext);

        const finalPrompt = ULTIMATE_COHERENCE_PROMPT
            .replace('{{user_prompt}}', request.idea)
            .replace('{{global_outline}}', bible?.globalOutline?.join('\n') || '')
            .replace('{{story_so_far}}', bible?.storySoFar || '')
            .replace('{{character_memory}}', characterMemoryText || '')
            .replace('{{plot_state}}', request.previousContext || 'Starting build.');

        const stream = aiServiceManager.chatStream([{ role: 'user', content: finalPrompt }]);
        let alreadyYieldedLength = 0;
        let isYieldingScript = false;
        let fullResponse = '';

        for await (const chunk of stream) {
            fullResponse += chunk;
            if (!isYieldingScript && /SCENE_SCRIPT:/i.test(fullResponse)) isYieldingScript = true;
            if (isYieldingScript) {
                const scriptMatch = fullResponse.match(/SCENE_SCRIPT:\s*([\s\S]*)$/i);
                if (scriptMatch) {
                    const scriptText = scriptMatch[1];
                    const markerMatch = scriptText.match(/(STORY_CONTEXT_SUMMARY|SCENE_PLAN|CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE)/i);
                    const safeTotalLength = markerMatch ? (markerMatch.index || 0) : Math.max(0, scriptText.length - 40);
                    const safeDelta = scriptText.slice(alreadyYieldedLength, safeTotalLength);
                    if (safeDelta) {
                        yield safeDelta;
                        alreadyYieldedLength += safeDelta.length;
                    }
                    if (markerMatch) isYieldingScript = false;
                }
            }
        }
    }

    async *assistedEdit(sceneId: string, instruction: string, options: AssistedEditOptions = {}): AsyncGenerator<string, void, unknown> {
        const { HYBRID_ASSISTANT_ULTIMATE_PROMPT, SCRIPT_EDITOR_AGENT_PROMPT } = require('../prompts/hollywood');
        const scene = await Scene.findById(sceneId).populate('bibleId');
        if (!scene) throw new Error('Scene not found');
        const bible = scene.bibleId as any;

        const assistantPreferences = this.getAssistantPreferences(bible);
        const language = options.language || assistantPreferences.replyLanguage || bible?.language || 'English';
        const target = options.target === 'selection' && options.selection?.text?.trim() ? 'selection' : 'scene';
        const originalContent = options.currentContent ?? scene.content ?? '';

        const castContext = bible?._id ? await Character.find({ bibleId: bible._id }).lean() : [];
        const characterMemoryText = stateManagerService.buildCharacterContext(castContext);

        const intentContext = { hasScene: true, hasSelection: target === 'selection', currentMode: options.mode || 'edit' };
        if (intentService.isSmallTalk(instruction)) {
            const res = await intentService.generateSmallTalkResponse(instruction);
            yield res;
            return;
        }

        const eliteDecision = await intentService.classifyIntentElite(instruction, intentContext);
        let effectiveMode = options.mode || 'edit';
        if (effectiveMode === 'ask' && (eliteDecision.intent === 'scene_edit' || eliteDecision.intent === 'selection_edit')) {
            effectiveMode = 'agent';
        }

        const ragPack = await assistantRagService.buildAssistantReferencePack({
            instruction,
            mode: effectiveMode,
            target,
            language,
            currentContent: originalContent,
            selection: options.selection,
            bible,
            scene: scene as any
        });

        const prompt = this.buildEditorAssistantPrompt(effectiveMode === 'ask' ? SCRIPT_EDITOR_AGENT_PROMPT : HYBRID_ASSISTANT_ULTIMATE_PROMPT, {
            mode: effectiveMode,
            target,
            story_so_far: bible?.storySoFar || '',
            slugline: scene.slugline || 'Current Scene',
            summary: scene.summary || '',
            characters: characterMemoryText,
            language,
            transliteration: Boolean(options.transliteration ?? assistantPreferences.transliteration),
            original_content: originalContent,
            selection_block: this.buildAssistantSelectionBlock(options.selection),
            chat_history: this.buildAssistantChatHistoryText(scene.assistantChatHistory as any),
            similar_samples: ragPack.promptSections,
            instruction,
            output_contract: this.buildAssistantOutputContract(effectiveMode, target, options.selection),
            assistant_preferences: this.buildAssistantPreferencesBlock(assistantPreferences, language, Boolean(options.transliteration))
        });

        // PH 6: Persist User Instruction to History
        if (!scene.assistantChatHistory) scene.assistantChatHistory = [];
        scene.assistantChatHistory.push({ 
            role: 'user', 
            type: effectiveMode === 'ask' ? 'chat' : 'instruction', 
            content: instruction, 
            timestamp: new Date() 
        } as any);
        await scene.save();

        let fullResponse = '';
        try {
            const stream = aiServiceManager.chatStream([{ role: 'user', content: prompt }]);
            for await (const chunk of stream) {
                fullResponse += chunk;
                yield chunk;
            }
        } catch (err: any) {
            console.error('[ScriptGenerator] AI Stream Error:', err);
            yield `\n\n[ERROR: AI communication failed. ${err.message || 'Please check your connection.'}]`;
            return;
        }

        const sections = extractStructuredAssistantSections(fullResponse);
        const visibleResponse = sections.script || cleanAssistantChatResponse(fullResponse);
        const assistantType = effectiveMode === 'ask' ? 'chat' : 'proposal';
        
        scene.assistantChatHistory.push({ 
            role: 'assistant', 
            type: assistantType, 
            status: assistantType === 'proposal' ? 'pending' : undefined,
            content: visibleResponse, 
            timestamp: new Date(),
            metadata: {
                research: sections.research,
                plan: sections.plan,
                explanation: sections.craft, // Mapped to craft in utility
                summary: sections.summary
            }
        } as any);
        await scene.save();
        
        if (fullResponse.includes('CHARACTER_MEMORY_UPDATE')) {
            this.pendingTasks.add(stateManagerService.extractAndSaveState(fullResponse, castContext));
        }
    }

    async *assistProject(bibleId: string, instruction: string, options: AssistedEditOptions = {}): AsyncGenerator<string, void, unknown> {
        const { SCRIPT_EDITOR_AGENT_PROMPT } = require('../prompts/hollywood');
        const BibleModel = require('../models/Bible').Bible;
        const bible = await BibleModel.findById(bibleId);
        if (!bible) throw new Error('Project not found');

        const assistantPreferences = this.getAssistantPreferences(bible);
        const language = options.language || assistantPreferences.replyLanguage || (bible as any).language || 'English';

        if (intentService.isSmallTalk(instruction)) {
            yield await intentService.generateSmallTalkResponse(instruction);
            return;
        }

        const cast = await Character.find({ bibleId: bible._id }).lean();
        const characterMemoryText = stateManagerService.buildCharacterContext(cast);

        const ragPack = await assistantRagService.buildAssistantReferencePack({
            instruction,
            mode: 'ask',
            target: 'scene',
            language,
            bible: bible as any
        } as any);

        const prompt = this.buildEditorAssistantPrompt(SCRIPT_EDITOR_AGENT_PROMPT, {
            mode: 'ask',
            target: 'scene',
            story_so_far: (bible as any).storySoFar || '',
            slugline: `${(bible as any).title} - PROJECT`,
            summary: (bible as any).logline || '',
            characters: characterMemoryText,
            language,
            transliteration: Boolean(options.transliteration ?? assistantPreferences.transliteration),
            original_content: '',
            selection_block: '',
            chat_history: '',
            similar_samples: ragPack.promptSections,
            instruction,
            output_contract: 'Respond in markdown.',
            assistant_preferences: this.buildAssistantPreferencesBlock(assistantPreferences, language, false)
        });

        let fullResponse = '';
        try {
            const stream = aiServiceManager.chatStream([{ role: 'user', content: prompt }]);
            for await (const chunk of stream) {
                fullResponse += chunk;
                yield chunk;
            }
        } catch (err: any) {
            yield `\n\n[ERROR: Project Assistant failed. ${err.message}]`;
            return;
        }
    }

    async commitAssistedEdit(sceneId: string): Promise<boolean> {
        const scene = await Scene.findById(sceneId);
        if (!scene || !scene.pendingContent) return false;
        
        scene.content = scene.pendingContent;
        scene.pendingContent = undefined;
        
        // Update history status
        if (scene.assistantChatHistory) {
            const lastProposal = [...scene.assistantChatHistory].reverse().find(m => m.type === 'proposal');
            if (lastProposal) {
                (lastProposal as any).status = 'applied';
            }
        }

        await scene.save();
        return true;
    }

    async discardAssistedEdit(sceneId: string): Promise<boolean> {
        const scene = await Scene.findById(sceneId);
        if (!scene) return false;
        
        scene.pendingContent = undefined;

        // Update history status
        if (scene.assistantChatHistory) {
            const lastProposal = [...scene.assistantChatHistory].reverse().find(m => m.type === 'proposal');
            if (lastProposal) {
                (lastProposal as any).status = 'discarded';
            }
        }

        await scene.save();
        return true;
    }

    private buildAssistantSelectionBlock(selection?: AssistedEditSelection | null): string {
        if (!selection?.text?.trim()) return 'No explicit selection provided.';
        return `[Lines ${selection.lineStart}-${selection.lineEnd}] Characters: ${selection.charCount || selection.text.length}\n${selection.text}`;
    }

    private buildAssistantOutputContract(mode: string, target: string, selection?: AssistedEditSelection | null): string {
        if (mode === 'ask') {
            return `CONVERSATION MODE CONTRACT:
1. Provide a sharp, agentic critique or analysis. No fluff.
2. If suggesting changes, use bullet points with specific examples.
3. DO NOT output the 5-STEP REPLICA STRUCTURE unless explicitly commanded.
4. Your goal is to guide the user, not write the script for them.`;
        }
        
        if (target === 'selection' && selection) {
            return `LOCAL PATCH CONTRACT (CRITICAL):
1. Output MUST use the 5-STEP REPLICA STRUCTURE.
2. In STEP 3 (SCENE_SCRIPT), output EXACTLY ONE \`\`\`script-edit block.
3. The <<<SEARCH>>> block MUST perfectly match the selected text. Not a single character, space, or newline can differ.
4. The <<<REPLACE>>> block contains your elite rewrite.
5. NEVER rewrite text outside the provided selection borders.`;
        }
        
        return `FULL SCENE REWRITE CONTRACT (CRITICAL):
1. Output MUST use the 5-STEP REPLICA STRUCTURE.
2. Provide RESEARCH_DISCLOSURE and CREATIVE_PLAN first.
3. In STEP 3 (SCENE_SCRIPT), output the ENTIRE revised scene seamlessly. Do not truncate.
4. Maintain the integrity of any unedited parts of the scene.`;
    }

    private buildAssistantChatHistoryText(entries?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
        if (!entries?.length) return 'No previous conversation.\n';
        return entries.slice(-10).map(e => `[${e.role.toUpperCase()}]: ${e.content}`).join('\n\n');
    }

    private buildAssistantPreferencesBlock(prefs: NormalizedAssistantPreferences, lang: string, trans: boolean): string {
        return `Language: ${prefs.replyLanguage || lang}\nTransliteration: ${trans ? 'Enabled' : 'Disabled'}\nDirectives: ${prefs.savedDirectives.join(', ')}`;
    }

    private getAssistantPreferences(bible: any): NormalizedAssistantPreferences {
        return {
            defaultMode: bible?.assistantPreferences?.defaultMode || 'ask',
            replyLanguage: bible?.assistantPreferences?.replyLanguage || '',
            transliteration: !!bible?.assistantPreferences?.transliteration,
            savedDirectives: bible?.assistantPreferences?.savedDirectives || []
        };
    }

    private buildEditorAssistantPrompt(template: string, params: any): string {
        return Object.entries(params).reduce((p, [k, v]) => p.split(`{{${k}}}`).join(String(v)), template);
    }

    private async getUserInterestsForBible(bible?: { userId?: string } | null) {
        if (!bible?.userId) return null;
        const user = await User.findById(bible.userId).lean();
        return user?.scriptInterests || null;
    }

    async reviseSceneBatch(
        originalContent: string,
        critique: any,
        goal: string,
        isSecondAttempt: boolean = false,
        targetScore: number = 0,
        language: string = 'English',
        bibleId?: string | mongoose.Types.ObjectId,
        sceneId?: string | mongoose.Types.ObjectId
    ): Promise<string> {
        const { SCREENPLAY_REVISION_PROMPT, SENIOR_SCRIPT_DOCTOR_PROMPT } = require('../prompts/hollywood');
        
        const template = isSecondAttempt ? SENIOR_SCRIPT_DOCTOR_PROMPT : SCREENPLAY_REVISION_PROMPT;
        
        const prompt = template
            .replace('{{originalContent}}', originalContent)
            .replace('{{summary}}', critique.summary || 'General improvements.')
            .replace('{{dialogueIssues}}', (critique.dialogueIssues || []).join(', ') || 'None.')
            .replace('{{pacingIssues}}', (critique.pacingIssues || []).join(', ') || 'None.')
            .replace('{{formattingIssues}}', (critique.formattingIssues || []).join(', ') || 'None.')
            .replace('{{suggestions}}', (critique.suggestions || []).join(', ') || 'Follow general craft rules.')
            .replace('{{goal}}', goal)
            .replace('{{language}}', language);

        const response = await aiServiceManager.chat(prompt, { 
            temperature: isSecondAttempt ? 0.3 : 0.1 
        });

        // If it's the doctor prompt, it might have structural sections. Clean it.
        if (isSecondAttempt) {
            const sections = extractStructuredAssistantSections(response);
            if (sections.script) return sections.script;
            return cleanAssistantChatResponse(response);
        }

        return response;
    }

    async generateAuditNotes(original: string, revised: string): Promise<string> {
        const { AUDIT_EXPLANATION_PROMPT } = require('../prompts/hollywood');
        const prompt = AUDIT_EXPLANATION_PROMPT
            .replace('{{original}}', original)
            .replace('{{revised}}', revised);
        
        const response = await aiServiceManager.chat(prompt, { temperature: 0.2 });
        return response.trim();
    }

    async waitForBackgroundTasks(): Promise<void> {
        if (this.pendingTasks.size === 0) return;
        await Promise.all(Array.from(this.pendingTasks));
    }
}

export const scriptGenerator = new ScriptGeneratorService();
