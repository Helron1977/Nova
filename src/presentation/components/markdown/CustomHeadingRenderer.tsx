import React from 'react';
import type { HeadingBlock } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';

interface CustomHeadingRendererProps {
  block: HeadingBlock;
  style?: React.CSSProperties;
  // Permettre props arbitraires via [key: string]: any
  [key: string]: any;
}

const CustomHeadingRenderer = React.forwardRef<
  HTMLHeadingElement, // La ref peut être pour n'importe quel niveau de titre
  CustomHeadingRendererProps
>(({ block, style, ...rest }, ref) => { 
  const { level, children } = block.content;
  const commonProps = {
    key: block.id,
    ref: ref, // Passer la ref
    style: style,
    ...rest // Passer toutes les autres props (DND, data-*)
  };

  // Rendre la balise spécifique en fonction du niveau
  switch (level) {
    case 1: 
      return <h1 {...commonProps}>{renderInlineElements(children, block.id)}</h1>;
    case 2: 
      return <h2 {...commonProps}>{renderInlineElements(children, block.id)}</h2>;
    case 3: 
      return <h3 {...commonProps}>{renderInlineElements(children, block.id)}</h3>;
    case 4: 
      return <h4 {...commonProps}>{renderInlineElements(children, block.id)}</h4>;
    case 5: 
      return <h5 {...commonProps}>{renderInlineElements(children, block.id)}</h5>;
    case 6: 
      return <h6 {...commonProps}>{renderInlineElements(children, block.id)}</h6>;
    default:
      // Fallback ou erreur si le niveau n'est pas 1-6
      console.warn('Invalid heading level:', level);
      // Rendre un div ou p en fallback ?
      return <p {...commonProps}>{renderInlineElements(children, block.id)}</p>; 
  }
});

CustomHeadingRenderer.displayName = 'CustomHeadingRenderer';

export default CustomHeadingRenderer; 