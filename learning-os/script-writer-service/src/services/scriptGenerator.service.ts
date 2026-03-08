
import mongoose from 'mongoose';
import { aiServiceManager } from './ai.manager';
import { vectorService } from './vector.service';
import { buildScriptPrompt, FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood';
import { Script } from '../models/Script';
import { Character } from '../models/Character';
import { User } from '../models/User';
import { Bible } from '../models/Bible';
import { Scene } from '../models/Scene';

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

        // Initialize language from request or Project Bible
        let targetLanguage = request.language;
        if (!targetLanguage && request.bibleId) {
            const bible = await mongoose.model('Bible').findById(request.bibleId).lean();
            if (bible) targetLanguage = (bible as any).language;
        }
        request.language = targetLanguage || 'English';

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
                    interests: userInterests ?? undefined // Pass interests to Vector Search (PH 22)
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
                { interests: userInterests ?? undefined }
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
        let finalContent = '';

        for await (const chunk of stream) {
            finalContent += chunk;
            yield chunk;
        }

        // 4. Background Processing (Memory Updates & Recursive Summary)
        if (bible) {
            bible.sceneCount = (bible.sceneCount || 0) + 1;
            await bible.save();

            // Trigger Summarization every 5 scenes
            if (bible.sceneCount % 5 === 0) {
                console.log(`[ScriptGen] Triggering Recursive Summary for scene ${bible.sceneCount}`);
                const summaryTask = this.updateRecursiveSummary(bible);
                this.pendingTasks.add(summaryTask);
                summaryTask.finally(() => this.pendingTasks.delete(summaryTask)).catch(e => console.error('[SummaryUpdate] Error:', e));
            }
        }

        console.log('[ScriptGen] PH 25: Advanced Coherence Generation Complete');
        const stateTask = this.extractAndSaveState(finalContent, castContext);
        this.pendingTasks.add(stateTask);
        stateTask.finally(() => this.pendingTasks.delete(stateTask)).catch(e => console.error('[StateUpdate] Error:', e));
    }

    /**
     * For testing: wait for all background memory tasks to finish.
     */
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
            // Use default model (handles fallbacks automatically)
            const response = await aiServiceManager.chat(prompt, {
                format: 'json'
            });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            let outline = JSON.parse(cleanJson);

            // AI might wrap in an object
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

        const recentScenes = await Scene.find({ bibleId: bible._id })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        if (recentScenes.length === 0) return;

        const scenesText = recentScenes.reverse().map((s: any) => `### ${s.title}\n${s.content}`).join('\n\n');
        const prompt = RECURSIVE_SUMMARY_PROMPT
            .replace('{{recent_scenes}}', scenesText)
            .replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.');

        try {
            const newSummary = await aiServiceManager.chat(prompt);
            bible.storySoFar = newSummary.trim();
            await bible.save();
            console.log('[ScriptGen] Story So Far updated recursive summary.');
        } catch (err) {
            console.error('[RecursiveSummary] Failed:', err);
        }
    }

    /**
     * PH 31: Generate a detailed 10-beat sub-arc for a block of scenes.
     */
    async generateBlockBeatSheet(bibleId: string, startScene: number, count: number = 10): Promise<any[]> {
        const bible = await Bible.findById(bibleId);
        if (!bible) throw new Error('Bible not found');

        const { BLOCK_BEAT_SHEET_PROMPT } = require('../prompts/hollywood');
        const prompt = BLOCK_BEAT_SHEET_PROMPT
            .replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.')
            .replace('{{global_outline}}', bible.globalOutline?.join('\n') || 'No global outline.')
            .replace(/{{start_scene}}/g, startScene.toString())
            .replace(/{{end_scene}}/g, (startScene + count - 1).toString());

        try {
            console.log(`[ScriptGen] Planning Block: Scenes ${startScene}-${startScene + count - 1}`);
            const response = await aiServiceManager.chat(prompt, { format: 'json' });
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            let block = JSON.parse(cleanJson);

            if (!Array.isArray(block) && typeof block === 'object') {
                block = block.scenes || block.beats || Object.values(block)[0];
            }

            return Array.isArray(block) ? block : [];
        } catch (err) {
            console.error('[BlockBeatSheet] Failed:', err);
            return [];
        }
    }

    /**
     * PH 31: Generate a batch of scenes in parallel.
     */
    async generateBatch(request: ScriptRequest, blockBeats: any[]): Promise<any[]> {
        console.log(`[ScriptGen] Launching Parallel Batch: ${blockBeats.length} scenes`);

        const tasks = blockBeats.map(async (beat) => {
            const { BATCH_SCENE_PROMPT } = require('../prompts/hollywood');

            let castContext: any[] = [];
            if (request.characterIds?.length) {
                const characterQuery: Record<string, unknown> = { _id: { $in: request.characterIds } };
                if (request.bibleId) {
                    characterQuery.bibleId = request.bibleId;
                }
                castContext = await Character.find(characterQuery).lean();
            }

            const bible = await Bible.findById(request.bibleId);

            let characterMemoryText = '';
            castContext.forEach(c => {
                characterMemoryText += `- ${c.name}: ${c.currentStatus || 'Stable'}\n`;
            });

            const prompt = BATCH_SCENE_PROMPT
                .replace('{{story_so_far}}', bible?.storySoFar || 'Starting build.')
                .replace('{{master_beat}}', bible?.globalOutline?.[Math.floor(beat.sceneNumber / 5)] || 'Unknown')
                .replace('{{scene_number}}', beat.sceneNumber.toString())
                .replace('{{slugline}}', beat.slugline)
                .replace('{{summary}}', beat.summary)
                .replace('{{polarity_shift}}', beat.polarityShift || 'Neutral')
                .replace('{{character_memory}}', characterMemoryText);

            try {
                const content = await aiServiceManager.chat(prompt);

                await new Scene({
                    bibleId: request.bibleId,
                    sequenceNumber: beat.sceneNumber,
                    title: beat.title,
                    slugline: beat.slugline,
                    summary: beat.summary,
                    content: content,
                    status: 'drafted'
                }).save();

                return { sceneNumber: beat.sceneNumber, success: true };
            } catch (err) {
                console.error(`[BatchWorker] Scene ${beat.sceneNumber} failed:`, err);
                return { sceneNumber: beat.sceneNumber, success: false, error: err };
            }
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

    /**
     * PH 34: Assisted Edit (Intent-based Refactoring)
     * Refactors an existing script fragment according to user instructions.
     */
    async *assistedEdit(
        sceneId: string,
        instruction: string,
        options: { language?: string } = {}
    ): AsyncGenerator<string, void, unknown> {
        const { SCRIPT_ASSISTANT_PROMPT } = require('../prompts/hollywood');

        const scene = await Scene.findById(sceneId).populate('bibleId');
        if (!scene) throw new Error('Scene not found');

        const bible = scene.bibleId as any;
        const storySoFar = bible?.storySoFar || 'No context provided.';
        const language = options.language || bible?.language || 'English';

        let characterNames = 'No characters specified.';
        if (scene.charactersInvolved?.length) {
            const chars = await Character.find({ _id: { $in: scene.charactersInvolved } }).lean();
            characterNames = chars.map(c => c.name).join(', ');
        }

        let userInterests = null;
        try {
            if (bible?.ownerId) {
                const User = require('../models/User').User; // fallback if not imported at top
                const user = await User.findById(bible.ownerId).lean();
                if (user) userInterests = user.scriptInterests;
            }
        } catch (e) { }

        let similarSamplesText = '';
        try {
            const queryEmbedding = await aiServiceManager.generateEmbedding(instruction);
            // Map ObjectIds to strings to satisfy TS
            const charIds = scene.charactersInvolved?.map(id => id.toString()) || [];

            const similarSamples = await vectorService.findSimilarSamples(
                bible?._id || 'ALL',
                queryEmbedding,
                4, // Top 4 samples
                charIds,
                {
                    interests: userInterests ?? undefined,
                    language: language // User requested language must match Master Script language
                }
            );

            if (similarSamples && similarSamples.length > 0) {
                similarSamplesText = '## REFERENCE MATERIAL FROM BIBLE (Examples of tone, style, and formatting):\n' +
                    similarSamples.map(s => `--- RAG MATCH (Score: ${s.similarityScore?.toFixed(2) || 'N/A'}) ---\n${s.content}`).join('\n\n');
            }
        } catch (err) {
            console.warn(`[ScriptGenerator] Assistant RAG Lookup failed:`, err);
        }

        let prompt = SCRIPT_ASSISTANT_PROMPT
            .replace('{{original_content}}', scene.content || '')
            .replace('{{similar_samples}}', similarSamplesText)
            .replace('{{instruction}}', instruction)
            .replace('{{story_so_far}}', storySoFar)
            .replace('{{slugline}}', scene.slugline || 'INT. UNKNOWN - DAY')
            .replace('{{summary}}', scene.summary || 'No summary provided.')
            .replace('{{characters}}', characterNames)
            .replace('{{language}}', language);

        // Inject Chat History
        let chatHistoryText = 'No previous conversation.\n';
        if (scene.assistantChatHistory && scene.assistantChatHistory.length > 0) {
            chatHistoryText = scene.assistantChatHistory.map((entry: any) => {
                const roleName = entry.role === 'assistant' ? 'AI' : 'User';
                return `[${roleName}]: ${entry.content}`;
            }).join('\n\n');
        }
        prompt = prompt.replace('{{chat_history}}', chatHistoryText);

        // Add user instruction to history
        if (!scene.assistantChatHistory) scene.assistantChatHistory = [];
        scene.assistantChatHistory.push({
            role: 'user',
            type: 'chat',
            content: instruction,
            timestamp: new Date()
        });
        await scene.save();

        let fullRevisedText = '';
        try {
            const stream = aiServiceManager.chatStream([{ role: 'system', content: prompt }]);
            for await (const chunk of stream) {
                fullRevisedText += chunk;
                yield chunk;
            }

            // After stream finishes, save assistant response to history
            scene.assistantChatHistory.push({
                role: 'assistant',
                type: 'chat',
                content: fullRevisedText,
                timestamp: new Date()
            });
            await scene.save();

        } catch (error) {
            console.error('[ScriptAssistant] Edit failed:', error);
            throw error;
        }
    }

    /**
     * PH 35: Apply and Propose Edit
     * Runs the assistant and saves the result to 'pendingContent' for review.
     */
    async applyAndProposeEdit(sceneId: string, instruction: string): Promise<string> {
        const scene = await Scene.findById(sceneId);
        if (!scene) throw new Error('Scene not found');

        let fullRevisedText = '';
        const stream = this.assistedEdit(sceneId, instruction);

        for await (const chunk of stream) {
            fullRevisedText += chunk;
        }

        scene.pendingContent = fullRevisedText;
        scene.lastInstruction = instruction;
        await scene.save();

        return fullRevisedText;
    }

    /**
     * PH 35: Commit Assisted Edit
     * Approves the pending edit and moves it to the main content.
     */
    async commitAssistedEdit(sceneId: string): Promise<boolean> {
        const scene = await Scene.findById(sceneId);
        if (!scene || !scene.pendingContent) return false;

        scene.content = scene.pendingContent;
        scene.pendingContent = undefined;
        scene.lastInstruction = undefined;
        await scene.save();

        return true;
    }

    /**
     * Revises an existing scene based on critique feedback.
     */
    async * reviseScene(
        originalContent: string,
        critique: any,
        goal: string,
        language: string = 'English'
    ): AsyncGenerator<string, void, unknown> {
        const { SCREENPLAY_REVISION_PROMPT } = require('../prompts/hollywood');
        const prompt = SCREENPLAY_REVISION_PROMPT
            .replace('{{originalContent}}', originalContent)
            .replace('{{summary}}', critique.summary || 'N/A')
            .replace('{{dialogueIssues}}', (critique.dialogueIssues || []).join(', ') || 'None')
            .replace('{{pacingIssues}}', (critique.pacingIssues || []).join(', ') || 'None')
            .replace('{{formattingIssues}}', (critique.formattingIssues || []).join(', ') || 'None')
            .replace('{{suggestions}}', (critique.suggestions || []).join(', ') || 'None')
            .replace('{{goal}}', goal || 'Professional Hollywood Screenplay')
            .replace(/{{language}}/g, language || 'English');

        try {
            const stream = aiServiceManager.chatStream([{ role: 'user', content: prompt }]);
            for await (const chunk of stream) {
                yield chunk;
            }
        } catch (error) {
            console.error('[ScriptGen] Revision failed:', error);
            throw error;
        }
    }

    /**
     * Batch version of revision for internal quality checks.
     */
    async reviseSceneBatch(
        originalContent: string,
        critique: any,
        goal: string,
        isRetry: boolean = false,
        targetScore: number = 0,
        language: string = 'English'
    ): Promise<string> {
        const { SENIOR_SCRIPT_DOCTOR_PROMPT } = require('../prompts/hollywood');

        const feedbackText = [
            critique.summary ? `DIRECTIVE 0: ${critique.summary}` : '',
            (critique.dialogueIssues || []).length > 0 ? `DIALOGUE DIRECTIVES:\n- ${critique.dialogueIssues.join('\n- ')}` : '',
            (critique.pacingIssues || []).length > 0 ? `PACING DIRECTIVES:\n- ${critique.pacingIssues.join('\n- ')}` : '',
            (critique.suggestions || []).length > 0 ? `STRATEGIC COMMANDS:\n- ${critique.suggestions.join('\n- ')}` : ''
        ].filter(Boolean).join('\n\n');

        let feedbackHeader = feedbackText;
        if (isRetry) {
            feedbackHeader = `CRITICAL: The previous attempt failed to break score ${targetScore}. Be more aggressive.\n\n${feedbackText}`;
        }

        const prompt = SENIOR_SCRIPT_DOCTOR_PROMPT
            .replace('{{originalContent}}', originalContent)
            .replace('{{feedback}}', feedbackHeader)
            .replace('{{goal}}', goal || 'Professional Screenplay')
            .replace(/{{language}}/g, language || 'English');

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

        const prompt = SCENE_BEAT_SHEET_PROMPT
            .replace('{{tactics}}', tacticsStr)
            .replace('{{goal}}', goalStr)
            .replace('{{polarityShift}}', polarityStr);

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
                        if (update.itemsGained) {
                            currentItems = Array.from(new Set([...currentItems, ...update.itemsGained]));
                        }
                        if (update.itemsLost) currentItems = currentItems.filter((i: string) => !update.itemsLost.includes(i));

                        await Character.findByIdAndUpdate(char._id, {
                            currentStatus: update.newStatus,
                            heldItems: currentItems,
                            $set: { relationships: update.relationshipChanges } // PH 28
                        });
                        console.log(`[ScriptGen] Updated ${char.name} status & relationships`);
                    }
                }
            }
        } catch (err) {
            console.error('[StateUpdate] Failed:', err);
        }
    }
}

export const scriptGenerator = new ScriptGeneratorService();
