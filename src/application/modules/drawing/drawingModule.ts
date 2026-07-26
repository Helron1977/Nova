// src/application/modules/drawing/drawingModule.ts
import type { BlockModule } from '@/application/interfaces/blockModule';
import type { Block, UniversalBlockMetadata } from '@/application/logic/markdownParser';
import type { DrawingBlockData } from './types';
import { DrawingRenderer } from './DrawingRenderer';
import { PenTool } from 'lucide-react';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import fitCurve from 'fit-curve';

const logger = new PinoLogger();

const DRAWING_DEFAULT_WIDTH = 400;
const DRAWING_DEFAULT_HEIGHT = 150;

interface DrawingRawDataContainer {
  svgPathCommands: string;
  width: number;
  height: number;
}

export function parseSVGPathToPolylines(pathCommands: string): Array<Array<[number, number]>> {
  if (!pathCommands || typeof pathCommands !== 'string') {
    logger.debug('[parseSVGPathToPolylines] Input is null, undefined, or not a string. Returning empty array.');
    return [];
  }
  const polylines: Array<Array<[number, number]>> = [];
  let currentPolyline: Array<[number, number]> = [];
  
  const commandRegex = /([ML])\s*((?:-?\d*\.?\d+(?:[eE][+-]?\d+)?\s*,?\s*)+)/gi;
  let match;

  logger.debug(`[parseSVGPathToPolylines] Path to parse (first 200 chars): '${pathCommands.substring(0,200)}...'`);
  
  const hasInitialMatch = commandRegex.test(pathCommands);
  logger.debug(`[parseSVGPathToPolylines] Initial commandRegex.test(pathCommands) result: ${hasInitialMatch}`);
  commandRegex.lastIndex = 0; 

  if (!hasInitialMatch && pathCommands.trim() !== "") {
    logger.warn(`[parseSVGPathToPolylines] No match found by regex in non-empty path. Path: '${pathCommands.substring(0,200)}...'`);
  }

  while ((match = commandRegex.exec(pathCommands)) !== null) {
    const command = match[1].toUpperCase();
    const pointsStr = match[2].trim().split(/[\s,]+/); 
    
    logger.debug(`[parseSVGPathToPolylines] Matched command: '${command}', raw points string: '${match[2].trim().substring(0,50)}...', split pointsStr (first 4): ${JSON.stringify(pointsStr.slice(0,4))}`);

    if (command === 'M') {
      if (currentPolyline.length > 0) {
        logger.debug(`[parseSVGPathToPolylines] New 'M' found, pushing previous polyline. Length: ${currentPolyline.length}`);
        polylines.push(currentPolyline);
      }
      currentPolyline = [];
      for (let i = 0; i < pointsStr.length; i += 2) {
        const xStr = pointsStr[i];
        const yStr = pointsStr[i+1];
        if (xStr && yStr) {
          const x = parseFloat(xStr);
          const y = parseFloat(yStr);
          if (!isNaN(x) && !isNaN(y)) {
            currentPolyline.push([x, y]);
          } else {
            logger.warn(`[parseSVGPathToPolylines] Failed to parse coordinates for 'M': (${xStr}, ${yStr})`);
          }
        }
      }
      logger.debug(`[parseSVGPathToPolylines] 'M' command processed. Current polyline length: ${currentPolyline.length}`);
    } else if (command === 'L') {
      if (currentPolyline.length === 0 && polylines.length === 0) {
          logger.warn('[parseSVGPathToPolylines] \'L\' command found without a preceding \'M\' to start a polyline. This might be an issue.');
      }
      for (let i = 0; i < pointsStr.length; i += 2) {
        const xStr = pointsStr[i];
        const yStr = pointsStr[i+1];
        if (xStr && yStr) {
          const x = parseFloat(xStr);
          const y = parseFloat(yStr);
           if (!isNaN(x) && !isNaN(y)) {
            currentPolyline.push([x, y]);
          } else {
            logger.warn(`[parseSVGPathToPolylines] Failed to parse coordinates for 'L': (${xStr}, ${yStr})`);
          }
        }
      }
      logger.debug(`[parseSVGPathToPolylines] 'L' command processed. Current polyline length: ${currentPolyline.length}`);
    }
  }
  if (currentPolyline.length > 0) {
    logger.debug(`[parseSVGPathToPolylines] Pushing final polyline. Length: ${currentPolyline.length}`);
    polylines.push(currentPolyline);
  }
  
  logger.debug(`[parseSVGPathToPolylines] Finished parsing. Total polylines extracted: ${polylines.length}`);
  if (polylines.length > 0) {
    logger.debug(`[parseSVGPathToPolylines] First extracted polyline (first 3 points): ${JSON.stringify(polylines[0].slice(0,3))}`);
  }
  return polylines;
}

