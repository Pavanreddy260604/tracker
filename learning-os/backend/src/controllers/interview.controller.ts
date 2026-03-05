import { Request, Response } from 'express';
import { AIServiceError } from '../services/aiClient.service.js';
import { isExecutionProviderError } from '../domain/interview.domain.js';
import * as interviewService from '../services/interview.service.js';
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

const sendServiceError = (res: Response, error: unknown, fallbackMessage: string) => {
    const err = error as ServiceError;
    const statusCode = err.statusCode || 500;
    const message = err.message || fallbackMessage;
    res.status(statusCode).json({ success: false, error: message });
};

const sendExecutionProviderFallback = (res: Response, error: unknown, customInput?: string | null) => {
    const message = error instanceof Error ? error.message : 'Code execution unavailable.';
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

// ─── Controllers ─────────────────────────────────────────────────────────────

export const startInterview = async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = startInterviewSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }

        const session = await interviewService.startInterview({
            userId: req.userId!,
            ...parsed.data,
        });
        res.json({ success: true, data: session });
    } catch (error) {
        if (isExecutionProviderError(error)) {
            res.status(503).json({ success: false, error: 'Code execution service is temporarily unavailable. Please try again later.' });
            return;
        }
        sendServiceError(res, error, 'Failed to start interview session');
    }
};

export const nextSection = async (req: Request, res: Response): Promise<void> => {
    try {
        const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const session = await interviewService.nextSection(sessionId, req.userId!);
        res.json({ success: true, data: session });
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
        const session = await interviewService.submitSection(sessionId, req.userId!, parsed.data.answers);
        res.json({ success: true, data: session });
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
        const session = await interviewService.updateProctoring(sessionId, req.userId!, parsed.data);
        res.json({ success: true, data: session });
    } catch (error) {
        sendServiceError(res, error, 'Failed to update proctoring data');
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

        const result = await interviewService.submitCode({
            userId: req.userId!,
            ...parsed.data,
        });
        res.json({ success: true, data: result });
    } catch (error) {
        if (isExecutionProviderError(error)) {
            sendExecutionProviderFallback(res, error);
            return;
        }
        sendServiceError(res, error, 'Evaluation failed');
    }
};

export const chatWithAI = async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = interviewChatSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }

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
        if (!res.headersSent) {
            const message = error instanceof AIServiceError ? error.message : 'AI failed to respond.';
            res.status(502).json({ success: false, error: message });
        }
    }
};

export const runCodeHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = runCodeSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }

        const result = await interviewService.runCode({
            userId: req.userId!,
            ...parsed.data,
            customInput: parsed.data.customInput ?? undefined,
        });
        res.json({ success: true, data: result });
    } catch (error) {
        if (isExecutionProviderError(error)) {
            sendExecutionProviderFallback(res, error, req.body?.customInput);
            return;
        }
        sendServiceError(res, error, 'Execution failed');
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
        res.json({ success: true, data: session });
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
        const session = await interviewService.getSession(sessionId, req.userId!);
        res.json({ success: true, data: session });
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
        res.json({ success: true, data: result });
    } catch (error) {
        sendServiceError(res, error, 'Failed to clear history');
    }
};
