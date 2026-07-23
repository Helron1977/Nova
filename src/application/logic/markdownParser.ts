import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import type { Position, Node, Parent } from 'unist'; // Conserver Position de unist, ajouter Node et Parent
import type { Root, Content, Text, HTML } from 'mdast'; // Utiliser mdast pour Root et Content, ajouter List et ListItem, et ajouter Text, Strong, Emphasis, HTML
import { PinoLogger } from '@/infrastructure/logging/PinoLogger'; // Importer le logger
import { getBlockModuleByCodeLanguage } from './blockRegistry';// Pour typer moduleInstance
import type { PaletteBlockData } from '../modules/palette/paletteModule'; // AJOUTÉ
import { DrawingBlock, DrawingBlockData } from '../modules/drawing/types'; // AJOUT: Importer les types Drawing
import type { VariantsBlockData } from '../modules/variants/variantsModule';
import type { ApiFlowBlockData } from '../modules/apiFlow/apiFlowModule';

// Instancier le logger (pour ce module)
const logger = new PinoLogger();

// --- Définitions des Types Inline --- // Nouvelle section

interface BaseInline {
  type: string;
  // Peut-être ajouter la position AST ici aussi ? Pour l'instant, on garde simple.
  // position?: Position;
}

export interface TextInline extends BaseInline {
  type: 'text';
  value: string;
  rawMarkdown?: string; // Stockage optionnel du Markdown brut
}

export interface StrongInline extends BaseInline {
  type: 'strong';
  children: InlineElement[]; // Permet l'imbrication (gras dans italique)
}

export interface EmphasisInline extends BaseInline {
  type: 'emphasis';
  children: InlineElement[];
}

export interface HTMLInline extends BaseInline {
  type: 'html';
  value: string; // HTML brut
}

export interface LinkInline extends BaseInline {
  type: 'link';
  url: string;
  title?: string | null; // Le titre est optionnel
  children: InlineElement[]; // Le texte du lien peut contenir d'autres éléments inline
}

export interface InlineCodeElement extends BaseInline {
  type: 'inlineCode';
  value: string; // Le contenu du code
}

export interface DeleteInline extends BaseInline {
  type: 'delete'; // mdast utilise 'delete' pour strikethrough
  children: InlineElement[];
}

// Ajouter d'autres types inline si nécessaire (Link, Image inline, Code inline, etc.)
// Pour l'instant, on se concentre sur texte, gras, italique, html.

export type InlineElement =
  | TextInline
  | StrongInline
  | EmphasisInline
  | HTMLInline
  | LinkInline
  | InlineCodeElement
  | DeleteInline;


// --- NOUVELLE DÉFINITION UNIVERSELLE DES MÉTADONNÉES ---
export interface UniversalBlockMetadata {
  position?: Position;
  indentationLevel?: number; // Pour les blocs généraux comme paragraphe, titre, code etc.
  depth?: number;             // Spécifique aux listItems (niveau d'imbrication)
  ordered?: boolean;          // Spécifique aux listItems (si la liste est numérotée)
  checked?: boolean | null;   // Spécifique aux listItems (pour les cases à cocher des tâches)
  markerStyle?: MarkerStyle;  // Spécifique aux listItems (style de puce/numérotation)
  language?: string;          // Spécifique aux codeBlocks (langage du code)
  originalLanguage?: string;  // Pour les blocs custom (ex: palette) parsés depuis un bloc de code, stocke la langue d'origine (ex: 'palette')
  customBlockType?: string;   // Pour marquer un bloc custom explicitement (ex: 'paletteBlock')
  layoutWidth?: 'full' | 'half' | 'third' | 'quarter'; // Pour la disposition flexible (largeur du bloc)
  isNewBlock?: boolean;
  // Tous les autres champs spécifiques qui pourraient exister (ex: align pour les tables) sont gérés au niveau du `content` du bloc.
  [key: string]: any;
}

// --- MODIFICATION DE L'INTERFACE DE BASE ---
export interface BaseBlock {
  id: string;
  type: string;
  content: any;
  rawMarkdown?: string;
}

