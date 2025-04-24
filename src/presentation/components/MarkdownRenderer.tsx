import React from 'react';
import type { Block, ListItemBlock } from '@/application/logic/markdownParser';
import ListGroupRenderer from './markdown/ListGroupRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableBlockItem } from './dnd/SortableBlockItem';

const logger = new PinoLogger();

interface MarkdownRendererProps {
  blocks: Block[];
  onDeleteBlock: (id: string) => void;
  onAddBlockAfter: (data: { sortableId: string; selectedType: string }) => void;
  onUpdateBlockContent: (blockId: string, newText: string) => void;
}

// Helper pour générer l'ID de groupe
const getListGroupId = (firstItem: ListItemBlock): string => `group-${firstItem.id}`;

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ blocks, onDeleteBlock, onAddBlockAfter, onUpdateBlockContent }) => {
  logger.debug('[MarkdownRenderer] Rendering blocks:', blocks);

  if (!blocks) {
    return null;
  }

  // Générer les IDs pour SortableContext
  const sortableItemIds: string[] = [];
  let tempIndex = 0;
  while (tempIndex < blocks.length) {
    const block = blocks[tempIndex];
    if (block.type !== 'listItem') {
      sortableItemIds.push(block.id); // ID normal pour les blocs non-liste
      tempIndex++;
    } else {
      // ID de groupe préfixé pour le groupe de liste
      const listGroupId = getListGroupId(block as ListItemBlock); 
      sortableItemIds.push(listGroupId);
      // Sauter tous les items de cette liste
      while (tempIndex < blocks.length && blocks[tempIndex].type === 'listItem') {
        tempIndex++;
      }
    }
  }
  logger.debug('[MarkdownRenderer] Sortable item IDs for context:', sortableItemIds);


  const elementsToRender: React.ReactNode[] = [];
  let i = 0;
  let renderIndex = 0;
  while (i < blocks.length) {
    const currentBlock = blocks[i];
    const currentIndex = renderIndex;

    if (currentBlock.type !== 'listItem') {
      // Bloc normal: Rendu direct avec SortableBlockItem
      elementsToRender.push(
        <SortableBlockItem 
          key={currentBlock.id} 
          block={currentBlock} 
          onDelete={onDeleteBlock}
          onAddAfter={onAddBlockAfter}
          onUpdateBlockContent={onUpdateBlockContent}
          index={currentIndex}
        />
      );
      i++;
      renderIndex++;
    } else {
      // Bloc de liste: Identifier le groupe
      const listItemGroupStartIndex = i;
      const firstItemInGroup = blocks[i] as ListItemBlock;
      const listItemGroup: ListItemBlock[] = [];
      
      while (i < blocks.length && blocks[i].type === 'listItem') {
        listItemGroup.push(blocks[i] as ListItemBlock);
        i++;
      }
      logger.debug(`[MarkdownRenderer] Found list item group from index ${listItemGroupStartIndex} to ${i-1}`);
      
      if (listItemGroup.length > 0) {
          // Utiliser l'ID de groupe préfixé pour la key et pour le useSortable interne
          const listGroupId = getListGroupId(firstItemInGroup);
          // Le pseudo-bloc sert juste à passer le bon type/metadata initial si nécessaire,
          // mais SortableBlockItem utilisera l'ID original pour ajouter `group-`.
          const groupBlockRepresentation = { ...firstItemInGroup }; 

          elementsToRender.push(
            <SortableBlockItem 
              key={listGroupId}
              block={groupBlockRepresentation}
              onDelete={onDeleteBlock}
              onAddAfter={onAddBlockAfter}
              onUpdateBlockContent={onUpdateBlockContent}
              index={currentIndex}
            >
              <ListGroupRenderer listItems={listItemGroup} />
            </SortableBlockItem>
          );
          renderIndex++;
      } else {
           logger.error("[MarkdownRenderer] Empty list group detected, this should not happen.");
           if(blocks[listItemGroupStartIndex]?.type === 'listItem') i = listItemGroupStartIndex + 1;
           else i++;
      }
    }
  }

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