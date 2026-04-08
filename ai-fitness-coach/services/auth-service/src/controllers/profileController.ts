import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import * as profileService from '../services/profileService';

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
