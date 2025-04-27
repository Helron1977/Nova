import type { Block } from './markdownParser';
import type { InlineElement } from './markdownParser';
import type { TextInline } from './markdownParser';
import type { StrongInline } from './markdownParser';
import type { EmphasisInline } from './markdownParser';
import type { HTMLInline } from './markdownParser';
import type { LinkInline } from './markdownParser';
import type { InlineCodeElement } from './markdownParser';
import type { DeleteInline } from './markdownParser';
import type { HeadingBlock } from './markdownParser';
import type { ParagraphBlock } from './markdownParser';
import type { ListItemBlock } from './markdownParser';
import type { CodeBlock } from './markdownParser';
import type { MermaidBlock } from './markdownParser';
import type { ImageBlock } from './markdownParser';
import type { BlockquoteBlock } from './markdownParser';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import type { ThematicBreakBlock } from './markdownParser'; // Supprimé car non utilisé
import type { TableBlock } from './markdownParser';
import type { HTMLBlock } from './markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

// Helper pour sérialiser les éléments inline en Markdown
const renderInlineElementsToMarkdown = (elements: InlineElement[]): string => {
    let markdownString = '';

    elements.forEach(element => {
        switch (element.type) {
            case 'text':
                // TODO: Échapper les caractères spéciaux Markdown si nécessaire ?
                // Pour l'instant, ajout direct.
                markdownString += (element as TextInline).value;
                break;
            case 'strong':
                markdownString += `**${renderInlineElementsToMarkdown((element as StrongInline).children)}**`;
                break;
            case 'emphasis':
                markdownString += `*${renderInlineElementsToMarkdown((element as EmphasisInline).children)}*`;
                break;
            case 'inlineCode':
                markdownString += `\`${(element as InlineCodeElement).value}\``;
                break;
            case 'link':
                const link = element as LinkInline;
                const linkText = renderInlineElementsToMarkdown(link.children);
                const titlePart = link.title ? ` "${link.title}"` : '';
                markdownString += `[${linkText}](${link.url}${titlePart})`;
                break;
            case 'delete':
                markdownString += `~~${renderInlineElementsToMarkdown((element as DeleteInline).children)}~~`;
                break;
            case 'html':
                // Le HTML inline est simplement ajouté tel quel
                markdownString += (element as HTMLInline).value;
                break;
            default:
                logger.warn(`[renderInlineElementsToMarkdown] Unhandled inline element type: ${(element as any)?.type}`, { element });
                // Tentative de fallback ? Pour l'instant, on ignore.
                break;
        }
    });

    return markdownString;
};

