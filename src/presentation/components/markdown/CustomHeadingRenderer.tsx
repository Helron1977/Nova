import React, { useState, useMemo, useCallback, forwardRef } from 'react';
import { type HeadingBlock, markdownToBlocks } from '@/application/logic/markdownParser';

import { renderInlineElements } from './InlineElementRenderer';
import { CoreBlockEditor } from '../editor/CoreBlockEditor';
import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomHeadingRendererProps {
  block: HeadingBlock;
  style?: React.CSSProperties;
  [key: string]: any;
}

const CustomHeadingRendererComponent = forwardRef<HTMLDivElement, CustomHeadingRendererProps>(({ block, style, listIndex, index, ...rest }, ref) => {
  const { activeBlockId, setActiveBlockId, updateBlock } = useEditorCommands();
  const isEditing = activeBlockId === block.id;

  const { content: { level, children, markdown, rawMarkdown }, metadata, id: blockIdForActions } = block;
  const indentationLevel = metadata?.indentationLevel ?? 0;

  const calculatedMarginLeft = useMemo(() => `${indentationLevel * 1.5}rem`, [indentationLevel]);

  const initialEditorContent = useMemo(() => {
    if (rawMarkdown && typeof rawMarkdown === 'string') return rawMarkdown;
    if (markdown && typeof markdown === 'string') return markdown;
    const renderedChildren = children.map((child: any) => child.value).join('');
    const headingPrefix = '#'.repeat(level) + ' ';
    return headingPrefix + renderedChildren;
  }, [children, level, markdown, rawMarkdown]);

  const handleEditorSave = useCallback((newContent: string) => {
    const newBlocks = markdownToBlocks(newContent);
    updateBlock(blockIdForActions, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
    setActiveBlockId(null);
  }, [updateBlock, blockIdForActions, block, setActiveBlockId]);

  const [clickCoords, setClickCoords] = useState<{ x: number, y: number } | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Si l'utilisateur est en train de sélectionner du texte, on ne passe pas en mode édition
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    
    console.log(`[CustomHeadingRenderer - ${blockIdForActions}] handleClick triggered. Event target:`, e.target);
    setClickCoords({ x: e.clientX, y: e.clientY });
    setActiveBlockId(blockIdForActions);
  }, [blockIdForActions, setActiveBlockId]);

  React.useEffect(() => {
    if (metadata?.isNewBlock && !isEditing) {
      setActiveBlockId(blockIdForActions);
      const updatedMetadata = { ...metadata };
      delete updatedMetadata.isNewBlock;
      updateBlock(blockIdForActions, block, { type: 'UPDATE_METADATA', metadata: updatedMetadata });
    }
  }, [metadata?.isNewBlock, blockIdForActions, isEditing, setActiveBlockId, updateBlock, block]);

  const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;

  const handleEditorCancel = useCallback(() => {
    setActiveBlockId(null);
  }, [setActiveBlockId]);

  return (
    <div 
      style={{ marginLeft: calculatedMarginLeft, ...style }}
      className={`editable-text-container relative group heading-block heading-level-${level}`}
      onClick={!isEditing ? handleClick : undefined}
      ref={ref} 
      {...rest} 
    >
      {isEditing ? (
        <CoreBlockEditor
          blockId={blockIdForActions}
          initialContent={initialEditorContent}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          languageMode="markdown"
          autoFocus
          singleLine={true}
          placeholder="Entrez votre titre..."
          initialClickCoords={clickCoords}
        />
      ) : (
        <HeadingTag 
          id={blockIdForActions}
          className="m-0 p-0 nova-block"
        >
          {renderInlineElements(children, blockIdForActions) ?? <span className="text-gray-400 italic">Titre vide...</span>}
        </HeadingTag>
      )}
    </div>
  );
});

CustomHeadingRendererComponent.displayName = 'CustomHeadingRenderer';

export default React.memo(CustomHeadingRendererComponent); 