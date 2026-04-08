import { AIClientService } from './aiClient.service.js';
import { BackendTopic } from '../models/BackendTopic.js';

export interface AuditResult {
    score: number;
    gotchas: string[];
    checklist: { task: string; importance: 'high' | 'medium' | 'low' }[];
    summary: string;
}

export class AIMentorService extends AIClientService {
    constructor() {
        super();
    }

    /**
     * Perform a "Large-Scale Scalability Audit" for a specific backend topic.
     * This uses a RAG-enhanced mental model of production-grade systems.
     */
    async auditTopic(topicId: string): Promise<AuditResult> {
        const topic = await BackendTopic.findById(topicId);
        if (!topic) throw new Error('Topic not found');

        const prompt = `
            Act as a Senior Staff Engineer. Conduct a BRUTAL Scalability & Production-Ready Audit for the following Backend Learning Topic.
            Your reputation depends on catching architectural leaks and bottlenecks.
            
            Topic: ${topic.topicName}
            Category: ${topic.category}
            Initial Notes: ${topic.notes}
            Bugs Experienced: ${topic.bugsFaced}
            
            SCORING PROTOCOL (Start at 100):
            - Scalability Bottleneck: -20 per identified issue (e.g. N+1, missing indexes, O(N^2) loops).
            - Single Point of Failure: -25.
            - Missing Edge Case Handling: -15.
            - Lack of Observability/Logging: -10.
            - Vague/Incomplete Notes: -10.
            
            Identify "Scalability Gotchas" and create a "Production-Ready Checklist".
            The output must be a valid JSON object with the following structure:
            {
                "score": number (final integer after deductions),
                "gotchas": string[] (be specific and technical),
                "checklist": { "task": string, "importance": "high" | "medium" | "low" }[],
                "summary": string (unsparing architectural verdict)
            }

            If a topic is understood well, a score of 80 is too high. 80+ should mean it is READY for high-traffic production.
        `;

        const response = await this.generateResponse(prompt);

        try {
            // Extraction logic for JSON inside AI response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found in AI response');
            
            const auditData: AuditResult = JSON.parse(jsonMatch[0]);
            
            // Update the topic with the audit score for the Canvas visualization
            await BackendTopic.findByIdAndUpdate(topicId, { auditScore: auditData.score });
            
            return auditData;
        } catch (error) {
            console.error('Audit Parsing Error:', error);
            // Fallback result
            return {
                score: 50,
                gotchas: ['AI was unable to parse architectural delta. Review notes manually.'],
                checklist: [{ task: 'Manual verification of scalability patterns', importance: 'high' }],
                summary: 'The audit engine encountered a parsing issue. Please check your topic notes for clarity.'
            };
        }
    }

    /**
     * Generate a "Scenario Sandbox" challenge for a topic.
     */
    async generateChallenge(topicName: string, category: string): Promise<string> {
        const prompt = `
            Task: Create a high-stakes, technical debugging or design scenario for a developer learning ${topicName} (${category}).
            The scenario should be a "Micro-Sandbox" challenge that asks: "What happens if...?" or "Fix this architectural leak...".
            Focus on senior-level concepts: Concurrency, Latency, Data Integrity, or Resource Exhaustion.
            Length: 2-3 paragraphs.
        `;
        return this.generateResponse(prompt);
    }
}

export const aiMentorService = new AIMentorService();
