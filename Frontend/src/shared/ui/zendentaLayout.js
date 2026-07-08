/** Shared “Zendenta-style” shells for assignment / student dashboards (light UI). */

export const Z_PAGE = 'min-h-0 min-h-screen bg-[var(--sv-page-bg)] text-[var(--sv-text)] text-[13px]';
/** Inside StudentLayout sidebar shell — no full-page bg or extra padding. */
export const Z_SHELL = 'flex min-h-0 flex-1 flex-col text-[var(--sv-text)] text-[13px]';
export const Z_SHELL_INNER = 'w-full flex-1';
export const Z_INNER = 'mx-auto w-full max-w-[1400px] px-3 py-4 md:px-5 md:py-5';
export const Z_CARD =
    'rounded-lg border border-[var(--sv-border)] bg-[var(--sv-card)] shadow-[0_1px_3px_rgba(15,23,42,0.06)]';
export const Z_CARD_HEADER = 'border-b border-[var(--sv-border)] px-3 py-2 md:px-4';
export const Z_BTN_PRIMARY =
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2a3fa4] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#223688] disabled:pointer-events-none disabled:opacity-50';
export const Z_BTN_SECONDARY =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-card)] px-3 py-1.5 text-[12px] font-bold text-[var(--sv-text)] shadow-sm transition hover:brightness-95';
export const Z_LINK = 'text-[#2a3fa4] font-semibold hover:underline text-[12px]';
export const Z_INPUT =
    'w-full rounded-lg border border-[var(--sv-border)] bg-[var(--sv-card)] px-2.5 py-2 text-[12px] font-medium text-[var(--sv-text)] outline-none transition focus:border-[#2a3fa4]/35 focus:ring-2 focus:ring-[#2a3fa4]/15';
export const Z_TEXTAREA = `${Z_INPUT} min-h-[72px] resize-y`;
export const Z_LABEL = 'block text-[10px] font-black uppercase tracking-wider text-[var(--sv-muted)] mb-1';
export const Z_FORM_CARD = 'rounded-xl border border-[var(--sv-border)] bg-[var(--sv-card)] p-4 shadow-sm';
export const Z_FORM_SECTION = 'rounded-lg border border-[var(--sv-border)] p-3 space-y-2';
export const Z_BTN_BACK = 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--sv-border)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--sv-text)] hover:brightness-95';
export const Z_BTN_SUBMIT = 'inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2a3fa4] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#223688] disabled:opacity-60';
export const Z_BTN_INDIGO = 'inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-indigo-700 disabled:opacity-60';
