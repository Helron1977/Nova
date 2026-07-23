import { Block, InlineElement, TextInline, StrongInline, EmphasisInline, LinkInline, InlineCodeElement, DeleteInline, HTMLInline } from './markdownParser';
import { getBlockModuleByType, getBlockModules } from './blockRegistry';
import { PinoLogger } from '../../infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

export type ASTNodeType = 
  | 'root'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'listItem'
  | 'code'
  | 'image'
  | 'blockquote'
  | 'table'
  | 'thematicBreak'
  | 'mermaid'
  | 'bookmark'
  | 'dropZone'
  | string; // Pour les blocs customisés

export interface ASTMetadata {
  id: string; // The original UUID from state.blocks
  indentationLevel?: number;
  layoutWidth?: 'full' | 'half' | 'third' | 'quarter';
  [key: string]: any;
}

export interface BaseASTNode {
  type: ASTNodeType;
  metadata: ASTMetadata;
  children?: ASTNode[];
  plainText?: string; 
  contentSummary?: string; 
  [key: string]: any; // Pour les champs dynamiques renvoyés par les modules
}

export interface HeadingASTNode extends BaseASTNode {
  type: 'heading';
  level: number;
}

export interface ASTRootNode {
  type: 'root';
  children: ASTNode[];
}

export type ASTNode = BaseASTNode | HeadingASTNode;

// Interfaces pour le type de retour AST
export interface NovaASTNode {
  id: string;
  type: string;
  contentSummary?: string;
  children?: NovaASTNode[];
}

/**
 * Indique si le contenu d'un bloc est considéré comme trop volumineux
 * et sera élidé (statut="omitted") dans la vue fournie à l'IA.
 * Utile pour empêcher l'IA d'écraser un bloc dont elle n'a pas vu le contenu réel.
 */
export function isBlockOmitted(block: Block): boolean {
  if (!block.rawMarkdown) return false;
  const isCode = block.type === 'code';
  const isMermaid = isCode && (block as any).content?.language === 'mermaid';
  
  if (isMermaid && block.rawMarkdown.length > 20000) return true;
  if (isCode && !isMermaid && block.rawMarkdown.length > 2000) return true;
  
  return false;
}

/**
 * Extrait le texte brut d'un tableau d'InlineElements.
 */
function extractPlainText(elements: InlineElement[] | undefined): string {
  if (!elements) return '';
  return elements.map(element => {
    switch (element.type) {
      case 'text': return (element as TextInline).value;
      case 'strong': return extractPlainText((element as StrongInline).children);
      case 'emphasis': return extractPlainText((element as EmphasisInline).children);
      case 'inlineCode': return (element as InlineCodeElement).value;
      case 'link': return extractPlainText((element as LinkInline).children);
      case 'delete': return extractPlainText((element as DeleteInline).children);
      case 'html': return (element as HTMLInline).value;
      default: return '';
    }
  }).join('');
}

/**
 * Convertit un bloc Nova en un noeud AST allégé pour le LLM.
 */
