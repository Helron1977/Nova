import { v4 as uuidv4 } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import type { Block, ListItemBlock, ParagraphBlock, CodeBlock, DropZoneBlock, HeadingBlock, InlineElement, UniversalBlockMetadata, MermaidBlock } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { getBlockModuleByType, getBlockModuleByCodeLanguage } from '@/application/logic/blockRegistry';
import { BlocksState, BlockAction, GenericMetadata } from './types';

const logger = new PinoLogger();

const getPlainTextFromInlineElements = (elements: InlineElement[] | undefined): string => {
  if (!elements) return '';
  return elements.map(el => {
    if (el.type === 'text') return el.value;
    if (el.type === 'strong' || el.type === 'emphasis' || el.type === 'delete' || el.type === 'link') {
      return getPlainTextFromInlineElements(el.children);
    }
    if (el.type === 'inlineCode') return el.value;
    if (el.type === 'html') return el.value;
    return '';
  }).join('');
};

const generateSummaryMarkdown = (blocks: Block[]): string => {
  let summaryMd = '';
  blocks.forEach(block => {
    if (block.type === 'heading') {
      const headingBlock = block as HeadingBlock;
      if (headingBlock.content.level <= 2) {
        const titleText = getPlainTextFromInlineElements(headingBlock.content.children).trim();
        if (titleText) {
          const indent = '  '.repeat(Math.max(0, headingBlock.content.level - 1));
          const anchor = headingBlock.id;
          summaryMd += `${indent}- [${titleText}](#${anchor})\n`;
        }
      }
    } else if (block.type === 'mermaid' || (block.type === 'code' && (block as CodeBlock).content.language === 'mermaid')) {
      summaryMd += `- [📊 Diagramme (Mermaid)](#${block.id})\n`;
    } else if (block.type === 'code' && (block as CodeBlock).content.language === 'palette') {
      summaryMd += `- [🎨 Palette de couleurs](#${block.id})\n`;
    }
  });
  if (summaryMd.length === 0) {
    summaryMd = '- (Aucun élément trouvé pour le sommaire)\n';
  }
  return summaryMd.trim();
};