// --- MODIFICATION DES BLOCS SPÉCIFIQUES ---
export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  content: { level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineElement[] };
  metadata: UniversalBlockMetadata;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: { children: InlineElement[] };
  metadata: UniversalBlockMetadata;
}

export interface ListItemBlock extends BaseBlock {
  type: 'listItem';
  content: { children: InlineElement[] };
  // ListItemBlock utilisera UniversalBlockMetadata qui contient déjà depth, ordered, checked, markerStyle, position.
  metadata: UniversalBlockMetadata;
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  content: { language?: string; code: string };
  // CodeBlock utilisera UniversalBlockMetadata qui contient déjà language, indentationLevel, position.
  metadata: UniversalBlockMetadata;
}

export interface MermaidBlock extends BaseBlock {
  type: 'mermaid';
  content: { code: string };
  metadata: UniversalBlockMetadata; // Utilise indentationLevel, position.
}

// --- AJOUT: Types pour le bloc Palette ---
export interface ColorInfo {
  name: string;
  hex: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  content: {
    url: string;
    alt?: string | null;
    title?: string | null;
  };
  metadata: UniversalBlockMetadata; // Utilise indentationLevel, position.
}

export interface BlockquoteBlock extends BaseBlock {
  type: 'blockquote';
  content: { children: InlineElement[] };
  metadata: UniversalBlockMetadata; // Utilise indentationLevel, position.
}

export interface ThematicBreakBlock extends BaseBlock {
  type: 'thematicBreak';
  content: {}; // Pas de contenu spécifique
  metadata: UniversalBlockMetadata; // Utilise indentationLevel, position.
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  content: {
    align: (('left' | 'right' | 'center') | null)[];
    rows: InlineElement[][][];
  };
  metadata: UniversalBlockMetadata; // Utilise indentationLevel, position.
}

export interface HTMLBlock extends BaseBlock {
  type: 'html';
  content: { html: string };
  metadata: UniversalBlockMetadata; // Utilise indentationLevel, position.
}

export interface DropZoneBlock extends BaseBlock {
  type: 'dropZone';
  content: {}; // Pas de contenu spécifique pour l'instant
  metadata: UniversalBlockMetadata; // Utilise indentationLevel, position.
}

// AJOUT: Définition pour PaletteBlock
export interface PaletteBlock extends BaseBlock {
  type: 'paletteBlock';
  content: {
    language: 'palette';
    code: string;
    customBlockData: PaletteBlockData;
  };
  // PaletteBlock utilisera UniversalBlockMetadata qui contient déjà originalLanguage, customBlockType, indentationLevel, position.
  metadata: UniversalBlockMetadata;
}

// AJOUT: Définition pour DrawingBlock (répétée ici pour s'assurer qu'elle est bien au bon endroit si besoin, mais déjà dans drawing/types.ts)
// En fait, pas besoin de la redéfinir ici si elle est importée. L'import suffit.

export interface BookmarkBlock extends BaseBlock {
  type: 'bookmark';
  content: { url: string };
  metadata: UniversalBlockMetadata;
}

export interface VariantsBlock extends BaseBlock {
  type: 'variantsBlock';
  content: {
    language: 'variants';
    code: string;
    customBlockData: VariantsBlockData;
  };
  metadata: UniversalBlockMetadata;
}

export interface ApiFlowBlock extends BaseBlock {
  type: 'apiFlowBlock';
  content: {
    language: 'apiflow';
    code: string;
    customBlockData: ApiFlowBlockData;
  };
  metadata: UniversalBlockMetadata;
}

// Type Union
export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListItemBlock
  | CodeBlock
  | MermaidBlock
  | ImageBlock
  | BlockquoteBlock
  | ThematicBreakBlock
  | TableBlock
  | HTMLBlock
  | DropZoneBlock
  | PaletteBlock
  | DrawingBlock // AJOUT: DrawingBlock à l'union
  | BookmarkBlock
  | VariantsBlock
  | ApiFlowBlock;

