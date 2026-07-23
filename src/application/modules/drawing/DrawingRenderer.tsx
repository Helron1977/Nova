// src/application/modules/drawing/DrawingRenderer.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { DrawingBlockData } from './types';
import Button from '@/presentation/components/base/Button';
import { PenTool, Square, Check } from 'lucide-react';
import DrawingModule from './drawingModule'; // Import pour defaultRawContent

import { useEditorCommands } from '@/application/context/EditorContext';

const LOCAL_DEFAULT_HEIGHT = 150; // MODIFIÉ

export const DrawingRenderer: React.FC<BlockRendererProps<DrawingBlockData>> = ({
  block,
  customData,
  ...rest
}) => {
  const { activeBlockId, updateBlock, setActiveBlockId } = useEditorCommands();
  const isEditing = activeBlockId === block.id;

  const isNewOrEmptyAtMount = useRef<boolean>(
    !!( 
      (!customData.svgPathCommands || customData.svgPathCommands === DrawingModule.defaultRawContent) &&
      (customData.height === undefined || customData.height === LOCAL_DEFAULT_HEIGHT || 
        (DrawingModule.defaultRawContent && customData.height === JSON.parse(DrawingModule.defaultRawContent).height))
    )
  );

  const [configuringHeight, setConfiguringHeight] = useState<boolean>(isNewOrEmptyAtMount.current);
  const [heightConfigured, setHeightConfigured] = useState<boolean>(!isNewOrEmptyAtMount.current);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false); 
  
  const [drawnSvgCommands, setDrawnSvgCommands] = useState<string>(customData.svgPathCommands || "");
  const [currentDrawingPath, setCurrentDrawingPath] = useState<string>("");
  
  const [currentHeight, setCurrentHeight] = useState<number>(
    customData.height || LOCAL_DEFAULT_HEIGHT // Utiliser la constante locale
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const isCurrentlyDrawingRef = useRef(false); 
  
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const heightResizeStartYRef = useRef<number | null>(null);
  const heightResizeInitialHeightRef = useRef<number | null>(null);

  const serializePathDataToRawSource = useCallback((svgPath: string, heightToSave: number): string => {
    const dataToStore = {
      svgPathCommands: svgPath.trim(),
      width: customData.width || (DrawingModule.defaultRawContent ? JSON.parse(DrawingModule.defaultRawContent).width : 400),
      height: heightToSave, 
    };
    return JSON.stringify(dataToStore);
  }, [customData.width]);

  useEffect(() => {
    if (!isDrawingMode) {
      setDrawnSvgCommands(customData.svgPathCommands || "");
    }
  }, [customData.svgPathCommands, isDrawingMode]);

  useEffect(() => {
    setCurrentHeight(customData.height || LOCAL_DEFAULT_HEIGHT ); // Utiliser la constante locale
  }, [customData.height]);

  useEffect(() => {
    if (isEditing === true && heightConfigured && !configuringHeight && !isDrawingMode) {
      setIsDrawingMode(true);
    } else if (isEditing === false && isDrawingMode) {
      let commandsToSave = drawnSvgCommands;
      if (currentDrawingPath) {
        commandsToSave = (drawnSvgCommands ? drawnSvgCommands.trim() + " " : "") + currentDrawingPath.trim();
        setDrawnSvgCommands(commandsToSave); 
        setCurrentDrawingPath("");
      }
      updateBlock(block.id, block, {
        type: 'UPDATE_SOURCE_FOR_MODULE',
        newRawSource: serializePathDataToRawSource(commandsToSave, currentHeight),
        moduleType: 'drawing'
      });
      setIsDrawingMode(false); 
    }
  }, [isEditing, isDrawingMode, currentDrawingPath, drawnSvgCommands, block.id, updateBlock, block, serializePathDataToRawSource, currentHeight, heightConfigured, configuringHeight]);

  const effectiveWidth = "100%";
  const effectiveHeight = useMemo(() => currentHeight, [currentHeight]);

  const svgViewBoxWidth = useMemo(() => {
    return customData.width || (svgRef.current?.clientWidth || (DrawingModule.defaultRawContent ? JSON.parse(DrawingModule.defaultRawContent).width : 400));
  }, [customData.width, svgRef.current?.clientWidth]);

  const handleConfirmHeight = useCallback(() => {
    const finalHeight = Math.max(50, currentHeight);
    setCurrentHeight(finalHeight);
    setConfiguringHeight(false);
    setHeightConfigured(true);
    setIsDrawingMode(true); 
    setActiveBlockId(block.id);
    updateBlock(block.id, block, {
      type: 'UPDATE_SOURCE_FOR_MODULE',
      newRawSource: serializePathDataToRawSource(drawnSvgCommands, finalHeight),
      moduleType: 'drawing'
    });
  }, [block.id, updateBlock, block, setActiveBlockId, serializePathDataToRawSource, drawnSvgCommands, currentHeight]);

  const toggleDrawingMode = useCallback(() => {
    if (configuringHeight || !heightConfigured) return; 
    const newMode = !isDrawingMode;
    setIsDrawingMode(newMode);
    if (newMode) { 
      setActiveBlockId(block.id);
    } else { 
      let finalCommands = drawnSvgCommands;
      if (currentDrawingPath) { 
        finalCommands = (drawnSvgCommands ? drawnSvgCommands.trim() + " " : "") + currentDrawingPath.trim();
        setDrawnSvgCommands(finalCommands);
        setCurrentDrawingPath("");
      }
      updateBlock(block.id, block, {
        type: 'UPDATE_SOURCE_FOR_MODULE',
        newRawSource: serializePathDataToRawSource(finalCommands, currentHeight),
        moduleType: 'drawing'
      });
      setActiveBlockId(null);
    }
  }, [isDrawingMode, configuringHeight, heightConfigured, currentDrawingPath, drawnSvgCommands, block.id, setActiveBlockId, updateBlock, block, serializePathDataToRawSource, currentHeight]);

  const getMousePosition = (event: React.MouseEvent<SVGSVGElement>): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgPoint = pt.matrixTransform(ctm.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  };

  const handleMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingMode || configuringHeight) return;
    const pos = getMousePosition(event);
    if (!pos) return;
    isCurrentlyDrawingRef.current = true;
    setCurrentDrawingPath(`M${pos.x} ${pos.y}`);
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !isCurrentlyDrawingRef.current || configuringHeight) return;
    const pos = getMousePosition(event);
    if (!pos) return;
    setCurrentDrawingPath(prev => `${prev} L${pos.x} ${pos.y}`);
  };

  const handleMouseUp = () => {
    if (!isDrawingMode || !isCurrentlyDrawingRef.current || configuringHeight) return;
    isCurrentlyDrawingRef.current = false;
    if (currentDrawingPath) {
      const newFullSvg = (drawnSvgCommands ? drawnSvgCommands.trim() + " " : "") + currentDrawingPath.trim();
      setDrawnSvgCommands(newFullSvg);
      updateBlock(block.id, block, {
        type: 'UPDATE_SOURCE_FOR_MODULE',
        newRawSource: serializePathDataToRawSource(newFullSvg, currentHeight),
        moduleType: 'drawing'
      });
    }
    setCurrentDrawingPath("");
  };
  
  const handleGlobalMouseMoveForHeightResize = useCallback((event: MouseEvent) => {
    if (heightResizeStartYRef.current !== null && heightResizeInitialHeightRef.current !== null) {
      const deltaY = event.clientY - heightResizeStartYRef.current;
      const newHeight = heightResizeInitialHeightRef.current + deltaY;
      setCurrentHeight(Math.max(50, newHeight));
    }
  }, []); // isResizingHeight n'est plus une dépendance ici car l'event listener est conditionné par lui

  const handleGlobalMouseUpForHeightResize = useCallback(() => {
      // La désinscription se fait dans le useEffect qui dépend de isResizingHeight
      setIsResizingHeight(false); 
  }, []);

  const handleHeightResizeBarMouseDown = useCallback((event: React.MouseEvent<SVGElement>) => {
    if (!configuringHeight) return; 
    event.preventDefault();
    event.stopPropagation();
    heightResizeStartYRef.current = event.clientY;
    heightResizeInitialHeightRef.current = currentHeight;
    setIsResizingHeight(true); // Déclenche le useEffect pour attacher les listeners
  }, [configuringHeight, currentHeight]);

  useEffect(() => {
    if (isResizingHeight) {
      document.addEventListener('mousemove', handleGlobalMouseMoveForHeightResize);
      document.addEventListener('mouseup', handleGlobalMouseUpForHeightResize);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMoveForHeightResize);
        document.removeEventListener('mouseup', handleGlobalMouseUpForHeightResize);
      };
    }
  }, [isResizingHeight, handleGlobalMouseMoveForHeightResize, handleGlobalMouseUpForHeightResize]);

  const indentationPadding = useMemo(() => {
    const level = (block.metadata as { indentationLevel?: number })?.indentationLevel ?? 0;
    return `${level * 1.5}rem`;
  }, [block.metadata]);

  // Styles du SVG (curseur, fond)
  const svgStyle: React.CSSProperties = {
    border: '1px dashed #ccc',
    touchAction: 'none',
    background: (isDrawingMode && !configuringHeight) ? '#f0f9ff' : 'transparent',
    cursor: (isDrawingMode && !configuringHeight) ? 'crosshair' : (configuringHeight ? 'default' : 'default'),
    overflow: 'visible' // Important pour que foreignObject ne soit pas clippé par défaut
  };

  // Structure de retour conditionnelle pour corriger l'erreur de type
  if (configuringHeight) {
    const buttonHeight = 40;
    const buttonWidth = 230; 
    const buttonYPosition = Math.max(10, effectiveHeight - buttonHeight - 15); // Position au dessus du grip
    const buttonXPosition = (svgViewBoxWidth - buttonWidth) / 2;

    return (
      <div 
        ref={(rest as any).ref} 
        {...rest} 
        style={{ ...rest.style, marginLeft: indentationPadding }} 
        className="nova-drawing-container my-2 w-full group relative flex flex-col items-center"
      >
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 self-start">
          Ajustez la hauteur avec la barre ci-dessous, puis validez.
        </p>
        <svg
          ref={svgRef}
          width={effectiveWidth} 
          height={effectiveHeight} 
          viewBox={`0 0 ${svgViewBoxWidth} ${effectiveHeight}`}
          style={svgStyle}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g 
            className="cursor-ns-resize drawing-resize-grip"
            onMouseDown={handleHeightResizeBarMouseDown}
          >
            <rect 
              x="0" 
              y={effectiveHeight - 10} 
              width={svgViewBoxWidth} 
              height="10" 
              fill="rgba(120,120,120,0.3)" 
              className="hover:fill-blue-500/70 transition-colors"
            />
            {[0, 2, 4].map(offset => (
              <line 
                key={offset}
                x1={svgViewBoxWidth / 2 - 15} 
                y1={effectiveHeight - 7 + offset} 
                x2={svgViewBoxWidth / 2 + 15} 
                y2={effectiveHeight - 7 + offset} 
                stroke="rgba(0,0,0,0.5)" 
                strokeWidth="1"
              />
            ))}
          </g>

          {/* Bouton "Valider" à l'intérieur du SVG avec foreignObject */}
          <foreignObject 
            x={buttonXPosition} 
            y={buttonYPosition} 
            width={buttonWidth} 
            height={buttonHeight}
            style={{ pointerEvents: 'none' }} 
          >
            <div style={{ pointerEvents: 'all' }}> 
              <Button onClick={handleConfirmHeight} variant="default" size="sm" className="w-full">
                <Check size={16} className="mr-1" /> Valider la hauteur et dessiner
              </Button>
            </div>
          </foreignObject>
        </svg>
      </div>
    );
  }

  // Retour pour le mode dessin normal (après configuration)
  return (
    <div 
      ref={(rest as any).ref} 
      {...rest} 
      style={{ ...rest.style, marginLeft: indentationPadding }} 
      className="nova-drawing-container my-2 w-full group relative flex flex-col items-center"
    >
      {!configuringHeight && heightConfigured && (
        <div 
          className={`absolute top-1 right-1 transition-opacity duration-150 z-10 
                      ${(isDrawingMode) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}
                      flex space-x-1`}
        >
          <Button onClick={toggleDrawingMode} variant={isDrawingMode ? "default" : "outline"} size="sm" title={isDrawingMode ? "Arrêter le dessin" : "Activer le dessin"}>
            {isDrawingMode ? <Square size={14} /> : <PenTool size={14} />}
            <span className="ml-1 hidden md:inline">{isDrawingMode ? "Terminer" : "Dessiner"}</span>
          </Button>
        </div>
      )}
      
      <svg
        ref={svgRef}
        width={effectiveWidth} 
        height={effectiveHeight} 
        viewBox={`0 0 ${svgViewBoxWidth} ${effectiveHeight}`}
        style={svgStyle}
        xmlns="http://www.w3.org/2000/svg"
        onMouseDown={isDrawingMode && !configuringHeight ? handleMouseDown : undefined}
        onMouseMove={isDrawingMode && !configuringHeight ? handleMouseMove : undefined}
        onMouseUp={isDrawingMode && !configuringHeight ? handleMouseUp : undefined}
        onMouseLeave={isDrawingMode && !configuringHeight ? handleMouseUp : undefined} 
      >
        {heightConfigured && !configuringHeight && drawnSvgCommands && (
          <path d={drawnSvgCommands} stroke="black" fill="transparent" strokeWidth="2" />
        )}
        {heightConfigured && !configuringHeight && currentDrawingPath && isDrawingMode && (
          <path d={currentDrawingPath} stroke="rgba(0,0,255,0.5)" fill="transparent" strokeWidth="2" strokeDasharray="3,3" />
        )}
        {heightConfigured && !isDrawingMode && !configuringHeight && !drawnSvgCommands && !currentDrawingPath && (
          <text 
            x="10" y="20" 
            fontFamily="Verdana" fontSize="12" fill="grey"
            className="opacity-100 group-hover:opacity-0 transition-opacity duration-150" 
          >
            Cliquez sur "Dessiner" ou survolez pour activer le dessin.
          </text>
        )}
      </svg>
    </div>
  );
}; 

export default DrawingRenderer; 