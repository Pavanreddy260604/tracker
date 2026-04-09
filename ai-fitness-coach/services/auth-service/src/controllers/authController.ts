import { Request, Response } from 'express';
import { User } from '../models/user';
import { hashPassword, verifyPassword, generateToken } from '../utils/security';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = new User({
      email,
      passwordHash,
      profile: {
        height: 170,
        weight: 70,
        age: 25,
        gender: 'male',
        fitnessGoal: 'muscle_gain',
        experienceLevel: 'beginner',
        gymType: 'commercial',
        availableEquipment: [],
        trainingDaysPerWeek: 4,
      },
      derivedMetrics: {
        bmi: 0,
        tdee: 0,
        dailyCalorieTarget: 2000,
        dailyProteinTarget: 150,
        lastCalculated: new Date(),
      },
    });

    await user.save();
    const token = generateToken((user as any)._id.toString());

    res.status(201).json({
      token,
      user: {
        id: (user as any)._id,
        email: user.email,
        name: name || email.split('@')[0],
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating account', error: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const token = generateToken((user as any)._id.toString());

    res.json({
      token,
      user: {
        id: (user as any)._id,
        email: user.email,
        name: email.split('@')[0],
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
};
