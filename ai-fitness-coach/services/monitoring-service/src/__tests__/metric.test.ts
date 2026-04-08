import { UserMetric } from '../models/Metric';
import * as MetricService from '../services/MetricService';

jest.mock('../models/Metric');

describe('MetricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Property 1: logMetric saves a new metric entry', async () => {
    const mockSave = jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); });
    (UserMetric as any).mockImplementation((data: any) => ({
      ...data,
      save: mockSave
    }));

    const result = await MetricService.logMetric('user123', 'weight', 85.5, 'kg');

    expect(result.userId).toBe('user123');
    expect(result.type).toBe('weight');
    expect(result.value).toBe(85.5);
    expect(mockSave).toHaveBeenCalled();
  });

  it('Property 2: getHistory returns metrics sorted by date', async () => {
    const mockMetrics = [
      { userId: 'u1', type: 'weight', value: 85, timestamp: new Date('2026-04-01') },
      { userId: 'u1', type: 'weight', value: 84, timestamp: new Date('2026-04-02') }
    ];
    (UserMetric.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockMetrics)
    });

    const result = await MetricService.getHistory('u1', 'weight');

    expect(result.length).toBe(2);
    expect(result[0].value).toBe(85);
    expect(UserMetric.find).toHaveBeenCalledWith({ userId: 'u1', type: 'weight' });
  });
});
