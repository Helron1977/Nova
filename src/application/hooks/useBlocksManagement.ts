import { useReducer, useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { Block } from '@/application/logic/markdownParser';
import { BlocksState, UpdateStrategyPayload } from './blocks/types';
import { undoableBlocksReducer, useUndoRedo } from './blocks/useUndoRedo';
import { useBlockSelection } from './blocks/useBlockSelection';

export type { UpdateStrategyPayload };



export const useBlocksManagement = (initialBlocks: Block[]) => {
  const initialState: BlocksState = {
    blocks: initialBlocks,
    isSelectionModeActive: false,
    selectedBlockIds: [],
    aiHighlightedBlockIds: [],
    past: [],
    future: [],
    revisionCount: 0
  };
  const [state, dispatch] = useReducer(undoableBlocksReducer, initialState);

  const {
    toggleSelectionMode, toggleBlockSelection, clearBlockSelection,
    deleteSelectedBlocks, setSelectedBlocksBatch, setAiHighlights,
    clearAiHighlights, clearAiHighlightForBlock
  } = useBlockSelection(dispatch);

  const { undo, redo, canUndo, canRedo } = useUndoRedo(state, dispatch);

  const setExternalBlocks = useCallback((newBlocks: Block[]) => {
      dispatch({ type: 'SET_BLOCKS', payload: newBlocks });
  }, []); 

  const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = state.blocks.findIndex((item) => item.id === active.id);
      const newIndex = state.blocks.findIndex((item) => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
          dispatch({ type: 'REORDER_BLOCKS', payload: { startIndex: oldIndex, endIndex: newIndex } });
      }
  }, [state.blocks]); 

  const handleDeleteBlock = useCallback((idToDelete: string) => {
      dispatch({ type: 'DELETE_BLOCK', payload: { id: idToDelete } });
  }, []);

  const requestBlockUpdate = useCallback((blockId: string, _originalBlock: Block, strategyPayload: UpdateStrategyPayload) => {
    dispatch({ type: 'UPDATE_BLOCK', payload: { blockId, updateStrategy: strategyPayload } });
  }, []);

  const handleAddBlockAfter = useCallback((data: { afterId: string; newBlock: Block }) => {
       dispatch({ type: 'ADD_BLOCK_AFTER', payload: data });
  }, []);

  const handleAddDropZoneBlockAfter = useCallback((data: { afterId: string }) => {
    dispatch({ type: 'ADD_DROPZONE_BLOCK_AFTER', payload: data });
  }, []);

  const handleDuplicateBlock = useCallback((blockId: string) => {
      dispatch({ type: 'DUPLICATE_BLOCK', payload: { blockId } });
  }, []);

  const handleIncreaseIndentation = useCallback((blockId: string) => {
      dispatch({ type: 'INCREASE_INDENTATION', payload: { blockId } });
  }, []);

  const handleDecreaseIndentation = useCallback((blockId: string) => {
      dispatch({ type: 'DECREASE_INDENTATION', payload: { blockId } });
  }, []);

  const handleAddSummaryBlock = useCallback(() => {
    dispatch({ type: 'ADD_SUMMARY_BLOCK' });
  }, []);

  const handleAddBlockAtEnd = useCallback((newBlock: Block) => {
    dispatch({ type: 'ADD_BLOCK_AT_END', payload: { newBlock } });
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${newBlock.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, [dispatch]);

  const deleteBlocksByType = useCallback((type: string) => {
    dispatch({ type: 'DELETE_BLOCKS_BY_TYPE', payload: type });
  }, []);

  return {
    blocksState: state, 
    setExternalBlocks,
    handleDragEnd,
    handleDeleteBlock,
    requestBlockUpdate,
    handleAddBlockAfter,
    handleAddDropZoneBlockAfter,
    handleDuplicateBlock,
    handleIncreaseIndentation,
    handleDecreaseIndentation,
    handleAddSummaryBlock,
    handleAddBlockAtEnd,
    toggleSelectionMode,
    toggleBlockSelection,
    clearBlockSelection,
    deleteSelectedBlocks,
    setSelectedBlocksBatch,
    deleteBlocksByType,
    setAiHighlights,
    clearAiHighlights,
    clearAiHighlightForBlock,
    undo,
    redo,
    canUndo,
    canRedo
  };
}; 
