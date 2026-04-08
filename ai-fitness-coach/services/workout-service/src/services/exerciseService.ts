import { Exercise, IExercise } from '../models/exercise';

export interface ExerciseFilters {
  movementPattern?: string;
  equipment?: string[];
  difficulty?: string;
  search?: string;
}

export const listExercises = async (
  filters: ExerciseFilters,
  page: number = 1,
  limit: number = 20
): Promise<{ exercises: IExercise[]; total: number }> => {
  const query: any = { isActive: true };

  if (filters.movementPattern) {
    query.movementPattern = filters.movementPattern;
  }

  if (filters.difficulty) {
    query.difficulty = filters.difficulty;
  }

  if (filters.equipment && filters.equipment.length > 0) {
    query.equipment = { $in: filters.equipment };
  }

  if (filters.search) {
    query.name = { $regex: filters.search, $options: 'i' };
  }

  const skip = (page - 1) * limit;
  const [exercises, total] = await Promise.all([
    Exercise.find(query).skip(skip).limit(limit),
    Exercise.countDocuments(query)
  ]);

  return { exercises, total };
};

export const getExerciseById = async (id: string): Promise<IExercise | null> => {
  return Exercise.findById(id);
};

export const findAlternatives = async (
  exerciseId: string,
  availableEquipment: string[]
): Promise<any[]> => {
  const exercise = await Exercise.findById(exerciseId);
  if (!exercise) return [];

  // Filter alternatives defined in the exercise model by availability
  // In a real scenario, we might also search for exercises with same movement pattern
  // if no specific alternatives are listed.
  
  if (!exercise.alternatives || exercise.alternatives.length === 0) {
    // Fallback: search for exercises with same movement pattern and available equipment
    const fallbacks = await Exercise.find({
      _id: { $ne: exerciseId },
      movementPattern: exercise.movementPattern,
      equipment: { $not: { $elemMatch: { $nin: availableEquipment } } },
      isActive: true
    }).limit(5);

    return fallbacks.map(f => ({
      exerciseId: f._id,
      name: f.name,
      similarityScore: 0.7, // Default fallback score
      loadConversionFactor: 1.0 // Default fallback factor
    }));
  }

  // Populate actual exercise details for the alternatives
  const altDetails = await Exercise.find({
    _id: { $in: exercise.alternatives.map(a => a.exerciseId) },
    equipment: { $not: { $elemMatch: { $nin: availableEquipment } } },
    isActive: true
  });

  // Map and rank
  return exercise.alternatives
    .filter(alt => altDetails.find(d => d._id.toString() === alt.exerciseId))
    .map(alt => {
      const details = altDetails.find(d => d._id.toString() === alt.exerciseId);
      return {
        ...alt,
        name: details?.name,
        equipment: details?.equipment
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore);
};

/**
 * Convert working load between different exercises
 * e.g. Barbell Bench Press (source) to Dumbbell Bench Press (target)
 */
export const convertLoad = (sourceWeight: number, conversionFactor: number): number => {
  return Number((sourceWeight * conversionFactor).toFixed(1));
};
