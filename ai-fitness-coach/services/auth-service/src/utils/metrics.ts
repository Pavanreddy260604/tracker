/**
 * Calculate Body Mass Index (BMI)
 * Formula: weight (kg) / (height (m))^2
 */
export const calculateBMI = (heightCm: number, weightKg: number): number => {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
};

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 */
export const calculateBMR = (
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female' | 'other'
): number => {
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male') {
    bmr += 5;
  } else if (gender === 'female') {
    bmr -= 161;
  } else {
    // For 'other', use the average of male and female offset
    bmr -= 78;
  }
  return Math.round(bmr);
};

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 * Activity Factors:
 * - 0 days: 1.2 (Sedentary)
 * - 1-2 days: 1.375 (Lightly active)
 * - 3-4 days: 1.55 (Moderately active)
 * - 5+ days: 1.725 (Very active)
 */
export const calculateTDEE = (bmr: number, trainingDaysPerWeek: number): number => {
  let activityFactor = 1.2;
  if (trainingDaysPerWeek >= 5) {
    activityFactor = 1.725;
  } else if (trainingDaysPerWeek >= 3) {
    activityFactor = 1.55;
  } else if (trainingDaysPerWeek >= 1) {
    activityFactor = 1.375;
  }
  return Math.round(bmr * activityFactor);
};

/**
 * Calculate Daily Calorie Target based on fitness goal
 */
export const calculateCalorieTarget = (
  tdee: number,
  goal: 'muscle_gain' | 'fat_loss' | 'strength'
): number => {
  if (goal === 'muscle_gain') {
    return tdee + 500; // Surplus for gain
  } else if (goal === 'fat_loss') {
    return tdee - 500; // Deficit for loss
  }
  return tdee; // Maintenance for strength/health
};

/**
 * Calculate Daily Protein Target (g)
 * Range: 1.6 - 2.2g per kg bodyweight
 */
export const calculateProteinTarget = (
  weightKg: number,
  goal: 'muscle_gain' | 'fat_loss' | 'strength'
): number => {
  let factor = 1.8; // Default maintenance
  if (goal === 'muscle_gain') {
    factor = 2.0;
  } else if (goal === 'fat_loss') {
    factor = 2.2; // Higher protein to preserve muscle during deficit
  }
  return Math.round(weightKg * factor);
};
