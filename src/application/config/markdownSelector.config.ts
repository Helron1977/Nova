// src/application/config/markdownSelector.config.ts
interface SelectionEntry {
  marker: 'X' | ' ';
  path: string;
  description: string;
}

// L'UTILISATEUR MODIFIERA LE 'marker' CI-DESSOUS POUR SÉLECTIONNER UN FICHIER
// UN SEUL 'X' EST ATTENDU PARMI TOUTES LES ENTRÉES.
export const selectionConfiguration: SelectionEntry[] = [
  { marker: 'X', path: '@/application/config/initialMarkdown.ts', description: 'Défaut : Contenu complet original' },
  { marker: ' ', path: '@/application/config/initialMarkdownPalette.ts', description: 'Palette de couleurs' },
  { marker: ' ', path: '@/application/config/initialMarkdownParagraph.ts', description: 'Paragraphes simples' },
  { marker: ' ', path: '@/application/config/initialMarkdownHeading.ts', description: 'Titre de niveau 2' },
  { marker: ' ', path: '@/application/config/initialMarkdownBulletList.ts', description: 'Liste à puces' },
  { marker: ' ', path: '@/application/config/initialMarkdownOrderedList.ts', description: 'Liste numérotée' },
  { marker: ' ', path: '@/application/config/initialMarkdownTaskList.ts', description: 'Liste de tâches' },
  { marker: ' ', path: '@/application/config/initialMarkdownBlockquote.ts', description: 'Citation' },
  { marker: ' ', path: '@/application/config/initialMarkdownCodeBlock.ts', description: 'Bloc de code (JS)' },
  { marker: ' ', path: '@/application/config/initialMarkdownTable.ts', description: 'Tableau simple' },
  { marker: ' ', path: '@/application/config/initialMarkdownMermaid.ts', description: 'Diagramme Mermaid' },
  { marker: ' ', path: '@/application/config/initialMarkdownSpace.ts', description: 'Bloc Espace (h=75)' },
  { marker: ' ', path: '@/application/config/initialMarkdownCsv.ts', description: 'Bloc CSV (tableau)' },
  { marker: ' ', path: '@/application/config/initialMarkdownThematicBreak.ts', description: 'Lignes thématiques (séparateurs)' },
  { marker: ' ', path: '@/application/config/initialMarkdownDrawing.ts', description: 'Module de Dessin' },
];

export const getSelectedInitialMarkdownModulePath = (): string => {
  let selectedEntry = selectionConfiguration.find(entry => entry.marker === 'X');

  if (!selectedEntry) {
    console.warn(
      "Aucun fichier Markdown initial explicitement marqué d'un 'X' dans markdownSelector.config.ts. " +
      "Retour au premier élément de la liste s'il existe, sinon au fichier par défaut."
    );
    // Si aucun 'X', prendre le premier de la liste comme fallback s'il existe
    selectedEntry = selectionConfiguration.length > 0 ? selectionConfiguration[0] : undefined;
  }
  
  // Si toujours rien (liste vide), fallback sur le chemin codé en dur par défaut.
  if (!selectedEntry) {
    console.error(
        "La liste selectionConfiguration est vide dans markdownSelector.config.ts. " +
        "Utilisation du fichier initialMarkdown.ts par défaut."
    );
    return '@/application/config/initialMarkdown.ts';
  }
  
  // Si plusieurs 'X' sont présents, avertir et prendre le premier trouvé.
  const multipleSelections = selectionConfiguration.filter(entry => entry.marker === 'X');
  if (multipleSelections.length > 1) {
    console.warn(
        `Plusieurs fichiers (${multipleSelections.length}) sont marqués d'un 'X' dans markdownSelector.config.ts. ` +
        `Utilisation du premier trouvé : ${selectedEntry.path}`
    );
  }

  return selectedEntry.path;
}; 