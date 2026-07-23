import React from 'react';
import type { BlockRendererProps } from '../../interfaces/blockModule';
import type { SpaceBlockData } from './spaceBlockModule';
// import { Resizable } from 're-resizable'; // Retiré pour l'instant
import { PinoLogger } from '../../../infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

export const SpaceRenderer: React.FC<BlockRendererProps<SpaceBlockData>> = ({
  block,
  customData,
}) => {
  const { height, originalInput } = customData;

  // TODO: Implémenter une logique de redimensionnement interactive plus tard.
  // Pour l'instant, la hauteur est fixe basée sur `customData.height`.
  // L'édition se ferait en modifiant le code `h=NUMBER` dans le bloc de code.

  // Si on est en mode édition du bloc de code parent (pas une édition spécifique de "SpaceBlock")
  // on pourrait vouloir ne rien afficher pour que l'éditeur de code brut soit visible.
  // Cependant, `isEditing` ici réfère à l'état d'édition géré par SortableBlockItem, qui est souvent un CoreBlockEditor.
  // Pour un bloc simple comme `space`, on affiche toujours l'espace.

  logger.debug(`[SpaceRenderer] Rendu du bloc ${block.id} avec hauteur ${height}px.`);

  // Un style pour visualiser l'espace, surtout si la hauteur est petite.
  // Peut être rendu invisible ou différent en mode non-édition.
  const style: React.CSSProperties = {
    height: `${height}px`,
    width: '100%',
    userSelect: 'none', // Empêcher la sélection de cet espace
    // Pourrait avoir une bordure ou un fond léger en mode "édition" pour le rendre visible
    // backgroundColor: isEditing ? 'rgba(0,0,255,0.05)' : 'transparent',
    // border: isEditing ? '1px dashed rgba(0,0,255,0.2)' : 'none',
  };

  // Si l'utilisateur modifie le `h=30` dans le code source, c'est `onUpdateBlockContent` qui sera appelé
  // par l'éditeur de code (CoreBlockEditor). Le `markdownParser` re-parsera ensuite.

  return (
    <div 
      style={style} 
      data-testid={`space-block-${block.id}-h-${height}`}
      title={`Espace de ${height}px (contenu original: "${originalInput}")`}
    >
      {/* Optionnel: Afficher la hauteur si en mode "design" ou debug */}
      {/* {isEditing && <span className="text-xs text-gray-400">{height}px</span>} */}
    </div>
  );
}; 