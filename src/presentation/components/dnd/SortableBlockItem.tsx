import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, ListItemBlock } from '@/application/logic/markdownParser';
import type { MarkerStyle } from '@/application/logic/markdownParser';
import { markdownComponentsConfig } from '@/presentation/config/markdownComponentsConfig';
import { GripVertical, Trash2, Plus, ArrowRightFromLine, CornerDownRight, List, ListOrdered, VenetianMask, ListPlus } from 'lucide-react';
import { Pilcrow, Heading1, Heading2, SquareCode, GitGraph, Image, Quote, Table, Codepen, Minus } from 'lucide-react';

// << AJOUT: Importer le logger >>
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
const logger = new PinoLogger();

interface SortableBlockItemProps {
  block: Block;
  onDelete: (id: string) => void;
  onAddAfter: (data: { sortableId: string; selectedType: string; markerStyle?: MarkerStyle }) => void;
  onUpdateBlockContent: (blockId: string, newText: string) => void;
  onIncreaseIndentation: (blockId: string) => void;
  onDecreaseIndentation: (blockId: string) => void;
  index: number;
  listIndex?: number;
}

// Types standard
const standardBlockTypes = [
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

// Actions spécifiques aux listes
const listItemMenuActions = [
  { type: 'addListItemSibling', label: 'Ajouter élément', Icon: ArrowRightFromLine },
  { type: 'addListItemChild', label: 'Créer une sous liste', Icon: CornerDownRight },
];

// Type unifié pour les actions du menu
type MenuItemAction = {
    type: string;
    label: string;
    Icon: React.ElementType;
};

// << AJOUT: Définition des styles de marqueurs pour le sous-menu >>
const markerStyleOptions: { style: MarkerStyle; label: string; Icon: React.ElementType }[] = [
  { style: 'bullet', label: 'Puce (•)', Icon: List },
  { style: 'decimal', label: 'Numéro (1.)', Icon: ListOrdered },
  { style: 'lower-alpha', label: 'Lettre (a.)', Icon: ListPlus }, // Utiliser ListPlus en attendant mieux
  { style: 'lower-roman', label: 'Romain (i.)', Icon: VenetianMask }, // Utiliser VenetianMask en attendant mieux
];

export const SortableBlockItem: React.FC<SortableBlockItemProps> = ({ 
  block, 
  onDelete, 
  onAddAfter, 
  onUpdateBlockContent, 
  onIncreaseIndentation, 
  onDecreaseIndentation,
  listIndex,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPrimarySelectorOpen, setIsPrimarySelectorOpen] = useState(false);
  const [isMarkerSelectorOpen, setIsMarkerSelectorOpen] = useState(false);
  const [showInsertIndicator, setShowInsertIndicator] = useState(false);
  const [indicatorColor, setIndicatorColor] = useState('blue');
  const closeMenuTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const sortableId = block.id;
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
    position: 'relative',
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
    background: isPrimarySelectorOpen ? 'rgba(200, 200, 255, 0.2)' : 'transparent',
    borderRadius: '50%',
  };
  
  // Classes CSS pour le handle
  const handleClasses = "dnd-handle text-gray-400 hover:text-gray-600"; // Simplifié, style dans l'objet

  // << MODIFIÉ: Déterminer les actions du menu dynamiquement >>
  const primaryMenuActions: MenuItemAction[] = useMemo(() => {
    const isListContext = block.type === 'listItem';
    logger.debug(`[SortableBlockItem ${block.id}] Determining menu actions. Block type: ${block.type}. Is list context: ${isListContext}`);
    
    if (isListContext) {
      const filteredStandard = standardBlockTypes.filter(
        typeInfo => !['heading1', 'heading2', 'thematicBreak'].includes(typeInfo.type)
      );
      const actions = [...filteredStandard, ...listItemMenuActions];
      logger.debug(`[SortableBlockItem ${block.id}] List context menu actions:`, actions.map(a => a.type));
      return actions;
    } else {
      logger.debug(`[SortableBlockItem ${block.id}] Standard menu actions.`);
      return standardBlockTypes;
    }
  }, [block.type]);

  // << SIMPLIFIÉ: Rendu direct du composant de bloc >>
  const BlockComponent = markdownComponentsConfig[block.type as keyof typeof markdownComponentsConfig];
  let contentToRender: React.ReactNode;
  if (BlockComponent) {
      contentToRender = <BlockComponent 
                          block={block} 
                          onUpdateBlockContent={onUpdateBlockContent} 
                          listIndex={listIndex}
                          {...({ 
                              onIncreaseIndentation: onIncreaseIndentation, 
                              onDecreaseIndentation: onDecreaseIndentation 
                          } as any)}
                        />;
  } else {
      contentToRender = (
        <div className="border border-dashed border-red-500 p-2 my-1">
          Type de bloc inconnu: {block.type}
        </div>
      );
  }

  // --- Timer Logic (MODIFIÉ) --- 
  const clearCloseTimer = () => {
    if (closeMenuTimerRef.current) {
      clearTimeout(closeMenuTimerRef.current);
      closeMenuTimerRef.current = null;
    }
  };

  const startCloseTimer = () => {
    clearCloseTimer(); 
    closeMenuTimerRef.current = setTimeout(() => {
      setIsPrimarySelectorOpen(false);
      setIsMarkerSelectorOpen(false);
      setShowInsertIndicator(false); // << CORRIGÉ: Cacher l'indicateur quand le timer expire >>
      logger.debug('[SortableBlockItem] Menus and indicator closed by timeout');
    }, 1500); 
  };
  useEffect(() => { return () => clearCloseTimer(); }, []);

  // --- Logique de visibilité des contrôles généraux --- 
  const showControls = () => {
    // Ne plus utiliser hideTimeoutRef pour les contrôles généraux
    setIsHovering(true);
  };
  const hideControls = () => {
    // Cacher immédiatement si pas de menu ouvert
    if (!isPrimarySelectorOpen && !isMarkerSelectorOpen) {
        setIsHovering(false);
    }
    // Si le menu est ouvert, le timer gérera la fermeture et le masquage
  };

  // --- Indicateur (SIMPLIFIÉ) --- 
  const showIndicator = (color: 'blue' | 'green' = 'blue') => {
    setShowInsertIndicator(true);
    setIndicatorColor(color);
    clearCloseTimer(); // Annuler le timer si on montre (survol actif)
  };
  const hideIndicator = () => {
      // Démarrer/redémarrer le timer de fermeture. Le timer cachera l'indicateur.
      startCloseTimer(); 
  };
  
  // --- Logique Menu Radial --- 
  const handleTogglePrimarySelector = () => {
    const opening = !isPrimarySelectorOpen;
    setIsPrimarySelectorOpen(opening);
    setIsMarkerSelectorOpen(false);
    if (opening) {
        showIndicator('blue'); 
    } else {
        // Fermeture manuelle : cacher immédiatement et annuler timer
        setShowInsertIndicator(false); 
        clearCloseTimer(); 
    }
  };

  // Clic sur une action du menu principal
  const handlePrimaryActionSelect = (type: string) => {
    logger.debug(`[SortableBlockItem] Primary action selected: ${type} for block: ${sortableId}`); 
    
    if (type === 'addListItemChild') {
      setIsMarkerSelectorOpen(true);
      setIsPrimarySelectorOpen(false);
      // Garder l'indicateur visible (sera caché par timer si inactif)
      // showIndicator('green'); // On est déjà en survol, l'indicateur est déjà montré
      startCloseTimer(); // Redémarrer le timer pour le sous-menu
    } else {
      onAddAfter({ sortableId: sortableId, selectedType: type });
      setIsPrimarySelectorOpen(false);
      // Fermeture directe: cacher indicateur et annuler timer
      setShowInsertIndicator(false); 
      clearCloseTimer();
    }
    // << SUPPRIMÉ: setShowInsertIndicator(false); >>
  };
  
  // Clic sur un style de marqueur dans le sous-menu
  const handleMarkerStyleSelect = (markerStyle: MarkerStyle) => {
    logger.debug(`[SortableBlockItem] Marker style selected: ${markerStyle} for adding child to block: ${sortableId}`);
    onAddAfter({
      sortableId: sortableId,
      selectedType: 'addListItemChild',
      markerStyle: markerStyle
    });
    setIsMarkerSelectorOpen(false);
    // Fermeture directe: cacher indicateur et annuler timer
    setShowInsertIndicator(false); 
    clearCloseTimer();
     // << SUPPRIMÉ: setShowInsertIndicator(false); >>
  };
  
  // Handlers pour survol des icônes d'action (inchangés)
  const handleActionIconMouseEnter = (actionType: string) => {
      if (actionType === 'addListItemChild') {
          showIndicator('green');
      } else {
          showIndicator('blue'); // Bleu pour les autres actions (sibling, types standard)
      }
  };
  
  // Utiliser hideIndicator standard pour la sortie (qui redémarre le timer)
  const handleActionIconMouseLeave = () => { hideIndicator(); }; // Appelle startCloseTimer

  // << MODIFIÉ: Calculs basés sur menuActions dynamiques >>
  const primaryRadius = 65;
  const totalPrimaryItems = primaryMenuActions.length;
  const primaryStartAngle = 115; 
  const primaryTotalAngleRange = 340; 
  const primaryEffectiveAngleStep = totalPrimaryItems > 1 ? primaryTotalAngleRange / totalPrimaryItems : 0; 

  // << AJOUT: Calcul du padding pour l'indentation >>
  let contentPaddingLeft = 'calc(72px + 1rem)'; // Padding de base pour laisser place aux contrôles
  if (block.type === 'listItem') {
      const depth = (block as ListItemBlock).metadata.depth || 0;
      // Ajouter 1.5rem par niveau d'indentation (ajustable)
      contentPaddingLeft = `calc(72px + 1rem + ${depth * 1.5}rem)`; 
      logger.debug(`[SortableBlockItem ${block.id}] ListItem detected. Depth: ${depth}. Setting paddingLeft to ${contentPaddingLeft}`);
  }

  // << AJOUT: Calculs pour le sous-menu de marqueurs (position fixe ?) >>
  // On pourrait le faire radial aussi, mais peut-être plus simple linéaire ?
  // Pour l'instant, faisons-le radial aussi, plus petit.
  const markerRadius = 45;
  const totalMarkerItems = markerStyleOptions.length;
  const markerStartAngle = 90; // Commencer en haut
  const markerTotalAngleRange = 180; // Sur un demi-cercle ?
  const markerEffectiveAngleStep = totalMarkerItems > 1 ? markerTotalAngleRange / (totalMarkerItems - 1) : 0;

  return (
    <div 
      ref={setNodeRef} 
      style={itemStyle} 
      {...attributes} 
      data-dnd-wrapper
      className={`relative group ${block.type === 'thematicBreak' ? 'py-1' : ''}`}
      onMouseEnter={showControls} 
      onMouseLeave={hideControls}
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
          onClick={handleTogglePrimarySelector}
          className={`flex items-center justify-center w-7 h-7 rounded-full 
                     ${isPrimarySelectorOpen 
                       ? 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300 ring-2 ring-blue-300' 
                       : 'text-gray-400 hover:text-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'}`
                    }
          title="Ajouter un bloc après"
          onMouseEnter={() => showIndicator('blue')}
          onMouseLeave={hideIndicator}
        >
          <Plus size={16} />
      </button>

      {/* Boutons Handle et Delete */}
      <button style={deleteButtonStyle} className="text-red-400 hover:text-red-600" onClick={() => onDelete(block.id)} title="Supprimer"> <Trash2 size={16} /> </button>
      <button ref={setActivatorNodeRef} {...listeners} style={handleStyle} className={handleClasses} title="Déplacer"> <GripVertical size={18} /> </button>
      
      {/* === Conteneur pour les DEUX Menus Radiaux === */} 
      <div 
        className="absolute" 
        style={{ 
            left: '-72px', top: '0.25rem',
            width: '32px', height: '32px',
            pointerEvents: isPrimarySelectorOpen || isMarkerSelectorOpen ? 'auto' : 'none', // Actif si l'un ou l'autre est ouvert
            zIndex: 30 
        }}
      >
          {/* --- Menu Radial PRINCIPAL --- */} 
          {isPrimarySelectorOpen && primaryMenuActions.map(({ type, label, Icon }, index) => {
              const angle = primaryStartAngle + (primaryEffectiveAngleStep * index);
              const itemTransform = `translateX(-50%) translateY(-50%) rotate(${angle}deg) translateY(-${primaryRadius}px) rotate(-${angle}deg)`;
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
                transitionDelay: isPrimarySelectorOpen ? `${index * 0.05}s` : '0s',
                opacity: isPrimarySelectorOpen ? 1 : 0, 
              };
              
              return (
                <div 
                  key={type}
                  onClick={() => handlePrimaryActionSelect(type)}
                  className="w-8 h-8 flex items-center justify-center rounded-full 
                           bg-slate-100 dark:bg-slate-700 
                           border border-gray-300 dark:border-gray-600 
                           text-gray-600 dark:text-gray-300 
                           hover:bg-slate-200 dark:hover:bg-slate-600 hover:shadow-md 
                           cursor-pointer"
                  style={itemStyle}
                  title={label}
                  onMouseEnter={() => handleActionIconMouseEnter(type)}
                  onMouseLeave={handleActionIconMouseLeave}
                >
                  <Icon size={16} />
                </div>
              );
          })}
          
          {/* --- SOUS-Menu Radial pour MARQUEURS --- */} 
          {isMarkerSelectorOpen && markerStyleOptions.map(({ style, label, Icon }, index) => {
              const angle = markerStartAngle + (markerEffectiveAngleStep * index);
              const itemTransform = `translateX(-50%) translateY(-50%) rotate(${angle}deg) translateY(-${markerRadius}px) rotate(-${angle}deg)`;
              const itemStyle: React.CSSProperties = {
                 position: 'absolute', top: '50%', left: '50%', width: '32px', height: '32px', 
                 transformOrigin: 'center center', transform: itemTransform,
                 transition: `transform 0.2s ease-out, opacity 0.2s ease-out`,
                 opacity: 1, // Toujours visible quand isMarkerSelectorOpen est true
              };
              
              return (
                <div 
                  key={style}
                  onClick={() => handleMarkerStyleSelect(style)}
                  className="w-8 h-8 flex items-center justify-center rounded-full 
                             bg-emerald-100 dark:bg-emerald-800
                             border border-emerald-300 dark:border-emerald-600 
                             text-emerald-700 dark:text-emerald-200 
                             hover:bg-emerald-200 dark:hover:bg-emerald-700 hover:shadow-md 
                             cursor-pointer"
                  style={itemStyle}
                  title={label}
                  onMouseEnter={() => showIndicator('blue')}
                  onMouseLeave={handleActionIconMouseLeave}
                >
                  <Icon size={16} />
                </div>
              );
          })}
      </div>

      {/* === Contenu Principal du Bloc === */}
      <div className="pr-4" style={{ paddingLeft: contentPaddingLeft }}> 
        {contentToRender}
      </div>

      {/* Indicateur d'insertion (MODIFIÉ) */}
      <div 
        className={`absolute left-0 right-0 bottom-[-1px] h-[2px] 
                   ${indicatorColor === 'green' ? 'bg-green-500' : 'bg-blue-500'} 
                   transition-opacity duration-150 ease-in-out 
                   ${showInsertIndicator ? 'opacity-100' : 'opacity-0'}`}
        style={{ pointerEvents: 'none' }}
      />

    </div>
  );
};