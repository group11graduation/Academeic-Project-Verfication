import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import AuthShell, { BRAND } from '../components/AuthShell';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenFromUrl = useMemo(() => String(params.get('token') || '').trim(), [params]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!tokenFromUrl) {
      setError('Missing reset token. Start again from Forgot password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/reset-password', { token: tokenFromUrl, password });
      const message = res.data?.data?.message || res.data?.message || 'Password updated.';
      setSuccess(message);
      setTimeout(() => navigate('/login', { replace: true }), 1600);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password. Request a new link.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tokenFromUrl) {
    return (
      <AuthShell
        title="Reset link missing"
        subtitle="Use Forgot password from the login page to get a new secure reset link."
        footer={
          <p className="mt-7 text-center text-sm">
            <Link to="/forgot-password" className="font-semibold text-white/85 hover:text-white">
              Request a new reset
            </Link>
          </p>
        }
      >
        <Link
          to="/login"
          className="flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your account. This link expires in 30 minutes."
      footer={
        <p className="mt-7 text-center text-sm font-medium text-white/50">
          <Link to="/login" className="font-semibold text-white/85 hover:text-white">
            Back to log in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100">
            {success}
          </div>
        ) : null}

        <div>
          <label htmlFor="reset-password" className="mb-2 block text-left text-xs font-semibold text-white/55">
            New password
          </label>
          <div className="relative">
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting || Boolean(success)}
              placeholder="At least 6 characters"
              className="auth-input pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 transition-colors hover:text-white/80"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="reset-confirm" className="mb-2 block text-left text-xs font-semibold text-white/55">
            Confirm password
          </label>
          <input
            id="reset-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting || Boolean(success)}
            placeholder="Re-enter new password"
            className="auth-input"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || Boolean(success)}
          className="mt-2 w-full rounded-full bg-white py-3.5 text-sm font-bold shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition hover:bg-white/95 disabled:opacity-60"
          style={{ color: BRAND.primaryDeep }}
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </span>
          ) : (
            'Update password'
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
