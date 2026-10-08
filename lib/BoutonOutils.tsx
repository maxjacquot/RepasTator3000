// Bouton du volet « Mes applications » (les autres applis de mjacquot.fr), en haut de chaque écran :
// en-tête des 3 panneaux (Planning, Recettes, Courses) et barre de l'écran Recette (style={null}).
// Version web en ligne uniquement. Le bouton et le volet viennent du script du portail
// (https://mjacquot.fr/volet-outils.js) : il se place dans l'élément id="volet-outils" rendu ici,
// et va dans celui qui est à l'écran (les panneaux sont côte à côte, l'accueil reste sous la Recette).
import { useEffect } from 'react';
import { Platform, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from './theme';

const SCRIPT = 'https://mjacquot.fr/volet-outils.js';

export default function BoutonOutils({ style }: { style?: StyleProp<ViewStyle> }) {
  const enLigne = Platform.OS === 'web' && window.location.hostname.endsWith('.mjacquot.fr');

  useEffect(() => {
    if (!enLigne || document.querySelector(`script[src="${SCRIPT}"]`)) return;
    document.head.append(Object.assign(document.createElement('script'), { src: SCRIPT, defer: true }));
  }, [enLigne]);

  if (!enLigne) return null;
  return <View nativeID="volet-outils" style={style === undefined ? styles.place : style} />;
}

const styles = StyleSheet.create({
  place: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
});
