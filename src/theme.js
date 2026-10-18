export const THEME_KEY = 'wikimapia-reader-theme';
export const THEME_OPTIONS = ['dark', 'light', 'system'];
export function readTheme(storage) {
  try {
    const value = (storage ?? globalThis.localStorage)?.getItem(THEME_KEY);
    return THEME_OPTIONS.includes(value) ? value : 'dark';
  } catch { return 'dark'; }
}
export function resolveTheme(preference, systemDark) {
  if (preference === 'light') return 'light';
  return preference === 'system' && !systemDark ? 'light' : 'dark';
}
