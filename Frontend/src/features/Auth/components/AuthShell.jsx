import React, { useEffect } from 'react';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';

/**
 * Fixed viewport light auth shell — soft white/blue wash + frosted card.
 */
export default function AuthShell({
  title = 'Sign in',
  subtitle,
  children,
  footer,
  showLogo = true,
}) {
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div className="fixed inset-0 flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#f0f1f3] font-sans text-[var(--sv-text)] antialiased">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
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

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-2 sm:px-6">
        <div
          className="w-full max-w-[420px] rounded-[1.5rem] border border-white/70 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-8 sm:py-7"
          style={{
            background: 'rgba(255, 255, 255, 0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="mb-5 text-center">
            {showLogo ? (
              <div className="mb-3 flex justify-center">
                <ProjectVerifyLogo
                  size="lg"
                  showText={false}
                  plainMark
                  className="justify-center"
                />
              </div>
            ) : null}
            {title ? (
              <h1 className="text-[1.5rem] font-semibold leading-[1.2] tracking-tight text-slate-950 sm:text-[1.65rem]">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] font-normal leading-[1.45] text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          {children}
          {footer}
        </div>
      </main>

      <footer className="relative z-10 shrink-0 px-4 pb-3 pt-1 text-center text-[11px] font-normal text-slate-400">
        © {new Date().getFullYear()} {PROJECT_NAME}. All rights reserved.
      </footer>
    </div>
  );
}

/** Light glass field styles for the auth card */
export const authFieldClass =
  'w-full rounded-xl border border-[#dbe3f5] bg-white/70 py-2.5 pl-11 pr-3.5 text-[14px] font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a3fa4] focus:bg-white focus:ring-2 focus:ring-[#1D68E3]/20 disabled:opacity-60';

export const authPrimaryBtnClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-semibold text-white shadow-[0_12px_32px_-12px_rgba(42,63,164,0.45)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60';

export const authLabelClass = 'mb-1.5 block text-left text-[12px] font-medium text-slate-500';

export const authMutedLinkClass =
  'text-[12px] font-medium text-[#2a3fa4] transition hover:text-[#1d2f82] hover:underline';

export const authFooterTextClass = 'mt-5 text-center text-[13px] font-normal text-slate-500';

export const authIconClass =
  'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';

export const authErrorBoxClass =
  'rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-[13px] font-normal text-rose-700';

export const authInfoBoxClass =
  'rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-[13px] font-normal text-sky-800';

export const authSuccessBoxClass =
  'rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-[13px] font-normal text-emerald-800';

export { BRAND, BRAND_GRADIENT, PROJECT_NAME };
