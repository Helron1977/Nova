import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BlockquoteBlock, InlineElement, TextInline } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

interface CustomBlockquoteRendererProps {
  block: BlockquoteBlock;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  style?: React.CSSProperties;
  listIndex?: number;
  index?: number;
  onIncreaseIndentation?: (blockId: string) => void;
  onDecreaseIndentation?: (blockId: string) => void;
  [key: string]: any; // Pour props DND/data-*
}

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

const CustomBlockquoteRendererComponent = React.forwardRef<
  HTMLQuoteElement,
  CustomBlockquoteRendererProps
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
  const { id, content: { children }, metadata } = block;
  const indentationLevel = metadata?.indentationLevel;

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => ({
    ...style,
    marginLeft: indentationPadding
  }), [style, indentationPadding]);

  logger.debug(`[BlockquoteRenderer ${id}] Rendering - Indentation Level: ${indentationLevel ?? 0}, marginLeft: ${indentationPadding}`);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const rawText = getRawTextFromChildren(children);
      setEditingText(rawText);
      logger.debug(`[BlockquoteRenderer] Initializing edit for ${id} with pure text:`, rawText);
      textareaRef.current.value = rawText;
      textareaRef.current.focus();
    }
  }, [isEditing, children, id]);

  const handleDoubleClick = () => {
    logger.debug(`[BlockquoteRenderer ${id}] handleDoubleClick triggered.`);
    if (onUpdateBlockContent) {
      logger.debug(`[BlockquoteRenderer] Double click on quote ${id}. Entering edit mode.`);
      setIsEditing(true);
    } else {
      logger.warn(`[BlockquoteRenderer] Double click on quote ${id} but onUpdateBlockContent is missing.`);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    logger.debug(`[BlockquoteRenderer ${id}] handleChange called. New value:`, event.target.value);
    setEditingText(event.target.value);
  };

  const handleSave = () => {
    if (!isEditing || !onUpdateBlockContent) return;
    logger.debug(`[BlockquoteRenderer] Saving quote ${id}. Pure text:`, editingText);
    onUpdateBlockContent(id, editingText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const originalRawText = getRawTextFromChildren(children);
    setEditingText(originalRawText);
    setIsEditing(false);
    logger.debug(`[BlockquoteRenderer] Cancelling edit for quote ${id}.`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    logger.debug(`[BlockquoteRenderer ${id}] handleKeyDown triggered. Key: ${event.key}, Shift: ${event.shiftKey}`);

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault(); 
      handleCancel();
    } else if (event.key === 'Tab') {
        console.log('%c[BlockquoteRenderer %s] Tab pressed during edit.', 'color: darkblue;', id);
    }
  };

  return (
    <blockquote 
      key={block.id} 
      ref={ref} 
      style={combinedStyle}
      {...rest} 
      onDoubleClick={handleDoubleClick}
      className="relative border-l-4 border-gray-300 pl-4 italic my-4 dark:border-gray-600"
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="block w-full font-sans text-base p-1 border border-blue-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-400 dark:focus:border-blue-400 italic"
          rows={Math.max(1, editingText.split('\n').length)}
        />
      ) : (
        renderInlineElements(children, block.id)
      )}
    </blockquote>
  );
});

CustomBlockquoteRendererComponent.displayName = 'CustomBlockquoteRenderer';

export default CustomBlockquoteRendererComponent; 