import fc from 'fast-check';
import { getNutritionSummary, getQuickAddFoods } from '../services/nutritionService';
import { NutritionLog } from '../models/nutrition_log';
import { FoodItem } from '../models/food_item';

jest.mock('../models/nutrition_log');
jest.mock('../models/food_item');

describe('Advanced Nutrition Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (FoodItem.find as jest.Mock).mockReturnValue({ 
            limit: jest.fn().mockResolvedValue([]) 
        });
    });

    it('Property: Remaining macros calculation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    calories: fc.float({ min: 1000, max: 4000, noNaN: true }),
                    protein: fc.float({ min: 50, max: 300, noNaN: true }),
                    carbohydrates: fc.float({ min: 100, max: 500, noNaN: true }),
                    fats: fc.float({ min: 30, max: 150, noNaN: true })
                }),
                fc.record({
                    calories: fc.float({ min: 0, max: 2000, noNaN: true }),
                    protein: fc.float({ min: 0, max: 100, noNaN: true }),
                    carbohydrates: fc.float({ min: 0, max: 200, noNaN: true }),
                    fats: fc.float({ min: 0, max: 80, noNaN: true })
                }),
                async (targets, totals) => {
                    (NutritionLog.findOne as jest.Mock).mockResolvedValue({ totals });

                    const summary = await getNutritionSummary('user123', new Date(), targets);

                    expect(summary.remaining.calories).toBeCloseTo(targets.calories - totals.calories, 1);
                    expect(summary.remaining.protein).toBeCloseTo(targets.protein - totals.protein, 1);
                }
            )
        );
    });

    it('Property: Protein suggestions trigger at 80% threshold', async () => {
        const targets = { calories: 2000, protein: 100, carbohydrates: 200, fats: 60 };
        
        // Case 1: Protein at 70% (Below 80%)
        (NutritionLog.findOne as jest.Mock).mockResolvedValue({ totals: { protein: 70, calories: 1400, carbohydrates: 100, fats: 40 } });
        const mockFood = { name: 'Chicken', macros: { protein: 25 } };
        (FoodItem.find as jest.Mock).mockReturnValue({ limit: jest.fn().mockResolvedValue([mockFood]) });

        const summary1 = await getNutritionSummary('u1', new Date(), targets);
        expect(summary1.suggestions.length).toBeGreaterThan(0);

        // Case 2: Protein at 90% (Above 80%)
        (NutritionLog.findOne as jest.Mock).mockResolvedValue({ totals: { protein: 90, calories: 1800, carbohydrates: 150, fats: 50 } });
        const summary2 = await getNutritionSummary('u1', new Date(), targets);
        expect(summary2.suggestions.length).toBe(0);
    });

    it('Property: Quick-add returns foods logged 3+ times', async () => {
        const mockFrequentIds = [{ _id: 'food1', count: 5 }, { _id: 'food2', count: 3 }];
        (NutritionLog.aggregate as jest.Mock).mockResolvedValue(mockFrequentIds);
        
        const mockFoods = [{ _id: 'food1', name: 'Eggs' }, { _id: 'food2', name: 'Oats' }];
        (FoodItem.find as jest.Mock).mockResolvedValue(mockFoods);

        const result = await getQuickAddFoods('user123');

        expect(result.length).toBe(2);
        expect(result[0].name).toBe('Eggs');
        expect(NutritionLog.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ $match: expect.objectContaining({ count: { $gte: 3 } }) })
        ]));
    });
});
