import React, { useState, useRef, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, ListItemBlock, CodeBlock } from '@/application/logic/markdownParser';
import type { MarkerStyle } from '@/application/logic/markdownParser';
import { markdownComponentsConfig } from '@/presentation/config/markdownComponentsConfig';
import { GripVertical, Trash2, Plus, ArrowRightFromLine, CornerDownRight, List, ListOrdered, VenetianMask, ListPlus } from 'lucide-react';
import { Pilcrow, Heading1, Heading2, SquareCode, GitGraph, Image, Quote, Table, Codepen, Minus } from 'lucide-react';
import CsvTableRenderer from '../markdown/CsvTableRenderer';
import VerticalActionMenu from '../common/VerticalActionMenu';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
const logger = new PinoLogger();

interface SortableBlockItemProps {
  block: Block;
  onDelete: (id: string) => void;
  onAddAfter: (data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => void;
  onUpdateBlockContent: (blockId: string, newText: string) => void;
  onIncreaseIndentation: (blockId: string) => void;
  onDecreaseIndentation: (blockId: string) => void;
  index: number;
  listIndex?: number;
}

// Types standard
const standardBlockTypes = [
  { type: 'paragraph', label: 'Paragraphe', Icon: Pilcrow },
  { type: 'heading1', label: 'Titre 1', Icon: Heading1 },
  { type: 'heading2', label: 'Titre 2', Icon: Heading2 },
  { type: 'code', label: 'Code', Icon: SquareCode },
  { type: 'mermaid', label: 'Mermaid', Icon: GitGraph },
  { type: 'image', label: 'Image', Icon: Image },
  { type: 'blockquote', label: 'Citation', Icon: Quote },
  { type: 'table', label: 'Tableau', Icon: Table },
  { type: 'html', label: 'HTML', Icon: Codepen },
  { type: 'thematicBreak', label: 'Ligne', Icon: Minus },
];

// Actions spécifiques aux listes
const listItemMenuActions = [
  { type: 'addListItemSibling', label: 'Ajouter élément', Icon: ArrowRightFromLine },
  { type: 'addListItemChild', label: 'Créer une sous liste', Icon: CornerDownRight },
];

// Type unifié pour les actions du menu
type OldMenuItemAction = {
    type: string;
    label: string;
    Icon: React.ElementType;
};

// << AJOUT: Définition des styles de marqueurs pour le sous-menu >>
const markerStyleOptions: { style: MarkerStyle; label: string; Icon: React.ElementType }[] = [
  { style: 'bullet', label: 'Puce (•)', Icon: List },
  { style: 'decimal', label: 'Numéro (1.)', Icon: ListOrdered },
  { style: 'lower-alpha', label: 'Lettre (a.)', Icon: ListPlus }, // Utiliser ListPlus en attendant mieux
  { style: 'lower-roman', label: 'Romain (i.)', Icon: VenetianMask }, // Utiliser VenetianMask en attendant mieux
];

export const SortableBlockItem: React.FC<SortableBlockItemProps> = ({ 
  block, 
  onDelete, 
  onAddAfter, 
  onUpdateBlockContent, 
  onIncreaseIndentation,
  onDecreaseIndentation,
  listIndex,
}) => {
  const [isPrimarySelectorOpen, setIsPrimarySelectorOpen] = useState(false);
  const [isMarkerSelectorOpen, setIsMarkerSelectorOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const controlAreaRef = useRef<HTMLDivElement>(null);
  
  const [isMouseOverControlArea, setIsMouseOverControlArea] = useState(false);

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
  };

  const showAnyControls = isMouseOverControlArea || isPrimarySelectorOpen || isMarkerSelectorOpen;

  const controlButtonBaseStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '0.25rem',
    transition: 'opacity 0.2s ease-in-out',
    opacity: showAnyControls ? 1 : 0,
    pointerEvents: showAnyControls ? 'auto' : 'none',
    zIndex: 20,
  };

  const handleStyle: React.CSSProperties = { 
    ...controlButtonBaseStyle, 
    left: '56px', 
    cursor: 'grab', 
    touchAction: 'none'
  }; 
  const deleteButtonStyle: React.CSSProperties = { ...controlButtonBaseStyle, left: '32px', cursor: 'pointer' };
  const addButtonStyle: React.CSSProperties = { 
      ...controlButtonBaseStyle,
      left: '8px',
      cursor: 'pointer',
      background: 'transparent', 
      borderRadius: '50%' 
  };

