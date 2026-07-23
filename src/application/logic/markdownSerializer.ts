import type { Block, ListItemBlock, CodeBlock, MermaidBlock, ImageBlock, BlockquoteBlock, TableBlock, HTMLBlock, HeadingBlock, ParagraphBlock, InlineElement, TextInline, StrongInline, EmphasisInline, HTMLInline, LinkInline, InlineCodeElement, DeleteInline } from './markdownParser';
import { serializeListItemToMarkdown } from './markdownParser'; // Correction: Importé comme valeur
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import type { ThematicBreakBlock } from './markdownParser'; // Supprimé car non utilisé
import { PinoLogger } from '../../infrastructure/logging/PinoLogger';
import type { BlockModule } from '../interfaces/blockModule';

// AJOUT: Importer les types et fonctions nécessaires pour les modules
import { getBlockModuleByType } from './blockRegistry';

const logger = new PinoLogger();

// Helper pour sérialiser les éléments inline en Markdown (style fonctionnel)
const renderInlineElementsToMarkdown = (elements: InlineElement[]): string => {
    return elements
      .map(element => {
        switch (element.type) {
            case 'text':
                return (element as TextInline).value.replace(/\\n/g, '\n');
            case 'strong':
                return `**${renderInlineElementsToMarkdown((element as StrongInline).children)}**`;
            case 'emphasis':
                return `*${renderInlineElementsToMarkdown((element as EmphasisInline).children)}*`;
            case 'inlineCode':
                return `\`${(element as InlineCodeElement).value}\``;
            case 'link':
                const link = element as LinkInline;
                const linkText = renderInlineElementsToMarkdown(link.children);
                const titlePart = link.title ? ` \"${link.title}\"` : '';
                return `[${linkText}](${link.url}${titlePart})`; 
            case 'delete':
                return `~~${renderInlineElementsToMarkdown((element as DeleteInline).children)}~~`;
            case 'html':
                return (element as HTMLInline).value;
            default:
                logger.warn(`[renderInlineElementsToMarkdown] Unhandled inline element type: ${(element as any)?.type}`, { element });
                return ''; 
        }
    }).join('');
};

