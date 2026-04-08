import { Request, Response } from 'express';
import { AIServiceError } from '../services/aiClient.service.js';
import { isExecutionProviderError } from '../domain/interview.domain.js';
import * as interviewService from '../services/interview.service.js';
import { executionQueueService } from '../services/execution/executionQueue.service.js';
import { weightedScoringService } from '../services/evaluation/weightedScoring.service.js';
import { semanticSystemDesignEvaluator } from '../services/evaluation/semanticSystemDesign.service.js';
import { proctoringAttestationService } from '../services/proctoring/attestation.service.js';
import type { ProctoringEvent } from '../services/proctoring/attestation.service.js';
import { redis } from '../infrastructure/redis.js';
import { logger, interviewMetrics } from '../infrastructure/monitoring.js';
import {
  startInterviewSchema,
  submitSectionSchema,
  proctoringUpdateSchema,
  endInterviewSchema,
  submitCodeSchema,
  runCodeSchema,
  interviewChatSchema,
} from '../schemas/interview.schemas.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ServiceError extends Error {
  statusCode?: number;
}

const PROCTORING_EVENT_TYPES: ProctoringEvent['type'][] = [
  'tab_switch',
  'focus_loss',
  'fullscreen_exit',
  'mouse_idle',
  'key_pattern',
  'devtools_detected',
  'integrity_violation',
  'paste_detected',
  'automation_detected',
  'camera_lost',
  'audio_threshold_reached',
  'unknown',
];

const sendServiceError = (res: Response, error: unknown, fallbackMessage: string) => {
  const err = error as ServiceError;
  const statusCode = err.statusCode || 500;
  const message = err.message || fallbackMessage;
  res.status(statusCode).json({ success: false, error: message });
  
  logger.error(fallbackMessage, err as Error, {
    statusCode,
    path: res.req?.path
  });
};

async function getSessionWithSecret(sessionId: string, userId: string) {
  const session = await interviewService.getSession(sessionId, userId);
  const proctoringSecret = await proctoringAttestationService.generateSessionSecret(sessionId);
  return {
    ...session.toObject(),
    proctoringSecret
  };
}

const sendExecutionProviderFallback = (res: Response, error: unknown, customInput?: string | null) => {
  const message = error instanceof Error ? error.message : 'Code execution unavailable.';
  
  interviewMetrics.codeExecutionFailed.add(1);
  
  res.json({
    success: true,
    data: {
      status: 'error',
      score: 0,
      feedback: `### Execution Result\n${message}\n\nPlease retry after configuring the execution provider.`,
      summary: { passed: 0, total: 0 },
      testResults: customInput !== undefined
        ? [{ index: 0, input: typeof customInput === 'string' ? customInput : undefined, passed: false, error: message, isCustom: true }]
        : [],
    },
  });
};

// ─── Controllers ─────────────────────────────────────────────

export const startInterview = async (req: Request, res: Response): Promise<void> => {
  try {
    interviewMetrics.interviewStarted.add(1);
    
    const parsed = startInterviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    // Generate proctoring secret for session
    const session = await interviewService.startInterview({
      userId: req.userId!,
      ...parsed.data,
    });

    // Generate and store proctoring secret
    const proctoringSecret = await proctoringAttestationService.generateSessionSecret(session._id.toString());

    logger.audit('interview_started', {
      userId: req.userId,
      sessionId: session._id.toString(),
      sections: parsed.data.sectionsConfig?.length || 0
    });

    // Return session with proctoring secret (for client attestation)
    const sessionData = await getSessionWithSecret(session._id.toString(), req.userId!);
    
    res.json({ 
      success: true, 
      data: sessionData
    });
  } catch (error) {
    if (isExecutionProviderError(error)) {
      res.status(503).json({ 
        success: false, 
        error: 'Code execution service is temporarily unavailable. Please try again later.' 
      });
      return;
    }
    sendServiceError(res, error, 'Failed to start interview session');
  }
};

export const nextSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = await interviewService.nextSection(sessionId, req.userId!);
    
    logger.info('section_completed', {
      userId: req.userId,
      sessionId,
      sectionIndex: session.currentSectionIndex - 1
    });
    
    const sessionData = await getSessionWithSecret(sessionId, req.userId!);
    res.json({ success: true, data: sessionData });
  } catch (error) {
    sendServiceError(res, error, 'Failed to move to next section');
  }
};

