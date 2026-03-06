import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    scriptInterests?: {
        directors: string[];
        genres: string[];
        styles: string[];
    };
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    scriptInterests: {
        directors: { type: [String], default: [] },
        genres: { type: [String], default: [] },
        styles: { type: [String], default: [] }
    }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
