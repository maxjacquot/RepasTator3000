import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, typography, spacing, radii, shadows } from './theme';

// ─── Types ────────────────────────────────────────────────────

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

// ─── Hook ─────────────────────────────────────────────────────

export function useAppAlert() {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
  }, []);

  const dismiss = useCallback(() => {
    setConfig(null);
  }, []);

  const buttons = config?.buttons ?? [{ text: 'OK' }];
  const isSingle = buttons.length === 1;

  const AlertComponent = config ? (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Icône selon le type du premier bouton */}
          <View style={s.iconRow}>
            {buttons.some((b) => b.style === 'destructive') ? (
              <View style={[s.iconBadge, s.iconBadgeRed]}>
                <Text style={s.iconText}>!</Text>
              </View>
            ) : buttons.length > 1 ? (
              <View style={[s.iconBadge, s.iconBadgeOrange]}>
                <Text style={s.iconText}>?</Text>
              </View>
            ) : (
              <View style={[s.iconBadge, s.iconBadgeGreen]}>
                <Text style={s.iconText}>✓</Text>
              </View>
            )}
          </View>

          {/* Contenu */}
          <Text style={s.title}>{config.title}</Text>
          {config.message ? (
            <Text style={s.message}>{config.message}</Text>
          ) : null}

          {/* Boutons */}
          <View style={s.divider} />
          <View style={[s.btnRow, isSingle && s.btnRowSingle]}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.btn,
                    isSingle && s.btnFull,
                    !isSingle && i === 0 && s.btnLeft,
                    !isSingle && i === buttons.length - 1 && s.btnRight,
                    isCancel && s.btnCancel,
                    isDestructive && s.btnDestructive,
                    !isCancel && !isDestructive && !isSingle && i === buttons.length - 1 && s.btnPrimary,
                    isSingle && s.btnPrimaryFull,
                  ]}
                  onPress={() => {
                    dismiss();
                    btn.onPress?.();
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.btnText,
                      isCancel && s.btnTextCancel,
                      isDestructive && s.btnTextDestructive,
                      !isCancel && !isDestructive && !isSingle && i === buttons.length - 1 && s.btnTextPrimary,
                      isSingle && s.btnTextPrimaryFull,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  ) : null;

  return { showAlert, AlertComponent };
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxxl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.md,
  },

  // Icône
  iconRow: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeGreen: {
    backgroundColor: '#E8F5E9',
  },
  iconBadgeOrange: {
    backgroundColor: colors.primaryLight,
  },
  iconBadgeRed: {
    backgroundColor: colors.dangerLight,
  },
  iconText: {
    fontSize: 22,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.textPrimary,
  },

  // Texte
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: typography.lineHeights.relaxed,
    marginBottom: spacing.xxl,
  },

  // Séparateur
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // Boutons
  btnRow: {
    flexDirection: 'row',
  },
  btnRowSingle: {
    padding: spacing.lg,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: {
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    ...shadows.primary,
  },
  btnPrimaryFull: {
    backgroundColor: colors.primary,
  },
  btnLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  btnRight: {},
  btnCancel: {
    backgroundColor: 'transparent',
  },
  btnPrimary: {
    backgroundColor: colors.primaryLight,
  },
  btnDestructive: {
    backgroundColor: colors.dangerLight,
  },
  btnText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textSecondary,
  },
  // Bouton confirm dans une rangée multi (fond primaryLight → texte orange)
  btnTextPrimary: {
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  // Bouton unique plein (fond primary → texte blanc)
  btnTextPrimaryFull: {
    color: colors.surface,
    fontWeight: typography.fontWeights.bold,
  },
  btnTextCancel: {
    color: colors.textSecondary,
  },
  btnTextDestructive: {
    color: colors.danger,
    fontWeight: typography.fontWeights.bold,
  },
});
