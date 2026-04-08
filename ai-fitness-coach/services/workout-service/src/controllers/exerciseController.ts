import { Request, Response } from 'express';
import * as exerciseService from '../services/exerciseService';

export const listExercises = async (req: Request, res: Response): Promise<void> => {
  try {
    const movementPattern = typeof req.query.movementPattern === 'string' ? req.query.movementPattern : undefined;
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const eqParam = req.query.equipment;
    const equipment = typeof eqParam === 'string' ? eqParam.split(',') : (Array.isArray(eqParam) ? eqParam.map(String) : []);

    const filters: exerciseService.ExerciseFilters = {
      movementPattern,
      difficulty,
      search,
      equipment
    };

    const pageStr = typeof req.query.page === 'string' ? req.query.page : '1';
    const limitStr = typeof req.query.limit === 'string' ? req.query.limit : '20';

    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 20;

    const result = await exerciseService.listExercises(filters, page, limit);
    res.json({
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error listing exercises', error: error.message });
  }
};

export const getExerciseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const exercise = await exerciseService.getExerciseById(id);
    if (!exercise) {
       res.status(404).json({ message: 'Exercise not found' });
       return;
    }
    res.json(exercise);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching exercise', error: error.message });
  }
};

export const getAlternatives = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const eq = req.query.equipment;
    const availableEquipment = typeof eq === 'string' ? eq.split(',') : (Array.isArray(eq) ? eq.map(String) : []);

    if (availableEquipment.length === 0) {
       res.status(400).json({ message: 'availableEquipment query parameter is required' });
       return;
    }

    const alternatives = await exerciseService.findAlternatives(id, availableEquipment);
    res.json(alternatives);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching alternatives', error: error.message });
  }
};
