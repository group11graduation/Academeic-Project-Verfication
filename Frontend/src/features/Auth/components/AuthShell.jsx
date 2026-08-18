import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';

/**
 * Centered auth card on a branded dark backdrop (login / forgot / reset).
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
      className="fixed inset-0 flex min-h-[100dvh] flex-col overflow-y-auto font-sans"
      style={{
        background: 'linear-gradient(160deg, #0f1a3d 0%, #1d2f82 42%, #2a3fa4 72%, #1a2758 100%)',
      }}
    >
      {/* Soft ambient shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-[#1D68E3]/20 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-[#4a66c4]/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35) 0, transparent 42%), radial-gradient(circle at 80% 70%, rgba(29,104,227,0.5) 0, transparent 40%)',
          }}
        />
      </div>

      <header className="relative z-10 flex shrink-0 items-center px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex">
          <ProjectVerifyLogo onDark size="md" tagline="" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div
          className="w-full max-w-[440px] rounded-[1.75rem] border border-white/12 px-6 py-8 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.55)] sm:px-9 sm:py-10"
          style={{
            background: 'linear-gradient(165deg, rgba(15,26,61,0.82) 0%, rgba(29,47,130,0.72) 100%)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          <div className="mb-7 text-center">
            {showLockIcon ? (
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white">
                <Lock className="h-5 w-5" strokeWidth={2} />
              </div>
            ) : null}
            {title ? (
              <h1 className="text-[1.75rem] font-semibold leading-[1.2] tracking-tight text-white">{title}</h1>
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

/** Dark-theme field styles for the centered auth card */
export const authFieldClass =
  'w-full rounded-xl border border-white/15 bg-[#0c1635]/55 py-3 pl-11 pr-3.5 text-[14px] font-normal text-white outline-none transition placeholder:text-white/35 focus:border-[#6b84d4] focus:ring-2 focus:ring-[#1D68E3]/25 disabled:opacity-60';

export const authPrimaryBtnClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white shadow-[0_12px_32px_-12px_rgba(29,104,227,0.65)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60';

export { BRAND, BRAND_GRADIENT, PROJECT_NAME };
