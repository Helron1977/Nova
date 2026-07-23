import React, { useState, useMemo, useCallback, forwardRef } from 'react';
import { markdownToBlocks, type BlockquoteBlock, type InlineElement } from '@/application/logic/markdownParser';

import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { CoreBlockEditor } from '../editor/CoreBlockEditor';

const logger = new PinoLogger();

import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomBlockquoteRendererProps {
  block: BlockquoteBlock;
  style?: React.CSSProperties;
  listIndex?: number;
  index?: number;
  [key: string]: any; // Pour props DND/data-*
}

// Helper pour sérialiser un bloc de citation en Markdown brut pour l'éditeur
// Cette fonction doit inclure les préfixes '> '
const renderBlockquoteToMarkdownForEditor = (block: BlockquoteBlock): string => {
  // Fonction interne pour sérialiser les éléments inline en texte brut ou markdown simple
  const serializeChildrenToMarkdown = (elements: InlineElement[] | undefined): string => {
    if (!elements) return '';
    return elements.map(el => {
      if (!el) return '';
      switch (el.type) {
        case 'text':
          return el.value;
        case 'strong':
          return `**${serializeChildrenToMarkdown(el.children)}**`;
        case 'emphasis':
          return `*${serializeChildrenToMarkdown(el.children)}*`;
        case 'inlineCode':
          return `\`${el.value}\``;
        case 'link':
          const linkText = serializeChildrenToMarkdown(el.children);
          const titlePart = el.title ? ` \"${el.title}\"` : '';
          return `[${linkText}](${el.url}${titlePart})`;
        case 'delete':
          return `~~${serializeChildrenToMarkdown(el.children)}~~`;
        case 'html':
          return el.value;
        // Ajoutez d'autres cas pour les types inline si nécessaire
        default:
          logger.warn(`[serializeChildrenToMarkdown in Blockquote] Unhandled type: ${ (el as any)?.type}`);
          return '';
      }
    }).join('');
  };

  const contentMarkdown = serializeChildrenToMarkdown(block.content.children);
  
  // Sépare le contenu en lignes et ajoute '> ' à chaque ligne
  // Gère le cas où contentMarkdown est vide pour retourner '> '
  if (contentMarkdown.trim() === '') {
    return '>'; // Pour une nouvelle citation vide, commencer avec un préfixe
  }
  return contentMarkdown.split('\n').map(line => `> ${line}`).join('\n');
};

const CustomBlockquoteRendererComponent = forwardRef<
  HTMLQuoteElement,
  CustomBlockquoteRendererProps
>(({ 
  block, 
  style, 
  listIndex,
  index,
  ...rest 
}, ref) => {
  const { activeBlockId, setActiveBlockId, updateBlock } = useEditorCommands();
  const isEditing = activeBlockId === block.id;

  const { id: blockId, content: { children }, metadata } = block;

  const initialEditorContent = useMemo(() => {
    // Utiliser la fonction helper pour obtenir le markdown brut avec les '>'
    // ou s'appuyer sur block.content.rawMarkdown / block.content.markdown s'ils sont corrects.
    return renderBlockquoteToMarkdownForEditor(block);
  }, [block]); // Dépend de tout le bloc au cas où rawMarkdown est mis à jour

  const handleEditorSave = useCallback((newContent: string) => {
    logger.debug(`[CustomBlockquoteRenderer - ${blockId}] Saving Markdown:`, newContent);
    const newBlocks = markdownToBlocks(newContent); // Parser le contenu en blocs
    logger.debug(`[CustomBlockquoteRenderer - ${blockId}] Parsed newContent into ${newBlocks.length} blocks.`);
    // Envoyer les blocs parsés avec la stratégie REPLACE_WITH_BLOCKS
    updateBlock(blockId, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
    setActiveBlockId(null);
  }, [updateBlock, blockId, block, setActiveBlockId]);

  const handleEditorCancel = useCallback(() => {
    logger.debug(`[CustomBlockquoteRenderer - ${blockId}] Cancelling edit.`);
    setActiveBlockId(null);
  }, [setActiveBlockId, blockId]);

  const [clickCoords, setClickCoords] = useState<{ x: number, y: number } | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    setClickCoords({ x: e.clientX, y: e.clientY });
    setActiveBlockId(blockId);
  }, [setActiveBlockId, blockId]);

  React.useEffect(() => {
    if (metadata?.isNewBlock && !isEditing) {
      setActiveBlockId(blockId);
      const updatedMetadata = { ...metadata };
      delete updatedMetadata.isNewBlock;
      updateBlock(blockId, block, { type: 'UPDATE_METADATA', metadata: updatedMetadata });
    }
  }, [metadata?.isNewisEditing, setActiveBlockId, blockId, updateBlock, block]);

  const indentationPadding = useMemo(() => {
    const level = metadata?.indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [metadata]);

  // Styles pour le conteneur <blockquote>
  const blockquoteStyle = useMemo(() => {
    return {
      ...style,
      marginLeft: indentationPadding, // Applique le padding pour l'indentation générale du bloc
      // La largeur est gérée par le parent ou flex, pas besoin de la recalculer ici si le padding suffit
      // width: `calc(100% - ${indentPx}px)`,
      // maxWidth: '100%',
      boxSizing: 'border-box' as const,
    };
  }, [style, indentationPadding]);

  if (isEditing) {
    return (
      <div style={style} className="nova-blockquote-block editing mb-2" {...rest}>
        <CoreBlockEditor
          blockId={blockId}
          initialContent={initialEditorContent}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          languageMode="markdown"
          enableInlineFormatting={true}
          autoFocus={true}
          placeholder="Saisissez votre citation..."
          initialClickCoords={clickCoords}
        />
      </div>
    );
  }

  return (
    <blockquote 
      ref={ref}
      style={blockquoteStyle}
      className="relative border-l-4 border-gray-300 pl-4 italic my-4 dark:border-gray-600 nova-blockquote-block cursor-text"
      onClick={handleClick}
      title="Cliquez pour éditer"
      {...rest}
    >
      <div className="prose dark:prose-invert max-w-none">
        {renderInlineElements(children, blockId)}
      </div>
    </blockquote>
  );
});

CustomBlockquoteRendererComponent.displayName = 'CustomBlockquoteRenderer';

export default React.memo(CustomBlockquoteRendererComponent); 