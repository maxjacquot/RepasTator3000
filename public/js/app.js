// RepasTator, version site web (sans Expo) : écrans, navigation, chargement et synchronisation des données.
// Adresses : / (planning), /recettes, /courses, /recette/<id> (l'ancienne /recipe/<id> marche aussi).
import { el } from './ui.js';
import { charger, surEvenement, utilisateurConnecte, enCoursDEnvoi } from './stockage.js';
import { initialiser } from './donnees.js';
import { ecranPlanning } from './planning.js';
import { ecranRecettes } from './recettes.js';
import { ecranCourses } from './courses.js';
import { ecranRecette } from './recette.js';

const racine = document.getElementById('app');
const ONGLETS = [
  { chemin: '/', icone: '📅', nom: 'Planning' },
  { chemin: '/recettes', icone: '📖', nom: 'Recettes' },
  { chemin: '/courses', icone: '🛒', nom: 'Courses' },
];
let dernierOnglet = '/'; // où revenir depuis une recette ouverte directement par son adresse
let bandeau = '';

function route() {
  const chemin = location.pathname.replace(/\/+$/, '') || '/';
  const m = /^\/(?:recette|recipe)\/(\d+)$/.exec(chemin);
  if (m) return { ecran: 'recette', id: Number(m[1]) };
  return { ecran: ONGLETS.find((o) => o.chemin === chemin)?.chemin ?? '/' };
}

function aller(chemin) {
  history.pushState({ depuisAppli: true }, '', chemin);
  afficher();
  window.scrollTo(0, 0);
}

const nav = {
  ouvrirRecette: (id) => aller(`/recette/${id}`),
  retour: () => (history.state?.depuisAppli ? history.back() : aller(dernierOnglet)),
  redessiner: () => afficher(),
};

function afficher() {
  const r = route();
  const position = window.scrollY;
  let contenu;
  if (r.ecran === 'recette') contenu = ecranRecette({ ...nav, id: r.id });
  else {
    dernierOnglet = r.ecran;
    contenu = { '/': ecranPlanning, '/recettes': ecranRecettes, '/courses': ecranCourses }[r.ecran](nav);
  }
  const barre = el('nav', { class: 'onglets-bas', 'aria-label': 'Écrans' }, ONGLETS.map((o) => el('a', {
    href: o.chemin,
    class: (r.ecran === 'recette' ? dernierOnglet : r.ecran) === o.chemin ? 'actif' : '',
    'aria-current': r.ecran === o.chemin ? 'page' : null,
    onclick: (ev) => { ev.preventDefault(); if (r.ecran !== o.chemin) aller(o.chemin); },
  }, el('span', { class: 'onglet-icone', 'aria-hidden': 'true' }, o.icone), o.nom)));
  racine.replaceChildren(
    bandeau ? el('button', { type: 'button', class: 'bandeau', onclick: () => { bandeau = ''; afficher(); } }, `${bandeau} (toucher pour fermer)`) : '',
    ...contenu,
    barre,
  );
  racine.dataset.ecran = r.ecran === 'recette' ? 'recette' : r.ecran.slice(1) || 'planning';
  window.scrollTo(0, position);
}

window.addEventListener('popstate', () => afficher());

async function demarrer() {
  racine.replaceChildren(el('div', { class: 'chargement' }, el('span', { class: 'roue' }), 'Chargement…'));
  try {
    await charger();
  } catch {
    racine.replaceChildren(el('div', { class: 'chargement' },
      el('p', {}, 'Impossible de charger les données.'),
      el('button', { type: 'button', class: 'principal', onclick: demarrer }, 'Réessayer')));
    return;
  }
  initialiser();
  afficher();
}

surEvenement((e) => {
  if (e.type === 'conflit') {
    // e.par est l'id du compte (pas son identifiant) : on dit seulement si c'était nous, sur un autre appareil
    bandeau = e.par === utilisateurConnecte()
      ? 'Vous avez modifié la même chose sur un autre appareil en même temps : cette version-là a été gardée.'
      : "Quelqu'un d'autre a modifié la même chose en même temps : sa version a été gardée.";
  }
  if (e.type === 'erreur') bandeau = `Enregistrement impossible (${e.message}). Vérifiez la connexion internet.`;
  if (e.type === 'change' || bandeau) afficher();
});

// Retour sur l'onglet (ou l'appli) : on recharge ce que les autres ont changé
async function auRetour() {
  if (document.visibilityState !== 'visible' || enCoursDEnvoi() || document.querySelector('dialog[open]')) return;
  try {
    if (await charger()) afficher();
  } catch { /* hors ligne : on garde ce qu'on a */ }
}
document.addEventListener('visibilitychange', auRetour);
window.addEventListener('focus', auRetour);
window.addEventListener('beforeunload', (ev) => {
  if (enCoursDEnvoi()) ev.preventDefault();
});

demarrer();
