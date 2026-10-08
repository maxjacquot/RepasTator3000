// Version web : charge les données du serveur avant d'afficher l'appli, puis les recharge quand on
// revient sur l'onglet. Quand des données changent (autre utilisateur, conflit), l'appli est
// ré-affichée pour montrer la version à jour.
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { chargerDonnees, enCoursDEnvoi, surEvenement, utilisateurConnecte } from './stockage.web';
import { colors } from './theme';

type Props = { onReady: () => void; children: ReactNode };

export default function SyncGate({ onReady, children }: Props) {
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const [revision, setRevision] = useState(0);
  const [bandeau, setBandeau] = useState('');

  async function demarrer() {
    setEtat('chargement');
    try {
      await chargerDonnees();
      onReady();
      setEtat('pret');
    } catch {
      setEtat('erreur');
    }
  }

  useEffect(() => {
    void demarrer();
  }, []);

  useEffect(() => {
    if (etat !== 'pret') return;
    const desabonner = surEvenement((e) => {
      if (e.type === 'change') setRevision((r) => r + 1);
      // e.par est l'id du compte (pas son identifiant) : on dit seulement si c'était nous, sur un autre appareil
      if (e.type === 'conflit') {
        setBandeau(
          e.par === utilisateurConnecte()
            ? 'Vous avez modifié la même chose sur un autre appareil en même temps : cette version-là a été gardée.'
            : "Quelqu'un d'autre a modifié la même chose en même temps : sa version a été gardée.",
        );
      }
      if (e.type === 'erreur') setBandeau(`Enregistrement impossible (${e.message}). Vérifiez la connexion internet.`);
    });
    const auRetour = async () => {
      if (document.visibilityState !== 'visible' || enCoursDEnvoi()) return;
      try {
        if (await chargerDonnees()) setRevision((r) => r + 1);
      } catch {}
    };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('focus', auRetour);
    const avantDeQuitter = (ev: BeforeUnloadEvent) => {
      if (enCoursDEnvoi()) ev.preventDefault();
    };
    window.addEventListener('beforeunload', avantDeQuitter);
    return () => {
      desabonner();
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('focus', auRetour);
      window.removeEventListener('beforeunload', avantDeQuitter);
    };
  }, [etat]);

  if (etat === 'chargement') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (etat === 'erreur') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
        <Text style={{ fontSize: 18, marginBottom: 16, textAlign: 'center' }}>Impossible de charger les données.</Text>
        <Pressable onPress={demarrer} style={{ backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 }}>
          <Text style={{ color: colors.surface, fontWeight: 'bold' }}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {bandeau ? (
        <Pressable onPress={() => setBandeau('')} style={{ backgroundColor: '#FFF4D6', padding: 10 }}>
          <Text style={{ textAlign: 'center' }}>{bandeau} (toucher pour fermer)</Text>
        </Pressable>
      ) : null}
      <View key={revision} style={{ flex: 1 }}>
        {children}
      </View>
    </View>
  );
}
