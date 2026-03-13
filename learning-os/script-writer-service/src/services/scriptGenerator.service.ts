
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
import {
    cleanAssistantChatResponse,
    extractBestEffortAssistantAnswer,
    extractBestEffortScreenplay,
    extractStructuredAssistantSections,
    hasStructuredAssistantSections,
    normalizeScreenplayWhitespace
} from '../utils/screenplayFormatting';

export interface ScriptRequest {
    userId: string;
    idea: string;
    format: keyof typeof FORMAT_TEMPLATES;
    style: keyof typeof STYLE_PROMPTS;
    genre?: string;
    tone?: string;
    language?: string;
    transliteration?: boolean;
    bibleId?: string; // Project Context
    characterIds?: string[]; // Specific Cast
    previousContext?: string; // Memory of what happened before
    sceneLength?: 'short' | 'medium' | 'long' | 'extended'; // Scene length control
    era?: string; // Time period context
    polarityShift?: string; // e.g., "- to +" or "Neutral to Tense"
    centralTactic?: string; // e.g., "Bhishma trying to hide the truth"
    internalRhythm?: 'slow' | 'fast' | 'staccato' | 'fluid';
    useAdvancedCoherence?: boolean; // PH 25: ULTIMATE_COHERENCE_PROMPT
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
    // PH 29: Track background tasks for robust testing
    private pendingTasks: Set<Promise<any>> = new Set();

    /**
     * Generates a screenplay based on user inputs, streaming the result.
     * Also saves the result to the database.
     */
    async *generateScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
        console.log(`[ScriptGen] Building prompt for: ${request.format} / ${request.style}`);

        // PH 25: Advanced Coherence Path
        if (request.useAdvancedCoherence) {
            yield* this.generateAdvancedScript(request);
            return;
        }

        // 0. Initialize Script Document
        let ownerId = request.userId;
        if (!ownerId || ownerId === 'anonymous') {
            console.warn('[ScriptGen] Anonymous user - using dummy ID');
            ownerId = '000000000000000000000000'; // Dummy 24-char hex string
        }

        // Initialize language and transliteration from request or Project Bible
        let targetLanguage = request.language;
        let transliteration = request.transliteration;

