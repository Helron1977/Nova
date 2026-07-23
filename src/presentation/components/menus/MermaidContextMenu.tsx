import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MermaidTargetInfo } from '@/presentation/utils/mermaidUtils';
// Importer les constantes depuis le fichier de configuration
import { MERMAID_EDGE_STYLES, nodeShapes, MERMAID_COLOR_DEBOUNCE } from '@/presentation/config/mermaidConstants';
import { HexColorPicker } from 'react-colorful';

// --- Interface des Props ---
interface MermaidContextMenuProps {
  x: number;
  y: number;
  targetInfo: MermaidTargetInfo;
  // initialColor n'est plus nécessaire ici car récupéré via targetInfo.style
  onClose: () => void;
  onAction: (action: string, targetInfo: MermaidTargetInfo, value?: string) => void;
}

// --- Composant Menu ---
const MermaidContextMenu: React.FC<MermaidContextMenuProps> = ({
  x,
  y,
  targetInfo,
  onClose,
  onAction
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ top: y, left: x });
  // Couleur initiale basée sur le style du nœud si disponible
  const initialColor = targetInfo?.type === 'node' ? targetInfo.style?.fill || '#ffffff' : '#ffffff';
  const [color, setColor] = useState(initialColor);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Ajustement Position pour rester dans le viewport ---
  useEffect(() => {
    const menu = menuRef.current;
    if (menu) {
      const menuRect = menu.getBoundingClientRect();
      // Utiliser innerWidth/Height pour la taille du viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let newTop = y; // Commencer avec la position du clic
      let newLeft = x;

      // Ajuster si le menu dépasse en bas
      if (y + menuRect.height > viewportHeight - 10) { // Ajouter une petite marge
        newTop = viewportHeight - menuRect.height - 10;
      }
      // Ajuster si le menu dépasse à droite
      if (x + menuRect.width > viewportWidth - 10) {
        newLeft = viewportWidth - menuRect.width - 10;
      }
      // S'assurer que le menu ne sort pas en haut ou à gauche
      if (newTop < 10) newTop = 10;
      if (newLeft < 10) newLeft = 10;

      // Mettre à jour seulement si la position a changé pour éviter boucle infinie
      if (newTop !== adjustedPosition.top || newLeft !== adjustedPosition.left) {
           setAdjustedPosition({ top: newTop, left: newLeft });
      }
    }
  // Les dépendances initiales x, y suffisent. adjustedPosition change mais est calculé à partir de x,y
  }, [x, y]);

  // --- Fermeture au clic extérieur ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Vérifier si le clic est en dehors du menu
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    // Utiliser mousedown pour intercepter avant d'autres clics potentiels
    document.addEventListener('mousedown', handleClickOutside);
    // Nettoyer l'écouteur au démontage
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]); // Dépend seulement de onClose

  // --- Handler pour le changement de couleur (avec debounce) ---
  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor); // Met à jour l'UI immédiatement
    // Annuler le timer précédent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Définir un nouveau timer pour l'action
    debounceTimerRef.current = setTimeout(() => {
      // Vérifier que targetInfo est bien un noeud avant d'envoyer l'action
      if (targetInfo && targetInfo.type === 'node') {
        onAction('changeColor', targetInfo, newColor);
      }
    }, MERMAID_COLOR_DEBOUNCE); // Utilisation de la constante importée
  }, [onAction, targetInfo]); // Dépend de onAction et targetInfo

  // --- Nettoyage du timer au démontage ---
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []); // Exécuté seulement au montage/démontage

  // --- Style calculé pour le menu ---
  const menuStyle: React.CSSProperties = {
    position: 'fixed', // Positionnement par rapport au viewport
    left: `${adjustedPosition.left}px`, // Utilisation de left/top
    top: `${adjustedPosition.top}px`,
    zIndex: 1050, // Assurer la visibilité au-dessus des autres éléments
  };

  // Si pas de targetInfo valide, ne rien rendre
  if (!targetInfo) {
    return null;
  }

  // --- Rendu JSX ---
  return (
    <div
      ref={menuRef}
      id="mermaid-context-menu"
      // Empêcher la propagation du clic pour ne pas fermer immédiatement
      onClick={(e) => e.stopPropagation()}
      // Empêcher le menu contextuel natif du navigateur
      onContextMenu={(e) => e.preventDefault()}
      className="flex items-start bg-transparent rounded-lg shadow-xl text-sm gap-1"
      style={menuStyle}
    >
      {/* Section Gauche: Color Picker (Affiché SEULEMENT pour les noeuds) */}
      {targetInfo.type === 'node' && (
        <div className="flex-shrink-0">
          <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-l-lg p-1 shadow-inner">
              <HexColorPicker color={color} onChange={handleColorChange} style={{ width: '100%', height: '100%' }} />
          </div>
          {/* Affichage de la valeur hex sous le picker */}
          <div className="mt-1 text-center text-xs text-gray-600 dark:text-gray-400 font-mono select-all bg-white/70 dark:bg-black/50 rounded px-1 py-0.5">
            {color}
          </div>
        </div>
      )}

      {/* Section Droite: Liste des Actions */}
      <div className={`flex-1 flex flex-col p-2 bg-white dark:bg-gray-800 ${targetInfo.type === 'node' ? 'rounded-r-lg border-l border-gray-200 dark:border-gray-700' : 'rounded-lg'} min-w-[150px]`}>

        {/* --- Options pour les NŒUDS --- */}
        {targetInfo.type === 'node' && (
          <>
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Forme</div>
            <div className="flex flex-col">
              {[...nodeShapes] // Cloner car ReadonlyArray pour utiliser sort
                .sort((a,b) => a.name.localeCompare(b.name))
                .map(shape => (
                  <button
                    key={shape.brackets}
                    className="text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onClick={() => {
                        onAction('changeShape', targetInfo, shape.brackets);
                        onClose(); // Fermer après action
                    }}
                  >
                    <span>{`${shape.brackets} ${shape.name}`}</span>
                  </button>
                ))}
            </div>
          </>
        )}

        {/* --- Options pour les LIENS (Edges) --- */}
        {targetInfo.type === 'edge' && (
          <>
             <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Style Ligne</div>
             <div className="flex flex-col">
                 {/* Itérer sur les styles importés */}
                 {MERMAID_EDGE_STYLES.map(style => (
                    <button
                        key={style}
                        className="text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm"
                        onClick={() => {
                            onAction('setEdgeStyle', targetInfo, style);
                            onClose(); // Fermer après action
                        }}
                    >
                        <span>{style}</span>
                    </button>
                 ))}
             </div>
          </>
        )}

        {/* --- Bouton Fermer (Toujours présent) --- */}
        <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-1">
           <button
              onClick={onClose}
              className="w-full text-left px-2 py-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default MermaidContextMenu;