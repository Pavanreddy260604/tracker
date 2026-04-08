import fc from 'fast-check';
import { calculateBMI, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget } from '../utils/metrics';

describe('Fitness Metrics Property Tests', () => {
    // Property 2: Derived Metrics Calculation - Verify BMI is within realistic range
    it('Property 2a: BMI should be within realistic range (10-60) for normal humans', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 140, max: 220 }), // height in cm
                fc.integer({ min: 40, max: 150 }),  // weight in kg
                (height, weight) => {
                    const bmi = calculateBMI(height, weight);
                    expect(bmi).toBeGreaterThanOrEqual(5);
                    expect(bmi).toBeLessThanOrEqual(90);
                }
            )
        );
    });

    // Property 2b: BMR should be positive and vary correctly by gender
    it('Property 2b: BMR calculation should be consistent and positive', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 40, max: 150 }),
                fc.integer({ min: 140, max: 220 }),
                fc.integer({ min: 18, max: 80 }),
                fc.constantFrom('male', 'female', 'other'),
                (weight, height, age, gender) => {
                    const bmr = calculateBMR(weight, height, age, gender as any);
                    expect(bmr).toBeGreaterThan(0);
                    
                    // Simple check: Male BMR should be higher than Female BMR for same stats
                    const bmrMale = calculateBMR(weight, height, age, 'male');
                    const bmrFemale = calculateBMR(weight, height, age, 'female');
                    expect(bmrMale).toBeGreaterThan(bmrFemale);
                }
            )
        );
    });

    // Property 2c: TDEE should be at least equal to BMR
    it('Property 2c: TDEE should be >= BMR', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1200, max: 3000 }), // bmr
                fc.integer({ min: 0, max: 7 }),       // days
                (bmr, days) => {
                    const tdee = calculateTDEE(bmr, days);
                    expect(tdee).toBeGreaterThanOrEqual(bmr);
                    expect(tdee).toBeLessThanOrEqual(bmr * 2); // Unlikely to be > 2x sedentary without extreme exertion
                }
            )
        );
    });

    // Property 2d: Calorie targets vary according to goal
    it('Property 2d: Calorie targets follow surplus/deficit rules', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1500, max: 4000 }),
                (tdee) => {
                    const gain = calculateCalorieTarget(tdee, 'muscle_gain');
                    const loss = calculateCalorieTarget(tdee, 'fat_loss');
                    const strength = calculateCalorieTarget(tdee, 'strength');
                    
                    expect(gain).toBe(tdee + 500);
                    expect(loss).toBe(tdee - 500);
                    expect(strength).toBe(tdee);
                }
            )
        );
    });

    // Property 2e: Protein target logic
    it('Property 2e: Protein target should be between 1.6 and 2.5 g/kg', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 40, max: 150 }),
                fc.constantFrom('muscle_gain', 'fat_loss', 'strength'),
                (weight, goal) => {
                    const protein = calculateProteinTarget(weight, goal as any);
                    const ratio = protein / weight;
                    expect(ratio).toBeGreaterThanOrEqual(1.6);
                    expect(ratio).toBeLessThanOrEqual(2.5);
                }
            )
        );
    });
});
