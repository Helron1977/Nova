import React from 'react';
import type { ImageBlock } from '@/application/logic/markdownParser';

interface CustomImageRendererProps {
  block: ImageBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  listIndex?: number;
  index?: number;
  [key: string]: any; // Pour props DND/data-*
}

const CustomImageRenderer = React.forwardRef<
  HTMLImageElement, // L'élément racine est <img>
  CustomImageRendererProps
>(({ 
  block, 
  style, 
  onUpdateBlockContent,
  listIndex,
  index,
  ...rest 
}, ref) => { // Utiliser ...rest
  const { src, alt, title } = block.content;

  return (
    // Appliquer seulement `rest` à <img>
    <img 
      key={block.id} 
      ref={ref} 
      style={style} 
      src={src}
      alt={alt || ''} // Fournir une chaîne vide si alt est undefined
      title={title || undefined} // Ne passer title que s'il existe
      {...rest} // Appliquer DND/data-* props
    />
  );
});

CustomImageRenderer.displayName = 'CustomImageRenderer';

export default CustomImageRenderer; 