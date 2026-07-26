// src/application/modules/variants/variantsModule.ts
//
// Bloc "variantes IA" : permet à l'IA de proposer plusieurs versions d'un même
// passage (tons, longueurs, angles différents) sans écraser l'original, et à
// l'utilisateur de comparer puis d'adopter une version qui remplace alors le
// bloc par du contenu Markdown normal.

import type { BlockModule } from '@/application/interfaces/blockModule';
import type { Block, UniversalBlockMetadata } from '@/application/logic/markdownParser';
import { VariantsRenderer } from './VariantsRenderer';
import { Layers } from 'lucide-react';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

export interface Variant {
  label: string;
  content: string;
}

export interface VariantsBlockData {
  variants: Variant[];
  rawSource: string;
}

const DEFAULT_RAW_CONTENT = '--- original ---\n\n--- alternative ---\n';

/**
 * Parse le contenu brut du bloc de code ```variants.
 * Format attendu :
 *   --- label 1 ---
 *   contenu markdown (peut être multi-lignes)
 *   --- label 2 ---
 *   contenu markdown
 *
 * Un séparateur "--- label ---" doit être seul sur sa ligne. Tolérant :
 * un contenu qui ne respecte pas le format devient une seule variante
 * "original" avec le texte brut en entier (dégradation gracieuse plutôt
 * que perte silencieuse).
 */
export function parseVariantsContent(rawContent: string): Variant[] {
  const separatorRegex = /^---\s*(.+?)\s*---\s*$/gm;
  const matches = [...rawContent.matchAll(separatorRegex)];

  if (matches.length === 0) {
    const trimmed = rawContent.trim();
    return trimmed ? [{ label: 'original', content: trimmed }] : [];
  }

  const variants: Variant[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const label = current[1].trim() || `variante ${i + 1}`;
    const start = (current.index ?? 0) + current[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? rawContent.length : rawContent.length;
    const content = rawContent.slice(start, end).trim();
    if (content) {
      variants.push({ label, content });
    }
  }
  return variants;
}

function serializeVariants(variants: Variant[]): string {
  return variants
    .map(v => `--- ${v.label} ---\n${v.content}`)
    .join('\n\n');
}

const VariantsModule: BlockModule<VariantsBlockData> = {
  type: 'variantsBlock',
  codeBlockLanguage: 'variants',
  menuIcon: Layers,
  icon: Layers,
  displayName: 'Variantes',
  paletteLabel: 'Variantes (comparaison IA)',
  paletteKeyword: 'variante alternative comparaison ton version choix',
  defaultRawContent: DEFAULT_RAW_CONTENT,

  parseContent: (rawContent: string, blockId: string): VariantsBlockData => {
    logger.debug(`[VariantsModule] Parsing content for block ${blockId}`);
    return {
      variants: parseVariantsContent(rawContent),
      rawSource: rawContent,
    };
  },

  RendererComponent: VariantsRenderer,

  serializeContent: (customData: VariantsBlockData): string => {
    return customData.rawSource ?? serializeVariants(customData.variants);
  },

  serializeToHTML: (customData: VariantsBlockData, blockId: string): string => {
    if (!customData?.variants?.length) {
      return `<div class="nova-variants-block" data-block-id="${blockId}"><p>Aucune variante.</p></div>`;
    }
    // À l'export statique (HTML/PDF), pas d'interactivité possible : on liste
    // toutes les variantes à la suite plutôt que de n'en choisir qu'une pour
    // l'utilisateur, afin de ne rien perdre silencieusement à l'export.
    const items = customData.variants
      .map(v => `<div class="nova-variant-item"><h4>${v.label}</h4><div>${v.content}</div></div>`)
      .join('');
    return `<div class="nova-variants-block" data-block-id="${blockId}">${items}</div>`;
  },

  createDefaultCustomData: (): VariantsBlockData => ({
    variants: parseVariantsContent(DEFAULT_RAW_CONTENT),
    rawSource: DEFAULT_RAW_CONTENT,
  }),

  updateBlockFromSource: (currentBlock: Block, rawSource: string, blockId: string): Block => {
    const newCustomData = VariantsModule.parseContent!(rawSource, blockId);
    return {
      id: currentBlock.id,
      type: VariantsModule.type as 'variantsBlock',
      content: {
        language: VariantsModule.codeBlockLanguage as 'variants',
        code: rawSource,
        customBlockData: newCustomData,
      },
      metadata: { ...(currentBlock.metadata as UniversalBlockMetadata) },
      rawMarkdown: `\`\`\`${VariantsModule.codeBlockLanguage}\n${rawSource}\n\`\`\``,
    } as Block;
  },

  // Représentation allégée pour le LLM : les labels et un aperçu tronqué de
  // chaque variante, jamais le texte intégral de toutes les versions (ça
  // gonflerait le contexte pour un bloc dont le rôle est déjà d'archiver des
  // choix passés, pas d'être une source de vérité éditable en place).
  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as VariantsBlockData | undefined;
    return {
      type: 'variantsBlock',
      variantsCount: data?.variants?.length || 0,
      variantsPreview: (data?.variants || []).map(v => ({
        label: v.label,
        preview: v.content.length > 80 ? v.content.slice(0, 80) + '…' : v.content,
      })),
    };
  },

  getAIPrompt: () =>
    `[variants] Comparaison de plusieurs versions d'un même passage. Utilise ce bloc ` +
    `— au lieu d'un UPDATE classique — quand l'utilisateur demande explicitement ` +
    `plusieurs options, tons, longueurs ou angles pour un même contenu (ex: ` +
    `"donne-moi 3 tons différents", "propose deux façons de dire ça"). ` +
    `Ne l'utilise jamais pour une simple modification demandée sans ambiguïté de choix. ` +
    `Syntaxe (chaque séparateur "--- label ---" seul sur sa ligne) :\n` +
    '```variants\n--- original ---\nTexte de départ inchangé.\n\n--- ton formel ---\n' +
    'Reformulation dans un registre soutenu.\n\n--- ton enjoué ---\n' +
    'Reformulation dynamique et légère.\n```\n' +
    `Toujours inclure la version "original" en première variante pour ne rien perdre. ` +
    `2 à 4 variantes maximum, chacune complète et autonome (pas de renvoi entre variantes).`,
    
  helpDescription: `
Ce bloc permet de comparer et d'afficher plusieurs versions alternatives (variantes) d'un même texte (par exemple, différents tons ou longueurs).

### Syntaxe
Chaque variante est délimitée par un séparateur \`--- nom de la variante ---\` seul sur une ligne.

\`\`\`variants
--- original ---
Texte de départ inchangé.

--- ton formel ---
Reformulation dans un registre plus soutenu et professionnel.

--- ton enjoué ---
Reformulation dynamique et légère !
\`\`\`

**Règles :**
- Le nom de la variante doit être entouré de \`---\`
- Le contenu de la variante se trouve juste en dessous du séparateur.
- Il est recommandé de toujours conserver la version \`--- original ---\` pour référence.
`
};

export default VariantsModule;
