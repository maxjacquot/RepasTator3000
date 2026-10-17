// Données sur le serveur (api/serveur.js), gardées en mémoire dans la page.
//   - au démarrage, charger() récupère toutes les clés ;
//   - chaque écriture met à jour la mémoire tout de suite, puis part au serveur en arrière-plan
//     (une requête à la fois par clé) avec le numéro de version connu ;
//   - si quelqu'un d'autre a modifié la même clé entre-temps, le serveur refuse (409) : sa version gagne
//     et la page prévient (évènement « conflit ») ;
//   - au retour sur l'onglet, la page recharge ce qui a changé (voir app.js).
// Même fonctionnement que l'ancienne appli Expo (lib/stockage.web.ts) : les données ne changent pas.

const cache = new Map(); // clé → { valeur: string|null, version }
const enAttente = new Map(); // clé → dernière valeur à envoyer
const envoisEnCours = new Set();
const abonnes = new Set();
let utilisateur = '';

const prevenir = (e) => abonnes.forEach((f) => f(e));

/** @param {(e: {type: 'change'} | {type: 'conflit', par: string} | {type: 'erreur', message: string}) => void} f */
export function surEvenement(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export const utilisateurConnecte = () => utilisateur;

async function lireReponse(reponse) {
  if (reponse.status === 401) {
    // Session expirée : la page de connexion du portail
    window.location.reload();
    throw new Error('Session expirée');
  }
  if (!reponse.ok && reponse.status !== 409) throw new Error(`Erreur du serveur (${reponse.status})`);
  return reponse.json();
}

/** Charge toutes les données depuis le serveur. @returns {Promise<boolean>} true si quelque chose a changé */
export async function charger() {
  const donnees = await lireReponse(await fetch('/api/donnees', { cache: 'no-store' }));
  utilisateur = donnees.utilisateur;
  let change = false;
  for (const [cle, e] of Object.entries(donnees.cles)) {
    if (enAttente.has(cle) || envoisEnCours.has(cle)) continue; // nos propres modifications partent
    const actuelle = cache.get(cle);
    if (!actuelle || actuelle.version !== e.version) {
      cache.set(cle, e);
      change = true;
    }
  }
  return change;
}

async function envoyer(cle) {
  if (envoisEnCours.has(cle)) return; // la boucle en cours enverra la dernière valeur
  envoisEnCours.add(cle);
  try {
    while (enAttente.has(cle)) {
      const valeur = enAttente.get(cle);
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

export function lire(cle) {
  return cache.get(cle)?.valeur ?? null;
}

export function ecrire(cle, valeur) {
  const actuelle = cache.get(cle);
  if (actuelle?.valeur === valeur) return; // rien de changé : pas d'envoi
  cache.set(cle, { valeur, version: actuelle?.version ?? 0 });
  enAttente.set(cle, valeur);
  void envoyer(cle);
}

/** Des écritures sont-elles encore en route vers le serveur ? */
export const enCoursDEnvoi = () => enAttente.size > 0 || envoisEnCours.size > 0;
