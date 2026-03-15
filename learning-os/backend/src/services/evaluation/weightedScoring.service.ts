import type { IInterviewSession, IInterviewSection, IInterviewQuestion } from '../../models/InterviewSession.js';

export interface ScoringWeights {
  coding: {
    correctness: number;
    timeComplexity: number;
    spaceComplexity: number;
    codeQuality: number;
    edgeCases: number;
  };
  sql: {
    correctness: number;
    optimization: number;
    readability: number;
  };
  'system-design': {
    completeness: number;
    scalability: number;
    reliability: number;
    dataModeling: number;
    apiDesign: number;
  };
  behavioral: {
    relevance: number;
    depth: number;
    structure: number;
  };
}

export interface WeightedScoreResult {
  rawScore: number;           // 0-100
  weightedScore: number;      // 0-100
  maxPossible: number;        // 100 * difficulty multiplier
  difficultyMultiplier: number;
  breakdown: Record<string, number>;
  timeBonus: number;          // Bonus for fast correct solutions
  penalty: number;            // Penalties applied
}

export interface SectionScoreResult {
  sectionScore: number;
  totalWeightedScore: number;
  maxPossibleScore: number;
  questionScores: WeightedScoreResult[];
  timeUtilization: number;    // Percentage of time used
  difficultyDistribution: {
    easy: { count: number; average: number };
    medium: { count: number; average: number };
    hard: { count: number; average: number };
  };
}

// Production-grade scoring weights
const SCORING_WEIGHTS: ScoringWeights = {
  coding: {
    correctness: 0.40,
    timeComplexity: 0.20,
    spaceComplexity: 0.15,
    codeQuality: 0.15,
    edgeCases: 0.10
  },
  sql: {
    correctness: 0.50,
    optimization: 0.25,
    readability: 0.25
  },
  'system-design': {
    completeness: 0.25,
    scalability: 0.25,
    reliability: 0.20,
    dataModeling: 0.15,
    apiDesign: 0.15
  },
  behavioral: {
    relevance: 0.40,
    depth: 0.35,
    structure: 0.25
  }
};

// Difficulty multipliers
const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  easy: 1.0,
  medium: 1.5,
  hard: 2.0
};

// Time bonus thresholds (in seconds)
const TIME_BONUS_THRESHOLDS = {
  easy: { threshold: 300, maxBonus: 10 },     // 5 minutes
  medium: { threshold: 600, maxBonus: 15 }, // 10 minutes
  hard: { threshold: 900, maxBonus: 20 }      // 15 minutes
};

export class WeightedScoringService {
  /**
   * Calculate weighted score for a single question
   */
  calculateQuestionScore(
    question: IInterviewQuestion,
    sectionType: string
  ): WeightedScoreResult {
    const baseScore = question.score || 0;
    const difficulty = question.difficulty || 'medium';
    const multiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
    
    // Calculate time bonus
    const timeBonus = this.calculateTimeBonus(
      question.timeSpent || 0,
      difficulty,
      baseScore
    );
    
    // Calculate penalties
    const penalties = this.calculatePenalties(question);
    
    // Raw score with bonuses/penalties
    const adjustedScore = Math.max(0, Math.min(100, baseScore + timeBonus - penalties));
    
    // Weighted score
    const weightedScore = adjustedScore * multiplier;
    
    // Max possible for this difficulty
    const maxPossible = 100 * multiplier;
    
    return {
      rawScore: baseScore,
      weightedScore,
      maxPossible,
      difficultyMultiplier: multiplier,
      breakdown: this.generateScoreBreakdown(question, sectionType),
      timeBonus,
      penalty: penalties
    };
  }

  /**
   * Calculate section score with proper weighting
   */
  calculateSectionScore(
    section: IInterviewSection,
    sectionIndex: number,
    totalSections: number
  ): SectionScoreResult {
    const questionScores = section.questions.map(q => 
      this.calculateQuestionScore(q, section.type)
    );
    
    // Sum of weighted scores
    const totalWeightedScore = questionScores.reduce(
      (sum, qs) => sum + qs.weightedScore,
      0
    );
    
    // Sum of max possible
    const maxPossibleScore = questionScores.reduce(
      (sum, qs) => sum + qs.maxPossible,
      0
    );
    
    // Section score as percentage
    const sectionScore = maxPossibleScore > 0 
      ? Math.round((totalWeightedScore / maxPossibleScore) * 100)
      : 0;
    
    // Calculate time utilization
    const sectionDuration = section.duration || 30; // minutes
    const timeSpent = section.endTime && section.startTime
      ? (section.endTime.getTime() - section.startTime.getTime()) / 1000 / 60
      : sectionDuration;
    const timeUtilization = (timeSpent / sectionDuration) * 100;
    
    // Difficulty distribution
    const difficultyDistribution = {
      easy: { count: 0, average: 0 },
      medium: { count: 0, average: 0 },
      hard: { count: 0, average: 0 }
    };
    
    for (const qs of questionScores) {
      const diff = section.questions.find(
        q => this.calculateQuestionScore(q, section.type) === qs
      )?.difficulty || 'medium';
      
      if (diff in difficultyDistribution) {
        difficultyDistribution[diff as keyof typeof difficultyDistribution].count++;
      }
    }
    
    return {
      sectionScore,
      totalWeightedScore,
      maxPossibleScore,
      questionScores,
      timeUtilization,
      difficultyDistribution
    };
  }

