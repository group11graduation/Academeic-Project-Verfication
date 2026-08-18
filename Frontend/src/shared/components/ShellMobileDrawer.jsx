import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, User, X } from 'lucide-react';
import ProjectVerifyLogo from './ProjectVerifyLogo';

/**
 * Full-height slide-out navigation for admin/teacher shells on phones & tablets.
 */
export default function ShellMobileDrawer({
    open,
    onClose,
    navSections = [],
    onLogout,
    panelTitle = 'Menu',
    panelGradient,
    profile = null,
}) {
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={panelTitle}>
            <button
                type="button"
                className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg-page)_55%,transparent)] backdrop-blur-[2px]"
                onClick={onClose}
                aria-label="Close menu"
            />
            <aside
                className="absolute inset-y-0 left-0 flex w-[min(100vw-2.5rem,22rem)] max-w-full flex-col overflow-hidden border-r text-[var(--sidebar-fg)] shadow-2xl safe-area-px"
                style={{
                    background: panelGradient || 'var(--sidebar-surface)',
                    borderColor: 'var(--border)',
                    paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                <div
                    className="flex items-center justify-between gap-2 border-b px-4 py-3"
                    style={{ borderColor: 'color-mix(in srgb, var(--sidebar-fg) 15%, transparent)' }}
                >
                    <p className="text-sm font-semibold tracking-tight text-[var(--sidebar-fg)]">{panelTitle}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"
                        aria-label="Close navigation"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {profile?.to ? (
                    <NavLink
                        to={profile.to}
                        onClick={onClose}
                        className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3 ring-1 ring-white/15 transition hover:bg-white/15"
                    >
                        {profile.showLogo ? (
                            <ProjectVerifyLogo size="md" showText={false} plainMark onDark className="shrink-0" />
                        ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-semibold text-[var(--sidebar-fg)]">
                                {profile.initial || 'A'}
                            </div>
                        )}
                        <div className="min-w-0 text-left">
                            <p className="truncate text-sm font-semibold text-[var(--sidebar-fg)]">{profile.name || 'Profile'}</p>
                            {profile.email ? (
                                <p className="truncate text-[11px] font-normal text-[var(--sidebar-fg-muted)]">{profile.email}</p>
                            ) : (
                                <p className="truncate text-[11px] font-normal text-[var(--sidebar-fg-muted)]">View profile</p>
                            )}
                        </div>
                    </NavLink>
                ) : null}

                <nav className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Mobile navigation">
                    {navSections.map((section) => (
                        <div key={section.key}>
                            <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.5px] text-[var(--sidebar-fg-muted)]">
                                {section.name}
                            </p>
                            <div className="space-y-1">
                                {(section.links || []).map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            end={Boolean(item.end)}
                                            onClick={onClose}
                                            className={({ isActive }) =>
                                                `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                                                    isActive
                                                        ? 'bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-text)]'
                                                        : 'font-normal text-[var(--sidebar-fg-soft)] hover:bg-white/12'
                                                }`
                                            }
                                        >
                                            {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" /> : null}
                                            <span className="truncate">{item.name}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {typeof onLogout === 'function' || profile?.to ? (
                    <div
                        className="space-y-2 border-t p-3"
                        style={{ borderColor: 'color-mix(in srgb, var(--sidebar-fg) 15%, transparent)' }}
                    >
                        {profile?.to ? (
                            <NavLink
                                to={profile.to}
                                onClick={onClose}
                                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--sidebar-fg)] transition hover:bg-white/12"
                            >
                                <User className="h-4 w-4 shrink-0 opacity-80" />
                                <span className="min-w-0 truncate">{profile.name || 'My profile'}</span>
                            </NavLink>
                        ) : null}
                        {typeof onLogout === 'function' ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onLogout();
                                }}
                                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-sm font-bold text-[var(--sidebar-fg)] ring-1 ring-white/20"
                            >
                                <LogOut className="h-4 w-4" />
                                Log out
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </aside>
        </div>
    );
}
