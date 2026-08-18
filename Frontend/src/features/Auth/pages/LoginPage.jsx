import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../context/authContext';
import { Link, useNavigate } from 'react-router-dom';
import { BRAND, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import AuthShell, { authFieldClass, authPrimaryBtnClass } from '../components/AuthShell';
import {
  clearRememberedCredentials,
  getRememberedCredentials,
  getRememberMePreference,
  saveRememberedCredentials,
} from '../../../lib/authStorage';

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username, email, or ID is required'),
  password: z.string().min(1, 'Password is required'),
});

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
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

  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const busy = isSubmitting || signingIn;

  const workspacePath =
    user?.role === 'student'
      ? '/student'
      : user?.role === 'teacher'
        ? '/teacher'
        : user?.role === 'admin'
          ? '/admin'
          : '/';

  useEffect(() => {
    const preferRemember = getRememberMePreference();
    const { identifier, password } = getRememberedCredentials();
    setRememberMe(preferRemember || Boolean(identifier));
    if (identifier) setValue('identifier', identifier);
    if (password) setValue('password', password);
  }, [setValue]);

  const onSubmit = async (values) => {
    setSigningIn(true);
    try {
      if (rememberMe) {
        saveRememberedCredentials(values.identifier, values.password);
      } else {
        clearRememberedCredentials();
      }

      const result = await login(values.identifier, values.password, { rememberMe });

      if (result?.success) {
        if (result.role === 'admin') navigate('/admin');
        else if (result.role === 'teacher') navigate('/teacher');
        else if (result.role === 'student') navigate('/student');
        else navigate('/');
      } else {
        setFormError('root', { message: result?.message || 'Login failed' });
      }
    } catch (err) {
      console.error('Login submit handler error:', err);
      setFormError('root', {
        message: err?.message || 'Login failed. Please try again.',
      });
    } finally {
      setSigningIn(false);
    }
  };

  const rootMsg = errors.root?.message;

  if (user) {
    return (
      <AuthShell
        title="Already signed in"
        subtitle={`You are signed in as ${user.name || user.email}. Continue to your workspace or sign out to use a different account.`}
        rightTitle="You're connected"
        rightSubtitle="Jump back into your academic workspace or switch accounts."
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate(workspacePath)}
            className={authPrimaryBtnClass}
            style={{ backgroundColor: BRAND.primary }}
          >
            Continue to my workspace
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Sign out and use another account
          </button>
          <Link
            to="/"
            className="flex w-full items-center justify-center rounded-lg py-2.5 text-[14px] font-normal text-[#51628f] transition hover:text-[#2a3fa4]"
          >
            Back to overview
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={`Sign in with your ${PROJECT_NAME} email, username, or ID.`}
      rightTitle="Verify academic projects with confidence"
      rightSubtitle="Submit proposals, review work, and keep institution workflows organized in one place."
      footer={
        <p className="mt-8 text-center text-[13px] font-normal text-[#51628f]">
          Need an account?{' '}
          <span className="font-semibold text-[#0F172A]">Ask your institution administrator</span>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="on">
        {rootMsg ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-normal text-rose-700">
            {rootMsg}
          </div>
        ) : null}

        <div>
          <label htmlFor="login-identifier" className="mb-1.5 block text-left text-[13px] font-medium text-[#0F172A]">
            Email or ID
          </label>
          <input
            id="login-identifier"
            type="text"
            name="username"
            autoComplete="username"
            {...register('identifier')}
            disabled={busy}
            placeholder="Enter your email or student ID"
            className={authFieldClass}
          />
          {errors.identifier ? (
            <p className="mt-1 text-[12px] font-normal text-rose-600">{errors.identifier.message}</p>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="login-password" className="text-[13px] font-medium text-[#0F172A]">
              Password
            </label>
            <Link to="/forgot-password" className="text-[12px] font-medium text-[#2a3fa4] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              disabled={busy}
              placeholder="Enter your password"
              className={`${authFieldClass} pr-10`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="mt-1 text-[12px] font-normal text-rose-600">{errors.password.message}</p>
          ) : null}
        </div>

        <label className="flex cursor-pointer select-none items-center gap-3 text-[13px] font-normal text-[#51628f]">
          <button
            type="button"
            role="switch"
            aria-checked={rememberMe}
            onClick={() => setRememberMe((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              rememberMe ? 'bg-[#2a3fa4]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                rememberMe ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          Remember me
        </label>

        <button
          type="submit"
          disabled={busy}
          className={authPrimaryBtnClass}
          style={{ backgroundColor: BRAND.primary }}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[12px] font-normal text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Link
        to="/"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-[14px] font-semibold text-[#0F172A] transition hover:bg-slate-50"
      >
        Explore {PROJECT_NAME}
      </Link>

      {/* Step dots (visual accent matching reference structure) */}
      <div className="mt-10 flex items-center justify-center gap-2" aria-hidden>
        <span className="h-1 w-6 rounded-full bg-[#2a3fa4]" />
        <span className="h-1 w-6 rounded-full bg-slate-200" />
      </div>
    </AuthShell>
  );
};

export default LoginPage;
