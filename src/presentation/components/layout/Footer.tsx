import React, {useRef } from 'react';
// Supprimer tous les imports CodeMirror
// import { EditorState, ChangeSpec } from '@codemirror/state';
// import { EditorView, keymap } from '@codemirror/view';
// import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
// import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
// import { languages } from '@codemirror/language-data';
// import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
// import { tags as t } from '@lezer/highlight';
// Optionnel : Importer un thème de base ou créer le vôtre
// import { oneDark } from '@codemirror/theme-one-dark'; 

// Supprimer thème et highlighting
/*
const baseTheme = EditorView.theme({
  "&": {
    color: "#000", // Couleur de texte par défaut
    backgroundColor: "#fff" // Fond blanc
  },
  ".cm-content": {
    caretColor: "#000" // Couleur du curseur
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#000" // Couleur du curseur quand focus
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#d7d4f0" // Couleur de fond de sélection
  },
  ".cm-gutters": { // Si jamais on ajoute les gouttières plus tard
    backgroundColor: "#f5f5f5",
    color: "#999",
    border: "none"
  }
}, {dark: false}); // Spécifier que c'est un thème clair

// Style de coloration syntaxique minimal pour Markdown
const markdownHighlighting = HighlightStyle.define([
  { tag: t.heading1, class: "text-2xl font-bold" },
  { tag: t.heading2, class: "text-xl font-semibold" },
  { tag: [t.heading3, t.heading4], class: "text-lg font-medium" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#0366d6", textDecoration: "underline" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", color: "#d73a49" }, // Code inline / Bloc code
  { tag: t.comment, color: "#6a737d" }, // Pour les commentaires dans les blocs de code
  { tag: t.meta, color: "#6a737d" }, // Ex: Les \`\`\` dans les blocs code
  { tag: t.keyword, color: "#d73a49" }, // Mots clés dans code
  { tag: t.string, color: "#032f62" }, // Strings dans code
  { tag: t.url, color: "#0366d6" },
  { tag: t.list, color: "#e36209" } // Marqueurs de liste
]);

const sampleMarkdown = `
# Test CodeMirror

Ceci est un *paragraphe* avec **différents** formats :

- Liste 1
- Liste 2

\`\`\`javascript
console.log('hello world!');
\`\`\`

[Un lien](https://codemirror.net)
\`code inline\` ~~barré~~\n`;
*/

// Supprimer le composant SimpleContextMenu (s'il n'est utilisé nulle part ailleurs)
/*
interface MenuAction {...}
interface SimpleContextMenuProps {...}
const SimpleContextMenu: React.FC<SimpleContextMenuProps> = (...) => { ... };
*/

const Footer: React.FC = () => {
  // Supprimer refs et state liés à CodeMirror
  // const editorRef = useRef<HTMLDivElement>(null);
  // const viewRef = useRef<EditorView | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  // const [menuState, setMenuState] = useState<{...}>({...});

  // Supprimer le useEffect lié à CodeMirror
  // useEffect(() => {
    // ... contenu supprimé ...
  // }, []);

  // Supprimer les fonctions utilitaires liées à CodeMirror
  // const closeMenu = useCallback(() => { ... }, []);
  // const applyOrInsertMarkers = useCallback((...) => { ... }, []);
  // const handleLink = useCallback(() => { ... }, []);
  // const menuActions = useMemo((): MenuAction[] => { ... }, [...]);

  return (
    <footer
      ref={footerRef}
      className="bg-gray-100 dark:bg-gray-800 p-4 mt-auto flex flex-col items-center relative"
      style={{ minHeight: '50px' }} // Réduire la hauteur min maintenant ?
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Nova Footer
      </p>
      {/* Supprimer le JSX lié à CodeMirror */}
    </footer>
  );
};

export default Footer; 