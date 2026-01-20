import { GoogleGenerativeAI, GenerativeModel, Part } from "@google/generative-ai";
import { User, IUser } from "../models/User.js";
import { DSAProblem, IDSAProblem } from "../models/DSAProblem.js";
import { DailyLog, IDailyLog } from "../models/DailyLog.js";
import { BackendTopic, IBackendTopic } from "../models/BackendTopic.js";
import { RoadmapNode } from "../models/RoadmapNode.js";
import { RoadmapEdge } from "../models/RoadmapEdge.js";
import { decrypt } from "../utils/encryption.js";

export class AIService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;
    private userId: string;
    private apiKey: string;
    private modelName: string;

    constructor(apiKey: string, userId: string, modelName: string = 'gemini-2.5-flash') {
        this.userId = userId;
        this.apiKey = apiKey;
        this.modelName = modelName;
    }

    private async initialize() {
        if (this.genAI) return;

        if (!this.apiKey) {
            throw new Error("Gemini API Key is not configured in .env");
        }

        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: this.modelName,
            systemInstruction: this.getSystemInstruction(),
        });
    }

    private getSystemInstruction(): string {
        return `You are the "Learning OS Copilot", an intelligent AI assistant for a software engineer.
    Your goal is to help the user learn, build, and optimize their code.
    
    You have direct access to the user's database via tools.
    - ALWAYS check the database before answering questions about progress or history.
    - You can view and update the user's learning "Roadmap".
    - Be encouraging, helpful, and detailed.
    - Provide full code solutions when asked, but explain the "Why" behind them.
    - If the user provides a screenshot, analyze it for bugs, UI issues, or code explanation.
    
    Tone: Professional, Insightful, Expert Architect.`;
    }

    // --- Tools Definition ---
    private getToolsConfig(): any {
        return {
            functionDeclarations: [
                {
                    name: "getRecentLogs",
                    description: "Get the user's daily activity logs for the last N days to see their progress.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            days: { type: "NUMBER", description: "Number of days to look back (default 7)" }
                        },
                        required: ["days"]
                    }
                },
                {
                    name: "getDSAStats",
                    description: "Get statistics about solved DSA problems, filtered by difficulty or topic.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            topic: { type: "STRING", description: "Optional topic filter (e.g., 'DP', 'Arrays')" },
                            difficulty: { type: "STRING", description: "Optional difficulty filter ('easy', 'medium', 'hard')" }
                        }
                    }
                },
                {
                    name: "searchTopics",
                    description: "Search for specific backend or DSA topics the user has studied.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            query: { type: "STRING", description: "Search keyword" }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "getRoadmap",
                    description: "Get the user's learning roadmap nodes and connections.",
                    parameters: { type: "OBJECT", properties: {} }
                },
                {
                    name: "updateRoadmapNode",
                    description: "Update a roadmap node's label or status (todo, in-progress, done).",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            nodeId: { type: "STRING", description: "The ID of the node to update" },
                            label: { type: "STRING", description: "Optional new label" },
                            status: { type: "STRING", enum: ["todo", "in-progress", "done"], description: "Optional new status" }
                        },
                        required: ["nodeId"]
                    }
                }
            ]
        };
    }

    // --- Chat Method ---
    async chat(message: string, history: any[] = [], imageParts: Part[] = []) {
        try {
            await this.initialize();
            if (!this.model) throw new Error("AI Model not initialized");

            const chatSession = this.model.startChat({
                history: history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }]
                })),
            });

            // Prepare Prompt
            const parts: Array<string | Part> = [message, ...imageParts];

            const result = await chatSession.sendMessage(parts);
            const response = result.response;

            // Handle Function Calls
            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                // In a real implementation, we would execute the function here and send the result back.
                // For this 'Agent' loop, we will execute and return the result + AI's interpretation.
                return await this.handleFunctionCalls(functionCalls, chatSession);
            }

            return response.text();
        } catch (error: any) {
            console.error("AI Chat Error:", error);
            throw new Error(error.message || "Failed to process AI request. Please check your API Key.");
        }
    }

    // --- Function Execution Logic ---
    private async handleFunctionCalls(functionCalls: any[], chatSession: any) {
        // Execute all functions
        const functionResponses = await Promise.all(functionCalls.map(async (call) => {
            const result = await this.executeFunction(call.name, call.args);
            return {
                functionResponse: {
                    name: call.name,
                    response: result
                }
            };
        }));

        // Send results back to model to get final text
        const finalResult = await chatSession.sendMessage(functionResponses);
        return finalResult.response.text();
    }

    private async executeFunction(name: string, args: any): Promise<any> {
        console.log(`[AI-TOOL] Executing ${name}`, args);
        switch (name) {
            case "getRecentLogs":
                const limit = args.days || 7;
                return await DailyLog.find({ userId: this.userId }).sort({ date: -1 }).limit(limit).lean();

            case "getDSAStats":
                const query: any = { userId: this.userId, status: 'solved' };
                if (args.topic) query.topic = new RegExp(args.topic, 'i');
                if (args.difficulty) query.difficulty = args.difficulty;
                const count = await DSAProblem.countDocuments(query);
                const problems = await DSAProblem.find(query).select('problemName difficulty topic date').limit(5).lean();
                return { totalSolved: count, recent: problems };

            case "searchTopics":
                return await BackendTopic.find({
                    userId: this.userId,
                    topicName: new RegExp(args.query, 'i')
                }).limit(5).lean();

            case "getRoadmap":
                const [nodes, edges] = await Promise.all([
                    RoadmapNode.find({ userId: this.userId }).lean(),
                    RoadmapEdge.find({ userId: this.userId }).lean()
                ]);
                return { nodes, edges };

            case "updateRoadmapNode":
                const update: any = {};
                if (args.label) update['data.label'] = args.label;
                if (args.status) update['data.status'] = args.status;

                const updatedNode = await RoadmapNode.findOneAndUpdate(
                    { userId: this.userId, nodeId: args.nodeId },
                    { $set: update },
                    { new: true }
                ).lean();
                return updatedNode || { error: "Node not found" };

            default:
                return { error: "Function not found" };
        }
    }
}
