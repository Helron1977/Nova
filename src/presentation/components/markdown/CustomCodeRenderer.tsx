import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { CodeBlock, MermaidBlock } from '@/application/logic/markdownParser';
import MermaidDiagram from './MermaidDiagram';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

interface CustomCodeRendererProps {
  block: CodeBlock | MermaidBlock;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  listIndex: number;
  index: number;
  onIncreaseIndentation?: (blockId: string) => void;
  onDecreaseIndentation?: (blockId: string) => void;
  [key: string]: any; // Pour les props DND etc.
}

const CustomCodeRenderer: React.FC<CustomCodeRendererProps> = ({ 
  block, 
  onUpdateBlockContent, 
  listIndex,
  index, 
  onIncreaseIndentation,
  onDecreaseIndentation,
  ...rest 
}) => {
  const { id, metadata } = block;
  const code = block.content?.code || '';
  const language = block.type === 'code' ? block.content?.language : 'mermaid';
  const indentationLevel = metadata?.indentationLevel;
  logger.debug(`[CustomCodeRenderer ${id}] Received indentationLevel: ${indentationLevel}`);

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (block.type === 'code' && isEditing && textareaRef.current && typeof block.content?.code === 'string') {
      const pureCode = block.content.code;
      setEditingText(pureCode);
      logger.debug(`[CustomCodeRenderer] Initializing edit for code block ${id} with pure code:`, pureCode);
      textareaRef.current.value = pureCode;
      textareaRef.current.focus();
    }
  }, [isEditing, block]);

  const handleDoubleClick = () => {
    logger.debug(`[CustomCodeRenderer ${id}] handleDoubleClick triggered.`);
    if (block.type === 'code') {
      logger.debug(`[CustomCodeRenderer] Double click on code block ${id}. Entering edit mode.`);
      setIsEditing(true);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    logger.debug(`[CustomCodeRenderer ${id}] handleChange called. New value:`, event.target.value);
    setEditingText(event.target.value);
  };

  const handleSave = () => {
    if (!isEditing || block.type !== 'code' || !onUpdateBlockContent) return;
    logger.debug(`[CustomCodeRenderer] Saving code block ${id}. Pure code:`, editingText);
    onUpdateBlockContent(id, editingText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (block.type !== 'code' || typeof block.content?.code !== 'string') return;
    const originalPureCode = block.content.code;
    setEditingText(originalPureCode);
    setIsEditing(false);
    logger.debug(`[CustomCodeRenderer] Cancelling edit for code block ${id}.`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    logger.debug(`[CustomCodeRenderer ${id}] handleKeyDown triggered. Key: ${event.key}, Shift: ${event.shiftKey}, Ctrl/Meta: ${event.ctrlKey || event.metaKey}`);

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        if (onDecreaseIndentation) {
          logger.debug(`[CustomCodeRenderer ${id}] Shift-Tab pressed. Calling onDecreaseIndentation.`);
          onDecreaseIndentation(id);
        } else {
          logger.warn(`[CustomCodeRenderer ${id}] Shift-Tab pressed but no onDecreaseIndentation handler.`);
        }
      } else {
        if (onIncreaseIndentation) {
          logger.debug(`[CustomCodeRenderer ${id}] Tab pressed. Calling onIncreaseIndentation.`);
          onIncreaseIndentation(id);
        } else {
          logger.warn(`[CustomCodeRenderer ${id}] Tab pressed but no onIncreaseIndentation handler.`);
        }
      }
    }
  };

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    const padding = level > 0 ? `${level * 1.5}rem` : '0rem';
    logger.debug(`[CustomCodeRenderer ${id}] Calculated indentationPadding: ${padding} (from level ${level})`);
    return padding;
  }, [indentationLevel, id]);

  const combinedStyle = useMemo(() => ({
    marginLeft: indentationPadding,
    width: '100%',
    position: 'relative' as const,
  }), [indentationPadding]);

  if (block.type === 'mermaid') {
    return (
      <div style={combinedStyle}>
        <MermaidDiagram code={typeof code === 'string' ? code : ''} {...rest} />
      </div>
    );
  }

  const className = language ? `language-${language}` : undefined;

  return (
    <pre {...rest} style={combinedStyle} onDoubleClick={handleDoubleClick} className="relative">
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="block w-full font-mono text-sm p-2 border border-blue-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-400 dark:focus:border-blue-400"
          rows={Math.max(3, editingText.split('\n').length)}
        />
      ) : (
        <code className={className}>{typeof code === 'string' ? code : ''}</code>
      )}
    </pre>
  );
};

export default CustomCodeRenderer; 