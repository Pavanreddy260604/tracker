import * as nutritionService from '../services/nutritionService';
import { logEntry } from '../controllers/nutritionController';
import { signalActivity } from '../utils/activitySignaler';
import { signalEvent } from '../utils/eventSignaler';
import { Response } from 'express';

jest.mock('../services/nutritionService');
jest.mock('../utils/activitySignaler');
jest.mock('../utils/eventSignaler');

describe('Nutrition Controller Signals', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      user: { userId: 'user123' },
      headers: { authorization: 'Bearer test-token' },
      body: { date: '2026-04-08', entryData: { food: 'Apple' } }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    } as unknown as Response;
  });

  it('Property 1: logEntry signals activity and closed-loop event', async () => {
    (nutritionService.logNutritionEntry as jest.Mock).mockResolvedValue({ _id: 'log1' });

    await logEntry(mockRequest, mockResponse);

    expect(signalActivity).toHaveBeenCalledWith('test-token');
    expect(signalEvent).toHaveBeenCalledWith('user123', 'INPUT', expect.objectContaining({ 
      entryData: expect.objectContaining({ food: 'Apple' }) 
    }));
    expect(mockResponse.status).toHaveBeenCalledWith(201);
  });
});
