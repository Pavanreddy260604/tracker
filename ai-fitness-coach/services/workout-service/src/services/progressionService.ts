import { ProgressionHistory } from '../models/progression_history';
import { WorkoutSession, IWorkoutSession } from '../models/workout_session';

export const recordSessionCompletion = async (sessionId: string): Promise<void> => {
  const session = await WorkoutSession.findById(sessionId);
  if (!session || session.status !== 'completed') {
    throw new Error('Completed session not found');
  }

  for (const sessionEx of session.exercises) {
    if (sessionEx.skipped) continue;

    const totalReps = sessionEx.sets.reduce((sum, s) => sum + s.reps, 0);
    const avgWeight = sessionEx.sets.length > 0 ? sessionEx.sets.reduce((sum, s) => sum + s.weight, 0) / sessionEx.sets.length : 0;
    const totalVolume = sessionEx.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

    // Determine if the user completed all planned sets and reached the target reps.
    // Assuming each set should ideally hit the target reps (for simplicity, we check if they hit the total target reps).
    // In a real-world scenario, we'd compare against the planned reps for each set.
    // For now, if sets completed == plannedSets and reps >= 1 per set, we'll mark as success if volume is non-zero.
    const isSuccess = sessionEx.sets.length >= sessionEx.plannedSets && sessionEx.sets.every(s => s.reps > 0);

    // Get history for this exercise to determine progression/plateau
    const history = await ProgressionHistory.find({ 
      userId: session.userId, 
      exerciseId: sessionEx.exerciseId 
    })
    .sort({ date: -1 })
    .limit(3);

    let progressionApplied = false;
    let progressionAmount = 0;
    let plateauDetected = false;

    if (isSuccess) {
      // Check if the last session was also a success at the same weight
      const lastSession = history[0];
      if (lastSession && !lastSession.plateauDetected && lastSession.weight === avgWeight) {
         // 2 consecutive successes -> Progress!
         progressionApplied = true;
         progressionAmount = 2.5; // Default 2.5% or 2.5kg
      }
    } else {
      // Check for plateau (3 consecutive failures)
      const failures = history.filter(h => !h.progressionApplied && !h.plateauDetected).length;
      if (failures >= 2) { // current is failure + 2 previous = 3
        plateauDetected = true;
      }
    }

    await ProgressionHistory.create({
      userId: session.userId,
      exerciseId: sessionEx.exerciseId,
      date: session.endTime || new Date(),
      weight: avgWeight,
      sets: sessionEx.sets.length,
      reps: sessionEx.sets.reduce((sum, s) => sum + s.reps, 0) / (sessionEx.sets.length || 1),
      totalVolume,
      progressionApplied,
      progressionAmount,
      plateauDetected
    });
  }
};

export const getRecommendedWeight = async (userId: string, exerciseId: string, baseWeight: number): Promise<number> => {
    const lastHistory = await ProgressionHistory.findOne({ userId, exerciseId }).sort({ date: -1 });
    
    if (!lastHistory) return baseWeight;

    if (lastHistory.progressionApplied) {
        // Apply 2.5% - 5% increase
        return Number((lastHistory.weight * 1.05).toFixed(1));
    }

    if (lastHistory.plateauDetected) {
        // Apply 10% deload
        return Number((lastHistory.weight * 0.9).toFixed(1));
    }

    return lastHistory.weight;
};
