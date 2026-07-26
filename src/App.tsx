import { useEffect, useRef, useMemo, useState } from 'react';
import Header from './presentation/components/layout/Header';
import MainContent from './presentation/components/layout/MainContent';
import Footer from './presentation/components/layout/Footer';
import { useUiStore } from './application/state/uiStore';
import mermaid from 'mermaid';

// Importer le nouveau composant éditeur
import { NovaEditor } from './presentation/components/editor/NovaEditor';

// Importer le logger
import { PinoLogger } from './infrastructure/logging/PinoLogger';

// --- AJOUT: Importer le hook ---
import { useBlocksManagement } from './application/hooks/useBlocksManagement';
import { useNovaAgent } from './application/hooks/useNovaAgent';
import AdminSettings from './presentation/components/menus/AdminSettings'; // NOUVEAU
import { DslHelpModal } from './presentation/components/common/DslHelpModal';
import { useNovaSystemContext } from './application/hooks/useNovaSystemContext';
import { useInitialDocumentLoader } from './application/hooks/useInitialDocumentLoader';

// AJOUT: Importer le registre et le module SpaceBlock
import { registerBlockModule } from './application/logic/blockRegistry';
import SpaceBlockModule from './application/modules/space/spaceBlockModule';
import CsvTableModule from './application/modules/csvTable/csvTableModule';
import PaletteModule from './application/modules/palette/paletteModule';
import DrawingModule from './application/modules/drawing/drawingModule';
import AiMessageModule from './application/modules/aiMessage/aiMessageModule';
import { mapModule } from './application/logic/modules/mapModule';
import VariantsModule from './application/modules/variants/variantsModule';
import ApiFlowModule from './application/modules/apiFlow/apiFlowModule';
import ApiErrorsModule from './application/modules/apiErrors/apiErrorsModule';
import PersistentInputZone from './presentation/components/editor/PersistentInputZone';

const logger = new PinoLogger();

logger.debug('[App Global] Enregistrement des modules de blocs customisés...');
// N'enregistrer qu'une seule fois, en dehors du composant App pour éviter les re-rendus
let modulesRegistered = false;
if (!modulesRegistered) {
  registerBlockModule(SpaceBlockModule);
  registerBlockModule(DrawingModule);
  registerBlockModule(PaletteModule);
  registerBlockModule(CsvTableModule);
  registerBlockModule(AiMessageModule);
  registerBlockModule(mapModule);
  registerBlockModule(VariantsModule);
  registerBlockModule(ApiFlowModule);
  registerBlockModule(ApiErrorsModule);
  modulesRegistered = true;
}
logger.debug('[App Global] Modules de blocs customisés enregistrés.');

import { useDocumentLifecycle } from './application/hooks/useDocumentLifecycle';

