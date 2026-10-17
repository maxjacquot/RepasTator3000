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
  // Style commun de mjacquot.fr : neutres du thème Sandstone (Bootswatch), couleur de l'appli gardée.
  // Même palette que https://mjacquot.fr/charte.css (voir portail/docs/decisions.md P06).
  primary: '#C74B2B',       // Terracotta — CTA, boutons (couleur de l'appli)
  dark: '#3E3F3A',          // Sandstone « dark » — header, titres
  background: '#F8F5F0',    // Sandstone « light » — fond général
  surface: '#FFFFFF',       // Blanc pur — cartes
  success: '#4A7C59',       // Vert forêt — badges, étapes
  textPrimary: '#3E3F3A',
  textSecondary: '#6E6F6B', // Gris chaud (texte secondaire Sandstone)
  border: '#DFD7CA',        // Sandstone gray-300
  primaryLight: '#FAEEE9',  // Terracotta très clair — fond emoji
  successLight: '#EBF3EE',  // Vert très clair — fond emoji alternatif
  danger: '#D9534F',        // Sandstone « danger » — supprimer, erreurs
  dangerLight: '#FBEAEA',   // fond des boutons « Supprimer »
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
  // Coins peu arrondis, comme Sandstone (0,375 rem = 6 px)
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  full: 999,
} as const;

// ─── Ombres ───────────────────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: '#3E3F3A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#3E3F3A',
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
    borderRadius: radii.sm,
  },
  text: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semiBold,
    letterSpacing: 0.2,
  },
});
