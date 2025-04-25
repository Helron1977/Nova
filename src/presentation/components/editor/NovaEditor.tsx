import React, { useEffect, useMemo } from 'react';
// --- Imports nécessaires pour la logique transplantée ---
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useBlocksManagement } from '../../../application/hooks/useBlocksManagement'; // Chemin relatif
import MarkdownRenderer from '../MarkdownRenderer'; // Chemin relatif
import { Block } from '../../../application/logic/markdownParser'; // Chemin relatif
// --------------------------------------------------------

// 1. Interface de props (inchangée)
interface NovaEditorProps {
  initialMarkdown: string;
  /**
   * Callback appelé lorsque le contenu de l'éditeur change.
   * Fournit le nouveau contenu sous forme de chaîne Markdown et de tableau de blocs.
   */
  onChange: (newMarkdown: string, newBlocks: Block[]) => void;
  // Ajouter d'autres props nécessaires plus tard (config, etc.)
}

// 2. Composant éditeur
export const NovaEditor: React.FC<NovaEditorProps> = ({
  initialMarkdown,
  onChange
}) => {

  // --- Logique interne transplantée depuis App.tsx ---

  // a) Gestion des blocs via le hook, initialisé avec la prop
  const {
    blocks,
    handleDragEnd, // Signature à vérifier : (event: DragEndEvent) => void
    handleDeleteBlock,
    handleBlockContentChange,
    handleAddBlockAfter,
    handleIncreaseIndentation,
    handleDecreaseIndentation,
  } = useBlocksManagement(initialMarkdown);

  // << SUPPRESSION: Log pour vérifier les blocs internes >>
  /*
  useEffect(() => {
      console.log("[NovaEditor] Blocs internes:", blocks);
  }, [blocks]);
  */

  // b) Appel du callback onChange quand les blocs changent
  useEffect(() => {
    // << ANNULATION: Ne pas appeler blocksToMarkdown ici >>
    // Décider quoi passer pour newMarkdown (placeholder ou modifier l'interface)
    const placeholderMarkdown = ""; // Ou autre valeur selon la décision
    if (onChange) { // Vérifier si le callback est fourni
        onChange(placeholderMarkdown, blocks);
    }
  }, [blocks, onChange]);

  // c) Configuration des capteurs pour le Drag and Drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // d) Calcul des IDs pour SortableContext
  const blockIds = useMemo(() => {
    return blocks.map(block => block.id);
  }, [blocks]);

  // --------------------------------------------------

  // --- Rendu JSX transplanté depuis App.tsx ---
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blockIds}
        strategy={verticalListSortingStrategy}
      >
        {/* Enveloppement dans un fragment pour assurer un enfant unique à SortableContext */}
        <>
          <MarkdownRenderer
            blocks={blocks}
            onDeleteBlock={handleDeleteBlock}
            onAddBlockAfter={handleAddBlockAfter}
            onUpdateBlockContent={handleBlockContentChange}
            onIncreaseIndentation={handleIncreaseIndentation}
            onDecreaseIndentation={handleDecreaseIndentation}
          />
        </>
      </SortableContext>
    </DndContext>
  );
};