import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit} from 'unist-util-visit';
import { v4 as uuidv4 } from 'uuid';
import type { Position, Node, Parent } from 'unist'; // Conserver Position de unist, ajouter Node et Parent
import type { Root, Content, List, ListItem, Text, HTML } from 'mdast'; // Utiliser mdast pour Root et Content, ajouter List et ListItem, et ajouter Text, Strong, Emphasis, HTML
import { PinoLogger } from '@/infrastructure/logging/PinoLogger'; // Importer le logger

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


// --- Définitions des Types de Blocs ---

// Interface de base
interface BaseBlock {
  id: string;
  type: string;
  metadata?: {
    position?: Position;
    [key: string]: any;
  };
  content: any; // Typé spécifiquement dans chaque bloc
}

// Blocs spécifiques
// Export nécessaire pour chaque type utilisé dans les renderers
export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  content: { level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineElement[] };
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: { children: InlineElement[] };
}

export interface ListItemBlock extends BaseBlock {
  type: 'listItem';
  content: { children: InlineElement[] };
  metadata: {
    depth: number;
    ordered: boolean;
    checked?: boolean | null;
    markerStyle?: MarkerStyle;
    position?: Position;
  };
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  content: { language?: string; code: string };
}

export interface MermaidBlock extends BaseBlock {
  type: 'mermaid';
  content: { code: string };
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  content: { src: string; alt?: string; title?: string };
}

export interface BlockquoteBlock extends BaseBlock {
  type: 'blockquote';
  content: { children: InlineElement[] };
}

export interface ThematicBreakBlock extends BaseBlock {
  type: 'thematicBreak';
  content: {};
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  content: {
    align: (('left' | 'right' | 'center') | null)[];
    rows: InlineElement[][][];
  };
}

export interface HTMLBlock extends BaseBlock {
  type: 'html';
  content: { html: string };
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
  | HTMLBlock;

// << AJOUT: Export du type pour les styles de marqueurs >>
export type MarkerStyle = 'bullet' | 'decimal' | 'lower-alpha' | 'lower-roman';

// --- Fonction de Parsing ---

// Nouvelle fonction pour extraire le contenu inline structuré
const extractInlineContent = (node: Parent | Node): InlineElement[] => {
   const inlineElements: InlineElement[] = [];

   // Vérifier si le noeud a des enfants à traiter
   if (!('children' in node) || !Array.isArray(node.children)) {
        // Gérer les cas où le noeud lui-même est un élément inline simple
        if(node.type === 'text') {
             return [{ type: 'text', value: (node as Text).value }];
        }
        if(node.type === 'html') {
             return [{ type: 'html', value: (node as HTML).value }];
        }
       // Si le noeud n'a pas d'enfants et n'est pas un inline simple, retourner vide.
       // console.warn("[extractInlineContent] Node has no children array or is not simple inline:", node);
       return []; 
   }

   // Parcourir les enfants directs du noeud
   node.children.forEach((child: Content | Node) => {
       switch (child.type) {
           case 'text':
               inlineElements.push({ type: 'text', value: (child as Text).value });
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

           // TODO: Ajouter d'autres types INLINE ici (image...)

           // IGNORER les types de bloc ou non-inline trouvés ici.
           // Ne PAS essayer d'extraire leur texte via le fallback.
           case 'paragraph':
           case 'list':
           case 'listItem':
           case 'heading':
           case 'code':
           case 'blockquote':
           case 'thematicBreak':
           case 'table':
           // etc.
                break; // Ignorer simplement

           default:
               // Utiliser logger.info ou logger.debug pour les types sautés
               logger.debug(`[extractInlineContent] Skipping unhandled/unknown inline node type: ${child.type}`, { node: child });
               break;
       }
   });

   return inlineElements;
};

export const markdownToBlocks = (markdown: string): Block[] => {
  const blocks: Block[] = [];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);
  const ast = processor.parse(markdown) as Root;

  const parseListAndItems = (listNode: List, currentDepth: number) => {
    listNode.children.forEach((itemNode: Content) => {
        // Le noeud listItem peut contenir des paragraphes, etc.
        // On doit extraire les enfants inline du *premier* paragraphe ou du contenu direct.
        if (itemNode.type === 'listItem') {
            let contentSourceNode: Parent | Node = itemNode; // Par défaut, chercher dans l'item

            // Un listItem contient souvent un ou plusieurs paragraphes.
            // On prend le contenu du premier paragraphe s'il existe.
            // S'il y a plusieurs paragraphes ou d'autres blocs, on ne prend que le premier pour l'instant.
            if (itemNode.children?.length > 0 && itemNode.children[0].type === 'paragraph') {
                contentSourceNode = itemNode.children[0];
            }
            
            // Extraire les enfants inline de la source déterminée
            const children = extractInlineContent(contentSourceNode as Parent);
            
            const listItemBlock: ListItemBlock = {
                id: uuidv4(),
                type: 'listItem',
                content: { children }, 
                metadata: {
                    depth: currentDepth,
                    ordered: listNode.ordered ?? false,
                    checked: (itemNode as ListItem).checked,
                    position: itemNode.position,
                }
            };
            blocks.push(listItemBlock);

            // Chercher une sous-liste DANS l'itemNode original (pas contentSourceNode)
            const nestedList = itemNode.children.find(child => child.type === 'list') as List | undefined;
            if (nestedList) {
                parseListAndItems(nestedList, currentDepth + 1);
            }
        }
    });
  };

