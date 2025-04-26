import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import type { HTMLBlock } from '@/application/logic/markdownParser';

interface CustomHTMLRendererProps {
  block: HTMLBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  listIndex?: number;
  index?: number;
  onIncreaseIndentation?: (blockId: string) => void;
  onDecreaseIndentation?: (blockId: string) => void;
  [key: string]: any; // Pour props DND/data-*
}

// Utiliser React.forwardRef
const CustomHTMLRenderer = React.forwardRef<
  HTMLDivElement, // Type de l'élément DOM racine (div)
  CustomHTMLRendererProps
>(({ 
  block, 
  style, 
  onUpdateBlockContent,
  listIndex,
  index,
  onIncreaseIndentation,
  onDecreaseIndentation,
  ...rest 
}, ref) => {
  const { html } = block.content;
  const { metadata } = block;
  const indentationLevel = metadata?.indentationLevel;

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => ({
    ...style,
    marginLeft: indentationPadding
  }), [style, indentationPadding]);

  // Nettoyer le HTML avant de l'insérer
  const cleanHTML = DOMPurify.sanitize(html);

  // Utiliser le HTML nettoyé
  // Attention : Le rendu en tant que `div` peut être problématique si le HTML
  // est lui-même un bloc différent (ex: <p>, <table>). 
  // DOMPurify peut aider mais la structure peut devenir invalide (div>p).
  // Une alternative serait de ne pas l'envelopper ou d'utiliser Fragment,
  // mais cela peut casser le flux si plusieurs éléments racines sont présents.
  // Pour l'instant, on garde la div mais on nettoie.
  return (
    <div 
      key={block.id} 
      ref={ref} // Attacher la ref
      style={combinedStyle} // Appliquer le style DND
      {...rest} // Appliquer DND/data-* props
      dangerouslySetInnerHTML={{ __html: cleanHTML }}
    />
  );
});

CustomHTMLRenderer.displayName = 'CustomHTMLRenderer';

export default CustomHTMLRenderer; 