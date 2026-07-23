import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import mermaid from 'mermaid';
import type { MermaidBlock } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import {
  getMermaidTargetInfo,
  MermaidTargetInfo,
  applyMermaidStyle,
  changeMermaidNodeShape,
  setEdgeStyle
} from '@/presentation/utils/mermaidUtils';
import { v4 as uuidv4 } from 'uuid';
import MermaidContextMenu from '../menus/MermaidContextMenu';
import {
  MERMAID_HIGHLIGHT_COLOR,
  MERMAID_HIGHLIGHT_WIDTH,
  MERMAID_HITBOX_WIDTH
} from '@/presentation/config/mermaidConstants';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { mermaid as mermaidLang } from 'codemirror-lang-mermaid';
import {
  history,
  historyKeymap,
  insertNewline
} from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { EditorView as CMEditorView } from '@codemirror/view';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEditorCommands } from '@/application/context/EditorContext';

// Instancier le logger
const logger = new PinoLogger();

// CHANGER LE NOM DE L'INTERFACE (correspond au nom de fichier)
interface CustomMermaidRendererProps {
  block: MermaidBlock;
  style?: React.CSSProperties;
  listIndex?: number;
  index?: number;
  attributes?: Record<string, any>;
}

// CHANGER LE NOM DU COMPOSANT (correspond au nom de fichier)
const CustomMermaidRenderer = React.forwardRef<
  HTMLDivElement,
  CustomMermaidRendererProps // Utiliser la nouvelle interface
