import { PinoLogger } from '@/infrastructure/logging/PinoLogger'; // Ajuster chemin si nécessaire
import { MERMAID_EDGE_STYLES, nodeShapes } from '@/presentation/config/mermaidConstants';
import mermaid from 'mermaid';

const logger = new PinoLogger();

/**
 * Valide le code Mermaid via l'AST (mermaid.parse).
 * Permet de s'assurer qu'une modification Regex n'a pas cassé le graphe.
 */
export async function validateMermaidCode(code: string): Promise<boolean> {
    try {
        await mermaid.parse(code);
        return true;
    } catch (error) {
        logger.error("[validateMermaidCode] Validation failed! Rolled back changes.", error);
        return false;
    }
}

// === BEGIN LEGACY ADAPTATION: escapeRegExp ===
/**
 * Échappe les caractères spéciaux pour une utilisation dans une RegExp.
 * @param str La chaîne à échapper.
 * @returns La chaîne échappée.
 */
function escapeRegExp(str: string): string {
    // $& signifie la chaîne complète trouvée
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// === END LEGACY ADAPTATION ===

// === BEGIN LEGACY ADAPTATION: nodeShapes ===
// Définition des formes supportées et de leurs caractéristiques
// (Adapté de legacy_code/mermaid-shape-modifier.js)
// const nodeShapes = [...];
// === END LEGACY ADAPTATION ===

// === BEGIN LEGACY ADAPTATION: MERMAID_EDGE_STYLES ===
// (From legacy_code/utils/js/modules/mermaid-interactions.js)
// export const MERMAID_EDGE_STYLES = [...];

// Construction de edgeStylesPattern basée sur la constante importée
const edgeStylesPattern = MERMAID_EDGE_STYLES
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) 
    .sort((a, b) => b.length - a.length) 
    .join('|'); 
// const edgeStyleRegex = new RegExp(`(${edgeStylesPattern})`); // Supprimé car non utilisé
// === END LEGACY ADAPTATION ===

// Définir les types de retour possibles
export type MermaidTargetNode = { type: 'node'; id: string, style?: { fill?: string } }; // Ajouter style optionnel
export type MermaidTargetEdge = { type: 'edge'; source: string; target: string; index?: number };
export type MermaidTargetInfo = (MermaidTargetNode | MermaidTargetEdge) & { rawElement?: Element }; // Ajouter rawElement
export type MermaidTargetResult = MermaidTargetInfo | null;

/**
 * Analyse un élément SVG cible (typiquement event.target d'un clic)
 * pour déterminer s'il correspond à un nœud ou un lien Mermaid identifiable,
 * en priorisant les hitboxes pour les liens.
 * 
 * @param element L'élément DOM cible.
 * @returns Un objet MermaidTargetInfo (avec type, id/source+target, et rawElement) ou null.
 */
