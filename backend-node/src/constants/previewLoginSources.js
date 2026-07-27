/**
 * Single source of truth for previewLoginSource values.
 * Keep mongoose enum + teacher UI allowlists in sync via this module.
 */
export const PREVIEW_LOGIN_SOURCES = Object.freeze([
  '',
  'platform_default',
  'teacher_provided',
  'project_files',
  'project_php_setup',
  'project_spring_seed',
  'project_seed_fallback',
  'project_seed_script',
  'preview_seed_admin',
  'bootstrap_log',
  'bootstrap_log_assumed_username',
]);

export const PROJECT_PREVIEW_LOGIN_SOURCES = Object.freeze(
  PREVIEW_LOGIN_SOURCES.filter(
    (s) => s && s !== 'platform_default' && s !== 'teacher_provided'
  )
);

export function isProjectLoginSource(source) {
  return PROJECT_PREVIEW_LOGIN_SOURCES.includes(String(source || ''));
}

export function isKnownLoginSource(source) {
  return PREVIEW_LOGIN_SOURCES.includes(String(source || ''));
}
