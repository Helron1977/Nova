import CustomHeadingRenderer from "../components/markdown/CustomHeadingRenderer";
import CustomParagraphRenderer from "../components/markdown/CustomParagraphRenderer";
import CustomCodeBlockRenderer from "../components/markdown/CustomCodeBlockRenderer";
import CustomMermaidRenderer from "../components/markdown/CustomMermaidRenderer";
import CustomImageRenderer from "../components/markdown/CustomImageRenderer";
import CustomBlockquoteRenderer from "../components/markdown/CustomBlockquoteRenderer";
import CustomThematicBreakRenderer from "../components/markdown/CustomThematicBreakRenderer";
import CustomTableRenderer from "../components/markdown/CustomTableRenderer";
import CustomListItemRenderer from "../components/markdown/CustomListItemRenderer";
import CustomHtmlRenderer from "../components/markdown/CustomHtmlRenderer";

// Configuration mappant les types de blocs aux composants React
export const markdownComponentsConfig = {
    heading: CustomHeadingRenderer,
    paragraph: CustomParagraphRenderer,
    listItem: CustomListItemRenderer,
    code: CustomCodeBlockRenderer,
    mermaid: CustomMermaidRenderer,
    image: CustomImageRenderer,
    blockquote: CustomBlockquoteRenderer,
    thematicBreak: CustomThematicBreakRenderer,
    table: CustomTableRenderer,
    html: CustomHtmlRenderer,
    // Ajouter d'autres types et leurs composants ici si nécessaire
}; 