export const submitSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = submitSectionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    // Calculate weighted scores before submission
    const session = await interviewService.getSession(sessionId, req.userId!);
    const currentSection = session.sections[session.currentSectionIndex];
    
    const sectionScoreResult = weightedScoringService.calculateSectionScore(
      currentSection,
      session.currentSectionIndex,
      session.sections.length
    );

    const updatedSession = await interviewService.submitSection(sessionId, req.userId!, parsed.data.answers);
    
    logger.info('section_submitted', {
      userId: req.userId,
      sessionId,
      sectionScore: sectionScoreResult.sectionScore,
      questionsAttempted: sectionScoreResult.questionScores.length
    });
    
    const sessionData = await getSessionWithSecret(sessionId, req.userId!);
    res.json({ 
      success: true, 
      data: sessionData
    });
  } catch (error) {
    sendServiceError(res, error, 'Failed to submit section');
  }
};

export const updateProctoring = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = proctoringUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    // Verify proctoring event attestation if provided
    if (parsed.data.clientProof) {
      const eventType = PROCTORING_EVENT_TYPES.includes((parsed.data.violationType || 'unknown') as ProctoringEvent['type'])
        ? (parsed.data.violationType || 'unknown') as ProctoringEvent['type']
        : 'unknown';
      const event: ProctoringEvent = {
        type: eventType,
        timestamp: parsed.data.timestamp || new Date().toISOString(),
        sessionId,
        clientProof: parsed.data.clientProof,
        sequenceNumber: parsed.data.sequenceNumber || 0
      };

      const isValid = await proctoringAttestationService.verifyEvent(event);
      
      if (!isValid) {
        logger.security('invalid_proctoring_attestation', {
          userId: req.userId,
          sessionId,
          eventType: event.type
        });
        
        res.status(400).json({ 
          success: false, 
          error: 'Invalid proctoring attestation' 
        });
        return;
      }

      // Assess violation severity
      const recentEvents = await getRecentProctoringEvents(sessionId);
      const assessment = await proctoringAttestationService.assessViolation(
        event,
        req.userId!,
        recentEvents
      );

      interviewMetrics.proctoringViolation.add(1, {
        type: event.type,
        severity: assessment.severity
      });

      logger.security('proctoring_violation', {
        userId: req.userId,
        sessionId,
        violationType: event.type,
        severity: assessment.severity,
        action: assessment.action
      });

      // If critical, terminate session
      if (assessment.action === 'terminate') {
        await interviewService.endInterview({
          userId: req.userId!,
          sessionId
        });
        
        interviewMetrics.interviewTerminated.add(1, {
          reason: 'proctoring_violation'
        });
      }
    }

    const session = await interviewService.updateProctoring(sessionId, req.userId!, parsed.data);
    res.json({ success: true, data: session });
  } catch (error) {
    sendServiceError(res, error, 'Failed to update proctoring data');
  }
};

async function getRecentProctoringEvents(sessionId: string): Promise<any[]> {
  const events = await redis.lrange(`proctoring:events:${sessionId}`, 0, 99);
  return events.map(e => JSON.parse(e));
}

export const updateDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { questionIndex, code, answer } = req.body;
    
    if (typeof questionIndex !== 'number' || questionIndex < 0) {
      res.status(400).json({ success: false, error: 'Invalid question index' });
      return;
    }

    const session = await interviewService.getSession(sessionId, req.userId!);
    const section = session.sections[session.currentSectionIndex];
    
    if (!section || !section.questions[questionIndex]) {
      res.status(404).json({ success: false, error: 'Question not found' });
      return;
    }

    // Update the question with draft data
    const question = section.questions[questionIndex];
    if (code !== undefined) {
      question.userCode = code;
    }
    if (answer !== undefined) {
      question.userAnswer = answer;
    }
    question.lastModified = new Date();

    await session.save();

    logger.info('draft_saved', {
      userId: req.userId,
      sessionId,
      questionIndex
    });

    res.json({ success: true, data: { message: 'Draft saved' } });
  } catch (error) {
    sendServiceError(res, error, 'Failed to save draft');
  }
};

