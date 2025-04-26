import { useEffect, useMemo, useState, useCallback } from 'react';
import Header from './presentation/components/layout/Header';
import MainContent from './presentation/components/layout/MainContent';
import Footer from './presentation/components/layout/Footer';
import { useUiStore } from './application/state/uiStore';
import mermaid from 'mermaid';
import { Block } from './application/logic/markdownParser';

// Importer le nouveau composant éditeur
import { NovaEditor } from './presentation/components/editor/NovaEditor';

// Importer le logger
import { PinoLogger } from './infrastructure/logging/PinoLogger';

// RÉ-IMPORTER le serializer
import { blocksToMarkdown } from './application/logic/markdownSerializer';

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

  const handleEditorChange = useCallback((newMarkdown: string, newBlocks: Block[]) => {
    logger.debug('[App] Editor content changed via callback');
    setEditorBlocks(newBlocks);
    setHasUnsavedChanges(true);
    // console.log("Nouveaux Blocks (état App):", newBlocks); // Garder pour debug si besoin
  }, []);

  const triggerSave = useCallback(() => {
    if (!hasUnsavedChanges) {
        logger.debug('[App] Pas de changements non sauvegardés à enregistrer.');
        return;
    }

    logger.debug('[App] Déclenchement sauvegarde (Ctrl+S)...');

    if (editorBlocks.length === 0) {
        logger.warn('[App] Tentative de sauvegarde avec des blocs vides. Annulation.');
        return;
    }

    try {
        // Sérialiser les blocs en Markdown
        const markdownToSave = blocksToMarkdown(editorBlocks);
        logger.debug('[App] Markdown sérialisé pour sauvegarde.');

        // AJOUT: Demander le nom du fichier à l'utilisateur
        let fileName = prompt("Entrez le nom du fichier pour la sauvegarde :", "document.md");

        // Vérifier si l'utilisateur a annulé
        if (fileName === null) {
            logger.debug('[App] Sauvegarde annulée par l\'utilisateur.');
            return; // Arrêter le processus de sauvegarde
        }

        // S'assurer que le nom n'est pas vide et a l'extension .md
        fileName = fileName.trim();
        if (!fileName) {
            fileName = "document.md"; // Utiliser le défaut si vide après trim
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
        document.body.appendChild(link); // Nécessaire pour Firefox
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Libérer l'URL objet

        // MODIFIÉ: Mettre à jour le message de log
        logger.debug(`[App] Fichier Markdown '${fileName}' demandé au téléchargement.`);
        setHasUnsavedChanges(false); // Marquer comme sauvegardé

    } catch (error) {
        logger.error('[App] Erreur lors de la sérialisation ou du déclenchement du téléchargement:', error);
        // Afficher une erreur à l'utilisateur si nécessaire
        alert("Une erreur s'est produite lors de la tentative de sauvegarde.");
    }

  }, [editorBlocks, hasUnsavedChanges]);

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
        event.preventDefault(); // Empêcher l'action native du navigateur
        logger.debug('[App] Ctrl+S détecté !');
        triggerSave(); // Appeler notre logique de sauvegarde
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    logger.debug('[App] Écouteur keydown pour Ctrl+S ajouté.');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      logger.debug('[App] Écouteur keydown pour Ctrl+S retiré.');
    };
  }, [triggerSave]);

  return (
    <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'dark' : ''} transition-colors duration-200`}>
      <Header />
      <MainContent>
        <div className="prose dark:prose-invert max-w-4xl mx-auto pb-96 bg-white dark:bg-gray-800 rounded-md shadow-md">
          <NovaEditor 
            initialMarkdown={sampleMarkdown} 
            onChange={handleEditorChange}
          />
        </div>
      </MainContent>
      <Footer />
    </div>
  );
}

export default App;