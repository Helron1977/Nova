import React, { createContext, useContext, useState } from 'react';
import type { Block } from '../logic/markdownParser';
import type { UpdateStrategyPayload } from '../hooks/useBlocksManagement';

export interface EditorCommands {
  activeBlockId: string | null;
  setActiveBlockId: (id: string | null) => void;
  
  updateBlock: (blockId: string, originalBlock: Block, strategyPayload: UpdateStrategyPayload) => void;
  deleteBlock: (blockId: string) => void;
  duplicateBlock: (blockId: string) => void;
  addBlockAfter: (data: { afterId: string; newBlock: Block }) => void;
  addDropZoneBlockAfter: (data: { afterId: string }) => void;
  increaseIndentation: (blockId: string) => void;
  decreaseIndentation: (blockId: string) => void;
  addSummaryBlock?: () => void;
  isSelectionModeActive?: boolean;
}

const EditorContext = createContext<EditorCommands | undefined>(undefined);

export const useEditorCommands = (): EditorCommands => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorCommands must be used within an EditorProvider');
  }
  return context;
};

interface EditorProviderProps extends Omit<EditorCommands, 'activeBlockId' | 'setActiveBlockId'> {
  children: React.ReactNode;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({ 
  children,
  ...commands 
}) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleClear = () => setActiveBlockId(null);
    const handleSet = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveBlockId(customEvent.detail);
      }
    };
    window.addEventListener('nova-clear-active-block', handleClear);
    window.addEventListener('nova-set-active-block', handleSet);
    return () => {
      window.removeEventListener('nova-clear-active-block', handleClear);
      window.removeEventListener('nova-set-active-block', handleSet);
    };
  }, []);

  return (
    <EditorContext.Provider value={{ ...commands, activeBlockId, setActiveBlockId }}>
      {children}
    </EditorContext.Provider>
  );
};
