import { useEffect, useMemo, useState, useCallback } from 'react';
import Header from './presentation/components/layout/Header';
import MainContent from './presentation/components/layout/MainContent';
import Footer from './presentation/components/layout/Footer';
import { useUiStore } from './application/state/uiStore';
import mermaid from 'mermaid';
import { v4 as uuidv4 } from 'uuid';

// Importer les éléments nécessaires pour le rendu Markdown
import { markdownToBlocks, Block } from './application/logic/markdownParser';
import MarkdownRenderer from './presentation/components/MarkdownRenderer';
import BlockTypeSelector from './presentation/components/dnd/BlockTypeSelector';

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

// Helper pour extraire l'ID original d'un ID potentiellement préfixé
const getOriginalId = (id: string | number): string => {
  const idStr = String(id);
  if (idStr.startsWith('group-')) {
    return idStr.substring(6); // Enlever le préfixe "group-"
  }
  return idStr;
};

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

    // << REVERT: Utiliser getOriginalId car SortableContext utilise à nouveau les IDs group- >>
    if (over && active.id !== over.id) {
      const originalActiveId = getOriginalId(active.id);
      const originalOverId = getOriginalId(over.id);

      logger.debug(`DragEnd: Active ID ${active.id} (Original: ${originalActiveId}), Over ID ${over.id} (Original: ${originalOverId})`);

      setBlocks((items) => {
        // Trouver les index en utilisant les IDs originaux
        const oldIndex = items.findIndex((item) => item.id === originalActiveId);
        const newIndex = items.findIndex((item) => item.id === originalOverId);

        if (oldIndex === -1 || newIndex === -1) {
          logger.error('Could not find original block index during drag end', { originalActiveId, originalOverId, oldIndex, newIndex });
          return items; // Ne rien faire si on ne trouve pas les index
        }

        logger.debug(`Moving block from index ${oldIndex} to ${newIndex}`);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Fonction pour gérer la suppression d'un bloc
  function handleDeleteBlock(idToDelete: string) {
    logger.debug(`Attempting to delete block with passed ID: ${idToDelete}`);
    // Important : utiliser getOriginalId pour pouvoir filtrer correctement
    // même si l'ID reçu vient d'un groupe de liste (préfixé)
    const originalIdToDelete = getOriginalId(idToDelete);
    logger.debug(`Original ID to delete: ${originalIdToDelete}`);

    setBlocks((currentBlocks) => 
      currentBlocks.filter((block) => block.id !== originalIdToDelete)
    );
  }

  // << MODIFIÉ: Logique d'édition avec parsing local >>
  const handleBlockContentChange = useCallback((blockId: string, newRawText: string) => {
    logger.debug(`[App] handleBlockContentChange called for block ID: ${blockId}`);
    
    setBlocks(currentBlocks => {
      const editedBlockIndex = currentBlocks.findIndex(b => b.id === blockId);
      
      if (editedBlockIndex === -1) {
        logger.error(`[App] Block with ID ${blockId} not found for update.`);
        return currentBlocks; // Retourne les blocs inchangés si non trouvé
      }

      logger.debug(`[App] Found block at index ${editedBlockIndex}. Parsing new text:`, newRawText);

      try {
        // Parser UNIQUEMENT le nouveau texte
        let parsedNewBlocks = markdownToBlocks(newRawText);
        logger.debug(`[App] Parsed new text into ${parsedNewBlocks.length} block(s):`, parsedNewBlocks);

        // Si le parsing ne retourne rien (texte vide ou invalide?), 
        // on peut choisir de supprimer le bloc ou de le laisser vide (ex: paragraphe vide)
        // Pour l'instant, créons un paragraphe vide si rien n'est retourné.
        if (parsedNewBlocks.length === 0) {
           logger.warn("[App] Parsing new text resulted in zero blocks. Creating an empty paragraph.");
           parsedNewBlocks = [{
               id: uuidv4(), // Nouvel ID même pour le vide
               type: 'paragraph',
               content: { children: [{ type: 'text', value: '' }] }
           }];
        } else {
          // Assigner de nouveaux IDs uniques aux blocs parsés
          parsedNewBlocks = parsedNewBlocks.map(block => ({
            ...block,
            id: uuidv4()
          }));
           logger.debug("[App] Assigned new IDs to parsed blocks:", parsedNewBlocks);
        }

        // Construire le nouveau tableau de blocs
        const updatedBlocks = [
          ...currentBlocks.slice(0, editedBlockIndex),
          ...parsedNewBlocks, // Insérer le(s) nouveau(x) bloc(s)
          ...currentBlocks.slice(editedBlockIndex + 1)
        ];

        logger.debug("[App] Final updated blocks array prepared:", updatedBlocks);
        return updatedBlocks;

      } catch (error) {
        logger.error("[App] Error parsing new block content:", { error, blockId, newRawText });
        return currentBlocks; // En cas d'erreur de parsing, ne rien changer
      }
    });

  }, []); // Pas de dépendances externes car setBlocks gère la clôture

  // << MODIFIÉ: Gère l'ajout complet sur sélection du type >>
  const handleAddBlockAfter = useCallback((data: { sortableId: string; selectedType: string }) => {
    const { sortableId, selectedType } = data;
    logger.debug(`handleAddBlockAfter called with sortableId: ${sortableId}, selectedType: ${selectedType}`);
    
    const originalId = getOriginalId(sortableId);
    let lastBlockIndex = -1;

    // 1. Trouver l'index d'insertion dans `blocks`
    if (sortableId.startsWith('group-')) {
        let startIndex = blocks.findIndex(b => b.id === originalId && b.type === 'listItem');
        if (startIndex !== -1) {
            lastBlockIndex = startIndex;
            while (lastBlockIndex + 1 < blocks.length && blocks[lastBlockIndex + 1].type === 'listItem') {
                lastBlockIndex++;
            }
            logger.debug(`Found list group ending at block index: ${lastBlockIndex}`);
        } else {
            logger.error(`[handleAddBlockAfter] Could not find starting listItem for group ID: ${originalId}`);
            return; // Impossible de déterminer l'index
        }
    } else {
        lastBlockIndex = blocks.findIndex(b => b.id === originalId);
        if (lastBlockIndex !== -1) {
             logger.debug(`Found simple block at index: ${lastBlockIndex}`);
        } else {
            logger.error(`[handleAddBlockAfter] Could not find block with ID: ${originalId}`);
            return; // Impossible de déterminer l'index
        }
    }

    // 2. Créer le nouveau bloc (logique déplacée de handleBlockTypeSelected)
    let newBlock: Block | null = null;
    const newId = uuidv4();
    switch (selectedType) {
      case 'paragraph': newBlock = { id: newId, type: 'paragraph', content: { children: [{ type: 'text', value: 'Nouveau paragraphe' }] } }; break; 
      case 'heading1': newBlock = { id: newId, type: 'heading', content: { level: 1, children: [{ type: 'text', value: 'Nouveau Titre 1' }] } }; break;
      case 'heading2': newBlock = { id: newId, type: 'heading', content: { level: 2, children: [{ type: 'text', value: 'Nouveau Titre 2' }] } }; break;
      case 'code': newBlock = { id: newId, type: 'code', content: { code: '// Votre code ici...' } }; break;
      case 'mermaid': newBlock = { id: newId, type: 'mermaid', content: { code: 'graph TD;\n  A-->B;' } }; break;
      case 'image': newBlock = { id: newId, type: 'image', content: { src: 'https://via.placeholder.com/150', alt: 'Nouvelle image' } }; break;
      case 'blockquote': newBlock = { id: newId, type: 'blockquote', content: { children: [{ type: 'text', value: 'Nouvelle citation' }] } }; break;
      case 'table': newBlock = { id: newId, type: 'table', content: { align: ['left', 'left'], rows: [[[{ type: 'text', value: 'Header' }],[{ type: 'text', value: 'Header' }]],[[{ type: 'text', value: 'Cell' }],[{ type: 'text', value: 'Cell' }]]]}}; break;
      case 'html': newBlock = { id: newId, type: 'html', content: { html: '<div>Nouveau HTML</div>' } }; break;
      case 'thematicBreak': newBlock = { id: newId, type: 'thematicBreak', content: {} }; break;
      case 'listItem': newBlock = { id: newId, type: 'paragraph', content: { children: [{ type: 'text', value: 'Nouvel élément (paragraphe)' }] } }; break; 
      default: logger.warn(`[handleAddBlockAfter] Unknown block type selected: ${selectedType}`);
    }

    // 3. Insérer le bloc si créé et index trouvé
    if (newBlock && lastBlockIndex !== -1) {
        const targetIndex = lastBlockIndex + 1;
        logger.debug(`Attempting to insert block type ${selectedType} at index: ${targetIndex}`);
        setBlocks(prevBlocks => {
            logger.debug(`setBlocks update running. Prev length: ${prevBlocks.length}`); 
            const updatedBlocks = [
                ...prevBlocks.slice(0, targetIndex),
                newBlock as Block,
                ...prevBlocks.slice(targetIndex)
            ];
            logger.debug(`Blocks after insert. New length: ${updatedBlocks.length}. Inserted ID: ${newBlock?.id}`);
            return updatedBlocks;
        });
    } else {
        logger.error(`[handleAddBlockAfter] Failed to insert block. newBlock found: ${!!newBlock}, lastBlockIndex: ${lastBlockIndex}`);
    }
    
  }, [blocks]); // Dépend de blocks pour findIndex

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
        // Utiliser le logger ici
        logger.error("Erreur lors de l\'appel mermaid.run():", { error: e });
    }

  }, [theme, blocks]);

  // Note: Ce calcul d'IDs doit correspondre à celui dans MarkdownRenderer
  const blockIds = useMemo(() => {
    // << REVERT: Recalculer blockIds avec les préfixes group- >>
    const ids: string[] = [];
    let tempIndex = 0;
    while (tempIndex < blocks.length) {
      const block = blocks[tempIndex];
      if (block.type !== 'listItem') {
        ids.push(block.id);
        tempIndex++;
      } else {
        // Utiliser l'ID préfixé ici aussi pour la cohérence
        ids.push(`group-${block.id}`);
        while (tempIndex < blocks.length && blocks[tempIndex].type === 'listItem') {
          tempIndex++;
        }
      }
    }
    logger.debug('[App] Calculated blockIds for SortableContext:', ids);
    return ids;
  }, [blocks]);

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
            items={blockIds} // Utiliser les IDs (potentiellement préfixés)
            strategy={verticalListSortingStrategy} 
          >
            {/* Appliquer la largeur max et supprimer max-w-none */}
            <div className="prose dark:prose-invert max-w-4xl mx-auto pb-96 bg-white dark:bg-gray-800 rounded-md shadow-md">
              <MarkdownRenderer 
                blocks={blocks} 
                // Ne pas passer sortableIds ici
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