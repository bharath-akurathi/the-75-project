/**
 * The 75 Project — Theme System
 *
 * Both light and dark mode are first-class, not an afterthought (SRS Section 5).
 * Red is reserved exclusively for genuine threshold danger (FR-3.6).
 */

export const Colors = {
  light: {
    // Core
    background: '#FAFAF9',
    surface: '#FFFFFF',
    surfaceElevated: '#F5F5F4',
    border: '#E7E5E4',
    borderSubtle: '#F5F5F4',

    // Text
    text: '#1C1917',
    textSecondary: '#78716C',
    textTertiary: '#A8A29E',
    textInverse: '#FAFAF9',

    // Brand — from the logo gradient
    primary: '#E11D48',
    primaryLight: '#FEE2E2',
    accent: '#F59E0B',
    accentLight: '#FEF3C7',

    // Status — red reserved for genuine risk only (FR-3.6)
    safe: '#16A34A',
    safeLight: '#DCFCE7',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    danger: '#E11D48',
    dangerLight: '#FEE2E2',
    critical: '#991B1B',
    criticalLight: '#FEE2E2',

    // Attendance states
    present: '#16A34A',
    presentBg: '#DCFCE7',
    absent: '#78716C',       // Neutral/muted — NOT alarm red (FR-3.6)
    absentBg: '#F5F5F4',

    // Interactive
    tint: '#E11D48',
    tabIconDefault: '#A8A29E',
    tabIconSelected: '#E11D48',
  },
  dark: {
    // Core
    background: '#0C0A09',
    surface: '#1C1917',
    surfaceElevated: '#292524',
    border: '#44403C',
    borderSubtle: '#292524',

    // Text
    text: '#FAFAF9',
    textSecondary: '#A8A29E',
    textTertiary: '#78716C',
    textInverse: '#1C1917',

    // Brand
    primary: '#FB7185',
    primaryLight: '#4C1D2E',
    accent: '#FBBF24',
    accentLight: '#451A03',

    // Status
    safe: '#4ADE80',
    safeLight: '#14532D',
    warning: '#FBBF24',
    warningLight: '#451A03',
    danger: '#FB7185',
    dangerLight: '#4C1D2E',
    critical: '#FCA5A5',
    criticalLight: '#7F1D1D',

    // Attendance states
    present: '#4ADE80',
    presentBg: '#14532D',
    absent: '#A8A29E',
    absentBg: '#292524',

    // Interactive
    tint: '#FB7185',
    tabIconDefault: '#78716C',
    tabIconSelected: '#FB7185',
  },
};

export const Typography = {
  hero: {
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  metric: {
    fontSize: 64,
    fontWeight: '800' as const,
    letterSpacing: -2,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};
