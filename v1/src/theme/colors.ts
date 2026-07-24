/**
 * The 75 Project — Color Palette
 * Derived from logo.svg gradient: #E11D48 (Rose) → #F59E0B (Amber)
 * Dark stone: #1C1917
 */

export const Colors = {
  // === Brand (from logo.svg) ===
  rose: '#E11D48',
  roseLight: '#FB7185',
  roseDark: '#BE123C',
  amber: '#F59E0B',
  amberLight: '#FCD34D',
  amberDark: '#D97706',
  stone: '#1C1917',

  // === Primary Accent (electric teal — complementary to rose/amber) ===
  accent: '#14B8A6',
  accentLight: '#5EEAD4',
  accentDark: '#0D9488',

  // === Semantic (red reserved for severe warnings only — SRS §6) ===
  success: '#22C55E',
  successBg: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',

  // === Dark Theme (primary) ===
  dark: {
    bg: '#0C0A09',
    bgElevated: '#1C1917',
    bgCard: '#292524',
    bgCardHover: '#44403C',
    border: '#44403C',
    borderLight: '#292524',
    text: '#FAFAF9',
    textSecondary: '#A8A29E',
    textMuted: '#78716C',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },

  // === Light Theme (future-proofing) ===
  light: {
    bg: '#FAFAF9',
    bgElevated: '#F5F5F4',
    bgCard: '#FFFFFF',
    bgCardHover: '#F5F5F4',
    border: '#E7E5E4',
    borderLight: '#F5F5F4',
    text: '#1C1917',
    textSecondary: '#57534E',
    textMuted: '#A8A29E',
    overlay: 'rgba(0, 0, 0, 0.3)',
  },

  // === Status card backgrounds ===
  present: {
    bg: 'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.3)',
    text: '#4ADE80',
  },
  absent: {
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.3)',
    text: '#F87171',
  },
  cancelled: {
    bg: 'rgba(168, 162, 158, 0.08)',
    border: 'rgba(168, 162, 158, 0.3)',
    text: '#A8A29E',
  },
} as const;

export type ColorTheme = typeof Colors.dark;
