import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../context/authContext';
import { Link, useNavigate } from 'react-router-dom';
import { BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import AuthShell, {
  authErrorBoxClass,
  authFieldClass,
  authIconClass,
  authLabelClass,
  authMutedLinkClass,
  authPrimaryBtnClass,
} from '../components/AuthShell';
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
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate(workspacePath)}
            className={authPrimaryBtnClass}
            style={{ background: BRAND_GRADIENT }}
          >
            Continue to my workspace
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-3 text-[14px] font-semibold text-[var(--text-primary)] transition hover:brightness-95"
          >
            Sign out and use another account
          </button>
          <Link
            to="/"
            className="flex w-full items-center justify-center py-2 text-[13px] font-normal text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            Back to overview
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle={`Access your ${PROJECT_NAME} academic workspace`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="on">
        {rootMsg ? <div className={authErrorBoxClass}>{rootMsg}</div> : null}

        <div>
          <label htmlFor="login-identifier" className={authLabelClass}>
            Email or ID
          </label>
          <div className="relative">
            <Mail className={authIconClass} />
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
          </div>
          {errors.identifier ? (
            <p className="mt-1.5 text-[12px] font-normal text-rose-600">{errors.identifier.message}</p>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="login-password" className="text-[12px] font-medium text-[var(--text-secondary)]">
              Password
            </label>
            <Link to="/forgot-password" className={authMutedLinkClass}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className={authIconClass} />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              disabled={busy}
              placeholder="Enter your password"
              className={`${authFieldClass} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="mt-1.5 text-[12px] font-normal text-rose-600">{errors.password.message}</p>
          ) : null}
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px] font-normal text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-[#dbe3f5] bg-[var(--bg-card)] text-[var(--brand-primary)] focus:ring-[#1D68E3]/40 focus:ring-offset-0"
          />
          Remember me
        </label>

        <button type="submit" disabled={busy} className={authPrimaryBtnClass} style={{ background: BRAND_GRADIENT }}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
