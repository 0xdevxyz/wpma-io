import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: true, // Default: dark mode

      toggle: () => {
        const next = !get().isDark;
        set({ isDark: next });
        applyTheme(next);
      },

      setDark: (dark: boolean) => {
        set({ isDark: dark });
        applyTheme(dark);
      },
    }),
    {
      name: 'wpma-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.isDark);
      },
    }
  )
);

function applyTheme(dark: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', dark);
}
