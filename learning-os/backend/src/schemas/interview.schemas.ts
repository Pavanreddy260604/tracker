import { z } from 'zod';

// ─── Answer Schema ───────────────────────────────────────────────────────────
export const answerSchema = z.object({
    questionIndex: z.number().int().min(0).max(100),
    userCode: z.string().max(100000).optional(),
    userAnswer: z.string().max(50000).optional(),
    score: z.number().min(0).max(100).optional(),
    timeSpent: z.number().min(0).max(3600).optional(), // max 1 hour per question
});

// ─── Submit Section ──────────────────────────────────────────────────────────
export const submitSectionSchema = z.object({
    answers: z.array(answerSchema).min(1).max(50),
});

// ─── Proctoring Update ──────────────────────────────────────────────────────
export const proctoringUpdateSchema = z
    .object({
        tabSwitchCount: z.number().int().min(0).max(10000).optional(),
        idleTime: z.number().min(0).max(86400).optional(),
        lastActivityTime: z.string().datetime().optional(),
        violationType: z.string().max(100).optional(),
        violationMessage: z.string().max(500).optional(),
        timestamp: z.string().datetime().optional(),
        // Attestation fields for secure proctoring
        clientProof: z.string().optional(),
        sequenceNumber: z.number().int().min(0).optional(),
        mouseTrail: z.array(z.object({
            x: z.number(),
            y: z.number(),
            t: z.number()
        })).optional(),
        keystrokeDynamics: z.array(z.object({
            key: z.string(),
            pressTime: z.number(),
            releaseTime: z.number()
        })).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one proctoring field is required',
    });

// ─── End Interview ──────────────────────────────────────────────────────────
export const endInterviewSchema = z.object({
    sessionId: z.string().min(1),
    sectionAnswers: z
        .array(
            z.object({
                sectionIndex: z.number().int().min(0).max(100),
                answers: z.array(answerSchema).max(200),
            })
        )
        .optional(),
});

// ─── Start Interview ────────────────────────────────────────────────────────
export const startInterviewSchema = z.object({
    duration: z.number().int().min(1).max(300).optional(),
    language: z.string().min(1).max(20).optional(),
    sectionsConfig: z
        .array(
            z.object({
                name: z.string().min(1).max(100),
                type: z.string().min(1).max(30),
                duration: z.number().int().min(1).max(180),
                questionCount: z.number().int().min(1).max(20),
                difficulty: z.string().max(20).optional(),
                topics: z.array(z.string().max(50)).optional(),
                questionsConfig: z
                    .array(
                        z.object({
                            difficulty: z.string().max(20).optional(),
                            topics: z.array(z.string().max(50)).optional(),
                        })
                    )
                    .optional(),
            })
        )
        .min(1)
        .max(20),
    hasCameraAccess: z.boolean().optional(),
    strictMode: z.boolean().optional(),
});

// ─── Submit Code ────────────────────────────────────────────────────────────
export const submitCodeSchema = z.object({
    sessionId: z.string().min(1),
    questionIndex: z.number().int().min(0).max(100),
    code: z.string().max(100000).optional(),
    userAnswer: z.string().max(50000).optional(),
});

// ─── Run Code ───────────────────────────────────────────────────────────────
export const runCodeSchema = z.object({
    sessionId: z.string().min(1),
    questionIndex: z.number().int().min(0).max(100),
    code: z.string().max(100000).optional(),
    customInput: z.string().max(10000).optional().nullable(),
    userAnswer: z.string().max(50000).optional(),
});

// ─── AI Chat ────────────────────────────────────────────────────────────────
export const interviewChatSchema = z.object({
    message: z.string().min(1).max(5000),
    context: z
        .object({
            problemName: z.string().max(200).optional(),
            description: z.string().max(5000).optional(),
            userCode: z.string().max(100000).optional(),
            difficulty: z.string().max(20).optional(),
        })
        .optional(),
    stream: z.boolean().optional(),
});
