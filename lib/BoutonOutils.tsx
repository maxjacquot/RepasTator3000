// Bouton du volet « Mes outils » (les autres applis de mjacquot.fr), en haut de l'écran Planning.
// Version web en ligne uniquement. Le bouton et le volet viennent du script du portail
// (https://mjacquot.fr/volet-outils.js) : il se place dans l'élément id="volet-outils" rendu ici,
// et n'affiche rien si la personne n'a qu'une appli.
import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { spacing } from './theme';

const SCRIPT = 'https://mjacquot.fr/volet-outils.js';

export default function BoutonOutils() {
  const enLigne = Platform.OS === 'web' && window.location.hostname.endsWith('.mjacquot.fr');

  useEffect(() => {
    if (!enLigne || document.querySelector(`script[src="${SCRIPT}"]`)) return;
    document.head.append(Object.assign(document.createElement('script'), { src: SCRIPT, defer: true }));
  }, [enLigne]);

  if (!enLigne) return null;
  return <View nativeID="volet-outils" style={styles.place} />;
}

const styles = StyleSheet.create({
  place: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
});
