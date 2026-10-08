import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, typography, spacing, radii, shadows } from '../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>

        {/* Header terracotta avec courbe en bas */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.appName}>MAISONTATOR 3000</Text>
          <Text style={styles.question}>De quoi veux-tu{'\n'}t'occuper ?</Text>
          <View style={styles.headerAccentDot} />
        </View>

        {/* Cartes */}
        <View style={styles.cards}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/planning')}
            activeOpacity={0.82}
          >
            <View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
            <View style={[styles.cardIconBox, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.cardEmoji}>📅</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Planning de la semaine</Text>
              <Text style={styles.cardSub}>Repas, recettes et liste de courses</Text>
            </View>
            <Text style={[styles.chevron, { color: colors.primary }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/maison')}
            activeOpacity={0.82}
          >
            <View style={[styles.cardAccent, { backgroundColor: colors.house }]} />
            <View style={[styles.cardIconBox, { backgroundColor: colors.houseLight }]}>
              <Text style={styles.cardEmoji}>🏠</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.house }]}>Ma Maison</Text>
              <Text style={styles.cardSub}>Tâches et achats par pièce</Text>
            </View>
            <Text style={[styles.chevron, { color: colors.house }]}>›</Text>
          </TouchableOpacity>

        </View>

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl + spacing.xl,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    gap: spacing.sm,
  },
  appName: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: spacing.sm,
  },
  question: {
    fontSize: 36,
    fontFamily: fonts.display,
    color: colors.surface,
    lineHeight: 44,
  },
  headerAccentDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginTop: spacing.md,
  },
  cards: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    justifyContent: 'center',
    marginTop: -spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingVertical: spacing.xl,
    paddingRight: spacing.xl,
    paddingLeft: spacing.xl + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardEmoji: {
    fontSize: 24,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSizes.xl,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    lineHeight: 26,
  },
  cardSub: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.normal,
  },
  chevron: {
    fontSize: 30,
    lineHeight: 32,
  },
});