  const primaryMenuActions: OldMenuItemAction[] = useMemo(() => {
    const isListContext = block.type === 'listItem';
    logger.debug(`[SortableBlockItem ${block.id}] Determining menu actions. Block type: ${block.type}. Is list context: ${isListContext}`);
    
    if (isListContext) {
      const filteredStandard = standardBlockTypes.filter(
        typeInfo => !['heading1', 'heading2', 'thematicBreak'].includes(typeInfo.type)
      );
      const actions = [...filteredStandard, ...listItemMenuActions];
      logger.debug(`[SortableBlockItem ${block.id}] List context menu actions:`, actions.map(a => a.type));
      return actions;
    } else {
      logger.debug(`[SortableBlockItem ${block.id}] Standard menu actions.`);
      return standardBlockTypes;
    }
  }, [block.type]);

  const adaptedActions = useMemo(() => {
    const sourceActions = isMarkerSelectorOpen ? markerStyleOptions : primaryMenuActions;
    return sourceActions.map(action => ({
        key: ('style' in action) ? action.style : action.type,
        label: action.label,
        Icon: action.Icon,
    }));
  }, [isPrimarySelectorOpen, isMarkerSelectorOpen, primaryMenuActions]);

  // << MODIFIÉ: Log conditionnel de l'indentation >>
  if (block.type !== 'listItem') {
    logger.debug(`[SortableBlockItem ${block.id}] Received non-listItem block (${block.type}) - indentationLevel: ${block.metadata?.indentationLevel}`);
  } else {
    // Cast pour accéder à la depth spécifique au listItem
    logger.debug(`[SortableBlockItem ${block.id}] Received listItem block - depth: ${(block as ListItemBlock).metadata.depth}`);
  }

  let BlockComponent;
  if (block.type === 'code' && (block as CodeBlock).content.language?.startsWith('csv')) {
      BlockComponent = CsvTableRenderer;
      logger.debug(`[SortableBlockItem ${block.id}] Rendering as CSV table.`);
  } else {
      BlockComponent = markdownComponentsConfig[block.type as keyof typeof markdownComponentsConfig];
      logger.debug(`[SortableBlockItem ${block.id}] Rendering as standard block type: ${block.type}`);
  }

  let contentToRender: React.ReactNode;
  if (BlockComponent) {
      // << MODIFIÉ: Log conditionnel avant rendu >>
      const commonLogInfo = `Passing indentation props: onIncreaseIndentation=${typeof onIncreaseIndentation}, onDecreaseIndentation=${typeof onDecreaseIndentation}`;
      if (block.type !== 'listItem') {
          logger.debug(`[SortableBlockItem ${block.id}] Rendering non-listItem BlockComponent (${block.type}) - ${commonLogInfo}, block.metadata.indentationLevel=${block.metadata?.indentationLevel}`);
      } else {
           // Cast pour accéder à la depth spécifique au listItem
          logger.debug(`[SortableBlockItem ${block.id}] Rendering listItem BlockComponent - ${commonLogInfo}, block.metadata.depth=${(block as ListItemBlock).metadata.depth}`);
      }
      contentToRender = <BlockComponent 
                          block={block} 
                          onUpdateBlockContent={onUpdateBlockContent} 
                          listIndex={listIndex}
                          onIncreaseIndentation={onIncreaseIndentation}
                          onDecreaseIndentation={onDecreaseIndentation}
                        />;
  } else {
      contentToRender = (
        <div className="border border-dashed border-red-500 p-2 my-1">
          Type de bloc inconnu: {block.type}
        </div>
      );
  }

  const handleToggleMenu = () => {
    const opening = !isPrimarySelectorOpen && !isMarkerSelectorOpen;
    logger.debug(`[SortableBlockItem ${block.id}] Toggling menu. Opening: ${opening}`);
    if (opening) {
      setIsPrimarySelectorOpen(true);
      setIsMarkerSelectorOpen(false);
    } else { 
      setIsPrimarySelectorOpen(false);
      setIsMarkerSelectorOpen(false);
    }
  };

