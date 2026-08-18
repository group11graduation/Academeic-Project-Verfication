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
    <div
      className="fixed inset-0 flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden font-sans text-[var(--sv-text)] antialiased"
      style={{
        background: 'linear-gradient(180deg, #e8eeff 0%, #f4f7ff 28%, #ffffff 72%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#c7d2fe]/55 blur-3xl" />
        <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-[#bfdbfe]/50 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#a5b4fc]/35 blur-3xl" />
      </div>

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-2 sm:px-6">
        <div
          className="w-full max-w-[420px] rounded-[1.5rem] border border-white/50 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:px-8 sm:py-7"
          style={{
            background: 'rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
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
  'w-full rounded-xl border border-[#dbe3f5]/80 bg-white/40 py-2.5 pl-11 pr-3.5 text-[14px] font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2a3fa4] focus:bg-white/70 focus:ring-2 focus:ring-[#1D68E3]/20 disabled:opacity-60';

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
