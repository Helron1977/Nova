import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { useEditorCommands } from '@/application/context/EditorContext';

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

  const { updateBlock } = useEditorCommands();
  const [currentHeight, setCurrentHeight] = useState<string | undefined>(block.metadata?.layoutHeight);
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const innerRef = useRef<HTMLDivElement>(null);

  const [isEditingSource, setIsEditingSource] = useState(false);

  useEffect(() => {
    setCurrentHeight(block.metadata?.layoutHeight);
  }, [block.metadata?.layoutHeight]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startY.current = e.clientY;
    
    if (innerRef.current) {
       startHeight.current = innerRef.current.getBoundingClientRect().height;
    }
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current || !innerRef.current) return;
      const deltaY = moveEvent.clientY - startY.current;
      const newHeight = Math.max(50, startHeight.current + deltaY);
      // Direct DOM manipulation for performance (avoids re-rendering Mermaid on every pixel)
      innerRef.current.style.height = `${newHeight}px`;
      innerRef.current.style.overflow = 'hidden';
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (innerRef.current) {
         const finalHeight = innerRef.current.style.height;
         setCurrentHeight(finalHeight);
         updateBlock(block.id, block, { type: 'UPDATE_METADATA', metadata: { layoutHeight: finalHeight } });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
      className={`sortable-item-wrapper group relative ${widthClass}`}
      onClick={handleBlockClick}
      data-block-id={block.id}
    >
      <BlockActionMenu 
        block={block}
        sortableId={sortableId}
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
        attributes={attributes}
        isEditingSource={isEditingSource}
        setIsEditingSource={setIsEditingSource}
      />

      <div 
        ref={innerRef}
        data-dnd-wrapper="true"
        className="flex-grow pl-[80px] print:pl-0 pr-8 print:pr-0 py-1 print:py-0.5 prose dark:prose-invert max-w-none relative"
        onMouseDownCapture={() => logger.debug(`[SortableBlockItem ${block.id}] WRAPPER DIV onMouseDownCapture triggered`)}
        style={{ height: currentHeight || 'auto', overflow: currentHeight ? 'hidden' : 'visible' }}
      >
        <BlockRendererDispatcher
          block={block}
          listIndex={listIndex}
          isEditingSource={isEditingSource}
          setIsEditingSource={setIsEditingSource}
        />
        {/* Resize Handle */}
        {(block.type === 'thematicBreak' || block.type === 'mermaid' || block.type === 'image' || block.metadata?.customBlockType != null) && (
          <div 
            className="absolute bottom-0 left-[80px] right-0 h-[8px] cursor-ns-resize opacity-0 hover:opacity-100 group-hover:opacity-50 transition-opacity bg-blue-500/20 hover:bg-blue-500/50"
            onMouseDown={handleResizeMouseDown}
            title="Redimensionner la hauteur du bloc"
          >
            <div className="w-8 h-1 bg-blue-500 mx-auto mt-1 rounded-full pointer-events-none"></div>
          </div>
        )}
      </div>
    </div>
  );
});

SortableBlockItemComponent.displayName = 'SortableBlockItem';

const SortableBlockItem = React.memo(SortableBlockItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.block === nextProps.block &&
    prevProps.isSelectionModeActive === nextProps.isSelectionModeActive &&
    prevProps.selectedBlockIds.length === nextProps.selectedBlockIds.length &&
    prevProps.isAiHighlighted === nextProps.isAiHighlighted
  );
});

export default SortableBlockItem;