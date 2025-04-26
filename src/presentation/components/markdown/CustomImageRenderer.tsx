import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ImageBlock } from '@/application/logic/markdownParser';


interface CustomImageRendererProps {
  block: ImageBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newMarkdown: string) => void;
  listIndex?: number;
  index?: number;
  onIncreaseIndentation?: (blockId: string) => void;
  onDecreaseIndentation?: (blockId: string) => void;
  [key: string]: any; // Pour props DND/data-*
}

// Helper pour reconstruire le Markdown de l'image
const buildImageMarkdown = (src: string, alt?: string, title?: string): string => {
  const altText = alt || '';
  const titlePart = title ? ` "${title}"` : '';
  return `![${altText}](${src}${titlePart})`;
};

const CustomImageRenderer = React.forwardRef<
  HTMLDivElement, // L'élément racine sera maintenant un div
  CustomImageRendererProps
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
  const { src, alt, title } = block.content;
  const { metadata } = block;
  const indentationLevel = metadata?.indentationLevel;

  // --- State pour l'édition ---
  const [isEditing, setIsEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(src || ''); // Initialiser avec src ou vide
  const inputRef = useRef<HTMLInputElement>(null); // Ref pour focus l'input
  // --- Fin State --- 

  // Initialiser/réinitialiser editUrl
  useEffect(() => {
    if (!isEditing) {
      setEditUrl(src || '');
      // Supprimer le passage automatique en mode édition
      // if (!src) {
      //     setIsEditing(true);
      // }
    } else {
      // Garder le focus/select quand on entre manuellement en édition
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, src]);

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(() => {
    if (onUpdateBlockContent) {
      const newMarkdown = buildImageMarkdown(editUrl, alt, title);
      onUpdateBlockContent(block.id, newMarkdown);
    }
    setIsEditing(false);
  }, [editUrl, alt, title, block.id, onUpdateBlockContent]);

  const handleCancel = useCallback(() => {
    setEditUrl(src || ''); // Réinitialiser à la valeur originale
    setIsEditing(false);
  }, [src]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditUrl(event.target.value);
  };

  // Gérer Enter/Escape dans l'input
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
          handleSave();
      } else if (event.key === 'Escape') {
          handleCancel();
      } else if (event.key === 'Tab') {
          console.log('%c[CustomImageRenderer %s] %s pressed during edit.', 'color: darkblue;', block.id, event.shiftKey ? 'Shift-Tab' : 'Tab');
          // logger.debug(`[CustomImageRenderer ${block.id}] ${event.shiftKey ? 'Shift-Tab' : 'Tab'} pressed during edit.`);
          // Le comportement par défaut (changer de focus) est probablement OK ici.
          // event.preventDefault(); 
      }
  };

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => ({
    ...style,
    marginLeft: indentationPadding
  }), [style, indentationPadding]);

  const inputStyle: React.CSSProperties = {
      border: '1px solid #ccc',
      padding: '4px',
      marginRight: '5px',
      flexGrow: 1, // Prend l'espace restant
  };

  const buttonStyle: React.CSSProperties = {
      border: '1px solid #ccc',
      padding: '4px 8px',
      cursor: 'pointer',
  };

  return (
    <div ref={ref} style={combinedStyle} {...rest}>
      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input 
            ref={inputRef}
            type="text"
            value={editUrl}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="URL de l'image"
            style={inputStyle}
          />
          <button onClick={handleSave} style={{...buttonStyle, marginRight: '5px'}}>Valider</button>
          <button onClick={handleCancel} style={buttonStyle}>Annuler</button>
        </div>
      ) : (
        <img 
          key={block.id}
          src={src || './placeholder.png'}
          alt={alt || 'Image (cliquez pour modifier l\'URL)'} 
          title={title || (src ? undefined : "Cliquez pour définir l\'URL")}
          style={{ cursor: 'pointer', maxWidth: '100%' }}
          onClick={handleClick}
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.src = './placeholder.png'; }}
        />
      )}
    </div>
  );
});

CustomImageRenderer.displayName = 'CustomImageRenderer';

export default CustomImageRenderer; 