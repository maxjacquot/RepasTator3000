// Lien « Mes outils » vers le portail mjacquot.fr (version web en ligne uniquement).
// Affiché seulement si la personne a plusieurs outils : le portail le dit (GET /api/outils, avec le cookie).
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, StyleSheet } from 'react-native';
import { typography, spacing, radii } from './theme';

const PORTAIL = 'https://mjacquot.fr';

export default function LienMesOutils() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !window.location.hostname.endsWith('.mjacquot.fr')) return;
    fetch(`${PORTAIL}/api/outils`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((r: { pageOutils?: boolean }) => setVisible(Boolean(r.pageOutils)))
      .catch(() => {}); // portail injoignable : pas de lien
  }, []);

  if (!visible) return null;
  return (
    <Pressable
      onPress={() => window.location.assign(`${PORTAIL}/`)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.lien, pressed && styles.appuye]}
    >
      <Text style={styles.texte}>‹ Mes outils</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lien: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  appuye: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  texte: {
    color: '#fff',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
});
