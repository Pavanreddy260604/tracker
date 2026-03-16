import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { DailyLog } from '../models/DailyLog.js';
import { DSAProblem } from '../models/DSAProblem.js';
import { RoadmapNode } from '../models/RoadmapNode.js';
import { RoadmapEdge } from '../models/RoadmapEdge.js';
import { UserActivity } from '../models/UserActivity.js';
import { BackendTopic } from '../models/BackendTopic.js';
import { ProjectStudy } from '../models/ProjectStudy.js';
import { InterviewSession } from '../models/InterviewSession.js';
import { embeddingService } from './embedding.service.js';
import { vectorService } from './vector.service.js';

// Connection pooling for all AI requests
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
    role: ChatRole | string;
    content: string;
    name?: string;
}

export interface ModelAttempt {
    model: string;
    attempt: number;
    status?: number;
    message: string;
}

export interface ToolCall {
    function?: {
        name?: string;
        arguments?: unknown;
    };
}

const DEFAULT_FALLBACK_MODELS = [
    'groq:llama-3.3-70b-versatile',
    'gpt-oss:120b-cloud',
    'glm-4.6:cloud',
    'qwen3-coder:480b-cloud',
    'gemma3:4b',
    'tinyllama:latest',
    'hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:latest',
];

/**
 * Structured error for AI service failures.
 * `recoverable=true` means caller can retry.
 */
export class AIServiceError extends Error {
    public readonly recoverable: boolean;
    public readonly cause?: Error;
    public readonly context?: string;

    constructor(
        message: string,
        options: { recoverable?: boolean; cause?: Error; context?: string } = {}
    ) {
        super(message);
        this.name = 'AIServiceError';
        this.recoverable = options.recoverable ?? true;
        this.cause = options.cause;
        this.context = options.context;
    }
}

import { Groq } from 'groq-sdk';

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || '',
});

/**
 * Base abstract client for communicating with Ollama and Cloud providers.
 * Handles HTTP requests, retries, model fallbacks, streaming, and tool execution.
 */
export class AIClientService {
    protected readonly baseUrl: string;
    protected readonly primaryModel: string;
    protected readonly fallbackModels: string[];
    protected readonly userId?: string;

    constructor(model?: string, userId?: string) {
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.primaryModel = model || process.env.OLLAMA_MODEL || 'mistral';
        this.fallbackModels = this.resolveFallbackModels();
        this.userId = userId;
    }

    private resolveFallbackModels(): string[] {
        const configured = (process.env.OLLAMA_FALLBACK_MODELS || '')
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);

