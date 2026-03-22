import fs from 'fs/promises';
import path from 'path';
import { BackendTopic } from '../models/BackendTopic.js';
import { DSAProblem } from '../models/DSAProblem.js';
import { DailyLog } from '../models/DailyLog.js';
import { RoadmapNode } from '../models/RoadmapNode.js';
import { validateAppEnv } from '../config/env.js';

const env = validateAppEnv();
const VAULT_PATH = path.resolve(env.OBSIDIAN_VAULT_PATH);

export class ObsidianService {
    static async syncAll(userId: string): Promise<{ success: boolean; filesExported: number }> {
        let filesExported = 0;

        try {
            await fs.mkdir(VAULT_PATH, { recursive: true });

            // 1. Export Backend Topics
            const backendTopics = await BackendTopic.find({ userId });
            for (const topic of backendTopics) {
                const dir = path.join(VAULT_PATH, 'Backend', topic.category);
                await fs.mkdir(dir, { recursive: true });
                const content = this.formatBackendTopic(topic);
                await fs.writeFile(path.join(dir, `${this.sanitize(topic.topicName)}.md`), content);
                filesExported++;
            }

            // 2. Export DSA Problems
            const dsaProblems = await DSAProblem.find({ userId });
            for (const problem of dsaProblems) {
                const dir = path.join(VAULT_PATH, 'DSA', problem.topic);
                await fs.mkdir(dir, { recursive: true });
                const content = this.formatDSAProblem(problem);
                await fs.writeFile(path.join(dir, `${this.sanitize(problem.problemName)}.md`), content);
                filesExported++;
            }

            // 3. Export Daily Logs
            const dailyLogs = await DailyLog.find({ userId });
            for (const log of dailyLogs) {
                const dir = path.join(VAULT_PATH, 'Daily Logs');
                await fs.mkdir(dir, { recursive: true });
                const content = this.formatDailyLog(log);
                await fs.writeFile(path.join(dir, `${log.date}.md`), content);
                filesExported++;
            }

            // 4. Export Learning Modules (Roadmap Nodes)
            const roadmapNodes = await RoadmapNode.find({ userId });
            for (const node of roadmapNodes) {
                const category = node.data.category || 'general';
                const dir = path.join(VAULT_PATH, 'Learning', category);
                await fs.mkdir(dir, { recursive: true });
                const content = this.formatRoadmapNode(node);
                await fs.writeFile(path.join(dir, `${this.sanitize(node.data.label)}.md`), content);
                filesExported++;
            }

            return { success: true, filesExported };
        } catch (error) {
            console.error('[Obsidian] Sync Error:', error);
            throw error;
        }
    }

    private static formatBackendTopic(topic: any): string {
        return `---
type: backend-topic
category: ${topic.category}
status: ${topic.status}
date: ${topic.date}
auditScore: ${topic.auditScore || 0}
reviewStage: ${topic.reviewStage || 1}
---
# ${topic.topicName}

## Notes
${topic.notes || 'No notes provided.'}

## Sub-topics
${topic.subTopics?.map((s: any) => `- [${s.isCompleted ? 'x' : ' '}] ${s.text}`).join('\n') || 'None'}

## Files Modified
${topic.filesModified || 'None'}

## Bugs Faced
${topic.bugsFaced || 'None'}

## Resources
${topic.resources?.map((r: any) => `- [${r.title}](${r.url}) (${r.type})`).join('\n') || 'None'}
`;
    }

    private static formatDSAProblem(problem: any): string {
        return `---
type: dsa-problem
topic: ${problem.topic}
difficulty: ${problem.difficulty}
platform: ${problem.platform}
status: ${problem.status}
date: ${problem.date}
timeComplexity: ${problem.timeComplexity || 'N/A'}
spaceComplexity: ${problem.spaceComplexity || 'N/A'}
---
# ${problem.problemName}

## Pattern Learned
${problem.patternLearned || 'N/A'}

## Solution Link
[Problem Link](${problem.solutionLink})

## Solution Code
\`\`\`
${problem.solutionCode || '// No code provided'}
\`\`\`

## Mistakes & Notes
${problem.mistakes || 'None'}
`;
    }

    private static formatDailyLog(log: any): string {
        return `---
type: daily-log
date: ${log.date}
dsaHours: ${log.dsaHours}
backendHours: ${log.backendHours}
projectHours: ${log.projectHours}
sleepHours: ${log.sleepHours}
problemsSolved: ${log.dsaProblemsSolved}
---
# Daily Log - ${log.date}

## Study Breakdown
- **DSA**: ${log.dsaHours}h
- **Backend**: ${log.backendHours}h
- **Project**: ${log.projectHours}h

## Notes
${log.notes || 'No notes for today.'}
`;
    }

    private static formatRoadmapNode(node: any): string {
        return `---
type: roadmap-node
category: ${node.data.category}
status: ${node.data.status}
priority: ${node.data.priority}
roadmapId: ${node.roadmapId}
---
# ${node.data.label}

## Description
${node.data.description || 'No description provided.'}

## Resources
[Resource URL](${node.data.resourceUrl || '#'})
`;
    }

    private static sanitize(name: string): string {
        return name.replace(/[\\/:*?"<>|]/g, '-');
    }
}
