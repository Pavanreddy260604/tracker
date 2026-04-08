import mongoose, { Schema, Document } from 'mongoose';

export interface INutritionLog extends Document {
  userId: string;
  date: Date;
  entries: {
    foodId?: string;
    description: string;
    servings: number;
    calories: number;
    protein: number;
    carbohydrates: number;
    fats: number;
    loggedAt: Date;
  }[];
  totals: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fats: number;
  };
}

const NutritionLogSchema = new Schema<INutritionLog>({
  userId: { type: String, required: true },
  date: { type: Date, required: true },
  entries: [{
    foodId: String,
    description: String,
    servings: Number,
    calories: Number,
    protein: Number,
    carbohydrates: Number,
    fats: Number,
    loggedAt: { type: Date, default: Date.now },
  }],
  totals: {
    calories: Number,
    protein: Number,
    carbohydrates: Number,
    fats: Number,
  },
}, { timestamps: true });

NutritionLogSchema.index({ userId: 1, date: -1 });
NutritionLogSchema.index({ userId: 1, "entries.foodId": 1 });

export const NutritionLog = mongoose.model<INutritionLog>('NutritionLog', NutritionLogSchema);
