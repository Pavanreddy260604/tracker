import { User, IUser } from '../models/user';
import { calculateBMI, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget } from '../utils/metrics';

export const getProfile = async (userId: string): Promise<IUser | null> => {
  return User.findById(userId);
};

export const updateProfile = async (userId: string, profileData: any): Promise<IUser | null> => {
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  // Update profile fields
  user.profile = { ...user.profile, ...profileData };

  // Recalculate derived metrics
  const bmi = calculateBMI(user.profile.height, user.profile.weight);
  const bmr = calculateBMR(
    user.profile.weight,
    user.profile.height,
    user.profile.age,
    user.profile.gender as 'male' | 'female' | 'other'
  );
  const tdee = calculateTDEE(bmr, user.profile.trainingDaysPerWeek);
  const dailyCalorieTarget = calculateCalorieTarget(tdee, user.profile.fitnessGoal as 'muscle_gain' | 'fat_loss' | 'strength');
  const dailyProteinTarget = calculateProteinTarget(user.profile.weight, user.profile.fitnessGoal as 'muscle_gain' | 'fat_loss' | 'strength');

  user.derivedMetrics = {
    bmi,
    tdee,
    dailyCalorieTarget,
    dailyProteinTarget,
    lastCalculated: new Date()
  };

  return user.save();
};

export const createProfile = async (userId: string, profileData: any): Promise<IUser | null> => {
  // Use update logic as it handles metric calculations and defaults
  return updateProfile(userId, profileData);
};
