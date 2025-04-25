import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { markdownToBlocks, Block, InlineElement, TextInline, ListItemBlock, MarkerStyle } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Initialisation du logger pour ce hook
const logger = new PinoLogger();

// Helper interne pour créer un bloc texte inline
const createTextInline = (text: string): TextInline => ({ type: 'text', value: text });

// Interface pour les valeurs de retour du hook
interface UseBlocksManagementReturn {
  blocks: Block[];
  handleDragEnd: (event: DragEndEvent) => void;
  handleDeleteBlock: (idToDelete: string) => void;
  handleBlockContentChange: (blockId: string, newText: string) => void;
  handleAddBlockAfter: (data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => void;
}

/**
 * Hook personnalisé pour gérer l'état et la logique des blocs Markdown.
 * @param initialMarkdown Le contenu Markdown initial pour peupler les blocs.
 * @returns Un objet contenant l'état des blocs et les fonctions pour les manipuler.
 */
export const useBlocksManagement = (initialMarkdown: string): UseBlocksManagementReturn => {
  // État des blocs
  const initialBlocks = useMemo(() => {
      logger.debug('[useBlocksManagement] Initializing blocks from markdown...');
      return markdownToBlocks(initialMarkdown);
  }, [initialMarkdown]);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);

  // --- Fonctions de rappel (extraites de App.tsx) --- 

