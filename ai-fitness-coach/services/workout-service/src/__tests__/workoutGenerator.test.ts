import { generateWorkoutPlan } from '../services/workoutGenerator';
import { WorkoutPlan } from '../models/workout_plan';
import { Exercise } from '../models/exercise';

// Mock the models
jest.mock('../models/workout_plan');
jest.mock('../models/exercise');

describe('Workout Generator Logic', () => {
  let mockExerciseQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockExerciseQuery = {
      limit: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve([
        { _id: 'ex1', name: 'Exercise 1', movementPattern: 'push' },
        { _id: 'ex2', name: 'Exercise 2', movementPattern: 'pull' }
      ])),
      catch: jest.fn()
    };

    (Exercise.find as jest.Mock).mockReturnValue(mockExerciseQuery);
    (WorkoutPlan.updateMany as jest.Mock).mockResolvedValue({ nModified: 1 });
  });

  it('should generate a plan with the correct number of days', async () => {
    // Mock WorkoutPlan constructor and save
    const mockSave = jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); });
    (WorkoutPlan as any).mockImplementation((data: any) => ({
      ...data,
      save: mockSave
    }));

    const result = await generateWorkoutPlan('user123', {
      goal: 'muscle_gain',
      availableEquipment: ['Bodyweight'],
      daysPerWeek: 3
    });

    expect(result.days.length).toBe(3);
    expect(mockSave).toHaveBeenCalled();
  });

  it('should assign correct rep ranges for strength goal', async () => {
    const mockSave = jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); });
    (WorkoutPlan as any).mockImplementation((data: any) => ({
      ...data,
      save: mockSave
    }));

    const result = await generateWorkoutPlan('user123', {
      goal: 'strength',
      availableEquipment: ['Bodyweight'],
      daysPerWeek: 3
    });

    // Check reps for any exercise in the first day
    const firstExercise = result.days[0].exercises[0];
    expect(firstExercise.repsMin).toBe(3);
    expect(firstExercise.repsMax).toBe(6);
    expect(firstExercise.sets).toBe(4);
  });
});
