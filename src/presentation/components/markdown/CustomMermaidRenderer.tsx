import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import type { MermaidBlock } from '@/application/logic/markdownParser';

interface CustomMermaidRendererProps {
  block: MermaidBlock;
  style?: React.CSSProperties;
  attributes?: Record<string, any>;
}

// Utiliser React.forwardRef
const CustomMermaidRenderer = React.forwardRef<
  HTMLDivElement, // Type de l'élément DOM racine (div)
  CustomMermaidRendererProps
>(({ block, style, ...attributes }, ref) => {
  const { code } = block.content;
  const mermaidRef = useRef<HTMLDivElement>(null); // Ref interne pour Mermaid

  useEffect(() => {
    // Rendre le useEffect async pour utiliser await
    const renderMermaid = async () => {
      if (mermaidRef.current) {
        try {
          // Attendre la résolution de la promesse retournée par mermaid.render
          const result = await mermaid.render(`mermaid-graph-${block.id}`, code);
          // Affecter la propriété svg du résultat à l'élément
          mermaidRef.current.innerHTML = result.svg;
          
        } catch (e) {
          console.error('Mermaid rendering error:', e);
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = 'Error rendering Mermaid diagram.';
          }
        }
      }
    };
    // Appeler la fonction async
    renderMermaid(); 

  }, [code, block.id]);

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
      {...attributes} 
      className="mermaid" // Garder la classe pour styles/ciblage potentiel
      // Laisser vide initialement, l'innerHTML sera défini dans useEffect
    >
    </div>
  );
});

CustomMermaidRenderer.displayName = 'CustomMermaidRenderer';

export default CustomMermaidRenderer; 