export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const analytics = await interviewService.getAnalytics(sessionId, req.userId!);
    
    res.json({ success: true, data: analytics });
  } catch (error) {
    sendServiceError(res, error, 'Failed to get analytics');
  }
};

export const submitCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = submitCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { sessionId, questionIndex, code, userAnswer } = parsed.data;
    
    // Get session to determine question type
    const session = await interviewService.getSession(sessionId, req.userId!);
    const section = session.sections[session.currentSectionIndex];
    const question = section.questions[questionIndex];
    const testCases = question.testCases ?? [];

    // For system design questions, use semantic evaluation
    if (question.type === 'system-design' && userAnswer) {
      const evaluation = await semanticSystemDesignEvaluator.evaluate(
        userAnswer,
        {
          title: question.problemName,
          requirements: question.systemDesignParams?.requirements || [],
          constraints: {
            rps: typeof question.systemDesignParams?.constraints?.rps === 'number'
              ? question.systemDesignParams.constraints.rps
              : undefined,
            dataVolume: typeof question.systemDesignParams?.constraints?.dataVolume === 'string'
              ? question.systemDesignParams.constraints.dataVolume
              : undefined,
            latency: typeof question.systemDesignParams?.constraints?.latency === 'string'
              ? question.systemDesignParams.constraints.latency
              : undefined,
            availability: typeof question.systemDesignParams?.constraints?.availability === 'string'
              ? question.systemDesignParams.constraints.availability
              : undefined,
          },
          expectedComponents: question.systemDesignParams?.expectedComponents || [],
          rubric: (question.systemDesignParams?.scoringCriteria || []).map((criterion, index) => ({
            category: `criterion-${index + 1}`,
            weight: 1,
            description: criterion,
            semanticIndicators: [criterion],
          }))
        }
      );

      interviewMetrics.scoreDistribution.record(evaluation.overallScore);

      res.json({
        success: true,
        data: {
          status: evaluation.overallScore >= 70 ? 'pass' : 'fail',
          score: evaluation.overallScore,
          feedback: evaluation.feedback,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          grade: evaluation.grade,
          summary: {
            scores: evaluation.scores
          }
        }
      });
      return;
    }

    // For coding/SQL questions, use execution queue
    const jobId = await executionQueueService.enqueue(
      session.config.language || 'javascript',
      code || '',
      testCases.map(tc => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput
      })),
      sessionId,
      req.userId!,
      question.questionId?.toString() || 'unknown'
    );

    // Wait for result
    const result = await executionQueueService.waitForResult(jobId, 15000);

    interviewMetrics.codeExecuted.add(1, {
      language: session.config.language || 'javascript'
    });

    if (result.results) {
      const passedCount = result.results.filter(r => r.passed).length;
      const score = Math.round((passedCount / result.results.length) * 100);
      
      interviewMetrics.scoreDistribution.record(score);

      res.json({
        success: true,
        data: {
          status: score >= 70 ? 'pass' : 'fail',
          score,
          feedback: `Passed ${passedCount}/${result.results.length} test cases`,
          summary: {
            passed: passedCount,
            total: result.results.length
          },
          testResults: result.results.map((r, i) => ({
            index: i,
            input: r.testCaseIndex,
            expected: testCases[i]?.expectedOutput,
            actual: r.actualOutput,
            passed: r.passed,
            error: r.stderr || undefined
          }))
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Execution failed'
      });
    }
  } catch (error) {
    if (isExecutionProviderError(error)) {
      sendExecutionProviderFallback(res, error);
      return;
    }
    sendServiceError(res, error, 'Evaluation failed');
  }
};

