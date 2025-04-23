import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/application/logic/markdownParser';
import { markdownComponentsConfig } from '@/presentation/config/markdownComponentsConfig';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { Pilcrow, Heading1, Heading2, SquareCode, GitGraph, Image, Quote, Table, Codepen, Minus } from 'lucide-react';

interface SortableBlockItemProps {
  block: Block;
  children?: React.ReactNode; // Peut être des enfants directs (ListGroup) ou rien
  onDelete: (id: string) => void;
  onAddAfter: (data: { sortableId: string; selectedType: string }) => void;
  index: number;
}

// << AJOUT: Définition des types pour le sélecteur local >>
const blockTypes = [
  { type: 'paragraph', label: 'Paragraphe', Icon: Pilcrow },
  { type: 'heading1', label: 'Titre 1', Icon: Heading1 },
  { type: 'heading2', label: 'Titre 2', Icon: Heading2 },
  { type: 'code', label: 'Code', Icon: SquareCode },
  { type: 'mermaid', label: 'Mermaid', Icon: GitGraph },
  { type: 'image', label: 'Image', Icon: Image },
  { type: 'blockquote', label: 'Citation', Icon: Quote },
  { type: 'table', label: 'Tableau', Icon: Table },
  { type: 'html', label: 'HTML', Icon: Codepen },
  { type: 'thematicBreak', label: 'Ligne', Icon: Minus },
];