// << AJOUT: Export du type pour les styles de marqueurs >>
export type MarkerStyle = 'bullet' | 'decimal' | 'lower-alpha' | 'lower-roman' | 'upper-alpha' | 'upper-roman';

// --- Fonction de Parsing ---

// Nouvelle fonction pour extraire le contenu inline structuré
const extractInlineContent = (node: Parent | Node): InlineElement[] => {
   const inlineElements: InlineElement[] = [];

   // Vérifier si le noeud a des enfants à traiter
   if (!('children' in node) || !Array.isArray(node.children)) {
        // Gérer les cas où le noeud lui-même est un élément inline simple
        if(node.type === 'text') {
             // Remplacer les \n littéraux par de vrais sauts de ligne
             const textValue = (node as Text).value.replace(/\\n/g, '\n');
             return [{ 
                type: 'text', 
                value: textValue,
                rawMarkdown: textValue // Conserver le Markdown brut
             }];
        }
        if(node.type === 'html') {
             return [{ type: 'html', value: (node as HTML).value }];
        }
       // Si le noeud n'a pas d'enfants et n'est pas un inline simple, retourner vide.
       return []; 
   }

   // Parcourir les enfants directs du noeud
   node.children.forEach((child: Content | Node) => {
       switch (child.type) {
           case 'text':
               // Remplacer les \n littéraux par de vrais sauts de ligne
               const textValue = (child as Text).value.replace(/\\n/g, '\n');
               inlineElements.push({ type: 'text', value: textValue });
               break;
           case 'strong':
               // Le noeud strong est un Parent, on extrait ses enfants inline
               inlineElements.push({ 
                   type: 'strong', 
                   children: extractInlineContent(child as Parent) // Récursion correcte
               });
               break;
           case 'emphasis':
               // Le noeud emphasis est un Parent, on extrait ses enfants inline
               inlineElements.push({ 
                   type: 'emphasis', 
                   children: extractInlineContent(child as Parent) // Récursion correcte
               });
               break;
           case 'html':
               // HTML inline est un noeud simple
               inlineElements.push({ type: 'html', value: (child as HTML).value });
               break;
           case 'link':
               // Le noeud link est un Parent contenant le texte du lien
               inlineElements.push({ 
                   type: 'link', 
                   url: (child as any).url,       // Récupérer l'URL
                   title: (child as any).title,   // Récupérer le titre (peut être null)
                   children: extractInlineContent(child as Parent) // Extraire les enfants (texte du lien)
               });
               break;
           case 'inlineCode':
                // Le noeud inlineCode contient directement la valeur
                 inlineElements.push({ 
                     type: 'inlineCode', 
                     value: (child as any).value 
                 });
                 break;
           case 'delete': // Gérer strikethrough
                // Le noeud delete est un Parent
                inlineElements.push({ 
                    type: 'delete', 
                    children: extractInlineContent(child as Parent)
                });
                break;
           case 'paragraph':
                // Si on rencontre un paragraphe, on extrait son contenu inline.
                // C'est crucial pour les listItems qui encapsulent leur texte dans un paragraphe.
                inlineElements.push(...extractInlineContent(child as Parent));
                break;
           
           // IGNORER les types de bloc purs ou ceux déjà gérés spécifiquement au niveau bloc.
           case 'list':
           // case 'listItem': // On ne veut pas traiter les enfants de listItem ici, c'est géré plus haut.
           case 'heading':
           case 'code':
           case 'blockquote':
           case 'thematicBreak':
           case 'table':
                // Ne rien faire pour ces types, ils sont soit des blocs, soit gérés ailleurs.
                break; 

           default:
               // Utiliser logger.info ou logger.debug pour les types sautés
               logger.debug(`[extractInlineContent] Skipping unhandled/unknown inline node type: ${child.type}`, { node: child });
               break;
       }
   });

   return inlineElements;
};

