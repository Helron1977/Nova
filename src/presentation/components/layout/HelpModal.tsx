import React from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {

  // Contenu de l'aide formaté en JSX avec IDs pour la navigation
  const helpContent = (
    <div className="text-sm">
      <h2 id="toc" className="text-lg font-semibold mb-3 sticky top-0 bg-white dark:bg-gray-800 pb-2">Sommaire</h2>
      <ul className="list-disc pl-5 mb-6 space-y-1">
        <li><a href="#global-shortcuts" className="text-blue-600 dark:text-blue-400 hover:underline">Raccourcis Globaux</a></li>
        <li><a href="#general-block-interactions" className="text-blue-600 dark:text-blue-400 hover:underline">Interactions Générales sur les Blocs</a></li>
        <li><a href="#block-types" className="text-blue-600 dark:text-blue-400 hover:underline">Comportement par Type de Bloc</a>
          <ul className="list-circle pl-5 mt-1 space-y-1">
            <li><a href="#text-paragraph" className="text-blue-600 dark:text-blue-400 hover:underline">Paragraphe</a></li>
            <li><a href="#text-heading-quote" className="text-blue-600 dark:text-blue-400 hover:underline">Titre / Citation</a></li>
            <li><a href="#list-blocks" className="text-blue-600 dark:text-blue-400 hover:underline">Blocs de Liste (listItem)</a></li>
            <li><a href="#code-blocks" className="text-blue-600 dark:text-blue-400 hover:underline">Blocs de Code (code, mermaid, table/csv)</a></li>
            <li><a href="#image-blocks" className="text-blue-600 dark:text-blue-400 hover:underline">Blocs d'Image (image)</a></li>
            <li><a href="#other-blocks" className="text-blue-600 dark:text-blue-400 hover:underline">Autres Blocs (thematicBreak, html)</a></li>
          </ul>
        </li>
         <li><a href="#unclear-points" className="text-blue-600 dark:text-blue-400 hover:underline">Points Non Clairement Définis</a></li>
      </ul>
      <hr className="my-4 border-gray-300 dark:border-gray-600"/>

      <h2 id="global-shortcuts" className="text-lg font-semibold mt-4 mb-2">Raccourcis Globaux</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Ctrl + S</code> (ou <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Cmd + S</code> sur Mac) : Sauvegarde le document (ouvre une invite pour le nom du fichier).</li>
      </ul>

      <h2 id="general-block-interactions" className="text-lg font-semibold mt-4 mb-2">Interactions Générales sur les Blocs</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Focus / Sélection :</strong> Cliquer dans le contenu d'un bloc met le focus dessus pour l'édition.</li>
        <li><strong>Glisser-Déposer :</strong> Cliquer et maintenir sur la <strong>poignée verticale <code className="inline-block align-middle">(<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-grip-vertical inline-block"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>)</code></strong> qui apparaît au survol de la marge gauche pour réorganiser les blocs. L'indentation des blocs standards peut s'ajuster automatiquement lors du déplacement.</li>
        <li><strong>Contrôles au Survol (Marge Gauche) :</strong>
          <ul className="list-circle pl-5 mt-1 space-y-1">
            <li><strong>Bouton Ajouter <code className="inline-block align-middle">(<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-plus inline-block"><path d="M5 12h14"/><path d="M12 5v14"/></svg>)</code> :</strong> Ouvre un menu pour insérer un nouveau bloc après le bloc actuel. Types disponibles : Paragraphe, Titre 1/2, Code, Mermaid, Image, Citation, Tableau(CSV), HTML, Ligne Horizontale. Pour les listes, des actions spécifiques s'ajoutent (voir section Listes).</li>
            <li><strong>Bouton Supprimer <code className="inline-block align-middle">(<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-trash-2 inline-block"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>)</code> :</strong> Supprime le bloc actuel.</li>
            <li><strong>Poignée de déplacement <code className="inline-block align-middle">(<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-grip-vertical inline-block"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>)</code> :</strong> Permet le glisser-déposer.</li>
          </ul>
        </li>
      </ul>

      <h2 id="block-types" className="text-lg font-semibold mt-4 mb-2">Comportement par Type de Bloc</h2>

      <h3 id="text-paragraph" className="text-md font-semibold mt-3 mb-1">Paragraphe</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Édition :</strong> <strong>Simple clic</strong> active un éditeur intégré (CodeMirror) avec coloration syntaxique Markdown.</li>
        <li><strong>Saisie :</strong> Syntaxe Markdown colorée. Le contenu est <strong>re-parsé</strong> à la sauvegarde, ce qui peut transformer un paragraphe en un autre type de bloc (ex: taper <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">-</code> au début crée une liste).</li>
        <li><strong>Touche <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Entrée</code> :</strong> Insère un retour à la ligne dans l'éditeur. Peut <strong>scinder le bloc</strong> en deux paragraphes lors de la sauvegarde.</li>
        <li><strong><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Ctrl + Entrée</code> :</strong> Non défini.</li>
        <li><strong>Clic Droit :</strong> Ouvre un <strong>menu de formatage contextuel</strong> (Gras (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Ctrl+B</code>), Italique (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Ctrl+I</code>), Barré, Code Inline, Lien).</li>
        <li><strong>Quitter l'édition :</strong> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Echap</code> annule. Cliquer en dehors de l'éditeur (blur) sauvegarde les changements.</li>
      </ul>

      <h3 id="text-heading-quote" className="text-md font-semibold mt-3 mb-1">Titre / Citation</h3>
       <ul className="list-disc pl-5 space-y-1">
        <li><strong>Édition :</strong> <strong>Double-clic</strong> active l'édition de <strong>texte brut</strong> (dans un champ input/textarea).</li>
        <li><strong>Saisie :</strong> Texte brut uniquement. Le formatage inline (gras, italique...) entré ici sera perdu/ignoré lors de la sauvegarde.</li>
        <li><strong>Touche <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Entrée</code> :</strong> <strong>Sauvegarde</strong> et quitte l'édition. (Pour les citations, utiliser <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Shift + Entrée</code> pour insérer un retour à la ligne).</li>
        <li><strong><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Ctrl + Entrée</code> :</strong> Non défini.</li>
        <li><strong>Clic Droit :</strong> Menu contextuel standard du navigateur (Couper/Copier/Coller...).</li>
        <li><strong>Quitter l'édition :</strong> <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Echap</code> annule. Cliquer en dehors (blur) ou appuyer sur <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Entrée</code> sauvegarde les changements.</li>
      </ul>

      <h3 id="list-blocks" className="text-md font-semibold mt-3 mb-1">Blocs de Liste (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">listItem</code>)</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Édition :</strong> <strong>Double-clic</strong> sur le texte active l'édition de <strong>texte brut</strong> (sans marqueur/case à cocher) dans un champ textarea.</li>
        <li><strong>Touche <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Entrée</code> :</strong> <strong>Sauvegarde</strong> et quitte l'édition. Utiliser <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Shift + Entrée</code> pour insérer un retour à la ligne dans l'éditeur. (Ne crée pas de nouvel élément).</li>
        <li><strong><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Tab</code> / <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Shift + Tab</code> :</strong> Non géré pour l'indentation/dé-indentation via clavier. La profondeur est gérée via le menu d'actions.</li>
        <li><strong>Case à Cocher :</strong> Si présente, elle est <strong>directement cliquable</strong> pour basculer l'état (coché/décoché). La modification manuelle du texte (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">[ ]</code> &lt;-&gt; <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">[x]</code>) suivie d'une sauvegarde fonctionne aussi.</li>
        <li><strong>Menu d'Actions (via bouton "+") :</strong> Propose les actions spécifiques "Ajouter élément" (ajoute un item au même niveau) et "Créer une sous liste" (ajoute un item enfant indenté). "Créer une sous liste" ouvre un sous-menu pour choisir le style de marqueur (puce, numéro, lettre, romain).</li>
      </ul>

      <h3 id="code-blocks" className="text-md font-semibold mt-3 mb-1">Blocs de Code (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">code</code>)</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Édition :</strong> <strong>Double-clic</strong> active l'édition de <strong>texte brut</strong> dans un champ textarea.</li>
        <li><strong>Touche <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Entrée</code> :</strong> Insère un retour à la ligne.</li>
        <li><strong>Touche <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Tab</code> :</strong> <strong>Augmente l'indentation</strong> du bloc entier.</li>
        <li><strong>Touche <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Shift + Tab</code> :</strong> <strong>Diminue l'indentation</strong> du bloc entier.</li>
        <li><strong><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Ctrl + Entrée</code></strong> (ou <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Cmd + Entrée</code>) : <strong>Sauvegarde</strong> et quitte l'édition.</li>
        <li><strong><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Echap</code> :</strong> Annule et quitte l'édition.</li>
        <li><strong>Rendu :</strong> Affiche le code comme texte brut préformaté. Pas de coloration syntaxique par défaut.</li>
      </ul>

      <h3 id="mermaid-blocks" className="text-md font-semibold mt-3 mb-1">Blocs Mermaid (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">mermaid</code>)</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Édition :</strong> <strong>Non éditable directement</strong> dans le rendu du diagramme. Pour modifier le code, il faut utiliser d'autres méthodes (non fournies par défaut).</li>
        <li><strong>Rendu :</strong> Affiche le diagramme généré à partir du code Mermaid interne.</li>
      </ul>

      <h3 id="table-csv-blocks" className="text-md font-semibold mt-3 mb-1">Blocs Tableau (via CSV)</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Ajout :</strong> L'option "Tableau" dans le menu "+" insère un bloc de <strong>type `code`</strong> avec la langue `csv` et un contenu par défaut.</li>
        <li><strong>Édition :</strong> Ce bloc s'édite comme un bloc de code normal (voir section Blocs de Code : double-clic, textarea, Tab/Shift+Tab pour indentation...).</li>
        <li><strong>Rendu :</strong> Est affiché comme un bloc de code brut, <strong>pas comme un tableau HTML</strong> visuel.</li>
      </ul>

      <h3 id="image-blocks" className="text-md font-semibold mt-3 mb-1">Blocs d'Image (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">image</code>)</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Rendu :</strong> Affiche l'image correspondant à l'URL source. Un placeholder s'affiche si l'URL est vide ou invalide.</li>
        <li><strong>Édition (URL) :</strong> <strong>Simple clic</strong> sur l'image active un mode édition qui permet de modifier <strong>uniquement l'URL (src)</strong> via un champ de texte.</li>
        <li><strong>Validation/Annulation :</strong> Appuyer sur <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Entrée</code> ou cliquer sur "Valider" enregistre la nouvelle URL. Appuyer sur <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Echap</code> ou cliquer sur "Annuler" abandonne les modifications.</li>
        <li><strong>Édition (Alt/Title) :</strong> Les textes alternatifs (`alt`) et titres (`title`) ne sont <strong>pas modifiables</strong> directement via cette interface.</li>
      </ul>

      <h3 id="other-blocks" className="text-md font-semibold mt-3 mb-1">Autres Blocs (<code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">thematicBreak</code>, <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">html</code>)</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">thematicBreak</code> (Ligne Horizontale) :</strong> Non éditable, supprimable via le bouton Corbeille au survol.</li>
        <li><strong><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">html</code> :</strong> Rendu tel quel après nettoyage de sécurité (via <code className="bg-gray-100 dark:bg-gray-900 p-0.5 rounded">dangerouslySetInnerHTML</code>). Non éditable via l'interface, supprimable via le bouton Corbeille au survol.</li>
      </ul>

      <h2 id="unclear-points" className="text-lg font-semibold mt-4 mb-2">Points Non Clairement Définis / Non Implémentés</h2>
       <ul className="list-disc pl-5 space-y-1">
        <li>Gestion de la sélection de texte s'étendant sur plusieurs blocs.</li>
        <li>Raccourcis clavier additionnels (ex: création rapide de bloc, indentation/dé-indentation de listes).</li>
        <li>Comportement exact lors de la suppression du dernier caractère d'un bloc éditable (ex: transformation en paragraphe vide?).</li>
      </ul>
    </div>
  );

  return (
    // Backdrop
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose} // Ferme en cliquant sur le fond
    >
      {/* Conteneur de la modale */}
      <div
        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()} // Empêche la fermeture en cliquant dans la modale
      >
        {/* Header de la modale */}
        <div className="flex justify-between items-center border-b border-gray-300 dark:border-gray-600 pb-3 mb-4">
          <h1 className="text-xl font-bold">Aide et Raccourcis</h1>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl font-bold"
            aria-label="Fermer l'aide"
          >
            &times;
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-grow pr-2">
           {helpContent}
        </div>

         {/* Footer optionnel (ex: bouton Fermer) */}
         <div className="border-t border-gray-300 dark:border-gray-600 pt-3 mt-4 text-right">
             <button
                 onClick={onClose}
                 className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
             >
                 Fermer
             </button>
         </div>
      </div>
    </div>
  );
};

export default HelpModal; 