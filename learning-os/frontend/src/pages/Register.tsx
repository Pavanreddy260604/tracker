import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Sparkles, ArrowRight, Check, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';

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
    });

    const password = watch('password', '');

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
                {/* Logo */}
                <div className="text-center mb-8">
                    <motion.div
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[color:var(--console-surface-2)] border border-white/10 shadow-lg"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                    >
                        <Sparkles size={28} className="text-white" />
                    </motion.div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-white">Create account</h1>
                    <p className="text-base mt-2 auth-muted">
                        Start tracking your learning journey
                    </p>
                </div>

                {/* Form Card */}
                <div className="auth-card rounded-2xl p-5 sm:p-8">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {error && (
                            <motion.div
                                className="p-4 rounded-xl text-sm border border-red-500/30 bg-red-500/10 text-red-400"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">Full Name</label>
                            <div className="relative">
                                <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.name && "auth-input-error"
                                    )}
                                    placeholder="John Doe"
                                    {...register('name')}
                                />
                            </div>
                            {errors.name && (
                                <p className="text-sm text-red-400">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">Email</label>
                            <div className="relative">
                                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.email && "auth-input-error"
                                    )}
                                    placeholder="you@example.com"
                                    {...register('email')}
                                />
                            </div>
                            {errors.email && (
                                <p className="text-sm text-red-400">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">Password</label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="password"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.password && "auth-input-error"
                                    )}
                                    placeholder="Create a strong password"
                                    {...register('password')}
                                />
                            </div>

                            {/* Password Requirements - Better Mobile Layout */}
                            <div className="auth-hint-panel grid grid-cols-2 gap-3 mt-4 p-4 rounded-xl">
                                {passwordChecks.map((check) => (
                                    <div
                                        key={check.label}
                                        className="flex items-center gap-2"
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: check.valid ? 'rgba(52, 168, 83, 0.2)' : 'rgba(255,255,255,0.05)',
                                            }}
                                        >
                                            {check.valid ? (
                                                <Check size={12} style={{ color: '#34a853' }} />
                                            ) : (
                                                <X size={12} style={{ color: '#6b7280' }} />
                                            )}
                                        </div>
                                        <span
                                            className="text-sm"
                                            style={{ color: check.valid ? '#34a853' : '#9aa0a6' }}
                                        >
                                            {check.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">Confirm Password</label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="password"
                                    className={cn(
                                        "auth-input w-full pl-12 pr-4 text-base",
                                        errors.confirmPassword && "auth-input-error"
                                    )}
                                    placeholder="Confirm your password"
                                    {...register('confirmPassword')}
                                />
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>
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