export const SortableBlockItem: React.FC<SortableBlockItemProps> = ({ block, children, onDelete, onAddAfter}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const sortableId = children ? `group-${block.id}` : block.id;
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    setActivatorNodeRef,
    transform, 
    transition, 
    isDragging 
  } = useSortable({ id: sortableId });

  // Style DND appliqué au wrapper div
  const itemStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative', // Pour positionner le handle
  };

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    top: '0.25rem',
    left: '-24px', // Ajustez si nécessaire
    cursor: 'grab',
    padding: '0.25rem',
    transition: 'opacity 0.15s ease-in-out',
    touchAction: 'none', 
  };

  // Style pour le bouton Supprimer (à côté du handle)
  const deleteButtonStyle: React.CSSProperties = {
    ...handleStyle, // Utiliser la base du style du handle
    left: '-48px', // Positionner à gauche du handle DND
    cursor: 'pointer', 
  };

  // Classes CSS pour le handle
  const handleClasses = "dnd-handle absolute text-gray-400 hover:text-gray-600 transition-opacity duration-150 ease-in-out";

  // << MODIFIÉ: Style de base pour la position >>
  const menuAreaBaseStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '-16px', // Position verticale de référence
    left: '50%',
    // Centrage et taille seront gérés par les classes de la zone invisible
    zIndex: 10, 
    // L'opacité et pointerEvents sont maintenant sur la zone invisible
  };

  // Déterminer le contenu à rendre à l'intérieur du wrapper
  let contentToRender: React.ReactNode;
  if (children) {
    // Cas 1: Des enfants sont fournis (ex: ListGroupRenderer)
    contentToRender = children;
  } else {
    // Cas 2: Pas d'enfants, utiliser BlockComponent
    const BlockComponent = markdownComponentsConfig[block.type as keyof typeof markdownComponentsConfig];
    if (BlockComponent) {
      // Cas 2b: Bloc standard connu
      // Le BlockComponent NE reçoit PLUS les props DND directement
      contentToRender = <BlockComponent block={block} />;
    } else {
      // Cas 2a: Type de bloc inconnu
      contentToRender = (
        <div className="border border-dashed border-red-500 p-2 my-1">
          Type de bloc inconnu: {block.type}
        </div>
      );
    }
  }

  const handleToggleSelector = () => {
    setIsSelectorOpen(!isSelectorOpen);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  };
  
  const handleTypeSelect = (type: string) => {
    console.log(`[SortableBlockItem] handleTypeSelect: ${type} for block: ${sortableId}`);
    onAddAfter({ sortableId, selectedType: type });
    setIsSelectorOpen(false);
  };
  
  const showMenu = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsHovering(true);
  };

  const hideMenuWithDelay = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovering(false);
      setIsSelectorOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const radius = 65;
  const totalItems = blockTypes.length;
  const angleStep = 360 / totalItems;

  return (
    <div 
      ref={setNodeRef} 
      style={itemStyle} 
      {...attributes} 
      data-dnd-wrapper
      className={`relative ${block.type === 'thematicBreak' ? 'py-1' : ''}`}
      onMouseEnter={showMenu}
      onMouseLeave={hideMenuWithDelay}
    >
      {/* Conteneur de Positionnement du Menu */}
      <div 
        style={menuAreaBaseStyle} 
        className="flex items-center justify-center pointer-events-none" // Ne capture pas d'événements ici
      >
         {/* << AJOUT: Zone Invisible pour le survol étendu >> */}
        <div 
           className={`absolute top-0 left-0 w-44 h-44 rounded-full 
                      transform -translate-x-1/2 /* Centre sur left:50% du parent */
                      bg-transparent /* Invisible */
                      transition-opacity duration-150 ease-in-out
                      ${isHovering ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`
                    }
           // << MODIFIÉ: Ces handlers maintiennent la visibilité >>
           onMouseEnter={showMenu} 
           onMouseLeave={hideMenuWithDelay} 
        >
            {/* Le contenu (bouton central, icônes) est positionné PAR RAPPORT à cette zone */} 

            {/* Bouton Central +/-/X (positionné au centre de la zone invisible) */}
            <button
              onClick={handleToggleSelector}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 /* Centrage */
                         p-1 w-7 h-7 flex items-center justify-center
                         bg-white dark:bg-gray-700 border rounded-full shadow
                         hover:bg-gray-100 dark:hover:bg-gray-600
                         text-blue-500 dark:text-blue-400
                         focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 
                         z-20 
                         transition-transform duration-300 ease-in-out 
                         ${isSelectorOpen ? 'rotate-45' : 'rotate-0'}`
                        }
              title={isSelectorOpen ? "Fermer" : "Ajouter bloc"}
            >
              <Plus size={14} />
            </button>

            {/* Conteneur pour les icônes (items) */}
            {/* Positionné absolument dans la zone invisible, les items rayonnent depuis le centre */}
            <div 
              className="absolute inset-0 w-full h-full" 
              style={{ pointerEvents: isSelectorOpen ? 'auto' : 'none'}} 
            >
              {blockTypes.map(({ type, label, Icon }, index) => {
                  const angle = angleStep * index;
                  const itemTransform = isSelectorOpen 
                      ? `rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)` 
                      : 'scale(0)';
                  const itemStyle: React.CSSProperties = {
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    margin: '-16px 0 0 -16px', // Centre l'item (w-8 h-8)
                    transform: itemTransform,
                    transition: `transform 0.3s ease-out, opacity 0.3s ease-out`,
                    transitionDelay: isSelectorOpen ? `${index * 0.05}s` : '0s',
                    opacity: isSelectorOpen ? 1 : 0, 
                  };
                  return (
                    <div 
                      key={type}
                      onClick={() => handleTypeSelect(type)}
                      className="w-8 h-8 flex items-center justify-center rounded-full 
                                 bg-slate-100 dark:bg-slate-700 
                                 border border-gray-300 dark:border-gray-600 
                                 text-gray-600 dark:text-gray-300 
                                 hover:bg-slate-200 dark:hover:bg-slate-600 hover:shadow-md 
                                 cursor-pointer"
                      style={itemStyle}
                      title={label}
                    >
                      <Icon size={16} />
                    </div>
                  );
              })}
            </div>
        </div>
      </div>

      <button 
        ref={setActivatorNodeRef}
        {...listeners}
        style={handleStyle} 
        className={handleClasses} 
        title="Déplacer le bloc"
      >
        <GripVertical size={18} />
      </button>
      <button
        onClick={() => onDelete(block.id)}
        style={deleteButtonStyle}
        className="dnd-handle absolute text-red-400 hover:text-red-600 transition-opacity duration-150 ease-in-out"
        title="Supprimer le bloc"
      >
        <Trash2 size={18} />
      </button>
      {contentToRender}
    </div>
  );
};