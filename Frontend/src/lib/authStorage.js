/** Auth token / remember-me helpers (localStorage vs sessionStorage). */

export const AUTH_TOKEN_KEY = 'token';
export const REMEMBER_IDENTIFIER_KEY = 'projectverify_login_identifier';
export const REMEMBER_FLAG_KEY = 'projectverify_remember_me';

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY) || null;
}

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Persist JWT. Remember me → localStorage (survives browser restart).
 * Otherwise → sessionStorage (cleared when the tab/window closes).
 */
export function setStoredAuthToken(token, rememberMe = true) {
  clearStoredAuthToken();
  if (!token) return;
  if (rememberMe) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_FLAG_KEY, '1');
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_FLAG_KEY, '0');
  }
}

export function getRememberMePreference() {
  const flag = localStorage.getItem(REMEMBER_FLAG_KEY);
  if (flag === '0') return false;
  if (flag === '1') return true;
  return Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
}

export function saveRememberedIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (!value) {
    localStorage.removeItem(REMEMBER_IDENTIFIER_KEY);
    return;
  }
  localStorage.setItem(REMEMBER_IDENTIFIER_KEY, value);
}

export function clearRememberedIdentifier() {
  localStorage.removeItem(REMEMBER_IDENTIFIER_KEY);
}

export function getRememberedIdentifier() {
  return localStorage.getItem(REMEMBER_IDENTIFIER_KEY) || '';
}