        const sourceModels = configured.length > 0 ? configured : DEFAULT_FALLBACK_MODELS;
        return sourceModels.filter((model) => model !== this.primaryModel);
    }

    private getModelFallbackChain(): string[] {
        return Array.from(new Set([this.primaryModel, ...this.fallbackModels]));
    }

    protected toError(error: unknown): Error {
        return error instanceof Error ? error : new Error(String(error));
    }

    private parseRetryAfterToMs(value: unknown): number | null {
        if (typeof value !== 'string' || value.trim().length === 0) return null;

        const asSeconds = Number(value);
        if (Number.isFinite(asSeconds) && asSeconds >= 0) {
            return Math.min(asSeconds * 1000, 10_000);
        }

        const asDate = Date.parse(value);
        if (!Number.isNaN(asDate)) {
            const waitMs = asDate - Date.now();
            if (waitMs > 0) return Math.min(waitMs, 10_000);
        }

        return null;
    }

    private getStatusCode(error: unknown): number | undefined {
        if (!axios.isAxiosError(error)) return undefined;
        return error.response?.status;
    }

    private getErrorMessage(error: unknown): string {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const responseData = error.response?.data;
            const apiMessage =
                (typeof responseData?.error === 'string' && responseData.error) ||
                (typeof responseData?.message === 'string' && responseData.message);

            return `${status ? `HTTP ${status} - ` : ''}${apiMessage || error.message}`.trim();
        }

        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }

    private isRetryableStatus(status?: number): boolean {
        return status === 429 || status === 503 || status === 504;
    }

    private getRetryDelayMs(error: unknown, attempt: number): number {
        if (axios.isAxiosError(error)) {
            const retryAfterHeader = error.response?.headers?.['retry-after'];
            const headerDelay = this.parseRetryAfterToMs(retryAfterHeader);
            if (headerDelay !== null) {
                return headerDelay;
            }
        }

        return Math.min(1000 * attempt, 5000);
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private formatAttempts(attempts: ModelAttempt[]): string {
        return attempts
            .map((attempt) => {
                const statusPart = attempt.status ? `:${attempt.status}` : '';
                return `${attempt.model}[${attempt.attempt}${statusPart}]`;
            })
            .join(', ');
    }

    protected async makeRequest(
        endpoint: string,
        payload: Record<string, unknown>,
        retries = 3,
        config: AxiosRequestConfig = {}
    ): Promise<AxiosResponse<any>> {
        const modelsToTry = this.getModelFallbackChain();
        const attempts: ModelAttempt[] = [];
        let lastError: Error | undefined;

        for (const model of modelsToTry) {
            // Direct Groq Optimization
            if (model.startsWith('groq:') && process.env.GROQ_API_KEY) {
                // If it's a stream request, handle specially in relevant methods
                if (payload.stream) {
                    return { data: { groq_direct: true, model } } as AxiosResponse;
                }
                
                // Retry logic for Groq direct
                for (let groqAttempt = 1; groqAttempt <= 2; groqAttempt++) {
                    try {
                        const chatCompletion = await groq.chat.completions.create({
                            messages: payload.messages as any,
                            model: model.replace('groq:', ''),
                            temperature: (payload.options as any)?.temperature ?? 0.7,
                            max_tokens: (payload.options as any)?.num_predict ?? 2048,
                        }, { timeout: 60_000 }); // Explicit 60s timeout
                        
                        return {
                            data: {
                                message: {
                                    role: 'assistant',
                                    content: chatCompletion.choices[0]?.message?.content || '',
                                }
                            }
                        } as AxiosResponse;
                    } catch (e: any) {
                        const isTimeout = e.code === 'ETIMEDOUT' || e.name === 'TimeoutError';
                        if (isTimeout && groqAttempt < 2) {
                            console.warn(`[Groq] ${model} timeout. Retrying (${groqAttempt}/2)...`);
                            await this.delay(2000);
                            continue;
                        }
                        lastError = this.toError(e);
                        attempts.push({ model, attempt: groqAttempt, message: this.getErrorMessage(e) });
                        break;
                    }
                }
                continue;
            }

            for (let attempt = 1; attempt <= retries; attempt += 1) {
                try {
                    const currentPayload = {
                        ...payload,
                        model,
                        // High Performance Ollama Options
                        options: {
                            num_gpu: 99,
                            num_ctx: 16384,
                            ...(payload.options as object || {})
                        },
                        keep_alive: "10m" // Keep model loaded in memory for faster subsequent responses
                    };

                    const response = await axios.post(`${this.baseUrl}${endpoint}`, currentPayload, {
                        timeout: 60_000,
                        httpAgent,
                        httpsAgent,
                        ...config,
                    });
                    return response;
                } catch (error) {
                    const status = this.getStatusCode(error);
                    const message = this.getErrorMessage(error);
                    attempts.push({ model, attempt, status, message });
                    lastError = this.toError(error);

                    if (this.isRetryableStatus(status) && attempt < retries) {
                        const delayMs = this.getRetryDelayMs(error, attempt);
                        console.warn(
                            `[Ollama] ${model} transient failure (${message}). Retrying in ${delayMs}ms...`
                        );
                        await this.delay(delayMs);
                        continue;
                    }

                    break;
                }
            }
        }

        const attemptsSummary = this.formatAttempts(attempts);
        throw new AIServiceError(
            `All configured models failed${attemptsSummary ? ` (${attemptsSummary})` : ''}.`,
            { recoverable: true, cause: lastError, context: 'ai_request' }
        );
    }

    public async generateResponse(prompt: string): Promise<string> {
        try {
            const response = await this.makeRequest('/api/generate', {
                prompt,
                stream: false,
            });

            const text = response.data?.response;
            if (typeof text !== 'string') {
                throw new AIServiceError('Invalid response format from Ollama generate endpoint.', {
                    recoverable: true,
                    context: 'generate_response',
                });
            }

            return text;
        } catch (error) {
            throw new AIServiceError('AI generation failed. Please try again.', {
                recoverable: true,
                cause: this.toError(error),
                context: 'generate_response',
            });
        }
    }

    public async *generateResponseStream(prompt: string): AsyncGenerator<string, void, unknown> {
        yield* this.generateChatStream([{ role: 'user', content: prompt }]);
    }

    private parseStreamLine(line: string): { content?: string; done?: boolean } | null {
        const trimmed = line.trim();
        if (!trimmed) return null;

        try {
            const parsed = JSON.parse(trimmed);
            return {
                content: parsed?.message?.content,
                done: Boolean(parsed?.done),
            };
        } catch {
            return null;
        }
    }

    public async *generateChatStream(
        messages: { role: string; content: string }[],
        systemPrompt?: string,
        images?: string[]
    ): AsyncGenerator<string, void, unknown> {
        const requestMessages = systemPrompt
            ? [{ role: 'system', content: systemPrompt }, ...messages]
            : messages;

        try {
            const response = await this.makeRequest(
                '/api/chat',
                { messages: requestMessages, stream: true, images },
                2,
                { responseType: 'stream' }
            );

            // Handle Direct Groq Streaming
            if ((response.data as any)?.groq_direct) {
                const modelId = (response.data as any).model.replace('groq:', '');
                
                // For Groq Vision, images must be part of the message content
                const groqMessages = requestMessages.map((m, idx) => {
                    if (idx === requestMessages.length - 1 && images && images.length > 0) {
                        return {
                            role: m.role,
                            content: [
                                { type: 'text', text: m.content },
                                ...images.map(img => ({
                                    type: 'image_url',
                                    image_url: { url: `data:image/jpeg;base64,${img}` }
                                }))
                            ]
                        };
                    }
                    return m;
                });

                for (let groqStreamAttempt = 1; groqStreamAttempt <= 2; groqStreamAttempt++) {
                    try {
                        const stream = await groq.chat.completions.create({
                            messages: groqMessages as any,
                            model: modelId,
                            stream: true,
                            temperature: 0.7,
                        }, { timeout: 60_000 });

                        for await (const chunk of stream) {
                            const content = chunk.choices[0]?.delta?.content || '';
                            if (content) yield content;
                        }
                        return;
                    } catch (e: any) {
                        const isTimeout = e.code === 'ETIMEDOUT' || e.name === 'TimeoutError';
                        if (isTimeout && groqStreamAttempt < 2) {
                            console.warn(`[Groq Stream] ${modelId} timeout. Retrying (${groqStreamAttempt}/2)...`);
                            await this.delay(2000);
                            continue;
                        }
                        throw e;
                    }
                }
            }

            const stream = response.data as AsyncIterable<Buffer | string>;
            let buffer = '';

            for await (const chunk of stream) {
                buffer += chunk.toString();

                let newlineIndex = buffer.indexOf('\n');
                while (newlineIndex !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);

                    const parsed = this.parseStreamLine(line);
                    if (parsed?.content) {
                        yield parsed.content;
                    }
                    if (parsed?.done) {
                        return;
                    }

                    newlineIndex = buffer.indexOf('\n');
                }
            }

            if (buffer.trim()) {
                const parsed = this.parseStreamLine(buffer);
                if (parsed?.content) {
                    yield parsed.content;
                }
            }
        } catch (error) {
            throw new AIServiceError('AI streaming failed. Please retry.', {
                recoverable: true,
                cause: this.toError(error),
                context: 'chat_stream',
            });
        }
    }

    public async chat(message: string, history: any[] = [], jsonMode = false): Promise<string> {
        return this.chatInternal(message, history, jsonMode);
    }

    protected stripMarkdownJson(text: string): string {
        return text.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    protected extractJsonCandidate(text: string, preferArray = false): string | null {
        const cleaned = this.stripMarkdownJson(text);

        if (preferArray) {
            const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
            if (arrayMatch) return arrayMatch[0];
        }

        const objectMatch = cleaned.match(/\{[\s\S]*\}/);
        if (objectMatch) return objectMatch[0];

        return cleaned.length > 0 ? cleaned : null;
    }

    protected safeParseJson<T>(value: string): T | null {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }

    private parseToolArgs(rawArgs: unknown): Record<string, unknown> {
        if (!rawArgs) return {};

        if (typeof rawArgs === 'string') {
            const parsed = this.safeParseJson<Record<string, unknown>>(rawArgs);
            return parsed || {};
        }

        if (typeof rawArgs === 'object') {
            return rawArgs as Record<string, unknown>;
        }

        return {};
    }

    private async chatInternal(message: string, history: ChatMessage[] = [], jsonMode = false): Promise<string> {
        try {
            const payload: Record<string, unknown> = {
                messages: [...history, { role: 'user', content: message }],
                stream: false,
            };

            if (jsonMode) {
                payload.format = 'json';
            } else if (this.userId) {
                payload.tools = this.getToolsDefinition();
            }

            const response = await this.makeRequest('/api/chat', payload);
            const responseMessage = response.data?.message;

            if (!responseMessage || typeof responseMessage !== 'object') {
                throw new AIServiceError('Invalid chat response from AI service.', {
                    recoverable: true,
                    context: 'chat',
                });
            }

            const toolCalls = Array.isArray(responseMessage.tool_calls)
                ? (responseMessage.tool_calls as ToolCall[])
                : [];

            if (toolCalls.length > 0) {
                const toolHistory: ChatMessage[] = [
                    ...history,
                    { role: 'user', content: message },
                    responseMessage as ChatMessage,
                ];

                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function?.name;
                    if (!functionName) continue;

                    const parsedArgs = this.parseToolArgs(toolCall.function?.arguments);
                    const toolResult = await this.executeTool(functionName, parsedArgs);

                    toolHistory.push({
                        role: 'tool',
                        name: functionName,
                        content: JSON.stringify(toolResult),
                    });
                }

                const followUpResponse = await this.makeRequest('/api/chat', {
                    messages: toolHistory,
                    stream: false,
                });

                const followUpContent = followUpResponse.data?.message?.content;
                if (typeof followUpContent !== 'string') {
                    throw new AIServiceError('Invalid follow-up response after tool execution.', {
                        recoverable: true,
                        context: 'chat',
                    });
                }
                return followUpContent;
            }

            const directContent = responseMessage.content;
            if (typeof directContent !== 'string') {
                throw new AIServiceError('AI returned an empty chat response.', {
                    recoverable: true,
                    context: 'chat',
                });
            }

            return directContent;
        } catch (error) {
            throw new AIServiceError('AI chat service unavailable. Please retry.', {
                recoverable: true,
                cause: this.toError(error),
                context: 'chat',
            });
        }
    }

    private getToolsDefinition() {
        return [
            {
                type: 'function',
                function: {
                    name: 'getRecentLogs',
                    description: "Get the user's daily activity logs for the last N days.",
                    parameters: {
                        type: 'object',
                        properties: {
                            days: { type: 'number', description: 'Number of days to look back' },
                        },
                        required: ['days'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getUserActivity',
                    description:
                        "Get high-resolution system activity (clicks, navigation) for the last N minutes.",
                    parameters: {
                        type: 'object',
                        properties: {
                            minutes: { type: 'number', description: 'Minutes to look back' },
                        },
                        required: ['minutes'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getDSAStats',
                    description: 'Get statistics about solved DSA problems.',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: 'Topic filter' },
                            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getRoadmap',
                    description: "Get the user's learning roadmap.",
                    parameters: { type: 'object', properties: {} },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getBackendTopics',
                    description: "Get the user's backend learning topics, SRS review status, and subtopics checklist.",
                    parameters: {
                        type: 'object',
                        properties: {
                            status: { type: 'string', description: 'Filter by status (e.g. learning, learned)' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getProjectStudies',
                    description: "Get the user's architectural project studies, flow understanding, tasks, and schemas.",
                    parameters: { type: 'object', properties: {} },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getInterviewHistory',
                    description: "Get the user's past AI interview sessions and their performance metrics.",
                    parameters: { type: 'object', properties: {} },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'searchKnowledgeBase',
                    description: "Search the universal RAG vector database for semantically relevant learning notes, projects, DSA approaches, or system designs.",
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'The semantic search query' },
                        },
                        required: ['query'],
                    },
                },
            },
        ];
    }

    private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
        if (!this.userId) return { error: 'User context missing' };

        try {
            switch (name) {
                case 'getRecentLogs': {
                    const days = Math.min(Math.max(Number(args.days) || 7, 1), 30);
                    return await DailyLog.find({ userId: this.userId })
                        .sort({ date: -1 })
                        .limit(days)
                        .lean();
                }

                case 'getUserActivity': {
                    const minutes = Math.min(Math.max(Number(args.minutes) || 10, 1), 180);
                    const since = new Date(Date.now() - minutes * 60 * 1000);
                    return await UserActivity.find({
                        userId: this.userId,
                        timestamp: { $gte: since },
                    })
                        .sort({ timestamp: -1 })
                        .limit(20)
                        .lean();
                }

                case 'getDSAStats': {
                    const query: Record<string, unknown> = { userId: this.userId, status: 'solved' };
                    if (typeof args.topic === 'string' && args.topic.trim().length > 0) {
                        query.topic = new RegExp(args.topic.trim(), 'i');
                    }
                    if (
                        args.difficulty === 'easy' ||
                        args.difficulty === 'medium' ||
                        args.difficulty === 'hard'
                    ) {
                        query.difficulty = args.difficulty;
                    }

                    const count = await DSAProblem.countDocuments(query);
                    const problems = await DSAProblem.find(query)
                        .select('problemName difficulty topic date')
                        .limit(5)
                        .lean();

                    return { totalSolved: count, recent: problems };
                }

                case 'getRoadmap': {
                    const [nodes, edges] = await Promise.all([
                        RoadmapNode.find({ userId: this.userId }).lean(),
                        RoadmapEdge.find({ userId: this.userId }).lean(),
                    ]);
                    return { nodes, edges };
                }

                case 'getBackendTopics': {
                    const query: Record<string, unknown> = { userId: this.userId };
                    if (typeof args.status === 'string' && args.status.trim().length > 0) {
                        query.status = args.status.trim().toLowerCase();
                    }
                    const topics = await BackendTopic.find(query)
                        .select('topicName category status nextReviewDate subTopics reviewStage')
                        .limit(30)
                        .lean();

                    return topics;
                }

                case 'getProjectStudies': {
                    const studies = await ProjectStudy.find({ user: this.userId })
                        .sort({ updatedAt: -1 })
                        .limit(10)
                        .select('projectName moduleStudied flowUnderstanding coreComponents keyTakeaways tasks updatedAt')
                        .lean();

                    return studies;
                }

                case 'getInterviewHistory': {
                    const sessions = await InterviewSession.find({ userId: this.userId })
                        .sort({ updatedAt: -1 })
                        .limit(5)
                        .select('status totalScore overallFeedback startedAt endedAt config.difficulty config.language analytics')
                        .lean();

                    return sessions;
                }

                case 'searchKnowledgeBase': {
                    const query = typeof args.query === 'string' ? args.query.trim() : '';
                    if (!query) {
                        return { results: [], error: 'Query is required' };
                    }

                    const embedding = await embeddingService.generateEmbedding(query);
                    const results = await vectorService.findSimilar(
                        this.userId,
                        embedding,
                        5,
                        { type: { "$in": ['BackendTopic', 'ProjectStudy', 'DSAProblem', 'InterviewSession'] } }
                    );

                    return {
                        results: results.map((result) => ({
                            id: result.id,
                            score: result.score,
                            type: result.type,
                            title: result.title,
                            content: (result.content || '').slice(0, 1200),
                            metadata: result.metadata
                        }))
                    };
                }

                default:
                    return { error: `Tool ${name} not implemented` };
            }
        } catch (error) {
            return { error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}` };
        }
    }
}
