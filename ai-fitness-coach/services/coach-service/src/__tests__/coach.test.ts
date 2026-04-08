import fc from 'fast-check';
import * as coachService from '../services/coachService';
import * as planService from '../services/planService';
import * as llmClient from '../utils/llmClient';
import { CoachConversation } from '../models/coach_conversation';

jest.mock('../services/planService');
jest.mock('../utils/llmClient');
jest.mock('../models/coach_conversation');

describe('Coach Engine Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Property: Context includes daily overview data', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 5 }), // query
                async (query) => {
                    const date = '2026-04-06';
                    (planService.getTodayOverview as jest.Mock).mockResolvedValue({
                        date,
                        workout: { message: 'WORKOUT_MSG' },
                        nutrition: { message: 'NUTRITION_MSG', summary: { totals: { calories: 100 } } }
                    });
                    (llmClient.callLLM as jest.Mock).mockResolvedValue('Mock Response');
                    (CoachConversation.findOne as jest.Mock).mockResolvedValue({
                        messages: [],
                        context: { referencedExercises: [] },
                        save: jest.fn().mockResolvedValue({})
                    });

                    await coachService.askCoach('u1', 's1', query, 'token');

                    const lastCall = (llmClient.callLLM as jest.Mock).mock.calls[0][0];
                    const systemPrompt = lastCall[0].content;

                    expect(systemPrompt).toContain('You are an AI Fitness Coach');
                    expect(systemPrompt).toContain(date);
                    expect(systemPrompt).toContain('WORKOUT_MSG');
                    expect(systemPrompt).toContain('NUTRITION_MSG');
                }
            )
        );
    });

    it('Property: History is truncated to last 5 messages', async () => {
        const manyMessages = Array(10).fill({ role: 'user', content: 'hello' });
        (planService.getTodayOverview as jest.Mock).mockResolvedValue({ date: '2026-04-06', workout: {}, nutrition: {} });
        (llmClient.callLLM as jest.Mock).mockResolvedValue('Mock Response');
        (CoachConversation.findOne as jest.Mock).mockResolvedValue({
            messages: manyMessages,
            context: { referencedExercises: [] },
            save: jest.fn().mockResolvedValue({})
        });

        await coachService.askCoach('u1', 's1', 'new query', 'token');

        const lastCall = (llmClient.callLLM as jest.Mock).mock.calls[0][0];
        // 1 system prompt + 5 history + 1 new query = 7 total messages
        expect(lastCall.length).toBe(7);
        expect(lastCall[0].role).toBe('system');
    });
});
