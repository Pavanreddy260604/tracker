import { CoachConversation } from '../models/coach_conversation';
import * as planService from './planService';
import { callLLM, ILLMMessage } from '../utils/llmClient';

export const askCoach = async (userId: string, sessionId: string, query: string, token: string) => {
  // 1. Fetch Context (Workout + Nutrition)
  const contextData = await planService.getTodayOverview(userId, token);

  // 2. Fetch Conversation History (last 5 messages)
  let conversation = await CoachConversation.findOne({ sessionId });
  if (!conversation) {
    conversation = new CoachConversation({ userId, sessionId, messages: [], context: { referencedExercises: [], referencedWorkouts: [], referencedNutrition: [] } });
  }

  const history = conversation.messages.slice(-5).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  }));

  // 3. Construct System Prompt with Context
  const systemPrompt: ILLMMessage = {
    role: 'system',
    content: `You are an AI Fitness Coach. 
    Context for Today (${contextData.date}):
    Workout: ${contextData.workout.message}. Active: ${contextData.workout.active || 'None'}.
    Nutrition: ${contextData.nutrition.message}. 
    Macros: ${JSON.stringify(contextData.nutrition.summary?.totals || {})}
    Targets: ${JSON.stringify(contextData.nutrition.summary?.targets || {})}
    
    If the user reports low difficulty (RPE 1-2) for complex movements, suggest specific form cues.
    Be concise, encouraging, and science-based.`
  };

  // 4. Call LLM
  const messages: ILLMMessage[] = [systemPrompt, ...history, { role: 'user', content: query }];
  const response = await callLLM(messages);

  // 5. Save History
  conversation.messages.push({ role: 'user', content: query, timestamp: new Date() });
  conversation.messages.push({ role: 'assistant', content: response, timestamp: new Date() });
  
  // Track referenced items (simple keyword matching for MVP)
  if (query.toLowerCase().includes('squat')) conversation.context.referencedExercises.push('Squat');
  
  await conversation.save();

  return { response, sessionId, history: conversation.messages };
};

export const getConversationHistory = async (sessionId: string) => {
    return CoachConversation.findOne({ sessionId });
};
