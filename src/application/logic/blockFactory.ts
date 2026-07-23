import { v4 as uuidv4 } from 'uuid';
import type { Block, ParagraphBlock, HeadingBlock, CodeBlock, MermaidBlock, ImageBlock, BlockquoteBlock, HTMLBlock, ThematicBreakBlock, PaletteBlock, TextInline } from '@/application/logic/markdownParser';
import type { PaletteBlockData } from '@/application/modules/palette/paletteModule';
import { getBlockModules } from '@/application/logic/blockRegistry';
import type { BlockModule } from '@/application/interfaces/blockModule';

const createTextInline = (text: string): TextInline => ({ type: 'text', value: text });

export const createBlockFromAction = (actionKey: string, initialIndentationLevel: number = 0): Block | null => {
  const newId = uuidv4();
  
  const moduleActionMatch = actionKey.match(/^module_(.*)$/);
  if (moduleActionMatch && moduleActionMatch[1]) {
    const moduleCodeLanguage = moduleActionMatch[1];
    const targetModule = getBlockModules().find((m: BlockModule<any>) => m.codeBlockLanguage === moduleCodeLanguage);
    if (targetModule) {
      let rawContentForCodeBlock = targetModule.defaultRawContent || '';
      let initialCustomDataForBlock: any = {};

      if (targetModule.createDefaultCustomData) {
        initialCustomDataForBlock = targetModule.createDefaultCustomData();
        if (initialCustomDataForBlock && typeof (initialCustomDataForBlock as PaletteBlockData)?.rawSource === 'string') {
            rawContentForCodeBlock = (initialCustomDataForBlock as PaletteBlockData).rawSource;
        } else if (targetModule.serializeContent) {
            rawContentForCodeBlock = targetModule.serializeContent(initialCustomDataForBlock);
        }
      } else if (targetModule.parseContent) {
        initialCustomDataForBlock = targetModule.parseContent(rawContentForCodeBlock, newId);
      }
      
      return {
        id: newId, 
        type: 'code',
        content: { 
          code: rawContentForCodeBlock,
          language: targetModule.codeBlockLanguage,
          customBlockData: initialCustomDataForBlock,
        }, 
        metadata: { 
          indentationLevel: initialIndentationLevel,
          customBlockType: targetModule.type,
          originalLanguage: targetModule.codeBlockLanguage,
        } 
      } as CodeBlock;
    }
    return null;
  }

  switch (actionKey) {
    case 'paragraph':
      return { id: newId, type: 'paragraph', content: { children: [createTextInline('')] }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as ParagraphBlock;
    case 'heading1':
      return { id: newId, type: 'heading', content: { level: 1, children: [createTextInline('Titre 1')] }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as HeadingBlock;
    case 'heading2':
      return { id: newId, type: 'heading', content: { level: 2, children: [createTextInline('Titre 2')] }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as HeadingBlock;
    case 'code':
      return { id: newId, type: 'code', content: { code: '', language: 'plaintext' }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as CodeBlock;
    case 'mermaid':
      return { id: newId, type: 'mermaid', content: { code: 'graph TD;\n  A-->B;' }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as MermaidBlock;
    case 'image':
      return { id: newId, type: 'image', content: { url: '', alt: '' }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as ImageBlock;
    case 'blockquote':
      return { id: newId, type: 'blockquote', content: { children: [createTextInline('')] }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as BlockquoteBlock;
    case 'table':
      return {
        id: newId,
        type: 'code',
        content: { code: 'Entête 1,Entête 2,Entête 3\nCellule 1A,Cellule 1B,Cellule 1C\nCellule 2A,Cellule 2B,Cellule 2C', language: 'csv' },
        metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true }
      } as CodeBlock;
    case 'html':
      return { id: newId, type: 'html', content: { html: '<div>Votre HTML ici</div>' }, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as HTMLBlock;
    case 'thematicBreak':
      return { id: newId, type: 'thematicBreak', content: {}, metadata: { indentationLevel: initialIndentationLevel, isNewBlock: true } } as ThematicBreakBlock;
    case 'palette':
      return { 
        id: newId, 
        type: 'paletteBlock', 
        content: { language: 'palette', code: '--fallback-color: #FF0000;\n--fallback-deux: #00FF00;', customBlockData: { colors: [{name: 'Fallback', hex:'#FF0000'}], rawSource: '--fallback-color: #FF0000;\n--fallback-deux: #00FF00;' } }, 
        metadata: { indentationLevel: initialIndentationLevel, customBlockType: 'paletteBlock', originalLanguage: 'palette', isNewBlock: true } 
      } as PaletteBlock;
    default:
      return null;
  }
};