function convertBlockToASTNode(block: Block): ASTNode {
  const metadata: ASTMetadata = {
    id: block.id,
    indentationLevel: block.metadata?.indentationLevel,
    layoutWidth: block.metadata?.layoutWidth,
  };

  // 1. Vérifier si un module personnalisé gère ce type de bloc et fournit getAIASTNode
  const module = getBlockModuleByType(block.type);
  if (module && module.getAIASTNode) {
    const customASTData = module.getAIASTNode(block);
    return {
      ...customASTData, // type, dimensions, contentSummary, etc.
      metadata,
    } as ASTNode;
  }

  // 2. Fallback générique pour les blocs standards
  const baseNode: BaseASTNode = {
    type: block.type,
    metadata,
  };

  switch (block.type) {
    case 'heading':
      return {
        ...baseNode,
        type: 'heading',
        level: (block as any).content.level,
        plainText: extractPlainText((block as any).content.children),
      } as HeadingASTNode;

    case 'paragraph':
    case 'blockquote':
    case 'listItem':
      baseNode.plainText = block.rawMarkdown || extractPlainText((block as any).content.children);
      break;

    case 'code':
      baseNode.language = (block as any).content.language;
      baseNode.plainText = (block as any).content.code; // Garder le code source (sauf si trop long, à voir plus tard)
      if (baseNode.plainText && baseNode.plainText.length > 2000) {
          baseNode.contentSummary = `[CODE OMITTED - VERY LONG (${baseNode.plainText.length} chars)]`;
          delete baseNode.plainText;
      }
      break;

    case 'mermaid':
      baseNode.plainText = (block as any).content.code;
      if (baseNode.plainText && baseNode.plainText.length > 20000) {
          baseNode.contentSummary = `[MERMAID_CODE_OMITTED - VERY LONG (${baseNode.plainText.length} chars)]`;
          delete baseNode.plainText;
      }
      break;

    case 'image':
      baseNode.url = (block as any).content.url;
      baseNode.alt = (block as any).content.alt;
      break;
      
    case 'bookmark':
      baseNode.url = (block as any).content.url;
      break;

    case 'table':
      if (block.rawMarkdown) {
        baseNode.plainText = block.rawMarkdown;
      } else {
        const tableData = (block as any).content.rows;
        if (Array.isArray(tableData)) {
            baseNode.plainText = tableData.map((row: any[]) => 
                row.map(cell => extractPlainText(cell)).join(' | ')
            ).join('\n');
        }
      }
      break;

    default:
      // Block non géré spécifiquement, on garde juste le type et metadata
      break;
  }

  return baseNode;
}

/**
 * Fonction cible : Convertit state.blocks (array linéaire) en ASTRootNode (arbre hiérarchique)
 * en tenant compte des niveaux de titres.
 */
export function buildAST(blocks: Block[]): ASTRootNode {
  logger.debug(`[astGenerator] Building AST from ${blocks.length} blocks`);
  
  const root: ASTRootNode = { type: 'root', children: [] };
  // Pile pour gérer la hiérarchie des Headings
  const headingStack: { node: HeadingASTNode | ASTRootNode; level: number }[] = [
    { node: root, level: 0 }
  ];

  for (const block of blocks) {
    const astNode = convertBlockToASTNode(block);

    if (astNode.type === 'heading') {
      const headingNode = astNode as HeadingASTNode;
      const currentLevel = headingNode.level;

      // Remonter la pile jusqu'à trouver un parent de niveau strictement inférieur
      // (root a le niveau 0, donc H1 (level 1) sera enfant de root)
      while (
        headingStack.length > 1 && 
        headingStack[headingStack.length - 1].level >= currentLevel
      ) {
        headingStack.pop();
      }

      const parent = headingStack[headingStack.length - 1].node;
      if (!parent.children) parent.children = [];
      parent.children.push(headingNode);

      headingStack.push({ node: headingNode, level: currentLevel });
    } else {
      // Les blocs non-titres sont enfants du titre courant
      const parent = headingStack[headingStack.length - 1].node;
      if (!parent.children) parent.children = [];
      parent.children.push(astNode);
    }
  }

  logger.debug(`[astGenerator] AST built successfully`, { rootChildrenCount: root.children.length });
  return root;
}

/**
 * Sérialise l'AST en un format XML/Texte extrêmement compact et sémantique pour le contexte LLM.
 * Expose l'ID des blocs pour permettre à l'IA de lancer des commandes de modification ciblées.
 */