function App() {
  const theme = useUiStore((state) => state.theme);
  const appMode = useUiStore((state) => state.appMode);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  const blocksManagement = useBlocksManagement([]);
  const {
    blocksState,
    setExternalBlocks,
    handleDragEnd,
    handleDeleteBlock,
    requestBlockUpdate,
    handleAddBlockAfter,
    handleAddDropZoneBlockAfter,
    handleDuplicateBlock,
    handleAddSummaryBlock,
    handleIncreaseIndentation,
    handleDecreaseIndentation,
    handleAddBlockAtEnd,
    toggleSelectionMode,
    toggleBlockSelection,
    deleteSelectedBlocks,
    setSelectedBlocksBatch,
    undo,
    redo,
    canUndo,
    canRedo
  } = blocksManagement;

  const { isLoadingInitialMarkdown, originalLoadedBlocks } = useInitialDocumentLoader(setExternalBlocks);

  const {
    documentName,
    setDocumentName,
    hasUnsavedChanges,
    isExportModalOpen,
    setIsExportModalOpen,
    handleLoadMarkdown,
    handleFullExportProcess,
    handleExportAST,
    handleNewDocument,
    executeExport,
    triggerSave
  } = useDocumentLifecycle(blocksState.blocks, setExternalBlocks, isLoadingInitialMarkdown, originalLoadedBlocks);

  const getSystemContext = useNovaSystemContext(blocksManagement.blocksState.blocks, blocksManagement.blocksState.selectedBlockIds);
  const { submitPrompt: handleAIPromptSubmit, isGenerating } = useNovaAgent(getSystemContext, blocksManagement);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark', 'printer-theme');
    if (theme === 'printer') {
      document.documentElement.classList.add('printer-theme');
    } else {
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  // Mermaid n'a besoin d'être initialisé qu'une seule fois au montage
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'base' });
    logger.debug('[App] Mermaid initialized globally.');
  }, []);

  // Calcul du nombre de mots estimé depuis les blocs
  const wordCount = useMemo(() => {
    return blocksState.blocks.reduce((count, block) => {
      const raw = (block as { rawMarkdown?: string }).rawMarkdown ?? '';
      if (!raw) return count;
      return count + raw.trim().split(/\s+/).filter(Boolean).length;
    }, 0);
  }, [blocksState.blocks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Sauvegarde (Ctrl+S)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        triggerSave();
        return;
      }

      // Undo (Ctrl+Z)
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        // Empêcher l'undo si on est dans un input texte ou textarea (pour garder l'undo natif)
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.closest('.cm-editor')) {
          return;
        }
        event.preventDefault();
        if (canUndo) undo();
        return;
      }

      // Redo (Ctrl+Y ou Ctrl+Shift+Z)
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.closest('.cm-editor')) {
          return;
        }
        event.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Aide DSL (Ctrl+,)
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('nova-open-dsl-help'));
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerSave, undo, redo, canUndo, canRedo]);

  const [isDslHelpModalOpen, setIsDslHelpModalOpen] = useState(false);
  const [initialHelpBlockType, setInitialHelpBlockType] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenDslHelp = (e: Event) => {
      const customEvent = e as CustomEvent<{ blockType?: string }>;
      setInitialHelpBlockType(customEvent.detail?.blockType || null);
      setIsDslHelpModalOpen(true);
    };
    window.addEventListener('nova-open-dsl-help', handleOpenDslHelp);
    return () => window.removeEventListener('nova-open-dsl-help', handleOpenDslHelp);
  }, []);

  useEffect(() => {
    const handleKeyDownGlobal = (event: KeyboardEvent) => {
      // Ne pas intercepter si l'utilisateur tape dans un champ texte standard
      if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
        return;
      }

      if (blocksState.isSelectionModeActive) {
        if (event.key === 'Delete' && blocksState.selectedBlockIds.length > 0) {
          event.preventDefault();
          if (window.confirm(`Êtes-vous sûr de vouloir supprimer les ${blocksState.selectedBlockIds.length} bloc(s) sélectionné(s) ?`)) {
            deleteSelectedBlocks();
          }
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          // Navigation au clavier pour la sélection
          let nextIndex = 0;

          if (blocksState.selectedBlockIds.length === 0) {
            // Si aucune sélection active, commencer par le premier (ou dernier) bloc
            nextIndex = event.key === 'ArrowUp' ? blocksState.blocks.length - 1 : 0;
          } else {
            const lastSelectedId = blocksState.selectedBlockIds[blocksState.selectedBlockIds.length - 1];
            const lastIndex = blocksState.blocks.findIndex(b => b.id === lastSelectedId);
            if (lastIndex !== -1) {
              nextIndex = event.key === 'ArrowUp' ? lastIndex - 1 : lastIndex + 1;
            }
          }

          if (nextIndex >= 0 && nextIndex < blocksState.blocks.length) {
            event.preventDefault();
            const nextBlock = blocksState.blocks[nextIndex];

            if (event.shiftKey) {
              // Maj + Flèche = Étendre la sélection
              if (!blocksState.selectedBlockIds.includes(nextBlock.id)) {
                setSelectedBlocksBatch([nextBlock.id], true); // append
              }
            } else {
              // Flèche simple = Déplacer la sélection unique
              setSelectedBlocksBatch([nextBlock.id], false); // replace
            }
          }
        } else if (event.key === 'Escape') {
          // Optionnel : Echap pour annuler la sélection
          event.preventDefault();
          setSelectedBlocksBatch([], false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => {
      window.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, [blocksState.isSelectionModeActive, blocksState.selectedBlockIds, blocksState.blocks, deleteSelectedBlocks, setSelectedBlocksBatch]);

  const previousBlocksLengthRef = useRef(blocksState.blocks.length);

  // L'auto-scroll systématique à la fin a été retiré pour permettre l'insertion de blocs au milieu du document sans sauter à la fin.
  // previousBlocksLengthRef est conservé au cas où nous voudrions un scroll ciblé plus tard.
  useEffect(() => {
    previousBlocksLengthRef.current = blocksState.blocks.length;
  }, [blocksState.blocks.length]);


  if (isLoadingInitialMarkdown) {
    return (
      <div className={`flex flex-col min-h-screen ${theme === 'dark' ? 'dark' : ''} transition-colors duration-200 items-center justify-center`}>
        <p className="text-xl text-gray-700 dark:text-gray-300">Chargement de l'éditeur...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 print:bg-white print:text-black
      ${theme === 'light' ? 'bg-gray-100 text-gray-800' :
        theme === 'dark' ? 'bg-gray-900 text-gray-200' :
          'printer-styles'
      }`}>
      <Header
        onLoadMarkdown={handleLoadMarkdown}
        onExport={handleFullExportProcess}
        onExportAST={handleExportAST}
        hasUnsavedChanges={hasUnsavedChanges}
        documentName={documentName}
        onNewDocument={handleNewDocument}
        onChangeDocumentName={setDocumentName}
      />
      <MainContent>
        {appMode === 'admin' ? (
          <AdminSettings />
        ) : (
          <div className="flex flex-col flex-grow h-full max-w-4xl mx-auto w-full min-h-0">
            <div ref={blocksContainerRef} className="flex-grow overflow-y-auto min-h-0 prose dark:prose-invert bg-white dark:bg-gray-800 rounded-t-md shadow-md p-6">
              <NovaEditor
                blocks={blocksState.blocks}
                isSelectionModeActive={blocksState.isSelectionModeActive}
                selectedBlockIds={blocksState.selectedBlockIds}
                aiHighlightedBlockIds={blocksState.aiHighlightedBlockIds}
                onToggleBlockSelection={toggleBlockSelection}
                onDragEnd={handleDragEnd}
                onDeleteBlock={handleDeleteBlock}
                onDuplicateBlock={handleDuplicateBlock}
                onAddBlockAfter={handleAddBlockAfter}
                onAddDropZoneBlockAfter={handleAddDropZoneBlockAfter}
                onUpdateBlockContent={requestBlockUpdate}
                onIncreaseIndentation={handleIncreaseIndentation}
                onDecreaseIndentation={handleDecreaseIndentation}
                handleAddSummaryBlock={handleAddSummaryBlock}
                setSelectedBlocksBatch={setSelectedBlocksBatch}
              />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-b-md shadow-md">
              <PersistentInputZone
                onAddBlock={handleAddBlockAtEnd}
                isSelectionModeActive={blocksState.isSelectionModeActive}
                selectedBlockCount={blocksState.selectedBlockIds.length}
                onToggleSelectionMode={toggleSelectionMode}
                onDeleteSelectedBlocks={deleteSelectedBlocks}
                onSubmitPrompt={handleAIPromptSubmit}
                isGenerating={isGenerating}
              />
            </div>
          </div>
        )}
      </MainContent>
      <Footer
        blockCount={blocksState.blocks.length}
        wordCount={wordCount}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Format d'exportation</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Choisissez le format dans lequel vous souhaitez exporter le document.</p>
            <div className="flex flex-col space-y-3">
              <button onClick={() => executeExport('md')} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors text-left font-medium"> Markdown (.md) </button>
              <button onClick={() => executeExport('html')} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition-colors text-left font-medium"> HTML Complet (.html) </button>
              <button onClick={() => executeExport('pdf')} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors text-left font-medium"> Document PDF (.pdf) </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"> Annuler </button>
            </div>
          </div>
        </div>
      )}
      <DslHelpModal 
        isOpen={isDslHelpModalOpen} 
        onClose={() => setIsDslHelpModalOpen(false)} 
        initialBlockType={initialHelpBlockType} 
      />
    </div>
  );
}

export default App;