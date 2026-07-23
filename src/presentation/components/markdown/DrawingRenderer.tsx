import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { DrawingBlockData } from '@/application/modules/drawing/types';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import fitCurve from 'fit-curve';
import { bezierCurvesToSVGPath } from '@/application/modules/drawing/drawingModule';
import Button from '@/presentation/components/base/Button';
import { Undo2, Check, Save, CircleSlash, Settings2, Eraser } from 'lucide-react';

const logger = new PinoLogger();

const DEFAULT_STROKE_COLOR = '#000000';
const DEFAULT_STROKE_WIDTH = 2;
const MIN_HEIGHT_DRAG_SENSITIVITY = 10;
const DEFAULT_DRAWING_WIDTH = 400;
const DEFAULT_DRAWING_HEIGHT = 150;

interface DrawingRendererPropsExtended extends BlockRendererProps<DrawingBlockData> {
  theme?: string;
}

const splitPathIntoSegments = (svgPath: string | undefined): string[] => {
  if (!svgPath || svgPath.trim() === '') return [];
  const normalizedPath = svgPath.trim().startsWith('M') ? svgPath.trim() : 'M ' + svgPath.trim();
  const segments = normalizedPath.split(/(?=M)/g).filter(s => s.trim() !== '');
  return segments.map(s => s.trim());
};

import { useEditorCommands } from '@/application/context/EditorContext';

