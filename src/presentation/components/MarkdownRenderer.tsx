import React, { useMemo, useState, useCallback, useRef, CSSProperties } from 'react';
import type { ListItemBlock, Block } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableBlockItem from './dnd/SortableBlockItem';


const logger = new PinoLogger();

interface MarkdownRendererProps {
  blocks: Block[];
  isSelectionModeActive: boolean;
  selectedBlockIds: string[];
  aiHighlightedBlockIds: string[];
  onToggleBlockSelection: (blockId: string) => void;
  setSelectedBlocksBatch: (blockIds: string[], append?: boolean) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ blocks, isSelectionModeActive, selectedBlockIds, aiHighlightedBlockIds, onToggleBlockSelection, setSelectedBlocksBatch }) => {
  logger.debug('[MarkdownRenderer] Rendering blocks:', blocks);

  if (!blocks) {
    return null;
  }

  const listIndices = useMemo(() => {
    const indices = new Map<string, number>();
    let currentListCounters: { [contextKey: string]: number } = {};
    let lastListItemContextKey: string | null = null;

    blocks.forEach(block => {
      if (block.type === 'listItem') {
        const listItem = block as ListItemBlock;
        const depth = listItem.metadata.depth;
        const ordered = listItem.metadata.ordered;
        const currentContextKey = `${depth}-${ordered}`;

        if (currentContextKey !== lastListItemContextKey) {
          currentListCounters[currentContextKey] = 0;
          lastListItemContextKey = currentContextKey;
        }

        const currentIndex = currentListCounters[currentContextKey] ?? 0;
        indices.set(block.id, currentIndex);
        currentListCounters[currentContextKey] = currentIndex + 1;
      }
    });

    logger.debug('[MarkdownRenderer] Calculated list indices (corrected hybrid logic):', Array.from(indices.entries()));
    return indices;
  }, [blocks]);

  const sortableItemIds: string[] = blocks.map(block => block.id);
  logger.debug('[MarkdownRenderer] Sortable item IDs for context:', sortableItemIds);

  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const marqueeStartPointRef = useRef<{ x: number, y: number } | null>(null);
  const rendererContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.controls')) return;
    if ((event.target as HTMLElement).closest('.cm-editor-container, input, textarea, button, .nova-drawing-block')) return;

    if (!(event.target as HTMLElement).closest('[data-block-id]')) {
      logger.debug('[MarkdownRenderer] Marquee selection not initiated: click was not on a block element.');
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const containerRect = rendererContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    marqueeStartPointRef.current = {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
    };
    setIsMarqueeSelecting(true);
    setMarqueeRect({ x: marqueeStartPointRef.current.x, y: marqueeStartPointRef.current.y, width: 0, height: 0 });
  }, [isSelectionModeActive]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMarqueeSelecting || !marqueeStartPointRef.current) return;
    event.preventDefault();

    const containerRect = rendererContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const currentX = event.clientX - containerRect.left;
    const currentY = event.clientY - containerRect.top;

    const x = Math.min(marqueeStartPointRef.current.x, currentX);
    const y = Math.min(marqueeStartPointRef.current.y, currentY);
    const width = Math.abs(currentX - marqueeStartPointRef.current.x);
    const height = Math.abs(currentY - marqueeStartPointRef.current.y);

    setMarqueeRect({ x, y, width, height });
  }, [isMarqueeSelecting]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMarqueeSelecting || !marqueeRect || !rendererContainerRef.current) return;
    event.preventDefault();

    setIsMarqueeSelecting(false);
    marqueeStartPointRef.current = null;

    if (marqueeRect.width < 5 && marqueeRect.height < 5) {
        setMarqueeRect(null);
        return;
    }

    const selectedIds: string[] = [];
    const blockElements = rendererContainerRef.current.querySelectorAll('[data-block-id]');
    
    blockElements.forEach(el => {
      const blockElement = el as HTMLElement;
      const blockId = blockElement.dataset.blockId;
      if (!blockId) return;

      const blockRect = blockElement.getBoundingClientRect();
      const containerScrollTop = rendererContainerRef.current?.scrollTop || 0;
      const containerScrollLeft = rendererContainerRef.current?.scrollLeft || 0;
      const containerRect = rendererContainerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const relativeBlockRect = {
        top: blockRect.top - containerRect.top + containerScrollTop,
        left: blockRect.left - containerRect.left + containerScrollLeft,
        bottom: blockRect.bottom - containerRect.top + containerScrollTop,
        right: blockRect.right - containerRect.left + containerScrollLeft,
        width: blockRect.width,
        height: blockRect.height
      };

      const marqueeAbsolute = {
          x: marqueeRect.x,
          y: marqueeRect.y,
          width: marqueeRect.width,
          height: marqueeRect.height
      };

      if (
        relativeBlockRect.left < marqueeAbsolute.x + marqueeAbsolute.width &&
        relativeBlockRect.left + relativeBlockRect.width > marqueeAbsolute.x &&
        relativeBlockRect.top < marqueeAbsolute.y + marqueeAbsolute.height &&
        relativeBlockRect.top + relativeBlockRect.height > marqueeAbsolute.y
      ) {
        selectedIds.push(blockId);
      }
    });

    if (selectedIds.length > 0) {
      setSelectedBlocksBatch(selectedIds, event.ctrlKey || event.metaKey);
    }
    setMarqueeRect(null);
  }, [isMarqueeSelecting, marqueeRect, setSelectedBlocksBatch]);

  const elementsToRender = blocks.map((block) => {
    const listIndex = block.type === 'listItem' ? listIndices.get(block.id) : undefined;
    return (
      <SortableBlockItem
        key={block.id}
        block={block}
        isSelectionModeActive={isSelectionModeActive}
        selectedBlockIds={selectedBlockIds}
        onToggleBlockSelection={onToggleBlockSelection}
        listIndex={listIndex}
        isAiHighlighted={aiHighlightedBlockIds.includes(block.id)}
      />
    );
  });

  return (
    <SortableContext 
      items={sortableItemIds}
      strategy={rectSortingStrategy}
    >
      <div 
        ref={rendererContainerRef} 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp}
        className="relative flex flex-wrap w-full items-start content-start"
      >
        {elementsToRender}
        <div id="nova-editor-bottom-spacer" className="w-full" style={{ height: '144px' }} />

        {isMarqueeSelecting && marqueeRect && (
          <div style={{
            position: 'absolute',
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.width,
            height: marqueeRect.height,
            backgroundColor: 'rgba(59, 130, 246, 0.3)',
            border: '1px solid rgba(59, 130, 246, 0.7)',
            pointerEvents: 'none',
            zIndex: 1000
          } as CSSProperties} />
        )}
      </div>
    </SortableContext>
  );
};

export default MarkdownRenderer; 