  ast.children.forEach((node: Content) => {
    const baseBlockData = {
      id: uuidv4(),
      metadata: { position: node.position },
    };

    switch (node.type) {
       case 'heading':
         blocks.push({ 
             ...baseBlockData, 
             type: 'heading', 
             content: { 
                 level: (node as any).depth, 
                 children: extractInlineContent(node as Parent)
             } 
         } as HeadingBlock);
         break;
       case 'paragraph':
          // La logique pour séparer image vs paragraphe normal reste pertinente
          if ((node as Parent).children.length === 1 && (node as Parent).children[0].type === 'image') {
              const imageNode = (node as any).children[0];
              const imageBlock = {
                  ...baseBlockData,
                  metadata: { position: imageNode.position },
                  type: 'image',
                  content: {
                      src: imageNode.url,
                      alt: imageNode.alt ?? undefined,
                      title: imageNode.title ?? undefined,
                  },
              } as ImageBlock;
              blocks.push(imageBlock);
          } else {
              blocks.push({ 
                  ...baseBlockData, 
                  type: 'paragraph', 
                  content: { children: extractInlineContent(node as Parent) }
              } as ParagraphBlock);
          }
          break;
       case 'code':
          if ((node as any).lang === 'mermaid') {
             const mermaidBlock = {
               ...baseBlockData,
               type: 'mermaid',
               content: { code: (node as any).value },
             } as MermaidBlock;
             blocks.push(mermaidBlock);
           } else {
             const codeBlock = {
               ...baseBlockData,
               type: 'code',
               content: { language: (node as any).lang ?? undefined, code: (node as any).value },
             } as CodeBlock;
             blocks.push(codeBlock);
           }
          break;
      case 'list':
        parseListAndItems(node, 0);
        break;
      case 'blockquote':
         // Un blockquote contient d'autres blocs (souvent des paragraphes).
         // Nous devons extraire le contenu inline de CHACUN de ces blocs enfants
         // et les concaténer.
         let blockquoteChildren: InlineElement[] = [];
         if ('children' in node && Array.isArray(node.children)) {
             node.children.forEach((blockquoteChild: Content | Node) => {
                 // Appeler extractInlineContent sur chaque enfant du blockquote
                 const inlineContentFromChild = extractInlineContent(blockquoteChild as Parent);
                 blockquoteChildren = blockquoteChildren.concat(inlineContentFromChild);
                 
                 // Optionnel : Ajouter un espace ou un marqueur entre les paragraphes originaux?
                 // Pour l'instant, on concatène directement.
                 // Si on voulait préserver la séparation des paragraphes, il faudrait 
                 // peut-être que BlockquoteBlock contienne un tableau de Block[] au lieu d'InlineElement[]
             });
         }

         blocks.push({ 
             ...baseBlockData, 
             type: 'blockquote', 
             // Utiliser le tableau concaténé
             content: { children: blockquoteChildren } 
         } as BlockquoteBlock);
         break;
      case 'thematicBreak':
        const breakBlock = {
          ...baseBlockData,
          type: 'thematicBreak',
          content: {},
        } as ThematicBreakBlock;
        blocks.push(breakBlock);
        break;
      case 'table':
         const align = (node as any).align ?? [];
         const rows: InlineElement[][][] = []; 
         visit(node, 'tableRow', (rowNode: Parent) => {
             const cellsDataForThisRow: InlineElement[][] = []; 
             visit(rowNode, 'tableCell', (cellNode: Parent) => {
                 // CIBLER LE CONTENU DE LA CELLULE CORRECTEMENT
                 let contentSourceNode: Parent | Node = cellNode;
                 // Vérifier si le premier enfant de la cellule est un paragraphe
                 if (cellNode.children?.length > 0 && cellNode.children[0].type === 'paragraph') {
                    contentSourceNode = cellNode.children[0];
                 }
                 // Extraire les éléments inline de la source déterminée
                 const cellContent: InlineElement[] = extractInlineContent(contentSourceNode as Parent);
                 cellsDataForThisRow.push(cellContent);
             });
             rows.push(cellsDataForThisRow);
         });
         const tableBlock = {
             ...baseBlockData,
             type: 'table',
             content: { align, rows },
         } as TableBlock;
         blocks.push(tableBlock);
         break;
       case 'html':
         const htmlBlock = {
             ...baseBlockData,
             type: 'html',
             content: { html: (node as any).value },
         } as HTMLBlock;
         blocks.push(htmlBlock);
         break;

      default:
        break;
    }
  });

  return blocks;
};