import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { markdownToBlocks, Block, TextInline, ListItemBlock, ImageBlock, MarkerStyle } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Initialisation du logger pour ce hook
const logger = new PinoLogger();

// Helper interne pour créer un bloc texte inline
const createTextInline = (text: string): TextInline => ({ type: 'text', value: text });

// Interface pour les valeurs de retour du hook
interface UseBlocksManagementReturn {
  blocks: Block[];
  setExternalBlocks: (newBlocks: Block[]) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDeleteBlock: (idToDelete: string) => void;
  handleBlockContentChange: (blockId: string, newText: string) => void;
  handleAddBlockAfter: (data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => void;
  handleIncreaseIndentation: (blockId: string) => void;
  handleDecreaseIndentation: (blockId: string) => void;
}

/**
 * Hook personnalisé pour gérer l'état et la logique des blocs Markdown.
 * @param initialBlocks Le tableau de blocs initial pour peupler l'état.
 * @returns Un objet contenant l'état des blocs et les fonctions pour les manipuler.
 */
export const useBlocksManagement = (initialBlocks: Block[]): UseBlocksManagementReturn => {
  // État des blocs, initialisé directement
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);

  // --- AJOUT: Fonction pour mettre à jour depuis l'extérieur ---
  const setExternalBlocks = useCallback((newBlocks: Block[]) => {
      logger.debug('[useBlocksManagement] Setting external blocks.');
      setBlocks(newBlocks);
  }, [setBlocks]);

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
              
              // Appliquer le déplacement
              const movedItems = arrayMove(items, oldIndex, newIndex);

              // << AJOUT: Logique d'ajustement de l'indentation après déplacement >>
              const movedBlockId = active.id;
              const finalIndex = movedItems.findIndex((item) => item.id === movedBlockId);

              if (finalIndex !== -1) {
                  const blockToUpdate = movedItems[finalIndex];
                  // On n'ajuste l'indentation que pour les blocs NON-listItem
                  if (blockToUpdate.type !== 'listItem') {
                      let targetIndentationLevel = 0;
                      if (finalIndex > 0) {
                          const previousBlock = movedItems[finalIndex - 1];
                          if (previousBlock.type === 'listItem') {
                              // Basé sur la depth du listItem précédent
                              targetIndentationLevel = (previousBlock as ListItemBlock).metadata.depth;
                              logger.debug(`[useBlocksManagement] Moved block ${movedBlockId} after listItem, setting indentationLevel to ${targetIndentationLevel} (from listItem depth)`);
                          } else {
                              // Basé sur l'indentationLevel du bloc standard précédent
                              targetIndentationLevel = previousBlock.metadata?.indentationLevel ?? 0;
                              logger.debug(`[useBlocksManagement] Moved block ${movedBlockId} after standard block, setting indentationLevel to ${targetIndentationLevel}`);
                          }
                      } else {
                           logger.debug(`[useBlocksManagement] Moved block ${movedBlockId} to top, setting indentationLevel to 0`);
                      }

                      // Mettre à jour le bloc déplacé avec la nouvelle indentation
                      movedItems[finalIndex] = {
                          ...blockToUpdate,
                          metadata: {
                              ...blockToUpdate.metadata,
                              indentationLevel: targetIndentationLevel
                          }
                      };
                  }
              }
              // -- Fin de la logique d'indentation --