  const handleMenuActionSelect = (actionKey: string) => {
      logger.debug(`[SortableBlockItem ${block.id}] Action selected from menu: ${actionKey}`);
      if (isMarkerSelectorOpen) {
          const selectedMarker = markerStyleOptions.find(opt => opt.style === actionKey);
          if (selectedMarker) {
              logger.debug(`[ActionSelect] Marker style selected: ${selectedMarker.style}`);
              onAddAfter({ sortableId: sortableId, selectedType: 'addListItemChild', markerStyle: selectedMarker.style });
              setIsPrimarySelectorOpen(false);
              setIsMarkerSelectorOpen(false);
          } else {
               logger.warn(`[ActionSelect] Marker action key not found: ${actionKey}`);
          }
      } else if (isPrimarySelectorOpen) {
           const selectedAction = primaryMenuActions.find(act => act.type === actionKey);
           if (selectedAction) {
               logger.debug(`[ActionSelect] Primary action selected: ${selectedAction.type}`);
               if (selectedAction.type === 'addListItemChild') {
                   setIsMarkerSelectorOpen(true);
                   setIsPrimarySelectorOpen(false);
               } else {
                   onAddAfter({ sortableId: sortableId, selectedType: selectedAction.type });
                   setIsPrimarySelectorOpen(false);
                   setIsMarkerSelectorOpen(false);
               }
           } else {
                logger.warn(`[ActionSelect] Primary action key not found: ${actionKey}`);
           }
      } else {
           logger.error("[ActionSelect] Action selected but no menu was marked as open.");
      }
  };

  const handleMenuClose = () => {
      setIsPrimarySelectorOpen(false);
      setIsMarkerSelectorOpen(false);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={itemStyle}
      {...attributes} 
      data-dnd-wrapper
      className={`relative ${block.type === 'thematicBreak' ? 'py-1' : ''}`}
    >
      <div 
        ref={controlAreaRef}
        style={{ 
            position: 'absolute', left: 0, top: 0, width: '80px', height: '100%', zIndex: 10,
        }}
        onMouseEnter={() => setIsMouseOverControlArea(true)} 
        onMouseLeave={() => setIsMouseOverControlArea(false)} 
      > 
        <button
          ref={addButtonRef}
          style={addButtonStyle}
          onClick={handleToggleMenu} 
          className={`flex items-center justify-center w-7 h-7 rounded-full 
                     ${isPrimarySelectorOpen || isMarkerSelectorOpen
                       ? 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300 ring-2 ring-blue-300'
                       : 'text-gray-400 hover:text-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'}`
                    }
          title="Ajouter un bloc après"
        >
          {!(isPrimarySelectorOpen || isMarkerSelectorOpen) && <Plus size={20} />}
        </button>

        <button style={deleteButtonStyle} className="text-red-400 hover:text-red-600" onClick={() => onDelete(block.id)} title="Supprimer"> <Trash2 size={20} /> </button> 
        <button 
          ref={setActivatorNodeRef} 
          {...listeners} 
          style={handleStyle} 
          className="dnd-handle"
          title="Déplacer"
        > 
          <GripVertical 
            size={22} 
            className={showAnyControls ? 'text-gray-600' : 'text-gray-400'} 
          /> 
        </button> 
        
        <VerticalActionMenu
          isOpen={isPrimarySelectorOpen || isMarkerSelectorOpen}
          actions={adaptedActions}
          anchorElement={addButtonRef.current}
          onActionSelect={handleMenuActionSelect}
          onClose={handleMenuClose}
          offsetValue={{ mainAxis: -35, crossAxis: -120 }} 
        />

      </div>

      <div style={{ marginLeft: '80px' }}> 
        <div className="pr-4"> 
          {contentToRender}
        </div>
      </div>

      <div 
        className={`absolute right-0 bottom-[-1px] h-[2px] 
                   bg-blue-500 
                   transition-opacity duration-150 ease-in-out 
                   ${showAnyControls ? 'opacity-100' : 'opacity-0'}`} 
        style={{ pointerEvents: 'none', left: '80px' }} 
      />

    </div>
  );
};