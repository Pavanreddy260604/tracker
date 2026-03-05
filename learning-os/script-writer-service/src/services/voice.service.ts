import crypto from 'crypto';
import mongoose from 'mongoose';
import pdfParse from 'pdf-parse';

import { VoiceSample } from '../models/VoiceSample';
import { aiServiceManager } from './ai.manager';
import { vectorService } from './vector.service';
import { chunkerService, DialogueChunk } from './chunker.service';
import { Character } from '../models/Character';

export interface IngestionResult {
    savedCount: number;
    skippedDuplicates: number;
    skippedShort: number;
    errorCount: number;
    characters: string[];
    sceneCount: number;
}

export class VoiceService {

    /**
     * Ingests a raw text or PDF file, chunks it intelligently,
     * embeds dialogue, and saves samples with proper attribution.
     */
    async ingestReferenceMaterial(
        bibleId: string,
        fileBuffer: Buffer,
        mimeType: string,
        sourceName: string,
        characterId?: string, // Optional: force all to specific character
        options?: {
            minDialogueLength?: number;
            characterFilter?: string[]; // Only ingest specific characters
            era?: string; // e.g. "childhood", "1990s"
        }
    ): Promise<IngestionResult> {
        // 1. Extract Text
        let fullText = '';
        if (mimeType === 'application/pdf') {
            const data = await pdfParse(fileBuffer);
            fullText = data.text;
        } else {
            fullText = fileBuffer.toString('utf-8');
        }

        // 2. Intelligent Screenplay-Aware Chunking
        const parseResult = await chunkerService.parseScreenplay(fullText);

        console.log(`[VoiceService] Parsed ${sourceName}:`);
        console.log(`  - Scenes: ${parseResult.sceneCount}`);
        console.log(`  - Characters: ${parseResult.characters.join(', ')}`);
        console.log(`  - Dialogue chunks: ${parseResult.stats.dialogueCount}`);
        console.log(`  - Action chunks: ${parseResult.stats.actionCount}`);
        console.log(`  - Avg dialogue length: ${parseResult.stats.avgDialogueLength} chars`);
        if (options?.era) {
            console.log(`  - Era Context: ${options.era}`);
        }

        // 3. Filter to dialogue only
        let dialogueChunks = chunkerService.extractDialogueForIngestion(parseResult, {
            minLength: options?.minDialogueLength ?? 20,
            maxLength: 2000,
            characterFilter: options?.characterFilter
        });

        // Fallback: If no dialogue was found but we have a specific characterId,
        // treat action chunks as dialogue for this character (e.g., for monologues or prose)
        if (dialogueChunks.length === 0 && characterId) {
            console.log(`[VoiceService] No dialogue found. Falling back to action chunks for character ${characterId}`);

            // Re-map action chunks to be dialogue chunks
            const actionChunks = parseResult.chunks.filter(c => c.type === 'action');

            if (actionChunks.length > 0) {
                dialogueChunks = actionChunks.map(c => ({
                    ...c,
                    type: 'dialogue' as const,
                    speaker: 'TARGET', // Placeholder, will be overridden by resolvedCharacterId logic below
                    // Add a tag to valid raw property if needed, but existing is fine
                }));
            }
        }

        console.log(`[VoiceService] Processing ${dialogueChunks.length} dialogue chunks for ingestion`);

        // 4. Process & Save with deduplication (CONTROLLED PARALLEL PROCESSING)
        // Using reduced concurrency to prevent memory issues and API rate limiting
        let savedCount = 0;
        let skippedDuplicates = 0;
        let skippedShort = 0;
        let errorCount = 0;

        const CONCURRENCY_LIMIT = 3; // Reduced from 10 to prevent memory pressure
        const BATCH_DELAY_MS = 100; // Small delay between batches for API rate limiting

        // Helper function to process a single chunk with error isolation
        const processChunk = async (chunk: any): Promise<{ success: boolean; reason?: string }> => {
            try {
                // Generate content hash for deduplication
                const contentHash = this.generateContentHash(chunk.content);

                // Check for existing duplicate
                const existing = await VoiceSample.findOne({
                    bibleId: new mongoose.Types.ObjectId(bibleId),
                    contentHash
                });

                if (existing) {
                    return { success: false, reason: 'duplicate' };
                }

                // Skip very short content
                if (chunk.content.length < 10) {
                    return { success: false, reason: 'short' };
                }

                // SOTA TECHNIQUE: Contextual Embedding
                // Instead of just embedding "No.", we embed "Speaker: Bhishma (Young). Previous: Father asking question. Content: No."
                // This creates a much richer vector representation.
                const eraContext = (chunk as any).era || options?.era || '';
                const contextString = chunk.contextBefore ? `Context: ${chunk.contextBefore}. ` : '';
                const speakerString = `Speaker: ${chunk.speaker}${eraContext ? ` (${eraContext})` : ''}. `;

                const richTextToEmbed = `${speakerString}${contextString}Line: "${chunk.content}"`;

                // Generate embedding from RICH TEXT
                const embedding = await aiServiceManager.generateEmbedding(richTextToEmbed);

                // Resolve character ID
                const resolvedCharacterId = characterId
                    ? new mongoose.Types.ObjectId(characterId)
                    : await this.resolveCharacterByName(bibleId, chunk.speaker);

                // Save to DB with full attribution
                const newSample = await VoiceSample.create({
                    bibleId: new mongoose.Types.ObjectId(bibleId),
                    characterId: resolvedCharacterId,
                    content: chunk.content,
                    contentHash,
                    speaker: chunk.speaker,
                    era: (chunk as any).era || options?.era,
                    chunkType: chunk.type,
                    chunkIndex: chunk.chunkIndex,
                    embedding,
                    source: sourceName,
                    tags: ['auto-ingested', chunk.parenthetical || ''].filter(Boolean)
                });

                // Index in ChromaDB
                await vectorService.upsertSample(newSample as any);
                return { success: true };

            } catch (err: any) {
                console.error(`[VoiceService] Failed to process chunk from ${chunk.speaker}: ${err.message}`);
                return { success: false, reason: 'error' };
            }
        };

        // Process chunks with controlled concurrency
        for (let i = 0; i < dialogueChunks.length; i += CONCURRENCY_LIMIT) {
            const batch = dialogueChunks.slice(i, i + CONCURRENCY_LIMIT);

            // Process batch with Promise.allSettled for error isolation
            const results = await Promise.allSettled(
                batch.map(chunk => processChunk(chunk))
            );

            // Tally results
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        savedCount++;
                    } else if (result.value.reason === 'duplicate') {
                        skippedDuplicates++;
                    } else if (result.value.reason === 'short') {
                        skippedShort++;
                    } else {
                        errorCount++;
                    }
                } else {
                    errorCount++;
                }
            }

            // Log progress every 50 chunks
            if ((i + CONCURRENCY_LIMIT) % 50 === 0) {
                console.log(`[VoiceService] Batch Update: Processed ${Math.min(i + CONCURRENCY_LIMIT, dialogueChunks.length)} / ${dialogueChunks.length} chunks...`);
            }

            // Small delay between batches to prevent API rate limiting
            if (i + CONCURRENCY_LIMIT < dialogueChunks.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }

        console.log(`[VoiceService] Ingestion complete:`);
        console.log(`  - Saved: ${savedCount}`);
        console.log(`  - Skipped (duplicates): ${skippedDuplicates}`);
        console.log(`  - Skipped (too short): ${skippedShort}`);
        console.log(`  - Errors: ${errorCount}`);

        return {
            savedCount,
            skippedDuplicates,
            skippedShort,
            errorCount,
            characters: parseResult.characters,
            sceneCount: parseResult.sceneCount
        };
    }

    /**
     * Generate a short hash for content deduplication.
     */
    private generateContentHash(content: string): string {
        const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
        return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    }

    /**
     * Attempt to resolve a character name to an existing Character ID in the project.
     * Returns undefined if no match found.
     */
    private async resolveCharacterByName(
        bibleId: string,
        speakerName?: string
    ): Promise<mongoose.Types.ObjectId | undefined> {
        if (!speakerName) return undefined;

        try {
            // Try exact match first (case-insensitive)
            const character = await Character.findOne({
                bibleId: new mongoose.Types.ObjectId(bibleId),
                name: { $regex: new RegExp(`^${speakerName}$`, 'i') }
            });

            if (character) {
                return character._id;
            }

            // Could add fuzzy matching here in the future
            return undefined;

        } catch (err) {
            console.warn(`[VoiceService] Character resolution failed for "${speakerName}": ${err}`);
            return undefined;
        }
    }

    /**
     * Legacy method for backward compatibility.
     * @deprecated Use chunkerService.parseScreenplay() directly for more control.
     */
    private async splitIntoDialogueChunks(text: string): Promise<string[]> {
        const result = await chunkerService.parseScreenplay(text);
        return result.chunks
            .filter(c => c.type === 'dialogue')
            .map(c => c.content);
    }
}

export const voiceService = new VoiceService();