// Fonction principale pour sérialiser les blocs
export const blocksToMarkdown = (blocks: Block[]): string => {
    let markdownOutput = '';
    let currentListNumber = 1; // Pour suivre la numérotation des listes ordonnées
    let previousListDepth = -1;
    let previousListOrdered = false;

    blocks.forEach((block, index) => {
        let blockMarkdown = '';
        let indent = '';
        if (block.type === 'listItem') {
            // Indentation des listes basée sur leur depth
            indent = '  '.repeat((block as ListItemBlock).metadata.depth);
        } else if (block.metadata?.indentationLevel && block.metadata.indentationLevel > 0) {
            // Indentation des autres blocs basée sur indentationLevel
            indent = '  '.repeat(block.metadata.indentationLevel);
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
                // Logique pour déterminer le marqueur (-, 1., etc.) et le préfixe de tâche
                let marker: string;
                if (listItem.metadata.ordered) {
                    // Mise à jour du compteur pour listes ordonnées
                    if (listItem.metadata.depth > previousListDepth || !previousListOrdered) {
                        currentListNumber = 1;
                    } else if (listItem.metadata.depth === previousListDepth) {
                        currentListNumber++;
                    }
                    // (pas de reset si depth < previousListDepth, géré implicitement)
                    marker = `${currentListNumber}.`;
                    previousListOrdered = true;
                } else {
                    marker = '-';
                    previousListOrdered = false;
                }
                previousListDepth = listItem.metadata.depth;
                
                const checkedMarker = listItem.metadata.checked === true ? '[x]' : listItem.metadata.checked === false ? '[ ]' : null;
                const taskListPrefix = checkedMarker ? `${checkedMarker} ` : '';
                
                // Construire le markdown du listItem en utilisant `indent` pré-calculé
                blockMarkdown = `${indent}${marker} ${taskListPrefix}${renderInlineElementsToMarkdown(listItem.content.children)}`;
                break; // Ne pas oublier le break

            case 'code':
                const codeBlock = block as CodeBlock;
                const lang = codeBlock.content.language || '';
                const codeLines = codeBlock.content.code.split('\n');
                blockMarkdown = `${indent}\`\`\`${lang}\n${codeLines.map(line => indent + line).join('\n')}\n${indent}\`\`\``;
                break;

            case 'blockquote':
                const quoteContent = renderInlineElementsToMarkdown((block as BlockquoteBlock).content.children);
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
                 blockMarkdown = `${indent}![${alt}](${imageBlock.content.src}${title})`;
                 break;
           
             case 'mermaid':
                 const mermaidBlock = block as MermaidBlock;
                 const mermaidLines = mermaidBlock.content.code.split('\n');
                 blockMarkdown = `${indent}\`\`\`mermaid\n${mermaidLines.map(line => indent + line).join('\n')}\n${indent}\`\`\``;
                 break;

            case 'table':
                const table = block as TableBlock;
                const { align, rows } = table.content;
                let headerRowMd = '';
                let separatorRowMd = '';
                let bodyRowsMd = '';

                if (rows.length > 0) {
                    // En-tête
                    headerRowMd = `| ${rows[0].map(cellContent => renderInlineElementsToMarkdown(cellContent).padEnd(3)).join(' | ')} |`;
                    
                    // Séparateur
                    separatorRowMd = `|${align.map(alignment => {
                        switch (alignment) {
                            case 'center': return ' :---: ';
                            case 'right':  return ' ---: ';
                            case 'left':
                            default:         return ' --- '; // padEnd(5) pour assurer largeur minimale ?
                        }
                    }).join('|')}|`;

                    // Corps
                    bodyRowsMd = rows.slice(1).map(row => 
                        `| ${row.map(cellContent => renderInlineElementsToMarkdown(cellContent).padEnd(3)).join(' | ')} |`
                    ).join('\n');
                }

                blockMarkdown = `${headerRowMd}\n${separatorRowMd}${rows.length > 1 ? '\n' + bodyRowsMd : ''}`;
                 // Réinitialiser l'état de la liste après une table
                 previousListDepth = -1;
                 previousListOrdered = false;
                break;

            default:
                logger.warn(`[blocksToMarkdown] Unhandled block type: ${(block as any)?.type}`, { block });
                blockMarkdown = `${indent}<!-- Unhandled block type: ${(block as any)?.type} -->`;
                // Réinitialiser l'état de la liste après un bloc inconnu
                previousListDepth = -1;
                previousListOrdered = false;
                break;
        }
        
        // Gérer les sauts de ligne (Logique révisée)
        if (index > 0) {
            const prevBlock = blocks[index - 1];
            // Ajouter deux sauts de ligne par défaut
            markdownOutput += '\n\n'; 

            // Exception: Si le bloc actuel ET le précédent sont des listItems
            // ET le bloc actuel n'est PAS moins indenté (il continue ou s'enfonce)
            // alors on retire un saut de ligne (pour n'en laisser qu'un seul)
            if (block.type === 'listItem' && prevBlock.type === 'listItem') {
                const currentDepth = (block as ListItemBlock).metadata.depth;
                const prevDepth = (prevBlock as ListItemBlock).metadata.depth;
                if (currentDepth >= prevDepth) {
                    markdownOutput = markdownOutput.slice(0, -1); // Retire le dernier \n
                    // Cas spécial: si on change de type de liste (ordonné/non ordonné) au même niveau,
                    // certains parseurs aiment quand même un saut de ligne double.
                    // Pour l'instant, on garde simple: un seul saut si même niveau ou plus profond.
                }
            }
        }

        markdownOutput += blockMarkdown;
    });

    return markdownOutput.trim(); 
}; 