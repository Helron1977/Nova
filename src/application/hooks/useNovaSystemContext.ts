import { useCallback, useRef } from 'react';
import { buildAST, serializeASTToLLMContext, generateLLMSystemInstructions, getOmittedBlockIds } from '../logic/astGenerator';
import { generateNovaMutationProtocolInstructions } from '../logic/novaProtocolParser';
import { calculateAstDiff, formatDiffAsXML } from '../logic/astDiff';
import type { Block } from '../logic/markdownParser';

const DIFF_THRESHOLD = 8;

export function useNovaSystemContext(
  blocks: Block[],
  selectedBlockIds: string[]
) {
  const lastSyncedBlocks = useRef<Block[]>([]);
  const hasSyncedOnce = useRef<boolean>(false);
  const lastOmittedBlockIds = useRef<string[]>([]);

  const getSystemContext = useCallback(() => {
    const protocol = generateNovaMutationProtocolInstructions();
    const systemInstructions = generateLLMSystemInstructions();

    // Contexte de la sélection actuelle
    const targetBlockId = selectedBlockIds.length > 0
      ? selectedBlockIds[selectedBlockIds.length - 1]
      : (blocks.length > 0
          ? blocks[blocks.length - 1].id
          : 'end');

    let documentContext = '';

    if (!hasSyncedOnce.current) {
      // Premier appel : AST complet
      const ast = buildAST(blocks);
      documentContext = serializeASTToLLMContext(ast);
      hasSyncedOnce.current = true;
      lastOmittedBlockIds.current = getOmittedBlockIds(ast);
    } else {
      // Appels suivants : calcul du diff
      const diff = calculateAstDiff(lastSyncedBlocks.current, blocks);
      if (diff.totalChanges === 0) {
        documentContext = '<diff status="unchanged">Le document est inchangé depuis le dernier échange.</diff>';
      } else if (diff.totalChanges <= DIFF_THRESHOLD) {
        documentContext = formatDiffAsXML(diff);
        // Si un bloc est modifié, il est inclus en entier dans le diff, donc il n'est plus "omitted"
        const touchedIds = new Set([...diff.added, ...diff.modified].map(b => b.id));
        lastOmittedBlockIds.current = lastOmittedBlockIds.current.filter(id => !touchedIds.has(id));
      } else {
        // Trop de changements, on renvoie l'AST complet
        const ast = buildAST(blocks);
        documentContext = serializeASTToLLMContext(ast);
        lastOmittedBlockIds.current = getOmittedBlockIds(ast);
      }
    }

    // Mise à jour de la référence pour le prochain appel
    lastSyncedBlocks.current = blocks;

    const contextSuffix = `\n\n## CONTEXTE DU DOCUMENT\nBloc actuellement sélectionné / curseur : ID="${targetBlockId}"\n\nDocument (AST XML) :\n${documentContext}`;

    const contextString = systemInstructions 
      ? `${protocol}\n\n${systemInstructions}${contextSuffix}`
      : `${protocol}${contextSuffix}`;

    return {
      contextString,
      omittedBlockIds: lastOmittedBlockIds.current
    };
  }, [blocks, selectedBlockIds]);

  return getSystemContext;
}
