import React, { useState, useMemo, useCallback, forwardRef } from 'react';
import { markdownToBlocks, type ParagraphBlock, type InlineElement, type TextInline, type StrongInline, type EmphasisInline, type HTMLInline, type LinkInline, type InlineCodeElement, type DeleteInline } from '@/application/logic/markdownParser';

import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { CoreBlockEditor } from '../editor/CoreBlockEditor';

// Instancier le logger au niveau du module
const logger = new PinoLogger();

// Helper pour sérialiser les éléments inline en Markdown
const renderInlineElementsToMarkdown = (elements: InlineElement[] | undefined): string => {
    if (!elements) return '';
    let markdownString = '';
    elements.forEach(element => {
        if (!element) return;
        switch (element.type) {
            case 'text': markdownString += (element as TextInline).value; break;
            case 'strong': markdownString += `**${renderInlineElementsToMarkdown((element as StrongInline).children)}**`; break;
            case 'emphasis': markdownString += `*${renderInlineElementsToMarkdown((element as EmphasisInline).children)}*`; break;
            case 'inlineCode': markdownString += `\`${(element as InlineCodeElement).value}\``; break;
            case 'link':
                const link = element as LinkInline;
                const linkText = renderInlineElementsToMarkdown(link.children);
                const titlePart = link.title ? ` \"${link.title}\"` : '';
                markdownString += `[${linkText}](${link.url}${titlePart})`;
                break;
            case 'delete': markdownString += `~~${renderInlineElementsToMarkdown((element as DeleteInline).children)}~~`; break;
            case 'html': markdownString += (element as HTMLInline).value; break;
            default: logger.warn(`[renderInlineElementsToMarkdown] Unhandled type: ${(element as any)?.type}`); break;
        }
    });
    return markdownString;
};
import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomParagraphRendererProps {
  block: ParagraphBlock;
  style?: React.CSSProperties;
  listIndex?: number;
  index?: number;
  [key: string]: any;
}

const CustomParagraphRendererComponent = forwardRef<
  HTMLDivElement,
  CustomParagraphRendererProps
>(({ block, style, listIndex, index, ...rest }, ref) => {

  const { activeBlockId, setActiveBlockId, updateBlock } = useEditorCommands();
  const isEditing = activeBlockId === block.id;

  const { content: { children: inlineElements, markdown: blockMarkdown, rawMarkdown: blockRawMarkdown }, metadata, id: blockId } = block;
  const indentationLevel = metadata?.indentationLevel;

  const initialEditorContent = useMemo(() => {
    if (blockRawMarkdown && typeof blockRawMarkdown === 'string') return blockRawMarkdown;
    if (blockMarkdown && typeof blockMarkdown === 'string') return blockMarkdown;
    return renderInlineElementsToMarkdown(inlineElements);
  }, [inlineElements, blockMarkdown, blockRawMarkdown]);

  const handleEditorSave = useCallback((newContent: string) => {
    logger.debug(`[CustomParagraphRenderer - ${blockId}] Saving Markdown:`, newContent);
    const newBlocks = markdownToBlocks(newContent);
    logger.debug(`[CustomParagraphRenderer - ${blockId}] Parsed newContent into ${newBlocks.length} blocks.`);
    updateBlock(blockId, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
    setActiveBlockId(null);
  }, [updateBlock, blockId, block, setActiveBlockId]);

  const handleEditorCancel = useCallback(() => {
    logger.debug(`[CustomParagraphRenderer - ${blockId}] Cancelling edit.`);
    setActiveBlockId(null);
  }, [setActiveBlockId, blockId]);


  const [clickCoords, setClickCoords] = useState<{ x: number, y: number } | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Si l'utilisateur est en train de sélectionner du texte, on ne passe pas en mode édition
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    
    logger.debug(`[CustomParagraphRenderer - ${blockId}] handleClick triggered. Event target:`, e.target);
    setClickCoords({ x: e.clientX, y: e.clientY });
    setActiveBlockId(blockId);
  }, [blockId, setActiveBlockId]);

  React.useEffect(() => {
    if (metadata?.isNewBlock && !isEditing) {
      setActiveBlockId(blockId);
      // Supprimer le flag pour éviter de relancer l'édition au prochain rendu
      const updatedMetadata = { ...metadata };
      delete updatedMetadata.isNewBlock;
      updateBlock(blockId, block, { type: 'UPDATE_METADATA', metadata: updatedMetadata });
    }
  }, [metadata?.isNewBlock, blockId, isEditing, setActiveBlockId, updateBlock, block]);

  const indentationStyle = useMemo(() => ({
    paddingLeft: indentationLevel && indentationLevel > 0 ? `${indentationLevel * 1.5}rem` : '0rem',
    ...style,
  }), [indentationLevel, style]);

  return (
    <div
      ref={ref}
      style={indentationStyle}
      {...rest}
      className="nova-paragraph-block"
      onClick={!isEditing ? handleClick : undefined}
      title={!isEditing ? "Cliquer ou double-cliquer pour éditer" : undefined}
    >
      {isEditing ? (
        <CoreBlockEditor
          blockId={blockId}
          initialContent={initialEditorContent}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          languageMode="markdown"
          enableInlineFormatting={true}
          placeholder="Saisissez votre paragraphe..."
          autoFocus={true}
          initialClickCoords={clickCoords}
        />
      ) : (
        renderInlineElements(inlineElements, blockId) ?? <span className="text-gray-400 italic">Paragraphe vide...</span>
      )}
    </div>
  );
});

CustomParagraphRendererComponent.displayName = 'CustomParagraphRenderer';

export default React.memo(CustomParagraphRendererComponent); 