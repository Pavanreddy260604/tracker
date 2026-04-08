import { chatToolsService } from '../../services/chatTools.service.js';
import axios from 'axios';
import { Groq } from 'groq-sdk';

// Mock dependencies
jest.mock('axios');
jest.mock('groq-sdk');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatToolsService - Elite Reviewer', () => {
    const mockRepoUrl = 'https://github.com/test-owner/test-repo';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GROQ_API_KEY = 'test-key';
    });

    it('should perform a recursive Elite review successfully', async () => {
        // 1. Mock Repo Info (default branch)
        mockedAxios.get.mockResolvedValueOnce({ data: { default_branch: 'main' } });

        // 2. Mock Recursive Tree
        const mockTree = [
            { path: 'package.json', type: 'blob', url: 'url1' },
            { path: 'src/index.ts', type: 'blob', url: 'url2' },
            { path: 'src/infra/db.ts', type: 'blob', url: 'url3' },
            { path: 'docs/architecture.md', type: 'tree', url: 'url4' }
        ];
        mockedAxios.get.mockResolvedValueOnce({ data: { tree: mockTree } });

        // 3. Mock File Content (Base64 encoded)
        mockedAxios.get.mockImplementation((url: string) => {
            if (url === 'url1') return Promise.resolve({ data: { content: Buffer.from('{"name": "test"}').toString('base64') } });
            if (url === 'url2') return Promise.resolve({ data: { content: Buffer.from('console.log("main")').toString('base64') } });
            if (url === 'url3') return Promise.resolve({ data: { content: Buffer.from('db.connect()').toString('base64') } });
            return Promise.reject(new Error('Unknown URL'));
        });

        // 4. Mock Groq Completion
        const mockResponse = 'Expert elite audit report contents.';
        const mockCreate = jest.fn().mockResolvedValue({
            choices: [{ message: { content: mockResponse } }]
        });
        
        // Fix for mocking named exports
        const mockedGroq = Groq as jest.MockedClass<typeof Groq>;
        mockedGroq.prototype.chat = {
            completions: {
                create: mockCreate
            }
        } as any;

        const result = await chatToolsService.reviewGitHubRepo(mockRepoUrl);

        // Verification
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') throw new Error('Expected successful review');
        expect(result.report).toBe(mockResponse);
        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('/git/trees/main?recursive=1'),
            expect.any(Object)
        );
        expect(result.metadata.structureSize).toBe(4);
        expect(result.metadata.fileCount).toBeGreaterThan(0);
        expect(result.metadata.defaultBranch).toBe('main');
        
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                messages: [
                    expect.objectContaining({
                        content: expect.stringMatching(/### PRIORITIZED FILE CONTENTS[\s\S]*### STRUCTURE SNAPSHOT/)
                    })
                ]
            })
        );
    });

    it('should handle invalid GitHub URLs gracefully', async () => {
        const result = await chatToolsService.reviewGitHubRepo('https://not-github.com/bad/link');
        expect(result.status).toBe('error');
        if (result.status !== 'error') throw new Error('Expected invalid URL failure');
        expect(result.message).toContain('Invalid GitHub URL format');
    });

    it('should handle API failures gracefully', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('GitHub API Down'));
        
        const result = await chatToolsService.reviewGitHubRepo(mockRepoUrl);
        expect(result.status).toBe('error');
        if (result.status !== 'error') throw new Error('Expected API failure');
        expect(result.message).toContain('GitHub review failed: GitHub API Down');
    });
});
