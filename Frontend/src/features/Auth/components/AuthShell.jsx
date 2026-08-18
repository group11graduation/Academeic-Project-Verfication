import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND, BRAND_GRADIENT, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';

/**
 * Split auth layout: form on the left (white), brand panel on the right.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  rightTitle = `Welcome to ${PROJECT_NAME}`,
  rightSubtitle = 'Sign in to manage academic projects, reviews, and verification workflows.',
}) {
  return (
    <div className="fixed inset-0 flex min-h-[100dvh] overflow-hidden bg-white font-sans">
      {/* Left — form */}
      <div className="relative flex w-full flex-col overflow-y-auto px-6 py-8 sm:px-10 lg:w-[48%] lg:px-14 xl:px-20">
        <div className="mb-10 shrink-0 lg:mb-14">
          <Link to="/" className="inline-flex">
            <ProjectVerifyLogo size="md" tagline="" />
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center pb-10">
          {title ? (
            <h1 className="text-[1.75rem] font-semibold leading-[1.2] tracking-tight text-[#0F172A] sm:text-[2rem]">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mt-2 text-[14px] font-normal leading-[1.5] text-[#51628f]">{subtitle}</p>
          ) : null}

          <div className={title || subtitle ? 'mt-8' : ''}>{children}</div>
          {footer}
        </div>
      </div>

      {/* Right — brand panel */}
      <div className="relative hidden min-h-full p-3 lg:flex lg:w-[52%]">
        <div
          className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-l-[2.75rem] rounded-r-[1.25rem] px-10 py-12 text-white xl:px-14"
          style={{ background: BRAND_GRADIENT }}
        >
          {/* Soft decorative blocks (CSS-only, no purple) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div
              className="absolute -right-16 top-16 h-40 w-56 rotate-[-18deg] rounded-2xl opacity-30"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.35), rgba(255,255,255,0.05))' }}
            />
            <div
              className="absolute bottom-24 right-10 h-48 w-64 rotate-[12deg] rounded-2xl opacity-25"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.28), rgba(29,47,130,0.35))' }}
            />
            <div
              className="absolute bottom-40 right-28 h-28 w-40 rotate-[-8deg] rounded-xl shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ea580c 100%)',
                opacity: 0.95,
              }}
            />
            <div
              className="absolute left-10 top-1/3 h-24 w-36 rotate-[22deg] rounded-xl opacity-20"
              style={{ background: 'rgba(255,255,255,0.4)' }}
            />
          </div>

          <div className="relative z-10 max-w-md">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-white/70">Institution access</p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-[1.2] tracking-tight xl:text-[2.25rem]">
              {rightTitle}
            </h2>
            <p className="mt-3 text-[15px] font-normal leading-[1.5] text-white/80">{rightSubtitle}</p>
          </div>

          <div className="relative z-10">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
              <p className="text-[13px] font-semibold text-white">Secure academic workspace</p>
              <p className="mt-1.5 text-[12px] font-normal leading-[1.5] text-white/75">
                Students, teachers, and admins sign in with institution credentials managed by your administrator.
              </p>
            </div>
            <p className="mt-6 text-[11px] font-normal text-white/55">© {new Date().getFullYear()} {PROJECT_NAME}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Light-theme field styles for the split auth form */
export const authFieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] font-normal text-[#0F172A] outline-none transition placeholder:text-slate-400 focus:border-[#2a3fa4] focus:ring-2 focus:ring-[#2a3fa4]/15 disabled:opacity-60';

export const authPrimaryBtnClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[14px] font-semibold text-white transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60';

export { BRAND, BRAND_GRADIENT, PROJECT_NAME };