export function getMermaidTargetInfo(element: Element | null): MermaidTargetResult {
    if (!element) return null;
    // logger.trace("[getTargetInfo] Analyzing element:", element);

    // --- Priorité 1: Hitbox de Lien --- 
    if (element.classList.contains('edge-interaction-hitbox')) {
        const originalId = element.getAttribute('data-original-id');
        // logger.trace(`[getTargetInfo] Clicked on hitbox. Original ID: "${originalId}"`);
        if (originalId) {
             const edgeMatch = originalId.match(/L[_-]([A-Za-z0-9]+)[_-]([A-Za-z0-9]+)(?:[_-]([0-9]+))*$/);
             if (edgeMatch) {
                 const source = edgeMatch[1];
                 const target = edgeMatch[2];
                 const index = edgeMatch[3] !== undefined ? parseInt(edgeMatch[3], 10) : 0;
                 logger.debug(`[getTargetInfo] Detected EDGE from hitbox.`, { source, target, index, originalId });
                 return { type: 'edge', source, target, index, rawElement: element }; // Retourner info Edge
             } else {
                 logger.warn(`[getTargetInfo] Hitbox ID "${originalId}" parsing failed. Invalid format.`);
             }
        } else {
             logger.warn(`[getTargetInfo] Hitbox ID is missing.`);
        }
        // Si la hitbox est invalide, on ne continue PAS pour éviter un match accidentel
        return null;
    }

    // --- Priorité 2: Nœud (directement ou via ses enfants) --- 
    const nodeElement = element.closest('.node');
    const clusterElement = element.closest('.cluster');
    const targetNodeOrCluster = nodeElement || clusterElement;

    if (targetNodeOrCluster) {
        const rawNodeId = targetNodeOrCluster.id;
        // logger.trace(`[getTargetInfo] Detected NODE/CLUSTER element. Raw ID: "${rawNodeId}"`);
        if (rawNodeId) {
            let sourceId = rawNodeId;
            // Extraire l'ID source en ignorant le préfixe UUID de Mermaid v11
            const flowchartMatch = rawNodeId.match(/flowchart-(.+?)(?:-[0-9]+)?$/);
            const clusterMatch = rawNodeId.match(/cluster-(.+?)(?:-[0-9]+)?$/);
            
            if (flowchartMatch) {
                sourceId = flowchartMatch[1];
            } else if (clusterMatch) {
                sourceId = clusterMatch[1];
            }

            // Essayer de récupérer la couleur calculée
            let fillColor: string | undefined = undefined;
            const shapeElement = targetNodeOrCluster.querySelector('rect, circle, polygon, ellipse, path');
            if (shapeElement) {
                try {
                    fillColor = window.getComputedStyle(shapeElement).fill || undefined;
                } catch (e) { /* Ignore si getComputedStyle échoue */ }
            }
            
            logger.debug(`[getTargetInfo] Detected NODE. Source ID: "${sourceId}", Fill: ${fillColor}`);
            return { 
                type: 'node', 
                id: sourceId, 
                style: fillColor ? { fill: fillColor } : undefined, 
                rawElement: targetNodeOrCluster 
            }; 
        } else {
            logger.warn("[getTargetInfo] Node/Cluster element found but has no ID.");
        }
        // Si on a trouvé un noeud/cluster mais sans ID, on arrête là.
        return null;
    }

    // --- Priorité 3: Liens Visibles (Path ou Label - moins fiable que hitbox) --- 
    const edgePathElement = element.closest('path.flowchart-link');
    const edgeLabelElement = element.closest('.edgeLabel');
    
    let edgeDefiningElement: Element | null = null;
    let edgeId: string | null = null;

    if (edgePathElement) {
        edgeDefiningElement = edgePathElement;
        edgeId = edgePathElement.id;
        // logger.trace(`[getTargetInfo] Trying edge ID from visible path: "${edgeId}"`);
    } else if (edgeLabelElement) {
        // Essayer de trouver le path associé au label
        const pathGroup = edgeLabelElement.closest('.edgePath');
        const associatedPath = pathGroup?.querySelector('path.flowchart-link');
        if (associatedPath) {
            edgeDefiningElement = associatedPath; // Utiliser le path pour l'ID
            edgeId = associatedPath.id;
            // logger.trace(`[getTargetInfo] Trying edge ID from path associated with label: "${edgeId}"`);
        } else {
            logger.warn("[getTargetInfo] Could not find associated path for edge label.");
        }
    }

    if (edgeDefiningElement && edgeId) {
        const edgeMatch = edgeId.match(/L[_-]([A-Za-z0-9]+)[_-]([A-Za-z0-9]+)(?:[_-]([0-9]+))*$/);
        if (edgeMatch) {
            const source = edgeMatch[1];
            const target = edgeMatch[2];
            const index = edgeMatch[3] !== undefined ? parseInt(edgeMatch[3], 10) : 0;
            logger.debug(`[getTargetInfo] Detected EDGE from visible element.`, { source, target, index, edgeId });
            return { type: 'edge', source, target, index, rawElement: edgeDefiningElement };
        } else {
            logger.warn(`[getTargetInfo] Visible edge ID "${edgeId}" parsing failed. Invalid format.`);
        }
    } else if (edgeDefiningElement) {
        logger.warn(`[getTargetInfo] Visible edge ID "${edgeId}" is invalid or missing.`);
    }

    // logger.trace("[getTargetInfo] Click did not match any known Mermaid element type.");
    return null; // Aucun élément pertinent trouvé
}

