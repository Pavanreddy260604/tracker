import { VoiceSample } from '../models/VoiceSample';
import { ollamaService } from './ollama.service';
import { vectorService } from './vector.service';
import { Bible } from '../models/Bible';
import mongoose from 'mongoose';
import pdfParse from 'pdf-parse';

export class VoiceService {

    /**
     * Ingests a raw text or PDF file, chunks it, embeds it, and saves samples.
     */
    async ingestReferenceMaterial(
        bibleId: string,
        fileBuffer: Buffer,
        mimeType: string,
        sourceName: string,
        characterId?: string // Optional character link
    ): Promise<number> {
        // 1. Extract Text
        let fullText = '';
        if (mimeType === 'application/pdf') {
            const data = await pdfParse(fileBuffer);
            fullText = data.text;
        } else {
            fullText = fileBuffer.toString('utf-8');
        }

        // 2. Intelligent Chunking (Split by dialogue or paragraph)
        // For scripts, splitting by 'INT.' or 'EXT.' or character names is best.
        // For raw text, paragraph splitting is safer initially.
        const chunks = this.splitIntoDialogueChunks(fullText);

        console.log(`[VoiceService] Extracted ${chunks.length} chunks from ${sourceName}`);

        // 3. Process & Save
        let savedCount = 0;
        for (const chunk of chunks) {
            if (chunk.length < 10) {
                console.log(`[VoiceService] Skipping short chunk (${chunk.length} chars): "${chunk.substring(0, 20)}..."`);
                continue;
            }

            try {
                // ... (rest of loop)
                const embedding = await ollamaService.generateEmbedding(chunk);

                // Save to DB
                const newSample = await VoiceSample.create({
                    bibleId,
                    characterId: characterId ? new mongoose.Types.ObjectId(characterId) : undefined,
                    content: chunk,
                    embedding,
                    source: sourceName,
                    tags: ['auto-ingested']
                });

                // Index in ChromaDB
                await vectorService.upsertSample(newSample as any);

                savedCount++;
            } catch (err: any) {
                console.error(`[VoiceService] Failed to embed chunk: ${err.message}`);
            }
        }

        return savedCount;
    }

    private splitIntoDialogueChunks(text: string): string[] {
        // Robust splitter: Handles Windows/Unix line endings and multiple newlines
        return text
            .split(/\r?\n\s*\r?\n/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
}

export const voiceService = new VoiceService();
