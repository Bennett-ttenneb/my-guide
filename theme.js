import { createContext, useContext } from 'react';

export const LIGHT = {
  dark: false, bg: '#fffaf2', text: '#3b2f22', muted: '#7c6f60', soft: '#f3e8d8', border: '#e7d8c3', card: '#ffffff',
  accent: '#c2410c', accentSoft: '#ffedd5', danger: '#b91c1c', onHighlight: '#3b2f22',
};

// Warm, low-glare night palette: no pure white text, dim surfaces.
export const DARK = {
  dark: true, bg: '#14110e', text: '#e6dccd', muted: '#a3957f', soft: '#262019', border: '#3a3128', card: '#1d1813',
  accent: '#f0894a', accentSoft: '#3a2414', danger: '#f87171', onHighlight: '#1c1917',
};

export const ThemeContext = createContext(LIGHT);
export const useTheme = () => useContext(ThemeContext);
