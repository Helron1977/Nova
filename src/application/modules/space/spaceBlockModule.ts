// src/application/modules/space/spaceBlockModule.ts

import type { BlockModule } from '../../interfaces/blockModule';
import { SpaceRenderer } from './SpaceRenderer';
import { PinoLogger } from '../../../infrastructure/logging/PinoLogger'; // Ajuster le chemin si nécessaire
import { MoveVertical } from 'lucide-react'; // AJOUT: Importer l'icône

const logger = new PinoLogger();

export interface SpaceBlockData {
  height: number;
  originalInput: string; // Pour conserver la valeur brute comme "h=30"
}

const SpaceBlockModule: BlockModule<SpaceBlockData> = {
  type: 'spaceBlock', // Le type de bloc unique pour le système
  codeBlockLanguage: 'space', // MODIFIÉ: Le langage utilisé dans les ```space
  displayName: 'Espacement',
  icon: MoveVertical,
  menuIcon: MoveVertical, // AJOUT: Icône pour le menu
  paletteLabel: 'Espacement (Marge)',
  paletteKeyword: 'espace margin space gap separator',

  parseContent: (rawContent: string, blockId: string): SpaceBlockData => {
    logger.debug(`[SpaceBlockModule] Parsing content for block ${blockId}: "${rawContent}"`);
    const trimmedContent = rawContent.trim();
    const match = trimmedContent.match(/^h=(\d+)$/i); // Recherche "h=NUMERO"
    let height = 20; // Hauteur par défaut si le parsing échoue

    if (match && match[1]) {
      const parsedHeight = parseInt(match[1], 10);
      if (!isNaN(parsedHeight) && parsedHeight > 0) {
        height = parsedHeight;
      } else {
        logger.warn(`[SpaceBlockModule] Invalid height parsed: "${match[1]}". Using default ${height}px.`);
      }
    } else {
      logger.warn(`[SpaceBlockModule] Content "${trimmedContent}" does not match expected format "h=NUMBER". Using default ${height}px.`);
    }

    return {
      height,
      originalInput: trimmedContent, // Conserver la valeur brute originale
    };
  },

  RendererComponent: SpaceRenderer,

  // Optionnel: Si on avait un éditeur spécifique pour le bloc "space" (pas juste le textarea du code)
  // EditorComponent: SpaceEditor, 

  // Optionnel: Pour la sérialisation vers le Markdown dans le bloc de code
  // Si non défini, le système pourrait se rabattre sur le `rawMarkdown` original du bloc `code`
  // ou on pourrait ajouter une logique pour utiliser `block.content.customBlockData.originalInput`
  serializeContent: (customData: SpaceBlockData): string => {
    return customData.originalInput || `h=${customData.height}`;
  },

  // Optionnel: fournir des actions spécifiques pour le menu "+" ou le menu du bloc
  // getBlockActions: (block: Block) => [], 

  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as SpaceBlockData | undefined;
    return {
      type: 'spaceBlock',
      height: data?.height || 20,
    };
  },
  getAIPrompt: () => `[space] Espacement vertical. Syntaxe: \`\`\`space\nh=N\n\`\`\` (N=pixels, ex: h=20)`.trim(),
  
  helpDescription: `
L'espacement permet de créer un vide vertical entre deux blocs pour aérer votre document.

### Syntaxe
Le bloc d'espace est configuré par une seule ligne indiquant la hauteur en pixels :
\`\`\`space
h=30
\`\`\`

**Paramètres :**
- \`h\` : La hauteur de l'espacement en pixels (par défaut à 20).
  `
};

export default SpaceBlockModule;