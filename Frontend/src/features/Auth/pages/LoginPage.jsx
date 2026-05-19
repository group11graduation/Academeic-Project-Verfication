import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../context/authContext';
import { Link, useNavigate } from 'react-router-dom';

const loginSchema = z.object({
    identifier: z.string().trim().min(1, 'Username, email, or ID is required'),
    password: z.string().min(1, 'Password is required'),
});

const ACCENT = '#2a3fa4';
const NAVY = '#1d2f82';

function LoginIllustration() {
    return (
        <div className="relative h-full min-h-[280px] lg:min-h-[520px] w-full overflow-hidden bg-gradient-to-br from-[#dbe4fc] via-[#e8eefc] to-[#c5d4f5]">
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
                }}
            />
            <svg
                className="relative z-[1] h-full w-full object-cover"
                viewBox="0 0 480 520"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
            >
                <ellipse cx="120" cy="420" rx="180" ry="40" fill={ACCENT} fillOpacity="0.12" />
                <ellipse cx="380" cy="440" rx="140" ry="28" fill={NAVY} fillOpacity="0.08" />

                {/* Dashboard panel */}
                <rect x="200" y="80" width="240" height="200" rx="16" fill="white" fillOpacity="0.85" stroke={NAVY} strokeOpacity="0.15" strokeWidth="1.5" />
                <rect x="220" y="104" width="80" height="10" rx="3" fill={NAVY} fillOpacity="0.2" />
                <rect x="220" y="124" width="120" height="6" rx="2" fill={NAVY} fillOpacity="0.12" />

                {/* Pie on screen */}
                <path
                    d="M 320 168 A 36 36 0 1 1 320 204 L 320 168 Z"
                    fill={ACCENT}
                    fillOpacity="0.85"
                />
                <path
                    d="M 320 168 A 36 36 0 0 1 356 200 L 320 204 Z"
                    fill={NAVY}
                    fillOpacity="0.35"
                />
                <circle cx="320" cy="204" r="36" stroke={NAVY} strokeOpacity="0.2" strokeWidth="1" fill="none" />

                {/* Bars on screen */}
                <rect x="228" y="248" width="14" height="40" rx="2" fill={ACCENT} fillOpacity="0.5" />
                <rect x="250" y="232" width="14" height="56" rx="2" fill={ACCENT} fillOpacity="0.75" />
                <rect x="272" y="256" width="14" height="32" rx="2" fill={NAVY} fillOpacity="0.35" />
                <rect x="294" y="220" width="14" height="68" rx="2" fill={ACCENT} fillOpacity="0.9" />

                {/* Floating 3D-ish charts */}
                <g transform="translate(48 200)">
                    <ellipse cx="40" cy="88" rx="52" ry="14" fill={NAVY} fillOpacity="0.15" />
                    <path d="M 8 48 L 72 48 L 80 80 L 0 80 Z" fill="white" fillOpacity="0.9" stroke={NAVY} strokeOpacity="0.2" />
                    <rect x="20" y="28" width="10" height="36" rx="1" fill={ACCENT} fillOpacity="0.6" />
                    <rect x="36" y="16" width="10" height="48" rx="1" fill={ACCENT} fillOpacity="0.85" />
                    <rect x="52" y="32" width="10" height="32" rx="1" fill={NAVY} fillOpacity="0.35" />
                </g>

                <g transform="translate(320 320)">
                    <ellipse cx="36" cy="72" rx="44" ry="12" fill={ACCENT} fillOpacity="0.12" />
                    <path
                        d="M 36 8 A 40 40 0 1 1 12 52 L 36 48 Z"
                        fill={ACCENT}
                        fillOpacity="0.75"
                    />
                    <path
                        d="M 36 8 A 40 40 0 0 1 68 44 L 36 48 Z"
                        fill="white"
                        fillOpacity="0.95"
                        stroke={NAVY}
                        strokeOpacity="0.15"
                    />
                </g>

                {/* Stylized figures */}
                <g opacity="0.95">
                    <circle cx="118" cy="312" r="22" fill="white" stroke={NAVY} strokeOpacity="0.25" strokeWidth="1.5" />
                    <path d="M 96 348 Q 118 332 140 348 L 136 400 L 100 400 Z" fill="white" stroke={NAVY} strokeOpacity="0.2" strokeWidth="1.2" />
                    <rect x="108" y="348" width="20" height="56" rx="4" fill={ACCENT} fillOpacity="0.35" />

                    <circle cx="188" cy="300" r="20" fill="white" stroke={NAVY} strokeOpacity="0.25" strokeWidth="1.5" />
                    <path d="M 170 330 Q 188 318 206 330 L 202 388 L 174 388 Z" fill="white" stroke={NAVY} strokeOpacity="0.2" strokeWidth="1.2" />
                    <rect x="178" y="332" width="18" height="52" rx="4" fill={NAVY} fillOpacity="0.2" />
                </g>
            </svg>
        </div>
    );
}

const LoginPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError: setFormError,
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: { identifier: '', password: '' },
    });

    const { login } = useAuth();
    const navigate = useNavigate();

    const onSubmit = async (values) => {
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
        <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-5 lg:p-8 overflow-hidden bg-[#e8eefc]">
            {/* Soft organic blobs */}
            <div
                className="pointer-events-none absolute -top-24 -left-32 h-[420px] w-[420px] rounded-full bg-[#b8c9f0] opacity-50 blur-3xl"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute top-1/3 -right-24 h-[380px] w-[380px] rounded-full bg-[#c5d4f5] opacity-55 blur-3xl"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute bottom-0 left-1/4 h-[320px] w-[320px] rounded-full bg-[#a8bfea] opacity-40 blur-3xl"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.22]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
                }}
                aria-hidden
            />

            <div
                className="relative z-10 w-full max-w-[900px] rounded-[24px] border-2 bg-white shadow-[0_20px_64px_rgba(29,47,130,0.12)] overflow-hidden flex flex-col lg:flex-row"
                style={{ borderColor: NAVY }}
            >
                {/* Left: form */}
                <div className="w-full lg:w-[42%] flex flex-col justify-center px-7 sm:px-8 py-8 lg:py-10 lg:pl-10 lg:pr-7">
                    <Link
                        to="/"
                        className="text-[12px] font-bold tracking-[0.18em] uppercase mb-8 hover:opacity-80 transition-opacity"
                        style={{ color: NAVY }}
                    >
                        ProjectVerify
                    </Link>

                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" style={{ color: NAVY }}>
                        Login
                    </h1>
                    <p className="text-[13px] text-slate-500 font-medium mb-8 leading-relaxed">
                        Welcome — sign in to your academic verification and project dashboard.
                    </p>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {rootMsg && (
                            <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                                {rootMsg}
                            </div>
                        )}

                        <div>
                            <label htmlFor="login-identifier" className="block text-[12px] font-semibold text-slate-600 mb-2">
                                Email or ID
                            </label>
                            <input
                                id="login-identifier"
                                type="text"
                                autoComplete="username"
                                {...register('identifier')}
                                disabled={isSubmitting}
                                placeholder="Enter your email, username, or student ID"
                                className="w-full bg-transparent border-0 border-b border-slate-300 rounded-none px-0 py-2 text-[14px] font-medium text-black placeholder:text-slate-400 focus:border-b-2 focus:border-[#2a3fa4] focus:ring-0 focus:outline-none transition-colors disabled:opacity-60"
                            />
                            {errors.identifier && (
                                <p className="text-xs text-red-600 font-medium mt-1.5">{errors.identifier.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="login-password" className="block text-[12px] font-semibold text-slate-600 mb-2">
                                Password
                            </label>
                            <div className="relative flex items-end border-b border-slate-300 focus-within:border-b-2 focus-within:border-[#2a3fa4] transition-colors">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    {...register('password')}
                                    disabled={isSubmitting}
                                    placeholder="••••••••"
                                    className="w-full flex-1 bg-transparent border-0 rounded-none px-0 py-2 pr-10 text-[14px] font-medium text-black placeholder:text-slate-400 focus:ring-0 focus:outline-none disabled:opacity-60"
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-0 bottom-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-red-600 font-medium mt-1.5">{errors.password.message}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full uppercase tracking-widest text-[13px] font-bold text-white py-3 rounded-xl shadow-[0_10px_24px_rgba(42,63,164,0.35)] hover:shadow-[0_12px_28px_rgba(42,63,164,0.42)] hover:opacity-[0.97] active:scale-[0.99] transition-all disabled:opacity-60 disabled:shadow-none"
                            style={{ backgroundColor: ACCENT }}
                        >
                            {isSubmitting ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Signing in
                                </span>
                            ) : (
                                'Login'
                            )}
                        </button>
                    </form>
                </div>

                {/* Right: illustration */}
                <div className="w-full lg:w-[58%] border-t lg:border-t-0 lg:border-l border-slate-200/80 min-h-[220px]">
                    <LoginIllustration />
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
