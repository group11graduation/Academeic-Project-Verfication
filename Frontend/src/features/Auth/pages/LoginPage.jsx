import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../context/authContext';
import { Link, useNavigate } from 'react-router-dom';
import { BRAND, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';
import { appAlert, appConfirm, appError, appSuccess, appWarning } from '../../../lib/appDialog';

const loginSchema = z.object({
    identifier: z.string().trim().min(1, 'Username, email, or ID is required'),
    password: z.string().min(1, 'Password is required'),
});

const REMEMBER_KEY = 'projectverify_login_identifier';

const LoginPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError: setFormError,
        setValue,
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: { identifier: '', password: '' },
    });

    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const saved = localStorage.getItem(REMEMBER_KEY);
        if (saved) {
            setValue('identifier', saved);
            setRememberMe(true);
        }
    }, [setValue]);

    const onSubmit = async (values) => {
        if (rememberMe) {
            localStorage.setItem(REMEMBER_KEY, values.identifier);
        } else {
            localStorage.removeItem(REMEMBER_KEY);
        }

        const result = await login(values.identifier, values.password);

        if (result.success) {
            if (result.role === 'admin') navigate('/admin');
            else if (result.role === 'teacher') navigate('/teacher');
            else if (result.role === 'student') navigate('/student');
        } else {
            setFormError('root', { message: result.message || 'Login failed' });
        }
    };

    const rootMsg = errors.root?.message;

    return (
        <div className="fixed inset-0 overflow-y-auto">
            <div
                className="fixed inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: 'url(/login-background.png)' }}
                aria-hidden
            />
            <div className="fixed inset-0 bg-[#1d2f82]/75" aria-hidden />
            <div className="fixed inset-0 bg-gradient-to-br from-[#2a3fa4]/50 via-transparent to-[#0f172a]/80" aria-hidden />

            <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
                <div className="auth-page-card" style={{ WebkitBackdropFilter: 'blur(20px)' }}>
                    <div className="flex flex-col items-center text-center mb-7">
                        <ProjectVerifyLogo onDark size="lg" showText={false} className="mb-5 justify-center" />
                        <h1 className="text-2xl sm:text-[1.625rem] font-bold tracking-tight text-white">Welcome back!</h1>
                        <p className="mt-2.5 max-w-[320px] text-sm leading-relaxed text-white/70 font-medium">
                            Sign in to {PROJECT_NAME} — your assignments, project submissions, and verification dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {rootMsg && (
                            <div className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100">
                                {rootMsg}
                            </div>
                        )}

                        <div>
                            <label htmlFor="login-identifier" className="mb-2 block text-left text-xs font-semibold text-white/55">
                                Email or ID
                            </label>
                            <input
                                id="login-identifier"
                                type="text"
                                autoComplete="username"
                                {...register('identifier')}
                                disabled={isSubmitting}
                                placeholder="Enter your email or student ID"
                                className="auth-input"
                            />
                            {errors.identifier && (
                                <p className="mt-1.5 text-xs font-medium text-rose-300">{errors.identifier.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="login-password" className="mb-2 block text-left text-xs font-semibold text-white/55">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    {...register('password')}
                                    disabled={isSubmitting}
                                    placeholder="Enter your password"
                                    className="auth-input pr-10"
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-xs font-medium text-rose-300">{errors.password.message}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-white/70 select-none">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="h-4 w-4 rounded border-white/30 bg-[#1d2f82]/50 text-[#1e56e3] focus:ring-[#1e56e3]/40 focus:ring-offset-0"
                                />
                                Remember me
                            </label>
                            <button
                                type="button"
                                className="text-sm font-semibold text-white/75 hover:text-white transition-colors"
                                onClick={() => void appWarning('Contact your administrator to reset your password.')}
                            >
                                Forgot password?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-2 w-full rounded-full bg-white py-3.5 text-sm font-bold shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition hover:bg-white/95 active:scale-[0.99] disabled:opacity-60"
                            style={{ color: BRAND.primaryDeep }}
                        >
                            {isSubmitting ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Signing in…
                                </span>
                            ) : (
                                'Log in'
                            )}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/15" />
                        <span className="text-xs font-semibold text-white/45">Or</span>
                        <div className="h-px flex-1 bg-white/15" />
                    </div>

                    <Link
                        to="/"
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                        Explore {PROJECT_NAME}
                    </Link>

                    <p className="mt-7 text-center text-sm font-medium text-white/50">
                        Need an account?{' '}
                        <span className="text-white/80">Ask your institution administrator</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
