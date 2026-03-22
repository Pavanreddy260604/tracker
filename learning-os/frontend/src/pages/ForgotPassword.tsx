import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import { Logo } from '../components/ui/Logo';

const forgotSchema = z.object({
    email: z.string().email('Invalid email address'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export function ForgotPassword() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotForm>({
        resolver: zodResolver(forgotSchema),
    });

    const onSubmit = async (data: ForgotForm) => {
        setError(null);
        setSuccess(null);
        setIsLoading(true);
        try {
            const res = await api.forgotPassword(data.email) as unknown as { success?: boolean; message?: string };
            setSuccess(res?.message || 'If an account exists, a reset link was sent.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Request failed');
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
                    <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">Reset Password</h1>
                    <p className="text-base mt-2 text-text-secondary">
                        Enter your email to receive a reset link
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

                            {/* Email Field */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text-primary">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                                    <input
                                        type="email"
                                        autoComplete="email"
                                        className={cn(
                                            "auth-input w-full pl-12 pr-4 text-base",
                                            errors.email && "auth-input-error"
                                        )}
                                        placeholder="you@example.com"
                                        {...register('email')}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-sm text-status-error font-medium">{errors.email.message}</p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="auth-primary-button mt-6 w-full h-14 text-base font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Sending...
                                    </span>
                                ) : (
                                    <>
                                        Send Reset Link
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <motion.div
                            className="p-6 rounded-xl border border-status-success/30 bg-status-success/10 flex flex-col items-center text-center space-y-3"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <Mail className="text-status-success w-10 h-10 mb-2" />
                            <h3 className="text-lg font-semibold text-text-primary">Check your email</h3>
                            <p className="text-sm text-text-secondary">
                                {success}
                            </p>
                        </motion.div>
                    )}

                    {/* Divider */}
                    <div className="mt-6 pt-5 border-t border-[color:var(--border-subtle)]">
                        <p className="text-center text-base auth-muted flex items-center justify-center gap-2">
                            <Link
                                to="/login"
                                className="font-semibold hover:underline flex items-center gap-2"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                <ArrowLeft size={16} />
                                Back to login
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm font-medium auth-muted">
                        Track • Learn • Grow
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
