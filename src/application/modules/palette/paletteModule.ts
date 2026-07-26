import type { BlockModule } from '@/application/interfaces/blockModule';
import { PaletteRenderer } from './PaletteRenderer';
import { parsePaletteCodeContent, type ColorInfo, type Block, type UniversalBlockMetadata } from '@/application/logic/markdownParser';
import { Palette } from 'lucide-react';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

export interface PaletteBlockData {
  colors: ColorInfo[];
  rawSource: string;
}

// const paletteDefaultRawContent = '--exemple-couleur: #DC2626;\n--autre-exemple: #059669;';
const paletteDefaultRawContent = ''; // Laisser vide pour que le placeholder de l'éditeur s'affiche

const PaletteModule: BlockModule<PaletteBlockData> = {
  type: 'paletteBlock',
  codeBlockLanguage: 'palette',
  menuIcon: Palette,
  editActionType: 'custom',

  parseContent: (rawContent: string, blockId: string): PaletteBlockData => {
    logger.debug(`[PaletteModule] Parsing content for block ${blockId}: "${rawContent.substring(0, 50)}..."`);
    const colors = parsePaletteCodeContent(rawContent);
    return {
      colors,
      rawSource: rawContent,
    };
  },

  RendererComponent: PaletteRenderer,

  serializeContent: (customData: PaletteBlockData): string => {
    return customData.rawSource;
  },

  serializeToHTML: (customData: PaletteBlockData, blockId: string): string => {
    if (!customData || !customData.colors || customData.colors.length === 0) {
      return `<div class="custom-html-palette-container" data-block-id="${blockId}"><p>Palette vide ou erreur de données.</p></div>`;
    }
    const colorItemsHTML = customData.colors
      .map(
        (color) => `
        <div class="palette-color-item" title="${color.name} - ${color.hex}">
          <div class="palette-color-item-display" style="background-color: ${color.hex};"></div>
          <div class="palette-color-item-name">${color.name}</div>
          <div class="palette-color-item-hex">${color.hex}</div>
        </div>
      `
      )
      .join('');
    return `<div class="custom-html-palette-container" data-block-id="${blockId}">${colorItemsHTML}</div>`;
  },
  
  displayName: 'Palette de Couleurs',
  icon: Palette,
  paletteLabel: 'Palette de Couleurs',
  paletteKeyword: 'palette couleur color theme',
  defaultRawContent: paletteDefaultRawContent,

  createDefaultCustomData: (): PaletteBlockData => {
    const colors = parsePaletteCodeContent(paletteDefaultRawContent);
    return {
      colors,
      rawSource: paletteDefaultRawContent,
    };
  },

  updateBlockFromSource: (currentBlock: Block, rawSource: string, blockId: string): Block => {
    const newCustomData = PaletteModule.parseContent!(rawSource, blockId);
    const originalMetadata = currentBlock.metadata;

    return {
      id: currentBlock.id,
      type: PaletteModule.type as 'paletteBlock',
      content: {
        language: PaletteModule.codeBlockLanguage as "palette",
        code: rawSource,
        customBlockData: newCustomData,
      },
      metadata: {
        ...(originalMetadata as UniversalBlockMetadata),
      },
      rawMarkdown: `\`\`\`${PaletteModule.codeBlockLanguage}\n${rawSource}\n\`\`\``
    };
  },

  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as PaletteBlockData | undefined;
    return {
      type: 'paletteBlock',
      colorsCount: data?.colors?.length || 0,
      colorsPreview: data?.colors?.map(c => `${c.name}: ${c.hex}`) || [],
    };
  },
  getAIPrompt: () => `[palette] Thème de couleurs personnalisé. Syntaxe attendue (variables CSS) :\n\`\`\`palette\n--nom-couleur: #HEX;\n--autre-couleur: #HEX;\n\`\`\`\nGénère 3 à 5 couleurs pertinentes (noms explicites et codes HEX) lorsque l'utilisateur demande une palette.`.trim(),

  helpDescription: `
Ce bloc permet de définir une **palette de couleurs** personnalisée sous forme de variables CSS. L'éditeur générera automatiquement des échantillons de couleur (swatches) pour prévisualiser la palette.

### Syntaxe
Le bloc attend une syntaxe similaire à celle des variables CSS, où chaque ligne définit une couleur avec son code hexadécimal.

\`\`\`palette
--primaire: #3b82f6;
--secondaire: #10b981;
--accent: #f59e0b;
\`\`\`

**Règles :**
- Chaque couleur doit commencer par \`--\` suivi du nom de la couleur.
- La valeur doit être un code couleur hexadécimal valide (\`#RRGGBB\`).
- Vous devez terminer chaque ligne par un point-virgule \`;\`.
`
};

export default PaletteModule;