import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Header from './presentation/components/layout/Header';
import MainContent from './presentation/components/layout/MainContent';
import Footer from './presentation/components/layout/Footer';
import { useUiStore } from './application/state/uiStore';
import mermaid from 'mermaid';
import { markdownToBlocks, type HeadingBlock, type InlineElement } from './application/logic/markdownParser';
import { Marked, marked as globalMarked, type Tokens } from 'marked';
import { gfmHeadingId, getHeadingList, resetHeadings } from 'marked-gfm-heading-id';

import type { Block, ImageBlock, CodeBlock } from './application/logic/markdownParser';
// import  {initialMarkdown}  from '@/application/config/initialMarkdown'; // Suppression de l'import direct
// import  {initialMarkdown}  from '@/application/config/initialMarkdown'; // Suppression de l'import direct

// Importer le nouveau composant éditeur
import { NovaEditor } from './presentation/components/editor/NovaEditor';

// Importer le logger
import { PinoLogger } from './infrastructure/logging/PinoLogger';

// RÉ-IMPORTER le serializer
import { blocksToMarkdown } from './application/logic/markdownSerializer';
// --- AJOUT: Importer le hook ---
import { useBlocksManagement } from './application/hooks/useBlocksManagement';
import { useNovaAgent } from './application/hooks/useNovaAgent';
import AdminSettings from './presentation/components/menus/AdminSettings'; // NOUVEAU
import { useNovaSystemContext } from './application/hooks/useNovaSystemContext';
import { useInitialDocumentLoader } from './application/hooks/useInitialDocumentLoader';
import { buildAST, serializeASTToLLMContext } from './application/logic/astGenerator';
import { generateNovaMutationProtocolInstructions } from './application/logic/novaProtocolParser';

// AJOUT: Importer le registre et le module SpaceBlock
import { registerBlockModule, getBlockModuleByCodeLanguage } from './application/logic/blockRegistry';
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

globalMarked.use(gfmHeadingId());

const simpleSlugify = (text: string): string => {
  if (!text) return 'section';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
};

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

