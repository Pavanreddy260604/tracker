import mongoose, { Schema, Document } from 'mongoose';

export interface IFoodItem extends Document {
  name: string;
  category: string;
  servingSize: {
    amount: number;
    unit: string;
  };
  macros: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fats: number;
  };
  isIndian: boolean;
  isCommon: boolean;
}

const FoodItemSchema = new Schema<IFoodItem>({
  name: { type: String, required: true },
  category: String,
  servingSize: {
    amount: Number,
    unit: String,
  },
  macros: {
    calories: Number,
    protein: Number,
    carbohydrates: Number,
    fats: Number,
  },
  isIndian: { type: Boolean, default: false },
  isCommon: { type: Boolean, default: false },
});

FoodItemSchema.index({ name: 1 });
FoodItemSchema.index({ category: 1 });
FoodItemSchema.index({ isCommon: 1 });

export const FoodItem = mongoose.model<IFoodItem>('FoodItem', FoodItemSchema);
