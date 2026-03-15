import { AIClientService } from './aiClient.service.js';
import { ProjectStudy } from '../models/ProjectStudy.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface C4Map {
    nodes: { id: string; label: string; type: 'component' | 'table' | 'external'; category?: string }[];
    edges: { from: string; to: string; label: string }[];
}

export interface PulseAnalysis {
    seniorityScore: number;
    seniorityLevel: 'Junior' | 'Mid' | 'Senior' | 'Staff';
    risks: { category: string; detail: string; level: 'low' | 'medium' | 'high' }[];
    anchorFiles: { path: string; importance: string }[];
    suggestions: string[];
}

export class ProjectAnalyzerService extends AIClientService {
    constructor() {
        super();
    }

    /**
     * Analyze a project codebase to generate a C4-style architectural map.
     */
    async generateArchitectureMap(projectId: string): Promise<C4Map> {
        const study = await ProjectStudy.findById(projectId);
        if (!study) throw new Error('Project study not found');

        let fileStructureContext = '';
        
        // Stage 1: Heuristic File Discovery
        // If repoUrl looks like a local path (starts with C:\, /, or p:\), scan it
        if (study.repoUrl && (study.repoUrl.match(/^[a-zA-Z]:\\/) || study.repoUrl.startsWith('/'))) {
            try {
                fileStructureContext = await this.scanDirectory(study.repoUrl);
                console.log(`[ProjectAnalyzer] Scanned local directory: ${study.repoUrl}`);
            } catch (err) {
                console.warn(`[ProjectAnalyzer] Failed to scan local repo path ${study.repoUrl}:`, err);
            }
        }
        
        const prompt = `
            Act as a Senior System Architect & Reverse Engineer. Analyze the following project information and generate a robust C4-style Architectural Map.
            
            PROJECT CONTEXT:
            - Name: ${study.projectName}
            - Module: ${study.moduleStudied}
            - Core Components: ${study.coreComponents || 'None provided'}
            - Involved Tables: ${study.involvedTables || 'None provided'}
            - User Flow Understanding: ${study.flowUnderstanding || 'None provided'}
            - Key Takeaways: ${(study.keyTakeaways || []).join(', ') || 'None provided'}
            - User Notes: ${study.notes || 'None provided'}
            - Open Questions: ${study.questions || 'None provided'}
            
            ${fileStructureContext ? `LOCAL DIRECTORY STRUCTURE (Scanned):\n${fileStructureContext}` : ''}
            
            OBJECTIVE:
            Extract a highly technical and precise C4 model. Use your "imagination" to bridge gaps if labels are missing, based on standard backend architectures for this type of module.
            
            ENFORCE RULES:
            1. Identify external systems (Auth, APIs, Third-party).
            2. Map internal services/controllers as "component".
            3. Map data stores as "table".
            4. Ensure all IDs are snake_case.
            5. Create meaningful labels for edges (e.g., "SQL Query", "REST API", "Pub/Sub").

            The output must be a valid JSON object ONLY:
            {
                "nodes": [ { "id": "string", "label": "string", "type": "component" | "table" | "external", "category": "optional descriptive category" } ],
                "edges": [ { "from": "id", "to": "id", "label": "string" } ]
            }
        `;

        try {
            const response = await this.generateResponse(prompt);
            const jsonCandidate = this.extractJsonCandidate(response);
            
            if (!jsonCandidate) throw new Error('Failed to extract architectural JSON from AI response.');
            
            const map = JSON.parse(jsonCandidate) as C4Map;
            
            // Post-processing: Ensure minimum nodes if AI failed to identify structure
            if (!map.nodes || map.nodes.length === 0) {
                return {
                    nodes: [{ id: 'core', label: study.projectName, type: 'component', category: 'Root System' }],
                    edges: []
                };
            }
            
            return map;
        } catch (error) {
            console.error('[ProjectAnalyzer] Architecture generation failed:', error);
            return {
                nodes: [{ id: 'error', label: 'Robust Analysis Failed', type: 'external', category: 'Fallback' }],
                edges: []
            };
        }
    }

