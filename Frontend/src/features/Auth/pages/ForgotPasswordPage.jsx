import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import { BRAND } from '../../../shared/ui/brandTheme';
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
      subtitle={`Enter the email or ID you use to sign in to ${PROJECT_NAME}. We'll email you a secure link to set a new password.`}
      rightTitle="Reset securely"
      rightSubtitle="We'll send a time-limited link so you can choose a new password for your account."
      footer={
        <p className="mt-8 text-center text-[13px] font-normal text-[#51628f]">
          Remembered it?{' '}
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
        {info ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] font-normal text-sky-800">
            {info}
          </div>
        ) : null}
        <div>
          <label htmlFor="forgot-identifier" className="mb-1.5 block text-left text-[13px] font-medium text-[#0F172A]">
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
            className={authFieldClass}
          />
        </div>
        <button
          type="submit"
          disabled={submitting || Boolean(info)}
          className={authPrimaryBtnClass}
          style={{ backgroundColor: BRAND.primary }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
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
