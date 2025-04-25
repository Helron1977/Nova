import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import type { MermaidBlock } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Instancier le logger
const logger = new PinoLogger();

interface CustomMermaidRendererProps {
  block: MermaidBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  listIndex?: number;
  index?: number;
  attributes?: Record<string, any>;
}

// Utiliser React.forwardRef
const CustomMermaidRenderer = React.forwardRef<
  HTMLDivElement, // Type de l'élément DOM racine (div)
  CustomMermaidRendererProps
>(({ 
  block, 
  style, 
  onUpdateBlockContent,
  listIndex,
  index,
  ...rest 
}, ref) => {
  const { code } = block.content;
  const mermaidRef = useRef<HTMLDivElement>(null); // Ref interne pour Mermaid
  const renderedCodeRef = useRef<string | null>(null);
  const isRenderingRef = useRef(false); // Ref de verrouillage

  useEffect(() => {
    const currentCode = (typeof code === 'string' && code.trim() !== '') ? code.trim() : null;
    
    logger.debug(`[Mermaid ${block.id}] PRE-CHECK useEffect. Current code:`, currentCode, "Rendered ref:", renderedCodeRef.current, "Is rendering:", isRenderingRef.current);

    // Condition 1: Code valide existe ET (il est différent du dernier rendu OU jamais rendu)
    if (currentCode && currentCode !== renderedCodeRef.current) {
      // Vérifier si un rendu est déjà en cours
      if (isRenderingRef.current) {
          logger.debug(`[Mermaid ${block.id}] Render already in progress. Skipping duplicate request.`);
          return; // Sortir si un rendu est en cours
      }
      
      logger.debug(`[Mermaid ${block.id}] Code changed or first render. Attempting render...`);
      isRenderingRef.current = true; // Verrouiller

      const renderMermaid = async () => {
        if (!mermaidRef.current) {
           logger.warn(`[Mermaid ${block.id}] Ref non disponible au moment du rendu asynchrone.`);
           isRenderingRef.current = false; // Déverrouiller en cas d'erreur précoce
           return; 
        }
        try {
          const { svg } = await mermaid.render(`mermaid-temp-id-${block.id}`, currentCode);
          
          // Vérifier à nouveau la ref *après* l'await
          if (mermaidRef.current) {
            logger.debug(`[Mermaid ${block.id}] Render successful. Setting innerHTML. Storing rendered code.`);
            mermaidRef.current.innerHTML = svg;
            renderedCodeRef.current = currentCode;
          } else {
            logger.warn(`[Mermaid ${block.id}] Ref devenue nulle PENDANT le rendu asynchrone.`);
          }
          
        } catch (e: any) {
          logger.error(`[Mermaid ${block.id}] Rendering error:`, e);
          const errorMessage = e.message || 'Error rendering Mermaid diagram.';
          if (mermaidRef.current) {
            logger.debug(`[Mermaid ${block.id}] Setting error message.`);
            mermaidRef.current.textContent = errorMessage;
            renderedCodeRef.current = null; // Effacer le code rendu en cas d'erreur
          }
        } finally {
           isRenderingRef.current = false; // Déverrouiller dans tous les cas
        }
      };
      renderMermaid(); 

    // Condition 2: Le code est devenu invalide/vide alors qu'il y avait un rendu avant
    } else if (!currentCode && renderedCodeRef.current !== null) {
        // Pas besoin de vérifier isRenderingRef ici, c'est une opération synchrone rapide
        logger.debug(`[Mermaid ${block.id}] Code is now empty/invalid. Clearing innerHTML and stored code.`);
        if(mermaidRef.current) {
            mermaidRef.current.innerHTML = '';
        }
        renderedCodeRef.current = null; // Oublier l'ancien code rendu
    
    // Condition 3: Rien à faire (code inchangé ou invalide depuis le début)
    } else {
       logger.debug(`[Mermaid ${block.id}] NO RENDER/CLEAR NEEDED. Ref exists: ${!!mermaidRef.current}, currentCode: ${currentCode !== null}, renderedCodeRef !== null: ${renderedCodeRef.current !== null}, code changed: ${currentCode === renderedCodeRef.current}`);
    }

  }, [code, block.id]); // Garder les dépendances

  // Combiner la ref externe (pour DND) et la ref interne (pour Mermaid)
  const combinedRef = (node: HTMLDivElement | null) => {
      // Assigner à la ref interne
      (mermaidRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      // Assigner à la ref externe (forwarded ref)
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
  };

  return (
    <div 
      key={block.id} 
      ref={combinedRef} // Utiliser la ref combinée
      style={style} 
      {...rest} 
      className="mermaid-container p-2 border border-dashed border-transparent hover:border-gray-300 dark:hover:border-gray-600"
    >
    </div>
  );
});

CustomMermaidRenderer.displayName = 'CustomMermaidRenderer';

export default CustomMermaidRenderer; 