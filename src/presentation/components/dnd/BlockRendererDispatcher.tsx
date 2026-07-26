import React from 'react';
import type { Block, ListItemBlock, CodeBlock, ParagraphBlock, HeadingBlock, MermaidBlock, ImageBlock, BlockquoteBlock, HTMLBlock, ThematicBreakBlock, DropZoneBlock, TableBlock, BookmarkBlock } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import CustomParagraphRenderer from '../markdown/CustomParagraphRenderer';
import CustomHeadingRenderer from '../markdown/CustomHeadingRenderer';
import CustomListItemRenderer from '../markdown/CustomListItemRenderer';
import CustomCodeRenderer from '../markdown/CustomCodeRenderer';
import CustomBlockquoteRenderer from '../markdown/CustomBlockquoteRenderer';
import CustomImageRenderer from '../markdown/CustomImageRenderer';
import CustomMermaidRenderer from '../markdown/CustomMermaidRenderer';
import CustomTableRenderer from '../markdown/CustomTableRenderer';
import CustomHTMLRenderer from '../markdown/CustomHTMLRenderer';
import CustomBookmarkRenderer from '../markdown/CustomBookmarkRenderer';
import CustomThematicBreakRenderer from '../markdown/CustomThematicBreakRenderer';
import CustomDropZoneRenderer from '../markdown/CustomDropZoneRenderer';
import { CustomUnknownBlockRenderer } from '../markdown/CustomUnknownBlockRenderer';
import { getBlockModuleByType, getBlockModuleByCodeLanguage } from '@/application/logic/blockRegistry';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';

const logger = new PinoLogger();

export interface BlockRendererDispatcherProps {
  block: Block;
  listIndex?: number;
  isEditingSource?: boolean;
  setIsEditingSource?: (isEditing: boolean) => void;
}

export const BlockRendererDispatcher: React.FC<BlockRendererDispatcherProps> = ({
  block,
  listIndex,
  isEditingSource,
  setIsEditingSource,
}) => {

  let module;
  let customDataToPass: any;

  if (!isEditingSource) {
    if (block.type === 'code') {
      const codeBlock = block as CodeBlock;
      const language = codeBlock.content.language;
      if (language) {
        module = getBlockModuleByCodeLanguage(language);
        if (module) {
          if (module.parseContent) {
            try {
              customDataToPass = module.parseContent(codeBlock.content.code, block.id);
            } catch (e) {
              logger.error(`[BlockRendererDispatcher ID ${block.id}] Erreur parsing code par module "${module.type}":`, e);
              customDataToPass = (block.content as any)?.customBlockData;
            }
          } else {
            customDataToPass = (block.content as any)?.customBlockData;
          }
        }
      }
    } else {
      module = getBlockModuleByType(block.type);
      if (module) {
        if ((block.content as any)?.customBlockData) {
          customDataToPass = (block.content as any).customBlockData;
        } else if (module.parseContent) {
          try {
            customDataToPass = module.parseContent(block.content as any, block.id); 
          } catch (e) {
            logger.error(`[BlockRendererDispatcher ID ${block.id}] Erreur fallback parsing par module "${module.type}":`, e);
          }
        }
      }
    }
  }

  if (module && module.RendererComponent) {
    const Renderer = module.RendererComponent;
    
    const rendererProps: BlockRendererProps<any> = {
      block,
      customData: customDataToPass,
    };
    return <Renderer {...rendererProps} />;
  }

  switch (block.type) {
    case 'heading':
      return (
        <CustomHeadingRenderer
          block={block as HeadingBlock}
        />
      );
    case 'paragraph':
      return (
        <CustomParagraphRenderer
          block={block as ParagraphBlock}
        />
      );
    case 'listItem':
      return (
        <CustomListItemRenderer
          block={block as ListItemBlock}
          listIndex={listIndex}
        />
      );
    case 'code':
      return (
        <CustomCodeRenderer
          block={block as CodeBlock}
          listIndex={listIndex ?? 0}
          index={0}
          isEditingSource={isEditingSource}
          setIsEditingSource={setIsEditingSource}
        />
      );
    case 'mermaid':
      return (
        <CustomMermaidRenderer
          block={block as MermaidBlock}
        />
      );
    case 'image':
      return (
        <CustomImageRenderer
          block={block as ImageBlock}
        />
      );
    case 'blockquote':
      return (
        <CustomBlockquoteRenderer
          block={block as BlockquoteBlock}
        />
      );
    case 'thematicBreak':
      return (
        <CustomThematicBreakRenderer block={block as ThematicBreakBlock} />
      );
    case 'table':
      return (
        <CustomTableRenderer
          block={block as TableBlock}
        />
      );
    case 'html':
      return (
        <CustomHTMLRenderer
          block={block as HTMLBlock}
        />
      );
    case 'bookmark':
      return (
        <CustomBookmarkRenderer
          block={block as BookmarkBlock}
        />
      );
    case 'dropZone':
      return (
        <CustomDropZoneRenderer
          block={block as DropZoneBlock}
          style={{ width: '100%' }}
        />
      );
    default:
      logger.warn(`[BlockRendererDispatcher] Type de bloc inconnu ou non géré: ${(block as Block).type}`);
      return <CustomUnknownBlockRenderer block={block} />;
  }
};
