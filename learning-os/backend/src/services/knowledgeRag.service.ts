import { embeddingService } from './embedding.service';
import { vectorService } from './vector.service';

const KNOWLEDGE_TYPES = ['BackendTopic', 'ProjectStudy', 'DSAProblem', 'InterviewSession'] as const;
const MAX_EXCERPT_CHARS = 1200;
const MAX_CONTEXT_CHARS = 4000;

const clampExcerpt = (content: string): string => {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= MAX_EXCERPT_CHARS) return cleaned;
    return `${cleaned.slice(0, MAX_EXCERPT_CHARS)}...`;
};

export class KnowledgeRagService {
    async retrieveContext(userId: string, query: string, limit: number = 4): Promise<string> {
        try {
            if (!query || !query.trim()) return '';

            const queryEmbedding = await embeddingService.generateEmbedding(query);
            const results = await vectorService.findSimilar(
                userId,
                queryEmbedding,
                limit,
                { type: { "$in": KNOWLEDGE_TYPES } }
            );

            if (results.length === 0) return '';

            let contextText = '### RELEVANT KNOWLEDGE BASE CONTEXT\n';
            contextText += 'The following information was retrieved from your Learning OS knowledge base.\n\n';

            for (const result of results) {
                const title = result.title || 'Untitled';
                const type = result.type || 'Unknown';
                const excerpt = clampExcerpt(result.content || '');
                const block = `#### ${type}: ${title}\n${excerpt}\n\n`;

                if (contextText.length + block.length > MAX_CONTEXT_CHARS) {
                    contextText += '#### Additional context truncated due to length limits.\n';
                    break;
                }

                contextText += block;
            }

            return contextText.trim();
        } catch (error) {
            console.error('[KnowledgeRagService] Retrieval failed:', error);
            return '';
        }
    }
}

export const knowledgeRagService = new KnowledgeRagService();
