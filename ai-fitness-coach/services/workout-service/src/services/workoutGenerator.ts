import { Exercise } from '../models/exercise';
import { WorkoutPlan, IWorkoutPlan } from '../models/workout_plan';

interface WorkoutConstraints {
  goal: 'muscle_gain' | 'fat_loss' | 'strength';
  availableEquipment: string[];
  daysPerWeek: number;
}

const getRepRange = (goal: string): { min: number; max: number; sets: number } => {
  switch (goal) {
    case 'strength':
      return { min: 3, max: 6, sets: 4 };
    case 'fat_loss':
      return { min: 12, max: 15, sets: 3 };
    case 'muscle_gain':
    default:
      return { min: 8, max: 12, sets: 3 };
  }
};

const getSplitTemplate = (daysPerWeek: number): any[] => {
  if (daysPerWeek <= 2) {
    return [
      { name: 'Full Body A', patterns: ['squat', 'push', 'pull', 'hinge', 'core'] },
      { name: 'Full Body B', patterns: ['lunge', 'push', 'pull', 'hinge', 'carry'] }
    ].slice(0, daysPerWeek);
  } else if (daysPerWeek === 3) {
    return [
      { name: 'Push', patterns: ['push', 'push', 'squat', 'core'] },
      { name: 'Pull', patterns: ['pull', 'pull', 'hinge', 'carry'] },
      { name: 'Legs/Core', patterns: ['squat', 'hinge', 'lunge', 'core'] }
    ];
  } else if (daysPerWeek === 4) {
    return [
      { name: 'Upper A', patterns: ['push', 'pull', 'push', 'pull'] },
      { name: 'Lower A', patterns: ['squat', 'hinge', 'lunge', 'core'] },
      { name: 'Upper B', patterns: ['push', 'pull', 'push', 'pull'] },
      { name: 'Lower B', patterns: ['squat', 'hinge', 'lunge', 'core'] }
    ];
  }
  // Default for 5+ days
  return Array.from({ length: daysPerWeek }).map((_, i) => ({
    name: `Training Day ${i + 1}`,
    patterns: ['push', 'pull', 'squat', 'hinge', 'lunge', 'core'].slice(i % 6, (i % 6) + 3)
  }));
};

export const generateWorkoutPlan = async (
  userId: string,
  constraints: WorkoutConstraints
): Promise<IWorkoutPlan> => {
  const { goal, availableEquipment, daysPerWeek } = constraints;
  const split = getSplitTemplate(daysPerWeek);
  const repConfig = getRepRange(goal);

  const days = [];
  for (let i = 0; i < split.length; i++) {
    const dayTemplate = split[i];
    const dayExercises = [];
    
    for (let j = 0; j < dayTemplate.patterns.length; j++) {
      const pattern = dayTemplate.patterns[j];
      
      // Select an exercise for this pattern matching the equipment
      const possibleExercises = await Exercise.find({
        movementPattern: pattern,
        equipment: { $not: { $elemMatch: { $nin: availableEquipment } } },
        isActive: true
      }).limit(5);

      if (possibleExercises.length > 0) {
        // Pick one (randomized or sequential for variety)
        const exercise = possibleExercises[j % possibleExercises.length];
        
        dayExercises.push({
          exerciseId: exercise._id.toString(),
          sets: repConfig.sets,
          repsMin: repConfig.min,
          repsMax: repConfig.max,
          restSeconds: goal === 'strength' ? 120 : 60,
          order: j + 1
        });
      }
    }

    days.push({
      dayOfWeek: (i + 1) % 7,
      name: dayTemplate.name,
      exercises: dayExercises,
      estimatedDuration: dayExercises.length * 10 // rough estimate: 10 mins per exercise including rest
    });
  }

  const plan = new WorkoutPlan({
    userId,
    name: `${goal.replace('_', ' ').toUpperCase()} Plan (${daysPerWeek} days/week)`,
    goal,
    days,
    active: true
  });

  // Deactivate previous active plans for this user
  await WorkoutPlan.updateMany({ userId, active: true }, { active: false });

  return plan.save();
};

export const getActiveWorkoutPlan = async (userId: string): Promise<IWorkoutPlan | null> => {
  return WorkoutPlan.findOne({ userId, active: true });
};
