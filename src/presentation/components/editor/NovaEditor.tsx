import React, { useMemo, useId } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import MarkdownRenderer from '../MarkdownRenderer';
import { Block } from '../../../application/logic/markdownParser';
import type { DragEndEvent } from '@dnd-kit/core';
import type { UpdateStrategyPayload } from '../../../application/hooks/useBlocksManagement';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { CommandPalette } from '../common/CommandPalette';
import { EditorProvider } from '@/application/context/EditorContext';
import { useCommandPaletteOptions } from '../../../application/hooks/useCommandPaletteOptions';

interface NovaEditorProps {
  blocks: Block[];
  isSelectionModeActive: boolean;
  selectedBlockIds: string[];
  aiHighlightedBlockIds: string[];
  onToggleBlockSelection: (blockId: string) => void;
  setSelectedBlocksBatch: (blockIds: string[], append?: boolean) => void; // PROP AJOUTÉE ICI
  onDragEnd: (event: DragEndEvent) => void;
  onDeleteBlock: (idToDelete: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  onUpdateBlockContent: (blockId: string, originalBlock: Block, strategyPayload: UpdateStrategyPayload) => void;
  onAddBlockAfter: (data: { afterId: string; newBlock: Block }) => void;
  onAddDropZoneBlockAfter: (data: { afterId: string }) => void;
  onIncreaseIndentation: (blockId: string) => void;
  onDecreaseIndentation: (blockId: string) => void;
  handleAddSummaryBlock: () => void;
}

export const NovaEditor: React.FC<NovaEditorProps> = React.memo(({
  blocks,
  isSelectionModeActive,
  selectedBlockIds,
  aiHighlightedBlockIds,
  onToggleBlockSelection,
  setSelectedBlocksBatch, // PROP DÉSTRUCTURÉE ICI
  onDragEnd,
  onDeleteBlock,
  onDuplicateBlock,
  onAddBlockAfter,
  onAddDropZoneBlockAfter,
  onUpdateBlockContent,
  onIncreaseIndentation,
  onDecreaseIndentation,
  handleAddSummaryBlock,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const dndContextId = useId();
  const logger = useMemo(() => new PinoLogger(), []);

  if (!blocks) {
    logger.warn("[NovaEditor] Rendu avec blocks non défini.");
    return null;
  }
  logger.debug(`[NovaEditor] Rendu avec ${blocks.length} blocs. Mode sélection: ${isSelectionModeActive}`);

  const blockIds = useMemo(() => {
    return blocks.map(block => block.id);
  }, [blocks]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [paletteAnchor, setPaletteAnchor] = React.useState<HTMLElement | null>(null);
  const [paletteContextBlockId, setPaletteContextBlockId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteAnchor(null);
        setPaletteContextBlockId(null);
        setIsCommandPaletteOpen(true);
      }
    };
    
    const handleOpenPalette = (e: Event) => {
      const customEvent = e as CustomEvent<{ blockId: string; anchorElement: HTMLElement }>;
      setPaletteContextBlockId(customEvent.detail.blockId);
      setPaletteAnchor(customEvent.detail.anchorElement);
      setIsCommandPaletteOpen(true);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('nova-open-palette', handleOpenPalette);
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('nova-open-palette', handleOpenPalette);
    };
  }, []);

  const commandOptions = useCommandPaletteOptions({
    blocks,
    paletteContextBlockId,
    onAddBlockAfter,
    onAddDropZoneBlockAfter,
    handleAddSummaryBlock
  });

  return (
    <EditorProvider
      updateBlock={onUpdateBlockContent}
      deleteBlock={onDeleteBlock}
      duplicateBlock={onDuplicateBlock}
      addBlockAfter={onAddBlockAfter}
      addDropZoneBlockAfter={onAddDropZoneBlockAfter}
      increaseIndentation={onIncreaseIndentation}
      decreaseIndentation={onDecreaseIndentation}
      addSummaryBlock={handleAddSummaryBlock}
      isSelectionModeActive={isSelectionModeActive}
    >
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        options={commandOptions}
        anchorElement={paletteAnchor}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        id={dndContextId}
      >
        <SortableContext
          items={blockIds}
          strategy={rectSortingStrategy}
        >
          <MarkdownRenderer
            blocks={blocks}
            isSelectionModeActive={isSelectionModeActive}
            selectedBlockIds={selectedBlockIds}
            aiHighlightedBlockIds={aiHighlightedBlockIds}
            onToggleBlockSelection={onToggleBlockSelection}
            setSelectedBlocksBatch={setSelectedBlocksBatch}
          />
        </SortableContext>
      </DndContext>
    </EditorProvider>
  );
});

NovaEditor.displayName = 'NovaEditor';