// --- Mermaid Code Modification Utilities ---

// /**
//  * TODO: Placeholder for future feature.
//  * Finds the start and end character indices of a node definition in Mermaid code.
//  * Example: "A[Square]" or "B(Round)"
//  * @param code The full Mermaid diagram code.
//  * @param nodeId The ID of the node to find.
//  * @returns An object with start and end indices, or null if not found.
//  */
// export function findNodeDefinitionPosition(code: string, nodeId: string): { start: number, end: number } | null {
//     logger.debug(`[findNodeDefinitionPosition] Searching for node ID: ${nodeId}`);
//     // Needs implementation using regex or string searching
//     return null;
// }

// /**
//  * TODO: Placeholder for future feature.
//  * Finds the start and end character indices of an edge definition in Mermaid code.
//  * Example: "A --> B" or "C ---|Link Text| D"
//  * @param code The full Mermaid diagram code.
//  * @param sourceId The ID of the source node.
//  * @param targetId The ID of the target node.
//  * @returns An object with start and end indices, or null if not found.
//  */
// export function findEdgeDefinitionPosition(code: string, sourceId: string, targetId: string): { start: number, end: number } | null {
//     logger.debug(`[findEdgeDefinitionPosition] Searching for edge: ${sourceId} -> ${targetId}`);
//     // Needs implementation using regex or string searching
//     return null;
// }

/**
 * Applies a style (like color) to a node or edge in the Mermaid code.
 * Uses the legacy strategy: updates or adds a `style nodeId fill:#...` directive.
 * (Direct adaptation of legacy_code `applyNodeFillStyle`)
 * @param code The full Mermaid diagram code.
 * @param targetInfo Information about the target node or edge.
 * @param styleKey Currently only supports 'fill'.
 * @param styleValue The style value (e.g., '#ff0000', 'red'). Must be a valid hex color for 'fill'.
 * @returns The modified Mermaid code string, or the original code if no change was made or an error occurred.
 */
