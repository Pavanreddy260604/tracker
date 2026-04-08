import { FeedbackLog, IFeedbackLog } from '../models/feedback_log';

export const logClosedLoopEvent = async (
  userId: string,
  eventType: 'INPUT' | 'DECISION' | 'FEEDBACK',
  data: {
    inputData?: any;
    analysisResult?: any;
    decision?: string;
    reasoning?: string;
    action?: any;
    userResponse?: string;
    satisfaction?: number;
  }
): Promise<IFeedbackLog> => {
  const log = new FeedbackLog({
    userId,
    inputType: eventType,
    ...data,
    timestamp: new Date()
  });

  return log.save();
};

export const updateFeedback = async (
  logId: string,
  userResponse: string,
  satisfaction: number
): Promise<IFeedbackLog | null> => {
  const log = await FeedbackLog.findById(logId);
  if (!log) return null;

  log.userResponse = userResponse;
  log.satisfaction = satisfaction;

  // Potential Memory Update Logic
  if (satisfaction < 3 && log.decision) {
    // Flag this decision for review or adjust weights
    log.memoryUpdate = { adjustWeights: true, reason: 'Low satisfaction' };
  }

  return log.save();
};
