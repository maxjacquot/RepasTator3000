// Stockage de la version web, synchronisé avec le serveur (api/ de ce repo, maison.mjacquot.fr).
//
// La couche de données (database.web.ts) est synchrone : elle lit et écrit des chaînes JSON par clé,
// comme avec localStorage. On garde donc tout en mémoire :
//   - au démarrage, chargerDonnees() récupère toutes les clés depuis le serveur ;
//   - chaque écriture met à jour la mémoire tout de suite, puis part au serveur (en arrière-plan,
//     une requête à la fois par clé) avec le numéro de version connu ;
//   - si quelqu'un d'autre a modifié la même clé entre-temps, le serveur refuse (409) : on prend
//     sa version et on prévient l'utilisateur ;
//   - quand on revient sur l'onglet, on recharge ce qui a changé.

type Entree = { valeur: string | null; version: number };
type Evenement = { type: 'change' } | { type: 'conflit'; par: string } | { type: 'erreur'; message: string };

const cache = new Map<string, Entree>();
const enAttente = new Map<string, string>(); // clé → dernière valeur à envoyer
const envoisEnCours = new Set<string>();
const abonnes = new Set<(e: Evenement) => void>();
let utilisateur = '';

function prevenir(e: Evenement) {
  for (const f of abonnes) f(e);
}

export function surEvenement(f: (e: Evenement) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function utilisateurConnecte(): string {
  return utilisateur;
}

async function lireReponse(reponse: Response) {
  if (reponse.status === 401) {
    // Session expirée : la page de connexion du portail
    window.location.reload();
    throw new Error('Session expirée');
  }
  if (!reponse.ok && reponse.status !== 409) throw new Error(`Erreur du serveur (${reponse.status})`);
  return reponse.json();
}

/** Charge toutes les données depuis le serveur. @returns true si quelque chose a changé. */
export async function chargerDonnees(): Promise<boolean> {
  const donnees = await lireReponse(await fetch('/api/donnees', { cache: 'no-store' }));
  utilisateur = donnees.utilisateur;
  let change = false;
  for (const [cle, e] of Object.entries(donnees.cles as Record<string, Entree>)) {
    if (enAttente.has(cle) || envoisEnCours.has(cle)) continue; // nos propres modifications partent
    const actuelle = cache.get(cle);
    if (!actuelle || actuelle.version !== e.version) {
      cache.set(cle, e);
      change = true;
    }
  }
  return change;
}

async function envoyer(cle: string): Promise<void> {
  if (envoisEnCours.has(cle)) return; // la boucle en cours enverra la dernière valeur
  envoisEnCours.add(cle);
  try {
    while (enAttente.has(cle)) {
      const valeur = enAttente.get(cle)!;
      enAttente.delete(cle);
      const version = cache.get(cle)?.version ?? 0;
      const reponse = await fetch(`/api/donnees/${encodeURIComponent(cle)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valeur, version }),
      });
      const r = await lireReponse(reponse);
      if (reponse.status === 409) {
        // Modifié par quelqu'un d'autre : sa version gagne, on abandonne nos écritures en attente.
        cache.set(cle, { valeur: r.valeur, version: r.version });
        enAttente.delete(cle);
        prevenir({ type: 'conflit', par: r.par });
        prevenir({ type: 'change' });
        return;
      }
      cache.set(cle, { valeur, version: r.version });
    }
  } catch (e) {
    prevenir({ type: 'erreur', message: e instanceof Error ? e.message : String(e) });
  } finally {
    envoisEnCours.delete(cle);
  }
}

/** Remplace localStorage dans database.web.ts. */
export const stockage = {
  getItem(cle: string): string | null {
    return cache.get(cle)?.valeur ?? null;
  },
  setItem(cle: string, valeur: string): void {
    const actuelle = cache.get(cle);
    if (actuelle?.valeur === valeur) return; // rien de changé : pas d'envoi
    cache.set(cle, { valeur, version: actuelle?.version ?? 0 });
    enAttente.set(cle, valeur);
    void envoyer(cle);
  },
};

/** Des écritures sont-elles encore en route vers le serveur ? */
export function enCoursDEnvoi(): boolean {
  return enAttente.size > 0 || envoisEnCours.size > 0;
}
