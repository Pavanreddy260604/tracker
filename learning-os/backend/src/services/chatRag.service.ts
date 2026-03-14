import { ChatAttachment } from '../models/ChatAttachment';
import { vectorService } from './vector.service';
import { embeddingService } from './embedding.service';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import pLimit from 'p-limit';

export class ChatRagService {
    private limit = pLimit(3); // Limit concurrent embeddings to avoid overloading Ollama

    /**
     * Parse file content based on type
     */
    private async extractText(buffer: Buffer, fileType: string): Promise<string> {
        if (fileType === 'application/pdf') {
            const data = await (pdf as any)(buffer);
            return data.text;
        } else if (
            fileType === 'application/msword' ||
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (fileType.startsWith('text/') || fileType === 'application/json') {
            return buffer.toString('utf-8');
        }
        return '';
    }

    /**
     * Chunk text into smaller segments for better retrieval
     */
    private chunkText(text: string, size: number = 1000, overlap: number = 100): string[] {
        const chunks: string[] = [];
        let start = 0;
        const normalizedText = text.replace(/\s+/g, ' ').trim();

        while (start < normalizedText.length) {
            const end = start + size;
            chunks.push(normalizedText.slice(start, end));
            start += (size - overlap);
        }
        return chunks;
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
            const text = await this.extractText(buffer, fileType);
            if (!text.trim()) {
                throw new Error("No readable text found in file.");
            }

            const chunks = this.chunkText(text);
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

    async retrieveContext(userId: string, sessionId: string, query: string, attachmentIds?: string[], limit: number = 4): Promise<string> {
        try {
            // Lifecycle: Update lastAccessed for these attachments so they aren't cleaned up
            await ChatAttachment.updateMany(
                { sessionId, status: 'completed' },
                { $set: { lastAccessed: new Date() } }
            );

            const queryEmbedding = await embeddingService.generateEmbedding(query);
            
            // Build optimized ChromaDB filter
            let whereFilter: any = { sessionId };
            
            // If specific attachments are targeted, filter by them too
            if (attachmentIds && attachmentIds.length > 0) {
                if (attachmentIds.length === 1) {
                    whereFilter = {
                        "$and": [
                            { sessionId },
                            { attachmentId: attachmentIds[0] }
                        ]
                    };
                } else {
                    whereFilter = {
                        "$and": [
                            { sessionId },
                            { attachmentId: { "$in": attachmentIds } }
                        ]
                    };
                }
            }
            
            const results = await vectorService.findSimilar(userId, queryEmbedding, limit, whereFilter);
            
            if (results.length === 0) return '';

            // Group results by file for better context presentation
            const grouped = results.reduce((acc: any, r) => {
                const title = r.title || 'Unknown Document';
                if (!acc[title]) acc[title] = [];
                acc[title].push(r.content);
                return acc;
            }, {});

            let contextText = '### RELEVANT DOCUMENT CONTEXT\n';
            contextText += 'The following information was retrieved from the user\'s uploaded files for this session.\n\n';

            for (const [title, chunks] of Object.entries(grouped)) {
                contextText += `#### Source: ${title}\n`;
                (chunks as string[]).forEach((chunk, i) => {
                    contextText += `[Excerpt ${i + 1}]:\n${chunk}\n\n`;
                });
            }

            return contextText;
        } catch (error) {
            console.error('[ChatRagService] Retrieval failed:', error);
            return '';
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
