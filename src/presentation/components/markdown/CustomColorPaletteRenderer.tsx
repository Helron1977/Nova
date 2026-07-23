import React, { useState, useCallback } from 'react';

interface ColorInfo {
  hex: string;
  name?: string; // Optionnel pour l'instant
}

interface CustomColorPaletteRendererProps {
  // Pour l'instant, on passe directement les couleurs.
  // Plus tard, cela viendra du contenu d'un bloc parsé.
  colors: ColorInfo[];
  blockId: string; // Pour l'attribut data-block-id
}

const CustomColorPaletteRenderer: React.FC<CustomColorPaletteRendererProps> = ({ colors, blockId }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (hex: string, index: number) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch (err) {
      console.error('Erreur lors de la copie du code couleur: ', err);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    }
  }, []);

  if (!colors || colors.length === 0) {
    return (
      <div className="p-3 my-2 border border-dashed text-gray-400 italic text-center rounded-lg" data-block-id={blockId}>
        Palette de couleurs vide.
      </div>
    );
  }

  return (
    <div className="nova-color-palette-block my-3" data-block-id={blockId}>
      {/* Le titre "Palette de Couleurs :" peut être géré par le bloc parent ou retiré si l'affichage est clair */} 
      {/* <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Palette :</p> */}
      <div className="flex flex-row h-24 rounded-lg overflow-hidden shadow dark:shadow-gray-700/50">
        {colors.map((color, index) => (
          <div
            key={index}
            className="group/colorstrip relative flex-1 flex items-center justify-center cursor-pointer transition-transform duration-150 ease-in-out transform hover:scale-y-125 hover:shadow-lg hover:z-10"
            style={{ backgroundColor: color.hex }}
            title={color.name ? `${color.name} (${color.hex})` : color.hex}
            onClick={() => handleCopy(color.hex, index)}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent group-hover/colorstrip:bg-black/75 transition-all duration-150 ease-in-out p-1">
              <span className="text-xs sm:text-sm font-mono text-white opacity-0 group-hover/colorstrip:opacity-100 select-all px-2 py-1 rounded bg-black bg-opacity-50 group-hover/colorstrip:bg-opacity-70">
                {copiedIndex === index ? 'Copié!' : color.hex.toUpperCase()}
              </span>
              {color.name && (
                <span className="mt-1 text-xs text-white opacity-0 group-hover/colorstrip:opacity-80 truncate px-1">
                  {color.name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Feedback global peut être moins nécessaire si le feedback est sur le bloc lui-même */}
      {/* {copyFeedback && <p className="text-xs text-green-500 dark:text-green-400 mt-1 text-center h-4">{copyFeedback}</p>} */}
    </div>
  );
};

export default React.memo(CustomColorPaletteRenderer); 