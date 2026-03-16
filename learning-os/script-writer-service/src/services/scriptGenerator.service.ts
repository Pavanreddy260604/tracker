
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

const ASSISTANT_V2_ENABLED = (process.env.SCRIPT_WRITER_ASSISTANT_V2 || 'true').toLowerCase() !== 'false';
const EXPLANATION_TEXT_LIMIT = 4000;
const SMALL_TALK_MAX_LENGTH = 40;
const SMALL_TALK_PATTERN = /^(hi|hello|hey|yo|sup|hola|namaste|thanks|thank you|thx|bye|goodbye|see you|see ya|later|good morning|good afternoon|good evening|good night|how are you|whats up|what's up)(\s+(there|assistant|team|codex|buddy))?$/i;

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
        if (!request.speedMode) {
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
            stateGuidance = '\n\n## CHARACTER CONTINUITY & ROBUST VOICE:\n' + this.buildCharacterContext(castContext) + '\n';
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
            console.log('[ScriptGen] PH 20: Character State Update & Discovery triggered');
            if (request.bibleId) {
                characterDiscoveryService.discoverAndSave(request.bibleId, finalContent).catch(e => console.error('[Discovery] Error:', e));
            }
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

        const characterMemoryText = this.buildCharacterContext(castContext);

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
                    
                    const markerMatch = scriptText.match(/(STORY_CONTEXT_SUMMARY|SCENE_PLAN|CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE)/i);
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
        // If outline exists and is sufficient, don't regenerate by default
        // But for "High Detail" we might want to check length against target scale
        const targetScale = Math.max(20, Math.floor((bible.targetSceneCount || 60) / 3));
        if (bible.globalOutline && bible.globalOutline.length >= targetScale) return;
        
        const { MASTER_OUTLINE_PROMPT } = require('../prompts/hollywood');
        const prompt = MASTER_OUTLINE_PROMPT
            .replace('{{logline}}', bible.logline || bible.title)
            .replace('{{target_scale}}', targetScale.toString());
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

    private truncateForExplanation(text: string): string {
        const trimmed = (text || '').trim();
        if (trimmed.length <= EXPLANATION_TEXT_LIMIT) {
            return trimmed;
        }
        return `${trimmed.slice(0, EXPLANATION_TEXT_LIMIT)}\n[TRUNCATED]`;
    }

    private extractJsonPayload(raw: string): string | null {
        if (!raw) return null;
        const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
            return cleaned;
        }
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return cleaned.slice(start, end + 1);
        }
        return null;
    }

    private normalizeExplanationList(value: unknown): string[] {
        if (!value) return [];
        if (Array.isArray(value)) {
            return value
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter((item) => item.length > 0)
                .slice(0, 7);
        }
        if (typeof value === 'string') {
            return value
                .split('\n')
                .map((line) => line.replace(/^[-*•\s]+/, '').trim())
                .filter((line) => line.length > 0)
                .slice(0, 7);
        }
        return [];
    }

    private isSmallTalk(instruction: string): boolean {
        const trimmed = instruction.trim();
        if (!trimmed) return false;
        if (trimmed.length > SMALL_TALK_MAX_LENGTH) return false;
        const normalized = trimmed
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s']/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!normalized) return false;
        return SMALL_TALK_PATTERN.test(normalized);
    }

    private async classifyIntentElite(instruction: string, context: { hasScene: boolean, hasSelection: boolean, currentMode: string }): Promise<{ intent: 'scene_edit' | 'selection_edit' | 'chat', confidence: number }> {
        const { ELITE_INTENT_CLASSIFIER_PROMPT } = require('../prompts/hollywood');
        
        const prompt = ELITE_INTENT_CLASSIFIER_PROMPT
            .replace('{{hasScene}}', String(context.hasScene))
            .replace('{{hasSelection}}', String(context.hasSelection))
            .replace('{{currentMode}}', context.currentMode)
            .replace('{{instruction}}', instruction.trim());

        try {
            // Use Groq for ultra-fast intent classification (low latency is "Top Class")
            const response = await aiServiceManager.chat(prompt, { 
                temperature: 0, 
                format: 'json',
                model: 'llama-3-8b-8192' // Speed-optimized model for single-token/JSON tasks
            });

            const jsonPayload = this.extractJsonPayload(response);
            if (jsonPayload) {
                const parsed = JSON.parse(jsonPayload);
                return {
                    intent: parsed.intent || 'chat',
                    confidence: parsed.confidence || 0.5
                };
            }
        } catch (error) {
            console.error('[EliteClassifier] Failed:', error);
        }

        // Resilient Fallback: If ML fails, we stay conservative
        return { intent: 'chat', confidence: 0 };
    }

    private async generateSmallTalkResponse(message: string): Promise<string> {
        const { SMALL_TALK_PROMPT } = require('../prompts/hollywood');
        const prompt = SMALL_TALK_PROMPT.replace('{{message}}', message.trim());
        const response = await aiServiceManager.chat(prompt, { temperature: 0.7 });
        const cleaned = cleanAssistantChatResponse(response).trim();
        return cleaned || 'Hey! What are you working on right now?';
    }

    private extractPatchSegments(content: string): { searchText: string; replaceText: string } | null {
        if (!content) return null;
        const cleaned = content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        const searchMarker = '<<<SEARCH>>>';
        const replaceMarker = '<<<REPLACE>>>';
        const searchIndex = cleaned.indexOf(searchMarker);
        const replaceIndex = cleaned.indexOf(replaceMarker);
        if (searchIndex === -1 || replaceIndex === -1) return null;
        const searchText = cleaned.slice(searchIndex + searchMarker.length, replaceIndex).trim();
        const replaceText = cleaned.slice(replaceIndex + replaceMarker.length).trim();
        if (!searchText || !replaceText) return null;
        return { searchText, replaceText };
    }

    private async generateEditExplanation(input: { original: string; revised: string; instruction: string; language: string }): Promise<string[] | null> {
        if (!ASSISTANT_V2_ENABLED) return null;
        const { EDIT_EXPLANATION_PROMPT } = require('../prompts/hollywood');
        const prompt = EDIT_EXPLANATION_PROMPT
            .replace('{{original}}', this.truncateForExplanation(input.original))
            .replace('{{revised}}', this.truncateForExplanation(input.revised))
            .replace('{{instruction}}', input.instruction || 'No instruction provided.')
            .replace('{{language}}', input.language || 'English');
        try {
            const response = await aiServiceManager.chat(prompt, { format: 'json', temperature: 0.2 });
            const jsonPayload = this.extractJsonPayload(response);
            if (jsonPayload) {
                const parsed = JSON.parse(jsonPayload);
                const explanations = this.normalizeExplanationList(parsed.explanations || parsed.improvements || parsed.bullets || parsed);
                if (explanations.length > 0) {
                    return explanations;
                }
            }
            const fallback = this.normalizeExplanationList(response);
            return fallback.length > 0 ? fallback : null;
        } catch (error) {
            console.warn('[AssistantV2] Explanation generation failed:', error);
            return null;
        }
    }

    private buildAssistantOutputContract(mode: 'ask' | 'edit' | 'agent', target: 'scene' | 'selection', selection?: AssistedEditSelection | null): string {
        if (mode === 'ask') {
            return [
                'Respond in markdown.',
                'If the request is small talk or non-craft, reply in 1-2 friendly sentences and ask one short follow-up question.',
                'If the request asks for analysis, critique, or craft feedback, start with a concise analysis paragraph focused on craft and intent.',
                'Then provide 3-7 actionable bullets focused on structure, pacing, or dialogue.',
                'Only include screenplay changes if the user explicitly requests a rewrite or translation.',
                'If you include a `script-edit` block for target=selection, use <<<SEARCH>>> and <<<REPLACE>>>.',
                'If you include a `script-edit` block for target=scene, output the full revised scene.',
                'Always preserve screenplay formatting.'
            ].join('\n');
        }
        if (target === 'selection' && selection?.text?.trim()) {
            return [
                'Output exactly one fenced code block tagged `script-edit`.',
                'Do not include any other text or code blocks.',
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
            'Follow the 5-STEP MASTERCLASS STRUCTURE.',
            'SCENE_SCRIPT must contain the full revised screenplay content.',
            'Preserve screenplay formatting and existing sluglines unless explicitly changed.'
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

        // Personality Update: Allow structured sections as they are now the standard.
        return false;

        // Personality Update: Allow screenplay in ASK mode if it's within a script-edit block or appears to be a direct proposal.
        // We only forbid raw STORY_CONTEXT type structures.
        return false;
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

        const rewriteRequest = /\b(rewrite|redraft|edit|revise|fix|improve|tighten|change|replace|translate|transliterate|shorten|expand|cut|add|remove|rework|polish|convert|patch|make)\b/i.test(trimmed)
            && /\b(this|these|it|that|those|scene|script|selection|selected|line|lines|dialogue|action|passage|section)\b/i.test(trimmed);
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
                'If you want changes, tell me exactly what to rewrite or say "rewrite this selection."',
                'If you want analysis instead, ask a focused question like "What is weak in these lines?"'
            ].join('\n');
        }

        if (intent === 'scene_edit') {
            return [
                'This reads like a scene rewrite request, not a pure question.',
                '',
                'If you want changes, tell me what to change or say "rewrite the scene."',
                'If you want diagnosis first, ask a focused question like "Why is this scene weak?"'
            ].join('\n');
        }

        if (intent === 'ambiguous') {
            return [
                'This mixes analysis with a rewrite request.',
                '',
                'Tell me whether you want analysis, or a rewrite with changes applied.'
            ].join('\n');
        }

        return null;
    }

    async *assistedEdit(sceneId: string, instruction: string, options: AssistedEditOptions & { model?: string } = {}): AsyncGenerator<string, void, unknown> {
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
        let castContext: any[] = [];
        
        if (scene.charactersInvolved?.length) {
            castContext = await Character.find({ _id: { $in: scene.charactersInvolved } }).lean();
        } else if (bible?._id) {
            castContext = await Character.find({ bibleId: bible._id }).lean();
        }
        
        const characterMemoryText = this.buildCharacterContext(castContext);
        
        const plotState = scene.summary || 'Developing current scene.';
        const selectionBlock = this.buildAssistantSelectionBlock(options.selection);
        const transliteration = options.transliteration !== undefined
            ? options.transliteration
            : assistantPreferences.transliteration ?? bible?.transliteration;
        const assistantPreferencesBlock = this.buildAssistantPreferencesBlock(assistantPreferences, language, Boolean(transliteration));
        const { TACTICS_LIBRARY, SUBTEXT_MANDATE } = require('../prompts/hollywood');
        const tacticsStr = Object.entries(TACTICS_LIBRARY).map(([n, d]) => `${n.toUpperCase()}: ${d}`).join('\n');

        // Elite ML Intent Detection
        const intentContext = {
            hasScene: !!scene,
            hasSelection: target === 'selection',
            currentMode: mode
        };
        const eliteDecision = await this.classifyIntentElite(instruction, intentContext);
        
        // Confidence-based Routing Logic
        let effectiveIntent = eliteDecision.intent;
        if (eliteDecision.confidence < 0.6) {
            const defaultMode = assistantPreferences.defaultMode || 'ask';
            if (defaultMode === 'edit') effectiveIntent = target === 'selection' ? 'selection_edit' : 'scene_edit';
            else effectiveIntent = 'chat';
        }

        const askIntent: AskIntent = effectiveIntent === 'chat' ? 'chat' : 
                                    (effectiveIntent === 'selection_edit' ? 'selection_edit' : 'scene_edit');

        const priorChatHistory = this.buildAssistantChatHistoryText(
            (scene.assistantChatHistory || []).map((entry) => ({
                role: entry.role,
                content: entry.content
            }))
        );

        if (!scene.assistantChatHistory) scene.assistantChatHistory = [];
        scene.assistantChatHistory.push({ role: 'user', type: mode === 'ask' ? 'chat' : 'instruction', content: instruction, timestamp: new Date() });
        await scene.save();

        // 1. Instant Small Talk
        if (mode === 'ask' && this.isSmallTalk(instruction)) {
            const smallTalkResponse = await this.generateSmallTalkResponse(instruction);
            yield smallTalkResponse;
            scene.assistantChatHistory.push({
                role: 'assistant',
                type: 'chat',
                content: smallTalkResponse,
                timestamp: new Date()
            } as any);
            await scene.save();
            return;
        }

        // 2. WORLD CLASS AUTO-PROMOTION
        // If it's an edit request in Chat mode, promote it.
        let effectiveMode = mode;
        if (mode === 'ask' && (askIntent === 'selection_edit' || askIntent === 'scene_edit')) {
            effectiveMode = 'agent';
            console.info('[EliteClassifier] Auto-Promoting Chat request to Agent mode for execution.');
        }

        const userInterests = await this.getUserInterestsForBible(bible);
        const refPack = await assistantRagService.buildAssistantReferencePack({
            instruction,
            mode: effectiveMode,
            target,
            language,
            currentContent: originalContent,
            selection: options.selection,
            bible,
            scene: scene as any,
            userInterests
        });

        // 3. Execution Selection
        if (effectiveMode === 'ask') {
            const prompt = this.buildEditorAssistantPrompt(SCRIPT_EDITOR_AGENT_PROMPT, {
                mode: 'ask',
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
                outputContract: this.buildAssistantOutputContract('ask', target, options.selection),
                assistantPreferences: assistantPreferencesBlock
            });

            const stream = aiServiceManager.chatStream([{ role: 'user', content: prompt }], undefined, { model: options.model });
            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk;
                yield chunk;
            }

            const visibleResponse = cleanAssistantChatResponse(fullResponse).trim();
            scene.assistantChatHistory.push({
                role: 'assistant',
                type: 'chat',
                content: visibleResponse || 'My apologies, I could not generate a response.',
                timestamp: new Date(),
                retrievalMetadata: refPack.retrievalMetadata
            } as any);
            await scene.save();
            return;
        }

        // 4. Edit Execution (Selection vs Scene)
        if (target === 'selection' && options.selection?.text?.trim()) {
            const prompt = this.buildEditorAssistantPrompt(SCRIPT_EDITOR_AGENT_PROMPT, {
                mode: effectiveMode,
                target: 'selection',
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
                outputContract: this.buildAssistantOutputContract(effectiveMode, 'selection', options.selection),
                assistantPreferences: assistantPreferencesBlock
            });

            const stream = aiServiceManager.chatStream([{ role: 'system', content: prompt }], undefined, { model: options.model });
            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk;
                yield chunk;
            }

            const visibleResponse = cleanAssistantChatResponse(fullResponse).trim();
            let explanation: string[] | null = null;
            if (ASSISTANT_V2_ENABLED && visibleResponse) {
                const patchSegments = this.extractPatchSegments(visibleResponse);
                explanation = await this.generateEditExplanation({
                    original: patchSegments?.searchText || options.selection.text,
                    revised: patchSegments?.replaceText || '',
                    instruction,
                    language
                });
            }

            scene.assistantChatHistory.push({
                role: 'assistant',
                type: 'proposal',
                content: visibleResponse,
                timestamp: new Date(),
                retrievalMetadata: refPack.retrievalMetadata,
                metadata: { explanation: explanation || undefined }
            } as any);
            scene.lastInstruction = instruction;
            await scene.save();
            return;
        }

        // 5. Full Scene Edit (Main Path)
        const finalPrompt = this.replacePromptTokens(HYBRID_ASSISTANT_ULTIMATE_PROMPT, {
            '{{instruction}}': instruction,
            '{{mode}}': effectiveMode,
            '{{target}}': 'scene',
            '{{language}}': language,
            '{{transliteration}}': transliteration ? 'ENABLED' : 'DISABLED',
            '{{global_outline}}': globalOutline,
            '{{story_so_far}}': storySoFar,
            '{{character_memory}}': characterMemoryText,
            '{{plot_state}}': plotState,
            '{{similar_samples}}': refPack.promptSections,
            '{{original_content}}': originalContent,
            '{{selection_block}}': '',
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
                if (!isYieldingScript && /SCENE_SCRIPT:/i.test(fullResponse)) isYieldingScript = true;
                if (!isYieldingScript) continue;

                const scriptMatch = fullResponse.match(/SCENE_SCRIPT:\s*([\s\S]*)$/i);
                if (!scriptMatch) continue;

                const scriptText = scriptMatch[1];
                const markerMatch = scriptText.match(/(STORY_CONTEXT_SUMMARY|SCENE_PLAN|CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE)/i);
                const completeScript = markerMatch ? scriptText.slice(0, markerMatch.index) : scriptText;
                const normalizedScript = normalizeScreenplayWhitespace(completeScript);
                const safeTotalLength = markerMatch ? normalizedScript.length : Math.max(0, normalizedScript.length - 40);
                const safeDelta = normalizedScript.slice(alreadyYieldedLength, safeTotalLength);

                if (safeDelta) {
                    yield safeDelta;
                    alreadyYieldedLength += safeDelta.length;
                }
                lastScriptLength = normalizedScript.length;
                if (markerMatch) isYieldingScript = false;
            }

            const sections = extractStructuredAssistantSections(fullResponse);
            let finalScriptText = sections.script;

            if (!finalScriptText.trim() && alreadyYieldedLength === 0) {
                finalScriptText = await this.recoverSceneProposalWithEditorPrompt({
                    template: SCRIPT_EDITOR_AGENT_PROMPT,
                    mode: 'agent',
                    target: 'scene',
                    storySoFar,
                    slugline: scene.slugline || 'Current Scene',
                    summary: scene.summary || 'No summary available.',
                    characters: characterMemoryText,
                    language,
                    transliteration: Boolean(transliteration),
                    originalContent: originalContent || 'No active scene selected.',
                    selectionBlock: '',
                    chatHistory: priorChatHistory,
                    similarSamples: refPack.promptSections,
                    instruction,
                    assistantPreferences: assistantPreferencesBlock
                });
            }

            if (finalScriptText && lastScriptLength < finalScriptText.length) {
                const finalDelta = finalScriptText.slice(alreadyYieldedLength);
                if (finalDelta) yield finalDelta;
            }

            let explanation: string[] | null = null;
            if (ASSISTANT_V2_ENABLED && finalScriptText) {
                explanation = await this.generateEditExplanation({
                    original: originalContent,
                    revised: finalScriptText,
                    instruction,
                    language
                });
            }

            scene.assistantChatHistory.push({
                role: 'assistant',
                type: 'proposal',
                content: finalScriptText,
                timestamp: new Date(),
                retrievalMetadata: refPack.retrievalMetadata,
                metadata: {
                    analysis: sections.summary,
                    plan: sections.plan,
                    craft: sections.craft,
                    explanation: explanation || undefined
                }
            } as any);
            scene.pendingContent = finalScriptText;
            scene.lastInstruction = instruction;
            await scene.save();

            const memoryMatch = fullResponse.match(/CHARACTER_MEMORY_UPDATE \(JSON\):\s*(\{[\s\S]*?\})/);
            if (memoryMatch && castContext.length > 0) this.pendingTasks.add(this.extractAndSaveState(fullResponse, castContext));

            // Trigger character discovery in background
            if (bible?._id) {
                this.pendingTasks.add(characterDiscoveryService.discoverAndSave(bible._id.toString(), fullResponse));
            }

            const plotMatch = fullResponse.match(/PLOT_STATE_UPDATE \(JSON\):\s*(\{[\s\S]*?\})/);
            if (plotMatch) {
                try {
                    const plotUpdate = JSON.parse(plotMatch[1]);
                    if (plotUpdate.summary) {
                        scene.summary = plotUpdate.summary;
                        await scene.save();
                    }
                } catch (e) {}
            }
        } catch (error) { throw error; }
    }

    async *assistProject(bibleId: string, instruction: string, options: AssistedEditOptions & { model?: string } = {}): AsyncGenerator<string, void, unknown> {
        const { SCRIPT_EDITOR_AGENT_PROMPT } = require('../prompts/hollywood');
        const bible = await Bible.findById(bibleId).lean();
        if (!bible) throw new Error('Project not found');
        const assistantPreferences = this.getAssistantPreferences(bible);
        const language = options.language || assistantPreferences.replyLanguage || bible.language || 'English';
        const target = options.target === 'selection' && options.selection?.text?.trim() ? 'selection' : 'scene';
        const currentContent = options.currentContent || '';
        const transliteration = Boolean(options.transliteration ?? assistantPreferences.transliteration ?? bible.transliteration);
        if (this.isSmallTalk(instruction)) {
            const smallTalkResponse = await this.generateSmallTalkResponse(instruction);
            yield smallTalkResponse;
            return;
        }
        const intentContext = {
            hasScene: false,
            hasSelection: target === 'selection',
            currentMode: options.mode || 'ask'
        };
        const eliteDecision = await this.classifyIntentElite(instruction, intentContext);
        const askIntent: AskIntent = eliteDecision.intent === 'chat' ? 'chat' : 
                                    (eliteDecision.intent === 'selection_edit' ? 'selection_edit' : 'scene_edit');

        const shortCircuitResponse = this.buildAskIntentGuidance(askIntent);
        if (shortCircuitResponse) {
            yield shortCircuitResponse;
            return;
        }
        const cast = await Character.find({ bibleId }).lean();
        const characterMemoryText = this.buildCharacterContext(cast);
        
        const userInterests = await this.getUserInterestsForBible(bible);
        const ragPack = await assistantRagService.buildAssistantReferencePack({ instruction, mode: 'ask', target, language, currentContent, selection: options.selection, bible, scene: null, userInterests: userInterests ?? undefined });
        
        const prompt = this.buildEditorAssistantPrompt(SCRIPT_EDITOR_AGENT_PROMPT, {
            mode: 'ask',
            target,
            storySoFar: bible.storySoFar || 'No context provided.',
            slugline: `${bible.title} - PROJECT QUESTION`,
            summary: bible.logline || 'Project-level assistant question with no active scene selected.',
            characters: characterMemoryText,
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

        const stream = aiServiceManager.chatStream([{ role: 'user', content: prompt }], undefined, { model: options.model });
        for await (const chunk of stream) {
            yield chunk;
        }
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

    async * reviseScene(originalContent: string, critique: any, goal: string, language: string = 'English', options: { model?: string } = {}): AsyncGenerator<string, void, unknown> {
        const { SCREENPLAY_REVISION_PROMPT } = require('../prompts/hollywood');
        const prompt = SCREENPLAY_REVISION_PROMPT.replace('{{originalContent}}', originalContent).replace('{{summary}}', critique.summary || 'N/A').replace('{{dialogueIssues}}', (critique.dialogueIssues || []).join(', ') || 'None').replace('{{pacingIssues}}', (critique.pacingIssues || []).join(', ') || 'None').replace('{{formattingIssues}}', (critique.formattingIssues || []).join(', ') || 'None').replace('{{suggestions}}', (critique.suggestions || []).join(', ') || 'None').replace('{{goal}}', goal || 'Professional Hollywood Screenplay').replace(/{{language}}/g, language || 'English');
        try {
            const stream = aiServiceManager.chatStream([{ role: 'user', content: prompt }], undefined, { model: options.model });
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

    private buildCharacterContext(cast: any[]): string {
        if (!cast || cast.length === 0) return 'No specific character data available.';
        return cast.map(c => {
            let bio = `- **${c.name.toUpperCase()}** (${c.role || 'supporting'})`;
            if (c.traits?.length) bio += ` | Traits: ${c.traits.join(', ')}`;
            if (c.motivation) bio += ` | Motivation: ${c.motivation}`;
            if (c.currentStatus) bio += ` | Current Status: ${c.currentStatus}`;
            
            // Voice Robustness
            if (c.voice) {
                let voiceInfo = '';
                if (c.voice.description) voiceInfo += `Voice: ${c.voice.description}. `;
                if (c.voice.accent) voiceInfo += `Accent: ${c.voice.accent}. `;
                if (c.voice.sampleLines?.length) {
                    voiceInfo += `Sample Dialogue: "${c.voice.sampleLines.join('" / "')}"`;
                }
                if (voiceInfo) bio += ` | ${voiceInfo.trim()}`;
            }

            let relations = '';
            if (c.relationships?.length) {
                relations = ` | Relationships: ${c.relationships.map((r: any) => `${r.targetCharName}: ${r.dynamic}`).join(', ')}`;
            }
            return bio + relations;
        }).join('\n');
    }
}

export const scriptGenerator = new ScriptGeneratorService();
