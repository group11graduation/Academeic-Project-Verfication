/** Project Verify brand palette — resolves from CSS theme variables */
export const PROJECT_NAME = 'Project Verify';
export const PROJECT_LEGAL_NAME = 'Project Verify Academic Systems';
export const PRODUCT_TAGLINE = 'Project verification';
export const BRAND = {
    primary: 'var(--brand-primary)',
    primaryHover: 'var(--brand-primary-hover)',
    primaryDeep: 'var(--shell-border)',
    action: 'var(--accent)',
    actionHover: 'var(--sv-primary-hover)',
    shell: 'var(--accent)',
    pageBg: 'var(--bg-page)',
    cardBg: 'var(--bg-card)',
    mutedText: 'var(--text-secondary)',
    darkText: 'var(--text-primary)',
    /** Faculty / student console rail */
    railFrom: 'var(--brand-primary)',
    railTo: 'var(--brand-primary-hover)',
    contentBg: 'var(--content-bg)',
    panelBg: 'var(--bg-elevated)',
};

export const BRAND_GRADIENT = 'linear-gradient(135deg, var(--brand-primary) 0%, var(--accent) 100%)';
export const RAIL_GRADIENT = 'var(--sidebar-surface)';

/** Short product descriptor shown in faculty/student console sidebars */
export const PRODUCT_TAGLINE_SIDEBAR = 'Project verification & preview';

/** Teacher dashboard sidebar card - functional label (not marketing brand) */
export const FACULTY_SIDEBAR_TITLE = PROJECT_NAME;
export const FACULTY_SIDEBAR_SUBTITLE = 'Review & preview student work';
