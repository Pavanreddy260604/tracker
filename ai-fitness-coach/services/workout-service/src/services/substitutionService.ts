import { Exercise, IExercise } from '../models/exercise';
import { SubstitutionPreference } from '../models/substitution_preference';

const DEFAULT_LOAD_FACTORS: Record<string, Record<string, number>> = {
    'barbell': { 'dumbbell': 0.8, 'machine': 1.2, 'bodyweight': 0.5 },
    'dumbbell': { 'barbell': 1.25, 'machine': 1.5, 'bodyweight': 0.6 },
    'machine': { 'barbell': 0.8, 'dumbbell': 0.7, 'bodyweight': 0.4 },
    'bodyweight': { 'barbell': 2.0, 'dumbbell': 1.6, 'machine': 2.5 }
};

export const getAlternatives = async (
    exerciseId: string, 
    userId: string,
    userEquipment: string[] = []
): Promise<{ exercise: IExercise; similarityScore: number; suggestedWeight: number }[]> => {
    const originalExercise = await Exercise.findById(exerciseId);
    if (!originalExercise) throw new Error('Original exercise not found');

    const alternatives = await Exercise.find({
        movementPattern: originalExercise.movementPattern,
        _id: { $ne: exerciseId }
    });

    const userPrefs = await SubstitutionPreference.find({ userId, originalExerciseId: exerciseId });
    const prefScores = new Map(userPrefs.map(p => [p.preferredSubstituteId, p.count]));

    const mappedAlternatives = alternatives.map(ex => {
        let score = 0;
        
        // 1. User Preference Score
        score += (prefScores.get(ex._id.toString()) || 0) * 10;

        // 2. Muscle Similarity
        const primaryMatch = ex.primaryMuscles.filter(m => originalExercise.primaryMuscles.includes(m)).length;
        score += primaryMatch * 5;

        // 3. Equipment match
        const hasEquipment = ex.equipment.every(e => userEquipment.includes(e));
        if (hasEquipment) score += 5;

        return {
            exercise: ex,
            similarityScore: score,
            suggestedWeight: 0 // Will calculate below
        };
    });

    // Rank by score
    mappedAlternatives.sort((a, b) => b.similarityScore - a.similarityScore);

    // Calculate weight for top 5
    const topResults = mappedAlternatives.slice(0, 5);
    for (const res of topResults) {
        res.suggestedWeight = calculateSubstituteWeight(100, originalExercise, res.exercise); // Using 100 as base% or default
    }

    return topResults;
};

export const calculateSubstituteWeight = (
    originalWeight: number,
    fromEx: IExercise,
    toEx: IExercise
): number => {
    const fromEquip = fromEx.equipment[0] || 'bodyweight';
    const toEquip = toEx.equipment[0] || 'bodyweight';

    const factor = DEFAULT_LOAD_FACTORS[fromEquip]?.[toEquip] || 1.0;
    return Number((originalWeight * factor).toFixed(1));
};

export const recordPreference = async (userId: string, originalId: string, substituteId: string): Promise<void> => {
    await SubstitutionPreference.findOneAndUpdate(
        { userId, originalExerciseId: originalId, preferredSubstituteId: substituteId },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
    );
};
