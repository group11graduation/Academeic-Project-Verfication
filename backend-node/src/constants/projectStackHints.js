/** Values students can pick when uploading a project ZIP (preview / audit hints). */
export const PROJECT_STACK_HINT_VALUES = [
  'static-html',
  'static-html-js',
  'node-js',
  'java-spring-react',
  'php-apache',
];

export function normalizeProjectStackHint(value) {
  const hint = String(value || '').trim();
  if (!hint) return '';
  return PROJECT_STACK_HINT_VALUES.includes(hint) ? hint : '';
}

export function isProjectStackHint(value) {
  const hint = String(value || '').trim();
  return hint !== '' && PROJECT_STACK_HINT_VALUES.includes(hint);
}
