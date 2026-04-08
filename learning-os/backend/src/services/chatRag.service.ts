import { ChatAttachment } from '../models/ChatAttachment';
import { vectorService } from './vector.service';
import { embeddingService } from './embedding.service';
import * as mammoth from 'mammoth';
import * as xlsx from 'xlsx';
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
        '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.lua', '.r',
        '.xlsx', '.xls'
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
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
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
        } else if (
            normalizedType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            normalizedType === 'application/vnd.ms-excel' ||
            fileName?.endsWith('.xlsx') ||
            fileName?.endsWith('.xls')
        ) {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            let sheetText = '';
            workbook.SheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                sheetText += `Sheet: ${name}\n${xlsx.utils.sheet_to_csv(sheet)}\n\n`;
            });
            return sheetText;
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
     * Chunk text into smaller segments for better retrieval using a recursive strategy.
     * Respects code blocks, paragraphs, and sentences to maintain semantic integrity.
     */
    private chunkText(text: string, size: number = 1500, overlap: number = 200, fileName?: string): string[] {
        const normalizedText = text.trim();
        if (normalizedText.length <= size) return [normalizedText];

        const extension = fileName ? fileName.split('.').pop()?.toLowerCase() : 'txt';
        const isCode = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'cpp', 'c', 'h', 'java'].includes(extension || '');

        // Hierarchical separators for recursive splitting
        const separators = isCode 
            ? ["\n\n", "\n", " ", ""] // Focus on line breaks for code
            : ["\n\n", "\n", ". ", " ", ""];

        const split = (input: string, depth: number): string[] => {
            if (input.length <= size || depth >= separators.length) {
                return [input];
            }

            const sep = separators[depth];
            const parts = input.split(sep);
            const finalChunks: string[] = [];
            let currentStr = "";

            for (const part of parts) {
                const potential = currentStr ? currentStr + sep + part : part;
                if (potential.length > size) {
                    if (currentStr) finalChunks.push(currentStr.trim());
                    
                    // If the part itself is too big, recurse deeper
                    if (part.length > size) {
                        finalChunks.push(...split(part, depth + 1));
                        currentStr = "";
                    } else {
                        currentStr = part;
                    }
                } else {
                    currentStr = potential;
                }
            }

            if (currentStr) finalChunks.push(currentStr.trim());
            return finalChunks;
        };

        const rawChunks = split(normalizedText, 0);

        // Apply overlap for better context continuity
        if (overlap <= 0) return rawChunks;

        const overlapped: string[] = [];
        for (let i = 0; i < rawChunks.length; i++) {
            let chunk = rawChunks[i];
            if (i > 0) {
                const prev = rawChunks[i-1];
                const overlapPrefix = prev.slice(-overlap);
                chunk = overlapPrefix + chunk;
            }
            overlapped.push(chunk);
        }

        return overlapped;
    }


    /**
     * Index a file for a specific chat conversation
     */
    async indexFile(
        userId: string,
        conversationId: string,
        fileName: string,
        fileType: string,
        buffer: Buffer
    ): Promise<string> {
        const attachment = new ChatAttachment({
            userId: new mongoose.Types.ObjectId(userId),
            conversationId: new mongoose.Types.ObjectId(conversationId),
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
                            conversationId,
                            attachmentId: attachment._id.toString()
                        }
                    });
                    
                    vectorIds.push(chunkId);
                })
            );

            await Promise.all(indexPromises);
            console.log(`[ChatRagService] SUCCESS: 100% of ${fileName} indexed into ${chunks.length} chunks for retrieval.`);

            attachment.status = 'completed';
            attachment.vectorIds = vectorIds;
            await attachment.save();

            return attachment._id.toString();
        } catch (error: any) {
            console.error(`[ChatRagService] Indexing failed for ${fileName}:`, error);
            await ChatAttachment.updateOne(
                { _id: attachment._id },
                { $set: { status: 'failed', errorMessage: error.message } }
            );
            throw error;
        }
    }

    /**
     * Index multiple files in parallel (Bulk Upload)
     */
    async indexFilesBulk(
        userId: string,
        conversationId: string,
        files: Array<{ name: string; type: string; buffer: Buffer }>
    ): Promise<string[]> {
        console.log(`[ChatRagService] Bulk indexing ${files.length} files for conversation ${conversationId}`);
        
        const results = await Promise.allSettled(
            files.map(file => this.indexFile(userId, conversationId, file.name, file.type, file.buffer))
        );

        const succeeded = results
            .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
            .map(r => r.value);
        
        const failedCount = results.filter(r => r.status === 'rejected').length;
        if (failedCount > 0) {
            console.warn(`[ChatRagService] Bulk indexing partial failure: ${failedCount} files failed.`);
        }

        return succeeded;
    }

    async retrieveContext(userId: string, conversationId: string, query: string, attachmentIds?: string[], limit: number = 18): Promise<string> {
        try {
            // Mark conversation activity
            await ChatAttachment.updateMany(
                { conversationId, status: 'completed' },
                { $set: { lastAccessed: new Date() } }
            );

            console.log(`[ChatRagService] Retrieval attempt for conversationId: ${conversationId}, query: "${query.slice(0, 30)}..."`);

            const queryEmbedding = await embeddingService.generateEmbedding(query);
            
            // Build optimized ChromaDB filter
            let whereFilter: any = { conversationId };
            if (attachmentIds && attachmentIds.length > 0) {
                whereFilter = {
                    conversationId,
                    attachmentId: attachmentIds.length === 1 ? attachmentIds[0] : { "$in": attachmentIds }
                };
            }
            
            const results = await vectorService.findSimilar(userId, queryEmbedding, limit, whereFilter);
            
            if (results.length === 0) {
                console.log(`[ChatRagService] No results found for query: "${query.slice(0, 50)}..."`);
                return '';
            }

            console.log(`[ChatRagService] Found ${results.length} relevant chunks for context.`);

            const grouped = results.reduce((acc: Record<string, string[]>, r) => {
                const title = r.title || 'Unknown Document';
                if (!acc[title]) acc[title] = [];
                if (acc[title].length < 4) {
                    acc[title].push(r.content);
                }
                return acc;
            }, {});

            let contextText = '### RELEVANT DOCUMENT CONTEXT\n';
            contextText += 'Retrieved relevant segments from your workspace. Ground the answer in these excerpts and cite them as (Source: <filename>).\n\n';

            for (const [title, chunks] of Object.entries(grouped).slice(0, 6)) {
                contextText += `#### Source: ${title}\n`;
                (chunks as string[]).forEach((chunk) => {
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
     * Delete all RAG data for a conversation
     */
    async deleteConversationData(conversationId: string): Promise<void> {
        try {
            const attachments = await ChatAttachment.find({ conversationId });
            for (const att of attachments) {
                for (const vid of att.vectorIds) {
                    await vectorService.deleteDocument(vid);
                }
                await att.deleteOne();
            }
            console.log(`[ChatRagService] Cleaned up all attachments for conversation ${conversationId}`);
        } catch (error) {
            console.error(`[ChatRagService] Failed to delete conversation data for ${conversationId}:`, error);
        }
    }


    /**
     * Get all attachments for a conversation
     */
    async getAttachments(userId: string, conversationId: string) {
        return await ChatAttachment.find({ 
            userId, 
            conversationId: new mongoose.Types.ObjectId(conversationId) 
        }).lean();
    }

    /**
     * Cleanup inactive conversation data
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
