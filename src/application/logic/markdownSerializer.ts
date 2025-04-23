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
    let previousBlockType: string | null = null;
    let currentListNumber = 1; // Pour suivre la numérotation des listes ordonnées
    let previousListDepth = -1;
    let previousListOrdered = false;

    blocks.forEach((block, index) => {
        let blockMarkdown = '';
        let needsExtraNewline = true; // Par défaut, on ajoute un double saut de ligne
        let isListItem = false;

        switch (block.type) {
            case 'heading':
                const heading = block as HeadingBlock;
                blockMarkdown = `${'#'.repeat(heading.content.level)} ${renderInlineElementsToMarkdown(heading.content.children)}`;
                needsExtraNewline = true;
                break;

            case 'paragraph':
                blockMarkdown = renderInlineElementsToMarkdown((block as ParagraphBlock).content.children);
                needsExtraNewline = true;
                break;

            case 'listItem':
                const listItem = block as ListItemBlock;
                const depth = listItem.metadata.depth;
                const indent = '  '.repeat(depth);
                isListItem = true;

                // Gérer la numérotation des listes ordonnées
                if (listItem.metadata.ordered) {
                    if (depth > previousListDepth || !previousListOrdered) {
                        currentListNumber = 1; // Nouvelle liste ou sous-liste ordonnée
                    } else if (depth === previousListDepth) {
                        currentListNumber++; // Item suivant au même niveau
                    }
                    // Si depth < previousListDepth, on ne réinitialise pas ici,
                    // la logique de réinitialisation se fait implicitement quand on remonte
                }
                const marker = listItem.metadata.ordered ? `${currentListNumber}.` : '-';
                previousListDepth = depth;
                previousListOrdered = listItem.metadata.ordered;

                const checkedMarker = listItem.metadata.checked === true ? '[x]' : listItem.metadata.checked === false ? '[ ]' : null;
                const taskListPrefix = checkedMarker ? `${checkedMarker} ` : '';
                
                blockMarkdown = `${indent}${marker} ${taskListPrefix}${renderInlineElementsToMarkdown(listItem.content.children)}`;
                needsExtraNewline = false; // Pas de double saut entre items
                break;

            case 'code':
                const codeBlock = block as CodeBlock;
                const lang = codeBlock.content.language || '';
                blockMarkdown = `\`\`\`${lang}\n${codeBlock.content.code}\n\`\`\``;
                needsExtraNewline = true;
                break;

            case 'blockquote':
                // Ajouter > à chaque ligne ? Ou juste au début ?
                // remark ajoute > au début de chaque ligne générée par le contenu interne.
                // Simplifions pour l'instant : ajouter > au début du contenu rendu.
                const quoteContent = renderInlineElementsToMarkdown((block as BlockquoteBlock).content.children);
                // Gérer les sauts de ligne dans la citation
                blockMarkdown = quoteContent.split('\n').map(line => `> ${line}`).join('\n');
                needsExtraNewline = true;
                break;

            case 'thematicBreak':
                blockMarkdown = '***';
                needsExtraNewline = true;
                break;

            case 'html':
                blockMarkdown = (block as HTMLBlock).content.html;
                needsExtraNewline = true;
                break;
                
            case 'image':
                 const imageBlock = block as ImageBlock;
                 const alt = imageBlock.content.alt || '';
                 const title = imageBlock.content.title ? ` "${imageBlock.content.title}"` : '';
                 blockMarkdown = `![${alt}](${imageBlock.content.src}${title})`;
                 needsExtraNewline = true;
                 break;
           
             case 'mermaid':
                 const mermaidBlock = block as MermaidBlock;
                 blockMarkdown = `\`\`\`mermaid\n${mermaidBlock.content.code}\n\`\`\``;
                 needsExtraNewline = true;
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
                needsExtraNewline = true;
                 // Réinitialiser l'état de la liste après une table
                 previousListDepth = -1;
                 previousListOrdered = false;
                break;

            default:
                logger.warn(`[blocksToMarkdown] Unhandled block type: ${(block as any)?.type}`, { block });
                blockMarkdown = `<!-- Unhandled block type: ${(block as any)?.type} -->`;
                needsExtraNewline = true;
                // Réinitialiser l'état de la liste après un bloc inconnu
                previousListDepth = -1;
                previousListOrdered = false;
                break;
        }
        
        // Gérer les sauts de ligne
        if (index > 0) {
             // Toujours au moins un saut de ligne entre les blocs
             markdownOutput += '\n'; 
             // Ajouter un deuxième saut de ligne si nécessaire (avant bloc non-listItem ou rupture de liste)
            if (needsExtraNewline && (!isListItem || !previousBlockType || previousBlockType !== 'listItem')) {                 markdownOutput += '\n'; 
            }
        }
        
        // Si ce n'est pas un listItem, réinitialiser l'état de la liste pour le prochain bloc
        if (!isListItem) {
             previousListDepth = -1;
             previousListOrdered = false;
        }

        markdownOutput += blockMarkdown;
        previousBlockType = block.type;
    });

    return markdownOutput.trim(); 
}; 