import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import api from '../../../lib/api';
import { BRAND_GRADIENT } from '../../../shared/ui/brandTheme';
import AuthShell, {
  authErrorBoxClass,
  authFieldClass,
  authFooterTextClass,
  authIconClass,
  authLabelClass,
  authMutedLinkClass,
  authPrimaryBtnClass,
  authSuccessBoxClass,
} from '../components/AuthShell';

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
          <p className={authFooterTextClass}>
            <Link to="/forgot-password" className={authMutedLinkClass}>
              Request a new reset
            </Link>
          </p>
        }
      >
        <Link
          to="/login"
          className="flex w-full items-center justify-center rounded-xl border border-[#dbe3f5] bg-white/60 py-3 text-[14px] font-semibold text-slate-700 transition hover:bg-white/90"
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
      footer={
        <p className={authFooterTextClass}>
          <Link to="/login" className={authMutedLinkClass}>
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error ? <div className={authErrorBoxClass}>{error}</div> : null}
        {success ? <div className={authSuccessBoxClass}>{success}</div> : null}

        <div>
          <label htmlFor="reset-password" className={authLabelClass}>
            New password
          </label>
          <div className="relative">
            <Lock className={authIconClass} />
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting || Boolean(success)}
              placeholder="At least 6 characters"
              className={`${authFieldClass} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="reset-confirm" className={authLabelClass}>
            Confirm password
          </label>
          <div className="relative">
            <Lock className={authIconClass} />
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
        </div>

        <button
          type="submit"
          disabled={submitting || Boolean(success)}
          className={authPrimaryBtnClass}
          style={{ background: BRAND_GRADIENT }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Update password
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordPage;
