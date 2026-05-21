import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getStoredCmsThemeMode,
  resolveCmsTheme,
  setStoredCmsThemeMode,
} from '../lib/cmsTheme';

const CmsThemeContext = createContext(null);

export function CmsThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');
  const [resolved, setResolved] = useState('light');

  useEffect(() => {
    setModeState(getStoredCmsThemeMode());
  }, []);

  useEffect(() => {
    setResolved(resolveCmsTheme(mode));
    if (mode !== 'system' || typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(resolveCmsTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  /** Tokens e `body` usam variáveis do tema — atributo no `<html>` (o chrome fica dentro do body). */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.setAttribute('data-luditeca-theme', resolved);
    return () => document.documentElement.removeAttribute('data-luditeca-theme');
  }, [resolved]);

  const setMode = useCallback((next) => {
    setModeState(next);
    setStoredCmsThemeMode(next);
    setResolved(resolveCmsTheme(next));
  }, []);

  const toggleResolved = useCallback(() => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [resolved, setMode]);

  const value = useMemo(
    () => ({ mode, resolved, setMode, toggleResolved }),
    [mode, resolved, setMode, toggleResolved],
  );

  return <CmsThemeContext.Provider value={value}>{children}</CmsThemeContext.Provider>;
}

export function useCmsTheme() {
  const ctx = useContext(CmsThemeContext);
  if (!ctx) {
    throw new Error('useCmsTheme deve ser usado dentro de CmsThemeProvider');
  }
  return ctx;
}
