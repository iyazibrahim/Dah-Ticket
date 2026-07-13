const TOKEN_KEY = 'digidesk_token';
const USER_KEY = 'digidesk_user';
const PWA_DISMISS_KEY = 'digidesk_pwa_install_dismissed';

const LEGACY_TOKEN_KEY = 'dahticket_token';
const LEGACY_USER_KEY = 'dahticket_user';
const LEGACY_PWA_DISMISS_KEY = 'dahticket_pwa_install_dismissed';

function migrateLegacyKey(newKey: string, legacyKey: string) {
  const current = localStorage.getItem(newKey);
  const legacy = localStorage.getItem(legacyKey);
  if (!current && legacy) {
    localStorage.setItem(newKey, legacy);
    localStorage.removeItem(legacyKey);
  }
}

export function migrateLegacyStorage() {
  migrateLegacyKey(TOKEN_KEY, LEGACY_TOKEN_KEY);
  migrateLegacyKey(USER_KEY, LEGACY_USER_KEY);
  migrateLegacyKey(PWA_DISMISS_KEY, LEGACY_PWA_DISMISS_KEY);
}

export function getAuthToken(): string | null {
  migrateLegacyStorage();
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getAuthUserRaw(): string | null {
  migrateLegacyStorage();
  return localStorage.getItem(USER_KEY);
}

export function setAuthUserRaw(value: string) {
  localStorage.setItem(USER_KEY, value);
  localStorage.removeItem(LEGACY_USER_KEY);
}

export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
}

export function getPwaDismissKey() {
  migrateLegacyStorage();
  return PWA_DISMISS_KEY;
}