const blocksReducer = (state: BlocksState, action: BlockAction): BlocksState => {
    if ('payload' in action) {
      logger.debug(`[blocksReducer] Action received: ${action.type}`, action.payload);
    } else {
      logger.debug(`[blocksReducer] Action received: ${action.type}`);
    }
    switch (action.type) {
        case 'SET_BLOCKS':
            return { ...state, blocks: action.payload, selectedBlockIds: [], aiHighlightedBlockIds: [], revisionCount: state.revisionCount + 1 };

        case 'REORDER_BLOCKS': {
            const { startIndex, endIndex } = action.payload;
            if (startIndex < 0 || startIndex >= state.blocks.length || endIndex < 0 || endIndex >= state.blocks.length) {
                logger.warn('[blocksReducer] REORDER_BLOCKS: Invalid startIndex or endIndex');
                return state;
            }
            const movedItems = arrayMove(state.blocks, startIndex, endIndex);
            
            const movedBlock = movedItems[endIndex];
            if (movedBlock && movedBlock.type !== 'listItem') {
                let targetIndentationLevel = 0;
                if (endIndex > 0) {
                    const previousBlock = movedItems[endIndex - 1];
                    if (previousBlock) {
                        const prevMetadata = previousBlock.metadata;
                        targetIndentationLevel = (prevMetadata && 'indentationLevel' in prevMetadata && prevMetadata.indentationLevel !== undefined ? prevMetadata.indentationLevel : 0) ?? 
                                               (previousBlock.type === 'listItem' && prevMetadata && 'depth' in prevMetadata && prevMetadata.depth !== undefined ? prevMetadata.depth : 0);
                    }
                }
                movedItems[endIndex] = {
                    ...movedBlock,
                    metadata: {
                        ...(movedBlock.metadata || {}),
                        indentationLevel: targetIndentationLevel
                    }
                } as Block;
            }
            return { ...state, blocks: movedItems, revisionCount: state.revisionCount + 1 };
        }

        case 'DELETE_BLOCK':
            return {
                ...state,
                blocks: state.blocks.filter((block) => block.id !== action.payload.id),
                selectedBlockIds: state.selectedBlockIds.filter(id => id !== action.payload.id),
                aiHighlightedBlockIds: state.aiHighlightedBlockIds.filter(id => id !== action.payload.id),
                revisionCount: state.revisionCount + 1
            };

        case 'DUPLICATE_BLOCK': {
            const { blockId } = action.payload;
            const targetIndex = state.blocks.findIndex(block => block.id === blockId);
            
            if (targetIndex === -1) {
                logger.warn(`[blocksReducer] DUPLICATE_BLOCK: blockId ${blockId} not found.`);
                return state;
            }

            const blockToDuplicate = state.blocks[targetIndex];
            // On utilise blockIdForActions pour éviter la confusion avec les ids générés par dnd-kit
            const newBlock: Block = {
                ...JSON.parse(JSON.stringify(blockToDuplicate)),
                id: uuidv4() // Assigner un nouvel ID unique
            };

            const newBlocksArray = [...state.blocks];
            newBlocksArray.splice(targetIndex + 1, 0, newBlock); // Insérer juste après
            return { ...state, blocks: newBlocksArray, revisionCount: state.revisionCount + 1 };
        }

        case 'UPDATE_BLOCK': {
            const { blockId, updateStrategy } = action.payload;
            const originalBlockIndex = state.blocks.findIndex(block => block.id === blockId);

            if (originalBlockIndex === -1) {
                logger.warn(`[blocksReducer] UPDATE_BLOCK: blockId ${blockId} not found.`);
                return state;
            }
            const currentBlockFromState = state.blocks[originalBlockIndex]; 
            const newBlocksArray = [...state.blocks];
            
            let updatedBlock: Block;
            if (updateStrategy.type === 'UPDATE_SOURCE_FOR_MODULE') {
                const { newRawSource, moduleType } = updateStrategy;
                console.log("[useBlocksReducer] UPDATE_SOURCE_FOR_MODULE for block", blockId, "moduleType:", moduleType);
                let moduleForUpdate = getBlockModuleByCodeLanguage(moduleType);
                if (!moduleForUpdate) moduleForUpdate = getBlockModuleByType(moduleType);
                console.log("[useBlocksReducer] Found module:", !!moduleForUpdate, "has updateBlockFromSource:", !!(moduleForUpdate && moduleForUpdate.updateBlockFromSource));

                if (moduleForUpdate && moduleForUpdate.updateBlockFromSource) {
                    updatedBlock = moduleForUpdate.updateBlockFromSource(currentBlockFromState, newRawSource, blockId);
                    console.log("[useBlocksReducer] updatedBlock from source:", updatedBlock);
                } else if (currentBlockFromState.type === 'mermaid' && moduleType === 'mermaid') {
                    updatedBlock = {
                        ...(currentBlockFromState as MermaidBlock),
                        content: { code: newRawSource },
                        rawMarkdown: `\`\`\`mermaid\n${newRawSource}\n\`\`\``
                    };
                } else if (currentBlockFromState.type === 'code') {
                    const lang = (currentBlockFromState as CodeBlock).content.language || 'text';
                    updatedBlock = {
                        ...(currentBlockFromState as CodeBlock),
                        content: { ...((currentBlockFromState as CodeBlock).content), code: newRawSource },
                        rawMarkdown: `\`\`\`${lang}\n${newRawSource}\n\`\`\``
                    };
                    console.log("[useBlocksReducer] updatedBlock as code:", updatedBlock);
                } else {
                    console.log("[useBlocksReducer] update failed, returning state");
                    return state;
                }
            } else if (updateStrategy.type === 'UPDATE_METADATA') {
                updatedBlock = {
                    ...currentBlockFromState,
                    metadata: { ...(currentBlockFromState.metadata || {}), ...updateStrategy.metadata }
                };
            } else if (updateStrategy.type === 'REPLACE_WITH_BLOCKS') {
                const { newBlocks } = updateStrategy;
                if (newBlocks.length === 0) {
                    const emptyParagraph: ParagraphBlock = {
                        type: 'paragraph',
                        id: blockId,
                        content: { children: [{ type: 'text', value: '' }] },
                        metadata: { ...(currentBlockFromState.metadata as UniversalBlockMetadata), indentationLevel: (currentBlockFromState.metadata as UniversalBlockMetadata)?.indentationLevel ?? 0 },
                        rawMarkdown: ''
                    };
                    newBlocksArray.splice(originalBlockIndex, 1, emptyParagraph);
                } else {
                    const firstNewBlockParsed = newBlocks[0];
                    const finalMetadata: UniversalBlockMetadata = {
                        ...(currentBlockFromState.metadata as UniversalBlockMetadata),
                        ...(firstNewBlockParsed.metadata as UniversalBlockMetadata),
                        indentationLevel: (firstNewBlockParsed.metadata as UniversalBlockMetadata)?.indentationLevel ?? (currentBlockFromState.metadata as UniversalBlockMetadata)?.indentationLevel ?? 0,
                    };
                    const blockToInsert: Block = { ...firstNewBlockParsed, id: blockId, metadata: finalMetadata } as Block;
                    newBlocksArray.splice(originalBlockIndex, 1, blockToInsert, ...newBlocks.slice(1));
                }
                return { ...state, blocks: newBlocksArray, aiHighlightedBlockIds: state.aiHighlightedBlockIds.filter(id => id !== blockId), revisionCount: state.revisionCount + 1 };
            } else return state;

            newBlocksArray.splice(originalBlockIndex, 1, updatedBlock);
            return { ...state, blocks: newBlocksArray, aiHighlightedBlockIds: state.aiHighlightedBlockIds.filter(id => id !== blockId), revisionCount: state.revisionCount + 1 };
        }

        case 'ADD_BLOCK_AFTER': {
            const { afterId, newBlock } = action.payload;
            const targetIndex = state.blocks.findIndex(block => block.id === afterId);

            let newBlockWithIndentation = { ...newBlock };
            let determinedIndentationLevel = 0;

            if (targetIndex !== -1) {
                const previousBlock = state.blocks[targetIndex];
                if (previousBlock) {
                    const prevMetadata = previousBlock.metadata as GenericMetadata;
                    determinedIndentationLevel = prevMetadata?.indentationLevel ?? (previousBlock.type === 'listItem' ? prevMetadata?.depth ?? 0 : 0);
                }
            } else if (state.blocks.length > 0) {
                const lastBlock = state.blocks[state.blocks.length - 1];
                if (lastBlock) {
                    const lastMetadata = lastBlock.metadata as GenericMetadata;
                    determinedIndentationLevel = lastMetadata?.indentationLevel ?? (lastBlock.type === 'listItem' ? lastMetadata?.depth ?? 0 : 0);
                }
            }

            if (newBlock.type !== 'listItem') {
                newBlockWithIndentation = {
                    ...newBlock,
                    metadata: {
                        ...newBlock.metadata,
                        indentationLevel: determinedIndentationLevel
                    }
                };
            } else {
                 newBlockWithIndentation = {
                    ...newBlock,
                    metadata: {
                        ...newBlock.metadata,
                        depth: (newBlock.metadata as GenericMetadata)?.depth ?? determinedIndentationLevel
                    }
                }
            }

            if (targetIndex === -1) {
                logger.warn(`[blocksReducer] ADD_BLOCK_AFTER: afterId ${afterId} not found. Appending to end.`);
                return { ...state, blocks: [...state.blocks, newBlockWithIndentation], revisionCount: state.revisionCount + 1 };
            }

            const newBlocksArray = [...state.blocks];
            newBlocksArray.splice(targetIndex + 1, 0, newBlockWithIndentation);
            return { ...state, blocks: newBlocksArray, revisionCount: state.revisionCount + 1 };
        }

        case 'ADD_DROPZONE_BLOCK_AFTER': {
            const { afterId } = action.payload;
            const targetIndex = state.blocks.findIndex(block => block.id === afterId);
            
            let indentationLevel = 0;
            if (targetIndex !== -1) {
                const previousBlock = state.blocks[targetIndex];
                indentationLevel = (previousBlock.metadata as GenericMetadata)?.indentationLevel ?? 
                                   (previousBlock.type === 'listItem' ? (previousBlock.metadata as GenericMetadata)?.depth ?? 0 : 0);
            } else if (state.blocks.length > 0) {
                const lastBlock = state.blocks[state.blocks.length - 1];
                indentationLevel = (lastBlock.metadata as GenericMetadata)?.indentationLevel ?? 
                                   (lastBlock.type === 'listItem' ? (lastBlock.metadata as GenericMetadata)?.depth ?? 0 : 0);
            }

            const newDropZoneBlock: DropZoneBlock = {
                id: uuidv4(),
                type: 'dropZone',
                content: {},
                metadata: { 
                    indentationLevel: indentationLevel,
                }
            };

            if (targetIndex === -1) {
                logger.warn(`[blocksReducer] ADD_DROPZONE_BLOCK_AFTER: afterId ${afterId} not found. Appending to end.`);
                return { ...state, blocks: [...state.blocks, newDropZoneBlock], revisionCount: state.revisionCount + 1 };
            }

            const newBlocksArray = [...state.blocks];
            newBlocksArray.splice(targetIndex + 1, 0, newDropZoneBlock);
            return { ...state, blocks: newBlocksArray, revisionCount: state.revisionCount + 1 };
        }

        case 'ADD_SUMMARY_BLOCK': {
          const summaryText = generateSummaryMarkdown(state.blocks);
          const newSummaryCodeBlock: CodeBlock = {
            id: uuidv4(),
            type: 'code',
            content: {
              language: 'summary',
              code: summaryText,
            },
            metadata: { indentationLevel: 0 },
            rawMarkdown: summaryText,
          };
          return { ...state, blocks: [newSummaryCodeBlock, ...state.blocks], revisionCount: state.revisionCount + 1 };
        }

        case 'ADD_BLOCK_AT_END': {
            const { newBlock } = action.payload;
            let newBlockWithIndentation = { ...newBlock };
            let determinedIndentationLevel = 0;

            if (state.blocks.length > 0) {
                const lastBlock = state.blocks[state.blocks.length - 1];
                if (lastBlock) {
                    const lastMetadata = lastBlock.metadata as GenericMetadata;
                    determinedIndentationLevel = lastMetadata?.indentationLevel ?? (lastBlock.type === 'listItem' ? lastMetadata?.depth ?? 0 : 0);
                }
            }

            if (newBlock.type !== 'listItem') {
                newBlockWithIndentation = {
                    ...newBlock,
                    metadata: {
                        ...newBlock.metadata,
                        indentationLevel: determinedIndentationLevel
                    }
                };
            } else {
                 newBlockWithIndentation = {
                    ...newBlock,
                    metadata: {
                        ...newBlock.metadata,
                        depth: (newBlock.metadata as GenericMetadata)?.depth ?? determinedIndentationLevel
                    }
                }
            }
            return { ...state, blocks: [...state.blocks, newBlockWithIndentation], revisionCount: state.revisionCount + 1 };
        }

        case 'INCREASE_INDENTATION': {
            const { blockId } = action.payload;
            const blockIndex = state.blocks.findIndex(b => b.id === blockId);
            if (blockIndex === -1) return state;

            const currentBlock = state.blocks[blockIndex];
            const newBlocksArray = [...state.blocks];

            if (currentBlock.type === 'listItem') {
                const currentMetadata = currentBlock.metadata;
                newBlocksArray[blockIndex] = {
                    ...currentBlock,
                    metadata: {
                        ...currentMetadata,
                        depth: (currentMetadata?.depth ?? 0) + 1,
                    },
                } as ListItemBlock;
            } else {
                const currentMetadata = currentBlock.metadata;
                newBlocksArray[blockIndex] = {
                    ...currentBlock,
                    metadata: {
                        ...currentMetadata,
                        indentationLevel: ((currentMetadata && 'indentationLevel' in currentMetadata && currentMetadata.indentationLevel !== undefined ? currentMetadata.indentationLevel : 0)) + 1,
                    },
                } as Block;
            }
            return { ...state, blocks: newBlocksArray, revisionCount: state.revisionCount + 1 };
        }

        case 'DECREASE_INDENTATION': {
            const { blockId } = action.payload;
            const blockIndex = state.blocks.findIndex(b => b.id === blockId);
            if (blockIndex === -1) return state;

            const currentBlock = state.blocks[blockIndex];
            const newBlocksArray = [...state.blocks];

            if (currentBlock.type === 'listItem') {
                const currentMetadata = currentBlock.metadata;
                if ((currentMetadata?.depth ?? 0) > 0) {
                    newBlocksArray[blockIndex] = {
                        ...currentBlock,
                        metadata: {
                            ...currentMetadata,
                            depth: (currentMetadata.depth ?? 0) - 1,
                        },
                    } as ListItemBlock;
                }
            } else {
                const currentMetadata = currentBlock.metadata;
                if (((currentMetadata && 'indentationLevel' in currentMetadata && currentMetadata.indentationLevel !== undefined ? currentMetadata.indentationLevel : 0)) > 0) {
                    newBlocksArray[blockIndex] = {
                        ...currentBlock,
                        metadata: {
                            ...currentBlock.metadata,
                            indentationLevel: ((currentMetadata && 'indentationLevel' in currentMetadata && currentMetadata.indentationLevel !== undefined ? currentMetadata.indentationLevel : 0)) - 1,
                        },
                    } as Block;
                }
            }
            return { ...state, blocks: newBlocksArray, revisionCount: state.revisionCount + 1 };
        }

        case 'TOGGLE_SELECTION_MODE':
            return {
                ...state,
                isSelectionModeActive: !state.isSelectionModeActive,
                selectedBlockIds: !state.isSelectionModeActive ? state.selectedBlockIds : [],
            };

        case 'TOGGLE_BLOCK_SELECTION': {
            const { blockId } = action.payload;
            const currentIndex = state.selectedBlockIds.indexOf(blockId);
            let newSelectedBlockIds = [...state.selectedBlockIds];
            if (currentIndex === -1) {
                newSelectedBlockIds.push(blockId);
            } else {
                newSelectedBlockIds.splice(currentIndex, 1);
            }
            return { ...state, selectedBlockIds: newSelectedBlockIds };
        }

        case 'CLEAR_BLOCK_SELECTION':
            return { ...state, selectedBlockIds: [] };

        case 'DELETE_SELECTED_BLOCKS':
            return {
                ...state,
                blocks: state.blocks.filter(block => !state.selectedBlockIds.includes(block.id)),
                aiHighlightedBlockIds: state.aiHighlightedBlockIds.filter(id => !state.selectedBlockIds.includes(id)),
                selectedBlockIds: [],
                revisionCount: state.revisionCount + 1
            };
        
        case 'SET_SELECTED_BLOCKS_BATCH': {
            const { blockIds, append } = action.payload;
            if (append) {
                const newSelection = Array.from(new Set([...state.selectedBlockIds, ...blockIds]));
                return { 
                    ...state, 
                    selectedBlockIds: newSelection,
                    isSelectionModeActive: newSelection.length > 0 ? true : state.isSelectionModeActive
                };
            }
            return { 
                ...state, 
                selectedBlockIds: blockIds,
                isSelectionModeActive: blockIds.length > 0 ? true : state.isSelectionModeActive
            };
        }

        case 'SET_AI_HIGHLIGHTS':
            return { ...state, aiHighlightedBlockIds: action.payload };

        case 'CLEAR_AI_HIGHLIGHTS':
            return { ...state, aiHighlightedBlockIds: [] };

        case 'CLEAR_AI_HIGHLIGHT_FOR_BLOCK':
            return { ...state, aiHighlightedBlockIds: state.aiHighlightedBlockIds.filter(id => id !== action.payload) };

        case 'DELETE_BLOCKS_BY_TYPE':
            return {
                ...state,
                blocks: state.blocks.filter(block => {
                    if (block.type === 'code') return (block as CodeBlock).content.language !== action.payload;
                    return block.type !== action.payload;
                }),
                aiHighlightedBlockIds: state.aiHighlightedBlockIds.filter(id => {
                   const b = state.blocks.find(bl => bl.id === id);
                   if (!b) return false;
                   if (b.type === 'code') return (b as CodeBlock).content.language !== action.payload;
                   return b.type !== action.payload;
                }),
                revisionCount: state.revisionCount + 1
            };
        
        default:
            logger.warn(`[blocksReducer] Unknown action type: ${(action as any).type}`, (action as any).payload);
            return state;
    }
};

// --- HIGHER ORDER REDUCER POUR UNDO/REDO ---

export { blocksReducer };
