import React, { useState } from 'react';
import type { ParagraphBlock, InlineElement } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Instancier le logger au niveau du module
const logger = new PinoLogger();

interface CustomParagraphRendererProps {
  block: ParagraphBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  [key: string]: any;
}

// Fonction améliorée pour extraire le texte brut
const extractRawText = (elements: InlineElement[] | undefined): string => {
  if (!Array.isArray(elements)) {
    logger.warn('[extractRawText] Received non-array elements:', elements);
    return '';
  }

  return elements.map((el, index) => {
    logger.debug(`[extractRawText] Processing element ${index}:`, el);

    if (typeof el === 'string') {
      logger.debug(`[extractRawText] Element ${index} is string:`, el);
      return el;
    } else if (el && typeof el === 'object') {
      if ('type' in el && el.type === 'text' && 'value' in el && typeof el.value === 'string') {
        logger.debug(`[extractRawText] Element ${index} is text node:`, el.value);
        return el.value;
      } else if ('children' in el && Array.isArray(el.children)) {
        logger.debug(`[extractRawText] Element ${index} has children, recursing...`);
        return extractRawText(el.children);
      } else {
        logger.debug(`[extractRawText] Element ${index} is unhandled object type:`, el);
        return '';
      }
    } else {
      logger.debug(`[extractRawText] Element ${index} is unexpected type:`, el);
      return '';
    }
  }).join('');
};

const CustomParagraphRendererComponent = React.forwardRef<
  HTMLDivElement,
  CustomParagraphRendererProps
>(({ block, style, onUpdateBlockContent, ...rest }, ref) => {
  const { children } = block.content;
  const [isEditing, setIsEditing] = useState(false);
  
  React.useEffect(() => {
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Initial children:`, children);
    const initialText = extractRawText(children);
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Extracted initial text:`, initialText);
    setEditText(initialText); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editText, setEditText] = useState(() => {
    const text = extractRawText(children);
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Initializing state with text:`, text);
    return text;
  });

  const handleDoubleClick = () => {
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Entering edit mode. Current editText:`, editText);
    setIsEditing(true);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(event.target.value);
  };

  const handleSave = () => {
    logger.log('Sauvegarde demandée pour', block.id, 'avec texte:', editText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const originalText = extractRawText(children);
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Cancelling edit. Resetting text to:`, originalText);
    setEditText(originalText); 
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  logger.debug(`[CustomParagraphRenderer - ${block.id}] Rendering - isEditing: ${isEditing}, editText: ${editText}`);

  return (
    <div ref={ref} style={style} {...rest}>
      {isEditing ? (
        <div>
          <textarea
            value={editText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={Math.max(3, editText.split('\n').length)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            autoFocus
          />
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleSave} 
              className="px-3 py-1 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800 transition-colors duration-150"
            >
                Sauvegarder
            </button>
            <button 
              onClick={handleCancel} 
              className="px-3 py-1 rounded-md text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-800 transition-colors duration-150"
            >
                Annuler
            </button>
          </div>
        </div>
      ) : (
        <p 
          key={block.id}
          onDoubleClick={handleDoubleClick}
          title="Double-cliquez pour modifier"
        >
          {renderInlineElements(children, block.id)}
        </p>
      )}
    </div>
  );
});

CustomParagraphRendererComponent.displayName = 'CustomParagraphRenderer';

const MemoizedCustomParagraphRenderer = React.memo(CustomParagraphRendererComponent);

export default MemoizedCustomParagraphRenderer; 