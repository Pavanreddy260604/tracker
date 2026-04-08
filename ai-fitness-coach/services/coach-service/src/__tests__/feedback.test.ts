import { FeedbackLog } from '../models/feedback_log';
import * as FeedbackService from '../services/feedback_service';

jest.mock('../models/feedback_log');

describe('FeedbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Property 1: logClosedLoopEvent saves a new log', async () => {
    const mockSave = jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); });
    (FeedbackLog as any).mockImplementation((data: any) => ({
      ...data,
      save: mockSave
    }));

    const result = await FeedbackService.logClosedLoopEvent('user1', 'INPUT', { inputData: { test: 1 } });

    expect(result.userId).toBe('user1');
    expect(result.inputType).toBe('INPUT');
    expect(mockSave).toHaveBeenCalled();
  });

  it('Property 2: updateFeedback adjusts memory on low satisfaction', async () => {
    const mockLog = {
      _id: 'log123',
      userId: 'user1',
      decision: 'suggest_squat',
      save: jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); }),
      userResponse: '',
      satisfaction: 0,
      memoryUpdate: null
    };
    (FeedbackLog.findById as jest.Mock).mockResolvedValue(mockLog);

    const result = await FeedbackService.updateFeedback('log123', 'too hard', 1);

    expect(result?.satisfaction).toBe(1);
    expect(result?.userResponse).toBe('too hard');
    expect(result?.memoryUpdate).toBeDefined();
    expect(result?.memoryUpdate.adjustWeights).toBe(true);
  });
});
