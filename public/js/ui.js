// Briques d'affichage : création d'éléments, fenêtres (<dialog>), messages, bouton qui se répète
// quand on reste appuyé. Aucune bibliothèque : le style vient de la charte commune (charte.css) et de style.css.

/**
 * Crée un élément. el('button', { class: 'principal', onclick }, 'Texte', autreElement)
 * Attributs : class, html (innerHTML, seulement pour du texte sûr), on<évènement>, dataset, style, le reste en attribut.
 */
export function el(nom, attrs = {}, ...enfants) {
  const e = document.createElement(nom);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const enfant of enfants.flat(Infinity)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    e.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return e;
}

export const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

// ─── Fenêtres ─────────────────────────────────────────────────

/**
 * Ouvre une fenêtre (<dialog>). `construire(fermer)` renvoie son contenu ; fermer(valeur) la ferme et
 * résout la promesse avec cette valeur (null si on ferme par ✕, Échap ou un clic à côté).
 * @param {{ titre: string, sousTitre?: string, feuille?: boolean, classe?: string }} options
 *   feuille : grande fenêtre (plein écran sur téléphone), pour les listes.
 */
export function ouvrirFenetre({ titre, sousTitre, feuille = false, classe = '' }, construire) {
  return new Promise((resoudre) => {
    let resultat = null;
    const dialogue = el('dialog', { class: `fenetre ${feuille ? 'feuille' : ''} ${classe}` });
    const fermer = (valeur = null) => {
      resultat = valeur;
      dialogue.close();
    };
    dialogue.append(
      el('div', { class: 'fenetre-tete' },
        el('div', {}, el('h2', {}, titre), sousTitre ? el('p', { class: 'fenetre-sous-titre' }, sousTitre) : null),
        el('button', { type: 'button', class: 'fermer', 'aria-label': 'Fermer', onclick: () => fermer(null) }, '✕'),
      ),
      el('div', { class: 'fenetre-corps' }, construire(fermer)),
    );
    // Clic à côté de la fenêtre (sur le fond) : fermer
    dialogue.addEventListener('click', (ev) => {
      if (ev.target === dialogue) fermer(null);
    });
    dialogue.addEventListener('close', () => {
      dialogue.remove();
      resoudre(resultat);
    });
    document.body.append(dialogue);
    dialogue.showModal();
  });
}

/**
 * Message avec des boutons (remplace alert / confirm).
 * @param {{ titre: string, message?: string, boutons?: { texte: string, valeur?: any, style?: 'principal'|'danger'|'clair' }[] }} o
 * @returns {Promise<any>} valeur du bouton choisi (null si fermé)
 */
export function message({ titre, message: texte, boutons = [{ texte: 'OK', valeur: true, style: 'principal' }] }) {
  return ouvrirFenetre({ titre, classe: 'message' }, (fermer) => [
    texte ? el('p', { class: 'message-texte' }, texte) : null,
    el('div', { class: 'actions droite' },
      boutons.map((b) => el('button', { type: 'button', class: b.style ?? 'clair', onclick: () => fermer(b.valeur ?? b.texte) }, b.texte))),
  ]);
}

/** Confirmation : true si on choisit le bouton d'action. */
export async function confirmer({ titre, message: texte, action, danger = false }) {
  const r = await message({
    titre,
    message: texte,
    boutons: [{ texte: 'Annuler', valeur: false, style: 'clair' }, { texte: action, valeur: true, style: danger ? 'danger' : 'principal' }],
  });
  return r === true;
}

/** Petit message en bas de l'écran, qui disparaît tout seul. */
export function notifier(texte) {
  document.querySelector('.notification')?.remove();
  const n = el('div', { class: 'notification', role: 'status' }, texte);
  document.body.append(n);
  setTimeout(() => n.remove(), 2600);
}

// ─── Bouton qui se répète quand on reste appuyé (− / + des quantités) ───

const DELAI = 300; // ms avant le début de la répétition
const PREMIER_INTERVALLE = 150;
const INTERVALLE_MIN = 40;
const ACCELERATION = 0.85;
/** Le pas grandit si on reste appuyé longtemps (300 g → 0 en un geste). */
const multiplicateur = (tic) => (tic < 8 ? 1 : tic < 20 ? 2 : 5);

/** @param {(multiplicateur: number) => void} action */
export function boutonRepete(attrs, contenu, action) {
  const b = el('button', { type: 'button', ...attrs }, contenu);
  let minuteur = null;
  let tic = 0;
  let intervalle = PREMIER_INTERVALLE;
  let repete = false;
  const arreter = () => {
    clearTimeout(minuteur);
    minuteur = null;
  };
  const programmer = (delai) => {
    minuteur = setTimeout(() => {
      repete = true;
      tic += 1;
      action(multiplicateur(tic));
      intervalle = Math.max(INTERVALLE_MIN, intervalle * ACCELERATION);
      programmer(intervalle);
    }, delai);
  };
  b.addEventListener('pointerdown', (ev) => {
    if (b.disabled || ev.button > 0) return;
    tic = 0;
    intervalle = PREMIER_INTERVALLE;
    repete = false;
    programmer(DELAI);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, arreter);
  // Appui bref (ou clavier) : un seul pas
  b.addEventListener('click', () => {
    if (!repete) action(1);
    repete = false;
  });
  b.addEventListener('contextmenu', (ev) => ev.preventDefault()); // appui long sur téléphone : pas de menu
  return b;
}

// ─── Dates ────────────────────────────────────────────────────

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_COURTS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'];

/** Les 7 jours du planning à partir d'aujourd'hui (date locale « AAAA-MM-JJ »). */
export function septJours() {
  return Array.from({ length: 7 }, (_, decalage) => {
    const d = new Date();
    d.setDate(d.getDate() + decalage);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const nom = decalage === 0 ? "Aujourd'hui" : decalage === 1 ? 'Demain' : JOURS[d.getDay()];
    return {
      date,
      decalage,
      titre: nom,
      sousTitre: decalage < 2 ? `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}` : `${d.getDate()} ${MOIS[d.getMonth()]}`,
      court: decalage < 2 ? `${nom}, ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}` : `${JOURS_COURTS[d.getDay()]} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`,
    };
  });
}
