import { BlocksState, BlockAction } from './types';
import { blocksReducer } from './useBlocksReducer';
import { useCallback } from 'react';

const undoableBlocksReducer = (state: BlocksState, action: BlockAction): BlocksState => {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const previousBlocks = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    return {
      ...state,
      past: newPast,
      future: [state.blocks, ...state.future],
      blocks: previousBlocks,
      selectedBlockIds: [],
      revisionCount: state.revisionCount + 1
    };
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const nextBlocks = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      ...state,
      past: [...state.past, state.blocks],
      future: newFuture,
      blocks: nextBlocks,
      selectedBlockIds: [],
      revisionCount: state.revisionCount + 1
    };
  }

  const newState = blocksReducer(state, action);

  if (action.type === 'SET_BLOCKS') {
    return { ...newState, past: [], future: [] };
  }

  if (newState.blocks !== state.blocks) {
    return {
      ...newState,
      past: [...state.past, state.blocks],
      future: [] 
    };
  }

  return newState;
};


export { undoableBlocksReducer };

export function useUndoRedo(state: BlocksState, dispatch: React.Dispatch<BlockAction>) {
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch]);
  
  return {
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0
  };
}
