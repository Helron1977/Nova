import React, { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

import { BlockActionMenu } from './BlockActionMenu';
import { BlockRendererDispatcher } from './BlockRendererDispatcher';

const logger = new PinoLogger();

interface SortableBlockItemProps {
  block: Block;
  isSelectionModeActive: boolean;
  selectedBlockIds: string[];
  onToggleBlockSelection: (blockId: string) => void;
  listIndex?: number;
  isAiHighlighted?: boolean;
}

const SortableBlockItemComponent = forwardRef<HTMLDivElement, SortableBlockItemProps>(({ 
  block, 
  isSelectionModeActive,
  selectedBlockIds,
  onToggleBlockSelection,
  listIndex,
  isAiHighlighted
}, _ref) => {
  const sortableId = block.id;
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    setActivatorNodeRef,
    transform, 
    transition, 
    isDragging 
  } = useSortable({ id: sortableId });

  const itemStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
    outline: isSelectionModeActive && selectedBlockIds.includes(block.id) ? '2px solid #3b82f6' : 'none',
    outlineOffset: isSelectionModeActive && selectedBlockIds.includes(block.id) ? '2px' : '0px',
    backgroundColor: isAiHighlighted && !(isSelectionModeActive && selectedBlockIds.includes(block.id)) ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
    borderRadius: '4px',
    boxShadow: isAiHighlighted && !(isSelectionModeActive && selectedBlockIds.includes(block.id)) ? 'inset 0 0 8px rgba(168,85,247,0.1)' : 'none',
  };

  const layoutWidth = block.metadata?.layoutWidth || 'full';
  const widthClass = {
    'full': 'w-full',
    'half': 'w-1/2',
    'third': 'w-1/3',
    'quarter': 'w-1/4'
  }[layoutWidth] || 'w-full';

  const handleBlockClick = (event: React.MouseEvent) => {
    if (isSelectionModeActive) {
      event.stopPropagation();
      onToggleBlockSelection(block.id);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={itemStyle} 
      {...attributes} 
      className={`sortable-item-wrapper group relative ${widthClass}`}
      onClick={handleBlockClick}
      data-block-id={block.id}
      tabIndex={-1}
    >
      <BlockActionMenu 
        block={block}
        sortableId={sortableId}
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
      />

      <div 
        className="flex-grow pl-[80px] pr-8 py-1 prose dark:prose-invert max-w-none"
        onMouseDownCapture={() => logger.debug(`[SortableBlockItem ${block.id}] WRAPPER DIV onMouseDownCapture triggered`)}
      >
        <BlockRendererDispatcher
          block={block}
          listIndex={listIndex}
        />
      </div>

      <div 
        className={`absolute right-0 bottom-[-1px] h-[2px] 
                   bg-blue-500 
                   opacity-0 group-hover:opacity-100
                   transition-opacity duration-150 ease-in-out`} 
        style={{ pointerEvents: 'none', left: '80px' }} 
      />
    </div>
  );
});

export default React.memo(SortableBlockItemComponent);