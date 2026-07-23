import type { Block } from './markdownParser';

export interface DiffResult {
  added: Block[];
  modified: Block[];
  deleted: string[]; // IDs des blocs supprimés
  hasChanges: boolean;
  totalChanges: number;
}

/**
 * Calcule la différence entre deux listes de blocs et retourne un résumé.
 * Utilise une simple comparaison par ID et une vérification de la source Markdown brute.
 */
export function calculateAstDiff(oldBlocks: Block[], newBlocks: Block[]): DiffResult {
  const oldMap = new Map(oldBlocks.map(b => [b.id, b]));
  const newMap = new Map(newBlocks.map(b => [b.id, b]));
  
  const added: Block[] = [];
  const modified: Block[] = [];
  const deleted: string[] = [];
  
  // Chercher les ajouts et modifications
  for (const newBlock of newBlocks) {
    const oldBlock = oldMap.get(newBlock.id);
    if (!oldBlock) {
      added.push(newBlock);
    } else if (oldBlock.rawMarkdown !== newBlock.rawMarkdown || JSON.stringify(oldBlock.metadata) !== JSON.stringify(newBlock.metadata)) {
      modified.push(newBlock);
    }
  }
  
  // Chercher les suppressions
  for (const oldBlock of oldBlocks) {
    if (!newMap.has(oldBlock.id)) {
      deleted.push(oldBlock.id);
    }
  }
  
  const totalChanges = added.length + modified.length + deleted.length;
  
  return {
    added,
    modified,
    deleted,
    hasChanges: totalChanges > 0,
    totalChanges
  };
}

/**
 * Optionnel: Génère une représentation XML allégée du diff pour le System Prompt.
 */
export function formatDiffAsXML(diff: DiffResult): string {
  if (!diff.hasChanges) return '<diff status="unchanged" />';
  
  let xml = '<diff>\n';
  
  if (diff.added.length > 0) {
    xml += '  <added>\n';
    diff.added.forEach(b => {
      xml += `    <block id="${b.id}" type="${b.type}">\n      <![CDATA[${b.rawMarkdown}]]>\n    </block>\n`;
    });
    xml += '  </added>\n';
  }
  
  if (diff.modified.length > 0) {
    xml += '  <modified>\n';
    diff.modified.forEach(b => {
      xml += `    <block id="${b.id}" type="${b.type}">\n      <![CDATA[${b.rawMarkdown}]]>\n    </block>\n`;
    });
    xml += '  </modified>\n';
  }
  
  if (diff.deleted.length > 0) {
    xml += '  <deleted>\n';
    diff.deleted.forEach(id => {
      xml += `    <block id="${id}" />\n`;
    });
    xml += '  </deleted>\n';
  }
  
  xml += '</diff>';
  return xml;
}
