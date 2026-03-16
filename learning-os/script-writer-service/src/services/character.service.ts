import { Character, ICharacter } from '../models/Character';
import { VoiceSample } from '../models/VoiceSample';
import mongoose from 'mongoose';

export class CharacterService {

    /**
     * Create a new character for a bible (project).
     */
    async createCharacter(data: Partial<ICharacter>): Promise<ICharacter> {
        if (data.name && data.bibleId) {
            const existing = await Character.findOne({
                bibleId: data.bibleId,
                name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') }
            });
            if (existing) {
                throw new Error(`A character named "${data.name}" already exists in this project.`);
            }
        }
        const character = new Character(data);
        return await character.save();
    }

    /**
     * Get all characters for a specific bible.
     */
    async getCharactersByBible(bibleId: string): Promise<ICharacter[]> {
        return await Character.find({ bibleId }).sort({ name: 1 });
    }

    /**
     * Get a single character by ID.
     */
    async getCharacter(id: string): Promise<ICharacter | null> {
        return await Character.findById(id);
    }

    /**
     * Update a character.
     */
    async updateCharacter(id: string, updates: Partial<ICharacter>): Promise<ICharacter | null> {
        if (updates.name) {
            const character = await Character.findById(id);
            if (character && updates.name.toLowerCase() !== character.name.toLowerCase()) {
                const existing = await Character.findOne({
                    bibleId: character.bibleId,
                    name: { $regex: new RegExp(`^${updates.name.trim()}$`, 'i') },
                    _id: { $ne: id }
                });
                if (existing) {
                    throw new Error(`A character named "${updates.name}" already exists in this project.`);
                }
            }
        }
        return await Character.findByIdAndUpdate(id, updates, { new: true });
    }

    /**
     * Delete a character and unlink their voice samples.
     */
    async deleteCharacter(id: string): Promise<boolean> {
        // Prefer transaction, but gracefully fall back for standalone MongoDB.
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const result = await Character.findByIdAndDelete(id).session(session);
            if (!result) {
                await session.abortTransaction();
                return false;
            }

            await VoiceSample.updateMany(
                { characterId: id },
                { $unset: { characterId: "" } }
            ).session(session);

            await session.commitTransaction();
            return true;
        } catch (error) {
            await session.abortTransaction().catch(() => undefined);

            if (this.isTransactionUnsupported(error)) {
                const result = await Character.findByIdAndDelete(id);
                if (!result) return false;
                await VoiceSample.updateMany(
                    { characterId: id },
                    { $unset: { characterId: "" } }
                );
                return true;
            }

            throw error;
        } finally {
            session.endSession();
        }
    }

    private isTransactionUnsupported(error: unknown): boolean {
        if (!(error instanceof Error)) return false;
        return (
            error.message.includes('Transaction numbers are only allowed on a replica set member') ||
            error.message.includes('Transaction support is not available')
        );
    }
}

export const characterService = new CharacterService();
