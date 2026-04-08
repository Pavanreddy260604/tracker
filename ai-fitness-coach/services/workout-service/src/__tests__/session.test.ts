import fc from 'fast-check';
import { startSession, logSet, completeSession } from '../services/sessionService';
import { WorkoutSession } from '../models/workout_session';
import { WorkoutPlan } from '../models/workout_plan';

jest.mock('../models/workout_session');
jest.mock('../models/workout_plan');
jest.mock('../services/progressionService');

describe('Workout Session Execution Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Property 9: Session starts with all planned exercises', async () => {
        const mockPlan = {
            _id: 'plan123',
            userId: 'user123',
            days: [{
                dayOfWeek: 1,
                exercises: [
                    { exerciseId: 'ex1', sets: 3 },
                    { exerciseId: 'ex2', sets: 4 }
                ]
            }]
        };
        (WorkoutPlan.findOne as jest.Mock).mockResolvedValue(mockPlan);

        const mockSave = jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); });
        (WorkoutSession as any).mockImplementation((data: any) => ({
            ...data,
            save: mockSave
        }));

        const session = await startSession('user123', 'plan123', 1);

        expect(session.exercises.length).toBe(2);
        expect(session.exercises[0].exerciseId).toBe('ex1');
        expect(session.exercises[0].plannedSets).toBe(3);
        expect(session.status).toBe('active');
    });

    it('Property 11: RPE-based weight adjustment suggestions', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: 10, max: 200, noNaN: true }), // weight
                fc.integer({ min: 1, max: 30 }), // reps
                fc.constantFrom(1, 5), // difficulty rating (RPE)
                async (weight, reps, difficultyRating) => {
                    const mockSession = {
                        _id: 'session123',
                        status: 'active',
                        exercises: [{
                            exerciseId: 'ex1',
                            sets: [],
                            save: jest.fn().mockResolvedValue(true)
                        }],
                        save: jest.fn().mockResolvedValue(true)
                    };
                    (WorkoutSession.findById as jest.Mock).mockResolvedValue(mockSession);

                    const { suggestion } = await logSet('session123', 'ex1', {
                        weight,
                        reps,
                        difficultyRating
                    });

                    if (difficultyRating === 5) {
                        const expectedWeight = Number((weight * 0.9).toFixed(1));
                        expect(suggestion).toContain(`Suggest reducing weight to ${expectedWeight}kg`);
                    } else if (difficultyRating === 1) {
                        const expectedWeight = Number((weight * 1.05).toFixed(1));
                        expect(suggestion).toContain(`Suggest increasing weight to ${expectedWeight}kg`);
                    }
                }
            )
        );
    });

    it('Property 10: Total volume calculation on completion', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        weight: fc.float({ min: 1, max: 200, noNaN: true }),
                        reps: fc.integer({ min: 1, max: 20 })
                    }),
                    { minLength: 1, maxLength: 5 }
                ),
                async (sets) => {
                    const mockSession: any = {
                        _id: 'session123',
                        status: 'active',
                        exercises: [{
                            exerciseId: 'ex1',
                            sets: sets.map((s, i) => ({ ...s, setNumber: i + 1 }))
                        }],
                        save: jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); })
                    };
                    (WorkoutSession.findById as jest.Mock).mockResolvedValue(mockSession);

                    const completedSession = await completeSession('session123', { rating: 5 });

                    const expectedVolume = sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                    expect(completedSession.totalVolume).toBeCloseTo(expectedVolume, 2);
                    expect(completedSession.status).toBe('completed');
                }
            )
        );
    });
});