// --- AJOUT: Fonction pour parser le contenu d'un bloc palette CSS HEX ---
export const parsePaletteCodeContent = (code: string): ColorInfo[] => {
  const colors: ColorInfo[] = [];
  const lines = code.split('\n');
  // Regex ajustée pour capturer la valeur hexadécimale (3, 4, 6 ou 8 caractères)
  const cssVarRegex = /^\s*--([a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;?\s*$/;

  logger.debug(`[parsePaletteCodeContent] Attempting to parse code:\n${code}`);

  for (const line of lines) {
    logger.debug(`[parsePaletteCodeContent] Processing line: "${line}" (length: ${line.length})`);
    const trimmedLine = line.trim();
    logger.debug(`[parsePaletteCodeContent] Trimmed line: "${trimmedLine}"`);
    const match = trimmedLine.match(cssVarRegex);
    if (match) {
      logger.debug(`[parsePaletteCodeContent] Match found for line "${trimmedLine}":`, match);
      const name = match[1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const hex = match[2]; // Le groupe 2 capture maintenant #RRGGBB ou #RRGGBBAA
      colors.push({ name, hex });
    } else {
      const charCodes = trimmedLine.split('').map(char => char.charCodeAt(0)).join(', ');
      logger.debug(`[parsePaletteCodeContent] No match for trimmed line: "${trimmedLine}". Char codes: [${charCodes}]`);
    }
  }
  logger.debug(`[parsePaletteCodeContent] Parsed colors: ${JSON.stringify(colors)}`);
  return colors;
};
// --- FIN AJOUT ---

// Fonction utilitaire pour sérialiser un listItem en Markdown
function serializeInlineElementsToMarkdown(elements: InlineElement[] | undefined): string {
  if (!elements) return '';
  return elements
    .filter(element => !!element) // Filtrer les éléments nuls ou non définis
    .map(element => {
      // element est maintenant garanti d'être non-nul ici grâce au filter
      switch (element.type) {
        case 'text': return (element as TextInline).value;
        case 'strong': return `**${serializeInlineElementsToMarkdown((element as StrongInline).children)}**`;
        case 'emphasis': return `*${serializeInlineElementsToMarkdown((element as EmphasisInline).children)}*`;
        case 'inlineCode': return `\`${(element as InlineCodeElement).value}\``;
        case 'link': {
          const link = element as LinkInline;
          const linkText = serializeInlineElementsToMarkdown(link.children);
          const titlePart = link.title ? ` \"${link.title}\"` : '';
          return `[${linkText}](${link.url}${titlePart})`;
        }
        case 'delete': return `~~${serializeInlineElementsToMarkdown((element as DeleteInline).children)}~~`;
        case 'html': return (element as HTMLInline).value;
        default:
          // const unhandledType = (element as any).type;
          // console.warn(`[serializeInlineElementsToMarkdown] Unhandled inline element type: ${unhandledType}`);
          return ''; // Retourner une chaîne vide pour les types non gérés
      }
    }).join('');
}

export function serializeListItemToMarkdown(block: ListItemBlock): string {
  const metadata = block.metadata || {};
  const marker = metadata.ordered ? '1.' : '-';
  let checkbox = '';
  if (metadata.checked === true) checkbox = ' [x]';
  else if (metadata.checked === false) checkbox = ' [ ]';
  const textContent = block.content?.children;
  const text = serializeInlineElementsToMarkdown(textContent);
  return `${marker}${checkbox} ${text}`.trim();
}


// Nouvelle fonction de parsing centralisée pour tous les types de nœuds
const parseNodeToBlock = (
  node: Content | Node,
  currentIndentationLevel: number = 0,
  rawMarkdownForNode?: string
): Block | null => {
  const baseId = uuidv4();
  let blockMetadata: UniversalBlockMetadata = {
    position: node.position,
    indentationLevel: currentIndentationLevel,
  };

  switch (node.type) {
    case 'heading':
      // indentationLevel est déjà dans metadata
      return {
        id: baseId,
        type: 'heading',
        content: {
          level: (node as import('mdast').Heading).depth as 1 | 2 | 3 | 4 | 5 | 6,
          children: extractInlineContent(node as Parent),
        },
        metadata: blockMetadata, // Universal metadata
        rawMarkdown: rawMarkdownForNode,
      } as HeadingBlock;

    case 'paragraph': {
      // indentationLevel est déjà dans metadata
      const inlineChildren = extractInlineContent(node as Parent);

      // --- AJOUT: Détection de Signet (Bookmark) et Image ---
      const rawChildren = (node as import('mdast').Parent).children;

      if (rawChildren && rawChildren.length === 1 && rawChildren[0].type === 'image') {
        const imageNode = rawChildren[0] as import('mdast').Image;
        return {
          id: baseId,
          type: 'image',
          content: {
            url: imageNode.url,
            alt: imageNode.alt || undefined,
            title: imageNode.title || undefined,
          },
          metadata: blockMetadata,
          rawMarkdown: rawMarkdownForNode,
        } as ImageBlock;
      }

      // Si le paragraphe ne contient qu'un seul enfant, que c'est un lien,
      // on le transforme en bloc signet.
      if (inlineChildren.length === 1 && inlineChildren[0].type === 'link') {
        const linkInline = inlineChildren[0] as LinkInline;
        return {
          id: baseId,
          type: 'bookmark',
          content: { url: linkInline.url },
          metadata: blockMetadata,
          rawMarkdown: rawMarkdownForNode,
        } as BookmarkBlock;
      }

      return {
        id: baseId,
        type: 'paragraph',
        content: { children: inlineChildren },
        metadata: blockMetadata, // Universal metadata
        rawMarkdown: rawMarkdownForNode,
      } as ParagraphBlock;
    }

    case 'listItem': // ListItem est traité dans le bloc 'list' parent
      // Cette fonction est appelée pour chaque enfant d'une liste.
      // Les métadonnées spécifiques (depth, ordered, checked, markerStyle) sont définies par le parent 'list'.
      // 'currentIndentationLevel' ici représente la 'depth' pour le listItem.
      blockMetadata = { // Recréer metadata spécifiquement pour listItem
        position: node.position,
        // 'indentationLevel' n'est pas directement pertinent pour listItem, c'est 'depth'
        depth: currentIndentationLevel, // currentIndentationLevel transmis par le parent 'list' correspond à la profondeur
        ordered: (node as any).parentOrdered, // Doit être passé par le contexte de 'list'
        checked: (node as import('mdast').ListItem).checked,
        markerStyle: (node as any).parentMarkerStyle, // Doit être passé par le contexte de 'list'
      };
      return {
        id: baseId,
        type: 'listItem',
        content: { children: extractInlineContent(node as Parent) },
        metadata: blockMetadata, // Universal metadata spécifique au listItem
        rawMarkdown: rawMarkdownForNode,
      } as ListItemBlock;

    case 'code':
      const codeNode = node as import('mdast').Code;
      const lang = codeNode.lang ?? undefined;
      const codeValue = codeNode.value || '';
      blockMetadata.language = lang;

      if (lang === 'mermaid') {
        return {
          id: baseId, type: 'mermaid', content: { code: codeValue },
          metadata: blockMetadata, rawMarkdown: rawMarkdownForNode
        } as MermaidBlock;
      }

      // GESTION DES MODULES CUSTOMISÉS BASÉS SUR LE LANGAGE DU BLOC DE CODE
      const moduleInstance = getBlockModuleByCodeLanguage(lang || '');
      if (moduleInstance) {
        logger.debug(`[markdownParser] Module trouvé pour langage "${lang}": ${moduleInstance.type}. Parsing avec le module.`);
        try {
          const customBlockData = moduleInstance.parseContent(codeValue, baseId);
          
          // Construction spécifique pour PaletteBlock (exemple à suivre pour DrawingBlock)
          if (moduleInstance.type === 'paletteBlock') {
            return {
              id: baseId,
              type: 'paletteBlock', // Le type du module
              content: {
                language: lang, // Langage d'origine
                code: codeValue,  // Code source brut
                customBlockData: customBlockData as PaletteBlockData, // Données parsées
              },
              metadata: {
                ...blockMetadata,
                originalLanguage: lang,
                customBlockType: moduleInstance.type,
              },
              rawMarkdown: rawMarkdownForNode,
            } as PaletteBlock;
          } else if (moduleInstance.type === 'drawingBlock') { // AJOUT: Gestion spécifique pour DrawingBlock
            return {
              id: baseId,
              type: 'drawingBlock',
              content: {
                language: lang,
                code: codeValue,
                customBlockData: customBlockData as DrawingBlockData,
              },
              metadata: {
                ...blockMetadata,
                originalLanguage: lang,
                customBlockType: moduleInstance.type,
              },
              rawMarkdown: rawMarkdownForNode,
            } as DrawingBlock;
          }
          // TODO: Ajouter d'autres 'else if' pour d'autres modules qui transforment le type
          // ou avoir une approche plus générique si tous les modules custom stockent de la même façon

          // Fallback générique si le module ne change pas le type fondamentalement (reste un 'code' enrichi)
          // Ou si le module.type n'est pas géré par un 'else if' ci-dessus
          // logger.warn(`[markdownParser] Module "${moduleInstance.type}" a un parseContent mais pas de transformation de type spécifique gérée ici. Le bloc restera de type 'code'.`);
          // Pour l'instant, on va laisser cette logique de fallback ci-dessous pour les blocs de code non transformés.
          // L'idée est que si un module est trouvé et qu'il est censé transformer le type (comme PaletteModule -> PaletteBlock),
          // il faut le gérer explicitement ci-dessus.
          // Sinon, le bloc reste un 'CodeBlock' et customBlockData n'est pas nativement attendu sur son 'content'.
          // La gestion de customBlockData pour les CodeBlocks non transformés se fait au niveau de SortableBlockItem.

        } catch (e) {
          logger.error(`[markdownParser] Erreur lors de moduleInstance.parseContent pour langage "${lang}" (module ${moduleInstance.type}):`, e);
          // En cas d'erreur de parsing par le module, on retourne un bloc de code standard
        }
      }

      // Bloc de code standard (pas de module ou erreur module, ou module ne transformant pas le type)
      return {
        id: baseId, type: 'code', content: { language: lang, code: codeValue },
        metadata: blockMetadata, rawMarkdown: rawMarkdownForNode,
      } as CodeBlock;

    case 'image':
      // indentationLevel est déjà dans metadata
      return {
        id: baseId,
        type: 'image',
        content: {
          url: (node as import('mdast').Image).url,
          alt: (node as import('mdast').Image).alt || undefined,
          title: (node as import('mdast').Image).title || undefined,
        },
        metadata: blockMetadata, // Universal metadata
        rawMarkdown: rawMarkdownForNode, // mdast ne stocke pas le raw pour image, mais on le passe
      } as ImageBlock;

    case 'blockquote':
      // indentationLevel est déjà dans metadata
      return {
        id: baseId,
        type: 'blockquote',
        content: { children: extractInlineContent(node as Parent) },
        metadata: blockMetadata, // Universal metadata
        rawMarkdown: rawMarkdownForNode,
      } as BlockquoteBlock;

    case 'thematicBreak':
      // indentationLevel est déjà dans metadata
      return {
        id: baseId,
        type: 'thematicBreak',
        content: {},
        metadata: blockMetadata, // Universal metadata
        rawMarkdown: rawMarkdownForNode,
      } as ThematicBreakBlock;

    case 'table':
      // indentationLevel est déjà dans metadata
      const tableNode = node as import('mdast').Table;
      return {
        id: baseId,
        type: 'table',
        content: {
          align: tableNode.align || [],
          rows: tableNode.children.map(row =>
            (row as import('mdast').TableRow).children.map(cell =>
              extractInlineContent(cell as Parent)
            )
          ),
        },
        metadata: blockMetadata, // Universal metadata
        rawMarkdown: rawMarkdownForNode,
      } as TableBlock;
      
    case 'html': // HTML de type bloc
        // indentationLevel est déjà dans metadata
      return {
        id: baseId,
        type: 'html',
        content: { html: (node as HTML).value },
        metadata: blockMetadata, // Universal metadata
        rawMarkdown: rawMarkdownForNode,
      } as HTMLBlock;
      
    // Les types 'list' ne génèrent pas de bloc direct, mais leurs 'listItem' enfants le font.
    // Le traitement des listes est fait dans processNodeAndChildren.
    // 'definition', 'footnoteDefinition' pourraient être gérés ici si nécessaire.

    default:
      logger.warn(`[parseNodeToBlock] Type de noeud AST non géré pour la conversion en bloc: ${node.type}`);
      return null;
  }
};

// MODIFICATION de processNodeAndChildren pour gérer la logique des listes et passer les métadonnées parentales
const processNodeAndChildren = (
  node: Content | Node,
  blocks: Block[],
  currentIndentationLevel: number = 0,
  // additionalMetadata n'est plus directement utilisé ici, mais on passe les infos parentales pour les listes
  _parentListData?: { ordered: boolean; markerStyle: MarkerStyle },
  _rawMarkdownForNode?: string, // Le Markdown brut pour ce noeud spécifique
  markdownStr?: string // ADDED
): void => {
  const currentRawMarkdown = getRawMarkdownFromNode(node, markdownStr) ?? '';

  if (node.type === 'list') {
    const listNode = node as import('mdast').List;
    const ordered = listNode.ordered ?? false;
    // Déterminer markerStyle (simplifié, peut être amélioré)
    let markerStyle: MarkerStyle = ordered ? 'decimal' : 'bullet';
    if (listNode.children.length > 0) {
        //const firstChild = listNode.children[0] as import('mdast').ListItem;
        // Une logique plus fine pourrait être nécessaire pour déterminer le style exact à partir du contenu brut
        // ou des propriétés de remark-parse si elles existent.
        // Pour l'instant, on se base sur 'ordered'.
    }

    listNode.children.forEach((listItemNode) => {
      // Pour les listItems, currentIndentationLevel devient leur 'depth'.
      // On passe les informations de la liste parente (ordered, markerStyle).
      (listItemNode as any).parentOrdered = ordered; // Injecter pour parseNodeToBlock
      (listItemNode as any).parentMarkerStyle = markerStyle; // Injecter pour parseNodeToBlock
      
      // Le rawMarkdown pour le listItem doit être celui du noeud listItem lui-même
      const rawMdForItem = getRawMarkdownFromNode(listItemNode, markdownStr) ?? '';
      const listItemBlock = parseNodeToBlock(listItemNode, currentIndentationLevel, rawMdForItem);
      if (listItemBlock) {
        blocks.push(listItemBlock);
        // Si le listItem contient lui-même des listes imbriquées :
        (listItemNode as Parent).children.forEach(childOfListItem => {
            if (childOfListItem.type === 'list') {
                 processNodeAndChildren(childOfListItem, blocks, currentIndentationLevel + 1, { ordered: (childOfListItem as import('mdast').List).ordered ?? false, markerStyle: 'bullet' /* TODO: déterminer style enfant */}, undefined, markdownStr);
            }
        });
      }
    });
    return; // Les listes elles-mêmes ne deviennent pas des blocs, seulement leurs enfants listItem.
  }

  // Pour les autres types de blocs, appeler parseNodeToBlock
  // 'currentIndentationLevel' est l'indentation du bloc lui-même.
  const block = parseNodeToBlock(node, currentIndentationLevel, currentRawMarkdown);
  if (block) {
    blocks.push(block);

    // Gérer l'indentation des enfants pour les types de blocs qui peuvent en avoir (ex: blockquote)
    // Non implémenté ici pour garder la logique de `parseNodeToBlock` centrale pour la création de bloc.
    // Si un blockquote contient des paragraphes, `processNodeAndChildren` sera appelé récursivement
    // par la boucle principale dans `markdownToBlocks` pour ces enfants, et `currentIndentationLevel`
    // devrait être géré par cette boucle principale si on veut indenter le contenu *à l'intérieur* du blockquote.
    // Actuellement, `currentIndentationLevel` gère l'indentation du bloc lui-même par rapport à son conteneur.
  }
};


export const markdownToBlocks = (markdown: string): Block[] => {
  logger.debug('[markdownToBlocks] Parsing Markdown to blocks...');
  const processor = unified().use(remarkParse).use(remarkGfm);
  let ast: Root;
  try {
    ast = processor.parse(markdown) as Root;
    logger.debug('[markdownToBlocks] AST généré:', JSON.stringify(ast, null, 2));
  } catch (error) {
    logger.error('[markdownToBlocks] Erreur lors du parsing du Markdown en AST:', error);
    // Retourner un bloc d'erreur si le parsing échoue complètement
    return [
      {
        id: uuidv4(),
        type: 'paragraph',
        content: { children: [{ type: 'text', value: `Erreur de parsing Markdown: ${(error as Error).message}` }] },
        metadata: { indentationLevel: 0 },
        rawMarkdown: markdown, // Conserver le markdown original qui a causé l'erreur
      },
    ];
  }

  const blocks: Block[] = [];
  if (ast && ast.children) {
    ast.children.forEach((node: Content) => {
      // AJOUT: Intercepter les commentaires HTML de layout pour les appliquer au bloc précédent
      if (node.type === 'html') {
          const htmlNode = node as import('mdast').HTML;
          const layoutMatch = htmlNode.value.match(/<!--\s*layout:\s*(half|third|quarter|full)\s*-->/i);
          if (layoutMatch) {
              if (blocks.length > 0) {
                  blocks[blocks.length - 1].metadata.layoutWidth = layoutMatch[1].toLowerCase() as any;
              }
              return; // Ne pas traiter ce commentaire HTML comme un bloc
          }
      }

      // Utiliser getRawMarkdownFromNode pour obtenir le slice de Markdown pour chaque noeud de haut niveau
      const nodeMarkdown = getRawMarkdownFromNode(node, markdown) ?? ''; 
      processNodeAndChildren(node, blocks, 0, undefined, nodeMarkdown, markdown);
    });
  }
  logger.debug('[markdownToBlocks] Blocs générés:', JSON.stringify(blocks, null, 2));
  return blocks;
};

// Helper pour obtenir le slice de Markdown brut pour un noeud donné
// Utilise les informations de position du noeud AST
function getRawMarkdownFromNode(node: Node, markdownStr?: string): string | undefined {
  if (markdownStr && node.position && typeof node.position.start.offset === 'number' && typeof node.position.end.offset === 'number') {
    return markdownStr.slice(node.position.start.offset, node.position.end.offset);
  }
  return undefined;
}

// La fonction parsePaletteCodeContent est déjà définie et exportée plus haut (autour de la ligne 312).
// Nous supprimons cette redéfinition.
/*
export const parsePaletteCodeContent = (code: string): ColorInfo[] => {
  const colors: ColorInfo[] = [];
  if (!code || typeof code !== 'string') {
    logger.warn('[parsePaletteCodeContent] Input code is invalid or not a string.');
    return colors;
  }
  const lines = code.split('\n');
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('--') && trimmedLine.includes(':
') && trimmedLine.endsWith(';')) {
      const parts = trimmedLine.substring(2, trimmedLine.length - 1).split(':');
      if (parts.length === 2) {
        const name = parts[0].trim();
        const hex = parts[1].trim();
        // Simple validation du format hex (ex: #FF0000 ou #F00)
        if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(hex)) {
          colors.push({ name, hex });
        } else {
          logger.warn(`[parsePaletteCodeContent] Invalid hex format for color "${name}": ${hex}`);
        }
      } else {
        logger.warn(`[parsePaletteCodeContent] Invalid line format (multiple colons): ${trimmedLine}`);
      }
    } else if (trimmedLine !== '') {
      logger.warn(`[parsePaletteCodeContent] Invalid line format (does not match CSS var syntax): ${trimmedLine}`);
    }
  });
  return colors;
};
*/

// Conserver le reste du fichier s'il y a du code après la fonction supprimée
// (S'il n'y a rien après, ce commentaire sera la fin du fichier)

// ... (reste des fonctions existantes)

// ... (reste des fonctions existantes) 