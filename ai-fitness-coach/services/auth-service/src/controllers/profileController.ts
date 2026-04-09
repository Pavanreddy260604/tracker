import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as profileService from '../services/profileService';
import { User } from '../models/user';

const EQUIPMENT_LIST = [
  { id: 'barbell', name: 'Barbell' },
  { id: 'dumbbell', name: 'Dumbbells' },
  { id: 'cable', name: 'Cable Machine' },
  { id: 'machine', name: 'Weight Machines' },
  { id: 'bodyweight', name: 'Bodyweight Only' },
  { id: 'kettlebell', name: 'Kettlebell' },
  { id: 'resistance_band', name: 'Resistance Bands' },
  { id: 'pull_up_bar', name: 'Pull-up Bar' },
  { id: 'bench', name: 'Bench' },
  { id: 'squat_rack', name: 'Squat Rack' },
];

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const profile = await profileService.getProfile(userId);
    if (!profile) {
       res.status(404).json({ message: 'User not found' });
       return;
    }
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
     res.status(401).json({ message: 'User ID missing from token' });
     return;
  }

  try {
    const profileData = req.body;
    const updatedProfile = await profileService.updateProfile(userId, profileData);
    if (!updatedProfile) {
       res.status(404).json({ message: 'User not found' });
       return;
    }
    res.json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (error: any) {
    res.status(400).json({ message: 'Error updating profile', error: error.message });
  }
};

export const createProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Use update logic as it handles metric calculations and defaults
  return updateProfile(req, res);
};

export const getCoachSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }
  try {
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({
      experienceLevel: user.profile?.experienceLevel || 'beginner',
      trainingDays: user.profile?.trainingDaysPerWeek || 4,
      equipmentIds: user.profile?.availableEquipment || [],
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching coach settings', error: error.message });
  }
};

export const updateCoachSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = (req.user as any)?.userId;
  if (!userId) {
    res.status(401).json({ message: 'User ID missing from token' });
    return;
  }
  try {
    const { experienceLevel, trainingDays, equipmentIds } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (experienceLevel !== undefined) user.profile.experienceLevel = experienceLevel;
    if (trainingDays !== undefined) user.profile.trainingDaysPerWeek = trainingDays;
    if (equipmentIds !== undefined) user.profile.availableEquipment = equipmentIds;
    await user.save();
    res.json({ message: 'Coach settings updated', settings: { experienceLevel: user.profile.experienceLevel, trainingDays: user.profile.trainingDaysPerWeek, equipmentIds: user.profile.availableEquipment } });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating coach settings', error: error.message });
  }
};

export const getAvailableEquipment = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json(EQUIPMENT_LIST);
};