>(
    ({
    block,
    style,
    listIndex,
    index,
    ...rest
  },
    ref) => {
    const { activeBlockId, setActiveBlockId, updateBlock } = useEditorCommands();
    const isEditing = activeBlockId === block.id;

    const { id, content, metadata } = block;
    const { code } = content;
    const indentationLevel = metadata?.indentationLevel;
    const mermaidRef = useRef<HTMLDivElement>(null);
    const currentCodeRef = useRef(code);

    // --- États --- //
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetInfo: MermaidTargetInfo, initialColor?: string } | null>(null);
    const [editedCode, setEditedCode] = useState<string>('');
    const editorViewRef = useRef<EditorView | null>(null);
    const [nodeIdToFocus, setNodeIdToFocus] = useState<string | null>(null);
    // NOUVEAU: Références et état unifié pour le zoom et pan
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [viewState, setViewState] = useState({ zoom: 1, x: 0, y: 0 });

    // État pour le panning manuel
    const [isPanning, setIsPanning] = useState(false);
    const lastPanPos = useRef<{ x: number, y: number } | null>(null);
    const wasPanningRef = useRef(false);

    // --- Effet pour le Zoom centré (Ctrl + Molette) --- //
    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault(); // Empêche le défilement de la page

          const rect = wrapper.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          setViewState(prev => {
            const delta = e.deltaY * -0.002;
            let newZoom = prev.zoom + delta;

            newZoom = Math.min(Math.max(0.2, newZoom), 8); // Zoom entre 0.2x et 8x

            // Zone morte autour de 1
            if (Math.abs(newZoom - 1) < 0.05 && prev.zoom !== 1) {
              return { zoom: 1, x: 0, y: 0 };
            }
            if (newZoom === prev.zoom) return prev;

            const scaleRatio = newZoom / prev.zoom;

            return {
              zoom: newZoom,
              x: mouseX - (mouseX - prev.x) * scaleRatio,
              y: mouseY - (mouseY - prev.y) * scaleRatio
            };
          });
        }
      };

      wrapper.addEventListener('wheel', handleWheel, { passive: false });
      return () => wrapper.removeEventListener('wheel', handleWheel);
    }, []);

    // --- Gestionnaires pour le Panning (Ctrl + Clic / Drag) ---
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (e.ctrlKey || e.metaKey || e.button === 1 /* Clic molette */) {
        e.preventDefault();
        setIsPanning(true);
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        if (wrapperRef.current) wrapperRef.current.setPointerCapture(e.pointerId);
      }
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (isPanning && lastPanPos.current) {
        const dx = e.clientX - lastPanPos.current.x;
        const dy = e.clientY - lastPanPos.current.y;
        setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        lastPanPos.current = { x: e.clientX, y: e.clientY };
      }
    }, [isPanning]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (isPanning) {
        setIsPanning(false);
        lastPanPos.current = null;
        wasPanningRef.current = true;
        setTimeout(() => wasPanningRef.current = false, 100);
        if (wrapperRef.current) wrapperRef.current.releasePointerCapture(e.pointerId);
      }
    }, [isPanning]);

    const indentationPadding = useMemo(() => {
      const level = indentationLevel ?? 0;
      return level > 0 ? `${level * 1.5}rem` : '0rem';
    }, [indentationLevel]);

    const combinedStyle = useMemo(() => ({
      ...style,
      marginLeft: indentationPadding
    }), [style, indentationPadding]);

    // Fonction pour fermer le menu
    const handleCloseContextMenu = useCallback(() => {
      setContextMenu(null);
    }, []);

    // Fonction utilitaire : trouver la hitbox sous le curseur en utilisant les API géométriques SVG
    // Contourne les bugs de hit-testing des navigateurs avec transform: matrix() et pointer-events: stroke
    const findHitboxBySVGPoint = useCallback((clientX: number, clientY: number): Element | null => {
        const container = mermaidRef.current;
        if (!container) return null;
        const svg = container.querySelector('svg');
        if (!svg) return null;

        let pt: DOMPoint;
        let ctm: DOMMatrix | null;
        try {
            pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            ctm = svg.getScreenCTM();
        } catch (e) {
            return null; // Fallback sécurisé si l'API n'est pas dispo
        }
        
        if (!ctm) return null;
        const svgPt = pt.matrixTransform(ctm.inverse());

        const hitboxes = container.querySelectorAll('.edge-interaction-hitbox');
        for (let i = 0; i < hitboxes.length; i++) {
            const hb = hitboxes[i] as SVGGeometryElement;
            if (hb.isPointInStroke && hb.isPointInStroke(svgPt)) {
                return hb;
            }
        }
        return null;
    }, []);

    // Gestionnaire pour le clic droit sur le diagramme
    const handleContextMenu = useCallback((event: MouseEvent) => {
      // --- AJOUT : Ne pas montrer le menu contextuel SVG en mode édition ---
      if (isEditing) {
          event.preventDefault(); // Empêcher le menu natif
          return; // Sortir tôt si on est en train d'éditer le code
      }
      // --- FIN AJOUT ---
      
      event.preventDefault();
      
      let targetInfo = getMermaidTargetInfo(event.target as Element);
      logger.debug(`[CustomMermaidRenderer ${id}] Context menu triggered. Target info:`, targetInfo);

      // Fallback SVG Point: si hit-testing navigateur échoue (ex: à cause du zoom CSS matrix)
      if (!targetInfo) {
          const preciseHitbox = findHitboxBySVGPoint(event.clientX, event.clientY);
          if (preciseHitbox) {
              targetInfo = getMermaidTargetInfo(preciseHitbox);
              logger.debug(`[CustomMermaidRenderer ${id}] SVG geometry fallback found edge hitbox.`, targetInfo);
          }
      }

      if (targetInfo) {
        let initialColor: string | undefined = undefined;
        let targetElement: Element | null = event.target as Element;

        // Si fallback utilisé, la cible d'origine n'était pas la hitbox. On force targetElement à être la hitbox trouvée.
        if (!targetElement.classList.contains('edge-interaction-hitbox') && targetInfo.type === 'edge' && targetInfo.rawElement) {
             targetElement = targetInfo.rawElement;
        }

        // Si c'est une hitbox, trouver l'élément original via data-original-id
        if (targetElement.classList.contains('edge-interaction-hitbox')) {
          const originalId = targetElement.getAttribute('data-original-id');
          if (originalId) {
            targetElement = mermaidRef.current?.querySelector(`#${originalId}`) || null;
            logger.debug(`[CustomMermaidRenderer ${id}] Hitbox clicked/found, original element ID: ${originalId}`, targetElement);
          }
        }
        
        // Essayer de récupérer la couleur actuelle si c'est un noeud
        if (targetInfo.type === 'node' && targetElement) {
          const nodeOrClusterElement = targetElement.closest('.node, .cluster');
          if (nodeOrClusterElement) {
            const shapeElement = nodeOrClusterElement.querySelector('rect, circle, polygon, ellipse, path');
            if (shapeElement) {
              const style = window.getComputedStyle(shapeElement);
              initialColor = style.fill;
              logger.debug(`[CustomMermaidRenderer ${id}] Found initial color for node ${targetInfo.id}: ${initialColor}`);
            }
          }
        }
        setContextMenu({ x: event.clientX, y: event.clientY, targetInfo, initialColor });
      } else {
        setContextMenu(null); // Fermer si clic hors cible valide
      }
    }, [isEditing, id, findHitboxBySVGPoint]);

    // --- Gestion des Actions du Menu Contextuel ---
    const handleMenuAction = useCallback(async (action: string, targetInfo: MermaidTargetInfo, value?: string) => {
      logger.debug(`[CustomMermaidRenderer ${id}] Menu Action received: ${action}`, { targetInfo, value });
      setContextMenu(null);

      // Utiliser currentCodeRef pour avoir le code le plus récent au moment de l'action
      const currentCode = currentCodeRef.current;
      if (!currentCode) {
        logger.error(`[CustomMermaidRenderer ${id}] Cannot perform action, current code is null or empty.`);
        return;
      }
      let newCode: string | null = null;

      // Appeler les fonctions de modification
      switch (action) {
        case 'changeColor':
          if (targetInfo.type === 'node' && typeof value === 'string') {
            // On assume que 'value' est une couleur hex valide venant du picker
            newCode = await applyMermaidStyle(currentCode, targetInfo, 'fill', value);
            logger.debug(`Called applyMermaidStyle for color ${value}`);
          } else {
            logger.warn(`[CustomMermaidRenderer ${id}] Action 'changeColor' invalid: target type=${targetInfo.type}, value=${value}`);
          }
          break;
        case 'changeShape':
          if (targetInfo.type === 'node' && typeof value === 'string') {
            // On assume que 'value' sont les brackets de la forme (ex: "[]", "()")
            newCode = await changeMermaidNodeShape(currentCode, targetInfo.id, value);
            logger.debug(`Called changeMermaidNodeShape for shape ${value}`);
          } else {
            logger.warn(`[CustomMermaidRenderer ${id}] Action 'changeShape' invalid: target type=${targetInfo.type}, value=${value}`);
          }
          break;
        case 'setEdgeStyle':
          if (targetInfo.type === 'edge' && typeof value === 'string') {
            // On assume que 'value' est le style de ligne (ex: "-->", "-.-")
            newCode = await setEdgeStyle(currentCode, targetInfo.source, targetInfo.target, value, targetInfo.index);
            logger.debug(`Called setEdgeStyle with style: ${value} at index: ${targetInfo.index}`);
          } else {
            logger.warn(`[CustomMermaidRenderer ${id}] Action 'setEdgeStyle' invalid: target type=${targetInfo.type}, value=${value}`);
          }
          break;
        default:
          logger.warn(`[CustomMermaidRenderer ${id}] Action inconnue reçue du menu: ${action}`);
          return;
      }

      // Vérifier si le code a réellement changé et appeler updateBlock
      if (newCode !== null && newCode !== currentCode) {
        logger.debug(`[CustomMermaidRenderer ${id}] Code changed. Calling updateBlock with new PURE code.`);
        updateBlock(id, block, {
          type: 'UPDATE_SOURCE_FOR_MODULE',
          newRawSource: newCode,
          moduleType: 'mermaid'
        });
        currentCodeRef.current = newCode;
      } else if (newCode === currentCode) {
        logger.debug(`[CustomMermaidRenderer ${id}] Modification function returned the same code. No update needed.`);
      } else if (newCode === null) {
        logger.warn(`[CustomMermaidRenderer ${id}] Modification function returned null (likely an error or invalid input). No update.`);
      }
    }, [id, updateBlock, block]);

    const setupInteractionLayer = useCallback((svgElement: SVGSVGElement, addedListeners: { element: Element, type: string, listener: EventListenerOrEventListenerObject }[]) => {
      const links = svgElement.querySelectorAll('path.flowchart-link');
      logger.debug(`[CustomMermaidRenderer ${id}] Setting up interaction layer: ${links.length} links found.`);
      svgElement.querySelectorAll('.edge-interaction-hitbox').forEach(hb => hb.remove());

      links.forEach(linkPath => {
        const originalId = linkPath.id;
        if (!originalId) return;
        const hitbox = linkPath.cloneNode(true) as SVGPathElement;
        hitbox.classList.add('edge-interaction-hitbox');
        hitbox.removeAttribute('id');
        hitbox.setAttribute('data-original-id', originalId);
        hitbox.style.stroke = 'rgba(0,0,0,0)';
        hitbox.style.strokeWidth = MERMAID_HITBOX_WIDTH; // <- Utiliser constante
        hitbox.style.fill = 'none';
        hitbox.style.cursor = 'pointer';
        hitbox.style.pointerEvents = 'stroke';
        linkPath.parentNode?.insertBefore(hitbox, linkPath.nextSibling);

        let originalStroke: string | null = null, originalStrokeWidth: string | null = null;
        const mouseOverListener = () => {
          const visibleLink = svgElement.querySelector(`#${originalId}`) as SVGPathElement | null;
          if (visibleLink) {
            if (visibleLink.style.stroke !== MERMAID_HIGHLIGHT_COLOR) { // <- Utiliser constante
              originalStroke = visibleLink.style.stroke || window.getComputedStyle(visibleLink).stroke;
              originalStrokeWidth = visibleLink.style.strokeWidth || window.getComputedStyle(visibleLink).strokeWidth;
            }
            visibleLink.style.stroke = MERMAID_HIGHLIGHT_COLOR; // <- Utiliser constante
            visibleLink.style.strokeWidth = MERMAID_HIGHLIGHT_WIDTH; // <- Utiliser constante
          }
        };
        const mouseOutListener = () => {
          const visibleLink = svgElement.querySelector(`#${originalId}`) as SVGPathElement | null;
          if (visibleLink) {
            if (originalStroke !== null) visibleLink.style.stroke = originalStroke;
            if (originalStrokeWidth !== null) visibleLink.style.strokeWidth = originalStrokeWidth;
            originalStroke = null;
            originalStrokeWidth = null;
          }
        };
        hitbox.addEventListener('mouseover', mouseOverListener);
        hitbox.addEventListener('mouseout', mouseOutListener);
        addedListeners.push({ element: hitbox, type: 'mouseover', listener: mouseOverListener });
        addedListeners.push({ element: hitbox, type: 'mouseout', listener: mouseOutListener });
      });
    }, [id]);

    // Effet pour le rendu Mermaid, l'ajout des hitboxes et la surbrillance (Logique simplifiée)
    useEffect(() => {
      // Utiliser directement la prop `code`
      const currentCode = (typeof code === 'string' && code.trim() !== '') ? code.trim() : null;
      const containerElement = mermaidRef.current; // La ref du conteneur

      logger.debug(`[CustomMermaidRenderer ${id}] Render effect triggered. Code: ${currentCode ? 'valid' : 'invalid'}, Ref: ${containerElement ? 'exists' : 'null'}`);

      // --- Variables pour le nettoyage --- (Déplacées à l'intérieur de l'effet)
      const addedListeners: { element: Element, type: string, listener: EventListenerOrEventListenerObject }[] = [];
      let attachedContextMenuListenerElement: HTMLElement | null = null;

      // --- Fonction de nettoyage principale --- (Définie à l'intérieur pour capturer les variables locales)
      const cleanupAll = () => {
        // Nettoyer les listeners de surbrillance/hitbox
        addedListeners.forEach(({ element, type, listener }) => {
          element.removeEventListener(type, listener);
        });
        addedListeners.length = 0;
        // Nettoyer le listener contextuel
        if (attachedContextMenuListenerElement) {
          attachedContextMenuListenerElement.removeEventListener('contextmenu', handleContextMenu as EventListener);
          attachedContextMenuListenerElement = null;
          logger.debug(`[CustomMermaidRenderer ${id}] Cleaned up contextmenu listener.`);
        }
      };

      // --- Logique de rendu simplifiée ---

      // Si le code est valide et que le conteneur existe, on tente le rendu
      if (currentCode && containerElement) {
        logger.debug(`[CustomMermaidRenderer ${id}] Proceeding with render logic...`);

        // --- IMPORTANT: Nettoyer TOUT avant de commencer ---
        cleanupAll();

        // Vider le conteneur explicitement avant de rendre
        containerElement.innerHTML = '';

        (async () => {
          try {
            const mermaidId = `mermaid-svg-${uuidv4()}`;
            logger.debug(`[CustomMermaidRenderer ${id}] Calling mermaid.render with id: ${mermaidId}`);
            const { svg, bindFunctions } = await mermaid.render(mermaidId, currentCode);

            // Vérifier si le conteneur existe TOUJOURS après l'await
            if (!mermaidRef.current) {
              logger.warn(`[CustomMermaidRenderer ${id}] Ref disappeared after mermaid.render. Aborting SVG insertion.`);
              return;
            }
            const currentContainerElement = mermaidRef.current; // Référence stable

            logger.debug(`[CustomMermaidRenderer ${id}] mermaid.render SUCCESS. Inserting SVG.`);
            currentContainerElement.innerHTML = svg;

            // Mettre en place la couche d'interaction (hitboxes, surbrillance) via rAF
            requestAnimationFrame(() => {
              if (!currentContainerElement) return; // Vérif sécurité
              const svgElement = currentContainerElement.querySelector('svg');
              if (svgElement) {
                // Passer addedListeners pour les collecter DANS setupInteractionLayer
                setupInteractionLayer(svgElement, addedListeners);
              } else {
                logger.warn(`[CustomMermaidRenderer ${id}] SVG element not found within container after rAF.`);
              }
            });

            // Appeler bindFunctions (interactions internes Mermaid)
            if (bindFunctions) {
              logger.debug(`[CustomMermaidRenderer ${id}] Calling bindFunctions (if any).`);
              bindFunctions(currentContainerElement);
            }

            // Attacher notre écouteur contextmenu au conteneur principal
            logger.debug(`[CustomMermaidRenderer ${id}] Attaching contextmenu listener to:`, currentContainerElement);
            currentContainerElement.addEventListener('contextmenu', handleContextMenu as EventListener);
            // Sauvegarder la référence pour nettoyage DANS LA VARIABLE LOCALE
            attachedContextMenuListenerElement = currentContainerElement;

          } catch (error: any) { // Gérer les erreurs de rendu
            logger.error(`[CustomMermaidRenderer ${id}] Error during mermaid.render/setup:`, error);
            if (mermaidRef.current) {
              mermaidRef.current.innerHTML = `<pre class="text-red-500 dark:text-red-400">Erreur Mermaid: ${error.message || 'Unknown error'}\\n--- Code ---\\n${currentCode}</pre>`;
            }
            // S'assurer que tout est nettoyé même en cas d'erreur
            cleanupAll();
          }
        })(); // Fin async IIFE

      } else if (!currentCode && containerElement) { // Si le code devient vide mais conteneur existe
        logger.debug(`[CustomMermaidRenderer ${id}] Code is now empty. Clearing container and cleaning listeners.`);
        cleanupAll(); // Nettoyer les listeners
        containerElement.innerHTML = ''; // Vider le conteneur
      } else {
        // Cas où le code est vide ET le conteneur n'existe pas encore, ou autre cas non géré.
        logger.debug(`[CustomMermaidRenderer ${id}] No render needed (Code empty or container missing).`);
      }

      // Retourner la fonction de nettoyage principale pour React
      return cleanupAll;

      // Dépendances: l'effet doit se relancer si l'une d'elles change.
    }, [id, code, handleContextMenu, setupInteractionLayer]); // Garder les dépendances correctes

    // Effet pour gérer la fermeture du menu au clic extérieur
    useEffect(() => {
      // Si le menu n'est pas ouvert, ne rien faire
      if (!contextMenu) return;

      // Fonction pour gérer les clics sur la fenêtre
      const handleClickOutside = () => {
        // Idéalement, on vérifierait si le clic est DANS le menu avant de fermer
        // Mais pour l'instant, tout clic en dehors du diagramme ferme le menu
        handleCloseContextMenu();
      };

      // Ajouter l'écouteur quand le menu s'ouvre
      window.addEventListener('click', handleClickOutside);
      // Optionnel: fermer aussi sur un autre clic droit en dehors ?
      // window.addEventListener('contextmenu', handleClickOutside);

      // Nettoyer l'écouteur quand le menu se ferme ou que le composant est démonté
      return () => {
        window.removeEventListener('click', handleClickOutside);
        // window.removeEventListener('contextmenu', handleClickOutside);
      };
    }, [contextMenu, handleCloseContextMenu]); // Dépend de l'état du menu

    // --- AJOUT : Effet pour mettre à jour currentCodeRef quand la prop 'code' change ---
    useEffect(() => {
      // Met à jour la ref interne si le code externe change
      if (code !== currentCodeRef.current) {
        logger.debug(`[CustomMermaidRenderer ${id}] Prop 'code' changed. Updating currentCodeRef.`);
        currentCodeRef.current = code;
        // On pourrait forcer un re-rendu ici si nécessaire, mais l'effet principal devrait s'en charger
        // en comparant renderedCodeRef.current avec le nouveau currentCodeRef.current.
      }
    }, [code, id]);
    // --- FIN AJOUT ---

    const combinedRef = (node: HTMLDivElement | null) => {
      (mermaidRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    // --- Callbacks Édition Source --- //
    const handleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
      // Si on est déjà en mode édition, ne rien faire
      if (isEditing) return;
      if (event.ctrlKey || event.metaKey || wasPanningRef.current) return; // Ne pas ouvrir si on fait/vient de faire un drag/pan

      logger.debug(`[CustomMermaidRenderer ${id}] Click detected. Entering source edit mode.`);

      // Essayer de déterminer si le clic était sur un nœud pour le focus initial
      const targetInfo = getMermaidTargetInfo(event.target as Element);
      let nodeIdToFocusInitially: string | null = null;
      if (targetInfo?.type === 'node') {
        logger.debug(`[CustomMermaidRenderer ${id}] Click target was node: ${targetInfo.id}. Will attempt to focus.`);
        nodeIdToFocusInitially = targetInfo.id;
      } else {
        logger.debug(`[CustomMermaidRenderer ${id}] Click target was not a node (or undetermined). Editor will open without specific focus.`);
      }

      // Passer en mode édition
      setEditedCode(code); // Initialiser l'éditeur avec le code actuel
      setNodeIdToFocus(nodeIdToFocusInitially); // Définir l'ID cible pour l'effet de focus (peut être null)
      setActiveBlockId(id);
      setContextMenu(null); // Fermer le menu contextuel s'il était ouvert
    }, [id, code, isEditing, setActiveBlockId]); // Garder les dépendances

    useEffect(() => {
      if (metadata?.isNewBlock && !isEditing) {
        setActiveBlockId(id);
        const updatedMetadata = { ...metadata };
        delete updatedMetadata.isNewBlock;
        updateBlock(id, block, { type: 'UPDATE_METADATA', metadata: updatedMetadata });
      }
    }, [metadata?.isNewisEditing, setActiveBlockId, updateBlock, id, block]);

    const handleSaveSource = useCallback(() => {
      logger.debug(`[CustomMermaidRenderer ${id}] Saving source code.`);
      if (editedCode !== code) {
        updateBlock(id, block, {
          type: 'UPDATE_SOURCE_FOR_MODULE',
          newRawSource: editedCode,
          moduleType: 'mermaid'
        });
      }
      setActiveBlockId(null);
    }, [id, code, editedCode, updateBlock, block, setActiveBlockId]);

    const handleSourceCancel = useCallback(() => {
      logger.debug(`[CustomMermaidRenderer ${id}] Cancelling source edit.`);
      setActiveBlockId(null);
      setEditedCode('');
      setNodeIdToFocus(null); // Reset focus target on cancel
    }, [id, setActiveBlockId]);

    const handleCreateEditor = useCallback((view: EditorView) => {
      editorViewRef.current = view;
      // Le focus initial général est géré par autoFocus
      // La logique de focus spécifique est dans le useEffect ci-dessous
    }, []);

    // --- Effet pour Gérer le Focus Spécifique sur un Nœud --- //
    useEffect(() => {
      // Exécuter seulement si on est en mode édition ET qu'on a un ID de nœud cible
      // ET que la vue de l'éditeur est disponible
      if (isEditing && nodeIdToFocus && editorViewRef.current) {
        const view = editorViewRef.current;
        logger.debug(`[CustomMermaidRenderer ${id}] Attempting to focus node ID: ${nodeIdToFocus} in editor.`);

        // Recherche simple de la première occurrence de l'ID
        const position = editedCode.indexOf(nodeIdToFocus);

        if (position > -1) {
          logger.debug(`[CustomMermaidRenderer ${id}] Found node ID at position: ${position}. Setting selection and scrolling.`);
          try {
            view.dispatch({
              selection: { anchor: position }, // Placer le curseur au début de l'ID
              effects: CMEditorView.scrollIntoView(position, { y: "center" }) // Utiliser la classe importée
            });
          } catch (e) {
            logger.error(`[CustomMermaidRenderer ${id}] Error dispatching focus/scroll actions:`, e);
          }
        } else {
          logger.warn(`[CustomMermaidRenderer ${id}] Node ID '${nodeIdToFocus}' not found in the source code.`);
          // Si non trouvé, on met quand même le focus général pour être sûr
          view.focus();
        }

        // Réinitialiser l'ID cible pour ne pas re-focuser à chaque rendu
        setNodeIdToFocus(null);
      }
    }, [isEditing, nodeIdToFocus, editedCode]); // Dépend de l'état d'édition, de l'ID cible, et du code édité

    // --- Extensions CodeMirror --- //
    const editorExtensions = useMemo(() => [
      history(),
      mermaidLang(),
      keymap.of([
        ...historyKeymap,
        { key: "Mod-Enter", run: () => { handleSaveSource(); return true; } },
        { key: "Escape", run: () => { handleSourceCancel(); return true; } },
        { key: "Enter", run: insertNewline }
      ]),
      EditorView.lineWrapping,
      EditorView.theme({ /* ... */ }),
    ], [handleSaveSource, handleSourceCancel]);

    const getDiagramType = (codeStr: string | null) => {
      if (!codeStr) return 'Mermaid';
      const firstWord = codeStr.trim().split(/[\s\n]+/)[0];
      return firstWord || 'Mermaid';
    };

    const diagramType = getDiagramType(code);

    return (
      // Utiliser un div parent pour gérer le clic et le style
      <div
        style={combinedStyle}
        ref={wrapperRef}
        className={`relative custom-mermaid-wrapper group block w-full overflow-hidden rounded-md ${isPanning ? 'cursor-grabbing' : ''}`}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        title={!isEditing ? "Cliquer pour éditer le code source" : undefined}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Badge type et aide (visible au survol) - Déplacé dans le wrapper parent */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 pointer-events-none z-10">
          <span className="bg-gray-800/80 text-white text-[10px] font-medium px-2 py-1 rounded shadow-sm backdrop-blur-sm">
            {diagramType}
          </span>
          <span className="bg-blue-600/80 text-white text-[10px] font-medium px-2 py-1 rounded shadow-sm backdrop-blur-sm">
            🖱️ Double-clic : Modifier | Ctrl + Molette : Zoomer
          </span>
        </div>

        {isEditing ? (
          // Mode Édition Source
          <div 
            className="w-full my-2" 
            style={{ marginLeft: indentationPadding }}
            onBlur={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              handleSaveSource();
            }}
          >
            <CodeMirror
              value={editedCode}
              extensions={editorExtensions}
              onChange={setEditedCode}
              onCreateEditor={handleCreateEditor}
              basicSetup={false}
              autoFocus={true} // Garder l'autofocus général
            />
          </div>
        ) : (
          // --- Mode Affichage : Diagramme + Menu Contextuel ---
          <>

            <div
              key={`${id}-container`}
              data-block-id={id}
              ref={combinedRef}
              // combinedStyle est maintenant sur le div parent
              {...rest}
              className="custom-mermaid-container mermaid-container p-2 border border-dashed border-transparent hover:border-gray-300 dark:hover:border-gray-600 relative flex justify-center w-full"
              style={{
                transform: `matrix(${viewState.zoom}, 0, 0, ${viewState.zoom}, ${viewState.x}, ${viewState.y})`,
                transformOrigin: 'top left',
                transition: viewState.zoom === 1 && viewState.x === 0 && viewState.y === 0 ? 'transform 0.2s ease-out' : 'none'
              }}
              title="Double-cliquer pour éditer le code | Clic-droit sur une forme pour la modifier"
            >
              {/* Le contenu SVG est injecté ici par useEffect */}
              {/* Ajout d'un placeholder si le code est vide ou lors du chargement initial */}
              {(code === null || code.trim() === '') && !mermaidRef.current?.innerHTML && (
                <div className="text-gray-400 italic p-4 text-center w-full">Diagramme Mermaid vide ou en cours de rendu...</div>
              )}
            </div>

            {contextMenu && (
              <MermaidContextMenu
                key={`${id}-menu`}
                x={contextMenu.x}
                y={contextMenu.y}
                targetInfo={contextMenu.targetInfo}
                onClose={handleCloseContextMenu}
                onAction={handleMenuAction}
              />
            )}
          </>
        )}
      </div>
    );
  }
);

// CHANGER LE DISPLAYNAME (correspond au nom de fichier)
CustomMermaidRenderer.displayName = 'CustomMermaidRenderer';

// CHANGER L'EXPORT (correspond au nom de fichier)
export default CustomMermaidRenderer; 