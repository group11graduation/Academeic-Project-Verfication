import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';

/**
 * Centered auth card on the landing soft-gradient backdrop (login / forgot / reset).
 */
export default function AuthShell({
  title = 'Sign in',
  subtitle,
  children,
  footer,
  showLockIcon = true,
}) {
  return (
    <div
      className="fixed inset-0 flex min-h-[100dvh] flex-col overflow-y-auto bg-[#f0f1f3] font-sans text-[var(--sv-text)] antialiased"
    >
      {/* Soft page gradient wash — matches landing */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute inset-x-0 top-0 h-[720px] opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(42,63,164,0.18), transparent 60%), radial-gradient(ellipse 45% 40% at 15% 20%, rgba(29,104,227,0.14), transparent 55%), radial-gradient(ellipse 40% 35% at 85% 15%, rgba(99,102,241,0.12), transparent 50%)',
          }}
        />
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#c7d2fe]/55 blur-3xl" />
        <div className="absolute -right-16 bottom-8 h-80 w-80 rounded-full bg-[#bfdbfe]/50 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 h-56 w-56 rounded-full bg-[#a5b4fc]/35 blur-3xl" />
      </div>

      <header className="relative z-10 flex shrink-0 items-center px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex">
          <ProjectVerifyLogo size="lg" tagline="" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div
          className="w-full max-w-[440px] rounded-[1.75rem] border border-white/70 px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-9 sm:py-10"
          style={{
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="mb-7 text-center">
            {showLockIcon ? (
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#dbe3f5] bg-white/60 text-[#2a3fa4] shadow-sm"
              >
                <Lock className="h-5 w-5" strokeWidth={2} />
              </div>
            ) : null}
            {title ? (
              <h1 className="text-[1.75rem] font-semibold leading-[1.2] tracking-tight text-slate-950">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mx-auto mt-2 max-w-[320px] text-[14px] font-normal leading-[1.5] text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          {children}
          {footer}
        </div>
      </main>

      <footer className="relative z-10 shrink-0 px-4 pb-5 pt-2 text-center text-[11px] font-normal text-slate-400">
        © {new Date().getFullYear()} {PROJECT_NAME}. All rights reserved.
      </footer>
    </div>
  );
}

/** Light glass-theme field styles for the auth card */
export const authFieldClass =
  'w-full rounded-xl border border-[#dbe3f5] bg-white/55 py-3 pl-11 pr-3.5 text-[14px] font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a3fa4] focus:bg-white/80 focus:ring-2 focus:ring-[#1D68E3]/20 disabled:opacity-60';

export const authPrimaryBtnClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white shadow-[0_12px_32px_-12px_rgba(42,63,164,0.45)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60';

export const authLabelClass = 'mb-1.5 block text-left text-[12px] font-medium text-slate-500';

export const authMutedLinkClass =
  'text-[12px] font-medium text-[#2a3fa4] transition hover:text-[#1d2f82] hover:underline';

export const authFooterTextClass = 'mt-7 text-center text-[13px] font-normal text-slate-500';

export const authIconClass =
  'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';

export const authErrorBoxClass =
  'rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-[13px] font-normal text-rose-700';

export const authInfoBoxClass =
  'rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-[13px] font-normal text-sky-800';

export const authSuccessBoxClass =
  'rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-[13px] font-normal text-emerald-800';

export { BRAND, BRAND_GRADIENT, PROJECT_NAME };
