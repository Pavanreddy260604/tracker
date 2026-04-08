import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as reportService from '../services/ReportService';

export const getWeeklyReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }

  try {
    const report = await reportService.generateWeeklyReport(userId);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ message: 'Error generating weekly report', error: error.message });
  }
};

export const getProgressStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }

  try {
    const report = await reportService.generateWeeklyReport(userId);
    res.json({ status: report.status });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching progress status', error: error.message });
  }
};
