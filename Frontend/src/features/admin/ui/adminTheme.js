/** Admin console theme — values resolve from CSS variables (light/dark). */
export const ADMIN = {
    primary: 'var(--brand-primary)',
    primaryHover: 'var(--brand-primary-hover)',
    primaryDeep: 'var(--shell-border)',
    primaryDark: 'var(--shell-border)',
    soft: 'var(--bg-elevated)',
    softBorder: 'var(--border)',
    contentBg: 'var(--content-bg)',
    frameBg: 'var(--frame-bg)',
    mutedText: 'var(--text-secondary)',
};

export const ADMIN_GRADIENT = 'linear-gradient(135deg, var(--brand-primary) 0%, var(--accent) 100%)';
/** Light: indigo wash; dark: elevated surface via --sidebar-surface */
export const ADMIN_SIDEBAR_GRADIENT = 'var(--sidebar-surface)';
export const ADMIN_MOBILE_GRADIENT = ADMIN_SIDEBAR_GRADIENT;
export const ADMIN_AVATAR_GRADIENT = 'linear-gradient(145deg, var(--accent) 0%, var(--brand-primary) 100%)';
