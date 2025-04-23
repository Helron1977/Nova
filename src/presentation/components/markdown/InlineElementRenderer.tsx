import React, { Fragment } from 'react';
import DOMPurify from 'dompurify';
import type { InlineElement, LinkInline, InlineCodeElement, DeleteInline } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

// Instancier le logger
const logger = new PinoLogger();

// Les type guards ne sont plus nécessaires ici

export const renderInlineElements = (elements: InlineElement[] | undefined, parentKey: string = 'inline'): React.ReactNode => {
  if (!elements) {
    return null;
  }

  return elements.map((element, index) => {
    const key = `${parentKey}-${element.type}-${index}`;

    switch (element.type) {
      case 'strong':
        return <strong key={key}>{renderInlineElements(element.children, key)}</strong>;
      case 'emphasis':
        return <em key={key}>{renderInlineElements(element.children, key)}</em>;
      case 'html':
        // Nettoyer le HTML avant de l'insérer
        const cleanHTML = DOMPurify.sanitize(element.value);
        // Utiliser le HTML nettoyé
        return <span key={key} dangerouslySetInnerHTML={{ __html: cleanHTML }} />;
      case 'text':
        return <Fragment key={key}>{element.value}</Fragment>;
      case 'link':
        // Rendre une balise <a>
        // TypeScript sait que element est LinkInline ici
        const linkElement = element as LinkInline;
        return (
            <a 
                key={key} 
                href={linkElement.url} 
                title={linkElement.title || undefined} // N'ajouter title que s'il existe
                target="_blank" // Ouvrir dans un nouvel onglet par défaut
                rel="noopener noreferrer" // Pour la sécurité
            >
                {/* Rendre les enfants (le texte du lien) récursivement */}
                {renderInlineElements(linkElement.children, key)}
            </a>
        );
      
      case 'inlineCode':
        // Rendre une balise <code>
        // TypeScript sait que element est InlineCodeElement ici
        return <code key={key}>{(element as InlineCodeElement).value}</code>; 

      case 'delete': // Gérer strikethrough
        // Rendre une balise <del> (ou <s>)
        // TypeScript sait que element est DeleteInline ici
        return <del key={key}>{renderInlineElements((element as DeleteInline).children, key)}</del>;

      default:
        // Vérifier si le type est connu mais non géré explicitement ici
        //const exhaustiveCheck: never = element;
        logger.warn(`[renderInlineElements] Unhandled inline element type: ${(element as any)?.type}`, { element });

        // Tentative de fallback générique si possible
        if ('value' in element && typeof (element as any).value === 'string') {
            return <Fragment key={key}>{(element as any).value}</Fragment>;
        } else if ('children' in element && Array.isArray((element as any).children)) {
             return <Fragment key={key}>{renderInlineElements((element as any).children as InlineElement[], key)}</Fragment>;
        }
        return null; // Ne rien rendre pour ce type inconnu
    }
  });
};

// Optionnellement, un composant wrapper si vous préférez
/*
interface InlineRendererProps {
    elements: InlineElement[];
    parentKey?: string;
}

export const InlineRenderer: React.FC<InlineRendererProps> = ({ elements, parentKey }) => {
    return <>{renderInlineElements(elements, parentKey)}</>;
};
*/ 