import React from 'react';
import type { HeadingBlock } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Instancier le logger
const logger = new PinoLogger();

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
  // Séparer la key des autres props communes
  const otherCommonProps = {
    ref: ref, // Passer la ref
    style: style,
    ...rest // Passer toutes les autres props (DND, data-*)
  };
  const key = block.id; // La clé est l'ID du bloc

  // Rendre la balise spécifique en fonction du niveau
  switch (level) {
    case 1: 
      return <h1 key={key} {...otherCommonProps}>{renderInlineElements(children, block.id)}</h1>;
    case 2: 
      return <h2 key={key} {...otherCommonProps}>{renderInlineElements(children, block.id)}</h2>;
    case 3: 
      return <h3 key={key} {...otherCommonProps}>{renderInlineElements(children, block.id)}</h3>;
    case 4: 
      return <h4 key={key} {...otherCommonProps}>{renderInlineElements(children, block.id)}</h4>;
    case 5: 
      return <h5 key={key} {...otherCommonProps}>{renderInlineElements(children, block.id)}</h5>;
    case 6: 
      return <h6 key={key} {...otherCommonProps}>{renderInlineElements(children, block.id)}</h6>;
    default:
      // Utiliser logger.warn
      logger.warn(`[CustomHeadingRenderer] Invalid heading level: ${level} for block ${key}`);
      // Rendre un div ou p en fallback ?
      return <p key={key} {...otherCommonProps}>{renderInlineElements(children, block.id)}</p>; 
  }
});

CustomHeadingRenderer.displayName = 'CustomHeadingRenderer';

export default CustomHeadingRenderer; 