    /**
     * Perform a deep "Seniority Pulse" audit of the user's project understanding.
     */
    async performPulseAnalysis(projectId: string): Promise<PulseAnalysis> {
        const study = await ProjectStudy.findById(projectId);
        if (!study) throw new Error('Project study not found');

        const prompt = `
            Act as a Staff Systems Architect. Perform a "Seniority Pulse Audit" on the student's project understanding.
            
            PROJECT CONTEXT:
            - Name: ${study.projectName}
            - Module: ${study.moduleStudied}
            - User Flow Description: ${study.flowUnderstanding}
            - Technical Notes: ${study.notes}
            
            OBJECTIVE:
            1. Determine the "Seniority Level" of the description (Junior, Mid, Senior, Staff).
            2. Identify 3 specific "Technical Blind Spots" or "Elite Risks" they missed (e.g., race conditions, idempotency, security, scale).
            3. Based on the module type, identify 3 "Anchor Files" typically critical for this logic (e.g., if Auth, then 'authMiddleware', 'tokenService').
            
            ENFORCE RULES:
            - Seniority Level must be based on depth of architectural insight.
            - Risks must be highly technical and specific.
            - Score must be 0-100.

            The output must be a valid JSON object ONLY:
            {
                "seniorityScore": number,
                "seniorityLevel": "Junior" | "Mid" | "Senior" | "Staff",
                "risks": [ { "category": "Security" | "Scalability" | "Logic", "detail": "string", "level": "low" | "medium" | "high" } ],
                "anchorFiles": [ { "path": "string", "importance": "string" } ],
                "suggestions": [ "string" ]
            }
        `;

        try {
            const response = await this.generateResponse(prompt);
            const jsonCandidate = this.extractJsonCandidate(response);
            if (!jsonCandidate) throw new Error('Failed to parse Pulse JSON');
            
            return JSON.parse(jsonCandidate);
        } catch (error) {
            console.error('[ProjectAnalyzer] Pulse analysis failed:', error);
            return {
                seniorityScore: 0,
                seniorityLevel: 'Junior',
                risks: [{ category: 'Logic', detail: 'Analysis failed to generate', level: 'medium' }],
                anchorFiles: [],
                suggestions: ['Try refining your flow description and running the audit again.']
            };
        }
    }

    private async scanDirectory(dirPath: string, depth = 0): Promise<string> {
        if (depth > 2) return ''; // Only scan 2 levels deep for architectural overview
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            let output = '';
            
            // Prioritize folders that indicate architecture
            const importantDirs = ['src', 'server', 'app', 'services', 'models', 'controllers', 'routes', 'infrastructure', 'lib', 'packages'];
            
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
                
                const fullPath = path.join(dirPath, entry.name);
                const indent = '  '.repeat(depth);
                
                if (entry.isDirectory()) {
                    output += `${indent}[DIR] ${entry.name}\n`;
                    // Only recurse into important architecture folders or if we are at root
                    if (depth === 0 || importantDirs.includes(entry.name.toLowerCase())) {
                        output += await this.scanDirectory(fullPath, depth + 1);
                    }
                } else if (depth > 0) {
                    // Only list files within subdirectories to keep context manageable
                    if (entry.name.match(/\.(ts|js|py|go|java|rb|php)$/)) {
                        output += `${indent}- ${entry.name}\n`;
                    }
                }
            }
            return output;
        } catch (e) {
            return '';
        }
    }

    /**
     * Validate the user's "Flow Understanding" against the actual architectural map.
     */
    async validateFlow(projectId: string): Promise<{ score: number; feedback: string; gaps: string[] }> {
        const study = await ProjectStudy.findById(projectId);
        if (!study) throw new Error('Project study not found');

        const prompt = `
            Perform a "System 2" logic check on the user's technical understanding.
            
            User's Flow Description: ${study.flowUnderstanding}
            Core Components Identified: ${study.coreComponents}
            Project Context: ${study.moduleStudied}
            User Notes: ${study.notes}
            
            CRITIQUE RUBRIC:
            1. Accuracy: Does the data flow match standard backend patterns?
            2. Completeness: Did they miss any critical handshakes between components?
            3. Precision: Is their terminology correct for this tech stack?
            
            Return ONLY a valid JSON object:
            {
                "score": number (0-100),
                "feedback": "Concise architectural feedback",
                "gaps": ["List specific missing logical steps"]
            }
        `;

        try {
            const response = await this.generateResponse(prompt);
            const jsonCandidate = this.extractJsonCandidate(response);
            if (!jsonCandidate) throw new Error('Invalid validation response');
            
            return JSON.parse(jsonCandidate);
        } catch (error) {
            return {
                score: 50,
                feedback: "Logic validation encountered a temporary parsing error. Please refine your flow description.",
                gaps: ["Validation system received unparseable AI output."]
            };
        }
    }
}

export const projectAnalyzerService = new ProjectAnalyzerService();

