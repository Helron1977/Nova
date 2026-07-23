import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ImageBlock, ParagraphBlock, Block } from '@/application/logic/markdownParser';
import Tesseract from 'tesseract.js';
import { v4 as uuidv4 } from 'uuid';
import { ScanText, Loader2 } from 'lucide-react';


import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomImageRendererProps {
  block: ImageBlock;
  style?: React.CSSProperties;
  listIndex?: number;
  index?: number;
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
  listIndex,
  index,
  ...rest 
}, ref) => {
  const { activeBlockId, setActiveBlockId, updateBlock, addBlockAfter } = useEditorCommands();
  const isEditing = activeBlockId === block.id;

  const { url: src, alt, title } = block.content;
  const { metadata } = block;
  const indentationLevel = metadata?.indentationLevel;

  // --- State pour l'édition ---
  const [editUrl, setEditUrl] = useState(src || ''); // Initialiser avec src ou vide
  const inputRef = useRef<HTMLInputElement>(null); // Ref pour focus l'input
  
  const [isOCRRunning, setIsOCRRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  // --- Fin State --- 

  // Initialiser/réinitialiser editUrl
  useEffect(() => {
    if (!isEditing) {
      setEditUrl(src || '');
      // Activer le passage automatique en mode édition si src est vide - DÉCOMMENTÉ
      if (!src) {
          setActiveBlockId(block.id);
      }
    } else {
      // Garder le focus/select quand on entre manuellement en édition
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, src]);

  const handleClick = useCallback(() => {
    setActiveBlockId(block.id);
  }, [setActiveBlockId, block.id]);

  const handleSave = useCallback(() => {
    const newMarkdown = buildImageMarkdown(editUrl, alt, title);
    console.log('[CustomImageRenderer] Saving Markdown:', newMarkdown);
    updateBlock(block.id, block, { type: 'UPDATE_SOURCE_FOR_MODULE', newRawSource: newMarkdown, moduleType: 'image' });
    setActiveBlockId(null);
  }, [editUrl, alt, title, block.id, updateBlock, block, setActiveBlockId]);

  const handleCancel = useCallback(() => {
    setEditUrl(src || ''); // Réinitialiser à la valeur originale
    setActiveBlockId(null);
  }, [src, setActiveBlockId]);

  const handleOCR = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src || isOCRRunning) return;
    
    setIsOCRRunning(true);
    setOcrProgress('Initialisation OCR...');
    
    try {
      const result = await Tesseract.recognize(src, 'fra', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(`Analyse: ${Math.round(m.progress * 100)}%`);
          } else {
            setOcrProgress(m.status);
          }
        }
      });
      
      const text = result.data.text.trim();
      
      if (text) {
          const newBlock: ParagraphBlock = {
              id: uuidv4(),
              type: 'paragraph',
              content: { children: [{ type: 'text', value: text, rawMarkdown: text }] },
              metadata: { indentationLevel },
              rawMarkdown: text
          };
          addBlockAfter({ afterId: block.id, newBlock: newBlock as Block });
      }
    } catch (err) {
      console.error('OCR Error', err);
      setOcrProgress('Erreur OCR');
      setTimeout(() => setOcrProgress(''), 3000);
    } finally {
      setIsOCRRunning(false);
      setTimeout(() => setOcrProgress(''), 2000);
    }
  }, [src, addBlockAfter, isOCRRunning, indentationLevel, block.id]);

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
        <div className="relative inline-block group" style={{ maxWidth: '100%' }}>
            <img 
              key={block.id}
              src={src || './placeholder.png'}
              alt={alt || 'Image (cliquez pour modifier l\'URL)'} 
              title={title || (src ? undefined : "Cliquez pour définir l\'URL")}
              style={{ cursor: 'pointer', maxWidth: '100%' }}
              onClick={handleClick}
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.src = './placeholder.png'; }}
            />
            {src && (
              <button 
                onClick={handleOCR}
                disabled={isOCRRunning}
                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 backdrop-blur-sm"
                title="Extraire le texte (OCR)"
              >
                  {isOCRRunning ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs whitespace-nowrap">{ocrProgress}</span>
                      </>
                  ) : (
                      <>
                        <ScanText size={16} />
                        <span className="text-xs font-medium">Extraire le texte</span>
                      </>
                  )}
              </button>
            )}
        </div>
      )}
    </div>
  );
});

CustomImageRenderer.displayName = 'CustomImageRenderer';

export default CustomImageRenderer; 