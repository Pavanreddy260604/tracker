
import mongoose from 'mongoose';
import { ollamaService } from './ollama.service';
import { vectorService } from './vector.service';
import { buildScriptPrompt, FORMAT_TEMPLATES, STYLE_PROMPTS } from '../prompts/hollywood';
import { Script } from '../models/Script';

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
}

export class ScriptGeneratorService {

    /**
     * Generates a screenplay based on user inputs, streaming the result.
     * Also saves the result to the database.
     */
    async *generateScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
        console.log(`[ScriptGen] Building prompt for: ${request.format} / ${request.style}`);

        // 0. Initialize Script Document
        const scriptDoc = new Script({
            userId: new mongoose.Types.ObjectId(request.userId),
            prompt: request.idea,
            format: request.format,
            style: request.style,
            language: request.language || 'English',
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
            const queryEmbedding = await ollamaService.generateEmbedding(queryText);

            // RAG Lookup with Filters
            // If bibleId is provided, narrow scope. If characterIds provided, narrow further.
            const scopeBibleId = request.bibleId || 'ALL';

            similarSamples = await vectorService.findSimilarSamples(
                scopeBibleId,
                queryEmbedding,
                3,
                request.characterIds
            );

            if (similarSamples.length > 0) {
                console.log(`[ScriptGenerator] RAG Active: Found ${similarSamples.length} voice samples for characters: ${request.characterIds || 'ALL'}`);
            }

        } catch (err) {
            console.warn(`[ScriptGenerator] RAG Lookup failed (ignoring): ${err}`);
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
            similarSamples // Pass the found samples
        );

        // 2. Stream from Ollama
        try {
            const stream = ollamaService.chatStream([
                { role: 'user', content: fullPrompt }
            ]);

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
}

export const scriptGenerator = new ScriptGeneratorService();
