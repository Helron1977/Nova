import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFloating, shift, limitShift, offset, autoUpdate } from '@floating-ui/react-dom';
// Correction: Élargir le type Icon à React.ElementType
// import type { LucideIcon } from 'lucide-react'; 

// Type pour une action dans le menu
export type ActionMenuItem = {
    key: string; // ID unique pour l'action (ex: 'paragraph', 'heading1', 'bullet')
    label: string; // Texte affiché dans le title/tooltip
    // Correction: Utiliser React.ElementType pour plus de flexibilité
    Icon: React.ElementType; // Composant Icône à afficher
    // Ajouter d'autres propriétés si nécessaire (ex: isDisabled)
};

// Type pour l'offset
type FloatingOffset = number | {
    mainAxis?: number;
    crossAxis?: number;
    alignmentAxis?: number | null;
};

interface VerticalActionMenuProps {
    isOpen: boolean;
    actions: ActionMenuItem[];
    anchorElement: HTMLElement | null;
    onActionSelect: (actionKey: string) => void;
    onClose: () => void;
    offsetValue?: FloatingOffset;
}

const VerticalActionMenu: React.FC<VerticalActionMenuProps> = ({
    isOpen,
    actions,
    anchorElement,
    onActionSelect,
    onClose,
    offsetValue = { mainAxis: 85, crossAxis: 5 },
}) => {
    const closeMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    // --- Floating UI Hook ---
    const { refs, floatingStyles, update } = useFloating({
        elements: {
            reference: anchorElement,
        },
        placement: 'right-start',
        open: isOpen,
        middleware: [
            offset(offsetValue),
            shift({
                limiter: limitShift(),
                padding: 5,
            })
        ],
        whileElementsMounted: autoUpdate,
    });

    // Log pour déboguer (adapter pour utiliser anchorElement)
    useEffect(() => {
        if (isOpen && anchorElement) {
            console.log('[VerticalActionMenu] Anchor Element:', anchorElement);
            update(); 
            setTimeout(() => {
                 console.log('[VerticalActionMenu] Calculated Floating Styles:', floatingStyles);
            }, 0)
        }
    }, [isOpen, anchorElement, update, floatingStyles]);

    // --- Timer Logic ---
    const clearCloseTimer = useCallback(() => {
        if (closeMenuTimerRef.current) {
            clearTimeout(closeMenuTimerRef.current);
            closeMenuTimerRef.current = null;
        }
    }, []);

    const startCloseTimer = useCallback(() => {
        clearCloseTimer();
        closeMenuTimerRef.current = setTimeout(() => {
            onClose();
        }, 1500); // Délai de fermeture
    }, [clearCloseTimer, onClose]);

    // Nettoyer le timer au démontage
    useEffect(() => {
        return () => clearCloseTimer();
    }, [clearCloseTimer]);

    // --- Event Handlers ---
    const handleItemClick = (actionKey: string) => {
        onActionSelect(actionKey);
        onClose(); 
    };

    // MODIFIÉ: Gestion de la fermeture en cliquant à l'extérieur
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Ne pas fermer si on clique sur l'élément d'ancrage lui-même
            if (anchorElement?.contains(target)) {
                return;
            }

            // Fermer si on clique en dehors du menu flottant
            if (refs.floating.current && !refs.floating.current.contains(target)) {
                console.log('[VerticalActionMenu] Clicked outside, closing.');
                onClose();
            }
        };

        // Utiliser setTimeout pour ajouter l'écouteur après le cycle de rendu courant
        // afin d'éviter que le clic d'ouverture ne déclenche immédiatement la fermeture.
        const timerId = setTimeout(() => {
             document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, refs.floating, anchorElement]);

    useEffect(() => {
        // S'assurer que le composant est monté côté client avant d'utiliser le portail
        setIsMounted(true);
    }, []);

    if (!isOpen || !isMounted) { // Ne pas rendre si fermé OU pas encore monté côté client
        return null;
    }

    // Correction: Utiliser createPortal pour rendre le menu dans document.body
    return createPortal(
        <div
            ref={refs.setFloating}
            style={{
                ...floatingStyles,
                msOverflowStyle: 'none',  
                scrollbarWidth: 'none',  
            }}
            className={`absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-1 z-50 scrollbar-hide`}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={startCloseTimer}
        >
            <div className="flex flex-col items-center space-y-1">
                {actions.map((action, index) => {
                    const baseClasses = "w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full border transition-all duration-150 ease-in-out";
                    const interactiveClasses = "opacity-60 hover:opacity-100 cursor-pointer";
                    const colorClasses = "bg-slate-100 dark:bg-slate-700 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300";
                    const finalClassName = `${baseClasses} ${interactiveClasses} ${colorClasses}`;

                    return (
                        <div
                            key={action.key}
                            onClick={() => handleItemClick(action.key)}
                            title={action.label}
                            className={finalClassName}
                        >
                            <action.Icon size={16} />
                        </div>
                    );
                })}
            </div>
        </div>,
        document.body // Cible du portail
    );
};

export default VerticalActionMenu;

// Helper pour hideScrollbar si non défini globalement
// Vous pouvez mettre ceci dans src/presentation/styles/utils.ts ou similaire
// export const hideScrollbar = css\`
//   &::-webkit-scrollbar {
//     display: none;
//   }
//   -ms-overflow-style: none;  /* IE and Edge */
//   scrollbar-width: none;  /* Firefox */
// \`;
// Ou une classe Tailwind si vous avez un plugin comme tailwind-scrollbar-hide
// Installer: npm install -D tailwind-scrollbar-hide
// Ajouter dans tailwind.config.js: plugins: [require('tailwind-scrollbar-hide')]
// Utiliser: className="scrollbar-hide ..."
// Ici, on suppose qu'une solution (CSS-in-JS ou plugin Tailwind) existe pour cacher la scrollbar.
// Si aucune solution n'est dispo, la scrollbar restera visible mais fonctionnelle.
// Le style inline avec 'css' est juste un placeholder pour l'idée, cela ne fonctionnera pas directement sans lib CSS-in-JS.
// Alternative simple: Mettre le style direct dans le 'style' prop:
// style={{ ...floatingStyles, maxHeight: \`${maxHeight}px\`, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
// Note: ::-webkit-scrollbar ne peut pas être stylé en inline.

// Correction: Supprimer la balise invalide ajoutée précédemment
// </rewritten_file> 