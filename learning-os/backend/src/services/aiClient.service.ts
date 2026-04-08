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
import { chatToolsService } from './chatTools.service.js';
import { chatRagService } from './chatRag.service.js';

// Connection pooling for all AI requests
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
    role: ChatRole | string;
    content: string;
    name?: string;
    tool_calls?: any[];
    tool_call_id?: string;
}

export interface ModelAttempt {
    model: string;
    attempt: number;
    status?: number;
    message: string;
}

export interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
}

const DEFAULT_FALLBACK_MODELS = [
    'deepseek-v3.1:671b-cloud',
    'qwen3-coder:480b-cloud',
    'gpt-oss:120b-cloud',
    'groq:llama-3.3-70b-versatile',
    'groq:llama-3.1-70b-versatile',
    'groq:mixtral-8x7b-32768',
    'glm-4.6:cloud',
    'qwen3-vl:235b-cloud',
    'gemma3:4b',
    'tinyllama:latest',
];

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

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || '',
});

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
        if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.min(asSeconds * 1000, 10_000);
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
                (typeof responseData?.message === 'string' && responseData.message) ||
                (typeof responseData?.error?.message === 'string' && responseData.error.message);
            return `${status ? `HTTP ${status} - ` : ''}${apiMessage || error.message}`.trim();
        }
        
        // Handle Groq SDK specific error format
        if (error && typeof error === 'object' && 'error' in error) {
            const innerError = (error as any).error;
            if (innerError && typeof innerError === 'object' && 'message' in innerError) {
                return String(innerError.message);
            }
        }

        return error instanceof Error ? error.message : String(error);
    }

    private isCloudModel(model: string): boolean {
        return model.startsWith('groq:') || model.endsWith(':cloud');
    }

    private sanitizeMessagesForCloud(messages: ChatMessage[]): any[] {
        return messages.map(m => {
            if (m.role === 'assistant' && (m as any).tool_calls) {
                return {
                    ...m,
                    tool_calls: (m as any).tool_calls.map((tc: any) => ({
                        ...tc,
                        function: {
                            ...tc.function,
                            arguments: typeof tc.function.arguments === 'string' 
                                ? (this.safeParseJson(tc.function.arguments) || tc.function.arguments)
                                : tc.function.arguments
                        }
                    }))
                };
            }
            return m;
        });
    }

    private createAbortError(message = 'AI request aborted.'): Error {
        const error = new Error(message);
        error.name = 'AbortError';
        return error;
    }

    private async readStreamBody(stream: any): Promise<string> {
        if (!stream || typeof stream.on !== 'function') return '[No stream available]';
        return new Promise((resolve) => {
            let body = '';
            const timeout = setTimeout(() => resolve('[Read timeout]'), 2000);
            stream.on('data', (chunk: any) => { body += chunk; });
            stream.on('end', () => { clearTimeout(timeout); resolve(body); });
            stream.on('error', () => { clearTimeout(timeout); resolve('[Stream error]'); });
        });
    }

    private stripToolsFromHistory(messages: ChatMessage[]): ChatMessage[] {
        return messages
            .filter(m => m.role !== 'tool') // Remove role='tool' messages
            .map(m => {
                if (m.role === 'assistant' && (m as any).tool_calls) {
                    const { tool_calls, ...rest } = m as any; // Remove tool_calls from assistant messages
                    return rest as ChatMessage;
                }
                return m;
            });
    }

    private isAbortLikeError(error: unknown): boolean {
        if (axios.isCancel(error)) return true;
        if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') return true;
        return error instanceof Error && (error.name === 'AbortError' || error.name === 'CanceledError');
    }

    private throwIfAborted(signal?: AbortSignal): void {
        if (signal?.aborted) throw this.createAbortError();
    }

    private isRetryableStatus(status?: number): boolean {
        return status === 429 || status === 503 || status === 504;
    }

    private getRetryDelayMs(error: unknown, attempt: number): number {
        if (axios.isAxiosError(error)) {
            const retryAfterHeader = error.response?.headers?.['retry-after'];
            const headerDelay = this.parseRetryAfterToMs(retryAfterHeader);
            if (headerDelay !== null) return headerDelay;
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
        const abortSignal = config.signal as AbortSignal | undefined;

        // Determine the models to try. If a specific model is requested in the payload,
        // and it's NOT the primary model, we honor it strictly (no fallback).
        // If it's the primary model OR no model is specified, we use the fallback chain.
        const requestedModel = payload.model as string | undefined;
        const isExplicitChoice = requestedModel && requestedModel !== this.primaryModel;
        
        const modelsToTry = isExplicitChoice 
            ? [requestedModel] 
            : this.getModelFallbackChain();

        let lastError: Error | null = null;
        const attempts: ModelAttempt[] = [];

        if (isExplicitChoice) {
            console.log(`[AIClient] Honoring explicit model choice: ${requestedModel}`);
        }

        for (const model of modelsToTry) {
            this.throwIfAborted(abortSignal);

            if (model.startsWith('groq:') && process.env.GROQ_API_KEY) {
                // If this is a streaming request, we return a special marker.
                // The caller (generateChatStream) is responsible for the actual streaming logic and fallback.
                if (payload.stream) {
                    return { data: { groq_direct: true, model } } as AxiosResponse;
                }
                
                for (let groqAttempt = 1; groqAttempt <= 2; groqAttempt++) {
                    try {
                        this.throwIfAborted(abortSignal);
                        const hasHistoryTools = (payload.messages as any[]).some(m => m.role === 'tool' || (m.role === 'assistant' && (m.tool_calls || []).length > 0));
                        const sanitizedMessages = this.sanitizeMessagesForCloud(payload.messages as ChatMessage[]);
                        const chatCompletion = await groq.chat.completions.create({
                            messages: sanitizedMessages,
                            model: model.replace('groq:', ''),
                            temperature: (payload.options as any)?.temperature ?? 0.7,
                            max_tokens: (payload.options as any)?.num_predict ?? 2048,
                            tools: (this.userId || hasHistoryTools) ? this.getToolsDefinition() as any : undefined,
                            tool_choice: 'auto',
                        }, { timeout: 60_000, signal: abortSignal } as any);
                        
                        return {
                            data: {
                                message: {
                                    role: 'assistant',
                                    content: chatCompletion.choices[0]?.message?.content || '',
                                    tool_calls: chatCompletion.choices[0]?.message?.tool_calls
                                }
                            }
                        } as AxiosResponse;
                    } catch (e: any) {
                        if (abortSignal?.aborted || this.isAbortLikeError(e)) throw this.createAbortError();
                        const is429 = this.getStatusCode(e) === 429;
                        if (is429 && !isExplicitChoice) {
                            console.warn(`[Groq] ${model} rate limited. Falling back...`);
                            break; // Try next model
                        }
                        lastError = this.toError(e);
                        attempts.push({ model, attempt: groqAttempt, message: this.getErrorMessage(e) });
                        break;
                    }
                }
                if (isExplicitChoice && lastError) break;
                continue;
            }

            const isCloud = this.isCloudModel(model);
            const timeout = isCloud ? 120_000 : 60_000;

            for (let attempt = 1; attempt <= retries; attempt += 1) {
                try {
                    this.throwIfAborted(abortSignal);
                    
                    const isCloud = this.isCloudModel(model);
                    const currentMessages = isCloud && Array.isArray(payload.messages) 
                        ? this.sanitizeMessagesForCloud(payload.messages as ChatMessage[]) 
                        : payload.messages;
                        
                    const currentPayload: any = { 
                        ...payload, 
                        model, 
                        messages: currentMessages,
                        options: {
                            temperature: 0.0, // Default to strict consistency
                            num_ctx: 16384,   // High-capacity context (Matches ScriptWriter)
                            num_thread: 8,    // High-performance threading
                            f16_kv: true      // Fast key-value cache
                        }
                    };
                    
                    // Allow payload-specific overrides
                    if ((payload as any).options) {
                        currentPayload.options = { ...currentPayload.options, ...(payload as any).options };
                    }
                    
                    // Clean up empty/null fields that can break strict parsers
                    if (Array.isArray(currentPayload.images) && currentPayload.images.length === 0) delete currentPayload.images;
                    if (!currentPayload.tools) delete currentPayload.tools;

                    const response = await axios.post(`${this.baseUrl}${endpoint}`, currentPayload, {
                        timeout,
                        httpAgent,
                        httpsAgent,
                        ...config,
                    });
                    return response;
                } catch (error) {
                    if (abortSignal?.aborted || this.isAbortLikeError(error)) throw this.createAbortError();
                    const status = this.getStatusCode(error);
                    const message = this.getErrorMessage(error);
                    const responseData = (error as any).response?.data;
                    
                    // If Ollama returns a 400 (Bad Request), it often means the model 
                    // doesn't support 'tools' or 'stream' (common for older local/cloud ones).
                    if (status === 400 && !model.startsWith('groq:')) {
                        console.warn(`[AIClient] Model ${model} failed with 400. Attempting fallbacks...`);
                        
                        // Try 1: Without tools (Essential for local models lacking tool support)
                        if (payload.tools) {
                            try {
                                console.log(`[AIClient] Attempting ${model} without tools/tool-history...`);
                                const strippedMessages = Array.isArray(payload.messages) 
                                    ? this.stripToolsFromHistory(payload.messages as ChatMessage[]) 
                                    : payload.messages;
                                    
                                const noToolsPayload = { ...payload, tools: undefined, model, messages: strippedMessages };
                                return await axios.post(`${this.baseUrl}${endpoint}`, noToolsPayload, { timeout, httpAgent, httpsAgent, ...config });
                            } catch (e) {
                                error = e; // Keep latest error
                            }
                        }

                        // Try 2: Without streaming
                        if (payload.stream) {
                            try {
                                console.log(`[AIClient] Attempting ${model} without streaming...`);
                                const noStreamPayload = { ...payload, stream: false, model };
                                return await axios.post(`${this.baseUrl}${endpoint}`, noStreamPayload, { timeout, httpAgent, httpsAgent, ...config, responseType: 'json' });
                            } catch (e) {
                                error = e; // Keep latest error
                            }
                        }
                    }

                    if (status === 400 && !model.startsWith('groq:')) {
                        let errOutput = 'Unknown 400 error';
                        if (responseData?.constructor?.name === 'IncomingMessage') {
                            errOutput = await this.readStreamBody(responseData);
                        } else {
                            errOutput = JSON.stringify(responseData);
                        }
                        
                        console.error(`[AIClient] Ollama Bad Request (400) for ${model}:`, errOutput);
                        attempts.push({ model, attempt, status, message: errOutput || message });
                        throw new AIServiceError(`Local model ${model} failed: ${errOutput || message}. Ensure the model is pulled.`, { 
                            recoverable: true, 
                            cause: error as Error,
                            context: 'ollama_validation'
                        });
                    }

                    attempts.push({ model, attempt, status, message });
                    lastError = this.toError(error);
                    
                    if (isExplicitChoice) break; // Don't fallback if the user specifically asked for this model

                    if (this.isRetryableStatus(status) && attempt < retries) {
                        await this.delay(this.getRetryDelayMs(error, attempt));
                        continue;
                    }
                    break;
                }
            }
        }

        const attemptsSummary = this.formatAttempts(attempts);
        throw new AIServiceError(`AI request failed${attemptsSummary ? ` (${attemptsSummary})` : ''}.`, { recoverable: true, cause: lastError, context: 'ai_request' });
    }

    public async generateResponse(prompt: string, temperature: number = 0.0): Promise<string> {
        try {
            const response = await this.makeRequest('/api/generate', { prompt, stream: false, options: { temperature } });
            const text = response.data?.response;
            if (typeof text !== 'string') throw new AIServiceError('Invalid response format from Ollama generate endpoint.', { recoverable: true, context: 'generate_response' });
            return text;
        } catch (error) {
            throw new AIServiceError('AI generation failed. Please try again.', { recoverable: true, cause: this.toError(error), context: 'generate_response' });
        }
    }

    public async *generateResponseStream(prompt: string): AsyncGenerator<string, void, unknown> {
        yield* this.generateChatStream([{ role: 'user', content: prompt }]);
    }

    private parseStreamLine(line: string): { content?: string; done?: boolean; tool_calls?: any[] } | null {
        const trimmed = line.trim();
        if (!trimmed) return null;
        try {
            const parsed = JSON.parse(trimmed);
            return {
                content: parsed?.message?.content,
                done: Boolean(parsed?.done),
                tool_calls: parsed?.message?.tool_calls
            };
        } catch {
            return null;
        }
    }

    public async *generateChatStream(
        messages: ChatMessage[],
        systemPrompt?: string,
        images?: string[],
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {
        const honestySuffix = "\n\nCRITICAL: If a tool returns an error (404, 500, etc.), you MUST report the error to the user exactly as it is. NEVER try to guess the content or provide 'placeholder' information if a tool fails.";
        
        // Ensure system prompt is only added if not already present at the start
        const hasSystemMessage = messages.length > 0 && messages[0].role === 'system';
        let requestMessages = [...messages];

        if (!hasSystemMessage) {
            const content = (systemPrompt || "You are a professional Staff Engineer AI.") + honestySuffix;
            requestMessages.unshift({ role: 'system', content });
        }

        // Recursive guard
        const toolCount = messages.filter(m => m.role === 'tool').length;
        if (toolCount > 10) {
            yield "\n[System: Max tool recursion reached. Stopping for safety.]\n";
            return;
        }

        try {
        const modelsToTry = this.getModelFallbackChain();
        const attempts: ModelAttempt[] = [];
        let lastError: Error | undefined;

        for (const currentModel of modelsToTry) {
            try {
                this.throwIfAborted(signal);
                
                const modelOption = this.getToolsDefinition()?.find(m => m === currentModel) || currentModel;
                const response = await this.makeRequest(
                    '/api/chat',
                    { 
                        messages: requestMessages, 
                        stream: true, 
                        images,
                        tools: this.userId ? this.getToolsDefinition() : undefined,
                        model: currentModel
                    },
                    2,
                    { responseType: 'stream', signal }
                );

                const toolCalls: ToolCall[] = [];

                // Case 1: Groq Direct Streaming
                if ((response.data as any)?.groq_direct) {
                    const modelId = (response.data as any).model.replace('groq:', '');
                    const sanitizedRequestMessages = this.sanitizeMessagesForCloud(requestMessages);
                    const groqMessages = sanitizedRequestMessages.map((m, idx) => {
                        if (idx === sanitizedRequestMessages.length - 1 && images && images.length > 0) {
                            return {
                                role: m.role,
                                content: [
                                    { type: 'text', text: m.content },
                                    ...images.map(img => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } }))
                                ]
                            };
                        }
                        return m;
                    });

                    for (let groqStreamAttempt = 1; groqStreamAttempt <= 2; groqStreamAttempt++) {
                        try {
                            this.throwIfAborted(signal);
                            const hasHistoryTools = messages.some(m => m.role === 'tool' || (m.role === 'assistant' && (m as any).tool_calls?.length > 0));
                yield `__PROGRESS__:SYSTEM:Inference via ${modelId}\n`;
                const stream = await groq.chat.completions.create({
                                messages: groqMessages as any,
                                model: modelId,
                                stream: true,
                                temperature: 0.7,
                                tools: (this.userId || hasHistoryTools) ? this.getToolsDefinition() as any : undefined,
                                tool_choice: 'auto',
                            }, { timeout: 120_000, signal } as any);

                            for await (const chunk of stream) {
                                this.throwIfAborted(signal);
                                const delta = chunk.choices[0]?.delta;
                                if (delta?.content) yield delta.content;

                                if (delta?.tool_calls) {
                                    for (const toolDelta of delta.tool_calls) {
                                        const index = toolDelta.index;
                                        if (!toolCalls[index]) {
                                            toolCalls[index] = {
                                                id: toolDelta.id || `call_${Date.now()}_${index}`,
                                                type: 'function',
                                                function: { name: '', arguments: '' }
                                            };
                                        }
                                        if (toolDelta.id) toolCalls[index].id = toolDelta.id;
                                        if (toolDelta.function?.name) toolCalls[index].function.name += toolDelta.function.name;
                                        if (toolDelta.function?.arguments) toolCalls[index].function.arguments += toolDelta.function.arguments;
                                    }
                                }
                            }
                            
                            if (toolCalls.length > 0) {
                                yield* this.handleToolCalls(toolCalls, messages, systemPrompt, images, signal);
                            }
                            return; // Success!
                        } catch (e: any) {
                            if (signal?.aborted || this.isAbortLikeError(e)) throw this.createAbortError();
                            
                            const status = (e as any).status || (e as any).response?.status;
                            if (status === 429 && currentModel !== modelsToTry[modelsToTry.length - 1]) {
                                console.warn(`[Groq Stream] ${currentModel} rate limited. Falling back...`);
                                throw e; // caught by outer loop
                            }

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
                // Case 2: Ollama Streaming
                else {
                    const stream = response.data as AsyncIterable<Buffer | string> & { destroy?: (error?: Error) => void };
                    let buffer = '';
                    const abortHandler = () => { if (typeof stream.destroy === 'function') stream.destroy(this.createAbortError()); };
                    signal?.addEventListener('abort', abortHandler, { once: true });

                    try {
                        for await (const chunk of stream) {
                            this.throwIfAborted(signal);
                            buffer += chunk.toString();
                            let newlineIndex = buffer.indexOf('\n');
                            while (newlineIndex !== -1) {
                                const line = buffer.slice(0, newlineIndex);
                                buffer = buffer.slice(newlineIndex + 1);
                                const parsed = this.parseStreamLine(line);
                                if (parsed?.content) yield parsed.content;
                                if (parsed?.tool_calls) {
                                    for (const tc of parsed.tool_calls) {
                                        const index = 0; // Simplified for Ollama single-tool stream
                                        if (!toolCalls[index]) {
                                            toolCalls[index] = { id: tc.id || `call_${Date.now()}`, type: 'function', function: { name: '', arguments: '' } };
                                        }
                                        if (tc.function?.name) toolCalls[index].function.name += tc.function.name;
                                        if (tc.function?.arguments) {
                                            const args = typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments);
                                            toolCalls[index].function.arguments += args;
                                        }
                                    }
                                }
                                if (parsed?.done) break;
                                newlineIndex = buffer.indexOf('\n');
                            }
                        }
                        if (toolCalls.length > 0) {
                            yield* this.handleToolCalls(toolCalls, messages, systemPrompt, images, signal);
                        }
                        return; // Success!
                    } finally {
                        signal?.removeEventListener('abort', abortHandler);
                    }
                }
            } catch (error: any) {
                if (signal?.aborted || this.isAbortLikeError(error)) throw this.createAbortError();
                
                const status = (error as any).status || (error as any).response?.status;
                const message = this.getErrorMessage(error);
                attempts.push({ model: currentModel, attempt: 1, status, message });
                lastError = error;

                if (status === 429 && currentModel !== modelsToTry[modelsToTry.length - 1]) {
                    continue; // try next model
                }
                break; // fail for other reasons
            }
        }

        if (lastError) {
            const summary = this.formatAttempts(attempts);
            throw new AIServiceError(`AI streaming failed after trying multiple models: ${summary}.`, { 
                recoverable: true, 
                cause: this.toError(lastError), 
                context: 'chat_stream' 
            });
        }
        } catch (error) {
            if (signal?.aborted || this.isAbortLikeError(error)) throw this.createAbortError();
            if (error instanceof AIServiceError) throw error;
            throw new AIServiceError('AI streaming failed. Please retry.', { recoverable: true, cause: this.toError(error), context: 'chat_stream' });
        }
    }

    private async *handleToolCalls(
        toolCalls: ToolCall[],
        messages: ChatMessage[],
        systemPrompt?: string,
        images?: string[],
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {
        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: '',
            tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.function.name, arguments: tc.function.arguments }
            }))
        };

        const toolMessages: any[] = [];
        for (const tc of (assistantMessage.tool_calls || [])) {
            try {
                const args = this.parseToolArgs(tc.function.arguments);
                let result: any;
                const toolGen = this.executeTool(tc.function.name, args);
                while (true) {
                    const { value, done } = await toolGen.next();
                    if (done) {
                        result = value;
                        break;
                    }
                    if (typeof value === 'string' && value.startsWith('__PROGRESS__:')) {
                        yield value + '\n';
                    }
                }
                toolMessages.push({ 
                    role: 'tool', 
                    tool_call_id: tc.id, 
                    content: JSON.stringify(result), 
                    name: tc.function.name 
                });
            } catch (e) {
                toolMessages.push({ 
                    role: 'tool', 
                    tool_call_id: tc.id, 
                    content: JSON.stringify({ status: 'error', message: 'Failed to execute tool', error: String(e) }), 
                    name: tc.function.name 
                });
            }
        }

        const nextHistory = [...messages, assistantMessage, ...toolMessages];
        yield* this.generateChatStream(nextHistory, systemPrompt, images, signal);
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
        try { return JSON.parse(value) as T; } catch { return null; }
    }

    private parseToolArgs(rawArgs: unknown): Record<string, unknown> {
        if (!rawArgs) return {};
        if (typeof rawArgs === 'string') return this.safeParseJson<Record<string, unknown>>(rawArgs) || {};
        if (typeof rawArgs === 'object') return rawArgs as Record<string, unknown>;
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
                throw new AIServiceError('Invalid chat response from AI service.', { recoverable: true, context: 'chat' });
            }

            const toolCalls = Array.isArray(responseMessage.tool_calls) ? (responseMessage.tool_calls) : [];

            if (toolCalls.length > 0) {
                const toolHistory: ChatMessage[] = [...history, { role: 'user', content: message }, responseMessage as ChatMessage];
                for (const toolCall of toolCalls) {
                    const functionName = toolCall.function?.name;
                    if (!functionName) continue;
                    const parsedArgs = this.parseToolArgs(toolCall.function?.arguments);
                    
                    let result: any;
                    const toolGen = this.executeTool(functionName, parsedArgs);
                    while (true) {
                        const { value, done } = await toolGen.next();
                        if (done) { result = value; break; }
                    }

                    const toolResponse: ChatMessage = { 
                        role: 'tool', 
                        tool_call_id: toolCall.id, 
                        content: JSON.stringify(result) 
                    };
                    
                    // Add name only for cloud models that might require it as 'tool_name' or legacy 'name'
                    if (this.isCloudModel(this.primaryModel)) {
                        (toolResponse as any).name = functionName;
                    }

                    toolHistory.push(toolResponse);
                }

                const followUpResponse = await this.makeRequest('/api/chat', { messages: toolHistory, stream: false });
                const followUpContent = followUpResponse.data?.message?.content;
                if (typeof followUpContent !== 'string') throw new AIServiceError('Invalid follow-up response after tool execution.', { recoverable: true, context: 'chat' });
                return followUpContent;
            }

            const directContent = responseMessage.content;
            if (typeof directContent !== 'string') throw new AIServiceError('AI returned an empty chat response.', { recoverable: true, context: 'chat' });
            return directContent;
        } catch (error) {
            throw new AIServiceError('AI chat service unavailable. Please retry.', { recoverable: true, cause: this.toError(error), context: 'chat' });
        }
    }

    private getToolsDefinition() {
        return [
            {
                type: 'function',
                function: {
                    name: 'getRecentLogs',
                    description: "Get the user's daily activity logs for the last N days.",
                    parameters: { type: 'object', properties: { days: { type: 'number', description: 'Number of days to look back' } }, required: ['days'] },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getUserActivity',
                    description: "Get high-resolution system activity (clicks, navigation) for the last N minutes.",
                    parameters: { type: 'object', properties: { minutes: { type: 'number', description: 'Minutes to look back' } }, required: ['minutes'] },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'getDSAStats',
                    description: 'Get statistics about solved DSA problems.',
                    parameters: { type: 'object', properties: { topic: { type: 'string', description: 'Topic filter' }, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] } } },
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
                    parameters: { type: 'object', properties: { status: { type: 'string', description: 'Filter by status (e.g. learning, learned)' } } },
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
                    description: "Search the universal RAG vector database for semantically relevant learning notes, projects, DSA approaches, system designs, OR uploaded document content (e.g. PDFs, source code). Use this for any 'Ask anything' questions across all your data.",
                    parameters: { type: 'object', properties: { query: { type: 'string', description: 'The semantic search query' } }, required: ['query'] },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'listChatAttachments',
                    description: "List all files/attachments currently uploaded in this conversation.",
                    parameters: { type: 'object', properties: { conversationId: { type: 'string', description: 'The ID of the conversation to list attachments for.' } }, required: ['conversationId'] },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'analyzeWorkspaceData',
                    description: "Perform a professional data analysis on workspace data OR uploaded attachments (PDFs, Source Code). Returns high-level insights and charts. Use this ONLY when the user asks to analyze, find trends, or generate charts for documents they have uploaded.",
                    parameters: { type: 'object', properties: { query: { type: 'string', description: 'The specific analysis question or trend to look for.' }, dataType: { type: 'string', enum: ['attachments', 'logs', 'roadmap', 'dsa', 'topics', 'projects', 'all'], description: 'The source of data to analyze. Defaults to attachments if not specified.' }, conversationId: { type: 'string', description: 'The ID of the current conversation to scope attachment analysis.' } } },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'fetchRepoFile',
                    description: 'Fetch the full content of a specific file from a GitHub repository. Use this after reviewGitHubRepo if you need to see the implementation details of a specific file.',
                    parameters: {
                        type: 'object',
                        properties: {
                            repoUrl: { type: 'string', description: 'Full URL to the GitHub repository' },
                            path: { type: 'string', description: 'Relative path to the file (e.g., src/app.ts)' },
                        },
                        required: ['repoUrl', 'path'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'reviewGitHubRepo',
                    description: 'Review an external GitHub repository for code quality and architecture. IMPORTANT: If the tool returns an error (e.g., repo not found), you MUST report the error to the user and STOP. NEVER hallucinate or guess the project structure if the tool fails.',
                    parameters: { type: 'object', properties: { repoUrl: { type: 'string', description: 'Full URL to the GitHub repository' } }, required: ['repoUrl'] },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'scrapeWebpage',
                    description: 'Fetch and extract readable text content from a webpage URL.',
                    parameters: { type: 'object', properties: { url: { type: 'string', description: 'The absolute URL to scrape' } }, required: ['url'] },
                },
            },
        ];
    }

    protected async *executeTool(
        name: string,
        args: Record<string, unknown>
    ): AsyncGenerator<string, any> {
        if (!this.userId) return { status: 'error', message: 'User context missing' };
        const userIdStr = this.userId.toString();
        console.log(`\n🛠️  [AIClient] EXECUTE TOOL: ${name} (Args: ${JSON.stringify(args)})`);
        const progressQueue: string[] = [];
        const onProgress = (msg: string) => progressQueue.push(msg);

        const executePromise = (async () => {
            try {
                switch (name) {
                    case 'getRecentLogs': {
                        const days = Math.min(Math.max(Number(args.days) || 7, 1), 30);
                        return await DailyLog.find({ userId: userIdStr }).sort({ date: -1 }).limit(days) .lean();
                    }
                    case 'getUserActivity': {
                        const minutes = Math.min(Math.max(Number(args.minutes) || 10, 1), 180);
                        const since = new Date(Date.now() - minutes * 60 * 1000);
                        return await UserActivity.find({ userId: userIdStr, timestamp: { $gte: since } }).sort({ timestamp: -1 }).limit(20) .lean();
                    }
                    case 'getDSAStats': {
                        const query: Record<string, unknown> = { userId: userIdStr, status: 'solved' };
                        if (typeof args.topic === 'string' && args.topic.trim().length > 0) query.topic = new RegExp(args.topic.trim(), 'i');
                        if (args.difficulty === 'easy' || args.difficulty === 'medium' || args.difficulty === 'hard') query.difficulty = args.difficulty;
                        const count = await DSAProblem.countDocuments(query);
                        const problems = await DSAProblem.find(query).select('problemName difficulty topic date').limit(5).lean();
                        return { totalSolved: count, recent: problems };
                    }
                    case 'getRoadmap': {
                        const [nodes, edges] = await Promise.all([ RoadmapNode.find({ userId: userIdStr }).lean(), RoadmapEdge.find({ userId: userIdStr }).lean() ]);
                        return { nodes, edges };
                    }
                    case 'getBackendTopics': {
                        const query: Record<string, unknown> = { userId: userIdStr };
                        if (typeof args.status === 'string' && args.status.trim().length > 0) query.status = args.status.trim().toLowerCase();
                        return await BackendTopic.find(query).select('topicName category status nextReviewDate subTopics reviewStage').limit(30).lean();
                    }
                    case 'getProjectStudies': {
                        return await ProjectStudy.find({ user: userIdStr }).sort({ updatedAt: -1 }).limit(10).select('projectName moduleStudied flowUnderstanding coreComponents keyTakeaways tasks updatedAt').lean();
                    }
                    case 'getInterviewHistory': {
                        return await InterviewSession.find({ userId: userIdStr }).sort({ updatedAt: -1 }).limit(5).select('status totalScore overallFeedback startedAt endedAt config.difficulty config.language analytics').lean();
                    }
                    case 'searchKnowledgeBase': {
                        onProgress('SEARCHING:Knowledge Base...');
                        const query = typeof args.query === 'string' ? args.query.trim() : '';
                        if (!query) return { status: 'error', message: 'Query is required', results: [] };
                        const embedding = await embeddingService.generateEmbedding(query);
                        const results = await vectorService.findSimilar(userIdStr, embedding, 10, { type: { "$in": ['BackendTopic', 'ProjectStudy', 'DSAProblem', 'InterviewSession', 'ChatAttachment'] } });
                        return { results: results.map((result) => ({ id: result.id, score: result.score, type: result.type, title: result.title, content: (result.content || '').slice(0, 1200), metadata: result.metadata })) };
                    }
                    case 'listChatAttachments': {
                        const conversationId = (args.conversationId as string) || (args.sessionId as string);
                        const attachments = await chatRagService.getAttachments(userIdStr, conversationId);
                        return { count: attachments.length, files: attachments.map(a => a.fileName) };
                    }
                    case 'analyzeWorkspaceData': {
                        const query = typeof args.query === 'string' ? args.query.trim() : 'general overview';
                        onProgress(`ANALYZING:${query}...`);
                        const dataType = typeof args.dataType === 'string' ? args.dataType.trim() : 'attachments';
                        let dataToAnalyze: string[] = [];
                        if (dataType === 'attachments' || dataType === 'all') {
                            const embedding = await embeddingService.generateEmbedding(query);
                            const conversationId = (args.conversationId as string) || (args.sessionId as string);
                            const where: any = { type: 'ChatAttachment' };
                            if (conversationId) where.conversationId = conversationId;
                            const results = await vectorService.findSimilar(userIdStr, embedding, 15, where);
                            dataToAnalyze.push(...results.map(r => r.content || ''));
                        }
                        if (dataType === 'logs' || dataType === 'all') {
                            const logs = await DailyLog.find({ userId: userIdStr }).sort({ date: -1 }).limit(30).lean();
                            dataToAnalyze.push("DAILY ACTIVITY LOGS:\n" + JSON.stringify(logs, null, 2));
                        }
                        if (dataType === 'roadmap' || dataType === 'all') {
                            const [nodes, edges] = await Promise.all([ RoadmapNode.find({ userId: userIdStr }).lean(), RoadmapEdge.find({ userId: userIdStr }).lean() ]);
                            dataToAnalyze.push("LEARNING ROADMAP DATA:\n" + JSON.stringify({ nodes, edges }, null, 2));
                        }
                        if (dataType === 'dsa' || dataType === 'all') {
                            const solved = await DSAProblem.find({ userId: userIdStr, status: 'solved' }).lean();
                            dataToAnalyze.push("DSA SOLVED PROBLEMS:\n" + JSON.stringify(solved, null, 2));
                        }
                        if (dataType === 'topics' || dataType === 'all') {
                            const topics = await BackendTopic.find({ userId: userIdStr }).lean();
                            dataToAnalyze.push("BACKEND LEARNING TOPICS:\n" + JSON.stringify(topics, null, 2));
                        }
                        if (dataType === 'projects' || dataType === 'all') {
                            const projects = await ProjectStudy.find({ user: userIdStr }).lean();
                            dataToAnalyze.push("PROJECT ARCHITECTURE STUDIES:\n" + JSON.stringify(projects, null, 2));
                        }
                        if (dataToAnalyze.length === 0) return { status: 'error', message: `No ${dataType} data found to analyze.` };
                        return await chatToolsService.analyzeData(dataToAnalyze, query);
                    }
                    case 'reviewGitHubRepo': {
                        const repoUrl = args.repoUrl as string;
                        const modelRequester = async (p: string) => this.chatInternal(p, [], false);
                        const result = await chatToolsService.reviewGitHubRepo(repoUrl, modelRequester, onProgress);
                        if (result.status === 'ok' && (result as any).metadata) {
                            onProgress(`__RAW__:[REPO_CARD:${JSON.stringify((result as any).metadata)}]`);
                        }
                        return result;
                    }
                    case 'fetchRepoFile': {
                        const repoUrl = args.repoUrl as string;
                        const path = args.path as string;
                        onProgress(`FETCHING:${path}...`);
                        return await chatToolsService.fetchRepoFile(repoUrl, path);
                    }
                    case 'scrapeWebpage': {
                        const url = typeof args.url === 'string' ? args.url.trim() : '';
                        onProgress(`SCRAPING:${url}...`);
                        return await chatToolsService.scrapeWebpage(url);
                    }
                    default: return { status: 'error', message: `Tool ${name} not implemented` };
                }
            } catch (error) {
                console.error(`Error executing tool ${name}:`, error);
                return { status: 'error', message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}` };
            }
        })();

        while (true) {
            const result = await Promise.race([ executePromise.then(res => ({ done: true, res })), new Promise(resolve => setTimeout(() => resolve({ done: false }), 200)) ]) as { done: boolean, res?: any };
            while (progressQueue.length > 0) { 
                const msg = progressQueue.shift();
                if (msg?.startsWith('__RAW__:')) {
                    yield msg.replace('__RAW__:', '');
                } else {
                    yield `__PROGRESS__:${msg}`;
                }
            }
            if (result.done) return result.res;
        }
    }
}
