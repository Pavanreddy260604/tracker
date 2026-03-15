import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AIClientService, AIServiceError } from '../aiClient.service.js';
import { circuitBreakerRegistry } from '../ai/circuitBreaker.service.js';

// Schema for structured system design evaluation
const SystemDesignScoreSchema = z.object({
  scores: z.object({
    completeness: z.number().min(0).max(100).describe('Coverage of all requirements'),
    scalability: z.number().min(0).max(100).describe('Horizontal scaling, sharding, caching strategy'),
    reliability: z.number().min(0).max(100).describe('Fault tolerance, redundancy, monitoring'),
    dataModeling: z.number().min(0).max(100).describe('Database choice, schema design, indexing'),
    apiDesign: z.number().min(0).max(100).describe('REST/GraphQL design, versioning, rate limiting'),
    security: z.number().min(0).max(100).describe('Auth, encryption, input validation'),
    performance: z.number().min(0).max(100).describe('Caching, CDN, database optimization')
  }),
  overallScore: z.number().min(0).max(100),
  grade: z.enum(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F']),
  feedback: z.string().min(20).max(2000),
  strengths: z.array(z.string().min(5)).min(0).max(5),
  improvements: z.array(z.string().min(5)).min(0).max(5),
  missingComponents: z.array(z.string()).min(0),
  suggestedReading: z.array(z.object({
    topic: z.string(),
    resource: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  })).min(0).max(3)
});

export type SystemDesignEvaluation = z.infer<typeof SystemDesignScoreSchema>;

interface SystemDesignQuestion {
  title: string;
  requirements: string[];
  constraints: {
    rps?: number;
    dataVolume?: string;
    latency?: string;
    availability?: string;
  };
  expectedComponents: string[];
  rubric: Array<{
    category: string;
    weight: number;
    description: string;
    semanticIndicators: string[];
  }>;
}

export class SemanticSystemDesignEvaluator {
  private aiClient: AIClientService;

  constructor(aiClient?: AIClientService) {
    this.aiClient = aiClient || new AIClientService();
  }

  /**
   * Evaluate a system design answer using semantic analysis
   * No keyword matching - pure understanding
   */
  async evaluate(
    answer: string,
    question: SystemDesignQuestion
  ): Promise<SystemDesignEvaluation> {
    // Use circuit breaker for AI calls
    const circuitBreaker = circuitBreakerRegistry.get('system-design-evaluation', {
      failureThreshold: 3,
      resetTimeoutMs: 30000
    });

    return circuitBreaker.executeWithRetry(async () => {
      return this.performEvaluation(answer, question);
    }, 3, 2000);
  }

  private async performEvaluation(
    answer: string,
    question: SystemDesignQuestion
  ): Promise<SystemDesignEvaluation> {
    const jsonSchema = zodToJsonSchema(SystemDesignScoreSchema);

    const prompt = `You are a Principal Engineer evaluating a system design interview.

QUESTION: ${question.title}
REQUIREMENTS:
${question.requirements.map(r => `- ${r}`).join('\n')}

CONSTRAINTS:
${question.constraints.rps ? `- ${question.constraints.rps} requests/second` : ''}
${question.constraints.dataVolume ? `- ${question.constraints.dataVolume} data volume` : ''}
${question.constraints.latency ? `- ${question.constraints.latency} latency requirement` : ''}
${question.constraints.availability ? `- ${question.constraints.availability} availability` : ''}

CANDIDATE ANSWER:
${answer}

EVALUATION INSTRUCTIONS:
1. Read the answer carefully and understand the candidate's actual design
2. Score each dimension 0-100 based on DEPTH and CORRECTNESS, not keyword count
3. Be STRICT - do not give partial credit for mentioning buzzwords without explanation
4. If the answer is vague or generic, mark it down significantly
5. Look for specific numbers, tradeoff discussions, and concrete choices

SCORING CRITERIA:
- 90-100: Expert level with specific numbers, addresses all edge cases, thoughtful tradeoffs
- 70-89: Good understanding with minor gaps, reasonable choices explained
- 50-69: Basic understanding, significant gaps, hand-wavy explanations
- 30-49: Surface level, missing major components, unclear reasoning
- 0-29: Fundamentally wrong or extremely incomplete

DO NOT give points for just mentioning:
- "We'll use a database" (which one? why?)
- "We'll add caching" (what cache? what pattern? hit rate?)
- "We'll use microservices" (how many? communication? data consistency?)

DO give points for:
- Specific technology choices with justification
- Quantified decisions ("cache hit rate of 95%")
- Tradeoff analysis ("we chose X over Y because Z")
- Failure mode identification
- Concrete API examples

Return ONLY JSON matching this schema:
${JSON.stringify(jsonSchema, null, 2)}`;

    const response = await this.aiClient.generateResponse(prompt);

    // Extract and validate JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AIServiceError('No valid JSON in AI response', {
        recoverable: true,
        context: 'system_design_evaluation'
      });
    }

    const parsed = SystemDesignScoreSchema.parse(JSON.parse(jsonMatch[0]));

    // Validate that overall score matches component scores
    const componentScores = Object.values(parsed.scores);
    const avgComponentScore = componentScores.reduce((a, b) => a + b, 0) / componentScores.length;
    
    // If AI's overall score is way off from components, adjust it
    if (Math.abs(parsed.overallScore - avgComponentScore) > 15) {
      parsed.overallScore = Math.round(avgComponentScore);
    }

    // Validate grade matches score
    const expectedGrade = this.scoreToGrade(parsed.overallScore);
    if (parsed.grade !== expectedGrade) {
      parsed.grade = expectedGrade;
    }

    return parsed;
  }

  /**
   * Quick keyword-based fallback for when AI is unavailable
   */
  async evaluateWithKeywordFallback(
    answer: string,
    question: SystemDesignQuestion
  ): Promise<SystemDesignEvaluation> {
    const normalized = answer.toLowerCase();
    const words = normalized.split(/\s+/);
    const wordCount = words.length;

    // Check for required components
    let foundComponents = 0;
    for (const component of question.expectedComponents) {
      const indicators = component.toLowerCase().split('|');
      if (indicators.some(ind => normalized.includes(ind))) {
        foundComponents++;
      }
    }

    const completenessScore = Math.round((foundComponents / question.expectedComponents.length) * 100);
    
    // Word count check (too short = incomplete)
    const wordCountScore = Math.min(100, Math.round((wordCount / 200) * 100));

    // Combined score (heavily weighted toward completeness)
    const overallScore = Math.round(completenessScore * 0.7 + wordCountScore * 0.3);

    return {
      scores: {
        completeness: completenessScore,
        scalability: Math.round(completenessScore * 0.8),
        reliability: Math.round(completenessScore * 0.9),
        dataModeling: Math.round(completenessScore * 0.85),
        apiDesign: Math.round(completenessScore * 0.75),
        security: Math.round(completenessScore * 0.6),
        performance: Math.round(completenessScore * 0.8)
      },
      overallScore,
      grade: this.scoreToGrade(overallScore),
      feedback: `This is an automated fallback evaluation. The answer ${wordCount < 100 ? 'is very short and likely incomplete' : 'has some content but requires human review'}. Found ${foundComponents}/${question.expectedComponents.length} expected components.`,
      strengths: wordCount > 150 ? ['Answer has reasonable length'] : [],
      improvements: question.expectedComponents.filter(c => 
        !c.toLowerCase().split('|').some(ind => normalized.includes(ind))
      ),
      missingComponents: question.expectedComponents.filter(c => 
        !c.toLowerCase().split('|').some(ind => normalized.includes(ind))
      ),
      suggestedReading: []
    };
  }

  private scoreToGrade(score: number): SystemDesignEvaluation['grade'] {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Compare two system design answers for similarity
   * Used for plagiarism detection
   */
  async calculateSimilarity(answer1: string, answer2: string): Promise<number> {
    const prompt = `Compare these two system design answers and return a similarity score 0-100.

Answer 1:
${answer1.slice(0, 1000)}

Answer 2:
${answer2.slice(0, 1000)}

Focus on:
- Are the architectural choices the same?
- Is the structure and flow similar?
- Are the technology choices identical?

Return ONLY a number 0-100.`;

    try {
      const response = await this.aiClient.generateResponse(prompt);
      const match = response.match(/(\d+)/);
      if (match) {
        return Math.min(100, Math.max(0, parseInt(match[1], 10)));
      }
    } catch {
      // Fallback: use simple text similarity
      return this.simpleTextSimilarity(answer1, answer2);
    }

    return 0;
  }

  private simpleTextSimilarity(text1: string, text2: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, ' ').split(/\s+/).sort().join(' ');
    const n1 = normalize(text1);
    const n2 = normalize(text2);
    
    const words1 = new Set(n1.split(' '));
    const words2 = new Set(n2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return Math.round((intersection.size / union.size) * 100);
  }
}

// Singleton instance
export const semanticSystemDesignEvaluator = new SemanticSystemDesignEvaluator();
