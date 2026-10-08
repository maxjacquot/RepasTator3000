// ============================================================
// theme.ts — Design System RepasTator 3000
// ============================================================

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

// ─── Polices ──────────────────────────────────────────────────
export const fonts = {
  display: 'PlayfairDisplay_700Bold',
} as const;

// ─── Couleurs ────────────────────────────────────────────────
export const colors = {
  primary: '#C74B2B',       // Terracotta — CTA, boutons
  dark: '#1A1208',          // Espresso brun — header, titres
  background: '#FAF6F0',    // Crème chaude — fond général
  surface: '#FFFFFF',       // Blanc pur — cartes
  success: '#4A7C59',       // Vert forêt — badges, étapes
  textPrimary: '#1A1208',
  textSecondary: '#9A7E6E', // Taupe chaud
  border: '#EDE5D8',
  primaryLight: '#FAEEE9',  // Terracotta très clair — fond emoji
  successLight: '#EBF3EE',  // Vert très clair — fond emoji alternatif
} as const;

// ─── Typographie ─────────────────────────────────────────────
export const typography = {
  fontSizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
  lineHeights: {
    tight: 18,
    normal: 22,
    relaxed: 26,
  },
} as const;

// ─── Espacements (échelle 4px) ────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

// ─── Border Radius ────────────────────────────────────────────
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
} as const;

// ─── Ombres ───────────────────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: '#1A1208',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1208',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  primary: {
    shadowColor: '#C74B2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;

// ─── Composant : Badge ────────────────────────────────────────
interface BadgeProps {
  label: string;
  color?: string;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color = colors.success,
  style,
}) => (
  <View
    style={[
      badgeStyles.container,
      { backgroundColor: color + '22' },
      style,
    ]}
  >
    <Text style={[badgeStyles.text, { color }]}>{label}</Text>
  </View>
);

const badgeStyles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  text: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
    letterSpacing: 0.2,
  },
});
