import React, { useRef, useEffect } from 'react';

// Définition des types pour les props
interface ShapeInfo {
  name: string;
  brackets: string;
  iconClass: string; // ex: 'bi-square', 'bi-circle'
}

interface MermaidContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  shapes: ShapeInfo[];
  selectedColor: string; // Format Hex, ex: '#FFFFFF'
  onClose: () => void;
  // Placeholders pour les actions futures
  onShapeSelect?: (brackets: string) => void; 
  onColorChange?: (color: string) => void; 
}

// Helper pour mapper les formes aux icônes Bootstrap (simplifié)
// TODO: Compléter/améliorer ce mapping
const getIconForShape = (brackets: string): string => {
    if (brackets === '[]') return 'bi-square';
    if (brackets === '(())') return 'bi-circle';
    if (brackets === '{}') return 'bi-diamond';
    if (brackets === '()') return 'bi-capsule'; // Pour Round Edges
    if (brackets === '[()]') return 'bi-database'; // Pour Cylinder
    if (brackets === '([])') return 'bi-stadium'; // Pas d'icône parfaite, utiliser text?
    if (brackets === '{{}}') return 'bi-hexagon';
    return 'bi-shapes'; // Default
};


export const MermaidContextMenu: React.FC<MermaidContextMenuProps> = ({
  isVisible,
  position,
  shapes,
  selectedColor,
  onClose,
  onShapeSelect = () => {}, // Fournir des fonctions vides par défaut
  onColorChange = () => {}, // Fournir des fonctions vides par défaut
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Effet pour fermer le menu lors d'un clic à l'extérieur
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    // Ajouter l'écouteur après un court délai pour éviter qu'il ne se ferme immédiatement
    const timerId = setTimeout(() => {
         document.addEventListener('click', handleClickOutside, { capture: true, once: true });
    }, 0);

    // Nettoyage : supprimer l'écouteur quand le composant est démonté ou n'est plus visible
    return () => {
        clearTimeout(timerId);
        document.removeEventListener('click', handleClickOutside, { capture: true });
    };
  }, [isVisible, onClose]);


  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 flex items-start bg-transparent border-none rounded-xl shadow-xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
        {/* Section Picker Couleur (Gauche) */}
        <div className="p-3 flex justify-center items-center bg-transparent">
            <div 
                className="mermaid-color-wheel relative w-24 h-24 rounded-full border-2 border-white shadow-md cursor-crosshair"
                style={{
                    background: `conic-gradient(
                        hsl(0, 100%, 50%), 
                        hsl(60, 100%, 50%), 
                        hsl(120, 100%, 50%), 
                        hsl(180, 100%, 50%), 
                        hsl(240, 100%, 50%), 
                        hsl(300, 100%, 50%),
                        hsl(360, 100%, 50%)
                    )`,
                    '--selected-color': selectedColor 
                } as React.CSSProperties}
                // onClick={(e) => { /* TODO: Logique de sélection de couleur */ console.log('Color wheel clicked'); onColorChange('#TODO'); }}
            >
                {/* Le cercle intérieur est maintenant géré par la classe CSS globale .mermaid-color-wheel::before */}
            </div>
        </div>

        {/* Conteneur pour les formes (Droite) */}
        <div className="flex-1 self-stretch p-1 rounded-r-xl rounded-bl-none bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-hidden">
             {/* En-tête Section Formes */}
             <div className="px-3 py-1 mb-1 text-xs font-medium text-white uppercase tracking-wider cursor-default opacity-80">
                 Formes Nœud
             </div>

             {/* Liste des Formes */}
             <div className="flex flex-col">
                 {shapes.sort((a, b) => a.name.localeCompare(b.name)).map((shape) => (
                    <button
                        key={shape.brackets}
                        onClick={() => { 
                            onShapeSelect(shape.brackets); 
                            onClose(); // Fermer après sélection
                        }}
                        className="flex items-center w-full px-3 py-1.5 text-sm text-white text-left rounded-md transition-colors duration-100 ease-in-out hover:bg-white/10 focus:outline-none focus:bg-white/20"
                    >
                        <i className={`${getIconForShape(shape.brackets)} mr-3 w-4 text-center text-base opacity-90`}></i>
                        {shape.name}
                    </button>
                 ))}
             </div>
        </div>
    </div>
  );
}; 