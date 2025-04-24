import React, { useMemo } from 'react';
import type { Block, ListItemBlock, MarkerStyle } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableBlockItem } from './dnd/SortableBlockItem';

const logger = new PinoLogger();

interface MarkdownRendererProps {
  blocks: Block[];
  onDeleteBlock: (id: string) => void;
  onAddBlockAfter: (data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => void;
  onUpdateBlockContent: (blockId: string, newText: string) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ blocks, onDeleteBlock, onAddBlockAfter, onUpdateBlockContent }) => {
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

  const elementsToRender = blocks.map((block, index) => {
    const listIndex = block.type === 'listItem' ? listIndices.get(block.id) : undefined;
    
    return (
      <SortableBlockItem 
        key={block.id}
        block={block}
        onDelete={onDeleteBlock}
        onAddAfter={onAddBlockAfter}
        onUpdateBlockContent={onUpdateBlockContent}
        index={index}
        listIndex={listIndex}
      />
    );
  });

  return (
    <SortableContext 
      items={sortableItemIds}
      strategy={verticalListSortingStrategy}
    >
      {elementsToRender}
    </SortableContext>
  );
};

export default MarkdownRenderer; 