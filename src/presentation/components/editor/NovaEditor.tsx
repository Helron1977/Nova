import React, { useMemo, useId } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import MarkdownRenderer from '../MarkdownRenderer';
import { Block } from '../../../application/logic/markdownParser';
import type { DragEndEvent } from '@dnd-kit/core';
import type { UpdateStrategyPayload } from '../../../application/hooks/useBlocksManagement';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { getBlockModules } from '../../../application/logic/blockRegistry';
import { CommandPalette, type CommandOption } from '../common/CommandPalette';
import { EditorProvider } from '@/application/context/EditorContext';
import { createBlockFromAction } from '../../../application/logic/blockFactory';
import { Pilcrow, Heading1, Heading2, SquareCode, Image as ImageIcon, Quote, Minus, UploadCloud, ListChecks, Bot } from 'lucide-react';

interface NovaEditorProps {
  blocks: Block[];
  isSelectionModeActive: boolean;
  selectedBlockIds: string[];
  aiHighlightedBlockIds: string[];
  onToggleBlockSelection: (blockId: string) => void;
  setSelectedBlocksBatch: (blockIds: string[], append?: boolean) => void; // PROP AJOUTÉE ICI
  onDragEnd: (event: DragEndEvent) => void;
  onDeleteBlock: (idToDelete: string) => void;
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
  onAddBlockAfter,
  onAddDropZoneBlockAfter,
  onUpdateBlockContent,
  onIncreaseIndentation,
  onDecreaseIndentation,
  handleAddSummaryBlock,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
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

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const commandOptions: CommandOption[] = useMemo(() => {
    const appendBlock = (actionKey: string) => {
      const lastBlockId = blocks.length > 0 ? blocks[blocks.length - 1].id : '';
      const newBlock = createBlockFromAction(actionKey, 0);
      if (newBlock) {
        onAddBlockAfter({ afterId: lastBlockId, newBlock });
        setTimeout(() => window.dispatchEvent(new CustomEvent('nova-set-active-block', { detail: newBlock.id })), 50);
      }
    };

    const baseOptions: CommandOption[] = [
      { id: 'text', label: 'Texte (Paragraphe)', keyword: 'text paragraphe', Icon: Pilcrow, action: () => appendBlock('paragraph') },
      { id: 'h1', label: 'Titre 1', keyword: 'h1 titre 1', Icon: Heading1, action: () => appendBlock('heading1') },
      { id: 'h2', label: 'Titre 2', keyword: 'h2 titre 2', Icon: Heading2, action: () => appendBlock('heading2') },
      { id: 'code', label: 'Bloc de code', keyword: 'code script', Icon: SquareCode, action: () => appendBlock('code') },
      { id: 'image', label: 'Image', keyword: 'image photo', Icon: ImageIcon, action: () => appendBlock('image') },
      { id: 'quote', label: 'Citation', keyword: 'quote citation', Icon: Quote, action: () => appendBlock('blockquote') },
      { id: 'divider', label: 'Ligne de séparation', keyword: 'divider ligne separateur', Icon: Minus, action: () => appendBlock('thematicBreak') },
      { id: 'summary', label: 'Sommaire', keyword: 'summary sommaire', Icon: ListChecks, action: () => {
        if (handleAddSummaryBlock) handleAddSummaryBlock();
      }},
      { id: 'dropzone', label: 'Zone de Dépôt', keyword: 'dropzone upload fichier', Icon: UploadCloud, action: () => {
        const lastBlockId = blocks.length > 0 ? blocks[blocks.length - 1].id : '';
        onAddDropZoneBlockAfter({ afterId: lastBlockId });
      }},
      // Commande IA ajoutée à la palette !
      { id: 'ai', label: 'Demander à l\'IA', keyword: 'ia ai prompt agent', Icon: Bot, action: () => {
         const aiInput = document.getElementById('nova-agent-input');
         if (aiInput) aiInput.focus();
      }}
    ];

    const dynamicOptions: CommandOption[] = getBlockModules()
      .filter(m => m.paletteLabel && m.paletteKeyword)
      .map(m => ({
        id: m.type,
        label: m.paletteLabel!,
        keyword: m.paletteKeyword!,
        Icon: (m.menuIcon || m.icon) as any,
        action: () => appendBlock(`module_${m.codeBlockLanguage || m.type}`)
    }));

    return [...baseOptions, ...dynamicOptions];
  }, [blocks, onAddBlockAfter, onAddDropZoneBlockAfter, handleAddSummaryBlock]);

  return (
    <EditorProvider
      updateBlock={onUpdateBlockContent}
      deleteBlock={onDeleteBlock}
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