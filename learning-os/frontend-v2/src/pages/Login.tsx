import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { Logo } from '../components/ui/Logo';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation(); // hook added
    const { login, isLoading } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginForm) => {
        setError(null);
        try {
            await login(data.email, data.password);
            const from = (location.state as any)?.from?.pathname || '/';
            navigate(from, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
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
                    <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">Welcome back</h1>
                    <p className="text-base mt-2 text-text-secondary">
                        Sign in to continue to Learning OS
                    </p>
                </div>

                {/* Form Card */}
                <div className="auth-card rounded-2xl p-6 sm:p-8">
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

                        {/* Password Field */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text-primary">
                                Password
                            </label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.password && "auth-input-error"
                                    )}
                                    placeholder="Enter your password"
                                    {...register('password')}
                                />
                            </div>
                            {errors.password && (
                                <p className="text-sm text-status-error font-medium">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="auth-primary-button w-full h-14 text-base font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="mt-6 pt-5 border-t border-[color:var(--border-subtle)]">
                        <p className="text-center text-base auth-muted">
                            Don't have an account?{' '}
                            <Link
                                to="/register"
                                className="font-semibold hover:underline"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                Create account
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
