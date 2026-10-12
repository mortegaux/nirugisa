import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme: Theme) {
  const effective = getEffectiveTheme(theme);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

export const useThemeStore = create<ThemeState>((set) => {
  const stored = (localStorage.getItem('nommable-theme') as Theme) || 'system';
  applyTheme(stored);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = (localStorage.getItem('nommable-theme') as Theme) || 'system';
    if (current === 'system') applyTheme('system');
  });

  return {
    theme: stored,
    setTheme: (theme: Theme) => {
      localStorage.setItem('nommable-theme', theme);
      applyTheme(theme);
      set({ theme });
    },
  };
});
