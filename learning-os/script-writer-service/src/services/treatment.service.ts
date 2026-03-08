import { Treatment, ITreatment } from '../models/Treatment';
import { Scene } from '../models/Scene';
import { aiServiceManager } from './ai.manager';
import { buildBeatSheetPrompt } from '../prompts/hollywood';
import mongoose from 'mongoose';

export class TreatmentService {
    private isSequenceConflict(error: any): boolean {
        if (!error || typeof error !== 'object') return false;
        if (error.code !== 11000) return false;
        const keyPattern = error.keyPattern || {};
        if (keyPattern.bibleId && keyPattern.sequenceNumber) return true;
        return String(error.message || '').includes('bibleId_1_sequenceNumber_1');
    }

    /**
     * Generates a Beat Sheet (Treatment) from a logline using Ollama.
     * Returns the structured object (preview) but does not save it yet.
     */
    async generatePreview(logline: string, style: string = 'Save The Cat'): Promise<any> {
        const prompt = buildBeatSheetPrompt(logline, style);

        console.log(`[TreatmentService] Generating beat sheet for: "${logline}"`);

        try {
            // Use non-streaming chat with JSON mode enabled for reliability
            const response = await aiServiceManager.chat(prompt, { format: 'json' });

            let jsonStr = response.trim();

            // Sanitize markdown if present (even in JSON mode models sometimes add it)
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

            // Find valid JSON boundaries
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            const data = JSON.parse(jsonStr);
            return data;
        } catch (error) {
            console.error('[TreatmentService] Failed to generate/parse Beat Sheet JSON:', error);
            throw new Error('AI failed to generate a valid Beat Sheet structure. Please try again.');
        }
    }

    /**
     * Saves a confirmed Treatment to database.
     */
    async saveTreatment(bibleId: string, logline: string, acts: any[], style: string = 'Save The Cat'): Promise<ITreatment> {
        const treatment = await Treatment.create({
            bibleId: new mongoose.Types.ObjectId(bibleId),
            logline,
            style,
            acts
        });
        return treatment;
    }

    /**
     * Converts a Treatment into actual Scene documents.
     */
    async convertToScenes(treatmentId: string): Promise<{ count: number, scenes: any[] }> {
        const treatment = await Treatment.findById(treatmentId);
        if (!treatment) throw new Error('Treatment not found');

        const scenesCreated = [];
        let seq = 1;

        // Get current max sequence number to append
        const lastScene = await Scene.findOne({ bibleId: treatment.bibleId }).sort({ sequenceNumber: -1 });
        if (lastScene) seq = lastScene.sequenceNumber + 1;

        for (const act of treatment.acts) {
            for (const beat of act.beats) {
                const MAX_SEQUENCE_RETRIES = 5;
                let created: any = null;

                for (let attempt = 1; attempt <= MAX_SEQUENCE_RETRIES; attempt++) {
                    try {
                        created = await Scene.create({
                            bibleId: treatment.bibleId,
                            sequenceNumber: seq,
                            title: beat.title || beat.name,
                            slugline: beat.slugline || `EXT. ${beat.name.toUpperCase()} - DAY`,
                            summary: beat.description || beat.summary,
                            goal: `Execute beat: ${beat.name || beat.title}`,
                            status: 'planned'
                        });
                        seq += 1;
                        break;
                    } catch (error) {
                        if (this.isSequenceConflict(error) && attempt < MAX_SEQUENCE_RETRIES) {
                            seq += 1;
                            continue;
                        }
                        throw error;
                    }
                }

                if (!created) {
                    throw new Error(`Failed to allocate unique sequence for beat "${beat.name || beat.title || 'Untitled'}"`);
                }

                scenesCreated.push(created);
            }
        }

        return { count: scenesCreated.length, scenes: scenesCreated };
    }
}

export const treatmentService = new TreatmentService();
