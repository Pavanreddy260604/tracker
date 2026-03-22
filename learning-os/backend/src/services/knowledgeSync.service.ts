import { vectorService, KnowledgeDocument } from './vector.service';
import { embeddingService } from './embedding.service';
import { IBackendTopic } from '../models/BackendTopic';
import { IDSAProblem } from '../models/DSAProblem';
import { IProjectStudy } from '../models/ProjectStudy';

export class KnowledgeSyncService {

    /**
     * Safely executes embedding generation and vector upsert without blocking the main event loop.
     */
    private async syncToVectorSafe(doc: KnowledgeDocument): Promise<void> {
        try {
            const embedding = await embeddingService.generateEmbedding(doc.content);
            await vectorService.upsertDocument({ ...doc, embedding });
            console.log(`[KnowledgeSync] Successfully synced ${doc.type} (${doc._id}) to ChromaDB.`);
        } catch (error) {
            console.error(`[KnowledgeSync] Failed to sync ${doc.type} (${doc._id}):`, error);
        }
    }

    /**
     * Delete from vector DB.
     */
    async deleteFromVector(id: string): Promise<void> {
        try {
            await vectorService.deleteDocument(id);
            console.log(`[KnowledgeSync] Successfully deleted document (${id}) from ChromaDB.`);
        } catch (error) {
            console.error(`[KnowledgeSync] Failed to delete document (${id}):`, error);
        }
    }

    /**
     * Synchronize a BackendTopic to the Vector DB.
     */
    async syncBackendTopic(topic: IBackendTopic): Promise<void> {
        const content = `
[BACKEND TOPIC: ${topic.topicName}]
Category: ${topic.category}
Status: ${topic.status}

# Notes
${topic.notes || 'None'}

# Resources
${topic.resources?.map(r => r.title).join(', ') || 'None'}

# Subtopics
${topic.subTopics?.map(s => `- ${s.text} (${s.isCompleted ? 'Done' : 'Pending'})`).join('\n') || 'None'}
`;

        // Fire and forget so we don't slow down the HTTP response
        this.syncToVectorSafe({
            _id: topic._id.toString(),
            userId: topic.userId.toString(),
            type: 'BackendTopic',
            title: topic.topicName,
            content: content.trim(),
            embedding: []
        });
    }

    /**
     * Synchronize a DSAProblem to the Vector DB.
     */
    async syncDSAProblem(problem: IDSAProblem): Promise<void> {
        const content = `
[DSA PROBLEM: ${problem.problemName}]
Platform: ${problem.platform}
Difficulty: ${problem.difficulty}
Status: ${problem.status}
Tags: ${problem.companyTags?.join(', ') || 'None'}
Time Complexity: ${problem.timeComplexity || 'Unknown'}
Space Complexity: ${problem.spaceComplexity || 'Unknown'}

# Pattern Learned
${problem.patternLearned || 'None'}

# Mistakes to Avoid
${problem.mistakes || 'None'}

# Solution Code
${problem.solutionCode || 'None'}
`;

        this.syncToVectorSafe({
            _id: problem._id.toString(),
            userId: problem.userId.toString(),
            type: 'DSAProblem',
            title: problem.problemName,
            content: content.trim(),
            embedding: []
        });
    }

    /**
     * Synchronize a ProjectStudy to the Vector DB.
     */
    async syncProjectStudy(study: IProjectStudy): Promise<void> {
        const content = `
[PROJECT ARCHITECTURE STUDY: ${study.projectName}]
Module Studied: ${study.moduleStudied}
Repo: ${study.repoUrl || 'N/A'}

# Architectural Flow Understanding
${study.flowUnderstanding || 'None'}

# Database Tables Involved
${Array.isArray(study.involvedTables) ? study.involvedTables.join(', ') : (study.involvedTables || 'None')}

# Tasks
${study.tasks?.map(t => `- ${t.text} (${t.status})`).join('\n') || 'None'}

# Key Takeaways
${study.keyTakeaways || 'None'}
`;

        this.syncToVectorSafe({
            _id: study._id.toString(),
            userId: study.userId.toString(),
            type: 'ProjectStudy',
            title: study.projectName,
            content: content.trim(),
            embedding: []
        });
    }
}

export const knowledgeSync = new KnowledgeSyncService();
