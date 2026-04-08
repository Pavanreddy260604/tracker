import { User } from '../models/user';

export const updateStreak = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (!user.streak.lastActivityDate) {
    user.streak.current = 1;
    user.streak.lastActivityDate = today;
  } else {
    const lastDate = new Date(user.streak.lastActivityDate);
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Already active today
    } else if (diffDays === 1) {
      // Consecutive day
      user.streak.current += 1;
    } else {
      // Gap in streak - Check for freeze
      const currentMonth = now.getMonth();
      const freezeAvailable = !user.streak.freezeUsed || user.streak.freezeMonth !== currentMonth;

      if (freezeAvailable) {
        // Apply freeze (streak stays the same)
        user.streak.freezeUsed = true;
        user.streak.freezeMonth = currentMonth;
        user.streak.current += 1; // Count today as active after freeze
      } else {
        // Reset streak
        user.streak.current = 1;
      }
    }
    user.streak.lastActivityDate = today;
  }

  if (user.streak.current > user.streak.longest) {
    user.streak.longest = user.streak.current;
  }

  return user.save();
};

export const getStreak = async (userId: string) => {
  const user = await User.findById(userId);
  return user?.streak || null;
};
