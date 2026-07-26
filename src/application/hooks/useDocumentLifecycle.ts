import { useState, useCallback, useEffect } from 'react';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { Marked, type Tokens } from 'marked';
import { gfmHeadingId, getHeadingList, resetHeadings } from 'marked-gfm-heading-id';
import { markdownToBlocks, type Block, type ImageBlock, type HeadingBlock, type CodeBlock, type InlineElement } from '@/application/logic/markdownParser';
import { blocksToMarkdown } from '@/application/logic/markdownSerializer';
import { buildAST, serializeASTToLLMContext } from '@/application/logic/astGenerator';
import { generateNovaMutationProtocolInstructions } from '@/application/logic/novaProtocolParser';
import { getBlockModuleByCodeLanguage } from '@/application/logic/blockRegistry';

const logger = new PinoLogger();

export const simpleSlugify = (text: string): string => {
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

export const getPlainTextFromInlineElements = (elements: InlineElement[] | undefined): string => {
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

export const downloadFile = (filename: string, content: string, mimeType: string) => {
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

const escapeStr = (html: string, encode: boolean) => {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export function useDocumentLifecycle(
  blocks: Block[],
  setExternalBlocks: (blocks: Block[]) => void,
  isLoadingInitialMarkdown: boolean,
  originalLoadedBlocks: Block[] | null
) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [documentName, setDocumentName] = useState<string>('Document sans titre');

  useEffect(() => {
    if (!isLoadingInitialMarkdown && originalLoadedBlocks && blocks !== originalLoadedBlocks) {
      logger.debug('[App] Block state changed, marking as unsaved.');
      setHasUnsavedChanges(true);
    }
  }, [blocks, originalLoadedBlocks, isLoadingInitialMarkdown]);

  useEffect(() => {
    document.title = hasUnsavedChanges ? '● Nova' : 'Nova';
  }, [hasUnsavedChanges]);

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
                  logger.warn(`[App] Le fichier téléchargé n'est pas une image reconnue (${blob.type}). Elle sera conservée en lien externe.`);
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
                logger.error(`[App] Échec du téléchargement image ${imgBlock.content.url}:`, error);
                alert(`Impossible de télécharger l'image: ${imgBlock.content.url}. Elle sera conservée en lien externe.`);
                return block;
              }
            }
            return block;
          })
        );
        currentBlocks = updatedImageBlocks;
      }
    }
    return blocksToMarkdown(currentBlocks);
  }, []);

  const triggerSave = useCallback(async () => {
    logger.debug('[App] Déclenchement sauvegarde (Ctrl+S)...');
    try {
      const markdownToSave = await prepareMarkdownContent(blocks);

      if (markdownToSave === null) {
        logger.warn('[App] Préparation du contenu annulée ou vide pour la sauvegarde. Sauvegarde annulée.');
        return;
      }

      const defaultFileName = 'nova-document.md';
      downloadFile(defaultFileName, markdownToSave, 'text/markdown;charset=utf-8');
      logger.debug(`[App] Document sauvegardé en Markdown sous : ${defaultFileName}`);
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Error in triggerSave:", e);
      alert("Erreur lors de la sauvegarde.");
    }
  }, [prepareMarkdownContent, blocks]);

  const handleExportAST = useCallback(() => {
    logger.debug('[App] EXPORT Contexte IA déclenché...');
    try {
      const ast = buildAST(blocks);
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
  }, [blocks]);

  const handleLoadMarkdown = useCallback((markdownContent: string) => {
    try {
      logger.debug('[App] Chargement de nouveau contenu Markdown...');
      const newBlocks = markdownToBlocks(markdownContent);
      setExternalBlocks(newBlocks);
      setHasUnsavedChanges(false);
      logger.debug('[App] Contenu chargé et blocs mis à jour.');
    } catch (error) {
      logger.error('[App] Erreur lors du parsing du Markdown chargé:', error);
      alert("Erreur lors du chargement ou du parsing du fichier Markdown.");
    }
  }, [setExternalBlocks]);

  const downloadHtmlFile = useCallback((htmlContent: string, defaultFileName: string) => {
    const fileName = prompt("Exporter en HTML sous le nom :", defaultFileName);
    if (fileName) {
      downloadFile(fileName, htmlContent, 'text/html;charset=utf-8');
      logger.debug(`[App] Document exporté en HTML sous : ${fileName}`);
      setHasUnsavedChanges(false);
    }
  }, []);

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

    if (mermaidBlockInfos.length === 0) return outputMarkdown;

    await new Promise(resolve => setTimeout(resolve, 200));

    for (const mermaidInfo of mermaidBlockInfos) {
      const containerDiv = document.querySelector(`div.custom-mermaid-container[data-block-id="${mermaidInfo.id}"]`);
      if (containerDiv) {
        const svgElement = containerDiv.querySelector('svg');
        if (svgElement) {
          const svgHTML = svgElement.outerHTML;
          const replacementHtml = `<div class="mermaid-diagram-container" data-mermaid-block-id="${mermaidInfo.id}">${svgHTML}</div>`;
          if (outputMarkdown.includes(mermaidInfo.originalMarkdown)) {
            outputMarkdown = outputMarkdown.replace(mermaidInfo.originalMarkdown, replacementHtml);
          }
        }
      }
    }
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
    setIsExportModalOpen(false);

    if (formatChoice === 'pdf') {
      setTimeout(() => {
        window.print();
      }, 100);
      return;
    }

    try {
      let blocksForExport = JSON.parse(JSON.stringify(blocks)) as Block[];
      const markdownContentWithOriginalSummaryLinks = await prepareMarkdownContent(blocksForExport);

      if (markdownContentWithOriginalSummaryLinks === null) return;

      resetHeadings();
      const idExtractor = new Marked();
      idExtractor.use(gfmHeadingId());
      idExtractor.parse(markdownContentWithOriginalSummaryLinks);
      const generatedHeadings = getHeadingList();

      const titleTextToGfmIdMap = new Map<string, string>();
      generatedHeadings.forEach(h => {
        if (h.raw && h.id) {
          titleTextToGfmIdMap.set(h.raw.trim(), h.id);
        }
      });

      const summaryBlockIndex = blocksForExport.findIndex(block =>
        block.type === 'code' && (block as CodeBlock).content.language === 'summary'
      );

      if (summaryBlockIndex !== -1) {
        const summaryBlock = blocksForExport[summaryBlockIndex] as CodeBlock;
        const summaryLines = summaryBlock.content.code.split('\n');

        const updatedSummaryLines = summaryLines.map(line => {
          const match = line.match(/^(\s*)- \[(.*?)\]\(#(.*?)\)$/);
          if (match) {
            const indentation = match[1];
            const linkText = match[2];
            const originalBlockId = match[3];
            const headingBlock = blocks.find(b => b.id === originalBlockId && b.type === 'heading') as HeadingBlock | undefined;

            if (headingBlock) {
              const originalTitleText = getPlainTextFromInlineElements(headingBlock.content.children).trim();
              if (originalTitleText) {
                const gfmId = titleTextToGfmIdMap.get(originalTitleText);
                if (gfmId) {
                  return `${indentation}- [${linkText}](#${gfmId})`;
                } else {
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
      }

      const markdownPure = await prepareMarkdownContent(blocksForExport);

      if (markdownPure === null) return;

      let finalHtmlContent: string | null = null;

      if (formatChoice === 'html') {
        const markdownWithRenderedMermaid = await renderMermaidDiagramsInMarkdown(markdownPure, blocksForExport);

        const markedExporter = new Marked();
        markedExporter.use(gfmHeadingId());
        let rendererInstance = markedExporter.defaults.renderer;
        if (!rendererInstance || typeof rendererInstance.code !== 'function') {
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
                logger.error(`[App] EXPORT: Erreur serializeToHTML pour module ${module.type}`, e);
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
          return `<pre><code class="${langClass}">${escaped ? text : escapeStr(text, true)}\n</code></pre>`;
        };
        rendererInstance.html = (token: Tokens.HTML): string => {
          return token.text;
        };
        finalHtmlContent = markedExporter.parse(markdownWithRenderedMermaid, { renderer: rendererInstance }) as string;
      }

      switch (formatChoice) {
        case 'md':
          if (markdownPure) {
            const defaultFilename = documentName.trim() ? `${documentName.trim().replace(/[^a-z0-9_-]/gi, '-')}.md` : `nova-document-${new Date().toISOString().split('T')[0]}.md`;
            const mdFileName = window.prompt("Nom du fichier Markdown:", defaultFilename) || defaultFilename;
            downloadFile(mdFileName, markdownPure, 'text/markdown;charset=utf-8');
            setHasUnsavedChanges(false);
          }
          break;
        case 'html':
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
          }
          break;
      }
    } catch (e) {
      console.error("Error in handleFullExportProcess:", e);
      alert("Une erreur est survenue pendant l'exportation. Regardez la console.");
    }
  }, [blocks, downloadHtmlFile, setHasUnsavedChanges, renderMermaidDiagramsInMarkdown, prepareMarkdownContent, documentName]);

  return {
    documentName,
    setDocumentName,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    isExportModalOpen,
    setIsExportModalOpen,
    handleLoadMarkdown,
    handleFullExportProcess,
    handleExportAST,
    handleNewDocument,
    executeExport,
    triggerSave
  };
}