  /**
   * Calculate total interview score
   */
  calculateTotalScore(session: IInterviewSession): {
    totalScore: number;
    sectionScores: SectionScoreResult[];
    overallMetrics: {
      questionsAttempted: number;
      questionsSolved: number;
      averageTimePerQuestion: number;
      strongestSection: string;
      weakestSection: string;
    };
  } {
    const sectionScores = session.sections.map((section, idx) =>
      this.calculateSectionScore(section, idx, session.sections.length)
    );
    
    // Calculate total weighted score across all sections
    const totalWeighted = sectionScores.reduce(
      (sum, ss) => sum + ss.totalWeightedScore,
      0
    );
    const totalMaxPossible = sectionScores.reduce(
      (sum, ss) => sum + ss.maxPossibleScore,
      0
    );
    
    const totalScore = totalMaxPossible > 0
      ? Math.round((totalWeighted / totalMaxPossible) * 100)
      : 0;
    
    // Calculate metrics
    let questionsAttempted = 0;
    let questionsSolved = 0;
    let totalTimeSpent = 0;
    
    for (const section of session.sections) {
      for (const question of section.questions) {
        if (question.userCode || question.userAnswer) {
          questionsAttempted++;
        }
        if (question.status === 'solved') {
          questionsSolved++;
        }
        totalTimeSpent += question.timeSpent || 0;
      }
    }
    
    const averageTimePerQuestion = questionsAttempted > 0
      ? Math.round(totalTimeSpent / questionsAttempted)
      : 0;
    
    // Find strongest and weakest sections
    let strongestSection = '';
    let weakestSection = '';
    let highestScore = -1;
    let lowestScore = 101;
    
    for (let i = 0; i < sectionScores.length; i++) {
      if (sectionScores[i].sectionScore > highestScore) {
        highestScore = sectionScores[i].sectionScore;
        strongestSection = session.sections[i].name;
      }
      if (sectionScores[i].sectionScore < lowestScore) {
        lowestScore = sectionScores[i].sectionScore;
        weakestSection = session.sections[i].name;
      }
    }
    
    return {
      totalScore,
      sectionScores,
      overallMetrics: {
        questionsAttempted,
        questionsSolved,
        averageTimePerQuestion,
        strongestSection,
        weakestSection
      }
    };
  }

  /**
   * Calculate percentile rank compared to other candidates
   */
  async calculatePercentile(
    score: number,
    difficulty: string,
    topics: string[]
  ): Promise<number> {
    // This would query historical data
    // For now, return estimated percentile
    if (score >= 90) return 95;
    if (score >= 80) return 85;
    if (score >= 70) return 70;
    if (score >= 60) return 50;
    if (score >= 50) return 30;
    return 10;
  }

  /**
   * Generate detailed score breakdown
   */
  private generateScoreBreakdown(
    question: IInterviewQuestion,
    sectionType: string
  ): Record<string, number> {
    const weights = SCORING_WEIGHTS[sectionType as keyof ScoringWeights] || SCORING_WEIGHTS.coding;
    const baseScore = question.score || 0;
    
    // Distribute score across dimensions based on weights
    const breakdown: Record<string, number> = {};
    
    for (const [dimension, weight] of Object.entries(weights)) {
      // Simulate dimension scores based on total score and weight
      // In production, these would come from actual analysis
      const variation = (Math.random() - 0.5) * 20; // ±10% variation
      breakdown[dimension] = Math.max(0, Math.min(100, baseScore + variation));
    }
    
    return breakdown;
  }

  /**
   * Calculate time bonus for fast correct solutions
   */
  private calculateTimeBonus(
    timeSpentSeconds: number,
    difficulty: string,
    baseScore: number
  ): number {
    // No bonus if solution is incorrect
    if (baseScore < 70) {
      return 0;
    }
    
    const threshold = TIME_BONUS_THRESHOLDS[difficulty as keyof typeof TIME_BONUS_THRESHOLDS];
    if (!threshold) {
      return 0;
    }
    
    // Calculate bonus based on how much faster than threshold
    if (timeSpentSeconds <= threshold.threshold) {
      const timeSaved = threshold.threshold - timeSpentSeconds;
      const bonusRatio = timeSaved / threshold.threshold;
      return Math.round(threshold.maxBonus * bonusRatio);
    }
    
    return 0;
  }

  /**
   * Calculate penalties for various infractions
   */
  private calculatePenalties(question: IInterviewQuestion): number {
    let penalties = 0;
    
    // Penalty for using hints (would need hint tracking)
    // penalties += hintsUsed * 5;
    
    // Penalty for excessive submissions (would need submission count)
    // penalties += Math.max(0, (submissions - 3)) * 3;
    
    return penalties;
  }

  /**
   * Get scoring weights for a section type
   */
  getScoringWeights(sectionType: string): Record<string, number> | null {
    return SCORING_WEIGHTS[sectionType as keyof ScoringWeights] || null;
  }

  /**
   * Validate scoring configuration
   */
  validateWeights(weights: Record<string, number>): boolean {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1.0) < 0.01; // Allow small floating point errors
  }
}

// Singleton instance
export const weightedScoringService = new WeightedScoringService();
