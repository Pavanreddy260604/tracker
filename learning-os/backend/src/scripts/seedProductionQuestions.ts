import mongoose from 'mongoose';
import { Question } from '../models/Question.js';
import { StructuredQuestionService } from '../services/ai/structuredQuestion.service.js';
import { redis } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/monitoring.js';

interface SeedingConfig {
  targetQuestionCount: number;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  topics: string[];
  batchSize: number;
  parallelBatches: number;
}

const DEFAULT_CONFIG: SeedingConfig = {
  targetQuestionCount: 1000,
  difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
  topics: [
    'Array', 'String', 'HashTable', 'Stack', 'Queue', 'Heap', 'Tree', 'Graph',
    'Dynamic Programming', 'Greedy', 'Binary Search', 'Two Pointers',
    'Sliding Window', 'Backtracking', 'Sorting', 'Bit Manipulation'
  ],
  batchSize: 10,
  parallelBatches: 3
};

export class QuestionSeeder {
  private aiService: StructuredQuestionService;
  private config: SeedingConfig;

  constructor(config: Partial<SeedingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aiService = new StructuredQuestionService();
  }

  async seed(): Promise<{
    generated: number;
    saved: number;
    duplicates: number;
    errors: number;
  }> {
    const stats = { generated: 0, saved: 0, duplicates: 0, errors: 0 };

    logger.info('Starting question database seeding', {
      targetCount: this.config.targetQuestionCount,
      config: this.config
    });

    // Calculate how many of each difficulty
    const counts = {
      easy: Math.floor(this.config.targetQuestionCount * (this.config.difficultyDistribution.easy / 100)),
      medium: Math.floor(this.config.targetQuestionCount * (this.config.difficultyDistribution.medium / 100)),
      hard: Math.floor(this.config.targetQuestionCount * (this.config.difficultyDistribution.hard / 100))
    };

    // Ensure we hit the target
    const total = counts.easy + counts.medium + counts.hard;
    if (total < this.config.targetQuestionCount) {
      counts.medium += this.config.targetQuestionCount - total;
    }

    for (const [difficulty, targetCount] of Object.entries(counts)) {
      logger.info(`Generating ${targetCount} ${difficulty} questions`);

      // Shuffle topics for variety
      const shuffledTopics = [...this.config.topics].sort(() => Math.random() - 0.5);

      let generated = 0;
      let topicIndex = 0;

      while (generated < targetCount) {
        // Select 1-3 topics for this batch
        const batchTopics = shuffledTopics.slice(topicIndex, topicIndex + 2);
        topicIndex = (topicIndex + 2) % shuffledTopics.length;

        try {
          // Generate batch
          const questions = await this.aiService.generateBatch(
            Math.min(this.config.batchSize, targetCount - generated),
            difficulty,
            batchTopics
          );

          stats.generated += questions.length;

          // Save each question
          for (const question of questions) {
            try {
              const saved = await this.saveQuestion(question, difficulty, batchTopics);
              if (saved) {
                stats.saved++;
              } else {
                stats.duplicates++;
              }
            } catch (error) {
              stats.errors++;
              logger.error('Failed to save question', error as Error, {
                questionTitle: question.title
              });
            }
          }

          generated += questions.length;

          // Progress log every 50 questions
          if (stats.saved % 50 === 0) {
            logger.info(`Seeding progress: ${stats.saved} questions saved`, stats);
          }

        } catch (error) {
          stats.errors++;
          logger.error('Batch generation failed', error as Error, {
            difficulty,
            topics: batchTopics
          });

          // Wait before retry
          await this.sleep(5000);
        }

        // Small delay between batches to avoid rate limits
        await this.sleep(1000);
      }
    }

    logger.info('Seeding completed', stats);

    // Warm cache
    await this.warmCache();

    return stats;
  }

