import React, { useState, useEffect, useRef } from 'react';
import type { CodeBlock, MermaidBlock } from '@/application/logic/markdownParser';
import MermaidDiagram from './MermaidDiagram';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

interface CustomCodeRendererProps {
  block: CodeBlock | MermaidBlock;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  [key: string]: any; // Pour les props DND etc.
}

const CustomCodeRenderer: React.FC<CustomCodeRendererProps> = ({ block, onUpdateBlockContent, ...rest }) => {
  const { id } = block;
  const { code } = block.content;
  const language = block.type === 'code' ? block.content.language : 'mermaid';

  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (block.type === 'code' && isEditing && textareaRef.current) {
      const lang = block.content.language || '';
      const rawText = `\`\`\`${lang}\n${block.content.code}\n\`\`\``;
      setEditingText(rawText);
      logger.debug(`[CustomCodeRenderer] Initializing edit for code block ${id} with raw text:`, rawText);
      textareaRef.current.value = rawText;
      textareaRef.current.focus();
    }
  }, [isEditing, block]);

  const handleDoubleClick = () => {
    if (block.type === 'code' && onUpdateBlockContent) {
      logger.debug(`[CustomCodeRenderer] Double click on code block ${id}. Entering edit mode.`);
      setIsEditing(true);
    } else if (block.type === 'code') {
      logger.warn(`[CustomCodeRenderer] Double click on code block ${id} but onUpdateBlockContent is missing.`);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingText(event.target.value);
  };

  const handleSave = () => {
    if (!isEditing || block.type !== 'code' || !onUpdateBlockContent) return;
    logger.debug(`[CustomCodeRenderer] Saving code block ${id}. New raw text:`, editingText);
    onUpdateBlockContent(id, editingText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (block.type !== 'code') return;
    const lang = block.content.language || '';
    const originalRawText = `\`\`\`${lang}\n${block.content.code}\n\`\`\``;
    setEditingText(originalRawText);
    setIsEditing(false);
    logger.debug(`[CustomCodeRenderer] Cancelling edit for code block ${id}.`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  };

  if (block.type === 'mermaid') {
    return <MermaidDiagram code={code} {...rest} />;
  }

  const className = language ? `language-${language}` : undefined;

  return (
    <pre {...rest} onDoubleClick={handleDoubleClick} className="relative">
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editingText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="block w-full font-mono text-sm p-2 border border-blue-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-400 dark:focus:border-blue-400"
          rows={editingText.split('\n').length + 1}
        />
      ) : (
        <code className={className}>{code}</code>
      )}
    </pre>
  );
};

export default CustomCodeRenderer; 