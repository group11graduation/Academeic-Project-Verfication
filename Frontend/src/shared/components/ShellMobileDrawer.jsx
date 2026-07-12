import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Search, X } from 'lucide-react';
import { useShellSearch } from '../../context/shellSearchContext';

/**
 * Full-height slide-out navigation for admin/teacher shells on phones & tablets.
 */
export default function ShellMobileDrawer({ open, onClose, navSections = [], onLogout, panelTitle = 'Menu' }) {
    const { query: shellSearchQuery, setQuery: setShellSearchQuery, placeholder: shellSearchPlaceholder } =
        useShellSearch();

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
                className="absolute inset-0 bg-[#0f1a3d]/55 backdrop-blur-[2px]"
                onClick={onClose}
                aria-label="Close menu"
            />
            <aside
                className="absolute inset-y-0 left-0 flex w-[min(100vw-2.5rem,22rem)] max-w-full flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-[#2a3fa4] to-[#223688] text-white shadow-2xl safe-area-px"
                style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <div className="flex items-center justify-between gap-2 border-b border-white/15 px-4 py-3">
                    <p className="text-sm font-black tracking-tight">{panelTitle}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"
                        aria-label="Close navigation"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="border-b border-white/10 px-4 py-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                        <input
                            type="search"
                            value={shellSearchQuery}
                            onChange={(e) => setShellSearchQuery(e.target.value)}
                            placeholder={shellSearchPlaceholder}
                            aria-label={shellSearchPlaceholder}
                            className="w-full rounded-xl border border-white/20 bg-white/10 py-2.5 pl-10 pr-3 text-sm font-medium text-white placeholder:text-white/45 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
                        />
                    </div>
                </div>

                <nav className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Mobile navigation">
                    {navSections.map((section) => (
                        <div key={section.key}>
                            <p className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
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
                                                `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                                                    isActive ? 'bg-white text-[#1d2f82]' : 'text-white/90 hover:bg-white/12'
                                                }`
                                            }
                                        >
                                            {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} /> : null}
                                            <span className="truncate">{item.name}</span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {onLogout ? (
                    <div className="border-t border-white/15 p-3">
                        <button
                            type="button"
                            onClick={() => {
                                onClose?.();
                                onLogout();
                            }}
                            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-rose-200 ring-1 ring-white/15 hover:bg-white/15"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </button>
                    </div>
                ) : null}
            </aside>
        </div>
    );
}