// Fonction principale pour sérialiser les blocs
export const blocksToMarkdown = (blocks: Block[]): string => {
    logger.debug(`[blocksToMarkdown] Starting serialization for ${blocks.length} blocks.`);
    let markdownOutput = '';
    let currentListNumber = 1;
    let previousListDepth = -1;
    let previousListOrdered = false;

    blocks.forEach((block, index) => {
        let blockMarkdown = '';
        let indent = '';
        const blockMetadata = block.metadata as any; // Pour un accès plus simple
        if (block.type === 'listItem') {
            // Pour les listes, l'indentation est basée sur la profondeur (depth)
            indent = '    '.repeat(blockMetadata.depth ?? 0); // Utiliser 4 espaces par niveau de profondeur
        } else if (blockMetadata?.indentationLevel && blockMetadata.indentationLevel > 0) {
            // Pour les autres blocs, utiliser indentationLevel s'il existe
            indent = '  '.repeat(blockMetadata.indentationLevel);
        }

        const customBlockType = blockMetadata?.customBlockType;
        const originalLanguage = blockMetadata?.originalLanguage;

        if (customBlockType && originalLanguage) {
            const module = getBlockModuleByType(customBlockType) as BlockModule<any> | undefined;
            if (module && module.serializeContent) {
                if ((block as any).type === 'ai-message') return ''; // Ignore ghost block
                const customContent = module.serializeContent((block.content as any).customBlockData);
                if (customContent) {
                    const language = (module as any).codeBlockLanguage || originalLanguage;
                    blockMarkdown = `${indent}\`\`\`${language}\n${customContent}\n${indent}\`\`\``;
                    if (index > 0) {
                        markdownOutput += '\n\n';
                    }
                    markdownOutput += blockMarkdown;
                    previousListDepth = -1;
                    previousListOrdered = false;
                    return;
                }
            }
        }

        switch (block.type) {
            case 'heading':
                const heading = block as HeadingBlock;
                blockMarkdown = `${indent}${'#'.repeat(heading.content.level)} ${renderInlineElementsToMarkdown(heading.content.children)}`;
                break;

            case 'paragraph':
                blockMarkdown = `${indent}${renderInlineElementsToMarkdown((block as ParagraphBlock).content.children)}`;
                break;

            case 'listItem':
                const listItem = block as ListItemBlock;
                const currentItemDepth = listItem.metadata.depth ?? 0;
                // La fonction serializeListItemToMarkdown s'occupe du style de puce/checkbox et du contenu.
                // Mais pour les listes ordonnées, nous devons gérer le numéro d'item ici.
                const serializedItemBase = serializeListItemToMarkdown(listItem); // Ex: "1. [ ] Texte" ou "- Texte"

                if (listItem.metadata.ordered) {
                    // Réinitialiser le compteur si la profondeur change ou si on passe d'une liste non ordonnée à ordonnée
                    if (currentItemDepth > previousListDepth || !previousListOrdered || currentItemDepth < previousListDepth) {
                        currentListNumber = 1;
                    }
                    // Extraire le contenu après le marqueur "1. " (ou ce que serializeListItemToMarkdown produit pour un item ordonné)
                    // Ceci est un peu fragile si serializeListItemToMarkdown change son format exact pour "1. "
                    let contentPart = serializedItemBase;
                    if (serializedItemBase.startsWith('1. ')) {
                        contentPart = serializedItemBase.substring(3); // Enlève "1. "
                    } else if (serializedItemBase.startsWith('1.')) { // Au cas où il n'y aurait pas d'espace
                         contentPart = serializedItemBase.substring(2); // Enlève "1."
                    }
                    
                    blockMarkdown = `${indent}${currentListNumber}. ${contentPart}`;
                    currentListNumber++; // Incrémenter pour le prochain item ordonné au même niveau
                    previousListOrdered = true;
                } else {
                    blockMarkdown = `${indent}${serializedItemBase}`;
                    previousListOrdered = false; // Marquer que la dernière liste rencontrée n'était pas ordonnée
                }
                previousListDepth = currentItemDepth;
                break;

            case 'code':
                const codeBlock = block as CodeBlock;
                const lang = codeBlock.content.language || '';
                const codeLines = codeBlock.content.code.split('\n');
                blockMarkdown = `${indent}\`\`\`${lang}\n${codeLines.map(line => indent + line).join('\n')}\n${indent}\`\`\``;
                break;

            case 'blockquote':
                const quoteContent = renderInlineElementsToMarkdown((block as BlockquoteBlock).content.children);
                // Appliquer l'indentation à chaque ligne de la citation
                blockMarkdown = quoteContent.split('\n').map(line => `${indent}> ${line}`).join('\n');
                break;

            case 'thematicBreak':
                blockMarkdown = `${indent}***`;
                break;

            case 'html':
                const htmlLines = (block as HTMLBlock).content.html.split('\n');
                blockMarkdown = htmlLines.map(line => indent + line).join('\n');
                break;
                
            case 'image':
                 const imageBlock = block as ImageBlock;
                 const alt = imageBlock.content.alt || '';
                 const title = imageBlock.content.title ? ` "${imageBlock.content.title}"` : '';
                 blockMarkdown = `${indent}![${alt}](${imageBlock.content.url}${title})`;
                 break;
           
             case 'mermaid':
                 const mermaidBlock = block as MermaidBlock;
                 const mermaidLines = mermaidBlock.content.code.split('\n');
                 blockMarkdown = `${indent}\`\`\`mermaid\n${mermaidLines.map(line => indent + line).join('\n')}\n${indent}\`\`\``;
                 logger.debug(`[blocksToMarkdown] Serialized MermaidBlock ID ${mermaidBlock.id}`);
                 break;

            case 'table':
                const table = block as TableBlock;
                const { align, rows } = table.content;
                let headerRowMd = '';
                let separatorRowMd = '';
                let bodyRowsMd = '';
                if (rows.length > 0) {
                    headerRowMd = `| ${rows[0].map(cellContent => renderInlineElementsToMarkdown(cellContent).padEnd(3)).join(' | ')} |`;
                    separatorRowMd = `|${align.map(alignment => {
                        switch (alignment) {
                            case 'center': return ' :---: ';
                            case 'right':  return ' ---: ';
                            case 'left': default: return ' --- ';
                        }
                    }).join('|')}|`;
                    bodyRowsMd = rows.slice(1).map(row => 
                        `| ${row.map(cellContent => renderInlineElementsToMarkdown(cellContent).padEnd(3)).join(' | ')} |`
                    ).join('\n');
                }
                const tableLines: string[] = [];
                if (headerRowMd) {
                    tableLines.push(`${indent}${headerRowMd}`);
                    tableLines.push(`${indent}${separatorRowMd}`);
                    if (bodyRowsMd) {
                        tableLines.push(...bodyRowsMd.split('\n').map(line => `${indent}${line}`)); 
                    }
                }
                blockMarkdown = tableLines.join('\n');
                previousListDepth = -1;
                previousListOrdered = false;
                break;

            default:
                logger.warn(`[blocksToMarkdown] Unhandled block type in switch: ${(block as any)?.type}`, { block });
                blockMarkdown = `${indent}<!-- Unhandled block type in switch: ${(block as any)?.type} -->`;
                previousListDepth = -1;
                previousListOrdered = false;
                break;
        }
        
        if (index > 0) {
            const prevBlock = blocks[index - 1];
            markdownOutput += '\n\n'; 
            if (block.type === 'listItem' && prevBlock.type === 'listItem') {
                const currentDepth = (block as ListItemBlock).metadata.depth ?? 0;
                const prevDepth = (prevBlock as ListItemBlock).metadata.depth ?? 0;
                if (currentDepth >= prevDepth) {
                    markdownOutput = markdownOutput.slice(0, -1);
                }
            }
        }
        markdownOutput += blockMarkdown;

        // Ajout des métadonnées de mise en page (layoutWidth) en commentaire HTML juste après le bloc
        if (blockMetadata?.layoutWidth && blockMetadata.layoutWidth !== 'full') {
            markdownOutput += `\n<!-- layout: ${blockMetadata.layoutWidth} -->`;
        }
    });

    logger.debug("[blocksToMarkdown] Serialization finished.");
    return markdownOutput;
};

// AJOUT: Fonction pour convertir un nombre en chiffres romains (simpliste)
/* function toRoman(num: number): string {
    if (num < 1 || num > 3999) return num.toString(); // Gestion simple des limites
    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let str = '';
    for (const i of Object.keys(roman) as Array<keyof typeof roman>) {
        const q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
    }
    return str;
}  */