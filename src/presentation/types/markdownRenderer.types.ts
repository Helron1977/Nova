import React from 'react';
import type { Block } from '@/application/logic/markdownParser';

// Props attendues par un composant de rendu de bloc qui peut être triable
export type SortableBlockRendererProps = {
  block: Block; // Le bloc de données Markdown
  style?: React.CSSProperties; // Styles appliqués par dnd-kit (transform, transition, etc.)
  attributes?: Record<string, any>; // Attributs appliqués par dnd-kit (aria, etc.)
};

// Type définissant un composant React qui:
// 1. Accepte les SortableBlockRendererProps
// 2. Accepte une ref (via React.forwardRef)
// 3. La ref est typée comme pouvant être n'importe quel HTMLElement pour flexibilité
export type SortableBlockComponent = React.ForwardRefExoticComponent<
  SortableBlockRendererProps & React.RefAttributes<HTMLElement> 
>; 