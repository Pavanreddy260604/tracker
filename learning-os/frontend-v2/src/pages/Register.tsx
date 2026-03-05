import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Lock, ArrowRight, Check, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { Logo } from '../components/ui/Logo';

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Must contain a lowercase letter')
        .regex(/[A-Z]/, 'Must contain an uppercase letter')
        .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { register: registerUser, isLoading } = useAuthStore();

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
        mode: 'onChange',
    });

    const password = watch('password') || '';

    const passwordChecks = [
        { label: '8+ characters', valid: password.length >= 8 },
        { label: 'Lowercase', valid: /[a-z]/.test(password) },
        { label: 'Uppercase', valid: /[A-Z]/.test(password) },
        { label: 'Number', valid: /[0-9]/.test(password) },
    ];

    const onSubmit = async (data: RegisterForm) => {
        setError(null);
        try {
            await registerUser(data.name, data.email, data.password);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
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
                <div className="flex flex-col items-center mb-8 text-center">
                    <Logo size="lg" showText={false} className="mb-4" />
                    <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">Create account</h1>
                    <p className="text-base mt-2 text-text-secondary">
                        Start tracking your learning journey
                    </p>
                </div>

                {/* Form Card */}
                <div className="auth-card rounded-2xl p-5 sm:p-8">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <motion.div
                                className="p-4 rounded-xl text-sm border border-status-error/30 bg-status-error/10 text-status-error font-medium"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text-primary">Full Name</label>
                            <div className="relative">
                                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="text"
                                    autoComplete="name"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.name && "auth-input-error"
                                    )}
                                    placeholder="John Doe"
                                    {...register('name')}
                                />
                            </div>
                            {errors.name && (
                                <p className="text-sm text-status-error font-medium">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text-primary">Email</label>
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

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text-primary">Password</label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.password && "auth-input-error"
                                    )}
                                    placeholder="Create a strong password"
                                    {...register('password')}
                                />
                            </div>

                            {/* Password Requirements - Better Layout */}
                            <div className="auth-hint-panel grid grid-cols-2 gap-2 mt-2 p-3 rounded-xl border border-[color:var(--border-subtle)]">
                                {passwordChecks.map((check) => (
                                    <div
                                        key={check.label}
                                        className="flex items-center gap-1.5"
                                    >
                                        <div
                                            className={cn(
                                                "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                                                check.valid ? "bg-emerald-500/20" : "bg-zinc-500/10"
                                            )}
                                        >
                                            {check.valid ? (
                                                <Check size={10} className="text-emerald-500" />
                                            ) : (
                                                <X size={10} className="text-zinc-500" />
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                "text-[11px] sm:text-xs font-medium transition-colors",
                                                check.valid ? "text-emerald-500" : "text-zinc-500"
                                            )}
                                        >
                                            {check.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-text-primary">Confirm Password</label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.confirmPassword && "auth-input-error"
                                    )}
                                    placeholder="Confirm your password"
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
                            className="auth-primary-button w-full h-14 text-base font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-6"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Creating account...
                                </span>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="mt-6 pt-6 border-t border-[color:var(--border-subtle)]">
                        <p className="text-center text-base auth-muted">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="font-semibold hover:underline"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
