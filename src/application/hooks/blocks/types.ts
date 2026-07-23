import type { Block, UniversalBlockMetadata } from '@/application/logic/markdownParser';

// --- AJOUT: État pour la sélection et l'historique ---
export interface BlocksState {
  blocks: Block[];
  isSelectionModeActive: boolean;
  selectedBlockIds: string[];
  aiHighlightedBlockIds: string[];
  past: Block[][];
  future: Block[][];
  revisionCount: number;
}

export type GenericMetadata = {
  position?: any;
  indentationLevel?: number;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  markerStyle?: string;
  language?: string;
  charPosition?: number;
};

// --- DÉFINITION DES ACTIONS POUR LE REDUCER ---
export type UpdateStrategyPayload = 
  | { type: 'REPLACE_WITH_BLOCKS'; newBlocks: Block[] } 
  | { type: 'UPDATE_SOURCE_FOR_MODULE'; newRawSource: string; moduleType: string }
  | { type: 'UPDATE_METADATA'; metadata: Partial<UniversalBlockMetadata> };

export type BlockAction =
  | { type: 'SET_BLOCKS'; payload: Block[]; }
  | { type: 'REORDER_BLOCKS'; payload: { startIndex: number; endIndex: number }; }
  | { type: 'DELETE_BLOCK'; payload: { id: string }; }
  | { type: 'ADD_BLOCK_AFTER'; payload: { afterId: string; newBlock: Block }; }
  | { type: 'UPDATE_BLOCK'; payload: { blockId: string; updateStrategy: UpdateStrategyPayload }; }
  | { type: 'INCREASE_INDENTATION'; payload: { blockId: string }; }
  | { type: 'DECREASE_INDENTATION'; payload: { blockId: string }; }
  | { type: 'ADD_DROPZONE_BLOCK_AFTER'; payload: { afterId: string }; }
  | { type: 'ADD_SUMMARY_BLOCK'; }
  | { type: 'ADD_BLOCK_AT_END'; payload: { newBlock: Block }; }
  | { type: 'TOGGLE_SELECTION_MODE'; }
  | { type: 'TOGGLE_BLOCK_SELECTION'; payload: { blockId: string }; }
  | { type: 'CLEAR_BLOCK_SELECTION'; }
  | { type: 'DELETE_SELECTED_BLOCKS'; }
  | { type: 'SET_SELECTED_BLOCKS_BATCH'; payload: { blockIds: string[]; append?: boolean } }
  | { type: 'UNDO'; }
  | { type: 'REDO'; }
  | { type: 'SET_AI_HIGHLIGHTS'; payload: string[] }
  | { type: 'CLEAR_AI_HIGHLIGHTS' }
  | { type: 'CLEAR_AI_HIGHLIGHT_FOR_BLOCK'; payload: string }
  | { type: 'DELETE_BLOCKS_BY_TYPE'; payload: string };
