import React from 'react';
import type { BlockquoteBlock } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';

interface CustomBlockquoteRendererProps {
  block: BlockquoteBlock;
  style?: React.CSSProperties;
  [key: string]: any; // Pour props DND/data-*
}

// Utiliser React.forwardRef
const CustomBlockquoteRenderer = React.forwardRef<
  HTMLQuoteElement, // Type de l'élément DOM racine (blockquote)
  CustomBlockquoteRendererProps
>(({ block, style, ...rest }, ref) => {
  const { children } = block.content;

  // La préservation des sauts de ligne peut nécessiter une gestion plus complexe
  // si le contenu du blockquote peut être autre chose que du simple texte.
  // Pour l'instant, on affiche le texte brut.
  return (
    <blockquote 
      key={block.id} 
      ref={ref} 
      style={style} 
      {...rest}
    >
      {renderInlineElements(children, block.id)}
    </blockquote>
  );
});

CustomBlockquoteRenderer.displayName = 'CustomBlockquoteRenderer';

export default CustomBlockquoteRenderer; 