  const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
          logger.debug(`[useBlocksManagement] DragEnd: Active ID ${active.id}, Over ID ${over.id}`);
          setBlocks((items) => {
              const oldIndex = items.findIndex((item) => item.id === active.id);
              const newIndex = items.findIndex((item) => item.id === over.id);
              if (oldIndex === -1 || newIndex === -1) {
                  logger.error('[useBlocksManagement] Could not find block index during drag end', { activeId: active.id, overId: over.id, oldIndex, newIndex });
                  return items;
              }
              logger.debug(`[useBlocksManagement] Moving block from index ${oldIndex} to ${newIndex}`);
              return arrayMove(items, oldIndex, newIndex);
          });
      }
  }, []); // Pas de dépendance externe directe, arrayMove est pur, setBlocks gère la clôture.

  const handleDeleteBlock = useCallback((idToDelete: string) => {
      logger.debug(`[useBlocksManagement] Attempting to delete block with ID: ${idToDelete}`);
      setBlocks((currentBlocks) => 
          currentBlocks.filter((block) => block.id !== idToDelete)
      );
  }, []); // Dépend de setBlocks implicitement

  const handleBlockContentChange = useCallback((blockId: string, newText: string) => {
      logger.debug(`[useBlocksManagement] handleBlockContentChange called for block ID: ${blockId} with text:`, newText);
      setBlocks(currentBlocks => {
          const editedBlockIndex = currentBlocks.findIndex(b => b.id === blockId);
          if (editedBlockIndex === -1) {
              logger.error(`[useBlocksManagement] Block with ID ${blockId} not found for update.`);
              return currentBlocks; 
          }
          const originalBlock = currentBlocks[editedBlockIndex];
          logger.debug(`[useBlocksManagement] Original block type: ${originalBlock.type}`);

          // --- Logique Conditionnelle (Identique à App.tsx) --- 
          // CAS 1: Checkbox toggle
          if (originalBlock.type === 'listItem' && /^(?:\s*[-*]|\d+\.)\s+\[[ x]\]\s/.test(newText)) {
             logger.debug(`[useBlocksManagement] Checkbox toggle detected for ${blockId}.`);
             try {
                const parsedCheckboxItemArray = markdownToBlocks(newText);
                if (parsedCheckboxItemArray.length === 1 && parsedCheckboxItemArray[0].type === 'listItem') {
                    const updatedItem = { ...parsedCheckboxItemArray[0], id: blockId }; 
                    const updatedBlocks = [...currentBlocks];
                    updatedBlocks[editedBlockIndex] = updatedItem;
                    logger.debug("[useBlocksManagement] Checkbox state updated via parsing.", updatedItem);
                    return updatedBlocks;
                } else {
                    logger.error("[useBlocksManagement] Failed to parse checkbox line correctly.", { newText, parsedResult: parsedCheckboxItemArray });
                    return currentBlocks;
                }
            } catch (error) {
                logger.error("[useBlocksManagement] Error parsing checkbox update line:", { error, blockId, newText });
                return currentBlocks;
            }
          }
          // CAS 2: Paragraph edit (parsing)
          else if (originalBlock.type === 'paragraph') {
             logger.debug(`[useBlocksManagement] Paragraph edit detected for ${blockId}.`);
             try {
                let parsedNewBlocks = markdownToBlocks(newText);
                if (parsedNewBlocks.length === 0) {
                   parsedNewBlocks = [{ id: uuidv4(), type: 'paragraph', content: { children: [createTextInline('')] } }];
                } else {
                  parsedNewBlocks = parsedNewBlocks.map(block => ({ ...block, id: uuidv4() }));
                }
                const updatedBlocks = [
                    ...currentBlocks.slice(0, editedBlockIndex),
                    ...parsedNewBlocks, 
                    ...currentBlocks.slice(editedBlockIndex + 1)
                ];
                logger.debug("[useBlocksManagement] Final updated blocks array after paragraph parse:", updatedBlocks);
                return updatedBlocks;
            } catch (error) {
                logger.error("[useBlocksManagement] Error parsing new paragraph content:", { error, blockId, newText });
                return currentBlocks;
            }
          }
          // CAS 3: Pure text edit (direct update)
          else if (['heading', 'code', 'blockquote', 'listItem'].includes(originalBlock.type)) {
              logger.debug(`[useBlocksManagement] Pure text update detected for ${originalBlock.type} block ${blockId}.`);
              try {
                const updatedBlock = JSON.parse(JSON.stringify(originalBlock));
                switch (updatedBlock.type) {
                    case 'heading':
                    case 'blockquote':
                    case 'listItem': 
                        updatedBlock.content.children = [createTextInline(newText)]; 
                        break;
                    case 'code':
                        updatedBlock.content.code = newText;
                        break;
                }
                const updatedBlocks = [...currentBlocks];
                updatedBlocks[editedBlockIndex] = updatedBlock;
                logger.debug("[useBlocksManagement] Updated block content directly:", updatedBlock);
                return updatedBlocks;
              } catch (error) {
                logger.error("[useBlocksManagement] Error directly updating block content:", { error, blockId, blockType: originalBlock.type });
                return currentBlocks;
              }
          } 
          // CAS 4: Unhandled types
          else {
              logger.warn(`[useBlocksManagement] handleBlockContentChange called for unhandled block type: ${originalBlock.type}. No action taken.`);
              return currentBlocks;
          }
      });
  }, []); // Dépend de setBlocks implicitement

  const handleAddBlockAfter = useCallback((data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => {
    const { sortableId, selectedType, markerStyle } = data; 
    logger.debug(`[useBlocksManagement] handleAddBlockAfter called with target block ID: ${sortableId}, selectedType: ${selectedType}, markerStyle: ${markerStyle}`);
    
    setBlocks(currentBlocks => { // Utiliser la forme fonctionnelle de setBlocks
        const targetBlockIndex = currentBlocks.findIndex(b => b.id === sortableId);
        if (targetBlockIndex === -1) {
            logger.error(`[useBlocksManagement] Could not find target block with ID: ${sortableId}`);
            return currentBlocks;
        }
        
        const targetBlock = currentBlocks[targetBlockIndex];
        let insertIndex = targetBlockIndex + 1;
        const newId = uuidv4();
        let newBlock: Block | null = null;

        // --- CAS A: ACTIONS SPÉCIFIQUES AUX LISTES (Identique à App.tsx) --- 
        if (selectedType === 'addListItemSibling' || selectedType === 'addListItemChild') {
           if (targetBlock.type === 'listItem') {
                const targetListItem = targetBlock as ListItemBlock;
                const currentIndentation = targetListItem.metadata.depth;
                const currentListTypeOrdered = targetListItem.metadata.ordered;
                let finalInsertIndex: number;
                let newIndentation: number;
                let newOrdered: boolean;

                if (selectedType === 'addListItemChild') {
                   newIndentation = currentIndentation + 1;
                   newOrdered = markerStyle ? (markerStyle === 'decimal' || markerStyle === 'lower-alpha' || markerStyle === 'lower-roman') : currentListTypeOrdered;
                   finalInsertIndex = targetBlockIndex + 1;
                } else { // Cas addListItemSibling
                   newIndentation = currentIndentation;
                   newOrdered = currentListTypeOrdered;
                   logger.debug(`[useBlocksManagement - Sibling] Target index: ${targetBlockIndex}. Sibling props: depth=${newIndentation}, ordered=${newOrdered}`);
                   let insertionSearchIndex = targetBlockIndex + 1;
                   logger.debug(`[useBlocksManagement - Sibling] Starting insertion search at index: ${insertionSearchIndex}`);
                   while (insertionSearchIndex < currentBlocks.length) {
                        const blockToTest = currentBlocks[insertionSearchIndex];
                        logger.debug(`[useBlocksManagement - Sibling] Testing block at index ${insertionSearchIndex}: type=${blockToTest.type}`);
                        if (blockToTest.type === 'heading') {
                           logger.debug(`[useBlocksManagement - Sibling] Found heading at index ${insertionSearchIndex}. Stopping search.`);
                           break;
                        }
                        if (blockToTest.type === 'listItem' && 
                            (blockToTest as ListItemBlock).metadata.depth === newIndentation && 
                            (blockToTest as ListItemBlock).metadata.ordered === newOrdered) {
                             logger.debug(`[useBlocksManagement - Sibling] Found same-level/type listItem at index ${insertionSearchIndex}. Stopping search.`);
                            break;
                        }
                        logger.debug(`[useBlocksManagement - Sibling] Block at ${insertionSearchIndex} is intermediate. Continuing search.`);
                        insertionSearchIndex++;
                   }
                   finalInsertIndex = insertionSearchIndex;
                   logger.debug(`[useBlocksManagement - Sibling] Final determined insert index: ${finalInsertIndex}`);
                }
                const newCheckedState = undefined; 
                newBlock = {
                    id: newId,
                    type: 'listItem',
                    content: { children: [createTextInline('Nouvel élément')] },
                    metadata: {
                        depth: newIndentation, 
                        ordered: newOrdered, 
                        checked: newCheckedState,
                        markerStyle: selectedType === 'addListItemChild' ? markerStyle : targetListItem.metadata.markerStyle
                    }
                };
                logger.debug(`[useBlocksManagement] Created new listItem:`, newBlock);
                insertIndex = finalInsertIndex;
            } else {
                logger.error(`[useBlocksManagement] List action triggered for non-listItem block ID: ${sortableId}`);
                return currentBlocks;
            }
        } 
        // --- CAS B: TYPES DE BLOCS STANDARD (Identique à App.tsx) --- 
        else {
            switch (selectedType) {
                case 'paragraph': newBlock = { id: newId, type: 'paragraph', content: { children: [createTextInline('Nouveau paragraphe')] } }; break; 
                case 'heading1': newBlock = { id: newId, type: 'heading', content: { level: 1, children: [createTextInline('Nouveau Titre 1')] } }; break;
                case 'heading2': newBlock = { id: newId, type: 'heading', content: { level: 2, children: [createTextInline('Nouveau Titre 2')] } }; break;
                case 'code': newBlock = { id: newId, type: 'code', content: { code: '// Votre code ici...', language: 'plaintext' } }; break;
                case 'mermaid': newBlock = { id: newId, type: 'mermaid', content: { code: 'graph TD;\n  A-->B;' } }; break;
                case 'image': newBlock = { id: newId, type: 'image', content: { src: 'https://via.placeholder.com/150', alt: 'Nouvelle image' } }; break;
                case 'blockquote': newBlock = { id: newId, type: 'blockquote', content: { children: [createTextInline('Nouvelle citation')] } }; break;
                case 'table': newBlock = { id: newId, type: 'table', content: { align: ['left', 'left'], rows: [[[{ type: 'text', value: 'Header' }],[{ type: 'text', value: 'Header' }]],[[{ type: 'text', value: 'Cell' }],[{ type: 'text', value: 'Cell' }]]]}}; break;
                case 'html': newBlock = { id: newId, type: 'html', content: { html: '<div>Nouveau HTML</div>' } }; break;
                case 'thematicBreak': newBlock = { id: newId, type: 'thematicBreak', content: {} }; break;
                default: logger.warn(`[useBlocksManagement] Unknown or unhandled standard block type selected: ${selectedType}`);
            }
            logger.debug(`[useBlocksManagement] Created new standard block:`, newBlock);
        }

        // --- Insertion du bloc (Identique à App.tsx) --- 
        if (newBlock) {
            logger.debug(`[useBlocksManagement] Attempting to insert block type ${newBlock.type} at index: ${insertIndex}`);
            const updatedBlocks = [...currentBlocks];
            updatedBlocks.splice(insertIndex, 0, newBlock);
            return updatedBlocks;
        } else {
            logger.error(`[useBlocksManagement] Failed to create new block for insertion.`);
            return currentBlocks; // Retourner l'état précédent en cas d'échec
        }
    });
  }, []); // Dépend de setBlocks implicitement

  // Retourner l'état et les fonctions
  return {
    blocks,
    handleDragEnd,
    handleDeleteBlock,
    handleBlockContentChange,
    handleAddBlockAfter,
  };
}; 