        if ((!targetLanguage || transliteration === undefined) && request.bibleId) {
            const bible = await mongoose.model('Bible').findById(request.bibleId).lean();
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
            language: targetLanguage || 'English',
            status: 'generating',
            metadata: {
                genre: request.genre,
                tone: request.tone,
                bibleId: request.bibleId
            }
        });
        await scriptDoc.save();

        // PH 22: Fetch User Interests
        let userInterests = null;
        try {
            if (ownerId !== '000000000000000000000000') {
                const user = await User.findById(ownerId).lean();
                if (user && user.scriptInterests) {
                    userInterests = user.scriptInterests;
                    console.log(`[ScriptGen] Fetched interests for user: ${userInterests.directors.join(', ')}`);
                }
            }
        } catch (userErr) {
            console.warn('[ScriptGen] Failed to fetch user interests:', userErr);
        }

        let similarSamples: any[] = [];
        try {
            const queryText = `${request.style} style. ${request.idea}`;
            const queryEmbedding = await aiServiceManager.generateEmbedding(queryText);
            const scopeBibleId = request.bibleId || 'ALL';

            similarSamples = await vectorService.findSimilarSamples(
                scopeBibleId,
                queryEmbedding,
                5,
                request.characterIds,
                {
                    minSimilarity: 0.55,
                    maxLength: 500,
                    dedupe: true,
                    era: request.era,
                    interests: userInterests ?? undefined,
                    includeParentContext: true
                }
            );
        } catch (err) {
            console.warn(`[ScriptGenerator] RAG Lookup failed (ignoring): ${err}`);
        }

        // Fetch Characters for Context
        let castContext: any[] = [];
        try {
            if (request.characterIds && request.characterIds.length > 0) {
                const characterQuery: Record<string, unknown> = { _id: { $in: request.characterIds } };
                if (request.bibleId) {
                    characterQuery.bibleId = request.bibleId;
                }
                castContext = await Character.find(characterQuery).lean();
            } else if (request.bibleId) {
                castContext = await Character.find({ bibleId: request.bibleId }).lean();
            }
        } catch (charErr) {
            console.warn(`[ScriptGenerator] Failed to fetch characters: ${charErr}`);
        }

        // 1. Build the System + User Prompt
        let ideaWithContext = request.idea;
        if (request.previousContext) {
            ideaWithContext = `PREVIOUS SCENE CONTEXT:\n"${request.previousContext}"\n\nCURRENT SCENE:\n${request.idea}`;
        }

        const fullPrompt = buildScriptPrompt(
            ideaWithContext,
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

        // PH 20: Inject Character States
        let stateGuidance = '';
        if (castContext.length > 0) {
            stateGuidance = '\n\n## CHARACTER CONTINUITY (CURRENT STATE):\n';
            castContext.forEach(char => {
                stateGuidance += `- ${char.name}: ${char.currentStatus || 'Stable'}. Held: ${char.heldItems?.join(', ') || 'None'}\n`;
            });
        }

        // 1.5 Generate Beat Sheet
        let beatSheet = null;
        try {
            beatSheet = await this.generateBeatSheet(request, similarSamples, castContext);
        } catch (beatErr) {
            console.warn('[ScriptGen] Beat Sheet failed:', beatErr);
        }

        // 2. Prepare Final Prompt
        let finalPrompt = fullPrompt;
        if (stateGuidance) finalPrompt = stateGuidance + '\n' + finalPrompt;
        if (beatSheet) {
            finalPrompt += `\n\n## APPROVED BEAT SHEET:\n${JSON.stringify(beatSheet, null, 2)}\n\nNow write the scene.`;
        }

        const stream = aiServiceManager.chatStream([{ role: 'user', content: finalPrompt }]);

        // Post-streaming logic wrapper
        const self = this;
        let finalContent = '';

        try {
            for await (const chunk of stream) {
                finalContent += chunk;
                yield chunk;
            }

            // Success Path
            scriptDoc.content = finalContent;
            scriptDoc.status = 'completed';
            await scriptDoc.save();

            // PH 20: Trigger background state update
            console.log('[ScriptGen] PH 20: Character State Update triggered');
            self.extractAndSaveState(finalContent, castContext).catch(e => console.error('[StateUpdate] Error:', e));

        } catch (error) {
            console.error('[ScriptGen] Generation fatal error:', error);
            scriptDoc.status = 'failed';
            scriptDoc.content = finalContent;
            await scriptDoc.save();
            throw error;
        }
    }

    /**
     * PH 25: ULTIMATE COHERENCE GENERATION
     * Uses a single orchestrated prompt for reasoning + generation.
     */
    async *generateAdvancedScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
        const { ULTIMATE_COHERENCE_PROMPT } = require('../prompts/hollywood');

        // 1. Initial Data Fetching (RAG + Characters)
        let ownerId = request.userId || '000000000000000000000000';

        let userInterests = null;
        try {
            const user = await User.findById(ownerId).lean();
            if (user) userInterests = user.scriptInterests;
        } catch (e) { }

        let similarSamples: any[] = [];
        try {
            const queryText = `${request.style} style. ${request.idea}`;
            const queryEmbedding = await aiServiceManager.generateEmbedding(queryText);
            similarSamples = await vectorService.findSimilarSamples(
                request.bibleId || 'ALL',
                queryEmbedding,
                5,
                request.characterIds,
                {
                    interests: userInterests ?? undefined,
                    includeParentContext: true
                }
            );
        } catch (e) { }

        let castContext: any[] = [];
        try {
            if (request.characterIds?.length) {
                const characterQuery: Record<string, unknown> = { _id: { $in: request.characterIds } };
                if (request.bibleId) {
                    characterQuery.bibleId = request.bibleId;
                }
                castContext = await Character.find(characterQuery).lean();
            }
        } catch (e) { }

        // 2. Format Context for Prompt
        const bible = request.bibleId ? await Bible.findById(request.bibleId) : null;
        if (bible) {
            await this.ensureGlobalOutline(bible);
        }

        const retrievedScenesText = similarSamples.map(s => `--- SAMPLE ---\n${s.content}`).join('\n\n');

        let characterMemoryText = '';
        castContext.forEach(c => {
            let relations = '';
            if (c.relationships?.length) {
                relations = ` | Relationships: ${c.relationships.map((r: any) => `${r.targetCharName}: ${r.dynamic}`).join(', ')}`;
            }
            characterMemoryText += `- ${c.name}: ${c.currentStatus || 'Stable'}. Items: ${c.heldItems?.join(', ') || 'None'}${relations}\n`;
        });

        const plotStateText = request.previousContext || 'Starting a new narrative thread.';
        const globalOutlineText = bible?.globalOutline?.join('\n') || 'No global outline established yet.';
        const storySoFarText = bible?.storySoFar || 'The story is just beginning.';

        // 3. Build Final Prompt
        const finalPrompt = ULTIMATE_COHERENCE_PROMPT
            .replace('{{user_prompt}}', request.idea)
            .replace('{{global_outline}}', globalOutlineText)
            .replace('{{story_so_far}}', storySoFarText)
            .replace('{{retrieved_scenes}}', retrievedScenesText || 'No similar scenes found.')
            .replace('{{character_memory}}', characterMemoryText || 'No character data available.')
            .replace('{{plot_state}}', plotStateText);

        const stream = aiServiceManager.chatStream([{ role: 'user', content: finalPrompt }]);
        let fullResponse = '';
        let lastScriptLength = 0;
        let alreadyYieldedLength = 0;
        let isYieldingScript = false;
        let isThinking = true;

        for await (const chunk of stream) {
            fullResponse += chunk;

            // Stop thinking if we see markers
            if (isThinking && (fullResponse.includes('STORY_CONTEXT_SUMMARY') || fullResponse.includes('SCENE_PLAN') || fullResponse.includes('SCENE_SCRIPT'))) {
                isThinking = false;
            }

            if (!isYieldingScript && /SCENE_SCRIPT:/i.test(fullResponse)) {
                isYieldingScript = true;
            }

            if (isYieldingScript) {
                const scriptMatch = fullResponse.match(/SCENE_SCRIPT:\s*([\s\S]*)$/i);
                if (scriptMatch) {
                    const scriptText = scriptMatch[1];
                    
                    const markerMatch = scriptText.match(/(CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE)/i);
                    if (markerMatch) {
                        const scriptBeforeMarker = scriptText.slice(0, markerMatch.index);
                        const delta = scriptBeforeMarker.slice(lastScriptLength);
                        if (delta) yield delta;
                        lastScriptLength = scriptBeforeMarker.length;
                        isYieldingScript = false;
                    } else {
                        const delta = scriptText.slice(lastScriptLength);
                        lastScriptLength = scriptText.length;
                        
                        const safeTotalLength = Math.max(0, scriptText.length - 40);
                        const safeDelta = scriptText.slice(alreadyYieldedLength, safeTotalLength);
                        
                        if (safeDelta) {
                            yield safeDelta;
                            alreadyYieldedLength += safeDelta.length;
                        }
                    }
                }
            }
        }

        // Flush remaining script content
        const sceneScriptIndex = fullResponse.search(/SCENE_SCRIPT:/i);
        let finalContent = '';
        if (sceneScriptIndex !== -1) {
            const afterScriptLabel = fullResponse.slice(sceneScriptIndex).replace(/SCENE_SCRIPT:\s*/i, '');
            const nextMarkerMatch = afterScriptLabel.match(/(CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE)/i);
            const finalScriptText = nextMarkerMatch ? afterScriptLabel.slice(0, nextMarkerMatch.index) : afterScriptLabel;
            
            if (finalScriptText) {
                const finalDelta = finalScriptText.slice(alreadyYieldedLength);
                if (finalDelta) yield finalDelta;
            }
            finalContent = finalScriptText;
        } else {
            finalContent = fullResponse;
        }

        // 4. Background Processing
        if (bible) {
            bible.sceneCount = (bible.sceneCount || 0) + 1;
            await bible.save();

            if (bible.sceneCount % 5 === 0) {
                const summaryTask = this.updateRecursiveSummary(bible);
                this.pendingTasks.add(summaryTask);
                summaryTask.finally(() => this.pendingTasks.delete(summaryTask)).catch(e => console.error('[SummaryUpdate] Error:', e));
            }
        }

        const stateTask = this.extractAndSaveState(finalContent, castContext);
        this.pendingTasks.add(stateTask);
        stateTask.finally(() => this.pendingTasks.delete(stateTask)).catch(e => console.error('[StateUpdate] Error:', e));
    }

    async waitForBackgroundTasks(): Promise<void> {
        if (this.pendingTasks.size === 0) return;
        console.log(`[ScriptGen] Waiting for ${this.pendingTasks.size} pending background tasks...`);
        await Promise.all(Array.from(this.pendingTasks));
    }

    private async ensureGlobalOutline(bible: any): Promise<void> {
        if (bible.globalOutline && bible.globalOutline.length >= 20) return;
        const { MASTER_OUTLINE_PROMPT } = require('../prompts/hollywood');
        const prompt = MASTER_OUTLINE_PROMPT.replace('{{logline}}', bible.logline || bible.title);
        try {
            console.log('[GlobalOutline] Generating for logline:', bible.logline || bible.title);
            const response = await aiServiceManager.chat(prompt, { format: 'json' });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            let outline = JSON.parse(cleanJson);
            if (!Array.isArray(outline) && typeof outline === 'object') {
                outline = outline.beats || outline.story_arc || outline.master_story_arc || Object.values(outline)[0];
            }
            if (Array.isArray(outline)) {
                bible.globalOutline = outline;
                await bible.save();
                console.log('[ScriptGen] Global Outline Generated for Bible:', bible._id);
            }
        } catch (err) {
            console.error('[GlobalOutline] Failed to generate:', err);
        }
    }

    private async updateRecursiveSummary(bible: any): Promise<void> {
        const { RECURSIVE_SUMMARY_PROMPT } = require('../prompts/hollywood');
        const recentScenes = await Scene.find({ bibleId: bible._id }).sort({ createdAt: -1 }).limit(5).lean();
        if (recentScenes.length === 0) return;
        const scenesText = recentScenes.reverse().map((s: any) => `### ${s.title}\n${s.content}`).join('\n\n');
        const prompt = RECURSIVE_SUMMARY_PROMPT.replace('{{recent_scenes}}', scenesText).replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.');
        try {
            const newSummary = await aiServiceManager.chat(prompt);
            bible.storySoFar = newSummary.trim();
            await bible.save();
            console.log('[ScriptGen] Story So Far updated recursive summary.');
        } catch (err) {
            console.error('[RecursiveSummary] Failed:', err);
        }
    }

    async generateBlockBeatSheet(bibleId: string, startScene: number, count: number = 10): Promise<any[]> {
        const bible = await Bible.findById(bibleId);
        if (!bible) throw new Error('Bible not found');
        const { BLOCK_BEAT_SHEET_PROMPT } = require('../prompts/hollywood');
        const prompt = BLOCK_BEAT_SHEET_PROMPT.replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.').replace('{{global_outline}}', bible.globalOutline?.join('\n') || 'No global outline.').replace(/{{start_scene}}/g, startScene.toString()).replace(/{{end_scene}}/g, (startScene + count - 1).toString());
        try {
            console.log(`[ScriptGen] Planning Block: Scenes ${startScene}-${startScene + count - 1}`);
            const response = await aiServiceManager.chat(prompt, { format: 'json' });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            let block = JSON.parse(cleanJson);
            if (!Array.isArray(block) && typeof block === 'object') block = block.scenes || block.beats || Object.values(block)[0];
            return Array.isArray(block) ? block : [];
        } catch (err) {
            console.error('[BlockBeatSheet] Failed:', err);
            return [];
        }
    }

    async generateBatch(request: ScriptRequest, blockBeats: any[]): Promise<any[]> {
        console.log(`[ScriptGen] Launching Parallel Batch: ${blockBeats.length} scenes`);
        const tasks = blockBeats.map(async (beat) => {
            const { BATCH_SCENE_PROMPT } = require('../prompts/hollywood');
            let castContext: any[] = [];
            if (request.characterIds?.length) castContext = await Character.find({ _id: { $in: request.characterIds } }).lean();
            const bible = await Bible.findById(request.bibleId);
            let characterMemoryText = '';
            castContext.forEach(c => { characterMemoryText += `- ${c.name}: ${c.currentStatus || 'Stable'}\n`; });
            const prompt = BATCH_SCENE_PROMPT.replace('{{story_so_far}}', bible?.storySoFar || 'Starting build.').replace('{{master_beat}}', bible?.globalOutline?.[Math.floor(beat.sceneNumber / 5)] || 'Unknown').replace('{{scene_number}}', beat.sceneNumber.toString()).replace('{{slugline}}', beat.slugline).replace('{{summary}}', beat.summary).replace('{{polarity_shift}}', beat.polarityShift || 'Neutral').replace('{{character_memory}}', characterMemoryText);
            try {
                const content = await aiServiceManager.chat(prompt);
                await new Scene({ bibleId: request.bibleId, sequenceNumber: beat.sceneNumber, title: beat.title, slugline: beat.slugline, summary: beat.summary, content: content, status: 'drafted' }).save();
                return { sceneNumber: beat.sceneNumber, success: true };
            } catch (err) { return { sceneNumber: beat.sceneNumber, success: false, error: err }; }
        });
        const results = await Promise.all(tasks);
        if (request.bibleId) {
            const bible = await Bible.findById(request.bibleId);
            if (bible) {
                bible.sceneCount = Math.max(bible.sceneCount || 0, ...blockBeats.map(b => b.sceneNumber));
                await bible.save();
                await this.updateRecursiveSummary(bible);
            }
        }
        return results;
    }

    private buildAssistantSelectionBlock(selection?: AssistedEditSelection | null): string {
        if (!selection?.text?.trim()) return 'No explicit selection provided.';
        const lineRange = selection.lineStart && selection.lineEnd ? `Lines ${selection.lineStart}-${selection.lineEnd}` : 'Line range unavailable';
        return [lineRange, `Characters: ${selection.charCount ?? selection.text.length}`, '', selection.text].join('\n');
    }

    private buildAssistantOutputContract(mode: 'ask' | 'edit' | 'agent', target: 'scene' | 'selection', selection?: AssistedEditSelection | null): string {
        if (mode === 'ask') {
            return [
                'Respond in markdown.',
                'Answer directly and concretely.',
                'If you suggest replacement dialogue or action, keep it short and clearly labeled.',
                'If the user is asking for a rewrite, patch, translation, or direct scene edit, do not perform it in ASK mode. Explain which mode to use instead.',
                'Do not rewrite the whole scene unless the user explicitly asks for it.',
                'Never output STORY_CONTEXT_SUMMARY, SCENE_PLAN, SCENE_SCRIPT, or JSON update blocks.'
            ].join('\n');
        }
        if (target === 'selection' && selection?.text?.trim()) {
            return [
                'Return optional short rationale bullets, then exactly one fenced code block tagged `script-edit`.',
                'Inside that block output:',
                '<<<SEARCH>>>',
                '[the exact selected text, preserving spacing and line breaks]',
                '<<<REPLACE>>>',
                '[the revised replacement text only]',
                'Rules:',
                '- SEARCH must match the provided selection exactly.',
                '- Keep all changes local to the selected text.',
                '- Preserve screenplay formatting and indentation.'
            ].join('\n');
        }
        return [
            'Output only the full revised screenplay content.',
            'Do not add commentary, markdown, or explanations.',
            'Preserve screenplay formatting.',
            'Start directly with the screenplay.',
            'Never output STORY_CONTEXT_SUMMARY, SCENE_PLAN, SCENE_SCRIPT, CHARACTER_MEMORY_UPDATE, or PLOT_STATE_UPDATE.'
        ].join('\n');
    }

    private buildAssistantChatHistoryText(entries?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
        if (!entries?.length) return 'No previous conversation.\n';
        return entries.slice(-12).map((entry) => {
            const roleName = entry.role === 'assistant' ? 'AI' : 'User';
            return `[${roleName}]: ${entry.content}`;
        }).join('\n\n');
    }

    private buildEditorAssistantPrompt(
        template: string,
        params: {
            mode: 'ask' | 'edit' | 'agent';
            target: 'scene' | 'selection';
            storySoFar: string;
            slugline: string;
            summary: string;
            characters: string;
            language: string;
            transliteration: boolean;
            originalContent: string;
            selectionBlock: string;
            chatHistory: string;
            similarSamples: string;
            instruction: string;
            outputContract: string;
            assistantPreferences: string;
        }
    ): string {
        return this.replacePromptTokens(template, {
            '{{mode}}': params.mode.toUpperCase(),
            '{{target}}': params.target.toUpperCase(),
            '{{story_so_far}}': params.storySoFar,
            '{{slugline}}': params.slugline,
            '{{summary}}': params.summary,
            '{{characters}}': params.characters,
            '{{language}}': params.language,
            '{{transliteration}}': params.transliteration ? 'ENABLED' : 'DISABLED',
            '{{original_content}}': params.originalContent,
            '{{selection_block}}': params.selectionBlock,
            '{{chat_history}}': params.chatHistory,
            '{{similar_samples}}': params.similarSamples,
            '{{instruction}}': params.instruction,
            '{{output_contract}}': params.outputContract,
            '{{assistant_preferences}}': params.assistantPreferences
        });
    }

    private replacePromptTokens(template: string, replacements: Record<string, string>): string {
        return Object.entries(replacements).reduce(
            (prompt, [token, value]) => prompt.split(token).join(value),
            template
        );
    }

    private async recoverSceneProposalWithEditorPrompt(input: {
        template: string;
        mode: 'edit' | 'agent';
        target: 'scene';
        storySoFar: string;
        slugline: string;
        summary: string;
        characters: string;
        language: string;
        transliteration: boolean;
        originalContent: string;
        selectionBlock: string;
        chatHistory: string;
        similarSamples: string;
        instruction: string;
        assistantPreferences: string;
    }): Promise<string> {
        const prompt = this.buildEditorAssistantPrompt(input.template, {
            ...input,
            outputContract: this.buildAssistantOutputContract(input.mode, input.target)
        });
        const rawResponse = await aiServiceManager.chat(prompt);
        return normalizeScreenplayWhitespace(
            cleanAssistantChatResponse(rawResponse) || extractBestEffortScreenplay(rawResponse)
        );
    }

    private isInvalidAskResponse(content: string): boolean {
        const cleaned = cleanAssistantChatResponse(content);
        if (!cleaned.trim()) {
            return true;
        }

        if (hasStructuredAssistantSections(cleaned)) {
            return true;
        }

        const screenplay = extractBestEffortScreenplay(cleaned);
        return Boolean(screenplay) && /^(FADE IN:?|INT\.?|EXT\.?|EST\.?)/im.test(screenplay);
    }

    private async buildValidatedAskResponse(prompt: string): Promise<string> {
        const firstResponse = await aiServiceManager.chat(prompt);
        if (!this.isInvalidAskResponse(firstResponse)) {
            return cleanAssistantChatResponse(firstResponse);
        }

        const repairPrompt = [
            prompt,
            '',
            'CRITICAL REPAIR:',
            'Your previous response violated ASK mode.',
            'Return only a direct markdown answer for the user.',
            'Do not include screenplay.',
            'Do not include STORY_CONTEXT_SUMMARY, SCENE_PLAN, SCENE_SCRIPT, CHARACTER_MEMORY_UPDATE, or PLOT_STATE_UPDATE.',
            'Do not include JSON.'
        ].join('\n');

        const repairedResponse = await aiServiceManager.chat(repairPrompt);
        if (!this.isInvalidAskResponse(repairedResponse)) {
            return cleanAssistantChatResponse(repairedResponse);
        }

        return extractBestEffortAssistantAnswer(repairedResponse) || extractBestEffortAssistantAnswer(firstResponse);
    }

    private async getUserInterestsForBible(bible?: { userId?: string } | null) {
        try {
            if (!bible?.userId) return null;
            const user = await User.findById(bible.userId).lean();
            return user?.scriptInterests || null;
        } catch (error) {
            console.warn('[ScriptGenerator] Failed to fetch assistant user interests:', error);
            return null;
        }
    }

    private getAssistantPreferences(bible?: { assistantPreferences?: AssistantPreferenceState } | null): NormalizedAssistantPreferences {
        const savedDirectives = Array.isArray(bible?.assistantPreferences?.savedDirectives)
            ? bible!.assistantPreferences!.savedDirectives.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [];

        return {
            defaultMode: bible?.assistantPreferences?.defaultMode || 'ask',
            replyLanguage: bible?.assistantPreferences?.replyLanguage?.trim() || '',
            transliteration: bible?.assistantPreferences?.transliteration,
            savedDirectives
        };
    }

    private buildAssistantPreferencesBlock(
        preferences: NormalizedAssistantPreferences,
        language: string,
        transliteration: boolean
    ): string {
        const lines = [
            `Default mode: ${preferences.defaultMode || 'ask'}`,
            `Preferred reply language: ${preferences.replyLanguage || language}`,
            `Preferred transliteration: ${(preferences.transliteration ?? transliteration) ? 'enabled' : 'disabled'}`
        ];

        if (preferences.savedDirectives.length > 0) {
            lines.push(`Saved directives:\n- ${preferences.savedDirectives.slice(0, 8).join('\n- ')}`);
        } else {
            lines.push('Saved directives: none');
        }

        return lines.join('\n');
    }

    private classifyAskIntent(
        instruction: string,
        target: 'scene' | 'selection',
        selection?: AssistedEditSelection | null
    ): AskIntent {
        const trimmed = instruction.trim();
        if (!trimmed) return 'chat';

        const rewriteRequest = /\b(rewrite|redraft|edit|revise|fix|improve|tighten|change|replace|translate|transliterate|shorten|expand|cut|add|remove|rework|polish|convert|patch)\b/i.test(trimmed)
            && /\b(this|these|scene|script|selection|selected|line|lines|dialogue|action|passage|section)\b/i.test(trimmed);
        const asksQuestion = trimmed.includes('?') || /^(why|what|how|can|could|should|would|is|are|do|does|did)\b/i.test(trimmed);
        const asksForAnalysis = /\b(why|what|how|analyze|analysis|explain|weak|working|subtext|pacing|tone|structure|continuity|choice|choices|meaning|clarify|thought)\b/i.test(trimmed);

        if (rewriteRequest && asksQuestion && asksForAnalysis) {
            return 'ambiguous';
        }

        if (!rewriteRequest) {
            return 'chat';
        }

        if (target === 'selection' || selection?.text?.trim() || /\b(selection|selected|these lines|this line|lines|dialogue block)\b/i.test(trimmed)) {
            return 'selection_edit';
        }

        return 'scene_edit';
    }

    private buildAskIntentGuidance(intent: AskIntent): string | null {
        if (intent === 'selection_edit') {
            return [
                'This reads like a targeted rewrite request, not a pure question.',
                '',
                '- Use **Edit** mode for a local patch or selected-line replacement.',
                '- Use **Agent** mode only if you want a broader rewrite ripple around that selection.',
                '',
                'If you want analysis instead, ask a focused question like "What is weak in these lines?"'
            ].join('\n');
        }

        if (intent === 'scene_edit') {
            return [
                'This reads like a scene rewrite request, not a pure question.',
                '',
                '- Use **Edit** mode for a direct scene rewrite.',
                '- Use **Agent** mode for a broader collaborative redraft with more initiative.',
                '',
                'If you want diagnosis first, ask a focused question like "Why is this scene weak?"'
            ].join('\n');
        }

        if (intent === 'ambiguous') {
            return [
                'This mixes analysis with a rewrite request.',
                '',
                '- Stay in **Ask** mode if you want diagnosis, tradeoffs, or critique.',
                '- Switch to **Edit** or **Agent** if you want drafted changes.',
                '',
                'If you want, resend this as a rewrite request in the appropriate mode.'
            ].join('\n');
        }

        return null;
    }

    async *assistedEdit(sceneId: string, instruction: string, options: AssistedEditOptions = {}): AsyncGenerator<string, void, unknown> {
        const { HYBRID_ASSISTANT_ULTIMATE_PROMPT, SCRIPT_EDITOR_AGENT_PROMPT } = require('../prompts/hollywood');
        const scene = await Scene.findById(sceneId).populate('bibleId');
        if (!scene) throw new Error('Scene not found');
        const bible = scene.bibleId as any;
        const storySoFar = bible?.storySoFar || 'No context provided.';
        const globalOutline = bible?.globalOutline?.join('\n') || 'No global outline established.';
        const mode = options.mode || 'edit';
        const target = options.target === 'selection' && options.selection?.text?.trim() ? 'selection' : 'scene';
        const assistantPreferences = this.getAssistantPreferences(bible);
        const language = mode === 'ask'
            ? (options.language || assistantPreferences.replyLanguage || bible?.language || 'English')
            : (options.language || bible?.language || 'English');
        const originalContent = options.currentContent ?? scene.content ?? '';
        let characterMemoryText = 'No specific character data available.';
        let castContext: any[] = [];
        if (scene.charactersInvolved?.length) {
            castContext = await Character.find({ _id: { $in: scene.charactersInvolved } }).lean();
            characterMemoryText = castContext.map(c => {
                let relations = '';
                if (c.relationships?.length) relations = ` | Relationships: ${c.relationships.map((r: any) => `${r.targetCharName}: ${r.dynamic}`).join(', ')}`;
                return `- ${c.name}: ${c.currentStatus || 'Stable'}. Items: ${c.heldItems?.join(', ') || 'None'}${relations}`;
            }).join('\n');
        }
        const plotState = scene.summary || 'Developing current scene.';
        const selectionBlock = this.buildAssistantSelectionBlock(options.selection);
        const transliteration = options.transliteration !== undefined
            ? options.transliteration
            : assistantPreferences.transliteration ?? bible?.transliteration;
        const assistantPreferencesBlock = this.buildAssistantPreferencesBlock(assistantPreferences, language, Boolean(transliteration));
        const { TACTICS_LIBRARY, SUBTEXT_MANDATE } = require('../prompts/hollywood');
        const tacticsStr = Object.entries(TACTICS_LIBRARY).map(([n, d]) => `${n.toUpperCase()}: ${d}`).join('\n');
        const askIntent = mode === 'ask'
            ? this.classifyAskIntent(instruction, target, options.selection)
            : 'chat';

        const priorChatHistory = this.buildAssistantChatHistoryText(
            (scene.assistantChatHistory || []).map((entry) => ({
                role: entry.role,
                content: entry.content
            }))
        );

        if (!scene.assistantChatHistory) scene.assistantChatHistory = [];
        scene.assistantChatHistory.push({ role: 'user', type: mode === 'ask' ? 'chat' : 'instruction', content: instruction, timestamp: new Date() });
        await scene.save();

        if (mode === 'ask') {
            const shortCircuitResponse = this.buildAskIntentGuidance(askIntent);
            if (shortCircuitResponse) {
                yield shortCircuitResponse;

                scene.assistantChatHistory.push({
                    role: 'assistant',
                    type: 'chat',
                    content: shortCircuitResponse,
                    timestamp: new Date()
                } as any);

                await scene.save();
                return;
            }
        }

        const userInterests = await this.getUserInterestsForBible(bible);
        const refPack = await assistantRagService.buildAssistantReferencePack({
            instruction,
            mode,
            target,
            language,
            currentContent: originalContent,
            selection: options.selection,
            bible,
            scene: scene as any,
            userInterests
        });

        if (mode === 'ask') {
            const prompt = this.buildEditorAssistantPrompt(SCRIPT_EDITOR_AGENT_PROMPT, {
                mode,
                target,
                storySoFar,
                slugline: scene.slugline || 'Current Scene',
                summary: scene.summary || 'No summary available.',
                characters: castContext.length > 0 ? castContext.map((character) => character.name).join(', ') : 'No characters specified.',
                language,
                transliteration: Boolean(transliteration),
                originalContent: originalContent || 'No active scene selected.',
                selectionBlock,
                chatHistory: priorChatHistory,
                similarSamples: refPack.promptSections,
                instruction,
                outputContract: this.buildAssistantOutputContract(mode, target, options.selection),
                assistantPreferences: assistantPreferencesBlock
            });

            try {
                const visibleResponse = await this.buildValidatedAskResponse(prompt);

                if (!visibleResponse.trim()) {
                    throw new Error('Assistant produced no visible response.');
                }

                yield visibleResponse;

                scene.assistantChatHistory.push({
                    role: 'assistant',
                    type: 'chat',
                    content: visibleResponse,
                    timestamp: new Date(),
                    retrievalMetadata: refPack.retrievalMetadata
                } as any);

                await scene.save();
                return;
            } catch (error) {
                throw error;
            }
        }

        if (target === 'selection') {
            const prompt = this.buildEditorAssistantPrompt(SCRIPT_EDITOR_AGENT_PROMPT, {
                mode,
                target,
                storySoFar,
                slugline: scene.slugline || 'Current Scene',
                summary: scene.summary || 'No summary available.',
                characters: castContext.length > 0 ? castContext.map((character) => character.name).join(', ') : 'No characters specified.',
                language,
                transliteration: Boolean(transliteration),
                originalContent: originalContent || 'No active scene selected.',
                selectionBlock,
                chatHistory: priorChatHistory,
                similarSamples: refPack.promptSections,
                instruction,
                outputContract: this.buildAssistantOutputContract(mode, target, options.selection),
                assistantPreferences: assistantPreferencesBlock
            });

            const stream = aiServiceManager.chatStream([{ role: 'system', content: prompt }]);
            let fullResponse = '';

            try {
                for await (const chunk of stream) {
                    fullResponse += chunk;
                    yield chunk;
                }

                const visibleResponse = cleanAssistantChatResponse(fullResponse).replace(/\r\n?/g, '\n').trim();

                if (!visibleResponse.trim()) {
                    throw new Error('Assistant produced no visible response.');
                }

                scene.assistantChatHistory.push({
                    role: 'assistant',
                    type: 'proposal',
                    content: visibleResponse,
                    timestamp: new Date(),
                    retrievalMetadata: refPack.retrievalMetadata
                } as any);

                scene.lastInstruction = instruction;
                await scene.save();
                return;
            } catch (error) {
                throw error;
            }
        }

        const finalPrompt = this.replacePromptTokens(HYBRID_ASSISTANT_ULTIMATE_PROMPT, {
            '{{instruction}}': instruction,
            '{{mode}}': mode,
            '{{target}}': target,
            '{{language}}': language,
            '{{transliteration}}': transliteration ? 'ENABLED' : 'DISABLED',
            '{{global_outline}}': globalOutline,
            '{{story_so_far}}': storySoFar,
            '{{character_memory}}': characterMemoryText,
            '{{plot_state}}': plotState,
            '{{similar_samples}}': refPack.promptSections,
            '{{original_content}}': originalContent,
            '{{selection_block}}': selectionBlock,
            '{{assistant_preferences}}': assistantPreferencesBlock,
            '{{subtext_mandate}}': SUBTEXT_MANDATE,
            '{{tactics_library}}': tacticsStr
        });

        const stream = aiServiceManager.chatStream([{ role: 'user', content: finalPrompt }]);
        let fullResponse = '';
        let lastScriptLength = 0;
        let alreadyYieldedLength = 0;
        let isYieldingScript = false;

        try {
            for await (const chunk of stream) {
                fullResponse += chunk;
                if (!isYieldingScript && /SCENE_SCRIPT:/i.test(fullResponse)) {
                    isYieldingScript = true;
                }
                if (!isYieldingScript) {
                    continue;
                }

                const scriptMatch = fullResponse.match(/SCENE_SCRIPT:\s*([\s\S]*)$/i);
                if (!scriptMatch) {
                    continue;
                }

                const scriptText = scriptMatch[1];
                const markerMatch = scriptText.match(/(CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE)/i);
                const completeScript = markerMatch ? scriptText.slice(0, markerMatch.index) : scriptText;
                const normalizedScript = normalizeScreenplayWhitespace(completeScript);
                const safeTotalLength = markerMatch ? normalizedScript.length : Math.max(0, normalizedScript.length - 40);
                const safeDelta = normalizedScript.slice(alreadyYieldedLength, safeTotalLength);

                if (safeDelta) {
                    yield safeDelta;
                    alreadyYieldedLength += safeDelta.length;
                }

                lastScriptLength = normalizedScript.length;

                if (markerMatch) {
                    isYieldingScript = false;
                }
            }

            const sections = extractStructuredAssistantSections(fullResponse);
            let finalScriptText = sections.script;

            if (!finalScriptText.trim() && alreadyYieldedLength === 0) {
                finalScriptText = await this.recoverSceneProposalWithEditorPrompt({
                    template: SCRIPT_EDITOR_AGENT_PROMPT,
                    mode: mode === 'agent' ? 'agent' : 'edit',
                    target: 'scene',
                    storySoFar,
                    slugline: scene.slugline || 'Current Scene',
                    summary: scene.summary || 'No summary available.',
                    characters: castContext.length > 0 ? castContext.map((character) => character.name).join(', ') : 'No characters specified.',
                    language,
                    transliteration: Boolean(transliteration),
                    originalContent: originalContent || 'No active scene selected.',
                    selectionBlock,
                    chatHistory: priorChatHistory,
                    similarSamples: refPack.promptSections,
                    instruction,
                    assistantPreferences: assistantPreferencesBlock
                });
            }

            if (!finalScriptText.trim()) {
                throw new Error('Assistant produced no usable screenplay output.');
            }

            if (finalScriptText && lastScriptLength < finalScriptText.length) {
                const finalDelta = finalScriptText.slice(alreadyYieldedLength);
                if (finalDelta) {
                    yield finalDelta;
                }
            }

            scene.assistantChatHistory.push({
                role: 'assistant',
                type: 'proposal',
                content: finalScriptText,
                timestamp: new Date(),
                retrievalMetadata: refPack.retrievalMetadata,
                metadata: {
                    analysis: sections.summary,
                    plan: sections.plan
                }
            } as any);
            scene.pendingContent = finalScriptText;
            scene.lastInstruction = instruction;
            await scene.save();

            const memoryMatch = fullResponse.match(/CHARACTER_MEMORY_UPDATE \(JSON\):\s*(\{[\s\S]*?\})/);
            if (memoryMatch && castContext.length > 0) this.pendingTasks.add(this.extractAndSaveState(fullResponse, castContext));
            const plotMatch = fullResponse.match(/PLOT_STATE_UPDATE \(JSON\):\s*(\{[\s\S]*?\})/);
            if (plotMatch) {
                try {
                    const plotUpdate = JSON.parse(plotMatch[1]);
                    if (plotUpdate.summary) {
                        scene.summary = plotUpdate.summary;
                        await scene.save();
                    }
                } catch (e) { }
            }
        } catch (error) {
            throw error;
        }
    }

    async *assistProject(bibleId: string, instruction: string, options: AssistedEditOptions = {}): AsyncGenerator<string, void, unknown> {
        const { SCRIPT_EDITOR_AGENT_PROMPT } = require('../prompts/hollywood');
        const bible = await Bible.findById(bibleId).lean();
        if (!bible) throw new Error('Project not found');
        const assistantPreferences = this.getAssistantPreferences(bible);
        const language = options.language || assistantPreferences.replyLanguage || bible.language || 'English';
        const target = options.target === 'selection' && options.selection?.text?.trim() ? 'selection' : 'scene';
        const currentContent = options.currentContent || '';
        const transliteration = Boolean(options.transliteration ?? assistantPreferences.transliteration ?? bible.transliteration);
        const shortCircuitResponse = this.buildAskIntentGuidance(this.classifyAskIntent(instruction, target, options.selection));
        if (shortCircuitResponse) {
            yield shortCircuitResponse;
            return;
        }
        const userInterests = await this.getUserInterestsForBible(bible);
        const cast = await Character.find({ bibleId }).select('name').lean();
        const characterNames = cast.length > 0 ? cast.slice(0, 12).map((character) => character.name).join(', ') : 'No characters specified.';
        let ragPack = { promptSections: '', retrievalMetadata: undefined as any };
        try {
            ragPack = await assistantRagService.buildAssistantReferencePack({ instruction, mode: 'ask', target, language, currentContent, selection: options.selection, bible, scene: null, userInterests: userInterests ?? undefined });
        } catch (error) { }
        const prompt = this.buildEditorAssistantPrompt(SCRIPT_EDITOR_AGENT_PROMPT, {
            mode: 'ask',
            target,
            storySoFar: bible.storySoFar || 'No context provided.',
            slugline: `${bible.title} - PROJECT QUESTION`,
            summary: bible.logline || 'Project-level assistant question with no active scene selected.',
            characters: characterNames,
            language,
            transliteration,
            originalContent: currentContent || 'No active scene selected.',
            selectionBlock: this.buildAssistantSelectionBlock(options.selection),
            chatHistory: 'No previous conversation.\n',
            similarSamples: ragPack.promptSections,
            instruction,
            outputContract: this.buildAssistantOutputContract('ask', target, options.selection),
            assistantPreferences: this.buildAssistantPreferencesBlock(assistantPreferences, language, transliteration)
        });
        const visibleResponse = await this.buildValidatedAskResponse(prompt);
        if (!visibleResponse.trim()) {
            throw new Error('Assistant produced no visible response.');
        }
        yield visibleResponse;
    }

    async applyAndProposeEdit(sceneId: string, instruction: string): Promise<string> {
        const scene = await Scene.findById(sceneId);
        if (!scene) throw new Error('Scene not found');
        let fullRevisedText = '';
        const stream = this.assistedEdit(sceneId, instruction);
        for await (const chunk of stream) fullRevisedText += chunk;
        scene.pendingContent = normalizeScreenplayWhitespace(fullRevisedText);
        scene.lastInstruction = instruction;
        await scene.save();
        return fullRevisedText;
    }

    async commitAssistedEdit(sceneId: string): Promise<boolean> {
        const scene = await Scene.findById(sceneId);
        if (!scene || !scene.pendingContent) return false;
        scene.content = scene.pendingContent;
        scene.pendingContent = undefined;
        scene.lastInstruction = undefined;
        await scene.save();
        return true;
    }

    async * reviseScene(originalContent: string, critique: any, goal: string, language: string = 'English'): AsyncGenerator<string, void, unknown> {
        const { SCREENPLAY_REVISION_PROMPT } = require('../prompts/hollywood');
        const prompt = SCREENPLAY_REVISION_PROMPT.replace('{{originalContent}}', originalContent).replace('{{summary}}', critique.summary || 'N/A').replace('{{dialogueIssues}}', (critique.dialogueIssues || []).join(', ') || 'None').replace('{{pacingIssues}}', (critique.pacingIssues || []).join(', ') || 'None').replace('{{formattingIssues}}', (critique.formattingIssues || []).join(', ') || 'None').replace('{{suggestions}}', (critique.suggestions || []).join(', ') || 'None').replace('{{goal}}', goal || 'Professional Hollywood Screenplay').replace(/{{language}}/g, language || 'English');
        try {
            const stream = aiServiceManager.chatStream([{ role: 'user', content: prompt }]);
            for await (const chunk of stream) yield chunk;
        } catch (error) { throw error; }
    }

    async reviseSceneBatch(originalContent: string, critique: any, goal: string, isRetry: boolean = false, targetScore: number = 0, language: string = 'English'): Promise<string> {
        const { SENIOR_SCRIPT_DOCTOR_PROMPT } = require('../prompts/hollywood');
        const feedbackText = [critique.summary ? `DIRECTIVE 0: ${critique.summary}` : '', (critique.dialogueIssues || []).length > 0 ? `DIALOGUE DIRECTIVES:\n- ${critique.dialogueIssues.join('\n- ')}` : '', (critique.pacingIssues || []).length > 0 ? `PACING DIRECTIVES:\n- ${critique.pacingIssues.join('\n- ')}` : '', (critique.suggestions || []).length > 0 ? `STRATEGIC COMMANDS:\n- ${critique.suggestions.join('\n- ')}` : ''].filter(Boolean).join('\n\n');
        let feedbackHeader = feedbackText;
        if (isRetry) feedbackHeader = `CRITICAL: The previous attempt failed to break score ${targetScore}. Be more aggressive.\n\n${feedbackText}`;
        const prompt = SENIOR_SCRIPT_DOCTOR_PROMPT.replace('{{originalContent}}', originalContent).replace('{{feedback}}', feedbackHeader).replace('{{goal}}', goal || 'Professional Screenplay').replace(/{{language}}/g, language || 'English');
        return await aiServiceManager.chat(prompt);
    }

    async generateAuditNotes(original: string, revised: string): Promise<string> {
        const { AUDIT_EXPLANATION_PROMPT } = require('../prompts/hollywood');
        const prompt = AUDIT_EXPLANATION_PROMPT.replace('{{original}}', original).replace('{{revised}}', revised);
        return await aiServiceManager.chat(prompt);
    }

    private async generateBeatSheet(request: ScriptRequest, samples: any[], cast: any[]): Promise<any> {
        const { SCENE_BEAT_SHEET_PROMPT, TACTICS_LIBRARY } = require('../prompts/hollywood');
        const tacticsStr = Object.entries(TACTICS_LIBRARY).map(([n, d]) => `${n.toUpperCase()}: ${d}`).join('\n');
        const goalStr = `SCENE IDEA: ${request.idea}\nSTYLE: ${request.style}\nTONE: ${request.tone}`;
        const polarityStr = `TARGET POLARITY SHIFT: ${request.polarityShift || 'Neutral to Tense'}`;
        const prompt = SCENE_BEAT_SHEET_PROMPT.replace('{{tactics}}', tacticsStr).replace('{{goal}}', goalStr).replace('{{polarityShift}}', polarityStr);
        const response = await aiServiceManager.chat(prompt, { format: 'json', temperature: 0.2 });
        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    }

    private async extractAndSaveState(sceneContent: string, cast: any[]): Promise<void> {
        if (!cast || cast.length === 0) return;
        const { STORY_STATE_EXTRACTOR_PROMPT } = require('../prompts/hollywood');
        const charList = cast.map(c => `- ${c.name} (Current: ${c.currentStatus || 'Stable'})`).join('\n');
        const prompt = STORY_STATE_EXTRACTOR_PROMPT.replace('{{scene}}', sceneContent).replace('{{characters}}', charList);
        try {
            const response = await aiServiceManager.chat(prompt, { format: 'json', temperature: 0.1 });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);
            if (result.updates && Array.isArray(result.updates)) {
                for (const update of result.updates) {
                    const char = cast.find(c => c.name.toUpperCase() === update.name.toUpperCase());
                    if (char) {
                        let currentItems = char.heldItems || [];
                        if (update.itemsGained) currentItems = Array.from(new Set([...currentItems, ...update.itemsGained]));
                        if (update.itemsLost) currentItems = currentItems.filter((i: string) => !update.itemsLost.includes(i));
                        await Character.findByIdAndUpdate(char._id, { currentStatus: update.newStatus, heldItems: currentItems, $set: { relationships: update.relationshipChanges } });
                        console.log(`[ScriptGen] Updated ${char.name} status & relationships`);
                    }
                }
            }
        } catch (err) { }
    }
}

export const scriptGenerator = new ScriptGeneratorService();
