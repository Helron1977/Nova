// Importer tous les composants de rendu individuels
import CustomHeadingRenderer from '../components/markdown/CustomHeadingRenderer';
import CustomParagraphRenderer from '../components/markdown/CustomParagraphRenderer';
import CustomListItemRenderer from '../components/markdown/CustomListItemRenderer';
import CustomCodeRenderer from '../components/markdown/CustomCodeRenderer'; // Gère code et mermaid
import CustomImageRenderer from '../components/markdown/CustomImageRenderer';
import CustomBlockquoteRenderer from '../components/markdown/CustomBlockquoteRenderer';
import CustomThematicBreakRenderer from '../components/markdown/CustomThematicBreakRenderer';
import CustomTableRenderer from '../components/markdown/CustomTableRenderer';
import CustomHTMLRenderer from '../components/markdown/CustomHTMLRenderer';
import CustomListWrapper from '../components/markdown/CustomListWrapper';
import CustomMermaidRenderer from '../components/markdown/CustomMermaidRenderer';
// Le ListWrapper n'est pas directement mappé ici, il sera utilisé par le renderer principal

// Importer le type SortableBlockComponent
import type { SortableBlockComponent } from '../types/markdownRenderer.types';

// Configuration des composants
export const markdownComponentsConfig: Record<string, SortableBlockComponent> = {
  // Ajouter un cast 'as SortableBlockComponent' pour chaque composant
  heading: CustomHeadingRenderer as SortableBlockComponent,
  paragraph: CustomParagraphRenderer as SortableBlockComponent,
  code: CustomCodeRenderer as SortableBlockComponent,
  blockquote: CustomBlockquoteRenderer as SortableBlockComponent,
  thematicBreak: CustomThematicBreakRenderer as SortableBlockComponent,
  html: CustomHTMLRenderer as SortableBlockComponent,
  image: CustomImageRenderer as SortableBlockComponent,
  mermaid: CustomMermaidRenderer as SortableBlockComponent,
  table: CustomTableRenderer as SortableBlockComponent,
  listItem: CustomListItemRenderer as SortableBlockComponent,
  // Ajoutez d'autres types de blocs ici si nécessaire
}; 