export function serializeASTToLLMContext(node: ASTNode | ASTRootNode, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  
  if (node.type === 'root') {
    const rootNode = node as ASTRootNode;
    return `<nova-document>\n${rootNode.children.map(child => serializeASTToLLMContext(child, depth + 1)).join('\n')}\n</nova-document>`;
  }

  const baseNode = node as BaseASTNode;
  const idAttr = baseNode.metadata?.id ? ` id="${baseNode.metadata.id}"` : '';
  
  let xml = '';

  switch (node.type) {
    case 'heading':
      const hNode = node as HeadingASTNode;
      // On wrap les enfants du heading (qui sont sémantiquement dans la même section) à l'intérieur d'une balise <section>
      xml = `${indent}<section level="${hNode.level}">\n`;
      xml += `${indent}  <heading${idAttr} level="${hNode.level}">${hNode.plainText || ''}</heading>\n`;
      if (hNode.children && hNode.children.length > 0) {
        xml += hNode.children.map(child => serializeASTToLLMContext(child, depth + 1)).join('\n') + '\n';
      }
      xml += `${indent}</section>`;
      break;

    case 'paragraph':
    case 'blockquote':
    case 'listItem':
      xml = `${indent}<${node.type}${idAttr}>${baseNode.plainText || ''}</${node.type}>`;
      break;

    case 'code':
    case 'mermaid':
      const langAttr = baseNode.language ? ` language="${baseNode.language}"` : '';
      if (baseNode.contentSummary) {
        xml = `${indent}<${node.type}${idAttr}${langAttr} status="omitted">${baseNode.contentSummary}</${node.type}>`;
      } else {
        xml = `${indent}<${node.type}${idAttr}${langAttr}>${baseNode.plainText || ''}</${node.type}>`;
      }
      break;

    case 'table':
    case 'csvTableBlock':
      xml = `${indent}<${node.type}${idAttr}>\n${indent}  ${(baseNode.plainText || baseNode.contentSummary || '').replace(/\n/g, `\n${indent}  `)}\n${indent}</${node.type}>`;
      break;

    case 'drawingBlock':
    case 'mapBlock':
      const dimAttr = baseNode.dimensions ? ` width="${baseNode.dimensions.width}" height="${baseNode.dimensions.height}"` : '';
      xml = `${indent}<${node.type}${idAttr}${dimAttr} status="omitted_for_context" />`;
      break;

    case 'paletteBlock':
      const colors = (baseNode as any).colorsPreview ? ` colors="${(baseNode as any).colorsPreview.join(', ')}"` : '';
      xml = `${indent}<paletteBlock${idAttr}${colors} />`;
      break;

    case 'ai-message':
      // Ne rien faire : ce bloc n'existe pas dans le contexte LLM pour éviter la pollution
      return '';

    default:
      if (baseNode.plainText) {
        xml = `${indent}<${node.type}${idAttr}>${baseNode.plainText}</${node.type}>`;
      } else if (baseNode.contentSummary) {
        xml = `${indent}<${node.type}${idAttr} status="omitted">${baseNode.contentSummary}</${node.type}>`;
      } else {
        xml = `${indent}<${node.type}${idAttr} />`;
      }
      break;
  }

  // S'il y a des enfants et que ce n'est pas un heading (géré au dessus)
  if (node.type !== 'heading' && baseNode.children && baseNode.children.length > 0) {
     const childrenXml = baseNode.children.map(child => serializeASTToLLMContext(child, depth + 1)).join('\n');
     // Injecter les enfants avant la balise fermante si possible, sinon on les ajoute bêtement à la suite.
     // Pour un XML parfait il faudrait restructurer, mais l'IA comprend l'indentation.
     xml += `\n${childrenXml}`;
  }

  return xml;
}

/**
 * Agrège toutes les instructions système (AIPrompt) fournies par les différents BlockModules.
 * Cela permet à l'IA d'avoir un mode d'emploi spécifique pour manipuler des blocs personnalisés.
 */
export function generateLLMSystemInstructions(): string {
  const modules = getBlockModules();
  const prompts = modules
    .map(m => m.getAIPrompt ? m.getAIPrompt() : null)
    .filter(p => p !== null);

  if (prompts.length === 0) return '';

  return `<system-instructions>\n${prompts.join('\n\n')}\n</system-instructions>`;
}

/**
 * Traverse l'AST et retourne les IDs de tous les blocs qui ont été marqués
 * comme 'omitted' (par ex. code trop long).
 */
export function getOmittedBlockIds(node: ASTNode | ASTRootNode): string[] {
  const ids: string[] = [];
  
  if (node.type !== 'root' && node.type !== 'heading') {
    const baseNode = node as BaseASTNode;
    if (baseNode.contentSummary && !baseNode.plainText && baseNode.metadata?.id) {
      ids.push(baseNode.metadata.id);
    }
  }

  const children = (node as any).children as ASTNode[];
  if (children && children.length > 0) {
    for (const child of children) {
      ids.push(...getOmittedBlockIds(child));
    }
  }

  return ids;
}
