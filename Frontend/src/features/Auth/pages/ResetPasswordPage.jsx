import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import { BRAND } from '../../../shared/ui/brandTheme';
import AuthShell, { authFieldClass, authPrimaryBtnClass } from '../components/AuthShell';

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
        rightTitle="Need a new link?"
        rightSubtitle="Password reset links expire for security. Request another from the forgot password page."
        footer={
          <p className="mt-8 text-center text-[13px]">
            <Link to="/forgot-password" className="font-semibold text-[#2a3fa4] hover:underline">
              Request a new reset
            </Link>
          </p>
        }
      >
        <Link
          to="/login"
          className="flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white py-2.5 text-[14px] font-semibold text-[#0F172A] transition hover:bg-slate-50"
        >
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your account. This link expires in 30 minutes."
      rightTitle="Almost done"
      rightSubtitle="Pick a strong password you haven't used here before, then sign in again."
      footer={
        <p className="mt-8 text-center text-[13px] font-normal text-[#51628f]">
          <Link to="/login" className="font-semibold text-[#2a3fa4] hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-normal text-rose-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-normal text-emerald-800">
            {success}
          </div>
        ) : null}

        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-left text-[13px] font-medium text-[#0F172A]">
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
        </div>

        <div>
          <label htmlFor="reset-confirm" className="mb-1.5 block text-left text-[13px] font-medium text-[#0F172A]">
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
            className={authFieldClass}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || Boolean(success)}
          className={authPrimaryBtnClass}
          style={{ backgroundColor: BRAND.primary }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Update password'
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
