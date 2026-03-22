import { ChatAttachment } from '../models/ChatAttachment';
import { vectorService } from './vector.service';
import { embeddingService } from './embedding.service';
import * as mammoth from 'mammoth';
import mongoose from 'mongoose';

function createConcurrencyLimiter(concurrency: number) {
    let activeCount = 0;
    const queue: Array<() => void> = [];

    const next = () => {
        activeCount -= 1;
        const runNext = queue.shift();
        if (runNext) runNext();
    };

    return async <T>(task: () => Promise<T>): Promise<T> => {
        if (activeCount >= concurrency) {
            await new Promise<void>((resolve) => {
                queue.push(resolve);
            });
        }

        activeCount += 1;

        try {
            return await task();
        } finally {
            next();
        }
    };
}

export class ChatRagService {
    private limit = createConcurrencyLimiter(3); // Limit concurrent embeddings to avoid overloading Ollama
    private static readonly TEXT_EXTENSIONS = new Set([
        '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.scss', '.sass',
        '.html', '.htm', '.xml', '.csv', '.yml', '.yaml', '.toml', '.ini', '.conf', '.log', '.env',
        '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
        '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.lua', '.r'
    ]);

    private static readonly TEXT_MIME_TYPES = new Set([
        'application/json',
        'application/javascript',
        'application/x-javascript',
        'application/typescript',
        'application/x-typescript',
        'application/xml',
        'text/xml',
        'text/markdown',
        'text/x-markdown',
        'text/csv',
        'application/csv',
        'application/x-yaml',
        'text/yaml',
        'text/x-yaml',
        'application/x-sh',
        'text/x-shellscript',
        'text/x-python',
        'application/x-python',
        'application/x-httpd-php',
        'text/x-java-source',
        'text/x-c',
        'text/x-c++',
        'text/x-go',
        'text/x-rust',
        'text/x-sql',
    ]);