export function bezierCurvesToSVGPath(bezierCurvesArray: Array<Array<Array<[number, number]>>>): string {
  let pathString = '';
  bezierCurvesArray.forEach(polylineBeziers => {
    if (polylineBeziers.length > 0) {
      const firstCurve = polylineBeziers[0];
      pathString += `M${firstCurve[0][0].toFixed(2)} ${firstCurve[0][1].toFixed(2)}`;
      polylineBeziers.forEach(curve => {
        pathString += `C${curve[1][0].toFixed(2)} ${curve[1][1].toFixed(2)},${curve[2][0].toFixed(2)} ${curve[2][1].toFixed(2)},${curve[3][0].toFixed(2)} ${curve[3][1].toFixed(2)}`;
      });
    }
  });
  return pathString;
}

const DrawingModule: BlockModule<DrawingBlockData> = {
  type: 'drawingBlock',
  codeBlockLanguage: 'drawing',
  displayName: 'Dessin à Main Levée',
  menuIcon: PenTool,
  paletteLabel: 'Zone de Dessin',
  paletteKeyword: 'dessin drawing schema pen vector',
  editActionType: 'custom',

  parseContent: (rawContent: string, blockId: string): DrawingBlockData => {
    logger.debug(`[DrawingModule ${blockId}] Parsing rawContent: ${rawContent.substring(0, 100)}...`);
    try {
      const parsedData = JSON.parse(rawContent) as DrawingRawDataContainer;
      if (typeof parsedData.svgPathCommands === 'string' &&
          typeof parsedData.width === 'number' &&
          typeof parsedData.height === 'number') {
        logger.debug(`[DrawingModule ${blockId}] Parsed JSON successfully.`);
        return {
          svgPathCommands: parsedData.svgPathCommands.trim(),
          width: parsedData.width || DRAWING_DEFAULT_WIDTH,
          height: parsedData.height || DRAWING_DEFAULT_HEIGHT,
        };
      }
      logger.warn(`[DrawingModule ${blockId}] Parsed JSON, but structure is invalid. Assuming legacy and attempting direct simplification if it looks like path commands.`);
      if (rawContent.match(/[MLCHVSAQZTmlchvsaqzt]/i) && !rawContent.startsWith('{')) {
        logger.debug(`[DrawingModule ${blockId}] Legacy SVG path detected in rawContent. Attempting simplification.`);
        const polylines = parseSVGPathToPolylines(rawContent);
        logger.debug(`[DrawingModule parseContent - Legacy] Polylines extracted: ${polylines.length}`);
        if (polylines.length > 0) {
            const simplifiedPathCommands = bezierCurvesToSVGPath(
              polylines.map(polyline => {
                logger.debug(`[DrawingModule parseContent - Legacy] Fitting polyline with ${polyline.length} points.`);
                if (polyline.length < 2) return [];
                const curves = fitCurve(polyline, 15); // SEUIL AUGMENTÉ
                logger.debug(`[DrawingModule parseContent - Legacy] Polyline fitted. Received ${curves.length} Bezier curves.`);
                return curves;
              }).filter(curves => curves.length > 0)
            );
            logger.debug(`[DrawingModule parseContent - Legacy] Simplified path for legacy: ${simplifiedPathCommands.substring(0,100)}...`);
            return {
              svgPathCommands: simplifiedPathCommands.trim(),
              width: DRAWING_DEFAULT_WIDTH,
              height: DRAWING_DEFAULT_HEIGHT,
            };
        } else {
            logger.warn(`[DrawingModule parseContent - Legacy] No polylines to simplify from legacy content.`);
            return { svgPathCommands: rawContent.trim(), width: DRAWING_DEFAULT_WIDTH, height: DRAWING_DEFAULT_HEIGHT }; // Retourner l'original si pas de polylignes
        }
      }
      logger.warn(`[DrawingModule ${blockId}] RawContent is not valid JSON nor recognized SVG. Falling back to default empty drawing.`);
      return {
        svgPathCommands: "",
        width: DRAWING_DEFAULT_WIDTH,
        height: DRAWING_DEFAULT_HEIGHT,
      };
    } catch (e) {
      logger.warn(`[DrawingModule ${blockId}] Failed to parse rawContent as JSON. Assuming legacy or corrupted. Error: ${e}`);
      if (rawContent.match(/[MLCHVSAQZTmlchvsaqzt]/i) && !rawContent.startsWith('{')) {
        logger.debug(`[DrawingModule ${blockId}] Legacy SVG path detected after JSON parse fail. Attempting simplification.`);
        const polylines = parseSVGPathToPolylines(rawContent);
        logger.debug(`[DrawingModule parseContent - Legacy Catch] Polylines extracted: ${polylines.length}`);
        if (polylines.length > 0) {
            const simplifiedPathCommands = bezierCurvesToSVGPath(
              polylines.map(polyline => {
                logger.debug(`[DrawingModule parseContent - Legacy Catch] Fitting polyline with ${polyline.length} points.`);
                if (polyline.length < 2) return [];
                const curves = fitCurve(polyline, 15); // SEUIL AUGMENTÉ
                logger.debug(`[DrawingModule parseContent - Legacy Catch] Polyline fitted. Received ${curves.length} Bezier curves.`);
                return curves;
              }).filter(curves => curves.length > 0)
            );
            logger.debug(`[DrawingModule parseContent - Legacy Catch] Simplified path for legacy: ${simplifiedPathCommands.substring(0,100)}...`);
            return {
              svgPathCommands: simplifiedPathCommands.trim(),
              width: DRAWING_DEFAULT_WIDTH,
              height: DRAWING_DEFAULT_HEIGHT,
            };
        } else {
             logger.warn(`[DrawingModule parseContent - Legacy Catch] No polylines to simplify from legacy content.`);
             return { svgPathCommands: rawContent.trim(), width: DRAWING_DEFAULT_WIDTH, height: DRAWING_DEFAULT_HEIGHT };
        }
      }
      logger.warn(`[DrawingModule ${blockId}] RawContent is not valid JSON nor recognized SVG path after JSON parse fail. Falling back to default empty drawing.`);
      return {
        svgPathCommands: "",
        width: DRAWING_DEFAULT_WIDTH,
        height: DRAWING_DEFAULT_HEIGHT,
      };
    }
  },

  RendererComponent: DrawingRenderer,

  defaultRawContent: JSON.stringify({
    svgPathCommands: "",
    width: DRAWING_DEFAULT_WIDTH,
    height: DRAWING_DEFAULT_HEIGHT
  } as DrawingRawDataContainer),

  createDefaultCustomData: (): DrawingBlockData => ({
    svgPathCommands: "",
    width: DRAWING_DEFAULT_WIDTH,
    height: DRAWING_DEFAULT_HEIGHT,
  }),

  serializeContent: (customData: DrawingBlockData): string => {
    const polylines = parseSVGPathToPolylines(customData.svgPathCommands);
    let simplifiedPathCommands = customData.svgPathCommands;
    logger.debug(`[DrawingModule serializeContent] Starting serialization. Original path: ${customData.svgPathCommands.substring(0, 100)}...`);
    logger.debug(`[DrawingModule serializeContent] Extracted ${polylines.length} polylines for fitting.`);

    if (polylines.length > 0) {
        try {
            const fittedCurvesArrays = polylines.map((polyline, index) => {
                logger.debug(`[DrawingModule serializeContent] Polyline #${index + 1} (length ${polyline.length}): ${JSON.stringify(polyline.slice(0,3))}...`);
                if (polyline.length < 2) {
                    logger.warn(`[DrawingModule serializeContent] Polyline #${index + 1} has less than 2 points. Skipping fitCurve.`);
                    return []; 
                }
                const curves = fitCurve(polyline, 15); // SEUIL AUGMENTÉ à 15
                logger.debug(`[DrawingModule serializeContent] Polyline #${index + 1} fitted. Received ${curves.length} Bezier curves: ${JSON.stringify(curves).substring(0,100)}...`);
                return curves;
            });
            
            const validFittedCurves = fittedCurvesArrays.filter(curves => curves.length > 0);

            if (validFittedCurves.reduce((acc, val) => acc + val.length, 0) > 0) {
                 simplifiedPathCommands = bezierCurvesToSVGPath(validFittedCurves);
                 logger.debug(`[DrawingModule serializeContent] Path simplified. Original length: ${customData.svgPathCommands.length}, Simplified length: ${simplifiedPathCommands.length}. New path: ${simplifiedPathCommands.substring(0,100)}...`);
            } else {
                 logger.warn(`[DrawingModule serializeContent] fitCurve returned no curves for any polylines derived from: ${customData.svgPathCommands.substring(0,100)}... Using original.`);
            }
        } catch(error) {
            logger.error(`[DrawingModule serializeContent] Error during fitCurve: ${error}. Path: ${customData.svgPathCommands.substring(0,100)}... Using original.`);
        }
    } else if (customData.svgPathCommands.trim() !== "") {
        logger.debug(`[DrawingModule serializeContent] No polylines parsed from: ${customData.svgPathCommands.substring(0,100)}... Assuming it doesn't need polyline simplification or is already simplified.`);
    }

    const dataToStore: DrawingRawDataContainer = {
      svgPathCommands: simplifiedPathCommands,
      width: customData.width || DRAWING_DEFAULT_WIDTH,
      height: customData.height || DRAWING_DEFAULT_HEIGHT,
    };
    logger.debug(`[DrawingModule serializeContent] Data to store: ${JSON.stringify(dataToStore).substring(0,200)}...`);
    return JSON.stringify(dataToStore);
  },

  serializeToHTML: (customData: DrawingBlockData, blockId: string): string => {
    logger.debug(`[DrawingModule ${blockId}] Serializing to HTML. SVG path commands (first 100): ${customData.svgPathCommands.substring(0, 100)}...`);
    if (!customData || !customData.svgPathCommands) {
      logger.warn(`[DrawingModule ${blockId}] No SVG path commands found in customData for HTML serialization.`);
      return `<div class="drawing-module-export drawing-module-error" data-block-id="${blockId}">Erreur: Données de dessin non disponibles pour l'export.</div>`;
    }

    const svgWidth = customData.width || DRAWING_DEFAULT_WIDTH;
    const svgHeight = customData.height || DRAWING_DEFAULT_HEIGHT;
    const strokeColor = customData.strokeColor || '#000000';
    const strokeWidth = customData.strokeWidth || 2;

    const svgContent = `
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="${svgWidth}" 
        height="${svgHeight}" 
        viewBox="0 0 ${svgWidth} ${svgHeight}" 
        fill="none" 
        stroke="${strokeColor}" 
        stroke-width="${strokeWidth}" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <path d="${customData.svgPathCommands}"></path>
      </svg>
    `;

    logger.debug(`[DrawingModule ${blockId}] Generated SVG for HTML export (first 150 chars): ${svgContent.substring(0,150)}...`);
    return `
      <div 
        class="drawing-module-export" 
        data-block-id="${blockId}" 
        style="width: ${svgWidth}px; height: ${svgHeight}px; overflow: hidden; margin: 1em 0;"
      >
        ${svgContent}
      </div>
    `;
  },

  updateBlockFromSource: (currentBlock: Block, rawSource: string, blockId: string): Block => {
    const newCustomData = DrawingModule.parseContent!(rawSource, blockId);

    const newBlock: Block = {
      id: blockId,
      type: 'drawingBlock',
      content: {
        code: rawSource,
        language: 'drawing',
        customBlockData: newCustomData,
      },
      metadata: {
        ...(currentBlock.metadata as UniversalBlockMetadata),
        customBlockType: DrawingModule.type,
        originalLanguage: DrawingModule.codeBlockLanguage,
      },
      rawMarkdown: `\`\`\`${DrawingModule.codeBlockLanguage || 'drawing'}\n${rawSource}\n\`\`\``,
    };
    return newBlock;
  },

  getAIASTNode: (block: Block): Record<string, any> => {
    const data = (block as any).content?.customBlockData as DrawingBlockData | undefined;
    return {
      type: 'drawingBlock',
      dimensions: {
        width: data?.width || DRAWING_DEFAULT_WIDTH,
        height: data?.height || DRAWING_DEFAULT_HEIGHT,
      },
      contentSummary: "[DRAWING_VECTOR_DATA_OMITTED]",
    };
  },
  getAIPrompt: () => `[drawing] Zone de dessin vectoriel SVG. INTERDIT : ne jamais générer ou modifier son contenu interne. Bloc créé uniquement par l'utilisateur.`.trim(),

  helpDescription: `
Ce bloc vous permet de créer une zone de **dessin à main levée** directement dans le document, sauvegardée sous forme de dessin vectoriel.

### Utilisation
Contrairement aux autres blocs de code, vous n'avez pas besoin d'écrire du texte. Cliquez simplement sur l'icône de crayon (Éditer) dans le menu du bloc pour entrer en mode dessin.
Vous pourrez y tracer vos schémas à l'aide de la souris ou de votre doigt/stylet sur les appareils tactiles.

**Redimensionnement :**
La hauteur du canevas de dessin est ajustable en survolant le bas du bloc et en tirant sur la poignée de redimensionnement.
`
};

export default DrawingModule; 