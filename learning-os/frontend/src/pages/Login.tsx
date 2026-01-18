import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

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
        <div
            className="min-h-screen flex flex-col justify-center px-5 py-8 sm:px-6 lg:px-8"
            style={{ background: '#1a1a2e' }}
        >
            <motion.div
                className="w-full max-w-sm mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* Logo */}
                <div className="text-center mb-10">
                    <motion.div
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                    >
                        <Sparkles size={28} className="text-white" />
                    </motion.div>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-white">Welcome back</h1>
                    <p className="text-base mt-2" style={{ color: '#9aa0a6' }}>
                        Sign in to continue to Learning OS
                    </p>
                </div>

                {/* Form Card */}
                <div
                    className="rounded-2xl p-6 sm:p-8"
                    style={{
                        background: '#16213e',
                        border: '1px solid rgba(255,255,255,0.08)'
                    }}
                >
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {error && (
                            <motion.div
                                className="p-4 rounded-xl text-sm"
                                style={{
                                    background: 'rgba(234, 67, 53, 0.1)',
                                    border: '1px solid rgba(234, 67, 53, 0.3)',
                                    color: '#ff6b6b'
                                }}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                            >
                                {error}
                            </motion.div>
                        )}

                        {/* Email Field */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">
                                Email
                            </label>
                            <div className="relative">
                                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }} />
                                <input
                                    type="email"
                                    className="w-full h-14 pl-12 pr-4 text-base rounded-xl transition-all"
                                    style={{
                                        background: '#1f2b4d',
                                        border: errors.email ? '2px solid #ea4335' : '1px solid rgba(255,255,255,0.1)',
                                        color: '#e8eaed'
                                    }}
                                    placeholder="you@example.com"
                                    {...register('email')}
                                />
                            </div>
                            {errors.email && (
                                <p className="text-sm" style={{ color: '#ff6b6b' }}>{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">
                                Password
                            </label>
                            <div className="relative">
                                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }} />
                                <input
                                    type="password"
                                    className="w-full h-14 pl-12 pr-4 text-base rounded-xl transition-all"
                                    style={{
                                        background: '#1f2b4d',
                                        border: errors.password ? '2px solid #ea4335' : '1px solid rgba(255,255,255,0.1)',
                                        color: '#e8eaed'
                                    }}
                                    placeholder="Enter your password"
                                    {...register('password')}
                                />
                            </div>
                            {errors.password && (
                                <p className="text-sm" style={{ color: '#ff6b6b' }}>{errors.password.message}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="w-full h-14 text-base font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{
                                background: '#4285f4',
                                color: 'white'
                            }}
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
                    <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-center text-base" style={{ color: '#9aa0a6' }}>
                            Don't have an account?{' '}
                            <Link
                                to="/register"
                                className="font-semibold hover:underline"
                                style={{ color: '#4285f4' }}
                            >
                                Create account
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-10 text-center">
                    <p className="text-sm font-medium" style={{ color: '#6b7280' }}>
                        Track • Learn • Grow
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