  private async saveQuestion(
    question: any,
    difficulty: string,
    topics: string[]
  ): Promise<boolean> {
    // Check for existing question by slug
    const existing = await Question.findOne({ slug: question.slug });
    if (existing) {
      logger.warn(`Duplicate question found: ${question.slug}`);
      return false;
    }

    // Ensure test cases have proper edge case categorization
    const categorizedTestCases = question.testCases.map((tc: any) => ({
      ...tc,
      isEdgeCase: tc.isEdgeCase || this.isEdgeCase(tc.input),
      edgeCaseType: tc.edgeCaseType || this.classifyEdgeCase(tc.input)
    }));

    // Create new question document
    const newQuestion = new Question({
      title: question.title,
      slug: question.slug,
      description: question.description,
      difficulty,
      topics,
      companies: [], // Will be populated manually or via import
      type: 'coding',
      functionName: question.functionName || this.extractFunctionName(question.signatures.javascript),
      signatures: question.signatures,
      testCases: categorizedTestCases,
      timeComplexity: question.timeComplexity,
      spaceComplexity: question.spaceComplexity,
      hints: question.hints || [],
      solution: {
        approach: question.solution?.approach || '',
        code: question.solution?.code || {},
        complexityExplanation: question.solution?.complexityExplanation || ''
      },
      source: 'ai_generated',
      aiGenerated: true,
      verifiedBy: [],
      frequency: 0,
      timesUsed: 0,
      averageScore: 0,
      successRate: 0,
      isActive: true,
      isPremium: false,
      needsReview: true // New AI questions need human review
    });

    await newQuestion.save();

    // Add to Redis pool
    await this.addToPool(newQuestion);

    return true;
  }

  private async addToPool(question: any): Promise<void> {
    const poolKey = `questions:pool:${question.difficulty}:${question.topics.sort().join(',')}`;
    await redis.sadd(poolKey, question.slug);
    await redis.setex(
      `question:${question.slug}`,
      86400 * 30, // 30 days
      JSON.stringify(question.toObject())
    );
  }

  private isEdgeCase(input: string): boolean {
    const edgePatterns = [
      /\[\]/,           // Empty array
      /\{\}/,           // Empty object
      /""/,             // Empty string
      /0\s*,/,          // Zero values
      /-1/,             // Negative values
      /2147483647/,     // Max int
      /100000/,         // Large constraint
      /null/,           // Null
      /undefined/       // Undefined
    ];

    return edgePatterns.some(pattern => pattern.test(input));
  }

  private classifyEdgeCase(input: string): string {
    if (/\[\]/.test(input)) return 'empty_input';
    if (/\[\d+\]/.test(input) && !/,/.test(input)) return 'single_element';
    if (/100000|10\^5|1000000/.test(input)) return 'max_constraints';
    if (/0\s*,/.test(input) || input.includes('0]')) return 'min_constraints';
    if (/2147483647|2147483648/.test(input)) return 'overflow';
    if (/null|undefined/.test(input)) return 'null_undefined';
    if (/-\d+/.test(input)) return 'negative_values';
    return 'boundary_value';
  }

  private extractFunctionName(signature: string): string {
    const match = signature.match(/function\s+(\w+)|const\s+(\w+)\s*=/);
    return match?.[1] || match?.[2] || 'solution';
  }

  private async warmCache(): Promise<void> {
    logger.info('Warming question cache');

    const questions = await Question.find({ isActive: true }).limit(100);

    for (const question of questions) {
      const key = `question:${question.slug}`;
      await redis.setex(key, 86400 * 30, JSON.stringify(question.toObject()));
    }

    logger.info(`Warmed cache with ${questions.length} questions`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async importFromLeetCode(): Promise<number> {
    // This would integrate with LeetCode API or scrape public problems
    // For now, return 0
    logger.info('LeetCode import not implemented');
    return 0;
  }

  async importFromHackerRank(): Promise<number> {
    // This would integrate with HackerRank API
    logger.info('HackerRank import not implemented');
    return 0;
  }
}

// Run seeder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      // Connect to MongoDB
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-os');

      const seeder = new QuestionSeeder({
        targetQuestionCount: parseInt(process.env.TARGET_QUESTIONS || '500')
      });

      const stats = await seeder.seed();
      console.log('Seeding complete:', stats);

      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}

export default QuestionSeeder;
