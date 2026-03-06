
import { MasterScript, IMasterScript } from '../models/MasterScript';
import { chunkerService } from './chunker.service';
import { aiServiceManager } from './ai.manager';
import { vectorService } from './vector.service';
import { VoiceSample } from '../models/VoiceSample';
import mongoose from 'mongoose';

export class AdminService {
    /**
     * Ingests a master script: chunks it, generates embeddings, and indexes it.
     */
    async processMasterScript(scriptId: string): Promise<void> {
        const script = await MasterScript.findById(scriptId);
        if (!script) throw new Error('Master script not found');

        script.status = 'processing';
        await script.save();

        try {
            console.log(`[AdminService] Processing Master Script: ${script.title} by ${script.director}`);

            // 1. Chunk the script
            const result = await chunkerService.parseScreenplay(script.rawContent);
            const dialogueChunks = result.chunks.filter(c => c.type === 'dialogue');

            console.log(`[AdminService] Extracted ${dialogueChunks.length} dialogue segments.`);

            let count = 0;
            for (const chunk of dialogueChunks) {
                // 2. Generate Embedding (with language context prepended for better clustering)
                const textToEmbed = `[Language: ${script.language}] ${chunk.content}`;
                const embedding = await aiServiceManager.generateEmbedding(textToEmbed);

                // 3. Save to MongoDB
                const sample = new VoiceSample({
                    masterScriptId: script._id,
                    content: chunk.content,
                    speaker: chunk.speaker,
                    tactic: chunk.tactic,
                    emotion: chunk.emotion,
                    era: chunk.era,
                    language: script.language, // Added language tracking
                    chunkType: 'dialogue',
                    embedding: embedding,
                    tags: script.tags,
                    source: `${script.director}: ${script.title}`
                });
                await sample.save();

                // 4. Index in Vector DB
                await vectorService.upsertSample(sample);

                count++;
                if (count % 10 === 0) {
                    script.processedChunks = count;
                    await script.save();
                }
            }

            script.status = 'indexed';
            script.processedChunks = count;
            await script.save();

            console.log(`[AdminService] Successfully indexed ${count} chunks for ${script.title}`);

        } catch (error) {
            console.error(`[AdminService] Failed to process script ${scriptId}:`, error);
            script.status = 'failed';
            await script.save();
            throw error;
        }
    }

    async getAllMasterScripts() {
        return MasterScript.find().sort({ createdAt: -1 });
    }

    async createMasterScript(data: Partial<IMasterScript>) {
        const script = new MasterScript(data);
        await script.save();
        return script;
    }
}

export const adminService = new AdminService();
