import { ChatRagService } from '../../services/chatRag.service';
import { ChatAttachment } from '../../models/ChatAttachment';
import { vectorService } from '../../services/vector.service';
import { embeddingService } from '../../services/embedding.service';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

// Mock the dependencies
jest.mock('../../services/vector.service');
jest.mock('../../services/embedding.service');
jest.mock('../../models/ChatAttachment');

describe('ChatRagService', () => {
    let chatRagService: ChatRagService;
    const userId = new mongoose.Types.ObjectId().toString();
    const conversationId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
        chatRagService = new ChatRagService();
        
        // Setup default mock implementation for ChatAttachment constructor and save
        (ChatAttachment as any).prototype.save = jest.fn().mockResolvedValue(undefined);
        (ChatAttachment as any).prototype._id = new mongoose.Types.ObjectId();
    });

    describe('indexFile', () => {
        it('should successfully index a text file', async () => {
            const fileName = 'test.txt';
            const fileType = 'text/plain';
            const buffer = Buffer.from('This is a test document content for RAG.');
            const mockId = new mongoose.Types.ObjectId();

            // Mock instance properties
            (ChatAttachment as any).prototype._id = mockId;
            (ChatAttachment as any).prototype.save = jest.fn().mockResolvedValue(undefined);
            
            // Mock static methods
            (ChatAttachment.findById as jest.Mock).mockResolvedValue({
                _id: mockId,
                fileName,
                conversationId: new mongoose.Types.ObjectId(conversationId),
                status: 'completed'
            });

            (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue(new Array(1024).fill(0.1));
            (vectorService.upsertDocument as jest.Mock).mockResolvedValue(undefined);

            const attachmentId = await chatRagService.indexFile(userId, conversationId, fileName, fileType, buffer);

            expect(attachmentId).toBe(mockId.toString());
            expect(vectorService.upsertDocument).toHaveBeenCalled();
        });

        it('should throw error if no text is extracted', async () => {
            const fileName = 'empty.txt';
            const fileType = 'text/plain';
            const buffer = Buffer.from('');

            await expect(chatRagService.indexFile(userId, conversationId, fileName, fileType, buffer))
                .rejects.toThrow('No readable text found in file');
            
            // Should update status to failed
            expect(ChatAttachment.updateOne as jest.Mock).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ $set: expect.objectContaining({ status: 'failed' }) })
            );
        });
    });

    describe('indexFilesBulk', () => {
        it('should index multiple files in parallel', async () => {
            const files = [
                { name: 'file1.txt', type: 'text/plain', buffer: Buffer.from('Content 1') },
                { name: 'file2.txt', type: 'text/plain', buffer: Buffer.from('Content 2') }
            ];

            const mockId1 = new mongoose.Types.ObjectId();
            const mockId2 = new mongoose.Types.ObjectId();

            // This is tricky with multiple instances, but indexFile is called sequentially in map
            // We can use mockImplementationOnce
            (ChatAttachment as any).prototype.save = jest.fn()
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            
            (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue(new Array(1024).fill(0.1));

            const attachmentIds = await chatRagService.indexFilesBulk(userId, conversationId, files);

            expect(attachmentIds).toHaveLength(2);
        });
    });

    describe('retrieveContext', () => {
        it('should return relevant context from vector search', async () => {
            const query = 'test query';
            const mockChunks = [
                { id: '1', score: 0.9, title: 'file1.txt', content: 'chunk 1 content', metadata: {} },
                { id: '2', score: 0.8, title: 'file1.txt', content: 'chunk 2 content', metadata: {} }
            ];

            (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue(new Array(1024).fill(0.1));
            (vectorService.findSimilar as jest.Mock).mockResolvedValue(mockChunks);

            const context = await chatRagService.retrieveContext(userId, conversationId, query);

            expect(context).toContain('RELEVANT DOCUMENT CONTEXT');
            expect(context).toContain('chunk 1 content');
            expect(context).toContain('file1.txt');
            expect(vectorService.findSimilar).toHaveBeenCalledWith(
                userId,
                expect.any(Array),
                18,
                { conversationId }
            );
        });

        it('should scope retrieval to explicit attachment ids when provided', async () => {
            const query = 'test query';
            const attachmentIds = ['att-1', 'att-2'];
            (embeddingService.generateEmbedding as jest.Mock).mockResolvedValue(new Array(1024).fill(0.1));
            (vectorService.findSimilar as jest.Mock).mockResolvedValue([
                { id: '1', score: 0.92, title: 'report.pdf', content: 'targeted chunk', metadata: {} }
            ]);

            const context = await chatRagService.retrieveContext(userId, conversationId, query, attachmentIds);

            expect(context).toContain('report.pdf');
            expect(vectorService.findSimilar).toHaveBeenCalledWith(
                userId,
                expect.any(Array),
                18,
                {
                    conversationId,
                    attachmentId: { "$in": attachmentIds }
                }
            );
        });
    });
});
