import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import { Logo } from '../components/ui/Logo';

const resetSchema = z.object({
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Password must contain a lowercase letter')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof resetSchema>;

export function ResetPassword() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(false);
    
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetForm>({
        resolver: zodResolver(resetSchema),
    });

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token.');
        }
    }, [token]);

    const onSubmit = async (data: ResetForm) => {
        if (!token) return;
        
        setError(null);
        setIsLoading(true);
        try {
            await api.resetPassword(token, data.password);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Reset failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-shell">
            <motion.div
                className="w-full max-w-sm mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* Header */}
                <div className="flex flex-col items-center mb-10 text-center">
                    <Logo size="lg" showText={false} className="mb-4" />
                    <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">Create New Password</h1>
                    <p className="text-base mt-2 text-text-secondary">
                        Please enter your new password
                    </p>
                </div>

                {/* Form Card */}
                <div className="auth-card rounded-2xl p-6 sm:p-8">
                    {!success ? (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            {error && (
                                <motion.div
                                    className="p-4 rounded-xl text-sm border border-status-error/30 bg-status-error/10 text-status-error font-medium"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                >
                                    {error}
                                </motion.div>
                            )}

                            {/* Password Field */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text-primary">
                                    New Password
                                </label>
                                <div className="relative">
                                    <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                                    <input
                                        type="password"
                                        className={cn(
                                            "auth-input w-full pl-12 pr-4 text-base",
                                            errors.password && "auth-input-error"
                                        )}
                                        placeholder="********"
                                        disabled={!token}
                                        {...register('password')}
                                    />
                                </div>
                                {errors.password && (
                                    <p className="text-sm text-status-error font-medium">{errors.password.message}</p>
                                )}
                            </div>

                            {/* Confirm Password Field */}
                            <div className="space-y-2 pt-2">
                                <label className="block text-sm font-medium text-text-primary">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                                    <input
                                        type="password"
                                        className={cn(
                                            "auth-input w-full pl-12 pr-4 text-base",
                                            errors.confirmPassword && "auth-input-error"
                                        )}
                                        placeholder="********"
                                        disabled={!token}
                                        {...register('confirmPassword')}
                                    />
                                </div>
                                {errors.confirmPassword && (
                                    <p className="text-sm text-status-error font-medium">{errors.confirmPassword.message}</p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="auth-primary-button mt-6 w-full h-14 text-base font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                disabled={isLoading || !token}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Updating...
                                    </span>
                                ) : (
                                    <>
                                        Reset Password
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <motion.div
                            className="p-6 rounded-xl border border-status-success/30 bg-status-success/10 flex flex-col items-center text-center space-y-4"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center mb-2">
                                <CheckCircle2 className="text-status-success w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-bold text-text-primary">All set!</h3>
                            <p className="text-base text-text-secondary">
                                Your password has been successfully reset.
                            </p>
                            
                            <Link
                                to="/login"
                                className="auth-primary-button mt-4 w-full h-12 text-base font-medium rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
                            >
                                Go to Login
                            </Link>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
