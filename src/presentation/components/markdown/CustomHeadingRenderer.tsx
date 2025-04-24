import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { HeadingBlock, InlineElement, TextInline } from '@/application/logic/markdownParser';
import remarkGfm from 'remark-gfm';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Instancier le logger
const logger = new PinoLogger();

interface CustomHeadingRendererProps {
  block: HeadingBlock;
  onUpdateBlockContent: (blockId: string, newText: string) => void;
  style?: React.CSSProperties;
  // Permettre props arbitraires via [key: string]: any
  [key: string]: any;
}

// Fonction récursive pour extraire le texte brut
const getRawTextFromChildren = (children: InlineElement[]): string => {
  return children.map(child => {
    switch (child.type) {
      case 'text':
      case 'inlineCode':
      case 'html': // Considérer le HTML comme du texte pour l'édition brute
        return (child as TextInline).value || ''; // Accès sûr à value
      case 'strong':
      case 'emphasis':
      case 'delete':
      case 'link': // Pour les liens, extraire le texte des enfants
        // Assurer que child.children existe et est un tableau avant récursion
        return child.children ? getRawTextFromChildren(child.children) : '';
      default:
        // Ignorer les autres types ou logger un avertissement si nécessaire
        // logger.warn(`[getRawTextFromChildren] Unhandled inline type: ${child.type}`);
        return '';
    }
  }).join('');
};

const CustomHeadingRenderer: React.FC<CustomHeadingRendererProps> = ({ block, onUpdateBlockContent, style, ...rest }) => {
  const { id, content: { level, children } } = block;

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const rawText = getRawTextFromChildren(children);
      const prefix = '#'.repeat(level) + ' ';
      const fullRawText = prefix + rawText;
      setEditingText(fullRawText);
      logger.debug(`[CustomHeadingRenderer] Initializing edit for ${id} with raw text: "${fullRawText}"`);
      inputRef.current.value = fullRawText;
      inputRef.current.select();
    }
  }, [isEditing, children, level, id]);

  const handleDoubleClick = () => {
    logger.debug(`[CustomHeadingRenderer] Double click on heading ${id}. Entering edit mode.`);
    setIsEditing(true);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingText(event.target.value);
  };

  const handleSave = () => {
    if (!isEditing) return;
    logger.debug(`[CustomHeadingRenderer] Saving heading ${id}. New raw text: "${editingText}"`);
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
      const originalRawText = '#'.repeat(level) + ' ' + getRawTextFromChildren(children);
      setEditingText(originalRawText);
      setIsEditing(false);
      event.preventDefault();
    }
  };

  const markdownContent = getRawTextFromChildren(children);

  return (
    <div className="my-1 py-1" onDoubleClick={handleDoubleClick}>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          defaultValue={editingText}
          onChange={handleChange}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`w-full px-1 py-0.5 rounded border border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 \
                     font-sans text-base // Styles pour ressembler au rendu normal autant que possible
                     ${level === 1 ? 'text-3xl font-bold' : ''} \
                     ${level === 2 ? 'text-2xl font-semibold' : ''} \
                     ${level === 3 ? 'text-xl font-medium' : ''} \
                     ${level >= 4 ? 'text-lg font-normal' : ''} \
                     `} // Appliquer les styles de base + heading
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