export const DrawingRenderer: React.FC<DrawingRendererPropsExtended> = (props) => {
  const {
    block,
    customData,
    theme,
  } = props;
  const { updateBlock } = useEditorCommands();

  const svgRef = useRef<SVGSVGElement>(null);
  const [isCurrentlyDrawing, setIsCurrentlyDrawing] = useState(false);
  const currentDrawingPointsRef = useRef<Array<[number, number]>>([]);
  const [liveDrawingPath, setLiveDrawingPath] = useState<string>("");
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  
  const [currentStrokeColor, setCurrentStrokeColor] = useState(customData?.strokeColor || DEFAULT_STROKE_COLOR);
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(customData?.strokeWidth || DEFAULT_STROKE_WIDTH);

  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isErasing, setIsErasing] = useState(false);

  const [drawingWidth, setDrawingWidth] = useState(customData?.width || DEFAULT_DRAWING_WIDTH);
  const [drawingHeight, setDrawingHeight] = useState(customData?.height || DEFAULT_DRAWING_HEIGHT);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [initialMouseY, setInitialMouseY] = useState(0);
  const [initialHeight, setInitialHeight] = useState(0);
  const [isHeightAdjustmentMode, setIsHeightAdjustmentMode] = useState(!customData?.height || customData.height <= 0);
  const [tempHeight, setTempHeight] = useState(customData?.height || DEFAULT_DRAWING_HEIGHT);

  useEffect(() => {
    if (customData?.svgPathCommands) {
      setPathSegments(splitPathIntoSegments(customData.svgPathCommands));
    }
    setDrawingWidth(customData?.width || DEFAULT_DRAWING_WIDTH);
    setCurrentStrokeColor(customData?.strokeColor || DEFAULT_STROKE_COLOR);
    setCurrentStrokeWidth(customData?.strokeWidth || DEFAULT_STROKE_WIDTH);
    
    const initialH = customData?.height || DEFAULT_DRAWING_HEIGHT;
    setDrawingHeight(initialH);
    setTempHeight(initialH);
    setIsHeightAdjustmentMode(!customData?.height || customData.height <= 0);
  }, [customData]);

  useEffect(() => {
    logger.debug(`[DrawingRenderer ${block.id}] pathSegments updated:`, pathSegments);
  }, [pathSegments, block.id]);

  const getSVGCoordinates = useCallback((event: React.MouseEvent<SVGSVGElement>): [number, number] | null => {
    if (svgRef.current) {
      const svgPoint = svgRef.current.createSVGPoint();
      svgPoint.x = event.clientX;
      svgPoint.y = event.clientY;
      const CTM = svgRef.current.getScreenCTM();
      if (CTM) {
        const transformedPoint = svgPoint.matrixTransform(CTM.inverse());
        return [transformedPoint.x, transformedPoint.y];
      }
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    logger.debug(`[DrawingRenderer ${block.id}] SVG handleMouseDown CALLED`);
    if (event.button !== 0 || isResizingHeight || isHeightAdjustmentMode || isEditingSettings) {
        logger.debug(`[DrawingRenderer ${block.id}] SVG handleMouseDown exited early. Button: ${event.button}, Resizing: ${isResizingHeight}, AdjustMode: ${isHeightAdjustmentMode}, EditingSettings: ${isEditingSettings}`);
        return;
    }
    event.preventDefault();
    event.preventDefault();
    setIsCurrentlyDrawing(true);
    
    const coords = getSVGCoordinates(event);
    if (coords) {
      currentDrawingPointsRef.current = [coords];
      setLiveDrawingPath(`M${coords[0].toFixed(2)} ${coords[1].toFixed(2)}`);
    }
  }, [getSVGCoordinates, isResizingHeight, isHeightAdjustmentMode, isEditingSettings, block.id]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!isCurrentlyDrawing || isResizingHeight || isHeightAdjustmentMode || isEditingSettings) return;
    event.preventDefault();
    
    const coords = getSVGCoordinates(event);
    if (coords) {
      currentDrawingPointsRef.current.push(coords);
      setLiveDrawingPath(prev => prev + ` L${coords[0].toFixed(2)} ${coords[1].toFixed(2)}`);
    }
  }, [isCurrentlyDrawing, getSVGCoordinates, isResizingHeight, isHeightAdjustmentMode, isEditingSettings]);

  const handleMouseUp = useCallback(() => {
    logger.debug(`[DrawingRenderer ${block.id}] handleMouseUp triggered`);
    if (!isCurrentlyDrawing || isResizingHeight || isHeightAdjustmentMode) {
      logger.debug(`[DrawingRenderer ${block.id}] handleMouseUp exited early. isCurrentlyDrawing: ${isCurrentlyDrawing}, isResizingHeight: ${isResizingHeight}, isHeightAdjustmentMode: ${isHeightAdjustmentMode}`);
      return;
    }
    setIsCurrentlyDrawing(false);
    setLiveDrawingPath("");

    const pointsToProcess = [...currentDrawingPointsRef.current]; 
    currentDrawingPointsRef.current = [];

    logger.debug(`[DrawingRenderer ${block.id}] MouseUp: pointsToProcess count: ${pointsToProcess.length}`, pointsToProcess);
    if (pointsToProcess.length > 1) { 
      try {
        const errorThreshold = 10; 
        logger.debug(`[DrawingRenderer ${block.id}] Calling fitCurve with ${pointsToProcess.length} points and errorThreshold ${errorThreshold}.`);
        const fittedCurves = fitCurve(pointsToProcess, errorThreshold); 
        logger.debug(`[DrawingRenderer ${block.id}] fitCurve result:`, fittedCurves);
        
        if (fittedCurves && fittedCurves.length > 0) {
          const simplifiedSegmentPath = bezierCurvesToSVGPath([fittedCurves]); 
          logger.debug(`[DrawingRenderer ${block.id}] Simplified segment path: "${simplifiedSegmentPath}"`);
          logger.debug(`[DrawingRenderer ${block.id}] Adding to pathSegments: "${simplifiedSegmentPath}"`);
          setPathSegments(prev => [...prev, simplifiedSegmentPath]);
        } else {
          logger.warn(`[DrawingRenderer ${block.id}] fitCurve returned no curves or empty array. Fallback to raw path for this segment.`);
          let rawPath = `M${pointsToProcess[0][0].toFixed(2)} ${pointsToProcess[0][1].toFixed(2)}`;
          for (let i = 1; i < pointsToProcess.length; i++) {
            rawPath += ` L${pointsToProcess[i][0].toFixed(2)} ${pointsToProcess[i][1].toFixed(2)}`;
          }
          logger.debug(`[DrawingRenderer ${block.id}] Fallback raw segment path: "${rawPath}"`);
          logger.debug(`[DrawingRenderer ${block.id}] Adding to pathSegments (raw): "${rawPath}"`);
          setPathSegments(prev => [...prev, rawPath]);
        }
      } catch (error) {
        logger.error(`[DrawingRenderer ${block.id}] Error during fitCurve or path conversion:`, error);
        let rawPathOnError = `M${pointsToProcess[0][0].toFixed(2)} ${pointsToProcess[0][1].toFixed(2)}`;
          for (let i = 1; i < pointsToProcess.length; i++) {
            rawPathOnError += ` L${pointsToProcess[i][0].toFixed(2)} ${pointsToProcess[i][1].toFixed(2)}`;
          }
        logger.warn(`[DrawingRenderer ${block.id}] Fallback to raw path on error: "${rawPathOnError}"`);
        setPathSegments(prev => [...prev, rawPathOnError]);
      }
    } else if (pointsToProcess.length === 1) {
      const dotPath = `M${pointsToProcess[0][0].toFixed(2)} ${pointsToProcess[0][1].toFixed(2)} L${(pointsToProcess[0][0] + 0.1).toFixed(2)} ${(pointsToProcess[0][1] + 0.1).toFixed(2)}`;
      logger.debug(`[DrawingRenderer ${block.id}] Single point click, creating dot: "${dotPath}"`);
      setPathSegments(prev => [...prev, dotPath]);
    }
  }, [isCurrentlyDrawing, isResizingHeight, isHeightAdjustmentMode, block.id]);

  const handleMouseLeave = useCallback(() => {
    if (isCurrentlyDrawing) {
      handleMouseUp();
    }
  }, [isCurrentlyDrawing, handleMouseUp]);

  const handleSaveDrawing = useCallback(() => {
    const finalPathCommands = pathSegments.join(' ');
    const dataToSave: DrawingBlockData = {
      svgPathCommands: finalPathCommands,
      width: drawingWidth,
      height: drawingHeight,
      strokeColor: currentStrokeColor,
      strokeWidth: currentStrokeWidth,
    };
    logger.debug(`[DrawingRenderer ${block.id}] Calling updateBlock with data:`, dataToSave);
    updateBlock(block.id, block, {
      type: 'UPDATE_SOURCE_FOR_MODULE',
      newRawSource: JSON.stringify(dataToSave),
      moduleType: 'drawing'
    });
    setIsEditingSettings(false);
  }, [updateBlock, block, pathSegments, drawingWidth, drawingHeight, currentStrokeColor, currentStrokeWidth]);

  const handleUndoLastSegment = useCallback(() => {
    setPathSegments(prev => prev.slice(0, -1));
  }, []);

  const handleClearDrawing = () => {
    if (window.confirm("Êtes-vous sûr de vouloir effacer tout le dessin ? Cette action est irréversible.")) {
      setPathSegments([]);
    }
  };

  const handleHeightResizeBarMouseDown = (event: React.MouseEvent<SVGRectElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsResizingHeight(true);
    setInitialMouseY(event.clientY);
    setInitialHeight(drawingHeight);
  };

  const handleGlobalMouseMoveForResize = useCallback((event: MouseEvent) => {
    if (!isResizingHeight) return;
    event.preventDefault();
    const dy = event.clientY - initialMouseY;
    let newHeight = initialHeight + dy;
    if (newHeight < MIN_HEIGHT_DRAG_SENSITIVITY * 2) newHeight = MIN_HEIGHT_DRAG_SENSITIVITY * 2;
    setDrawingHeight(newHeight);
    setTempHeight(newHeight);
  }, [isResizingHeight, initialMouseY, initialHeight]);

  const handleGlobalMouseUpForResize = useCallback(() => {
    if (isResizingHeight) {
      setIsResizingHeight(false);
    }
  }, [isResizingHeight]);

  useEffect(() => {
    if (isResizingHeight) {
      document.addEventListener('mousemove', handleGlobalMouseMoveForResize);
      document.addEventListener('mouseup', handleGlobalMouseUpForResize);
    } else {
      document.removeEventListener('mousemove', handleGlobalMouseMoveForResize);
      document.removeEventListener('mouseup', handleGlobalMouseUpForResize);
    }
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMoveForResize);
      document.removeEventListener('mouseup', handleGlobalMouseUpForResize);
    };
  }, [isResizingHeight, handleGlobalMouseMoveForResize, handleGlobalMouseUpForResize]);

  const handleConfirmHeight = () => {
    setDrawingHeight(tempHeight);
    setIsHeightAdjustmentMode(false);
    const dataToSave: DrawingBlockData = {
      svgPathCommands: pathSegments.join(' '),
      width: drawingWidth,
      height: tempHeight,
      strokeColor: currentStrokeColor,
      strokeWidth: currentStrokeWidth,
    };
    logger.debug(`[DrawingRenderer ${block.id}] Confirming height, calling updateBlock with data:`, dataToSave);
    updateBlock(block.id, block, {
      type: 'UPDATE_SOURCE_FOR_MODULE',
      newRawSource: JSON.stringify(dataToSave),
      moduleType: 'drawing'
    });
  };

  const containerStyle = useMemo(() => ({
    width: drawingWidth,
    position: 'relative' as 'relative',
    userSelect: (isCurrentlyDrawing || isResizingHeight ? 'none' : 'auto') as React.CSSProperties['userSelect'],
  }), [drawingWidth, isCurrentlyDrawing, isResizingHeight]);

  const displayedPath = useMemo(() => {
    return pathSegments.join(' ') + ' ' + liveDrawingPath;
  }, [pathSegments, liveDrawingPath]);

  const strokeStyle = useMemo(() => ({
    stroke: isErasing ? '#FFFFFF' : currentStrokeColor,
    strokeWidth: isErasing ? currentStrokeWidth * 5 : currentStrokeWidth,
    strokeLinecap: 'round' as 'round',
    strokeLinejoin: 'round' as 'round',
    fill: 'none',
  }), [currentStrokeColor, currentStrokeWidth, isErasing]);
  
  const interactionDisabled = isHeightAdjustmentMode || isEditingSettings;

  return (
    <div 
      style={containerStyle} 
      className="nova-drawing-block my-2 group bg-white dark:bg-gray-800 shadow-sm"
      onMouseDownCapture={() => logger.debug(`[DrawingRenderer ${block.id}] Main DIV onMouseDownCapture. Interaction Disabled: ${interactionDisabled}`)}
    >
      <div className="flex items-center justify-between p-2 border-b dark:border-gray-700">
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsEditingSettings(true)} 
            title="Paramètres"
            disabled={isHeightAdjustmentMode}
          >
            <Settings2 size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleUndoLastSegment} title="Annuler dernier trait" disabled={pathSegments.length === 0 || interactionDisabled}>
            <Undo2 size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearDrawing} title="Effacer tout" disabled={pathSegments.length === 0 && liveDrawingPath === "" || interactionDisabled}>
            <CircleSlash size={18} />
          </Button>
           <Button 
            variant={isErasing ? "default" : "ghost"}
            size="sm" 
            onClick={() => setIsErasing(!isErasing)} 
            title="Gomme"
            disabled={interactionDisabled}
          >
            <Eraser size={18} />
          </Button>
        </div>
        <div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSaveDrawing} 
            title="Sauvegarder le dessin"
            disabled={isHeightAdjustmentMode || (isEditingSettings && !isResizingHeight)} 
          >
            <Save size={16} className="mr-1"/>
            Sauvegarder Dessin
          </Button>
        </div>
      </div>

      {isEditingSettings && !isHeightAdjustmentMode && (
        <div className="p-3 bg-gray-50 dark:bg-gray-750 border-b dark:border-gray-700 text-sm">
          <div className="grid grid-cols-2 gap-4 items-center">
            <div>
              <label htmlFor={`stroke-color-${block.id}`} className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Couleur du trait:</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id={`stroke-color-${block.id}`}
                  value={currentStrokeColor}
                  onChange={(e) => setCurrentStrokeColor(e.target.value)}
                  className="w-8 h-8 p-0 border-none rounded cursor-pointer"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">{currentStrokeColor.toUpperCase()}</span>
              </div>
            </div>
            <div>
              <label htmlFor={`stroke-width-${block.id}`} className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Épaisseur: {currentStrokeWidth}px</label>
              <input
                type="range"
                id={`stroke-width-${block.id}`}
                min="1"
                max="20"
                value={currentStrokeWidth}
                onChange={(e) => setCurrentStrokeWidth(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
              />
            </div>
             <div>
              <label htmlFor={`drawing-width-${block.id}`} className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">Largeur: {drawingWidth}px</label>
              <input
                type="range"
                id={`drawing-width-${block.id}`}
                min="100"
                max="1200"
                step="10"
                value={drawingWidth}
                onChange={(e) => setDrawingWidth(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
              />
            </div>
          </div>
          <div className="mt-3 text-right">
            <Button variant="default" size="sm" onClick={() => setIsEditingSettings(false)}>
              <Check size={16} className="mr-1"/> Terminer réglages
            </Button>
          </div>
        </div>
      )}

      {isHeightAdjustmentMode && (
        <div className="p-4 border-y dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/30 text-center">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
            Ajustez la hauteur souhaitée pour votre zone de dessin en utilisant la poignée en bas, puis validez.
          </p>
          <div className="flex items-center justify-center mb-3">
            <label htmlFor={`height-input-${block.id}`} className="mr-2 text-sm font-medium">Hauteur:</label>
            <input 
              type="number" 
              id={`height-input-${block.id}`}
              value={tempHeight} 
              onChange={(e) => setTempHeight(Math.max(MIN_HEIGHT_DRAG_SENSITIVITY * 2, parseInt(e.target.value,10)))}
              className="w-20 p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            />
             <span className="ml-2 text-sm">px</span>
          </div>
          <Button variant="default" size="sm" onClick={handleConfirmHeight}>
            <Check size={16} className="mr-1" />
            Valider la hauteur et dessiner
          </Button>
        </div>
      )}

      <svg
        ref={svgRef}
        width={drawingWidth}
        height={drawingHeight}
        className={`border dark:border-gray-700 rounded-b-md ${interactionDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-crosshair'}`}
        style={{ touchAction: 'none' }}
        onMouseDown={!interactionDisabled ? handleMouseDown : undefined}
        onMouseMove={!interactionDisabled ? handleMouseMove : undefined}
        onMouseUp={!interactionDisabled ? handleMouseUp : undefined}
        onMouseLeave={!interactionDisabled ? handleMouseLeave : undefined}
        onContextMenu={(e) => { if(isCurrentlyDrawing || isResizingHeight) e.preventDefault();}}
      >
        <rect width="100%" height="100%" fill={theme === 'dark' ? '#2d3748' : '#ffffff'} />
        <path d={displayedPath} {...strokeStyle} />
        
        {!isHeightAdjustmentMode && (
          <rect
            x="0"
            y={drawingHeight - MIN_HEIGHT_DRAG_SENSITIVITY}
            width={drawingWidth}
            height={MIN_HEIGHT_DRAG_SENSITIVITY}
            className="fill-gray-300 dark:fill-gray-600 opacity-50 hover:opacity-80 cursor-ns-resize transition-opacity"
            onMouseDown={handleHeightResizeBarMouseDown}
          />
        )}
      </svg>
    </div>
  );
}; 