export const runCodeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = runCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { sessionId, questionIndex, code, customInput } = parsed.data;
    
    // Get session for question info
    const session = await interviewService.getSession(sessionId, req.userId!);
    const section = session.sections[session.currentSectionIndex];
    const question = section.questions[questionIndex];
    const testCases = question.testCases ?? [];

    // Use execution queue for run (lower priority)
    const jobId = await executionQueueService.enqueue(
      session.config.language || 'javascript',
      code || '',
      customInput 
        ? [{ input: customInput, expectedOutput: '' }]
        : testCases.slice(0, 2).map(tc => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput
          })),
      sessionId,
      req.userId!,
      question.questionId?.toString() || 'unknown',
      undefined, // default limits
      3 // lower priority
    );

    // Wait for result (shorter timeout for run)
    const result = await executionQueueService.waitForResult(jobId, 10000);

    // Map execution result to the shape the frontend expects
    if (result.results && result.results.length > 0) {
      const passedCount = result.results.filter(r => r.passed).length;
      res.json({
        success: true,
        data: {
          status: result.status === 'completed' ? (passedCount === result.results.length ? 'success' : 'fail') : 'error',
          feedback: result.results.map((r, i) => 
            r.passed ? `Case ${i + 1}: ✓ Passed` : `Case ${i + 1}: ✗ ${r.stderr || 'Wrong output'}`
          ).join('\n'),
          summary: {
            passed: passedCount,
            total: result.results.length
          },
          testResults: result.results.map((r, i) => ({
            index: i,
            input: testCases[i]?.input,
            expected: testCases[i]?.expectedOutput,
            actual: r.actualOutput || r.stdout || '',
            passed: r.passed,
            error: r.stderr || undefined,
            isCustom: !!customInput
          }))
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          status: 'error',
          feedback: result.error || 'No output returned from execution',
          summary: { passed: 0, total: 0 },
          testResults: []
        }
      });
    }
  } catch (error) {
    if (isExecutionProviderError(error)) {
      sendExecutionProviderFallback(res, error, req.body?.customInput);
      return;
    }
    sendServiceError(res, error, 'Execution failed');
  }
};

export const chatWithAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = interviewChatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    interviewMetrics.aiRequest.add(1, {});

    const { message, context, stream } = parsed.data;
    const result = await interviewService.chatWithAI(message, context, stream);

    if (result.stream && 'generator' in result && result.generator) {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');

      const generator = result.generator;
      try {
        for await (const chunk of generator) {
          res.write(chunk);
        }
        res.end();
      } catch (streamError) {
        if (!res.writableEnded) {
          const msg = streamError instanceof AIServiceError
            ? streamError.message
            : 'AI failed to stream response.';
          res.write(`\n${msg}`);
          res.end();
        }
      }
    } else {
      res.json({ success: true, data: { reply: result.reply } });
    }
  } catch (error) {
    interviewMetrics.aiRequestFailed.add(1, {});
    
    if (!res.headersSent) {
      const message = error instanceof AIServiceError ? error.message : 'AI failed to respond.';
      res.status(502).json({ success: false, error: message });
    }
  }
};

export const endInterview = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = endInterviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const session = await interviewService.endInterview({
      userId: req.userId!,
      ...parsed.data,
    });

    // Calculate final weighted score
    const { totalScore } = weightedScoringService.calculateTotalScore(session);

    interviewMetrics.interviewCompleted.add(1, {
      score: totalScore >= 70 ? 'pass' : 'fail'
    });

    interviewMetrics.scoreDistribution.record(totalScore);

    logger.audit('interview_completed', {
      userId: req.userId,
      sessionId: parsed.data.sessionId,
      finalScore: totalScore
    });

    res.json({ 
      success: true, 
      data: session
    });
  } catch (error) {
    sendServiceError(res, error, 'Failed to end session');
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await interviewService.getHistory(req.userId!);
    res.json({ success: true, data: sessions });
  } catch (error) {
    sendServiceError(res, error, 'Failed to fetch history');
  }
};

export const getSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const sessionData = await getSessionWithSecret(sessionId, req.userId!);
    res.json({ success: true, data: sessionData });
  } catch (error) {
    sendServiceError(res, error, 'Error fetching session');
  }
};

export const deleteSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await interviewService.deleteSession(sessionId, req.userId!, {
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    
    logger.audit('interview_deleted', {
      userId: req.userId,
      sessionId
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    sendServiceError(res, error, 'Failed to delete session');
  }
};

export const clearHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await interviewService.clearHistory(req.userId!, {
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });
    
    logger.audit('interview_history_cleared', {
      userId: req.userId,
      deletedCount: result.deletedCount
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    sendServiceError(res, error, 'Failed to clear history');
  }
};
