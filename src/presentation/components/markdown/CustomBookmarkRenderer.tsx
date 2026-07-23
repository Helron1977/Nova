import React, { useMemo } from 'react';
import type { BookmarkBlock } from '@/application/logic/markdownParser';
import Microlink from '@microlink/react';

interface CustomBookmarkRendererProps {
  block: BookmarkBlock;
  style?: React.CSSProperties;
}

export const CustomBookmarkRenderer: React.FC<CustomBookmarkRendererProps> = ({ block, style }) => {
  const { url } = block.content;
  const indentationLevel = block.metadata?.indentationLevel ?? 0;
  
  const combinedStyle = useMemo(() => ({
    ...style,
    marginLeft: indentationLevel > 0 ? `${indentationLevel * 1.5}rem` : '0rem'
  }), [style, indentationLevel]);

  return (
    <div 
      style={combinedStyle} 
      className="my-4 w-full flex justify-center" 
      title="Double-cliquer pour éditer l'URL (texte brut)"
    >
      <div className="w-full max-w-3xl">
        <Microlink 
          url={url} 
          size="large"
          style={{ width: '100%', borderRadius: '0.5rem', fontFamily: 'inherit' }}
        />
      </div>
    </div>
  );
};

export default CustomBookmarkRenderer;
