import React from 'react';
import type { ThematicBreakBlock } from '@/application/logic/markdownParser';

// Pas besoin de style ou attributes ici, car le wrapper DND les gère
interface CustomThematicBreakRendererProps {
  block: ThematicBreakBlock;
}

const CustomThematicBreakRenderer: React.FC<CustomThematicBreakRendererProps> = ({ block }) => {
  // Le composant rend simplement une ligne horizontale.
  // La clé est importante pour React lors du rendu de listes.
  // Les styles DND sont appliqués au div wrapper par SortableBlockItem.
  return <hr key={block.id} />;
};

export default CustomThematicBreakRenderer; 