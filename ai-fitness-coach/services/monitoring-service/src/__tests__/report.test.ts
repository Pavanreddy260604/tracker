import axios from 'axios';
import * as ReportService from '../services/ReportService';
import { UserMetric } from '../models/Metric';
import * as metricService from '../services/MetricService';

jest.mock('axios');
jest.mock('../models/Metric');
jest.mock('../services/MetricService');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SERVICE_URL = 'http://auth';
    process.env.WORKOUT_SERVICE_URL = 'http://workout';
    process.env.NUTRITION_SERVICE_URL = 'http://nutrition';
  });

  it('Property 1: generateWeeklyReport aggregates data correctly', async () => {
    // Mock metric history (Weight change)
    (metricService.getMetricHistory as jest.Mock).mockResolvedValue([
      { value: 88, timestamp: new Date() },
      { value: 88, timestamp: new Date() },
      { value: 88, timestamp: new Date() },
      { value: 88, timestamp: new Date() },
      { value: 88, timestamp: new Date() },
      { value: 88, timestamp: new Date() },
      { value: 88, timestamp: new Date() },
      { value: 90, timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }
    ]);

    // Mock Service-to-Service calls
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('internal/auth/streak')) {
        return Promise.resolve({ data: { current: 5, longest: 10 } });
      }
      if (url.includes('internal/workout-volume')) {
        return Promise.resolve({ data: { totalVolume: 5000, sessionCount: 3 } });
      }
      if (url.includes('internal/nutrition-adherence')) {
        return Promise.resolve({ data: { avgCalories: 2000, daysLogged: 6 } });
      }
      return Promise.reject(new Error('URL not mocked'));
    });

    const report = await ReportService.generateWeeklyReport('user123');

    expect(report.metrics.weightChange).toBe(-2);
    expect(report.workoutSummary.totalVolume).toBe(5000);
    expect(report.nutritionSummary.daysLogged).toBe(6);
    expect(report.streak.current).toBe(5);
    expect(report.status).toBe('progressing'); 
  });

  it('Property 2: detectProgressStatus handles stagnant status', async () => {
     (metricService.getMetricHistory as jest.Mock).mockResolvedValue([
        { value: 80, timestamp: new Date() },
        { value: 80, timestamp: new Date() }
     ]);

    mockedAxios.get.mockResolvedValue({ data: { totalVolume: 0 } }); 

    const report = await ReportService.generateWeeklyReport('user123');
    // weightChange 0, totalVolume 0 -> stagnant (based on current logic)
    // Wait, let's check the logic: if (totalVolume > 0) return progressing. else if (Math.abs(weightChange) < 0.2 && totalVolume === 0) return stagnant.
    expect(report.status).toBe('stagnant');
  });
});
