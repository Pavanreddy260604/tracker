import { FoodItem, IFoodItem } from '../models/food_item';
import { NutritionLog, INutritionLog } from '../models/nutrition_log';

export const searchFood = async (query: string, filters: any = {}): Promise<IFoodItem[]> => {
  const searchQuery: any = {
    name: { $regex: query, $options: 'i' }
  };

  if (filters.isIndian !== undefined) {
    searchQuery.isIndian = filters.isIndian === 'true' || filters.isIndian === true;
  }

  if (filters.category) {
    searchQuery.category = filters.category;
  }

  return FoodItem.find(searchQuery).limit(20);
};

export const getDailyLog = async (userId: string, date: Date): Promise<INutritionLog | null> => {
  // Normalize date to start of day for consistent querying
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  return NutritionLog.findOne({ userId, date: startOfDay });
};

export const logNutritionEntry = async (
  userId: string,
  date: Date,
  entryData: {
    foodId?: string;
    description: string;
    servings: number;
    calories: number;
    protein: number;
    carbohydrates: number;
    fats: number;
  }
): Promise<INutritionLog> => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  let log = await NutritionLog.findOne({ userId, date: startOfDay });

  if (!log) {
    log = new NutritionLog({
      userId,
      date: startOfDay,
      entries: [],
      totals: { calories: 0, protein: 0, carbohydrates: 0, fats: 0 }
    });
  }

  // Add new entry
  log.entries.push({
    ...entryData,
    loggedAt: new Date()
  });

  // Recalculate totals
  log.totals.calories = Number(log.entries.reduce((sum, e) => sum + e.calories, 0).toFixed(1));
  log.totals.protein = Number(log.entries.reduce((sum, e) => sum + e.protein, 0).toFixed(1));
  log.totals.carbohydrates = Number(log.entries.reduce((sum, e) => sum + e.carbohydrates, 0).toFixed(1));
  log.totals.fats = Number(log.entries.reduce((sum, e) => sum + e.fats, 0).toFixed(1));

  return log.save();
};

export const getNutritionSummary = async (
  userId: string,
  date: Date,
  targets: { calories: number; protein: number; carbohydrates: number; fats: number }
): Promise<{ totals: any; remaining: any; targets: any; suggestions: IFoodItem[] }> => {
  const log = await getDailyLog(userId, date);
  const totals = log?.totals || { calories: 0, protein: 0, carbohydrates: 0, fats: 0 };

  const remaining = {
    calories: Number((targets.calories - totals.calories).toFixed(1)),
    protein: Number((targets.protein - totals.protein).toFixed(1)),
    carbohydrates: Number((targets.carbohydrates - totals.carbohydrates).toFixed(1)),
    fats: Number((targets.fats - totals.fats).toFixed(1)),
  };

  const suggestions: IFoodItem[] = [];
  if (totals.protein < 0.8 * targets.protein) {
    const highProteinFoods = await FoodItem.find({ 'macros.protein': { $gt: 15 } }).limit(3);
    suggestions.push(...highProteinFoods);
  }

  return { totals, remaining, targets, suggestions };
};

export const getQuickAddFoods = async (userId: string): Promise<IFoodItem[]> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const frequentFoodIds = await NutritionLog.aggregate([
    { $match: { userId, date: { $gte: thirtyDaysAgo } } },
    { $unwind: '$entries' },
    { $group: { _id: '$entries.foodId', count: { $sum: 1 } } },
    { $match: { _id: { $ne: null }, count: { $gte: 3 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  if (frequentFoodIds.length === 0) return [];

  const foodIds = frequentFoodIds.map(f => f._id);
  return FoodItem.find({ _id: { $in: foodIds } });
};

export const getWeeklyAdherence = async (userId: string): Promise<{ avgCalories: number; daysLogged: number }> => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const logs = await NutritionLog.find({
    userId,
    date: { $gte: weekAgo }
  });

  const totalCalories = logs.reduce((sum, log) => sum + (log.totals?.calories || 0), 0);
  const avgCalories = logs.length > 0 ? Number((totalCalories / logs.length).toFixed(1)) : 0;

  return {
    avgCalories,
    daysLogged: logs.length
  };
};
