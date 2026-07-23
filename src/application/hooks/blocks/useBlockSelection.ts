import { useCallback } from 'react';
import { BlockAction } from './types';

export function useBlockSelection(dispatch: React.Dispatch<BlockAction>) {
  const toggleSelectionMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SELECTION_MODE' });
  }, [dispatch]);

  const toggleBlockSelection = useCallback((blockId: string) => {
    dispatch({ type: 'TOGGLE_BLOCK_SELECTION', payload: { blockId } });
  }, [dispatch]);

  const clearBlockSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_BLOCK_SELECTION' });
  }, [dispatch]);

  const deleteSelectedBlocks = useCallback(() => {
    dispatch({ type: 'DELETE_SELECTED_BLOCKS' });
  }, [dispatch]);

  const setSelectedBlocksBatch = useCallback((blockIds: string[], append: boolean = false) => {
    dispatch({ type: 'SET_SELECTED_BLOCKS_BATCH', payload: { blockIds, append } });
  }, [dispatch]);

  const setAiHighlights = useCallback((blockIds: string[]) => {
    dispatch({ type: 'SET_AI_HIGHLIGHTS', payload: blockIds });
  }, [dispatch]);

  const clearAiHighlights = useCallback(() => {
    dispatch({ type: 'CLEAR_AI_HIGHLIGHTS' });
  }, [dispatch]);

  const clearAiHighlightForBlock = useCallback((blockId: string) => {
    dispatch({ type: 'CLEAR_AI_HIGHLIGHT_FOR_BLOCK', payload: blockId });
  }, [dispatch]);

  return {
    toggleSelectionMode,
    toggleBlockSelection,
    clearBlockSelection,
    deleteSelectedBlocks,
    setSelectedBlocksBatch,
    setAiHighlights,
    clearAiHighlights,
    clearAiHighlightForBlock
  };
}
