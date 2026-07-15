import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import AuthShell, { PROJECT_NAME } from '../components/AuthShell';

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
      // Dev-only fallback when SMTP is not configured on the server.
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
      subtitle={`Enter the email or ID you use to sign in to ${PROJECT_NAME}. We'll email you a secure link to set a new password.`}
      footer={
        <p className="mt-7 text-center text-sm font-medium text-white/50">
          Remembered it?{' '}
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
        {info ? (
          <div className="rounded-xl border border-sky-400/30 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-100">
            {info}
          </div>
        ) : null}
        <div>
          <label htmlFor="forgot-identifier" className="mb-2 block text-left text-xs font-semibold text-white/55">
            Email or ID
          </label>
          <input
            id="forgot-identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={submitting || Boolean(info)}
            placeholder="Email, student ID, or employee ID"
            className="auth-input"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || Boolean(info)}
          className="mt-2 w-full rounded-full bg-white py-3.5 text-sm font-bold text-[#1d2f82] shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition hover:bg-white/95 disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </span>
          ) : info ? (
            'Email sent'
          ) : (
            'Send reset link'
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
