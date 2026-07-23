import React, { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, ParagraphBlock, HeadingBlock, ListItemBlock, CodeBlock, BlockquoteBlock, ImageBlock, MermaidBlock, TableBlock, HTMLBlock, ThematicBreakBlock, DropZoneBlock } from '../../application/logic/markdownParser';
import CustomParagraphRenderer from './markdown/CustomParagraphRenderer';
import CustomHeadingRenderer from './markdown/CustomHeadingRenderer';
import CustomListItemRenderer from './markdown/CustomListItemRenderer';
import CustomCodeRenderer from './markdown/CustomCodeRenderer';
import CustomBlockquoteRenderer from './markdown/CustomBlockquoteRenderer';
import CustomImageRenderer from './markdown/CustomImageRenderer';
import CustomMermaidRenderer from './markdown/CustomMermaidRenderer';
import CustomTableRenderer from './markdown/CustomTableRenderer';
import CustomHTMLRenderer from './markdown/CustomHTMLRenderer';
import CustomThematicBreakRenderer from './markdown/CustomThematicBreakRenderer';
import CustomDropZoneRenderer from './markdown/CustomDropZoneRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

// Interface pour les props de SortableBlockItem
interface SortableBlockItemProps {
  block: Block;
  isSelectionModeActive: boolean;
  selectedBlockIds: string[];
  listIndex?: number; // Index dans la liste pour référence
  index: number; // Index pour react-sortable-hoc ou dnd-kit
  onAddBlockAfter: (data: { afterId: string; newBlock: Block }) => void; 
  onUpdateBlockContent: (blockId: string, newText: string) => void; 
  onIncreaseIndentation: (blockId: string) => void;
  onDecreaseIndentation: (blockId: string) => void;
  onDelete: (blockId: string) => void;
}

export const SortableBlockItem: React.FC<SortableBlockItemProps> = ({ 
  block, 
  isSelectionModeActive,
  selectedBlockIds,
  listIndex, 
  index, 
  onUpdateBlockContent, 
  onIncreaseIndentation, 
  onDecreaseIndentation, 
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const isSelected = useMemo(() => selectedBlockIds.includes(block.id), [selectedBlockIds, block.id]);

  const style = {
    // Utilisation de translate3d pour potentiellement de meilleures performances
    transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  // Choix du composant de rendu basé sur le type de bloc
  const renderBlockContent = useMemo(() => {
    // Props communes à passer à la plupart des renderers
    const commonProps: any = {
      onUpdateBlockContent: onUpdateBlockContent, 
      index: index,
      attributes: attributes,
      onRemoveBlock: onDelete,
    };
    
    // logger.debug(`[SortableBlockItem] Rendering block ${block.id} of type ${block.type}`);

    switch (block.type) {
      case 'paragraph':
        return <CustomParagraphRenderer block={block as ParagraphBlock} {...commonProps} onIncreaseIndentation={onIncreaseIndentation} onDecreaseIndentation={onDecreaseIndentation} listIndex={listIndex}/>;
      case 'heading':
        return <CustomHeadingRenderer block={block as HeadingBlock} {...commonProps} onIncreaseIndentation={onIncreaseIndentation} onDecreaseIndentation={onDecreaseIndentation} listIndex={listIndex} />;
      case 'listItem':
        return <CustomListItemRenderer block={block as ListItemBlock} {...commonProps} onIncreaseIndentation={onIncreaseIndentation} onDecreaseIndentation={onDecreaseIndentation} listIndex={listIndex}/>;
      case 'code':
        return <CustomCodeRenderer block={block as CodeBlock} {...commonProps} onIncreaseIndentation={onIncreaseIndentation} onDecreaseIndentation={onDecreaseIndentation} listIndex={listIndex}/>;
      case 'blockquote':
        return <CustomBlockquoteRenderer block={block as BlockquoteBlock} {...commonProps} onIncreaseIndentation={onIncreaseIndentation} onDecreaseIndentation={onDecreaseIndentation} listIndex={listIndex}/>;
      case 'image':
        return <CustomImageRenderer block={block as ImageBlock} {...commonProps} />;
      case 'mermaid':
        return <CustomMermaidRenderer block={block as MermaidBlock} {...commonProps} />;
      case 'table':
        return <CustomTableRenderer block={block as TableBlock} {...commonProps} />;
      case 'html':
        return <CustomHTMLRenderer block={block as HTMLBlock} {...commonProps} />;
      case 'thematicBreak':
        return <CustomThematicBreakRenderer block={block as ThematicBreakBlock} {...commonProps} />;
      case 'dropZone':
        return <CustomDropZoneRenderer block={block as DropZoneBlock} onUpdateBlockContent={onUpdateBlockContent} onRemoveBlock={onDelete} style={{ width: '100%' }}/>;
      default:
        logger.warn(`[SortableBlockItem] Unsupported block type: ${(block as any)?.type}`);
        return <div className="p-2 border border-dashed border-red-500">Bloc non supporté: {(block as any)?.type}</div>;
    }
  }, [block, onUpdateBlockContent, onIncreaseIndentation, onDecreaseIndentation, listIndex, index, attributes, onDelete]);

  return (
    <div ref={setNodeRef} style={style} className={`sortable-item flex items-start group relative mb-1 ${isDragging ? 'shadow-lg' : ''}`}>
      {/* Drag Handle (Listeners attachés ici) */}
      <div
        {...listeners}
        className={`drag-handle p-1 cursor-grab active:cursor-grabbing touch-none text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-opacity ${
          (isSelectionModeActive && isSelected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
        </svg>
      </div>
      <div className="block-container flex-grow flex items-center w-full">
        {/* Le contenu rendu par le composant spécifique */} 
        <div className="block-content flex-grow" >
          {renderBlockContent}
        </div>
      </div>
    </div>
  );
}; 