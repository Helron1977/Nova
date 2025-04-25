import { useEffect, useMemo, useState } from 'react';
import Header from './presentation/components/layout/Header';
import MainContent from './presentation/components/layout/MainContent';
import Footer from './presentation/components/layout/Footer';
import { useUiStore } from './application/state/uiStore';
import mermaid from 'mermaid';

// Importer les éléments nécessaires pour le rendu Markdown
import { TextInline } from './application/logic/markdownParser';
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
    useSensors
} from '@dnd-kit/core';

// Importer l'utilitaire pour réorganiser le tableau
import { 
    SortableContext, // Importer SortableContext
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy // Importer la stratégie de tri
} from '@dnd-kit/sortable';



// << MODIFIÉ: Définition unique de sampleMarkdown >>
const sampleMarkdown = `# Titre Principal
Ceci est un paragraphe avec du **gras**, de l'*italique*, du \`code inline\` et du ~~texte barré~~.\\nVoici aussi un [lien vers Google](https://google.com \"Tooltip Google\") !

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

// << MODIFIÉ: Importer le nouveau hook >>
import { useBlocksManagement } from './application/hooks/useBlocksManagement';


// << SUPPRIMÉ: Import du menu contextuel ici (devrait être géré ailleurs) >>
// import { MermaidContextMenu } from './presentation/components/menus/MermaidContextMenu'; 

// << SUPPRIMÉ: Données factices pour le test du menu >>
// const mockShapes = [...];

function App() {
  const theme = useUiStore((state) => state.theme);
  
  // << MODIFIÉ: Utilisation du hook pour gérer les blocs >>
  const {
    blocks,
    handleDragEnd,
    handleDeleteBlock,
    handleBlockContentChange,
    handleAddBlockAfter
  } = useBlocksManagement(sampleMarkdown);

  // Configurer les capteurs pour dnd-kit (souris/toucher et clavier)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // << SUPPRIMÉ: États et Handlers pour le test du menu contextuel >>
  // const [menuVisible, setMenuVisible] = useState(false);
  // const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  // const [currentColor, setCurrentColor] = useState('#FF6347');
  // const handleContextMenuTest = (...) => { ... };
  // const closeContextMenu = () => { ... };
  // const handleShapeSelectedTest = (...) => { ... };
  // const handleColorChangeTest = (...) => { ... };
  // << FIN SUPPRESSION >>

  // JSX principal
  return (
    <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'dark' : ''} transition-colors duration-200`}>
      <Header />
      <MainContent>
        {/* << SUPPRIMÉ: Zone de test pour le clic droit >> */}
        {/* <div 
          className="my-8 p-6 bg-yellow-100 ..."
          onContextMenu={handleContextMenuTest}
        >
            ZONE DE TEST ...
        </div> */}
        {/* << FIN SUPPRESSION >> */}

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

      {/* << SUPPRIMÉ: Rendu conditionnel du menu contextuel de test à la fin >> */}
      {/* <MermaidContextMenu 
          isVisible={menuVisible}
          position={menuPosition}
          shapes={mockShapes}
          selectedColor={currentColor}
          onClose={closeContextMenu}
          onShapeSelect={handleShapeSelectedTest}
          onColorChange={handleColorChangeTest}
      /> */}
    </div>
  );
}

export default App;