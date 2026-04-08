import React from 'react';
import { User, Lock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../context/authContext';
import { useNavigate } from 'react-router-dom';

const loginSchema = z.object({
    identifier: z.string().trim().min(1, 'Username, email, or ID is required'),
    password: z.string().min(1, 'Password is required'),
});

const LoginPage = () => {
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
        <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center p-6">
            <div className="max-w-[480px] w-full bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-blue-500/5 overflow-hidden">
                <div className="p-10 pb-6 text-center">
                    <div className="w-16 h-16 bg-[#1D68E3] rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                        <ShieldCheck className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-[28px] font-bold text-[#0F172A] mb-2">Welcome Back</h1>
                    <p className="text-slate-500 font-medium">Please enter your credentials to access your account</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-10 pt-4 space-y-6">
                    {rootMsg && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-[14px] font-bold text-center">
                            {rootMsg}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[13px] uppercase font-bold text-slate-400 tracking-widest ml-1">
                            Username / ID
                        </label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#1D68E3] transition-colors" />
                            <input
                                type="text"
                                autoComplete="username"
                                {...register('identifier')}
                                placeholder="Enter your ID or Email"
                                className="w-full bg-[#F8FAFB] border-2 border-transparent rounded-[20px] py-4 pl-12 pr-4 text-[15px] font-semibold text-slate-700 focus:bg-white focus:border-[#1D68E3]/20 focus:ring-0 transition-all outline-none"
                                disabled={isSubmitting}
                            />
                        </div>
                        {errors.identifier && (
                            <p className="text-sm text-red-600 font-medium ml-1">{errors.identifier.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[13px] uppercase font-bold text-slate-400 tracking-widest ml-1">
                            Password / Passcode
                        </label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#1D68E3] transition-colors" />
                            <input
                                type="password"
                                autoComplete="current-password"
                                {...register('password')}
                                placeholder="••••••••"
                                className="w-full bg-[#F8FAFB] border-2 border-transparent rounded-[20px] py-4 pl-12 pr-4 text-[15px] font-semibold text-slate-700 focus:bg-white focus:border-[#1D68E3]/20 focus:ring-0 transition-all outline-none"
                                disabled={isSubmitting}
                            />
                        </div>
                        {errors.password && (
                            <p className="text-sm text-red-600 font-medium ml-1">{errors.password.message}</p>
                        )}
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-[#1D68E3] text-white rounded-[20px] py-4 font-bold text-[16px] shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="px-10 py-6 bg-[#F8FAFB] border-t border-slate-100 text-center">
                    <p className="text-[13px] font-semibold text-slate-500">
                        Secure Access Portal &bull; ML-Driven Analysis
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
