import {useEffect, useLayoutEffect, useState} from 'react';
import {Capacitor, registerPlugin} from '@capacitor/core';
import {THEME_KEY, readTheme, resolveTheme} from './theme.js';

const Appearance = registerPlugin('Appearance');
export function useTheme() {
  const [preference, setPreference] = useState(readTheme);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = resolveTheme(preference, systemDark);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#000000' : '#ffffff');
  }, [resolved]);
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, preference); } catch { /* Private mode: theme still works for this session. */ }
  }, [preference]);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Appearance.apply({theme: resolved}).catch(() => { /* Web theme remains usable if the native bridge is unavailable. */ });
    }
  }, [resolved]);
  return [preference, setPreference];
}
