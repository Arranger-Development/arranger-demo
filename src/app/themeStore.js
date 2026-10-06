export const THEME_STORAGE_KEY = 'arranger.ui.theme';
export const THEME_IDS = Object.freeze(['hardware', 'swiss']);

const normalizeTheme = (theme) => THEME_IDS.includes(theme) ? theme : 'hardware';

// Kept outside music state: a theme change only notifies the switch buttons.
export function createThemeStore({ storage = null, root = null } = {}) {
  let theme = 'hardware';
  try { theme = normalizeTheme(storage?.getItem(THEME_STORAGE_KEY)); } catch { /* Session-only preference. */ }
  const listeners = new Set();
  root?.setAttribute('data-theme', theme);

  return {
    getTheme: () => theme,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setTheme(nextTheme) {
      const next = normalizeTheme(nextTheme);
      if (next === theme) return;
      theme = next;
      root?.setAttribute('data-theme', theme);
      try { storage?.setItem(THEME_STORAGE_KEY, theme); } catch { /* Switching still works without storage. */ }
      listeners.forEach((listener) => listener());
    },
  };
}

let store;

export function initializeTheme() {
  if (!store) {
    let storage = null;
    try { storage = window.localStorage; } catch { /* Browser privacy settings may block storage. */ }
    store = createThemeStore({ storage, root: document.documentElement });
  }
  return store;
}

export const getTheme = () => initializeTheme().getTheme();
export const setTheme = (theme) => initializeTheme().setTheme(theme);
export const subscribeTheme = (listener) => initializeTheme().subscribe(listener);
