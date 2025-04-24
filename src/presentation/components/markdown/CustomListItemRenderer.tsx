import React, { useState, useEffect, useRef } from 'react';
import type { ListItemBlock, InlineElement, TextInline } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

interface CustomListItemRendererProps {
  block: ListItemBlock;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  style?: React.CSSProperties;
  [key: string]: any;
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

const buildListPrefix = (block: ListItemBlock): string => {
  const indentation = '  '.repeat(block.metadata.depth || 0);
  const marker = block.metadata.ordered ? '1. ' : '- ';
  let checkbox = '';
  if (block.metadata.checked === true) {
    checkbox = '[x] ';
  } else if (block.metadata.checked === false) {
    checkbox = '[ ] ';
  }
  return `${indentation}${marker}${checkbox}`;
};

const CustomListItemRendererComponent = React.forwardRef<
  HTMLLIElement,
  CustomListItemRendererProps
>(({ block, style, onUpdateBlockContent, ...rest }, ref) => {
  const { id, content: { children }, metadata } = block;
  const { checked } = metadata;

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const rawText = getRawTextFromChildren(children);
      const prefix = buildListPrefix(block);
      const fullRawText = prefix + rawText;
      setEditingText(fullRawText);
      logger.debug(`[ListItemRenderer] Initializing edit for ${id} with full text:`, fullRawText);
      textareaRef.current.value = fullRawText;
      textareaRef.current.focus();
    }
  }, [isEditing, block, children]);

  const handleDoubleClick = () => {
    if (onUpdateBlockContent) {
      logger.debug(`[ListItemRenderer] Double click on item ${id}. Entering edit mode.`);
      setIsEditing(true);
    } else {
      logger.warn(`[ListItemRenderer] Double click on item ${id} but onUpdateBlockContent is missing.`);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingText(event.target.value);
  };

  const handleSave = () => {
    if (!isEditing || !onUpdateBlockContent) return;
    logger.debug(`[ListItemRenderer] Saving item ${id}. New raw text:`, editingText);
    onUpdateBlockContent(id, editingText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const rawText = getRawTextFromChildren(children);
    const originalPrefix = buildListPrefix(block);
    const originalFullRawText = originalPrefix + rawText;
    setEditingText(originalFullRawText);
    setIsEditing(false);
    logger.debug(`[ListItemRenderer] Cancelling edit for item ${id}.`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault(); 
      handleCancel();
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCheckedState = event.target.checked;
    logger.debug(`[ListItemRenderer] Checkbox for item ${id} changed to: ${newCheckedState}`);

    if (!onUpdateBlockContent) {
      logger.warn(`[ListItemRenderer] Checkbox changed for ${id} but onUpdateBlockContent is missing.`);
      return;
    }

    const indentation = '  '.repeat(block.metadata.depth || 0); 
    const marker = block.metadata.ordered ? '1. ' : '- ';
    const newCheckboxMarker = newCheckedState ? '[x] ' : '[ ] ';
    const newPrefix = `${indentation}${marker}${newCheckboxMarker}`;

    const rawTextContent = getRawTextFromChildren(children);

    const newFullRawText = newPrefix + rawTextContent;
    logger.debug(`[ListItemRenderer] Calling onUpdateBlockContent for ${id} with new text:`, newFullRawText);

    onUpdateBlockContent(id, newFullRawText);
  };

  if (isEditing) {
    return (
      <li key={id} ref={ref} style={style} {...rest} className="relative">
        <textarea
          ref={textareaRef}
          value={editingText} 
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSave} 
          className="block w-full font-sans text-base p-1 border border-blue-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-400 dark:focus:border-blue-400"
          rows={editingText.split('\n').length}
        />
      </li>
    );
  }

  const renderedChildren = renderInlineElements(children, block.id);
  let content;
  if (checked === true) {
    content = (
      <>
        <input 
          type="checkbox" 
          checked 
          onChange={handleCheckboxChange} 
          className="mr-2 align-middle cursor-pointer"
        />
        <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{renderedChildren}</span>
      </>
    );
  } else if (checked === false) {
    content = (
      <>
        <input 
          type="checkbox" 
          checked={false}
          onChange={handleCheckboxChange} 
          className="mr-2 align-middle cursor-pointer"
        />
        {renderedChildren}
      </>
    );
  } else {
    content = renderedChildren;
  }

  return (
    <li 
      key={block.id} 
      ref={ref} 
      style={style} 
      {...rest}
      onDoubleClick={handleDoubleClick}
      title="Double-cliquez pour modifier"
    >
      {content}
    </li>
  );
});

CustomListItemRendererComponent.displayName = 'CustomListItemRenderer';

export default CustomListItemRendererComponent; 