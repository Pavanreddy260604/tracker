import axios from 'axios';

const LLM_URL = process.env.COACH_LLM_URL;
const LLM_KEY = process.env.COACH_LLM_KEY;

export interface ILLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const callLLM = async (messages: ILLMMessage[]): Promise<string> => {
  if (!LLM_URL || !LLM_KEY) {
    // Fallback Mock for development if LLM is not configured
    console.warn('LLM not configured. Returning fallback response.');
    return "I'm your AI Coach. I noticed you've been working hard! Keep up the great work with your squats.";
  }

  try {
    const response = await axios.post(LLM_URL, {
      model: 'gpt-3.5-turbo', // or whatever model is supported
      messages,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${LLM_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error: any) {
    console.error('LLM Call Failed:', error.response?.data || error.message);
    throw new Error('Coach is temporarily unavailable. Please try again later.');
  }
};
