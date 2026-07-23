import { useState, useEffect } from 'react';
import { getSelectedInitialMarkdownModulePath } from '@/application/config/markdownSelector.config';
import { markdownToBlocks, type Block } from '../logic/markdownParser';
import { PinoLogger } from '../../infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

export function useInitialDocumentLoader(setExternalBlocks: (blocks: Block[]) => void) {
  const [isLoadingInitialMarkdown, setIsLoadingInitialMarkdown] = useState<boolean>(true);
  const [originalLoadedBlocks, setOriginalLoadedBlocks] = useState<Block[] | null>(null);

  useEffect(() => {
    const loadInitialMarkdown = async () => {
      setIsLoadingInitialMarkdown(true);
      setOriginalLoadedBlocks(null);
      
      const modulePath = getSelectedInitialMarkdownModulePath();
      let loadedContent: string | null = null;
      let resolvedPath = modulePath;

      try {
        let fileName = modulePath.split('/').pop()?.replace('.ts', '');
        logger.debug(`[useInitialDocumentLoader] Tentative de chargement dynamique de : ../config/${fileName}.ts (original: ${modulePath})`);
        const module = await import(`../config/${fileName}.ts`);

        if (module && typeof module.initialMarkdown === 'string') {
          loadedContent = module.initialMarkdown;
          logger.debug(`[useInitialDocumentLoader] Contenu Markdown chargé depuis ${resolvedPath}.`);
        } else {
          logger.error(`[useInitialDocumentLoader] Le module chargé depuis ${resolvedPath} ne contient pas d'export 'initialMarkdown' ou ce n'est pas une chaîne.`);
          const fallbackModule = await import('@/application/config/initialMarkdown');
          loadedContent = fallbackModule.initialMarkdown;
          logger.debug('[useInitialDocumentLoader] Contenu Markdown de fallback (initialMarkdown.ts) chargé.');
        }
      } catch (error) {
        logger.error(`[useInitialDocumentLoader] Erreur lors du chargement dynamique du module Markdown initial depuis ${resolvedPath} (original: ${modulePath}):`, error);
        try {
            const fallbackModule = await import('@/application/config/initialMarkdown');
            loadedContent = fallbackModule.initialMarkdown;
            logger.debug('[useInitialDocumentLoader] Contenu Markdown de fallback (initialMarkdown.ts) chargé après erreur.');
        } catch (fallbackError) {
            logger.error('[useInitialDocumentLoader] Erreur lors du chargement du module Markdown de fallback ultime:', fallbackError);
            loadedContent = '# Erreur critique de chargement du contenu initial';
        }
      }
      
      if (loadedContent !== null) {
        logger.debug('[useInitialDocumentLoader] Parsing du contenu Markdown chargé et mise à jour des blocs via setExternalBlocks...');
        const newBlocks = markdownToBlocks(loadedContent);
        setExternalBlocks(newBlocks); 
        setOriginalLoadedBlocks(newBlocks);
      } else {
        const errorBlocks = markdownToBlocks("# Erreur Critique de Chargement Inattendu");
        setExternalBlocks(errorBlocks);
        setOriginalLoadedBlocks(errorBlocks);
      }
      setIsLoadingInitialMarkdown(false);
    };

    loadInitialMarkdown();
  }, [setExternalBlocks]);

  return { isLoadingInitialMarkdown, originalLoadedBlocks };
}
