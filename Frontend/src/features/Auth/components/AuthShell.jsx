import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';

/** Brand deep-blue auth backdrop (login / forgot / reset) */
const AUTH_PAGE_BG =
  'radial-gradient(ellipse 90% 70% at 50% 40%, #2a3fa4 0%, #1d2f82 42%, #0f1a3d 78%, #0a1028 100%)';

/**
 * Centered frosted auth card on Project Verify deep-blue backdrop.
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
      className="fixed inset-0 flex min-h-[100dvh] flex-col overflow-y-auto font-sans antialiased"
      style={{ background: AUTH_PAGE_BG }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-[#1D68E3]/30 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#2a3fa4]/35 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[#4a66c4]/20 blur-3xl" />
      </div>

      <header className="relative z-10 flex shrink-0 items-center px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex">
          <ProjectVerifyLogo onDark size="lg" tagline="" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div
          className="w-full max-w-[440px] rounded-[1.75rem] border border-white/15 px-6 py-8 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.55)] sm:px-9 sm:py-10"
          style={{
            background: 'rgba(15, 26, 61, 0.42)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className="mb-7 text-center">
            {showLockIcon ? (
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </div>
            ) : null}
            {title ? (
              <h1 className="text-[1.75rem] font-semibold leading-[1.2] tracking-tight text-white">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mx-auto mt-2 max-w-[320px] text-[14px] font-normal leading-[1.5] text-white/65">
                {subtitle}
              </p>
            ) : null}
          </div>

          {children}
          {footer}
        </div>
      </main>

      <footer className="relative z-10 shrink-0 px-4 pb-5 pt-2 text-center text-[11px] font-normal text-white/40">
        © {new Date().getFullYear()} {PROJECT_NAME}. All rights reserved.
      </footer>
    </div>
  );
}

/** Dark glass field styles for the auth card */
export const authFieldClass =
  'w-full rounded-xl border border-white/15 bg-[#0c1635]/45 py-3 pl-11 pr-3.5 text-[14px] font-normal text-white outline-none transition placeholder:text-white/35 focus:border-[#6b84d4] focus:ring-2 focus:ring-[#1D68E3]/30 disabled:opacity-60';

export const authPrimaryBtnClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white shadow-[0_12px_32px_-12px_rgba(29,104,227,0.65)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60';

export const authLabelClass = 'mb-1.5 block text-left text-[12px] font-medium text-white/60';

export const authMutedLinkClass =
  'text-[12px] font-medium text-[#8ea4f0] transition hover:text-white hover:underline';

export const authFooterTextClass = 'mt-7 text-center text-[13px] font-normal text-white/50';

export const authIconClass =
  'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40';

export const authErrorBoxClass =
  'rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2.5 text-[13px] font-normal text-rose-100';

export const authInfoBoxClass =
  'rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-2.5 text-[13px] font-normal text-sky-100';

export const authSuccessBoxClass =
  'rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2.5 text-[13px] font-normal text-emerald-100';

export { BRAND, BRAND_GRADIENT, PROJECT_NAME };
