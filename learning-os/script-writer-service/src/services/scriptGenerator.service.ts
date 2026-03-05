
import mongoose from 'mongoose';
import { aiServiceManager } from './ai.manager';
import { vectorService } from './vector.service';
import { buildScriptPrompt, FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood';
import { Script } from '../models/Script';
import { Character } from '../models/Character';

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
}

export class ScriptGeneratorService {

    /**
     * Generates a screenplay based on user inputs, streaming the result.
     * Also saves the result to the database.
     */
    async *generateScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
        console.log(`[ScriptGen] Building prompt for: ${request.format} / ${request.style}`);

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

        let similarSamples: any[] = [];
        try {
            // Generate embedding for the specific Request Idea/Style
            const queryText = `${request.style} style. ${request.idea}`;
            const queryEmbedding = await aiServiceManager.generateEmbedding(queryText);

            // RAG Lookup with Filters
            // If bibleId is provided, narrow scope. If characterIds provided, narrow further.
            const scopeBibleId = request.bibleId || 'ALL';

            similarSamples = await vectorService.findSimilarSamples(
                scopeBibleId,
                queryEmbedding,
                5, // Fetch more, let filtering reduce
                request.characterIds,
                {
                    minSimilarity: 0.55,  // Only use reasonably similar samples
                    maxLength: 500,       // Keep samples concise
                    dedupe: true,          // Avoid repeating same content
                    era: request.era       // Contextual Era Filter
                }
            );

            if (similarSamples.length > 0) {
                console.log(`[ScriptGenerator] RAG Active: Found ${similarSamples.length} relevant samples`);
                similarSamples.forEach((s: any, i: number) => {
                    console.log(`  [${i + 1}] ${s.speaker || 'UNKNOWN'} (score: ${s.similarityScore?.toFixed(2)}): "${s.content.slice(0, 50)}..."`);
                });
            } else {
                console.log('[豆ScriptGenerator] RAG: No samples met relevance threshold');
            }

        } catch (err) {
            console.warn(`[ScriptGenerator] RAG Lookup failed (ignoring): ${err}`);
        }

        // Fetch Characters for Context
        let castContext: any[] = [];
        try {
            if (request.characterIds && request.characterIds.length > 0) {
                // If specific characters selected, fetch only them
                castContext = await Character.find({
                    _id: { $in: request.characterIds }
                }).lean();
            } else if (request.bibleId) {
                // If no specific chars but bible linked, fetch all project chars
                castContext = await Character.find({
                    bibleId: request.bibleId
                }).lean();
            }
            if (castContext.length > 0) {
                console.log(`[ScriptGenerator] Injected ${castContext.length} characters into prompt`);
            }
        } catch (charErr) {
            console.warn(`[ScriptGenerator] Failed to fetch characters: ${charErr}`);
        }

        let finalContent = '';

        // 1. Build the System + User Prompt
        // Inject Memory if available
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
                sceneLength: request.sceneLength
            },
            similarSamples, // Pass the found samples
            castContext    // Pass the cast list
        );

        // 2. Stream from Ollama
        try {
            const stream = aiServiceManager.chatStream([
                { role: 'user', content: fullPrompt }
            ]);

            console.log('[ScriptGen] DEBUG PROMPT SNIPPET:\n', fullPrompt.slice(0, 500) + '\n...\n' + fullPrompt.slice(-500));
            console.log('[ScriptGen] DEBUG LANGUAGE OPTION:', request.language);

            for await (const chunk of stream) {
                finalContent += chunk;
                yield chunk;
            }

            // 3. Save Completion
            scriptDoc.content = finalContent;
            scriptDoc.status = 'completed';
            await scriptDoc.save();

        } catch (error) {
            console.error('[ScriptGen] Generation failed:', error);

            scriptDoc.status = 'failed';
            scriptDoc.content = finalContent; // Save partial content if any area
            await scriptDoc.save();

            throw error;
        }
    }

    /**
     * Revises an existing scene based on critique feedback.
     */
    async *reviseScene(
        originalContent: string,
        critique: any,
        goal: string,
        language: string = 'English'
    ): AsyncGenerator<string, void, unknown> {
        console.log(`[ScriptGen] Revising scene based on critique (Language: ${language})...`);

        const { SCREENPLAY_REVISION_PROMPT } = require('../prompts/hollywood');

        // Simple template replacement
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
            const stream = aiServiceManager.chatStream([
                { role: 'user', content: prompt }
            ]);

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
            feedbackHeader = `CRITICAL: The previous attempt failed to break the score ceiling of ${targetScore}. You must be significantly more aggressive and creative. RESOLVE EVERY DIRECTIVE:\n\n${feedbackText}`;
        } else if (targetScore > 0) {
            feedbackHeader = `BENCHMARK TO BEAT: Score ${targetScore}\n\n${feedbackText}`;
        }

        const prompt = SENIOR_SCRIPT_DOCTOR_PROMPT
            .replace('{{originalContent}}', originalContent)
            .replace('{{feedback}}', feedbackHeader)
            .replace('{{goal}}', goal || 'Professional Hollywood Screenplay')
            .replace(/{{language}}/g, language || 'English');

        const result = await aiServiceManager.chat(prompt);

        return result.trim();
    }

    /**
     * Generates professional audit notes explaining the delta.
     */
    async generateAuditNotes(original: string, revised: string): Promise<string> {
        const { AUDIT_EXPLANATION_PROMPT } = require('../prompts/hollywood');

        const prompt = AUDIT_EXPLANATION_PROMPT
            .replace('{{original}}', original)
            .replace('{{revised}}', revised);

        const result = await aiServiceManager.chat(prompt);

        return result.trim();
    }
}

export const scriptGenerator = new ScriptGeneratorService();