    /**
     * Parse file content based on type
     */
    private async extractText(buffer: Buffer, fileType: string, fileName?: string): Promise<string> {
        const normalizedType = (fileType || '').toLowerCase();
        if (normalizedType === 'application/pdf') {
            const { PDFParse } = await import('pdf-parse');
            const parser = new PDFParse({ data: buffer });
            try {
                const result = await parser.getText();
                return result.text || '';
            } finally {
                await parser.destroy().catch(() => undefined);
            }
        } else if (
            normalizedType === 'application/msword' ||
            normalizedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (normalizedType.startsWith('text/') || ChatRagService.TEXT_MIME_TYPES.has(normalizedType)) {
            return buffer.toString('utf-8');
        } else if (this.hasTextExtension(fileName)) {
            return buffer.toString('utf-8');
        } else if (this.isProbablyText(buffer)) {
            return buffer.toString('utf-8');
        }
        return '';
    }

    private hasTextExtension(fileName?: string): boolean {
        if (!fileName) return false;
        const lower = fileName.toLowerCase();
        const dotIndex = lower.lastIndexOf('.');
        if (dotIndex === -1) return false;
        const ext = lower.slice(dotIndex);
        return ChatRagService.TEXT_EXTENSIONS.has(ext);
    }

    private isProbablyText(buffer: Buffer): boolean {
        const sample = buffer.slice(0, 2048);
        if (sample.length === 0) return false;

        let printable = 0;
        for (let i = 0; i < sample.length; i++) {
            const byte = sample[i];
            if (byte === 0) return false; // null byte => likely binary
            if (
                byte === 9 ||
                byte === 10 ||
                byte === 13 ||
                (byte >= 32 && byte <= 126) ||
                byte >= 128
            ) {
                printable += 1;
            }
        }

        return printable / sample.length > 0.8;
    }

    /**
     * Chunk text into smaller segments for better retrieval using a recursive strategy
     */
    private chunkText(text: string, size: number = 1000, overlap: number = 200): string[] {
        const chunks: string[] = [];
        const normalizedText = text.trim();

        // 1. Split by double newlines (paragraphs/code blocks)
        const paragraphs = normalizedText.split(/\n\n+/);
        
        let currentChunk = "";

        for (const para of paragraphs) {
            // If adding this paragraph exceeds size, push current and start new
            if (currentChunk.length + para.length > size) {
                if (currentChunk) chunks.push(currentChunk.trim());
                
                // If paragraph itself is huge, split by single newline or sentence
                if (para.length > size) {
                    const lines = para.split(/\n/);
                    for (const line of lines) {
                        if (currentChunk.length + line.length > size) {
                            if (currentChunk) chunks.push(currentChunk.trim());
                            currentChunk = line + "\n";
                        } else {
                            currentChunk += line + "\n";
                        }
                    }
                } else {
                    currentChunk = para + "\n\n";
                }
            } else {
                currentChunk += para + "\n\n";
            }
        }

        if (currentChunk) chunks.push(currentChunk.trim());
        
        // Final pass: Ensure no chunks are truly massive (safety)
        const finalChunks: string[] = [];
        for (const chunk of chunks) {
            if (chunk.length > size + overlap) {
                for (let i = 0; i < chunk.length; i += size - overlap) {
                    finalChunks.push(chunk.slice(i, i + size));
                }
            } else {
                finalChunks.push(chunk);
            }
        }

        return finalChunks;
    }


    /**
     * Index a file for a specific chat session
     */
    async indexFile(
        userId: string,
        sessionId: string,
        fileName: string,
        fileType: string,
        buffer: Buffer
    ): Promise<string> {
        const attachment = new ChatAttachment({
            userId: new mongoose.Types.ObjectId(userId),
            sessionId: new mongoose.Types.ObjectId(sessionId),
            fileName,
            fileType,
            fileSize: buffer.length,
            status: 'indexing'
        });

        await attachment.save();

        try {
            console.log(`[ChatRagService] Indexing file: ${fileName} (${fileType}, ${buffer.length} bytes)`);
            const text = await this.extractText(buffer, fileType, fileName);
            
            if (!text || !text.trim()) {
                console.warn(`[ChatRagService] No text extracted from ${fileName}. Content might be empty or unreadable.`);
                throw new Error("No readable text found in file. Please ensure it is a valid, text-containing file.");
            }

            console.log(`[ChatRagService] Extracted ${text.length} characters from ${fileName}.`);

            const chunks = this.chunkText(text);
            console.log(`[ChatRagService] Split ${fileName} into ${chunks.length} chunks.`);
            
            const vectorIds: string[] = [];

            // Index chunks in batches
            const indexPromises = chunks.map((chunk, index) => 
                this.limit(async () => {
                    const chunkId = `chat_att_${attachment._id}_${index}`;
                    const embedding = await embeddingService.generateEmbedding(chunk);
                    
                    await vectorService.upsertDocument({
                        _id: chunkId,
                        userId,
                        type: 'ChatAttachment',
                        title: fileName,
                        content: chunk,
                        embedding,
                        metadata: {
                            sessionId,
                            attachmentId: attachment._id.toString()
                        }
                    });
                    
                    vectorIds.push(chunkId);
                })
            );

            await Promise.all(indexPromises);
            console.log(`[ChatRagService] Successfully indexed ${chunks.length} chunks for ${fileName}.`);

            attachment.status = 'completed';
            attachment.vectorIds = vectorIds;
            await attachment.save();

            return attachment._id.toString();
        } catch (error: any) {
            console.error(`[ChatRagService] Indexing failed for ${fileName}:`, error);
            attachment.status = 'failed';
            attachment.errorMessage = error.message;
            await attachment.save();
            throw error;
        }
    }

    async retrieveContext(userId: string, sessionId: string, query: string, attachmentIds?: string[], limit: number = 10): Promise<string> {
        try {
            // Mark session activity
            await ChatAttachment.updateMany(
                { sessionId, status: 'completed' },
                { $set: { lastAccessed: new Date() } }
            );

            const queryEmbedding = await embeddingService.generateEmbedding(query);
            
            // Build optimized ChromaDB filter
            let whereFilter: any = { sessionId };

            /**
             * Multi-File Optimization:
             * If we have many specific target attachments, check total session attachments.
             * If the target set is large (e.g. > 10), it's more efficient to just filter by sessionId 
             * and let the semantic search find the most relevant chunks across all files.
             */
            if (attachmentIds && attachmentIds.length > 0) {
                if (attachmentIds.length <= 10) {
                    whereFilter = { 
                        sessionId, 
                        attachmentId: attachmentIds.length === 1 ? attachmentIds[0] : { "$in": attachmentIds } 
                    };
                } else {
                    console.log(`[ChatRagService] Large attachment set (${attachmentIds.length}). Using session-wide filter.`);
                    whereFilter = { sessionId };
                }
            }
            
            const results = await vectorService.findSimilar(userId, queryEmbedding, limit, whereFilter);
            
            if (results.length === 0) {
                console.log(`[ChatRagService] No results found for query: "${query.slice(0, 50)}..."`);
                return '';
            }

            console.log(`[ChatRagService] Found ${results.length} relevant chunks for context.`);

            // Group results by file for better context presentation
            const grouped = results.reduce((acc: any, r) => {
                const title = r.title || 'Unknown Document';
                if (!acc[title]) acc[title] = [];
                acc[title].push(r.content);
                return acc;
            }, {});

            let contextText = '### RELEVANT DOCUMENT CONTEXT\n';
            contextText += 'The following information was retrieved from the user\'s uploaded files for this session. ABSOLUTELY ground your answer in this text if it is relevant. If you cite something, use (Source: <filename>).\n\n';

            for (const [title, chunks] of Object.entries(grouped)) {
                contextText += `#### Source: ${title}\n`;
                (chunks as string[]).forEach((chunk, i) => {
                    contextText += `${chunk}\n\n`;
                });
            }

            return contextText;
        } catch (error) {
            console.error('[ChatRagService] Retrieval failed:', error);
            return '';
        }
    }

    /**
     * Delete all RAG data for a session
     */
    async deleteSessionData(sessionId: string): Promise<void> {
        try {
            const attachments = await ChatAttachment.find({ sessionId });
            for (const att of attachments) {
                for (const vid of att.vectorIds) {
                    await vectorService.deleteDocument(vid);
                }
                await att.deleteOne();
            }
            console.log(`[ChatRagService] Cleaned up all attachments for session ${sessionId}`);
        } catch (error) {
            console.error(`[ChatRagService] Failed to delete session data for ${sessionId}:`, error);
        }
    }


    /**
     * Cleanup inactive session data
     */
    async cleanupInactive(days: number = 3): Promise<void> {
        const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const staleAttachments = await ChatAttachment.find({
            lastAccessed: { $lt: threshold }
        });

        for (const attachment of staleAttachments) {
            try {
                // Delete from ChromaDB
                for (const vid of attachment.vectorIds) {
                    await vectorService.deleteDocument(vid);
                }
                // Delete from MongoDB
                await attachment.deleteOne();
                console.log(`[ChatRagService] Cleaned up attachment ${attachment.fileName} (${attachment._id})`);
            } catch (error) {
                console.error(`[ChatRagService] Cleanup failed for ${attachment._id}:`, error);
            }
        }
    }
}

export const chatRagService = new ChatRagService();
