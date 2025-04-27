import React, { useMemo } from 'react';
// --- Imports nécessaires pour la logique transplantée ---
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
// --- SUPPRIMÉ: Import du hook, car il est utilisé dans App.tsx ---
// import { useBlocksManagement } from '../../../application/hooks/useBlocksManagement';
import MarkdownRenderer from '../MarkdownRenderer';
import { Block, MarkerStyle } from '../../../application/logic/markdownParser';
// --- AJOUT: Importer DragEndEvent --- 
import type { DragEndEvent } from '@dnd-kit/core';
// --------------------------------------------------------

// 1. Interface de props (MODIFIÉE)
interface NovaEditorProps {
  blocks: Block[]; // <- Utilise les blocs passés en prop
  // Fonctions de gestion passées en props
  onDragEnd: (event: DragEndEvent) => void;
  onDeleteBlock: (idToDelete: string) => void;
  onBlockContentChange: (blockId: string, newText: string) => void;
  onAddBlockAfter: (data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => void;
  onIncreaseIndentation: (blockId: string) => void;
  onDecreaseIndentation: (blockId: string) => void;
  // Supprimé: initialMarkdown et onChange
}

// 2. Composant éditeur (MODIFIÉ)
export const NovaEditor: React.FC<NovaEditorProps> = ({
  // Déstructuration des nouvelles props
  blocks,
  onDragEnd,
  onDeleteBlock,
  onBlockContentChange,
  onAddBlockAfter,
  onIncreaseIndentation,
  onDecreaseIndentation
}) => {

  // --- SUPPRIMÉ: Logique interne utilisant useBlocksManagement ---
  /*
  const {
    blocks, // Supprimé
    handleDragEnd,
    handleDeleteBlock,
    handleBlockContentChange,
    handleAddBlockAfter,
    handleIncreaseIndentation,
    handleDecreaseIndentation,
  } = useBlocksManagement(initialMarkdown); // Supprimé
  */

  // --- SUPPRIMÉ: useEffect appelant onChange ---
  /*
  useEffect(() => {
    const placeholderMarkdown = "";
    if (onChange) { 
        onChange(placeholderMarkdown, blocks);
    }
  }, [blocks, onChange]);
  */

  // --- Configuration des capteurs pour le Drag and Drop (INCHANGÉ) ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Calcul des IDs pour SortableContext (UTILISE `blocks` de la prop) ---
  const blockIds = useMemo(() => {
    return blocks.map(block => block.id);
  }, [blocks]);

  // --------------------------------------------------

  // --- Rendu JSX (MODIFIÉ pour utiliser les props) ---
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd} // <- Utilise la prop
    >
      <SortableContext
        items={blockIds}
        strategy={verticalListSortingStrategy}
      >
        <>
          <MarkdownRenderer
            blocks={blocks} // <- Utilise la prop
            // Passe les fonctions de gestion reçues en props
            onDeleteBlock={onDeleteBlock}
            onAddBlockAfter={onAddBlockAfter}
            onUpdateBlockContent={onBlockContentChange} // Note: renommage de prop onBlockContentChange -> onUpdateBlockContent
            onIncreaseIndentation={onIncreaseIndentation}
            onDecreaseIndentation={onDecreaseIndentation}
          />
        </>
      </SortableContext>
    </DndContext>
  );
};