import React from 'react';
import { BRAND, PROJECT_NAME } from '../../../shared/ui/brandTheme';
import ProjectVerifyLogo from '../../../shared/components/ProjectVerifyLogo';

/** Shared login / forgot / reset shell (background + frosted card). */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/login-background.png)' }}
        aria-hidden
      />
      <div className="fixed inset-0 bg-[#1d2f82]/75" aria-hidden />
      <div className="fixed inset-0 bg-gradient-to-br from-[#2a3fa4]/50 via-transparent to-[#0f172a]/80" aria-hidden />

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="auth-page-card" style={{ WebkitBackdropFilter: 'blur(20px)' }}>
          <div className="mb-4 flex flex-col items-center text-center">
            <ProjectVerifyLogo onDark size="lg" showText={false} className="mb-3 justify-center" />
            {title ? (
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-[1.375rem]">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="mt-1.5 max-w-[320px] text-xs font-medium leading-snug text-white/70 sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

export { BRAND, PROJECT_NAME };
