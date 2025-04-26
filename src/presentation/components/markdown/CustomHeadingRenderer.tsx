import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { HeadingBlock, InlineElement, TextInline } from '@/application/logic/markdownParser';
import remarkGfm from 'remark-gfm';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Instancier le logger
const logger = new PinoLogger();

interface CustomHeadingRendererProps {
  block: HeadingBlock;
  onUpdateBlockContent: (blockId: string, newText: string) => void;
  // Retirer style et rest car non utilisés ici
  // style?: React.CSSProperties;
  // [key: string]: any;
}

// Fonction récursive pour extraire le texte brut (devrait être externalisée)
const getRawTextFromChildren = (children: InlineElement[] | undefined): string => {
  if (!Array.isArray(children)) return '';
  return children.map(child => {
    switch (child?.type) {
      case 'text':
      case 'inlineCode':
      case 'html':
        return (child as TextInline).value || '';
      case 'strong':
      case 'emphasis':
      case 'delete':
      case 'link':
        return child.children ? getRawTextFromChildren(child.children) : '';
      default:
        return '';
    }
  }).join('');
};

// << MODIFIÉ: Implémentation de l'édition "texte pur" >>
const CustomHeadingRenderer: React.FC<CustomHeadingRendererProps> = ({ block, onUpdateBlockContent }) => {
  const { id, content: { level, children }, metadata } = block;
  const indentationLevel = metadata?.indentationLevel;

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Initialiser avec le texte pur SANS préfixe
      const rawText = getRawTextFromChildren(children);
      setEditingText(rawText);
      logger.debug(`[CustomHeadingRenderer] Initializing edit for ${id} with pure text: "${rawText}"`);
      inputRef.current.value = rawText; // Assigner la valeur pure
      inputRef.current.focus();
      inputRef.current.select();
    }
    // Retirer `level` des dépendances car il n'affecte plus l'init
  }, [isEditing, children, id]); 

  const handleDoubleClick = () => {
    logger.debug(`[CustomHeadingRenderer] Double click on heading ${id}. Entering edit mode.`);
    setIsEditing(true);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingText(event.target.value);
  };

  const handleSave = () => {
    if (!isEditing || !onUpdateBlockContent) return; 
    logger.debug(`[CustomHeadingRenderer] Saving heading ${id}. Pure text: "${editingText}"`);
    onUpdateBlockContent(id, editingText); 
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      logger.debug("[CustomHeadingRenderer] Enter key pressed, saving.");
      handleSave();
      event.preventDefault(); 
    } else if (event.key === 'Escape') {
      logger.debug("[CustomHeadingRenderer] Escape key pressed, cancelling edit.");
      // Restaurer le texte pur SANS préfixe
      const originalRawText = getRawTextFromChildren(children);
      setEditingText(originalRawText); 
      setIsEditing(false);
      event.preventDefault();
    }
  };

  // Calculer le padding basé sur l'indentation
  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  // Contenu pour l'affichage (non-édition)
  const markdownContent = getRawTextFromChildren(children);

  return (
    <div 
      className="my-1 py-1" 
      onClick={handleDoubleClick} 
      title="Cliquez pour modifier"
      style={{ paddingLeft: indentationPadding }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editingText} // Utiliser `value` contrôlée
          onChange={handleChange}
          onBlur={handleSave} 
          onKeyDown={handleKeyDown} 
          className={`w-full px-1 py-0.5 rounded border border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 \
                     font-sans text-base 
                     ${level === 1 ? 'text-3xl font-bold' : ''} \
                     ${level === 2 ? 'text-2xl font-semibold' : ''} \
                     ${level === 3 ? 'text-xl font-medium' : ''} \
                     ${level >= 4 ? 'text-lg font-normal' : ''} \
                     `} 
          style={{ 
              fontSize: level === 1 ? '1.875rem' : level === 2 ? '1.5rem' : level === 3 ? '1.25rem' : '1.125rem',
              fontWeight: level === 1 ? '700' : level === 2 ? '600' : level === 3 ? '500' : '400',
              lineHeight: level === 1 ? '2.25rem' : level === 2 ? '2rem' : level === 3 ? '1.75rem' : '1.75rem',
          }}
        />
      ) : (
        React.createElement(
          `h${level}`,
          {},
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdownContent}
          </ReactMarkdown>
        )
      )}
    </div>
  );
};

CustomHeadingRenderer.displayName = 'CustomHeadingRenderer';

export default CustomHeadingRenderer; 