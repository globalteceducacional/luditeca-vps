/** Preferência de tema do painel CMS (não afecta `/app`). */
export const CMS_THEME_STORAGE_KEY = 'luditeca-cms-theme';

/** @typedef {'light' | 'dark' | 'system'} CmsThemeMode */
/** @typedef {'light' | 'dark'} CmsThemeResolved */

/** @returns {CmsThemeMode} */
export function getStoredCmsThemeMode() {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(CMS_THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* ignore */
  }
  return 'system';
}

/** @param {CmsThemeMode} mode */
export function setStoredCmsThemeMode(mode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CMS_THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** @param {CmsThemeMode} mode */
export function resolveCmsTheme(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export const CMS_THEME_MODE_LABELS = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Sistema',
};
