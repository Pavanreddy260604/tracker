import fc from 'fast-check';
import { getAlternatives, calculateSubstituteWeight, recordPreference } from '../services/substitutionService';
import { Exercise } from '../models/exercise';
import { SubstitutionPreference } from '../models/substitution_preference';

jest.mock('../models/exercise');
jest.mock('../models/substitution_preference');

describe('Exercise Substitution Engine Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Property 18: Weight Conversion from Barbell to Dumbbell (0.8x)
    it('Property 18: Weight conversion from Barbell to Dumbbell should apply 0.8x factor', () => {
        const fromEx: any = { equipment: ['barbell'] };
        const toEx: any = { equipment: ['dumbbell'] };
        const weight = 100;

        const result = calculateSubstituteWeight(weight, fromEx, toEx);
        expect(result).toBe(80);
    });

    // Property 17: Alternatives share movement pattern
    it('Property 17: Substitutes should always share the same movement pattern', async () => {
        const originalEx: any = { 
            _id: 'ex1', 
            movementPattern: 'Push', 
            primaryMuscles: ['Chest'],
            equipment: ['barbell']
        };
        (Exercise.findById as jest.Mock).mockResolvedValue(originalEx);

        const alternatives: any[] = [
            { _id: 'ex2', movementPattern: 'Push', primaryMuscles: ['Chest'], equipment: ['dumbbell'] },
            { _id: 'ex3', movementPattern: 'Push', primaryMuscles: ['Chest'], equipment: ['machine'] }
        ];
        (Exercise.find as jest.Mock).mockResolvedValue(alternatives);
        (SubstitutionPreference.find as jest.Mock).mockResolvedValue([]);

        const results = await getAlternatives('ex1', 'user123');

        expect(results.length).toBeGreaterThan(0);
        results.forEach(res => {
            expect(res.exercise.movementPattern).toBe('Push');
        });
    });

    // Property 19: Substitution Learning - recording preference boosts score
    it('Property 19: Preferred substitutes should rank higher after choice recorded', async () => {
        const originalEx: any = { _id: 'ex1', movementPattern: 'Squat', primaryMuscles: ['Legs'], equipment: ['barbell'] };
        (Exercise.findById as jest.Mock).mockResolvedValue(originalEx);

        const altA: any = { _id: 'alt_a', movementPattern: 'Squat', primaryMuscles: ['Legs'], equipment: ['dumbbell'] };
        const altB: any = { _id: 'alt_b', movementPattern: 'Squat', primaryMuscles: ['Legs'], equipment: ['machine'] };
        (Exercise.find as jest.Mock).mockResolvedValue([altA, altB]);

        // Mock preferences: alt_b has been chosen twice
        (SubstitutionPreference.find as jest.Mock).mockResolvedValue([{ preferredSubstituteId: 'alt_b', count: 2 }]);

        const results = await getAlternatives('ex1', 'user123');

        // alt_b should be first due to score boost
        expect(results[0].exercise._id).toBe('alt_b');
        expect(results[0].similarityScore).toBeGreaterThan(results[1].similarityScore);
    });

    // Property 18: Weight Conversion across multiple equipment types
    it('Property 18: Weight conversion should handle various equipment mappings correctly', () => {
        const barbell: any = { equipment: ['barbell'] };
        const machine: any = { equipment: ['machine'] };
        const bodyweight: any = { equipment: ['bodyweight'] };

        expect(calculateSubstituteWeight(100, barbell, machine)).toBe(120);
        expect(calculateSubstituteWeight(100, machine, barbell)).toBe(80);
        expect(calculateSubstituteWeight(10, bodyweight, barbell)).toBe(20);
    });
});
