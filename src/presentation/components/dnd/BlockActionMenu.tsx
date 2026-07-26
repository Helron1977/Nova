import React, { useRef } from 'react';
import type { Block } from '@/application/logic/markdownParser';
import { GripVertical, Trash2, Plus, Copy, Columns, Code, Eye } from 'lucide-react';
import { useEditorCommands } from '@/application/context/EditorContext';
import { getBlockModuleByType, getBlockModuleByCodeLanguage } from '@/application/logic/blockRegistry';

export interface BlockActionMenuProps {
  block: Block;
  sortableId: string;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  listeners: any;
  attributes?: any;
  isEditingSource?: boolean;
  setIsEditingSource?: (isEditing: boolean) => void;
}

export const BlockActionMenu: React.FC<BlockActionMenuProps> = ({ 
  block,
  sortableId, 
  setActivatorNodeRef, 
  listeners,
  attributes,
  isEditingSource,
  setIsEditingSource
}) => {
  const { deleteBlock, duplicateBlock, updateBlock, activeBlockId, setActiveBlockId } = useEditorCommands();
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Retrieve module configuration for edit action
  const module = getBlockModuleByType(block.type) || (block.type === 'code' ? getBlockModuleByCodeLanguage((block.content as any).language) : null);
  let editAction = module?.editActionType || 'source';

  // Fallback for built-in blocks that aren't registered as modules yet
  if (block.type === 'mermaid') {
    editAction = 'custom';
  }

  const isCodeModeActive = editAction === 'custom' ? (activeBlockId === sortableId) : isEditingSource;

  const handleToggleCodeMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editAction === 'custom') {
      setActiveBlockId(activeBlockId === sortableId ? null : sortableId);
    } else if (editAction === 'source' && setIsEditingSource) {
      setIsEditingSource(!isEditingSource);
    }
  };

  const handleToggleMenu = () => {
    if (addButtonRef.current) {
      window.dispatchEvent(new CustomEvent('nova-open-palette', { 
        detail: { blockId: sortableId, anchorElement: addButtonRef.current } 
      }));
    }
  };

  const cycleWidth = () => {
    const currentWidth = block.metadata?.layoutWidth || 'full';
    const nextWidth = ({
      'full': 'half',
      'half': 'third',
      'third': 'quarter',
      'quarter': 'full'
    }[currentWidth as string] || 'full') as 'full' | 'half' | 'third' | 'quarter';
    
    updateBlock(sortableId, block, { 
      type: 'UPDATE_METADATA', 
      metadata: { ...block.metadata, layoutWidth: nextWidth } 
    });
  };

  return (
    <div 
      className="controls absolute top-1.5 left-2 flex flex-col items-center bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-md z-20 
                 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto 
                 focus-within:opacity-100 focus-within:pointer-events-auto 
                 transition-all duration-200 ease-in-out scale-95 group-hover:scale-100 print:hidden"
    >
      <div 
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="p-1 cursor-grab touch-none text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-md transition-colors focus:outline-none"
          title="Déplacer"
      >
          <GripVertical size={15} />
      </div>

      <div className="h-px w-4 bg-gray-200 dark:bg-gray-700"></div>

      <button 
        ref={addButtonRef} 
        onClick={handleToggleMenu} 
        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors focus:outline-none"
        title="Ouvrir la palette de commandes"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Plus size={15} />
      </button>

      <div className="h-px w-4 bg-gray-200 dark:bg-gray-700"></div>

      <button 
        onClick={() => duplicateBlock?.(sortableId)} 
        className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors focus:outline-none"
        title="Dupliquer le bloc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Copy size={14} />
      </button>
      
      <div className="h-px w-4 bg-gray-200 dark:bg-gray-700"></div>

      <button 
        onClick={cycleWidth} 
        className="p-1 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors focus:outline-none"
        title={`Largeur : ${block.metadata?.layoutWidth || '100%'} (cliquer pour changer)`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Columns size={14} />
      </button>

      {editAction !== 'none' && (block.metadata?.customBlockType != null || block.type === 'code' || block.type === 'mermaid' || block.type === 'paletteBlock') && (
        <>
          <div className="h-px w-4 bg-gray-200 dark:bg-gray-700"></div>
          <button 
            onClick={handleToggleCodeMode} 
            className={`p-1 transition-colors focus:outline-none ${isCodeModeActive ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
            title={isCodeModeActive ? "Voir le rendu graphique" : "Éditer le code source (DSL)"}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isCodeModeActive ? <Eye size={14} /> : <Code size={14} />}
          </button>
        </>
      )}

      <div className="h-px w-4 bg-gray-200 dark:bg-gray-700"></div>
      
      <button 
        onClick={() => deleteBlock(sortableId)} 
        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-b-md transition-colors focus:outline-none"
        title="Supprimer le bloc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
