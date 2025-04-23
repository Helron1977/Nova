import React, { useEffect } from 'react';
import Prism from 'prismjs';
// Importer les CSS nécessaires (peut nécessiter un ajustement du chemin/config)
// import 'prismjs/themes/prism-okaidia.css'; // Exemple de thème
// Importer les langages nécessaires
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
// ... ajouter d'autres langages si besoin

import type { CodeBlock } from '@/application/logic/markdownParser';

interface CustomCodeBlockRendererProps {
  block: CodeBlock;
  style?: React.CSSProperties;
  [key: string]: any; // Pour props DND/data-*
}

// Utiliser React.forwardRef
const CustomCodeBlockRenderer = React.forwardRef<
  HTMLPreElement, // Type de l'élément DOM racine (pre)
  CustomCodeBlockRendererProps
>(({ block, style, ...rest }, ref) => {
  const { language, code } = block.content;
  const langClass = language ? `language-${language}` : 'language-plain';

  useEffect(() => {
    // Lancer Prism après le rendu ou une mise à jour
    Prism.highlightAll();
  }, [code, language]); // Relancer si le code ou le langage change

  return (
    <pre 
      key={block.id} 
      ref={ref} 
      style={style} 
      className={`${langClass} relative group`} // Ajouter la classe de langage pour Prism
      {...rest} // Appliquer DND/data-* props
    >
      <code className={langClass}>
        {code}
      </code>
      {/* Optionnel : Bouton Copier */}
      <button 
        onClick={() => navigator.clipboard.writeText(code)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-gray-700 text-white text-xs px-2 py-1 rounded transition-opacity"
        title="Copier le code"
       >
         Copier
       </button>
    </pre>
  );
});

CustomCodeBlockRenderer.displayName = 'CustomCodeBlockRenderer';

export default CustomCodeBlockRenderer; 