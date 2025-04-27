import { useEffect, useMemo, useState, useCallback } from 'react';
import Header from './presentation/components/layout/Header';
import MainContent from './presentation/components/layout/MainContent';
import Footer from './presentation/components/layout/Footer';
import { useUiStore } from './application/state/uiStore';
import mermaid from 'mermaid';
import { Block, markdownToBlocks } from './application/logic/markdownParser';

// Importer le nouveau composant éditeur
import { NovaEditor } from './presentation/components/editor/NovaEditor';

// Importer le logger
import { PinoLogger } from './infrastructure/logging/PinoLogger';

// RÉ-IMPORTER le serializer
import { blocksToMarkdown } from './application/logic/markdownSerializer';
// --- AJOUT: Importer le hook ---
import { useBlocksManagement } from './application/hooks/useBlocksManagement';


// Définition unique de sampleMarkdown...
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

function App() {
  const theme = useUiStore((state) => state.theme);
  
  const [editorMarkdown, setEditorMarkdown] = useState<string>(sampleMarkdown);
  const [editorBlocks, setEditorBlocks] = useState<Block[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // --- MODIFIÉ: Utilisation du hook useBlocksManagement ---
  // 1. Parser le markdown initial une seule fois
  const initialSampleBlocks = useMemo(() => {
    logger.debug('[App] Parsing initial sample markdown...');
    return markdownToBlocks(sampleMarkdown);
  }, []); // Pas de dépendances, exécuté une seule fois

  // 2. Initialiser le hook avec les blocs initiaux
  const {
    blocks, // <- L'état des blocs vient maintenant du hook
    setExternalBlocks, // <- Fonction pour mettre à jour les blocs (ex: chargement)
    handleDragEnd,
    handleDeleteBlock,
    handleBlockContentChange,
    handleAddBlockAfter,
    handleIncreaseIndentation,
    handleDecreaseIndentation,
  } = useBlocksManagement(initialSampleBlocks);

  // --- SUPPRIMÉ: Ancien état et callback ---
  // const [editorMarkdown, setEditorMarkdown] = useState<string>(sampleMarkdown); // Supprimé
  // const [editorBlocks, setEditorBlocks] = useState<Block[]>([]); // Supprimé, remplacé par `blocks` du hook
  /*
  const handleEditorChange = useCallback((newMarkdown: string, newBlocks: Block[]) => {
    logger.debug('[App] Editor content changed via callback');
    // setEditorBlocks(newBlocks); // Supprimé
    setHasUnsavedChanges(true);
    // console.log("Nouveaux Blocks (état App):", newBlocks);
  }, []); // Supprimé
  */

  // --- AJOUT: Surveiller les changements de blocs pour marquer comme non sauvegardé ---
  useEffect(() => {
    // On compare avec les blocs initiaux pour ne pas marquer comme modifié au chargement initial
    // C'est une comparaison simple par référence, peut ne pas détecter toutes les modifs internes si le hook mute.
    // Si useBlocksManagement retourne toujours une nouvelle référence de tableau, cela fonctionnera.
    // Une comparaison profonde serait plus robuste mais plus coûteuse.
    if (blocks !== initialSampleBlocks) {
        logger.debug('[App] Block state changed (detected by reference change), marking as unsaved.');
        setHasUnsavedChanges(true);
    }
    // On pourrait aussi ajouter un callback `onBlocksChange` au hook si nécessaire pour une détection plus fine.
  }, [blocks, initialSampleBlocks]);


  const triggerSave = useCallback(() => {
    // Modifié: Utilise directement `blocks` du hook
    if (!hasUnsavedChanges) {
        logger.debug('[App] Pas de changements non sauvegardés à enregistrer.');
        return;
    }

    logger.debug('[App] Déclenchement sauvegarde (Ctrl+S)...');
    if (blocks.length === 0) { // Utilise `blocks` du hook
        logger.warn('[App] Tentative de sauvegarde avec des blocs vides. Annulation.');
        return;
    }

    try {
        const markdownToSave = blocksToMarkdown(blocks); // Utilise `blocks` du hook
        logger.debug('[App] Markdown sérialisé pour sauvegarde.');
        
        // AJOUT: Demander le nom du fichier à l'utilisateur
        let fileName = prompt("Entrez le nom du fichier pour la sauvegarde :", "document.md");

        // Vérifier si l'utilisateur a annulé
        if (fileName === null) { 
            logger.debug('[App] Sauvegarde annulée par l\'utilisateur.');
            return;
        }

        // S'assurer que le nom n'est pas vide et a l'extension .md
        fileName = fileName.trim();
        if (!fileName) {
            fileName = "document.md";
        }
        if (!fileName.toLowerCase().endsWith('.md')) {
            fileName += '.md';
        }
        // FIN AJOUT
        
        const blob = new Blob([markdownToSave], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // MODIFIÉ: Utiliser le nom de fichier choisi
        link.download = fileName; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        logger.debug(`[App] Fichier Markdown '${fileName}' demandé au téléchargement.`);
        setHasUnsavedChanges(false); // Marquer comme sauvegardé
    } catch (error) {
        logger.error('[App] Erreur lors de la sérialisation ou du déclenchement du téléchargement:', error);
        // Afficher une erreur à l'utilisateur si nécessaire
        alert("Une erreur s'est produite lors de la tentative de sauvegarde.");
    }
  // --- MODIFIÉ: Dépend de `blocks` du hook et `hasUnsavedChanges` ---
  }, [blocks, hasUnsavedChanges]);

  // AJOUT: Fonction pour charger le contenu Markdown
  const handleLoadMarkdown = useCallback((markdownContent: string) => {
      try {
          logger.debug('[App] Chargement de nouveau contenu Markdown...');
          const newBlocks = markdownToBlocks(markdownContent);
          setEditorMarkdown(markdownContent); // Mettre à jour le markdown brut (si utilisé)
          setEditorBlocks(newBlocks);        // Mettre à jour les blocs parsés
          setHasUnsavedChanges(false);     // Considérer comme "non modifié" initialement
          logger.debug('[App] Contenu chargé et blocs mis à jour.');
          // TODO: Informer NovaEditor qu'il doit utiliser ces nouveaux blocs.
          // Cela pourrait nécessiter de passer editorBlocks comme prop à NovaEditor.
      } catch (error) {
          logger.error('[App] Erreur lors du parsing du Markdown chargé:', error);
          alert("Erreur lors du chargement ou du parsing du fichier Markdown.");
      }
  }, []); // Dépend de setEditorMarkdown, setEditorBlocks, setHasUnsavedChanges

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    mermaid.initialize({ 
      startOnLoad: false, 
      theme: 'base',
    });
    logger.debug('[App] Mermaid initialized globally.');
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        logger.debug('[App] Ctrl+S détecté !');
        triggerSave(); // Appeler notre logique de sauvegarde (qui dépend maintenant de `blocks`)
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    logger.debug('[App] Écouteur keydown pour Ctrl+S ajouté.');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      logger.debug('[App] Écouteur keydown pour Ctrl+S retiré.');
    };
  }, [triggerSave]); // triggerSave dépend maintenant de `blocks`

  return (
    <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'dark' : ''} transition-colors duration-200`}>
      <Header onLoadMarkdown={handleLoadMarkdown} />
      <MainContent>
        <div className="prose dark:prose-invert max-w-4xl mx-auto pb-96 bg-white dark:bg-gray-800 rounded-md shadow-md">
          {/* --- MODIFIÉ: Passage des props à NovaEditor --- */}
          <NovaEditor
            blocks={blocks} // <- Passe les blocs du hook
            // Passe toutes les fonctions de manipulation du hook
            onDragEnd={handleDragEnd}
            onDeleteBlock={handleDeleteBlock}
            onBlockContentChange={handleBlockContentChange}
            onAddBlockAfter={handleAddBlockAfter}
            onIncreaseIndentation={handleIncreaseIndentation}
            onDecreaseIndentation={handleDecreaseIndentation}
            // Supprime initialMarkdown et onChange
          />
        </div>
      </MainContent>
      <Footer />
    </div>
  );
}

export default App;
