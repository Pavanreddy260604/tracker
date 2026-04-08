import { WorkoutSession, IWorkoutSession } from '../models/workout_session';
import { WorkoutPlan } from '../models/workout_plan';

export const startSession = async (userId: string, planId: string, dayIndex: number): Promise<IWorkoutSession> => {
  const plan = await WorkoutPlan.findOne({ _id: planId, userId });
  if (!plan) {
    throw new Error('Workout plan not found');
  }

  const day = plan.days.find(d => d.dayOfWeek === dayIndex);
  if (!day) {
    throw new Error(`No workout scheduled for day index ${dayIndex}`);
  }

  const session = new WorkoutSession({
    userId,
    planId,
    dayIndex,
    startTime: new Date(),
    status: 'active',
    exercises: day.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      plannedSets: ex.sets,
      sets: [],
      skipped: false
    })),
    totalVolume: 0
  });

  return session.save();
};

export const logSet = async (
  sessionId: string,
  exerciseId: string,
  setData: {
    weight: number;
    reps: number;
    difficultyRating?: number; // RPE 1-5
  }
): Promise<{ session: IWorkoutSession; suggestion?: string }> => {
  const session = await WorkoutSession.findById(sessionId);
  if (!session || session.status !== 'active') {
    throw new Error('Active session not found');
  }

  const exercise = session.exercises.find(e => e.exerciseId === exerciseId);
  if (!exercise) {
    throw new Error('Exercise not found in session');
  }

  const setNumber = exercise.sets.length + 1;
  exercise.sets.push({
    setNumber,
    weight: setData.weight,
    reps: setData.reps,
    difficultyRating: setData.difficultyRating,
    completedAt: new Date()
  });

  let suggestion: string | undefined;
  if (setData.difficultyRating === 5) {
    const recommendedWeight = Number((setData.weight * 0.9).toFixed(1));
    suggestion = `Difficulty is very high. Suggest reducing weight to ${recommendedWeight}kg for the next set.`;
  } else if (setData.difficultyRating === 1) {
    const recommendedWeight = Number((setData.weight * 1.05).toFixed(1));
    suggestion = `Difficulty is very low. Suggest increasing weight to ${recommendedWeight}kg for the next set.`;
  }

  await session.save();
  return { session, suggestion };
};

export const skipExercise = async (sessionId: string, exerciseId: string, reason: string): Promise<IWorkoutSession> => {
  const session = await WorkoutSession.findById(sessionId);
  if (!session || session.status !== 'active') {
    throw new Error('Active session not found');
  }

  const exercise = session.exercises.find(e => e.exerciseId === exerciseId);
  if (!exercise) {
    throw new Error('Exercise not found in session');
  }

  exercise.skipped = true;
  exercise.skipReason = reason;

  return session.save();
};

import * as progressionService from './progressionService';

export const completeSession = async (
  sessionId: string,
  feedback: { rating?: number; notes?: string }
): Promise<IWorkoutSession> => {
  const session = await WorkoutSession.findById(sessionId);
  if (!session || session.status !== 'active') {
    throw new Error('Active session not found');
  }

  let totalVolume = 0;
  session.exercises.forEach(ex => {
    ex.sets.forEach(s => {
      totalVolume += s.weight * s.reps;
    });
  });

  session.totalVolume = totalVolume;
  session.feedback = feedback;
  session.status = 'completed';
  session.endTime = new Date();

  const savedSession = await session.save();

  // Trigger progression recording asynchronously or wait if needed
  await progressionService.recordSessionCompletion(sessionId);

  return savedSession;
};

export const getActiveSession = async (userId: string): Promise<IWorkoutSession | null> => {
  return WorkoutSession.findOne({ userId, status: 'active' });
};

export const getWeeklyVolume = async (userId: string): Promise<{ totalVolume: number; sessionCount: number }> => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const sessions = await WorkoutSession.find({
    userId,
    status: 'completed',
    endTime: { $gte: weekAgo }
  });

  const totalVolume = sessions.reduce((sum, session) => sum + (session.totalVolume || 0), 0);
  
  return {
    totalVolume,
    sessionCount: sessions.length
  };
};
