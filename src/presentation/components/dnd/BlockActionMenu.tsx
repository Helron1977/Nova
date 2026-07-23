import React, { useState, useRef, useMemo } from 'react';
import type { ListItemBlock, Block, TextInline, MarkerStyle } from '@/application/logic/markdownParser';
import { GripVertical, Trash2, Plus, ArrowRightFromLine, CornerDownRight, List, ListOrdered, VenetianMask, ListPlus, UploadCloud, Palette, ListChecks, Columns, Maximize } from 'lucide-react';
import { Pilcrow, Heading1, Heading2, SquareCode, GitGraph, Image as ImageIcon, Quote, Table as TableIcon, Codepen, Minus } from 'lucide-react';
import VerticalActionMenu from '../common/VerticalActionMenu';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { v4 as uuidv4 } from 'uuid';
import { getBlockModules } from '@/application/logic/blockRegistry';
import type { BlockModule } from '@/application/interfaces/blockModule';

import { createBlockFromAction } from '@/application/logic/blockFactory';
import { useEditorCommands } from '@/application/context/EditorContext';

const logger = new PinoLogger();

const standardBlockTypes = [
  { type: 'paragraph', label: 'Paragraphe', Icon: Pilcrow },
  { type: 'heading1', label: 'Titre 1', Icon: Heading1 },
  { type: 'heading2', label: 'Titre 2', Icon: Heading2 },
  { type: 'code', label: 'Code', Icon: SquareCode },
  { type: 'mermaid', label: 'Mermaid', Icon: GitGraph },
  { type: 'image', label: 'Image', Icon: ImageIcon },
  { type: 'blockquote', label: 'Citation', Icon: Quote },
  { type: 'table', label: 'Tableau (CSV)', Icon: TableIcon },
  { type: 'html', label: 'HTML', Icon: Codepen },
  { type: 'thematicBreak', label: 'Ligne', Icon: Minus },
  { type: 'dropzone', label: 'Zone de Dépôt', Icon: UploadCloud },
  { type: 'palette', label: 'Palette Couleurs', Icon: Palette },
  { type: 'summary', label: 'Sommaire', Icon: ListChecks },
];

const listItemMenuActions = [
  { type: 'addListItemSibling', label: 'Ajouter élément', Icon: ArrowRightFromLine },
  { type: 'addListItemChild', label: 'Créer une sous liste', Icon: CornerDownRight },
];

type OldMenuItemAction = {
    type: string;
    label: string;
    Icon: React.ElementType;
};

const markerStyleOptions: { style: MarkerStyle; label: string; Icon: React.ElementType }[] = [
  { style: 'bullet', label: 'Puce (•)', Icon: List },
  { style: 'decimal', label: 'Numéro (1.)', Icon: ListOrdered },
  { style: 'lower-alpha', label: 'Lettre (a.)', Icon: ListPlus },
  { style: 'lower-roman', label: 'Romain (i.)', Icon: VenetianMask },
];

const createTextInline = (text: string): TextInline => ({ type: 'text', value: text });

export interface BlockActionMenuProps {
  block: Block;
  sortableId: string;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  listeners: any;
}