              return movedItems;
          });
      }
  }, []);

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
                // << AJOUT: Sauvegarder l'indentation originale >>
                const originalIndentationLevel = originalBlock.metadata?.indentationLevel;

                let parsedNewBlocks = markdownToBlocks(newText);
                if (parsedNewBlocks.length === 0) {
                   // Crée un paragraphe vide s'il n'y a rien
                   parsedNewBlocks = [{ id: uuidv4(), type: 'paragraph', content: { children: [createTextInline('')] }, metadata: { indentationLevel: originalIndentationLevel } }]; // << MODIF: Inclure indentationLevel >>
                } else {
                  // Traiter les blocs parsés
                  parsedNewBlocks = parsedNewBlocks.map(block => {
                      const newId = uuidv4();
                      const baseMetadata = block.metadata ?? {};
                      let finalIndentationLevel = originalIndentationLevel; // Par défaut, on hérite

                      // Si le bloc parsé est lui-même un paragraphe, on garde l'indentation originale.
                      // Si c'est un autre type (ex: une liste créée en tapant "- "), 
                      // l'indentationLevel sera ignoré par le renderer de ce nouveau type.
                      // Si l'edit a créé plusieurs blocs, seul le premier héritera ? Pour l'instant, tous héritent.
                      if (block.type !== 'listItem') { // Ne pas écraser la depth des listItems
                          finalIndentationLevel = ('indentationLevel' in baseMetadata ? baseMetadata.indentationLevel : originalIndentationLevel) ?? 0;
                      } else {
                        finalIndentationLevel = undefined; // Les listItems n'utilisent pas indentationLevel
                      }

                      if (block.type === 'listItem') {
                          return {
                              ...block,
                              id: newId,
                              metadata: {
                                  depth: (baseMetadata as any).depth ?? 0,
                                  ordered: (baseMetadata as any).ordered ?? false,
                                  checked: (baseMetadata as any).checked,
                                  markerStyle: (baseMetadata as any).markerStyle,
                                  position: baseMetadata.position
                              }
                          } as ListItemBlock;
                      } else {
                          // Pour les autres types, inclure l'indentation héritée/calculée
                          return {
                              ...block,
                              id: newId,
                              metadata: {
                                  position: baseMetadata.position,
                                  // << MODIF: Assigner finalIndentationLevel >>
                                  indentationLevel: finalIndentationLevel 
                              }
                          };
                      }
                  });
                }
                // Remplacer l'ancien bloc par le(s) nouveau(x)
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
                let updatedBlock: Block | null = null;

                // Mettre à jour le contenu spécifique au type tout en préservant le type et les métadonnées
                switch (originalBlock.type) {
                    case 'heading':
                        updatedBlock = {
                            ...originalBlock,
                            metadata: { ...originalBlock.metadata }, // Préserver les métadonnées
                            content: { 
                                ...originalBlock.content,
                                children: [createTextInline(newText)] 
                            }
                        };
                        break;
                    case 'blockquote':
                         updatedBlock = {
                            ...originalBlock,
                            metadata: { ...originalBlock.metadata }, 
                            content: { 
                                ...originalBlock.content,
                                children: [createTextInline(newText)] 
                            }
                        };
                        break;
                    case 'listItem':
                        updatedBlock = {
                            ...originalBlock,
                            metadata: { ...originalBlock.metadata }, // Préserve depth, ordered, checked, etc.
                            content: { 
                                ...originalBlock.content,
                                children: [createTextInline(newText)] 
                            }
                        } as ListItemBlock; // Cast explicite pour aider TS
                        break;
                    case 'code':
                         updatedBlock = {
                            ...originalBlock,
                            metadata: { ...originalBlock.metadata }, 
                            content: { 
                                ...originalBlock.content, // Préserve language, etc.
                                code: newText
                            }
                        };
                        break;
                    default:
                        // Ce cas ne devrait pas être atteint à cause du `includes` plus haut
                        logger.warn(`[useBlocksManagement] Unexpected block type in direct update switch: ${originalBlock.type}`);
                        break;
                }
                
                if (updatedBlock) {
                  const updatedBlocks = [...currentBlocks];
                  updatedBlocks[editedBlockIndex] = updatedBlock; // TS devrait être satisfait ici
                  logger.debug("[useBlocksManagement] Updated block content directly (with metadata preservation):", updatedBlock);
                  return updatedBlocks;
                } else {
                  // Si updatedBlock est resté null (cas default inattendu)
                  return currentBlocks;
                }

              } catch (error) {
                logger.error("[useBlocksManagement] Error directly updating block content:", { error, blockId, blockType: originalBlock.type });
                return currentBlocks;
              }
          } 
          // CAS 4: Image update 
          else if (originalBlock.type === 'image') {
              logger.debug(`[useBlocksManagement] Image update detected for ${blockId}. Parsing new markdown...`);
              try {
                  const parsedImageBlocks = markdownToBlocks(newText); // newText est ![alt](src "title")
                  if (parsedImageBlocks.length === 1 && parsedImageBlocks[0].type === 'image') {
                      const parsedImageBlock = parsedImageBlocks[0] as ImageBlock;
                      // Créer le bloc mis à jour en gardant l'ID et les métadonnées d'origine,
                      // mais en utilisant le nouveau contenu parsé.
                      const updatedBlock = {
                          ...originalBlock, // Garde id, type, metadata
                          content: parsedImageBlock.content // Prend la nouvelle src, alt, title
                      };
                      const updatedBlocks = [...currentBlocks];
                      updatedBlocks[editedBlockIndex] = updatedBlock;
                      logger.debug("[useBlocksManagement] Updated image block content via parsing:", updatedBlock);
                      return updatedBlocks;
                  } else {
                      logger.error("[useBlocksManagement] Failed to parse updated image markdown correctly.", { newText, parsedResult: parsedImageBlocks });
                      return currentBlocks;
                  }
              } catch (error) {
                  logger.error("[useBlocksManagement] Error parsing updated image markdown:", { error, blockId, newText });
                  return currentBlocks;
              }
          }
          // CAS 5: Unhandled types
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
             // << AJOUT: Calcul de l'indentation initiale >>
             let initialIndentationLevel = 0;
             // Utiliser targetBlock directement car on a déjà vérifié targetBlockIndex
             if (targetBlock.type === 'listItem') {
                 initialIndentationLevel = (targetBlock as ListItemBlock).metadata.depth;
             } else {
                 initialIndentationLevel = targetBlock.metadata?.indentationLevel ?? 0;
             }
             logger.debug(`[useBlocksManagement] New standard block inheriting indentationLevel: ${initialIndentationLevel}`);
             // << FIN AJOUT >>

            switch (selectedType) {
                // << MODIFIÉ: Appliquer initialIndentationLevel >>
                case 'paragraph': newBlock = { id: newId, type: 'paragraph', content: { children: [createTextInline('Nouveau paragraphe')] }, metadata: { indentationLevel: initialIndentationLevel } }; break; 
                case 'heading1': newBlock = { id: newId, type: 'heading', content: { level: 1, children: [createTextInline('Nouveau Titre 1')] }, metadata: { indentationLevel: initialIndentationLevel } }; break;
                case 'heading2': newBlock = { id: newId, type: 'heading', content: { level: 2, children: [createTextInline('Nouveau Titre 2')] }, metadata: { indentationLevel: initialIndentationLevel } }; break;
                case 'code': newBlock = { id: newId, type: 'code', content: { code: '// Votre code ici...', language: 'plaintext' }, metadata: { indentationLevel: initialIndentationLevel } }; break;
                case 'mermaid': newBlock = { id: newId, type: 'mermaid', content: { code: 'graph TD;\n  A-->B;' }, metadata: { indentationLevel: initialIndentationLevel } }; break;
                case 'image': 
                    const imageUrl = prompt("Entrez l'URL de l'image :", "https://");
                    if (imageUrl) {
                        newBlock = { 
                            id: newId, 
                            type: 'image', 
                            content: { src: imageUrl, alt: '', title: undefined }, 
                            metadata: { indentationLevel: initialIndentationLevel } // << MODIFIÉ
                        }; 
                    } else {
                        logger.debug("[useBlocksManagement] Image block creation cancelled by user.");
                    }
                    break;
                case 'blockquote': newBlock = { id: newId, type: 'blockquote', content: { children: [createTextInline('Nouvelle citation')] }, metadata: { indentationLevel: initialIndentationLevel } }; break;
                case 'table': 
                    const defaultCsvContent = "Header 1,Header 2\nCellule 1A,Cellule 1B\nCellule 2A,Cellule 2B";
                    newBlock = { 
                        id: newId, 
                        type: 'code', 
                        content: { code: defaultCsvContent, language: 'csv' }, 
                        metadata: { indentationLevel: initialIndentationLevel } // << MODIFIÉ
                    }; 
                    break;
                case 'html': newBlock = { id: newId, type: 'html', content: { html: '<div>Nouveau HTML</div>' }, metadata: { indentationLevel: initialIndentationLevel } }; break;
                case 'thematicBreak': newBlock = { id: newId, type: 'thematicBreak', content: {}, metadata: {} }; break; // Pas d'indentation
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
            logger.debug("[useBlocksManagement] No new block created (newBlock is null), skipping insertion.");
            return currentBlocks;
        }
    });
  }, []); // Dépend de setBlocks implicitement

  // --- Fonctions de rappel (extraites de App.tsx) --- 

  // --- Logique d'indentation ---
  const handleIncreaseIndentation = useCallback((blockId: string) => {
      logger.debug(`[useBlocksManagement] Increasing indentation for block: ${blockId}`);
      setBlocks(currentBlocks => 
          currentBlocks.map(block => {
              if (block.id === blockId && block.type !== 'listItem') { // Ne pas modifier la depth des listItems ici
                  const currentLevel = block.metadata.indentationLevel ?? 0;
                  const newLevel = currentLevel + 1;
                  logger.debug(`[useBlocksManagement] Block ${blockId} - New indentation level calculated: ${newLevel}`);
                  const updatedBlock = {
                      ...block,
                      metadata: { ...block.metadata, indentationLevel: newLevel }
                  };
                  logger.debug(`[useBlocksManagement] Block ${blockId} - Returning updated block:`, JSON.stringify(updatedBlock));
                  return updatedBlock;
              }
              return block;
          })
      );
  }, []); // Dépend implicitement de setBlocks

  const handleDecreaseIndentation = useCallback((blockId: string) => {
      logger.debug(`[useBlocksManagement] Decreasing indentation for block: ${blockId}`);
      setBlocks(currentBlocks => 
          currentBlocks.map(block => {
              if (block.id === blockId && block.type !== 'listItem') {
                  const currentLevel = block.metadata.indentationLevel ?? 0;
                  if (currentLevel > 0) {
                      const newLevel = currentLevel - 1;
                      logger.debug(`[useBlocksManagement] New indentation level: ${newLevel}`);
                      return {
                          ...block,
                          metadata: { ...block.metadata, indentationLevel: newLevel }
                      };
                  } else {
                     logger.debug(`[useBlocksManagement] Already at minimum indentation (0).`);
                  }
              }
              return block;
          })
      );
  }, []); // Dépend implicitement de setBlocks

  // Retourner l'état et les fonctions
  return {
    blocks,
    setExternalBlocks,
    handleDragEnd,
    handleDeleteBlock,
    handleBlockContentChange,
    handleAddBlockAfter,
    handleIncreaseIndentation,
    handleDecreaseIndentation,
  };
}; 