const downloadFile = (filename: string, content: string, mimeType: string) => {
  try {
    const element = document.createElement('a');

    // Tentative 1 : Blob + Object URL
    const file = new Blob([content], { type: mimeType });
    const fileUrl = URL.createObjectURL(file);
    element.href = fileUrl;
    element.download = filename;
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setTimeout(() => {
      URL.revokeObjectURL(fileUrl);
    }, 1000);
  } catch (error) {
    console.error("Error during Blob downloadFile, trying Data URI fallback:", error);
    try {
      // Tentative 2 : Fallback Data URI si Blob est bloqué
      const element = document.createElement('a');
      element.href = `data:${mimeType},${encodeURIComponent(content)}`;
      element.download = filename;
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (fallbackError) {
      console.error("Error during Data URI downloadFile:", fallbackError);
      alert("Une erreur est survenue lors du téléchargement.");
    }
  }
};

function App() {
  const theme = useUiStore((state) => state.theme);
  const appMode = useUiStore((state) => state.appMode); // NOUVEAU
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [documentName, setDocumentName] = useState<string>('Document sans titre');
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

  // NOUVEAU : Utilisation des hooks extraits
  const getSystemContext = useNovaSystemContext(blocksManagement.blocksState.blocks, blocksManagement.blocksState.selectedBlockIds);
  const { submitPrompt: handleAIPromptSubmit, isGenerating } = useNovaAgent(getSystemContext, blocksManagement);

  const { isLoadingInitialMarkdown, originalLoadedBlocks } = useInitialDocumentLoader(setExternalBlocks);

  useEffect(() => {
    if (!isLoadingInitialMarkdown && originalLoadedBlocks && blocksState.blocks !== originalLoadedBlocks) {
      logger.debug('[App] Block state changed, marking as unsaved.');
      setHasUnsavedChanges(true);
    }
  }, [blocksState.blocks, originalLoadedBlocks, isLoadingInitialMarkdown]);

  const prepareMarkdownContent = useCallback(async (targetBlocks: Block[]): Promise<string | null> => {
    if (targetBlocks.length === 0) {
      logger.warn('[App] Tentative de préparation de contenu avec des blocs vides. Annulation.');
      return null;
    }
    const externalImages = targetBlocks
      .filter(block => block.type === 'image' && (block as ImageBlock).content.url.startsWith('http'))
      .map(block => block as ImageBlock);

    let currentBlocks = [...targetBlocks];

    if (externalImages.length > 0) {
      const userAgreesToDownload = window.confirm(
        `Ce document contient ${externalImages.length} image(s) hébergée(s) externe(s). ` +
        `Voulez-vous essayer de les télécharger et les incorporer en base64 dans le document ? ` +
        `Cela peut augmenter la taille du fichier. Annuler conservera les liens externes.`
      );

      if (userAgreesToDownload) {
        logger.debug('[App] L\'utilisateur accepte de télécharger les images externes.');
        const updatedImageBlocks = await Promise.all(
          currentBlocks.map(async (block) => {
            if (block.type === 'image' && (block as ImageBlock).content.url.startsWith('http')) {
              const imgBlock = block as ImageBlock;
              try {
                const response = await fetch(imgBlock.content.url);
                if (!response.ok) throw new Error(`Erreur HTTP ${response.status} pour ${imgBlock.content.url}`);
                const blob = await response.blob();
                if (!blob.type.startsWith('image/')) {
                  logger.warn(`[App] Le fichier téléchargé depuis ${imgBlock.content.url} n'est pas une image reconnue (${blob.type}). Elle sera conservée en tant que lien externe.`);
                  return block;
                }
                const reader = new FileReader();
                return new Promise<Block>((resolve, reject) => {
                  reader.onloadend = () => {
                    resolve({
                      ...imgBlock,
                      content: { ...imgBlock.content, url: reader.result as string },
                    });
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              } catch (error) {
                logger.error(`[App] Échec du téléchargement ou de la conversion de l'image ${imgBlock.content.url}:`, error);
                alert(`Impossible de télécharger ou convertir l'image: ${imgBlock.content.url}. Elle sera conservée en tant que lien externe.`);
                return block;
              }
            }
            return block;
          })
        );
        currentBlocks = updatedImageBlocks;
      } else {
        logger.debug('[App] L\'utilisateur refuse de télécharger les images externes.');
      }
    }
    return blocksToMarkdown(currentBlocks);
  }, []);

  const triggerSave = useCallback(async () => {
    logger.debug('[App] Déclenchement sauvegarde (Ctrl+S)...');
    try {
      const markdownToSave = await prepareMarkdownContent(blocksState.blocks);

      if (markdownToSave === null) {
        logger.warn('[App] Préparation du contenu annulée ou vide pour la sauvegarde. Sauvegarde annulée.');
        return;
      }

      const defaultFileName = 'nova-document.md';
      // Suppression du prompt pour éviter l'expiration du geste utilisateur qui bloque le téléchargement
      downloadFile(defaultFileName, markdownToSave, 'text/markdown;charset=utf-8');
      logger.debug(`[App] Document sauvegardé en Markdown sous : ${defaultFileName}`);
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Error in triggerSave:", e);
      alert("Erreur lors de la sauvegarde.");
    }
  }, [prepareMarkdownContent, setHasUnsavedChanges, blocksState.blocks]);

  const handleExportAST = useCallback(() => {
    logger.debug('[App] EXPORT Contexte IA déclenché...');
    try {
      const ast = buildAST(blocksState.blocks);
      const xmlContext = serializeASTToLLMContext(ast);
      const protocol = generateNovaMutationProtocolInstructions();
      const finalXmlContext = `${protocol}\n\n${xmlContext}`;
      const defaultFileName = 'nova-context.xml';
      downloadFile(defaultFileName, finalXmlContext, 'application/xml');
      logger.debug(`[App] Contexte IA sauvegardé sous : ${defaultFileName}`);
    } catch (error) {
      logger.error('[App] Erreur lors de la génération de l\'AST:', error);
      alert("Une erreur s'est produite lors de la génération de l'AST. Consultez la console.");
    }
  }, [blocksState.blocks]);

  const handleLoadMarkdown = useCallback((markdownContent: string) => {
    try {
      logger.debug('[App] Chargement de nouveau contenu Markdown...');
      const newBlocks = markdownToBlocks(markdownContent);
      logger.debug('[App] Blocs parsés depuis le fichier chargé:', newBlocks);
      setExternalBlocks(newBlocks);
      setHasUnsavedChanges(false);
      logger.debug('[App] Contenu chargé et blocs mis à jour.');
    } catch (error) {
      logger.error('[App] Erreur lors du parsing du Markdown chargé:', error);
      alert("Erreur lors du chargement ou du parsing du fichier Markdown.");
    }
  }, [setExternalBlocks]);

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

  // Indicateur d'onglet : '● Nova' quand il y a des modifications non sauvegardées
  useEffect(() => {
    document.title = hasUnsavedChanges ? '● Nova' : 'Nova';
  }, [hasUnsavedChanges]);

  // Calcul du nombre de mots estimé depuis les blocs
  const wordCount = useMemo(() => {
    return blocksState.blocks.reduce((count, block) => {
      const raw = (block as any).rawMarkdown ?? '';
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerSave, undo, redo, canUndo, canRedo]);

  const downloadHtmlFile = useCallback((htmlContent: string, defaultFileName: string) => {
    const fileName = prompt("Exporter en HTML sous le nom :", defaultFileName);
    if (fileName) {
      downloadFile(fileName, htmlContent, 'text/html;charset=utf-8');
      logger.debug(`[App] Document exporté en HTML sous : ${fileName}`);
      setHasUnsavedChanges(false);
    } else {
      logger.debug('[App] Exportation HTML annulée par l\'utilisateur.');
    }
  }, [setHasUnsavedChanges]);



  const renderMermaidDiagramsInMarkdown = async (markdownContentToProcess: string, currentAppBlocks: Block[]): Promise<string> => {
    logger.debug('[App RENDERMD] Processing Mermaid diagrams for HTML export...');

    const normalizeNewlines = (str: string) => str.replace(/\r\n/g, '\n');
    let outputMarkdown = normalizeNewlines(markdownContentToProcess);

    const mermaidBlockInfos = currentAppBlocks
      .filter(block => block.type === 'mermaid')
      .map(block => {
        const rawCodeFromBlock = normalizeNewlines((block.content as { code: string }).code);
        return {
          id: block.id,
          originalMarkdown: '```mermaid\n' + rawCodeFromBlock + '\n```'
        };
      });

    if (mermaidBlockInfos.length === 0) {
      logger.debug('[App RENDERMD] No Mermaid blocks found in currentAppBlocks.');
      return outputMarkdown;
    }

    logger.debug('[App RENDERMD] Mermaid blocks to process:', JSON.stringify(mermaidBlockInfos.map(info => ({ id: info.id, md_preview: info.originalMarkdown.substring(0, 50) + '...' }))));
    logger.debug('[App RENDERMD] Waiting for DOM to potentially update...');
    await new Promise(resolve => setTimeout(resolve, 200));
    logger.debug('[App RENDERMD] DOM wait finished. Querying DOM elements.');

    for (const mermaidInfo of mermaidBlockInfos) {
      logger.debug(`[App RENDERMD] Processing block ID ${mermaidInfo.id}. Expected markdown snippet:\n${mermaidInfo.originalMarkdown.substring(0, 200)}...`);
      const containerDiv = document.querySelector(`div.custom-mermaid-container[data-block-id="${mermaidInfo.id}"]`);

      if (containerDiv) {
        const svgElement = containerDiv.querySelector('svg');
        if (svgElement) {
          const svgHTML = svgElement.outerHTML;
          logger.debug(`[App RENDERMD] Found SVG for ID ${mermaidInfo.id}. SVG HTML (first 100): ${svgHTML.substring(0, 100)}`);
          const replacementHtml = `<div class="mermaid-diagram-container" data-mermaid-block-id="${mermaidInfo.id}">${svgHTML}</div>`;

          if (outputMarkdown.includes(mermaidInfo.originalMarkdown)) {
            outputMarkdown = outputMarkdown.replace(mermaidInfo.originalMarkdown, replacementHtml);
            logger.debug(`[App RENDERMD] Successfully replaced original markdown for ID ${mermaidInfo.id} with SVG.`);
          } else {
            logger.warn(`[App RENDERMD] MARKDOWN MISMATCH for ID ${mermaidInfo.id}.`);
            logger.warn(`[App RENDERMD] Expected MD (len ${mermaidInfo.originalMarkdown.length}):\n${mermaidInfo.originalMarkdown}`);
            const originalBlock = currentAppBlocks.find(b => b.id === mermaidInfo.id);
            const codeSample = originalBlock ? normalizeNewlines((originalBlock.content as { code: string }).code).substring(0, 50) : "[CODE NON TROUVÉ]";
            const indexOfCodeInOutput = outputMarkdown.indexOf(codeSample);
            if (indexOfCodeInOutput !== -1 && codeSample !== "[CODE NON TROUVÉ]") {
              const startCtx = Math.max(0, indexOfCodeInOutput - 70);
              const endCtx = Math.min(outputMarkdown.length, indexOfCodeInOutput + codeSample.length + 70);
              logger.warn(`[App RENDERMD] Actual MD context in outputMarkdown (around "${codeSample}"):\n${outputMarkdown.substring(startCtx, endCtx)}`);
            } else {
              logger.warn(`[App RENDERMD] Could not find sample code "${codeSample}" in outputMarkdown. Full output (first 500 chars):\n${outputMarkdown.substring(0, 500)}`);
            }
          }
        } else {
          logger.warn(`[App RENDERMD] Container found for ID ${mermaidInfo.id}, but NO SVG element within.`);
        }
      } else {
        logger.warn(`[App RENDERMD] Could NOT find Mermaid container div in DOM for block ID ${mermaidInfo.id}.`);
      }
    }

    logger.debug('[App RENDERMD] Finished processing Mermaid diagrams for HTML.');
    return outputMarkdown;
  };



  const handleFullExportProcess = useCallback(() => {
    setIsExportModalOpen(true);
  }, []);

  const handleNewDocument = useCallback(() => {
    const name = window.prompt("Nom du nouveau document:", "Nouveau Document");
    if (name !== null) {
      setDocumentName(name);
      setExternalBlocks([]);
      setHasUnsavedChanges(false);
    }
  }, [setExternalBlocks]);

  const executeExport = useCallback(async (formatChoice: string) => {
    logger.debug(`[App] EXPORT: executeExport CALLED for format: ${formatChoice}`);
    setIsExportModalOpen(false);

    if (formatChoice === 'pdf') {
      logger.debug('[App] EXPORT: Format PDF chosen. Triggering native print.');
      // Petite temporisation pour s'assurer que le modal d'export est bien fermé
      setTimeout(() => {
        window.print();
      }, 100);
      return;
    }

    try {
      let blocksForExport = JSON.parse(JSON.stringify(blocksState.blocks)) as Block[];
      const markdownContentWithOriginalSummaryLinks = await prepareMarkdownContent(blocksForExport);

      if (markdownContentWithOriginalSummaryLinks === null) {
        logger.warn('[App] EXPORT: markdownContentWithOriginalSummaryLinks is null. Processus d exportation arrete.');
        return;
      }

      console.error("[DEBUG] EXPORT: Avant resetHeadings");
      resetHeadings();
      console.error("[DEBUG] EXPORT: Après resetHeadings");
      const idExtractor = new Marked();
      console.error("[DEBUG] EXPORT: Après new Marked()");
      idExtractor.use(gfmHeadingId());
      console.error("[DEBUG] EXPORT: Après use gfmHeadingId()");
      idExtractor.parse(markdownContentWithOriginalSummaryLinks);
      console.error("[DEBUG] EXPORT: Après idExtractor.parse");
      const generatedHeadings = getHeadingList();
      console.error("[DEBUG] EXPORT: Après getHeadingList, headings found:", generatedHeadings.length);

      const titleTextToGfmIdMap = new Map<string, string>();
      generatedHeadings.forEach(h => {
        if (h.raw && h.id) {
          titleTextToGfmIdMap.set(h.raw.trim(), h.id);
        }
      });
      logger.debug('[App] EXPORT: titleTextToGfmIdMap créé:', titleTextToGfmIdMap);

      const summaryBlockIndex = blocksForExport.findIndex(block =>
        block.type === 'code' && (block as CodeBlock).content.language === 'summary'
      );

      if (summaryBlockIndex !== -1) {
        logger.debug("[App] EXPORT: Bloc sommaire trouvé. Réécriture des liens pour l'export avec GFM IDs.");
        const summaryBlock = blocksForExport[summaryBlockIndex] as CodeBlock;
        const summaryLines = summaryBlock.content.code.split('\n');

        const updatedSummaryLines = summaryLines.map(line => {
          const match = line.match(/^(\s*)- \[(.*?)\]\(#(.*?)\)$/);
          if (match) {
            const indentation = match[1];
            const linkText = match[2];
            const originalBlockId = match[3];
            const headingBlock = blocksState.blocks.find(b => b.id === originalBlockId && b.type === 'heading') as HeadingBlock | undefined;

            if (headingBlock) {
              const originalTitleText = getPlainTextFromInlineElements(headingBlock.content.children).trim();
              if (originalTitleText) {
                const gfmId = titleTextToGfmIdMap.get(originalTitleText);
                if (gfmId) {
                  logger.debug(`[App] EXPORT: Sommaire - Lien pour '${originalTitleText}' mappé sur GFM ID: #${gfmId}`);
                  return `${indentation}- [${linkText}](#${gfmId})`;
                } else {
                  logger.warn(`[App] EXPORT: Sommaire - GFM ID non trouvé pour '${originalTitleText}'. Utilisation de simpleSlugify comme fallback.`);
                  const slug = simpleSlugify(originalTitleText);
                  return `${indentation}- [${linkText}](#${slug})`;
                }
              }
            }
          }
          return line;
        });

        summaryBlock.content.code = updatedSummaryLines.join('\n');
        blocksForExport[summaryBlockIndex] = summaryBlock;
        logger.debug('[App] EXPORT: Contenu du bloc sommaire mis à jour pour l\'export avec GFM IDs:', summaryBlock.content.code);
      } else {
        logger.debug('[App] EXPORT: Aucun bloc sommaire trouvé pour la mise à jour des liens GFM.');
      }

      console.error("[DEBUG] EXPORT: Avant second prepareMarkdownContent");
      const markdownPure = await prepareMarkdownContent(blocksForExport);
      console.error("[DEBUG] EXPORT: Après second prepareMarkdownContent, type:", typeof markdownPure);

      if (markdownPure) {
        logger.debug('[App] EXPORT: markdownPure (avec sommaire modifié et images potentiellement traitées) généré. Longueur: ' + markdownPure.length);
      } else {
        logger.debug('[App] EXPORT: markdownPure est NULL après traitement.');
      }

      if (markdownPure === null) {
        logger.warn('[App] EXPORT: markdownPure is null after summary modification. Processus d exportation arrete.');
        return;
      }

      logger.debug(`[App] EXPORT: User format choice: ${formatChoice}`);

      let finalHtmlContent: string | null = null;

      if (formatChoice === 'html') {
        logger.debug('[App] EXPORT: Format HTML choisi. Rendu des diagrammes Mermaid...');
        const markdownWithRenderedMermaid = await renderMermaidDiagramsInMarkdown(markdownPure, blocksForExport);
        logger.debug('[App] EXPORT: Rendu des diagrammes terminé.');

        const markedExporter = new Marked();
        markedExporter.use(gfmHeadingId());
        let rendererInstance = markedExporter.defaults.renderer;
        if (!rendererInstance || typeof rendererInstance.code !== 'function') {
          logger.warn("[App] EXPORT: markedExporter.defaults.renderer non trouvé ou invalide, création d'un nouveau Renderer.");
          rendererInstance = new markedExporter.Renderer();
        }

        rendererInstance.code = (token: Tokens.Code) => {
          const { text, lang, escaped } = token;
          if (lang) {
            const module = getBlockModuleByCodeLanguage(lang);
            if (module && module.serializeToHTML && module.parseContent) {
              try {
                const customData = module.parseContent(text, 'export-dummy-id');
                return module.serializeToHTML(customData, 'export-dummy-id');
              } catch (e) {
                logger.error(`[App] EXPORT: Erreur lors de serializeToHTML pour module ${module.type} (lang ${lang})`, e);
              }
            }
          }
          if (lang === 'summary') {
            const summaryInnerHtml = markedExporter.parse(text) as string;
            return `
            <div class="nova-block-summary-exported">
              <h3 class="summary-title">Table des matières</h3>
              ${summaryInnerHtml}
            </div>
          `;
          }
          const langClass = lang ? `language-${lang}` : '';
          return `<pre><code class="${langClass}">${escaped ? text : escape(text, true)}\n</code></pre>`;
        };
        rendererInstance.html = (token: Tokens.HTML): string => {
          return token.text;
        };
        finalHtmlContent = markedExporter.parse(markdownWithRenderedMermaid, { renderer: rendererInstance }) as string;
      }

      switch (formatChoice) {
        case 'md':
          logger.debug('[App] EXPORT: Format MD chosen.');
          if (markdownPure) {
            const defaultFilename = documentName.trim() ? `${documentName.trim().replace(/[^a-z0-9_-]/gi, '-')}.md` : `nova-document-${new Date().toISOString().split('T')[0]}.md`;
            const mdFileName = window.prompt("Nom du fichier Markdown:", defaultFilename) || defaultFilename;
            downloadFile(mdFileName, markdownPure, 'text/markdown;charset=utf-8');
            logger.debug(`[App] EXPORT: Document exporte en Markdown sous : ${mdFileName}`);
            setHasUnsavedChanges(false);
          } else {
            logger.debug('[App] EXPORT: Exportation Markdown annulee.');
          }
          break;
        case 'html':
          logger.debug('[App] EXPORT: Format HTML chosen.');
          if (finalHtmlContent) {
            const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Exporté</title>
  <style>
    body { font-family: sans-serif; margin: 20px; line-height: 1.6; }
    @media print {
      body { margin: 15mm; font-size: 10pt; line-height: 1.35; }
      h1 { font-size: 18pt; margin-top: 1em; margin-bottom: 0.4em; }
      h2 { font-size: 14pt; margin-top: 1em; margin-bottom: 0.4em; }
      p, ul, ol { margin-bottom: 0.6em; }
      pre, code { font-size: 9pt; }
    }
    img { max-width: 100%; height: auto; }
    .mermaid-diagram-container svg { max-width: 100%; height: auto; }
    .mermaid-render-error { border: 1px solid red; padding: 10px; background-color: #fff0f0; }
    .custom-html-palette-container { display: flex; flex-wrap: wrap; padding: 10px; margin-bottom: 1.5em; border: 1px solid #eee; border-radius: 4px; background-color: #f9f9f9; }
    .palette-color-item { width: 120px; margin: 8px; border: 1px solid #ddd; box-shadow: 2px 2px 5px rgba(0,0,0,0.05); border-radius: 4px; text-align: center; font-family: 'Consolas', 'Menlo', monospace; font-size: 12px; background-color: #fff; padding-bottom: 5px; overflow: hidden; }
    .palette-color-item-display { width: 100%; height: 80px; border-bottom: 1px solid #eee; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .palette-color-item-name { padding: 5px 3px; font-weight: bold; color: #333; word-wrap: break-word; }
    .palette-color-item-hex { color: #555; font-size: 11px; }
    .nova-block-summary-exported { padding: 16px; border: 1px solid #e2e8f0; background-color: #f9fafb; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); margin-bottom: 1em; }
    .nova-block-summary-exported .summary-title { font-size: 1.125em; font-weight: 600; margin-bottom: 0.75em; color: #374151; border-bottom: 1px solid #d1d5db; padding-bottom: 0.5em; }
    .nova-block-summary-exported ul { list-style-type: none; padding-left: 0; }
    .nova-block-summary-exported ul ul { padding-left: 1.5em; }
    .nova-block-summary-exported a { color: #2563eb; text-decoration: none; }
    .nova-block-summary-exported a:hover { color: #1d4ed8; text-decoration: underline; }
  </style>
</head>
<body>
${finalHtmlContent}
</body>
</html>`;
            const htmlFilename = documentName.trim() ? `${documentName.trim().replace(/[^a-z0-9_-]/gi, '-')}.html` : `nova-document-${new Date().toISOString().split('T')[0]}.html`;
            downloadHtmlFile(fullHtml, htmlFilename);
          } else {
            logger.error('[App] EXPORT: HTML content is null for HTML export. This should not happen.');
          }
          break;

        default:
          logger.debug(`[App] EXPORT: Choix de format d exportation non valide ou annule: ${formatChoice}`);
          break;
      }
    } catch (e) {
      console.error("Error in handleFullExportProcess:", e);
      alert("Une erreur est survenue pendant l'exportation. Regardez la console.");
    }
  }, [blocksState.blocks, downloadHtmlFile, setHasUnsavedChanges, renderMermaidDiagramsInMarkdown, prepareMarkdownContent]);

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
    </div>
  );
}

const escape = (html: string, encode: boolean) => {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export default App;