export async function applyMermaidStyle(code: string, targetInfo: MermaidTargetInfo, styleKey: string, styleValue: string): Promise<string> {
    // Actuellement, on ne gère que le 'fill' pour les 'node' comme dans le legacy
    if (!targetInfo || targetInfo.type !== 'node' || styleKey !== 'fill') {
        logger.warn(`[applyMermaidStyle] Unsupported target/styleKey. Only type:node and styleKey:fill supported.`, { targetInfo, styleKey });
        return code; // Retourne le code original
    }

    const nodeId = targetInfo.id;
    const newFillColorHex = styleValue;

    logger.debug(`[applyMermaidStyle] Applying style {${styleKey}: ${newFillColorHex}} to node: ${nodeId}`);

    // Validation simple du format Hex (du code legacy)
    if (!/^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(newFillColorHex)) {
        logger.error("[applyMermaidStyle] Invalid Hex color format:", newFillColorHex);
        return code; 
    }

    const lines = code.split('\n');
    let styleLineFound = false;
    const escapedNodeId = escapeRegExp(nodeId);
    
    // Regex pour trouver une ligne de style existante pour ce nœud
    // Capture groupe 1: prefix (`style nodeId `), groupe 2: attributes
    const styleLineRegex = new RegExp(`^(\\s*style\\s+\\b${escapedNodeId}\\b\\s*)(.*)`);
    // Regex pour trouver la propriété `fill:` dans les attributs
    // Capture groupe 1: `fill:`, groupe 2: valeur, groupe 3: séparateur (,|;)
    const fillRegex = /(\bfill:)([^,;\s]+)(\s*[,;]?)/;

    const newLines = lines.map((line) => {
        // Ignorer commentaires et lignes vides
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('%%') || trimmedLine === '') return line;

        const match = line.match(styleLineRegex); // Utiliser line, pas trimmedLine pour garder l'indentation
        if (match) {
            styleLineFound = true;
            const prefix = match[1];    // ex: "    style B "
            let attributes = match[2];  // ex: "stroke:#333,stroke-width:2px"
            let fillFound = false;

            // Essayer de remplacer `fill:` existant
            const updatedAttributes = attributes.replace(fillRegex, (_fullMatch, fillPrefix, _oldValue, separator) => {
                fillFound = true;
                logger.debug(`[applyMermaidStyle] Replacing existing fill for ${nodeId} with ${newFillColorHex}`);
                return `${fillPrefix}${newFillColorHex}${separator || ''}`; 
            });

            if (fillFound) {
                return prefix + updatedAttributes; // Retourne la ligne modifiée
            } else {
                // Ajouter `fill:` s'il n'existe pas sur CETTE ligne `style`
                logger.debug(`[applyMermaidStyle] Adding fill:${newFillColorHex} to existing style line for ${nodeId}`);
                // Ajouter une virgule si nécessaire
                let separator = (attributes.trim().length > 0 && !attributes.trim().endsWith(',') && !attributes.trim().endsWith(';')) ? ',' : ' '; 
                // Note: Le trim() ici peut enlever l'indentation des attributs si elle existait, 
                // mais la logique legacy faisait aussi un trim().
                const newAttributes = `${attributes.trim()}${separator}fill:${newFillColorHex}`;
                return prefix + newAttributes; // Recombine avec le préfixe qui contient l'indentation
            }
        }
        return line; // Retourne la ligne inchangée
    });

    // Si AUCUNE ligne `style` pour ce `nodeId` n'a été trouvée dans tout le fichier
    if (!styleLineFound) {
        logger.debug(`[applyMermaidStyle] No existing style line found for ${nodeId}. Adding new style line.`);
        // Ajouter une nouvelle ligne `style nodeId fill:#...`
        // Essayer de l'insérer avant la fin du bloc Mermaid ou avant les commentaires/vides de fin
        let insertIndex = newLines.length;
        const graphEndRegex = /^\s*(?:```|%%|$)/; // Fin de bloc, commentaire ou ligne vide
        for (let i = newLines.length - 1; i >= 0; i--) {
            if (!graphEndRegex.test(newLines[i].trim())) { 
                insertIndex = i + 1;
                break;
            }
        }
        // S'assurer d'une indentation raisonnable (ex: 4 espaces)
        const newStyleLine = `    style ${nodeId} fill:${newFillColorHex}`;
        newLines.splice(insertIndex, 0, newStyleLine);
        logger.debug(`[applyMermaidStyle] New style line added at index ${insertIndex}`);
    }

    const newCodeResult = newLines.join('\n');
    if (newCodeResult !== code) {
        const isValid = await validateMermaidCode(newCodeResult);
        if (!isValid) return code; // Rollback
    }

    return newCodeResult; // Retourne le code complet (modifié et validé)
}

/**
 * Changes the shape of a node in the Mermaid code using the direct legacy strategy,
 * considering the FIRST occurrence of the node ID as its definition point.
 * (Direct adaptation of legacy_code application logic as described by user)
 * @param code The full Mermaid diagram code.
 * @param nodeId The ID of the node to change.
 * @param newShapeBrackets The brackets defining the target shape (e.g., "()", "[]", "{}").
 * @returns The modified Mermaid code string, or the original code if no change was made or an error occurred.
 */
export async function changeMermaidNodeShape(code: string, nodeId: string, newShapeBrackets: string): Promise<string> {
    logger.debug(`[changeMermaidNodeShape] Changing shape of node ${nodeId} to ${newShapeBrackets}`);

    let newCodeResult = code;
    let explicitFound = false;

    // Utilisation de nodeShapes importé
    const targetShapeInfo = [...nodeShapes].find(s => s.brackets === newShapeBrackets);
    if (!targetShapeInfo) {
        logger.error(`[changeMermaidNodeShape] Target shape unknown: ${newShapeBrackets}`);
        return code; 
    }
    const halfLengthTarget = Math.ceil(targetShapeInfo.brackets.length / 2);
    const newOpenBracket = targetShapeInfo.brackets.slice(0, halfLengthTarget);
    const newCloseBracket = targetShapeInfo.brackets.slice(halfLengthTarget);

    const escapedNodeId = escapeRegExp(nodeId);

    // 1. Chercher une définition explicite existante N'IMPORTE OÙ dans le code
    // L'ordre de `nodeShapes` est critique (les formes complexes comme '(())' sont testées avant '()')
    for (const currentShape of [...nodeShapes]) {
        if (!currentShape.parseInfo) continue;

        const currentOpenEscaped = escapeRegExp(currentShape.parseInfo.start);
        const currentCloseEscaped = escapeRegExp(currentShape.parseInfo.end);
        
        // On cherche: <début de ligne ou espace> <nodeId> <espace éventuel> <crochet ouvrant> <contenu capturé> <crochet fermant>
        // Le drapeau 'g' n'est pas utilisé car on suppose une seule définition explicite, mais on utilise replace pour gérer les groupes facilement.
        const explicitRegex = new RegExp(
            `(\\b${escapedNodeId}\\b\\s*)${currentOpenEscaped}(.*?)${currentCloseEscaped}`,
            's'
        );

        const match = code.match(explicitRegex);
        if (match) {
            explicitFound = true;
            logger.debug(`[changeMermaidNodeShape] Explicit shape matched: ${currentShape.brackets}`);
            
            // Effectuer le remplacement
            newCodeResult = code.replace(explicitRegex, (_fullMatch, prefix, content) => {
                return `${prefix}${newOpenBracket}${content}${newCloseBracket}`;
            });

            logger.debug(`[changeMermaidNodeShape] Node '${nodeId}' shape changed successfully (explicit definition replaced).`);
            break; // On a trouvé la définition explicite, on arrête TOUJOURS de chercher
        }
    }

    // 2. Si aucune définition explicite n'a été trouvée (c'est-à-dire que le nœud est implicite, ex: A --> B)
    if (!explicitFound) {
        logger.debug(`[changeMermaidNodeShape] No explicit shape found. Treating as implicit definition.`);
        const nodeIdRegex = new RegExp(`\\b${escapedNodeId}\\b`);
        const matchNodeId = code.match(nodeIdRegex);
        
        if (matchNodeId && matchNodeId.index !== undefined) {
             const implicitLabel = nodeId;
             const newDefinition = `${nodeId}${newOpenBracket}${implicitLabel}${newCloseBracket}`;
             
             // On remplace juste la première occurrence (implicite) par une définition explicite
             newCodeResult = code.substring(0, matchNodeId.index) + newDefinition + code.substring(matchNodeId.index + nodeId.length);
             logger.debug(`[changeMermaidNodeShape] Implicit node '${nodeId}' changed successfully.`);
        } else {
             logger.warn(`[changeMermaidNodeShape] Node ID '${nodeId}' not found at all in the code.`);
        }
    }

    if (newCodeResult !== code) {
        const isValid = await validateMermaidCode(newCodeResult);
        if (!isValid) return code;
    }

    return newCodeResult; 
}

/**
 * Sets a specific edge style (e.g., solid, dotted, thick, with/without arrow)
 * between two nodes, preserving any existing link text.
 * Replaces the old `cycleMermaidEdgeStyle` function.
 * @param code The full Mermaid diagram code.
 * @param sourceId The source node ID of the edge.
 * @param targetId The target node ID of the edge.
 * @param newStyle The desired Mermaid edge style string (e.g., '-->', '-.-').
 * @returns The modified Mermaid code string, or the original code if no change was made.
 */
export async function setEdgeStyle(code: string, sourceId: string, targetId: string, newStyle: string, edgeIndex: number = 0): Promise<string> {
    logger.debug(`[setEdgeStyle] Setting style to "${newStyle}" for edge ${sourceId} -> ${targetId} (index: ${edgeIndex})`);

    const lines = code.split('\n');
    let foundLineIndex = -1;
    let matchCount = 0;
    const escapedSourceId = escapeRegExp(sourceId);
    const escapedTargetId = escapeRegExp(targetId);
    
    // Expression régulière plus flexible pour capter le lien entre les deux identifiants
    const edgeWithTextPattern = `(?:--|\\-\\.|==)[^;&|\\n]*?(?:-->|---|\\.\\->|\\.\\-|==>|===)`;
    const combinedEdgePattern = `(?:${edgeWithTextPattern}|${edgeStylesPattern})`;

    const lineRegex = new RegExp(
        `^(\\s*)(\\b${escapedSourceId}\\b)(\\s*)(${combinedEdgePattern})(\\s*(?:\\|([^|]*)\\|)?\\s*)(\\b${escapedTargetId}\\b)(.*)$`
    );

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(lineRegex);

        if (match) {
            if (matchCount === edgeIndex) {
                foundLineIndex = i;
                const indent = match[1] || '';
                const spaceAfterSource = match[3] || '';
                const oldEdgeStr = match[4];
                const spaceBeforeTarget = match[5]?.replace(/\|([^|]*)\|/, '') || ' '; // On garde les espaces mais on enlève l'ancien pipe si présent
                const pipeText = match[6];
                const restOfLine = match[8] || '';

                logger.debug(`[setEdgeStyle] Found link on line ${foundLineIndex}: "${line.trim()}"`);
                logger.debug(`[setEdgeStyle]   Old Edge: "${oldEdgeStr}"`);

                // Extraire le texte du lien existant
                let linkText = '';
                
                // Format 1: A -->|texte| B
                if (pipeText !== undefined) {
                    linkText = pipeText.trim();
                } else {
                    // Format 2: A -- texte --> B
                    const inlineMatch = oldEdgeStr.match(/^(?:--|-\.|==)\s*(.*?)\s*(?:-->|---|\\\.->|\\.-|==>|===)$/);
                    if (inlineMatch && inlineMatch[1]) {
                        linkText = inlineMatch[1].trim();
                    }
                }

                // Utilisation de MERMAID_EDGE_STYLES importé
                if (![...MERMAID_EDGE_STYLES].includes(newStyle)) {
                    logger.warn(`[setEdgeStyle] Provided new style "${newStyle}" is not in the predefined list. Applying anyway.`);
                }

                // Construire le nouveau lien avec formatage standard Mermaid
                let newLinkStr = newStyle;
                if (linkText) {
                     switch (newStyle) {
                         case '-->': newLinkStr = `-- ${linkText} -->`; break;
                         case '---': newLinkStr = `-- ${linkText} ---`; break;
                         case '-.->': newLinkStr = `-. ${linkText} .->`; break;
                         case '-.-': newLinkStr = `-. ${linkText} .-`; break;
                         case '==>': newLinkStr = `== ${linkText} ==>`; break;
                         case '===': newLinkStr = `== ${linkText} ===`; break;
                         default: newLinkStr = `${newStyle}|${linkText}|`; // Fallback
                     }
                }

                const newLineText = `${indent}${sourceId}${spaceAfterSource}${newLinkStr}${spaceBeforeTarget}${targetId}${restOfLine}`;
                
                logger.debug(`[setEdgeStyle] Original line ${foundLineIndex}: "${lines[foundLineIndex]}"`);
                logger.debug(`[setEdgeStyle] New line      ${foundLineIndex}: "${newLineText}"`);

                lines[foundLineIndex] = newLineText;
                const newCodeResult = lines.join('\n');
                
                if (newCodeResult !== code) {
                    const isValid = await validateMermaidCode(newCodeResult);
                    if (!isValid) return code;
                }
                return newCodeResult;
            }
            matchCount++;
        }
    }

    logger.warn(`[setEdgeStyle] Line containing the link ${sourceId} -> ${targetId} with a known style not found.`);
    return code; 
}