export const BlockActionMenu: React.FC<BlockActionMenuProps> = ({ 
  block, 
  sortableId, 
  setActivatorNodeRef, 
  listeners 
}) => {
  const { deleteBlock, addDropZoneBlockAfter, updateBlock, addBlockAfter, addSummaryBlock } = useEditorCommands();
  const [isPrimarySelectorOpen, setIsPrimarySelectorOpen] = useState(false);
  const [isMarkerSelectorOpen, setIsMarkerSelectorOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const primaryMenuActions: OldMenuItemAction[] = useMemo(() => {
    const isListContext = block.type === 'listItem';
    let dynamicModuleActions: OldMenuItemAction[] = [];

    const registeredModules = getBlockModules();
    registeredModules.forEach((module: BlockModule<any>) => {
      if (module.codeBlockLanguage && module.menuIcon && module.displayName) {
        dynamicModuleActions.push({
          type: `module_${module.codeBlockLanguage}`,
          label: module.displayName,
          Icon: module.menuIcon,
        });
      }
    });

    const standardActions = standardBlockTypes.filter(stdAction => 
      !registeredModules.some((mod: BlockModule<any>) => mod.codeBlockLanguage === stdAction.type || mod.displayName === stdAction.label)
    );

    const layoutActions: OldMenuItemAction[] = [
      { type: 'layout_full', label: 'Largeur totale (100%)', Icon: Maximize },
      { type: 'layout_half', label: 'Demi-largeur (50%)', Icon: Columns },
      { type: 'layout_third', label: 'Un Tiers (33%)', Icon: Columns },
      { type: 'layout_quarter', label: 'Un Quart (25%)', Icon: Columns },
    ];

    if (isListContext) {
      const filteredStandardForList = standardActions.filter(
        typeInfo => !['heading1', 'heading2', 'thematicBreak', 'dropzone'].includes(typeInfo.type)
      );
      return [...layoutActions, ...filteredStandardForList, ...dynamicModuleActions, ...listItemMenuActions];
    }
    
    return [...layoutActions, ...standardActions, ...dynamicModuleActions];
  }, [block.type]);

  const adaptedActions = useMemo(() => {
    const sourceActions = isMarkerSelectorOpen ? markerStyleOptions : primaryMenuActions;
    return sourceActions.map(action => ({
        key: ('style' in action) ? action.style : action.type,
        label: action.label,
        Icon: action.Icon,
    }));
  }, [isMarkerSelectorOpen, primaryMenuActions]);

  const handleToggleMenu = () => {
    const opening = !isPrimarySelectorOpen && !isMarkerSelectorOpen;
    if (opening) {
      setIsPrimarySelectorOpen(true);
      setIsMarkerSelectorOpen(false);
    } else { 
      setIsPrimarySelectorOpen(false);
      setIsMarkerSelectorOpen(false);
    }
  };

  const handleMenuActionSelect = (actionKey: string) => {
    logger.debug(`[BlockActionMenu ${sortableId}] Action selected: ${actionKey}`);
    
    let newBlockToCreate: Block | null = null;
    const newId = uuidv4();
    const currentBlock = block;
    let initialIndentationLevel = currentBlock.type === 'listItem' ? (currentBlock as ListItemBlock).metadata.depth : (currentBlock.metadata?.indentationLevel ?? 0);

    if (isMarkerSelectorOpen) {
      const selectedMarker = markerStyleOptions.find(opt => opt.style === actionKey);
      if (selectedMarker && currentBlock.type === 'listItem') {
        const listItemBlock = currentBlock as ListItemBlock;
        const currentDepth = typeof listItemBlock.metadata?.depth === 'number' ? listItemBlock.metadata.depth : 0;
        newBlockToCreate = {
          id: newId, type: 'listItem', content: { children: [createTextInline('Nouvel élément enfant')] },
          metadata: { 
            depth: currentDepth + 1, 
            ordered: selectedMarker.style !== 'bullet', 
            checked: null, 
            markerStyle: selectedMarker.style 
          }
        } as ListItemBlock;
      }
    } else if (isPrimarySelectorOpen) {
      if (actionKey.startsWith('layout_')) {
          const widthMatch = actionKey.replace('layout_', '') as 'full' | 'half' | 'third' | 'quarter';
          updateBlock(sortableId, block, { 
              type: 'UPDATE_METADATA', 
              metadata: { layoutWidth: widthMatch } 
          });
          setIsPrimarySelectorOpen(false);
          setIsMarkerSelectorOpen(false);
          return;
      }

      if (actionKey === 'dropzone') {
        addDropZoneBlockAfter({ afterId: sortableId });
        setIsPrimarySelectorOpen(false);
        setIsMarkerSelectorOpen(false);
        return;
      }
      
      if (actionKey === 'summary') {
        if (addSummaryBlock) {
          addSummaryBlock();
        }
        setIsPrimarySelectorOpen(false);
        setIsMarkerSelectorOpen(false);
        return;
      }
      
      if (actionKey === 'addListItemChild') {
        setIsMarkerSelectorOpen(true);
        setIsPrimarySelectorOpen(false);
        return;
      } else if (actionKey === 'addListItemSibling' && currentBlock.type === 'listItem') {
        newBlockToCreate = { 
            id: newId, type: 'listItem', content: { children: [createTextInline('Nouvel élément frère')] }, 
            metadata: { ...(currentBlock as ListItemBlock).metadata, depth: (currentBlock as ListItemBlock).metadata.depth ?? 0 }
        } as ListItemBlock;
      } else {
        newBlockToCreate = createBlockFromAction(actionKey, initialIndentationLevel);
        if (!newBlockToCreate && actionKey.startsWith('module_')) {
            setIsPrimarySelectorOpen(false); 
            setIsMarkerSelectorOpen(false);
            return;
        }
      }
    }

    if (newBlockToCreate) {
      // Si createBlockFromAction a renvoyé un block avec un nouvel ID, on s'en sert, sinon on utilise le block original.
      addBlockAfter({ afterId: sortableId, newBlock: newBlockToCreate });
    }
    setIsPrimarySelectorOpen(false);
    setIsMarkerSelectorOpen(false);
  };

  const handleMenuClose = () => {
    setIsPrimarySelectorOpen(false);
    setIsMarkerSelectorOpen(false);
  };

  return (
    <div 
      className="controls absolute top-0 left-0 h-full flex items-center z-20 
                 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto 
                 focus-within:opacity-100 focus-within:pointer-events-auto 
                 transition-opacity duration-200 ease-in-out"
    >
      <button 
        ref={addButtonRef} 
        onClick={handleToggleMenu} 
        className="p-1 mr-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
        title="Ajouter un bloc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Plus size={18} />
      </button>
      <button 
        onClick={() => deleteBlock(sortableId)} 
        className="p-1 mr-1 text-gray-500 dark:text-gray-400 hover:text-red-500 focus:outline-none"
        title="Supprimer le bloc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Trash2 size={16} />
      </button>
      <div 
          ref={setActivatorNodeRef}
          {...listeners}
          className="p-1 cursor-grab touch-none text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
          style={{ pointerEvents: (isPrimarySelectorOpen || isMarkerSelectorOpen) ? 'none' : 'auto' }}
      >
          <GripVertical size={16} />
      </div>
      
      { (isPrimarySelectorOpen || isMarkerSelectorOpen) && (
          <VerticalActionMenu
            isOpen={true}
            actions={adaptedActions}
            anchorElement={addButtonRef.current}
            onActionSelect={handleMenuActionSelect}
            onClose={handleMenuClose}
            offsetValue={{ mainAxis: -35, crossAxis: -120 }} 
          />
        )
      }
    </div>
  );
};
