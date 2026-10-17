// Écran « Mes recettes » : recherche (titre, ingrédients, tags), filtres par catégorie, import et export.
import { el, message, pluriel, notifier } from './ui.js';
import * as D from './donnees.js';
import { listeFiltrable, fenetreImport } from './fenetres.js';
import { exporterRecettes } from './import.js';

const etat = { recherche: '', categorie: 'Toutes' }; // gardé quand on revient sur l'écran

function telecharger(texte, nom) {
  const lien = el('a', { href: URL.createObjectURL(new Blob([texte], { type: 'application/json' })), download: nom });
  document.body.append(lien);
  lien.click();
  lien.remove();
}

async function exporter() {
  const toutes = D.toutesLesRecettes();
  const json = exporterRecettes(toutes);
  let copie = false;
  try {
    await navigator.clipboard.writeText(json);
    copie = true;
  } catch { /* presse-papier refusé : le fichier reste possible */ }
  const choix = await message({
    titre: copie ? 'Recettes copiées' : 'Exporter les recettes',
    message: copie
      ? `${pluriel(toutes.length, 'recette copiée', 'recettes copiées')} dans le presse-papier. Tu peux aussi les télécharger dans un fichier.`
      : `${pluriel(toutes.length, 'recette')} à télécharger dans un fichier.`,
    boutons: [{ texte: 'Télécharger le fichier', valeur: 'fichier', style: 'clair' }, { texte: 'OK', valeur: 'ok', style: 'principal' }],
  });
  if (choix === 'fichier') telecharger(json, `recettes-repastator-${new Date().toISOString().slice(0, 10)}.json`);
}

/** @param {{ ouvrirRecette: (id: number) => void, redessiner: () => void }} nav */
export function ecranRecettes(nav) {
  const { elements } = listeFiltrable((r) => nav.ouvrirRecette(r.id), etat);
  return [
    el('header', { class: 'entete' },
      el('div', { class: 'titre' }, el('span', { id: 'volet-outils' }), el('h1', {}, 'Mes recettes')),
      el('div', { class: 'entete-boutons' },
        el('button', { type: 'button', class: 'sur-entete', onclick: exporter }, 'Exporter'),
        el('button', {
          type: 'button', class: 'sur-entete',
          onclick: async () => {
            const r = await fenetreImport();
            if (!r) return;
            nav.redessiner();
            notifier(`✅ ${pluriel(r.importees, 'recette importée', 'recettes importées')}`);
            if (r.erreurs.length) await message({ titre: 'Certaines recettes ont été ignorées', message: r.erreurs.join('\n') });
          },
        }, 'Importer'))),
    el('main', { class: 'contenu contenu-recettes' }, elements),
  ];
}
