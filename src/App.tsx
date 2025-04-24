import { useEffect, useMemo, useState, useCallback } from 'react';
import Header from './presentation/components/layout/Header';
import MainContent from './presentation/components/layout/MainContent';
import Footer from './presentation/components/layout/Footer';
import { useUiStore } from './application/state/uiStore';
import mermaid from 'mermaid';
import { v4 as uuidv4 } from 'uuid';

// Importer les éléments nécessaires pour le rendu Markdown
import { markdownToBlocks, Block, InlineElement, TextInline, ListItemBlock } from './application/logic/markdownParser';
import MarkdownRenderer from './presentation/components/MarkdownRenderer';

// Importer le logger
import { PinoLogger } from './infrastructure/logging/PinoLogger';

// Importer DndContext et les capteurs (sensors)
import { 
    DndContext, 
    closestCenter, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors, 
    DragEndEvent // Importer le type d'événement
} from '@dnd-kit/core';

// Importer l'utilitaire pour réorganiser le tableau
import { 
    arrayMove, 
    SortableContext, // Importer SortableContext
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy // Importer la stratégie de tri
} from '@dnd-kit/sortable';

import type { MarkerStyle } from './application/logic/markdownParser';

// Exemple de contenu Markdown
const sampleMarkdown = `# Titre Principal

Ceci est un paragraphe avec du **gras**, de l'*italique*, du \`code inline\` et du ~~texte barré~~.\nVoici aussi un [lien vers Google](https://google.com "Tooltip Google") !

## Sous-titre

- Liste non ordonnée
- Item 2 avec \`code\`
  - Sous-item
  - Autre sous-item avec [lien](url)
    1. Numéroté
    2. Encore un
- Item 3

1. Liste ordonnée
2. Deuxième

\`\`\`javascript
console.log("Hello, world!");
\`\`\`

> Ceci est une citation.
> Elle peut contenir du *style* et du \`code inline\`.\n

***

| Header 1 | Header 2         |
| :------- | :--------------- |
| Gauche   | **Centre** gras  |
| Test     | *Ici* [lien](url) |
| Et \`code\`| Normal           |

![Une image](https://picsum.photos/150 "Titre image")

\`\`\`mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`

- [ ] Tâche à faire : utiliser \`useEffect\`
- [x] Tâche faite : ajouter les liens

Du <div>HTML</div> brut.
`;

// Instancier le logger sans argument
const logger = new PinoLogger();

// Helper pour créer un bloc texte inline (inchangé)
const createTextInline = (text: string): TextInline => ({ type: 'text', value: text });

