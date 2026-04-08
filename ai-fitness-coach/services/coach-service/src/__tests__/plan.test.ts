import fc from 'fast-check';
import nock from 'nock';
import { getTodayOverview } from '../services/planService';

describe('Daily Plan Aggregation Logic', () => {
    const WORKOUT_URL = 'http://localhost:3002';
    const NUTRITION_URL = 'http://localhost:3003';

    beforeEach(() => {
        nock.cleanAll();
    });

    it('Property: Aggregation merges data correctly when both services are up', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    _id: fc.string(),
                    status: fc.constant('active'),
                    exercises: fc.array(fc.record({ exerciseId: fc.string() }))
                }),
                fc.record({
                    totals: fc.record({ calories: fc.float({ noNaN: true, noDefaultInfinity: true }) }),
                    remaining: fc.record({ calories: fc.float({ noNaN: true, noDefaultInfinity: true }) }),
                    suggestions: fc.array(fc.record({ name: fc.string() }))
                }),
                async (workoutData, nutritionData) => {
                    const date = new Date().toISOString().split('T')[0];
                    const token = 'fake-token';

                    nock(WORKOUT_URL)
                        .get('/api/v1/sessions/active')
                        .reply(200, workoutData);

                    nock(NUTRITION_URL)
                        .get(`/api/v1/nutrition/summary/${date}`)
                        .reply(200, nutritionData);

                    const plan = await getTodayOverview('user123', token);

                    expect(plan.workout.active).toBe(workoutData._id);
                    expect(plan.nutrition.summary).toEqual(nutritionData);
                }
            )
        );
    });

    it('Property: Aggregation handles service failures gracefully', async () => {
        nock(WORKOUT_URL)
            .get('/api/v1/sessions/active')
            .reply(500, { error: 'Internal Server Error' });

        nock(NUTRITION_URL)
            .get(new RegExp('/api/v1/nutrition/summary/.*'))
            .reply(200, { totals: { calories: 1500 } });

        const plan = await getTodayOverview('user123', 'token');

        expect(plan.workout.session.status).toBe('unavailable');
        expect(plan.nutrition.summary.totals.calories).toBe(1500);
    });
});
