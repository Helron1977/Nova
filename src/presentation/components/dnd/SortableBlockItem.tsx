import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/application/logic/markdownParser';
import { markdownComponentsConfig } from '@/presentation/config/markdownComponentsConfig';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { Pilcrow, Heading1, Heading2, SquareCode, GitGraph, Image, Quote, Table, Codepen, Minus } from 'lucide-react';

// << AJOUT: Importer le logger >>
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
const logger = new PinoLogger();

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
  const [showInsertIndicator, setShowInsertIndicator] = useState(false);
  const closeMenuTimerRef = useRef<NodeJS.Timeout | null>(null); // Renommé pour clarté
  
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

  // Styles communs pour les boutons de contrôle à gauche
  const controlButtonBaseStyle: React.CSSProperties = {
    position: 'absolute',
    top: '0.25rem',
    padding: '0.25rem',
    transition: 'opacity 0.15s ease-in-out',
    opacity: isHovering ? 1 : 0, // Contrôlé par le survol du bloc
    pointerEvents: isHovering ? 'auto' : 'none', // N'interagir que si visible
    zIndex: 20, // Au-dessus du contenu
  };

  const handleStyle: React.CSSProperties = {
    ...controlButtonBaseStyle,
    left: '-24px',
    cursor: 'grab',
    touchAction: 'none',
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...controlButtonBaseStyle,
    left: '-48px',
    cursor: 'pointer', 
  };

  // << AJOUT: Style pour le bouton Ajouter >>
  const addButtonStyle: React.CSSProperties = {
    ...controlButtonBaseStyle,
    left: '-72px', 
    cursor: 'pointer',
    // Style spécifique si le menu radial est ouvert
    background: isSelectorOpen ? 'rgba(200, 200, 255, 0.2)' : 'transparent',
    borderRadius: '50%',
  };
  
  // Classes CSS pour le handle
  const handleClasses = "dnd-handle text-gray-400 hover:text-gray-600"; // Simplifié, style dans l'objet

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

  // --- Timer Logic --- 
  const clearCloseTimer = () => {
    if (closeMenuTimerRef.current) {
      clearTimeout(closeMenuTimerRef.current);
      closeMenuTimerRef.current = null;
    }
  };

  const startCloseTimer = () => {
    clearCloseTimer(); 
    closeMenuTimerRef.current = setTimeout(() => {
      setIsSelectorOpen(false);
      logger.debug('[SortableBlockItem] Menu closed by timeout');
    }, 1500); // <<< Changer délai à 1.5 secondes >>>
  };

  // Nettoyer le timer au démontage
  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  // --- Logique de visibilité des contrôles généraux --- 
  const showControls = () => {
    // Ne plus utiliser hideTimeoutRef pour les contrôles généraux
    setIsHovering(true);
  };
  const hideControls = () => {
    // Cacher immédiatement si pas de menu ouvert
    if (!isSelectorOpen) {
        setIsHovering(false);
    }
    // Si le menu est ouvert, le timer gérera la fermeture et le masquage
  };

  // --- Indicateur --- 
  const showIndicator = () => setShowInsertIndicator(true);
  const hideIndicator = () => setShowInsertIndicator(false);
  
  // --- Logique Menu Radial --- 
  const handleToggleSelector = () => {
    const opening = !isSelectorOpen;
    setIsSelectorOpen(opening);
    if (opening) {
      startCloseTimer(); // Démarrer le timer quand on ouvre
    } else {
      clearCloseTimer(); // Annuler si on ferme manuellement
    }
  };

  const handleTypeSelect = (type: string) => {
    logger.debug(`[SortableBlockItem] handleTypeSelect: ${type} for block: ${sortableId}`); 
    onAddAfter({ sortableId, selectedType: type });
    setIsSelectorOpen(false);
    clearCloseTimer(); // Annuler le timer lors de la sélection
  };

  const radius = 65;
  const totalItems = blockTypes.length;
  const startAngle = 115; // Commencer à 135 degrés (3h)
  const totalAngleRange = 340; // Répartir sur 320 degrés (éviter la droite)
  const effectiveAngleStep = totalAngleRange / totalItems; 

  return (
    <div 
      ref={setNodeRef} 
      style={itemStyle} 
      {...attributes} 
      data-dnd-wrapper
      className={`relative group ${block.type === 'thematicBreak' ? 'py-1' : ''}`}
      onMouseEnter={showControls} 
      onMouseLeave={hideControls} // Utiliser hideControls simple
    >
      {/* Bouton (+) positionné absolument */}
      <button
          style={{
              position: 'absolute',
              left: '-72px',
              top: '0.25rem',
              zIndex: 25, 
              opacity: isHovering ? 1 : 0, 
              pointerEvents: isHovering ? 'auto' : 'none',
              cursor: 'pointer',
              padding: '0.25rem', // Padding pour la zone cliquable
          }}
          onClick={handleToggleSelector}
          className={`flex items-center justify-center w-7 h-7 rounded-full 
                     ${isSelectorOpen 
                       ? 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300 ring-2 ring-blue-300' 
                       : 'text-gray-400 hover:text-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'}`
                    }
          title="Ajouter un bloc après"
          onMouseEnter={() => { showIndicator(); clearCloseTimer(); }}
          onMouseLeave={() => { hideIndicator(); startCloseTimer(); }}
        >
          <Plus size={16} />
      </button>

      {/* Boutons Handle et Delete */}
      <button style={deleteButtonStyle} className="text-red-400 hover:text-red-600" onClick={() => onDelete(block.id)} title="Supprimer"> <Trash2 size={16} /> </button>
      <button ref={setActivatorNodeRef} {...listeners} style={handleStyle} className={handleClasses} title="Déplacer"> <GripVertical size={18} /> </button>
      
      {/* === Conteneur du Menu Radial (Positionné absolument, près du bouton +) === */}
      <div 
        className="absolute" // Positionné par rapport au wrapper principal
        style={{ 
            // Positionner ce conteneur LÀ OÙ LE BOUTON + EST
            left: '-72px', 
            top: '0.25rem',
            // Donner une taille au conteneur pour que les enfants absolus aient une référence
            width: '32px', // w-8
            height: '32px', // h-8
            pointerEvents: isSelectorOpen ? 'auto' : 'none', 
            zIndex: 30 
        }}
      >
          {blockTypes.map(({ type, label, Icon }, index) => {
              const angle = startAngle + (effectiveAngleStep * index);
              const itemTransform = isSelectorOpen 
                  ? `translateX(-50%) translateY(-50%) rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)` 
                  : `translateX(-50%) translateY(-50%) scale(0)`;
              
              const itemStyle: React.CSSProperties = {
                position: 'absolute',
                // Positionner le coin sup gauche au centre (50%, 50%) du parent (le div ci-dessus)
                top: '50%', 
                left: '50%',   
                width: '32px', 
                height: '32px', 
                transformOrigin: 'center center', 
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
                  onMouseEnter={clearCloseTimer}
                  onMouseLeave={startCloseTimer}
                >
                  <Icon size={16} />
                </div>
              );
          })}
      </div>

      {/* === Contenu Principal du Bloc === */}
      <div className="pl-4 pr-4 ml-[-72px]" style={{ paddingLeft: 'calc(72px + 1rem)' }}> 
        {contentToRender}
      </div>

      {/* Indicateur d'insertion */}
      <div 
        className={`absolute left-0 right-0 bottom-[-1px] h-[2px] bg-blue-500 
                   transition-opacity duration-150 ease-in-out 
                   ${showInsertIndicator ? 'opacity-100' : 'opacity-0'}`}
        style={{ pointerEvents: 'none' }}
      />

    </div>
  );
};