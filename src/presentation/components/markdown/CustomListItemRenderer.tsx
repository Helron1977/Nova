import React, { useState, useEffect, useRef } from 'react';
import type { ListItemBlock, InlineElement, TextInline } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

interface CustomListItemRendererProps {
  block: ListItemBlock;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  listIndex?: number;
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

const CustomListItemRenderer: React.FC<CustomListItemRendererProps> = ({ block, onUpdateBlockContent, listIndex }) => {
  const { id, content: { children }, metadata } = block;
  const { checked, ordered, depth } = metadata;

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const rawText = getRawTextFromChildren(children);
      setEditingText(rawText);
      logger.debug(`[ListItemRenderer] Initializing edit for ${id} with pure text:`, rawText);
      textareaRef.current.value = rawText;
      textareaRef.current.focus();
    }
  }, [isEditing, children, id]);

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
    logger.debug(`[ListItemRenderer] Saving item ${id}. Pure text:`, editingText);
    onUpdateBlockContent(id, editingText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const originalRawText = getRawTextFromChildren(children);
    setEditingText(originalRawText);
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
    event.stopPropagation();
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
      <div key={id} className="editing-list-item">
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSave} 
          className="block w-full font-sans text-base p-1 border border-blue-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-400 dark:focus:border-blue-400"
          rows={Math.max(1, editingText.split('\n').length)}
        />
      </div>
    );
  }

  let marker = '•';
  if (ordered) {
    if (listIndex !== undefined) {
      if (depth === 0) {
        marker = `${listIndex + 1}.`;
      } else if (depth === 1) {
        marker = `${String.fromCharCode(97 + listIndex)}.`;
      } else {
        const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
        marker = `${romanNumerals[listIndex] || listIndex + 1}.`;
      }
    } else {
      marker = '1.';
    }
  }

  const renderedChildren = renderInlineElements(children, block.id);
  let contentWithMarker;

  let checkboxElement: React.ReactNode = null;
  if (checked === true || checked === false) {
    checkboxElement = (
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
        className="mr-2 align-middle cursor-pointer mt-1"
      />
    );
  }

  let mainContent = renderedChildren;
  if (checked === true) {
    mainContent = <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{renderedChildren}</span>;
  }

  contentWithMarker = (
    <div className="flex items-center">
      {!checkboxElement && <span className="mr-2 list-marker">{marker}</span>}
      {checkboxElement}
      <div 
        className="list-item-main-content flex-1"
        onDoubleClick={handleDoubleClick}
        title="Double-cliquez pour modifier"
      >
        {mainContent}
      </div>
    </div>
  );

  return (
    <div 
      key={id}
      className="list-item-content"
      // Applique un padding à gauche pour l'indentation visuelle des éléments de liste imbriqués.
      // Chaque niveau de profondeur (depth) ajoute 1.5rem de padding.
      style={{ paddingLeft: `${(depth || 0) * 1.5}rem` }}
    >
      {contentWithMarker}
    </div>
  );
};

export default CustomListItemRenderer; 