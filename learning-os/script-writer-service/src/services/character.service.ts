import { Character, ICharacter } from '../models/Character';
import { VoiceSample } from '../models/VoiceSample';
import mongoose from 'mongoose';

export class CharacterService {

    /**
     * Create a new character for a bible (project).
     */
    async createCharacter(data: Partial<ICharacter>): Promise<ICharacter> {
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
        return await Character.findByIdAndUpdate(id, updates, { new: true });
    }

    /**
     * Delete a character and unlink their voice samples.
     */
    async deleteCharacter(id: string): Promise<boolean> {
        // Try to use a transaction if possible, but fall back if standalone instance
        const client = mongoose.connection.getClient();
        const supportsTransactions = client.topology?.description?.type !== 'Single';

        if (!supportsTransactions) {
            // Standalone instance: Delete sequentially without session
            const result = await Character.findByIdAndDelete(id);
            if (!result) return false;
            await VoiceSample.updateMany(
                { characterId: id },
                { $unset: { characterId: "" } }
            );
            return true;
        }

        // Replica set or Mongos: Use transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
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
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}

export const characterService = new CharacterService();
