import React, { useState, useEffect, useMemo } from 'react';
import type { ParagraphBlock, InlineElement } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Instancier le logger au niveau du module
const logger = new PinoLogger();

interface CustomParagraphRendererProps {
  block: ParagraphBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  listIndex?: number;
  index?: number;
  onIncreaseIndentation?: (blockId: string) => void;
  onDecreaseIndentation?: (blockId: string) => void;
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
>(({ block, style, onUpdateBlockContent, listIndex, index, onIncreaseIndentation, onDecreaseIndentation, ...rest }, ref) => {
  const { children } = block.content;
  const { indentationLevel } = block.metadata;
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    logger.debug(`[CustomParagraphRenderer - ${block.id}] useEffect triggered. Children:`, children);
    const currentText = extractRawText(children);
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Extracted text from children:`, currentText);
    setEditText(currentText); 
  }, [children, block.id]);

  const [editText, setEditText] = useState('');

  const handleDoubleClick = () => {
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Entering edit mode. Current editText:`, editText);
    setIsEditing(true);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(event.target.value);
  };

  const handleSave = () => {
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Saving text:`, editText);
    if (onUpdateBlockContent) {
      logger.debug(`[CustomParagraphRenderer - ${block.id}] Calling onUpdateBlockContent.`);
      onUpdateBlockContent(block.id, editText);
    } else {
      logger.warn(`[CustomParagraphRenderer - ${block.id}] onUpdateBlockContent is not defined. Cannot save changes.`);
    }
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
    } else if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
            if (onDecreaseIndentation) {
                logger.debug(`[CustomParagraphRenderer - ${block.id}] Shift+Tab detected. Calling onDecreaseIndentation.`);
                onDecreaseIndentation(block.id);
            } else {
                logger.warn(`[CustomParagraphRenderer - ${block.id}] onDecreaseIndentation is not defined.`);
            }
        } else {
            if (onIncreaseIndentation) {
                logger.debug(`[CustomParagraphRenderer - ${block.id}] Tab detected. Calling onIncreaseIndentation.`);
                onIncreaseIndentation(block.id);
            } else {
                logger.warn(`[CustomParagraphRenderer - ${block.id}] onIncreaseIndentation is not defined.`);
            }
        }
    }
  };

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    if (level > 0) {
        return `${level * 1.5}rem`;
    } 
    return '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => ({ 
      ...style, 
      paddingLeft: indentationPadding 
  }), [style, indentationPadding]);

  logger.debug(`[CustomParagraphRenderer - ${block.id}] Rendering - Indentation Level: ${indentationLevel ?? 0}, Padding: ${indentationPadding}`);

  return (
    <div ref={ref} style={combinedStyle} {...rest}>
      {isEditing ? (
        <textarea
            value={editText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            rows={Math.max(3, editText.split('\n').length)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            autoFocus
        />
      ) : (
        <p 
          key={block.id}
          onDoubleClick={handleDoubleClick}
          title="Double-cliquez pour modifier"
          className={`ml-[${indentationPadding}]!`}
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