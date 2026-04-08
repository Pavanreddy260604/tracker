import fc from 'fast-check';
import { logNutritionEntry } from '../services/nutritionService';
import { NutritionLog } from '../models/nutrition_log';

// Mock the model
jest.mock('../models/nutrition_log');

describe('Nutrition Totals Summation Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Property 7: Calorie/Macro Summation - Verify daily totals match sum of entries
    it('Property 7: Daily totals should match the sum of all entries', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        description: fc.string(),
                        calories: fc.float({ min: 0, max: 1000, noNaN: true }),
                        protein: fc.float({ min: 0, max: 100, noNaN: true }),
                        carbohydrates: fc.float({ min: 0, max: 200, noNaN: true }),
                        fats: fc.float({ min: 0, max: 100, noNaN: true }),
                        servings: fc.integer({ min: 1, max: 5 })
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                async (entries) => {
                    let currentLog: any = null;

                    // Mock implementation of findOne and save to simulate DB behavior
                    (NutritionLog.findOne as jest.Mock).mockImplementation(() => Promise.resolve(currentLog));
                    (NutritionLog.prototype.save as jest.Mock).mockImplementation(function(this: any) {
                        currentLog = this;
                        return Promise.resolve(this);
                    });
                    
                    // We need to mock the constructor too because we use `new NutritionLog` in the service
                    (NutritionLog as any).mockImplementation((data: any) => {
                        const instance = {
                            ...data,
                            save: jest.fn().mockImplementation(function(this: any) {
                                currentLog = this;
                                return Promise.resolve(this);
                            })
                        };
                        return instance;
                    });

                    // Log each entry
                    for (const entry of entries) {
                        currentLog = await logNutritionEntry('user123', new Date('2026-01-01'), entry);
                    }

                    // Calculate expected totals
                    const expectedCalories = entries.reduce((sum, e) => sum + e.calories, 0);
                    const expectedProtein = entries.reduce((sum, e) => sum + e.protein, 0);

                    expect(currentLog.totals.calories).toBeCloseTo(expectedCalories, 1);
                    expect(currentLog.totals.protein).toBeCloseTo(expectedProtein, 1);
                }
            )
        );
    });
});