function App() {
  const theme = useUiStore((state) => state.theme);
  
  // Étape 2: Gérer les blocs avec useState
  const initialBlocks = useMemo(() => markdownToBlocks(sampleMarkdown), []);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks); // État pour les blocs

  // Configurer les capteurs pour dnd-kit (souris/toucher et clavier)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Étape 6: Fonction pour gérer la fin du glissement
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Les IDs sont maintenant directs
      logger.debug(`DragEnd: Active ID ${active.id}, Over ID ${over.id}`);

      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        if (oldIndex === -1 || newIndex === -1) {
          logger.error('Could not find block index during drag end', { activeId: active.id, overId: over.id, oldIndex, newIndex });
          return items;
        }

        logger.debug(`Moving block from index ${oldIndex} to ${newIndex}`);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Fonction pour gérer la suppression d'un bloc
  function handleDeleteBlock(idToDelete: string) {
    logger.debug(`Attempting to delete block with ID: ${idToDelete}`);
    setBlocks((currentBlocks) => 
      currentBlocks.filter((block) => block.id !== idToDelete)
    );
  }

  // << MODIFIÉ: Implémentation de la Logique d'édition conditionnelle >>
  const handleBlockContentChange = useCallback((blockId: string, newText: string) => {
    logger.debug(`[App] handleBlockContentChange called for block ID: ${blockId} with text:`, newText);

    setBlocks(currentBlocks => {
      const editedBlockIndex = currentBlocks.findIndex(b => b.id === blockId);
      if (editedBlockIndex === -1) {
        logger.error(`[App] Block with ID ${blockId} not found for update.`);
        return currentBlocks; 
      }

      const originalBlock = currentBlocks[editedBlockIndex];
      logger.debug(`[App] Original block type: ${originalBlock.type}`);

      // --- Logique Conditionnelle --- 

      // CAS 1: Clic sur Checkbox (détecté par le format du newText)
      // On vérifie si le bloc est un listItem et si le newText correspond au format 
      // d'une ligne de liste avec une case à cocher (potentiellement indentée).
      if (originalBlock.type === 'listItem' && /^(?:\s*[-*]|\d+\.)\s+\[[ x]\]\s/.test(newText)) {
          logger.debug(`[App] Checkbox toggle detected for ${blockId}. Parsing the single line to update metadata.`);
          try {
              // Parse uniquement la ligne reçue
              const parsedCheckboxItemArray = markdownToBlocks(newText);
              // S'assurer que le parsing a bien retourné un seul listItem
              if (parsedCheckboxItemArray.length === 1 && parsedCheckboxItemArray[0].type === 'listItem') {
                  // Créer le bloc mis à jour en gardant l'ID original mais avec le contenu/metadata parsé
                  const updatedItem = { ...parsedCheckboxItemArray[0], id: blockId }; 
                  const updatedBlocks = [...currentBlocks];
                  updatedBlocks[editedBlockIndex] = updatedItem;
                  logger.debug("[App] Checkbox state updated via parsing.", updatedItem);
                  return updatedBlocks;
              } else {
                  logger.error("[App] Failed to parse checkbox line correctly.", { newText, parsedResult: parsedCheckboxItemArray });
                  return currentBlocks; // Ne rien faire en cas d'échec du parsing spécifique
              }
          } catch (error) {
              logger.error("[App] Error parsing checkbox update line:", { error, blockId, newText });
              return currentBlocks;
          }
      }

      // CAS 2: Édition d'un Paragraphe (Permettre la transformation via parsing)
      else if (originalBlock.type === 'paragraph') {
          logger.debug(`[App] Paragraph edit detected for ${blockId}. Parsing new text to allow transformations.`);
          try {
              // Parser le texte reçu, qui peut contenir du Markdown
              let parsedNewBlocks = markdownToBlocks(newText);
              logger.debug(`[App] Parsed paragraph text into ${parsedNewBlocks.length} block(s):`, parsedNewBlocks);

              // Gérer le cas où le parsing ne retourne rien (ex: texte vide)
              if (parsedNewBlocks.length === 0) {
                 logger.warn("[App] Parsing paragraph resulted in zero blocks. Creating empty paragraph.");
                 // Remplacer par un paragraphe vide avec un nouvel ID
                 parsedNewBlocks = [{ id: uuidv4(), type: 'paragraph', content: { children: [createTextInline('')] } }];
              } else {
                // Assigner de nouveaux IDs aux blocs créés par le parsing
                parsedNewBlocks = parsedNewBlocks.map(block => ({ ...block, id: uuidv4() }));
                logger.debug("[App] Assigned new IDs to parsed blocks:", parsedNewBlocks);
              }

              // Remplacer l'ancien paragraphe par le(s) nouveau(x) bloc(s)
              const updatedBlocks = [
                  ...currentBlocks.slice(0, editedBlockIndex),
                  ...parsedNewBlocks, 
                  ...currentBlocks.slice(editedBlockIndex + 1)
              ];
              logger.debug("[App] Final updated blocks array after paragraph parse:", updatedBlocks);
              return updatedBlocks;

          } catch (error) {
              logger.error("[App] Error parsing new paragraph content:", { error, blockId, newText });
              return currentBlocks;
          }
      }

      // CAS 3: Édition du texte pur d'autres blocs (Titre, Code, Citation, Item de Liste)
      // Ici, newText est le texte pur envoyé par le composant de rendu
      else if (['heading', 'code', 'blockquote', 'listItem'].includes(originalBlock.type)) {
          logger.debug(`[App] Pure text update detected for ${originalBlock.type} block ${blockId}. Updating content directly.`);
          
          try {
            // Créer une copie profonde pour l'immutabilité
            const updatedBlock = JSON.parse(JSON.stringify(originalBlock));

            // Mettre à jour le contenu spécifique au type
            switch (updatedBlock.type) {
                case 'heading':
                case 'blockquote':
                case 'listItem': // Màj des children pour les types basés sur InlineElements
                    // Le texte pur reçu remplace tous les enfants précédents
                    updatedBlock.content.children = [createTextInline(newText)]; 
                    break;
                case 'code': // Màj directe du code pour les blocs de code
                    updatedBlock.content.code = newText;
                    break;
                // Pas besoin d'autres cas pour l'instant
            }

            // Remplacer l'ancien bloc par le bloc mis à jour directement
            const updatedBlocks = [...currentBlocks];
            updatedBlocks[editedBlockIndex] = updatedBlock;
            logger.debug("[App] Updated block content directly:", updatedBlock);
            return updatedBlocks;

          } catch (error) {
            logger.error("[App] Error directly updating block content:", { error, blockId, blockType: originalBlock.type });
            return currentBlocks;
          }
      } 
      
      // CAS 4: Autres types de blocs non gérés pour l'édition pour l'instant
      else {
          logger.warn(`[App] handleBlockContentChange called for unhandled block type: ${originalBlock.type}. No action taken.`);
          return currentBlocks;
      }
    });

  }, []); 

  // << MODIFIÉ: Accepter markerStyle dans la signature >>
  const handleAddBlockAfter = useCallback((data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => {
    // << MODIFIÉ: Extraire markerStyle >>
    const { sortableId, selectedType, markerStyle } = data; 
    logger.debug(`handleAddBlockAfter called with target block ID: ${sortableId}, selectedType: ${selectedType}, markerStyle: ${markerStyle}`);
    
    const targetBlockIndex = blocks.findIndex(b => b.id === sortableId);
    
    if (targetBlockIndex === -1) {
        logger.error(`[handleAddBlockAfter] Could not find target block with ID: ${sortableId}`);
        return;
    }
    
    const targetBlock = blocks[targetBlockIndex];
    let insertIndex = targetBlockIndex + 1;
    const newId = uuidv4();
    let newBlock: Block | null = null;

    // --- CAS A: ACTIONS SPÉCIFIQUES AUX LISTES --- 
    if (selectedType === 'addListItemSibling' || selectedType === 'addListItemChild') {
        if (targetBlock.type === 'listItem') {
            const targetListItem = targetBlock as ListItemBlock;
            const currentIndentation = targetListItem.metadata.depth;
            const currentListTypeOrdered = targetListItem.metadata.ordered;
            let finalInsertIndex: number;

            // --- Calcul de l'indentation et du type --- 
            let newIndentation: number;
            let newOrdered: boolean;
            if (selectedType === 'addListItemChild') {
                newIndentation = currentIndentation + 1;
                // Le style détermine le type ordonné pour un nouvel enfant
                newOrdered = markerStyle ? (markerStyle === 'decimal' || markerStyle === 'lower-alpha' || markerStyle === 'lower-roman') : currentListTypeOrdered;
                // L'insertion enfant se fait toujours juste après le parent
                finalInsertIndex = targetBlockIndex + 1;
            } else { // Cas addListItemSibling
                newIndentation = currentIndentation;
                newOrdered = currentListTypeOrdered;
                
                logger.debug(`[handleAddBlockAfter - Sibling] Target index: ${targetBlockIndex}. Sibling props: depth=${newIndentation}, ordered=${newOrdered}`);
                
                // << NOUVELLE LOGIQUE: Trouver l'index d'insertion en sautant les blocs intermédiaires >>
                let insertionSearchIndex = targetBlockIndex + 1;
                logger.debug(`[handleAddBlockAfter - Sibling] Starting insertion search at index: ${insertionSearchIndex}`);
                
                while (insertionSearchIndex < blocks.length) {
                    const blockToTest = blocks[insertionSearchIndex];
                    logger.debug(`[handleAddBlockAfter - Sibling] Testing block at index ${insertionSearchIndex}: type=${blockToTest.type}`);
                    
                    // Condition d'arrêt : Titre OU ListItem de même niveau/type
                    if (blockToTest.type === 'heading') {
                        logger.debug(`[handleAddBlockAfter - Sibling] Found heading at index ${insertionSearchIndex}. Stopping search.`);
                        break; // Arrêter avant le titre
                    }
                    if (blockToTest.type === 'listItem' && 
                        (blockToTest as ListItemBlock).metadata.depth === newIndentation && 
                        (blockToTest as ListItemBlock).metadata.ordered === newOrdered) {
                         logger.debug(`[handleAddBlockAfter - Sibling] Found same-level/type listItem at index ${insertionSearchIndex}. Stopping search.`);
                        break; // Arrêter avant le prochain item de même type
                    }
                    
                    // Si ce n'est pas une condition d'arrêt, continuer à chercher
                    logger.debug(`[handleAddBlockAfter - Sibling] Block at ${insertionSearchIndex} is intermediate. Continuing search.`);
                    insertionSearchIndex++;
                }
                
                // L'index final est celui où la boucle s'est arrêtée
                finalInsertIndex = insertionSearchIndex;
                logger.debug(`[handleAddBlockAfter - Sibling] Final determined insert index: ${finalInsertIndex}`);
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
                    markerStyle: selectedType === 'addListItemChild' ? markerStyle : targetListItem.metadata.markerStyle // Hériter style si frère, sinon utiliser celui choisi
                }
            };
            logger.debug(`[handleAddBlockAfter] Created new listItem:`, newBlock);

            // Utiliser finalInsertIndex pour l'insertion
            insertIndex = finalInsertIndex;
            // Le log précédent qui affichait insertIndex est toujours pertinent
            // logger.debug(`[handleAddBlockAfter - Sibling] Final determined insertIndex for splice: ${insertIndex}`);
            
        } else {
            logger.error(`[handleAddBlockAfter] List action triggered for non-listItem block ID: ${sortableId}`);
            return; 
        }
    } 
    // --- CAS B: TYPES DE BLOCS STANDARD --- 
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
            default: logger.warn(`[handleAddBlockAfter] Unknown or unhandled standard block type selected: ${selectedType}`);
        }
        logger.debug(`[handleAddBlockAfter] Created new standard block:`, newBlock);
    }

    // Logique d'insertion (utilise insertIndex modifié)
    if (newBlock) {
        logger.debug(`Attempting to insert block type ${newBlock.type} at index: ${insertIndex}`);
        setBlocks(prevBlocks => {
            const updatedBlocks = [...prevBlocks];
            updatedBlocks.splice(insertIndex, 0, newBlock);
            return updatedBlocks;
        });
    } else {
        logger.error(`[handleAddBlockAfter] Failed to create new block for insertion.`);
    }
  }, [blocks]);

  // useEffect pour Mermaid et thème (récupéré)
  useEffect(() => {
    // Appliquer la classe dark/light au site
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Réintroduire l'initialisation et le rendu Mermaid ici
    mermaid.initialize({ 
      startOnLoad: false,
      theme: 'base', 
    });
    
    logger.debug('Attempting to render Mermaid diagrams...');
    try {
        mermaid.run(); 
        logger.debug('Mermaid diagrams rendered successfully.');
    } catch (e) {
        logger.error("Erreur lors de l\'appel mermaid.run():", { error: e });
    }

  }, [theme, blocks]);

  // blockIds (récupéré)
  const blockIds = useMemo(() => {
    const ids = blocks.map(block => block.id);
    logger.debug('[App] Calculated blockIds for SortableContext:', ids);
    return ids;
  }, [blocks]);

  // << RESTAURÉ: JSX principal >>
  return (
    <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'dark' : ''} transition-colors duration-200`}>
      <Header />
      <MainContent>
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={blockIds} // Utiliser les IDs directs
            strategy={verticalListSortingStrategy} 
          >
            <div className="prose dark:prose-invert max-w-4xl mx-auto pb-96 bg-white dark:bg-gray-800 rounded-md shadow-md">
              <MarkdownRenderer 
                blocks={blocks} 
                onDeleteBlock={handleDeleteBlock} 
                onAddBlockAfter={handleAddBlockAfter} 
                onUpdateBlockContent={handleBlockContentChange}
              />
            </div>
          </SortableContext>
        </DndContext>
      </MainContent>
      <Footer />
    </div>
  );
}

export default App;