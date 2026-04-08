import fc from 'fast-check';
import { recordSessionCompletion, getRecommendedWeight } from '../services/progressionService';
import { ProgressionHistory } from '../models/progression_history';
import { WorkoutSession } from '../models/workout_session';

jest.mock('../models/progression_history');
jest.mock('../models/workout_session');

describe('Progression Engine Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Property 14: Two consecutive successes triggers progression', async () => {
        const userId = 'user123';
        const exerciseId = 'ex1';
        const weight = 100;

        // Current session (Success)
        const mockSession = {
            _id: 'session123',
            userId,
            status: 'completed',
            endTime: new Date(),
            exercises: [{
                exerciseId,
                plannedSets: 3,
                sets: [
                    { reps: 10, weight },
                    { reps: 10, weight },
                    { reps: 10, weight }
                ],
                skipped: false
            }]
        };
        (WorkoutSession.findById as jest.Mock).mockResolvedValue(mockSession);

        // Previous history (1 Success at same weight)
        (ProgressionHistory.find as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([{
                    userId,
                    exerciseId,
                    weight,
                    progressionApplied: false,
                    plateauDetected: false
                }])
            })
        });

        const mockCreate = jest.fn().mockResolvedValue(true);
        (ProgressionHistory.create as jest.Mock).mockImplementation(mockCreate);

        await recordSessionCompletion('session123');

        // Verify that progressionApplied was true in the created record
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            progressionApplied: true,
            progressionAmount: 2.5
        }));
    });

    it('Property 15: Plateau detection after 3 consecutive failures', async () => {
        const userId = 'user123';
        const exerciseId = 'ex1';

        // Current session (Failure - missed reps or fewer sets)
        const mockSession = {
            _id: 'session123',
            userId,
            status: 'completed',
            exercises: [{
                exerciseId,
                plannedSets: 3,
                sets: [
                    { reps: 5, weight: 100 } // only 1 set completed
                ],
                skipped: false
            }]
        };
        (WorkoutSession.findById as jest.Mock).mockResolvedValue(mockSession);

        // History shows 2 previous failures
        (ProgressionHistory.find as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([
                    { progressionApplied: false, plateauDetected: false }, // Failure 1
                    { progressionApplied: false, plateauDetected: false }  // Failure 2
                ])
            })
        });

        const mockCreate = jest.fn().mockResolvedValue(true);
        (ProgressionHistory.create as jest.Mock).mockImplementation(mockCreate);

        await recordSessionCompletion('session123');

        // Verify plateauDetected was true in the created record
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            plateauDetected: true
        }));
    });

    it('Property 16: Volume calculation in progression history', async () => {
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
                   const mockSession = {
                        _id: 'session123',
                        userId: 'u1',
                        status: 'completed',
                        exercises: [{
                            exerciseId: 'ex1',
                            plannedSets: 3,
                            sets: sets,
                            skipped: false
                        }]
                    };
                    (WorkoutSession.findById as jest.Mock).mockResolvedValue(mockSession);
                    (ProgressionHistory.find as jest.Mock).mockReturnValue({
                        sort: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([])
                        })
                    });

                    const mockCreate = jest.fn().mockResolvedValue(true);
                    (ProgressionHistory.create as jest.Mock).mockImplementation(mockCreate);

                    await recordSessionCompletion('session123');

                    const expectedVolume = sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                        totalVolume: expectedVolume
                    }));
                }
            )
        );
    });
});
