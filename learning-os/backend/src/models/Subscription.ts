import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
    userId: mongoose.Types.ObjectId;          // ref: User
    plan: 'free_trial' | 'learner' | 'builder';
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

    // Razorpay specific
    razorpaySubscriptionId?: string;
    razorpayCustomerId?: string;

    trialEndsAt?: Date;           // 7-day free trial
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    canceledAt?: Date;
    cancelAtPeriodEnd: boolean;   // true = will cancel at period end (grace)

    // Feature limits
    limits: {
        monthlyInterviews: number;   // free_trial=3, learner=10, builder=unlimited (-1)
        aiChatMessages: number;      // free_trial=50, learner=200, builder=unlimited (-1)
        scriptWriterAccess: boolean; // builder only
    };

    usage: {
        interviewsUsed: number;
        chatMessagesUsed: number;
        resetAt: Date;               // resets monthly
    };

    createdAt: Date;
    updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: { type: String, enum: ['free_trial', 'learner', 'builder'], default: 'free_trial' },
    status: { type: String, enum: ['trialing', 'active', 'past_due', 'canceled', 'expired'], default: 'trialing' },

    razorpaySubscriptionId: { type: String },
    razorpayCustomerId: { type: String },

    trialEndsAt: { type: Date },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    canceledAt: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },

    limits: {
        monthlyInterviews: { type: Number, default: 3 },
        aiChatMessages: { type: Number, default: 50 },
        scriptWriterAccess: { type: Boolean, default: false },
    },

    usage: {
        interviewsUsed: { type: Number, default: 0 },
        chatMessagesUsed: { type: Number, default: 0 },
        resetAt: { type: Date, required: true },
    }
}, { timestamps: true });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
