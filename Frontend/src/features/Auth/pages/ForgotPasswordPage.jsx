import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Mail } from 'lucide-react';
import api from '../../../lib/api';
import { BRAND_GRADIENT } from '../../../shared/ui/brandTheme';
import AuthShell, { PROJECT_NAME, authFieldClass, authPrimaryBtnClass } from '../components/AuthShell';

const ForgotPasswordPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const value = identifier.trim();
    if (!value) {
      setError('Enter your email or student/employee ID.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/forgot-password', { identifier: value });
      const data = res.data?.data || {};
      if (data.resetToken) {
        window.location.href = `/reset-password?token=${encodeURIComponent(data.resetToken)}`;
        return;
      }
      setInfo(
        data.message ||
          'If an account matches that email or ID, we sent a password reset link. Check your inbox and spam folder.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send reset email. Try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Forgot password?"
      subtitle={`Enter the email or ID you use for ${PROJECT_NAME}. We'll send a secure reset link.`}
      footer={
        <p className="mt-7 text-center text-[13px] font-normal text-white/50">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-[#8ea4f0] hover:text-white hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2.5 text-[13px] font-normal text-rose-100">
            {error}
          </div>
        ) : null}
        {info ? (
          <div className="rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-2.5 text-[13px] font-normal text-sky-100">
            {info}
          </div>
        ) : null}
        <div>
          <label htmlFor="forgot-identifier" className="mb-1.5 block text-left text-[12px] font-medium text-white/60">
            Email or ID
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              id="forgot-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={submitting || Boolean(info)}
              placeholder="Email, student ID, or employee ID"
              className={authFieldClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || Boolean(info)}
          className={authPrimaryBtnClass}
          style={{ background: BRAND_GRADIENT }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : info ? (
            'Email sent'
          ) : (
            <>
              Send reset link
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
