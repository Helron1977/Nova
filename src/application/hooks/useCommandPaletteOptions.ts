import { useMemo } from 'react';
import type { Block } from '@/application/logic/markdownParser';
import type { CommandOption } from '@/presentation/components/common/CommandPalette';
import { createBlockFromAction } from '@/application/logic/blockFactory';
import { getBlockModules } from '@/application/logic/blockRegistry';
import { 
  Pilcrow, Heading1, Heading2, SquareCode, GitGraph, ImageIcon, 
  Quote, Codepen, Minus, UploadCloud, Bot, Table as TableIcon, ListTree, BookOpen 
} from 'lucide-react';

interface UseCommandPaletteOptionsProps {
  blocks: Block[];
  paletteContextBlockId: string | null;
  onAddBlockAfter: (data: { afterId: string; newBlock: Block }) => void;
  onAddDropZoneBlockAfter: (data: { afterId: string }) => void;
  handleAddSummaryBlock: () => void;
}

export const useCommandPaletteOptions = ({
  blocks,
  paletteContextBlockId,
  onAddBlockAfter,
  onAddDropZoneBlockAfter,
  handleAddSummaryBlock
}: UseCommandPaletteOptionsProps): CommandOption[] => {
  return useMemo(() => {
    const getTargetId = () => {
      if (paletteContextBlockId) return paletteContextBlockId;
      return blocks.length > 0 ? blocks[blocks.length - 1].id : '';
    };

    const appendBlock = (actionKey: string) => {
      const targetId = getTargetId();
      const newBlock = createBlockFromAction(actionKey, 0);
      if (newBlock) {
        onAddBlockAfter({ afterId: targetId, newBlock });
        setTimeout(() => window.dispatchEvent(new CustomEvent('nova-set-active-block', { detail: newBlock.id })), 50);
      }
    };

    const baseOptions: CommandOption[] = [
      { id: 'paragraph', label: 'Paragraphe', keyword: 'texte paragraphe', Icon: Pilcrow, action: () => appendBlock('paragraph') },
      { id: 'heading1', label: 'Titre 1', keyword: 'h1 titre grand', Icon: Heading1, action: () => appendBlock('heading1') },
      { id: 'heading2', label: 'Titre 2', keyword: 'h2 titre moyen', Icon: Heading2, action: () => appendBlock('heading2') },
      { id: 'code', label: 'Bloc de code', keyword: 'code javascript typescript python', Icon: SquareCode, action: () => appendBlock('code') },
      { id: 'mermaid', label: 'Diagramme Mermaid', keyword: 'mermaid graph diagram', Icon: GitGraph, action: () => appendBlock('mermaid') },
      { id: 'image', label: 'Image', keyword: 'image img photo', Icon: ImageIcon, action: () => appendBlock('image') },
      { id: 'blockquote', label: 'Citation', keyword: 'quote citation blockquote', Icon: Quote, action: () => appendBlock('blockquote') },
      { id: 'table', label: 'Tableau (CSV)', keyword: 'table tableau csv', Icon: TableIcon, action: () => appendBlock('table') },
      { id: 'html', label: 'Bloc HTML', keyword: 'html web div', Icon: Codepen, action: () => appendBlock('html') },
      { id: 'thematicBreak', label: 'Ligne de séparation', keyword: 'hr ligne diviseur', Icon: Minus, action: () => appendBlock('thematicBreak') },
      { id: 'dropzone', label: 'Zone de Dépôt', keyword: 'dropzone upload fichier', Icon: UploadCloud, action: () => {
        onAddDropZoneBlockAfter({ afterId: getTargetId() });
      }},
      { id: 'toc', label: 'Sommaire (Table des matières)', keyword: 'toc sommaire table index', Icon: ListTree, action: () => {
        handleAddSummaryBlock();
      }},
      { id: 'ai', label: 'Demander à l\'IA', keyword: 'ia ai prompt agent', Icon: Bot, action: () => {
         const aiInput = document.getElementById('nova-agent-input');
         if (aiInput) aiInput.focus();
      }},
      { id: 'help', label: 'Aide : Syntaxe des blocs (DSL)', keyword: 'aide help dsl syntax doc documentation', Icon: BookOpen, action: () => {
         window.dispatchEvent(new CustomEvent('nova-open-dsl-help'));
      }}
    ];

    const dynamicOptions: CommandOption[] = getBlockModules()
      .filter(m => m.paletteLabel && m.paletteKeyword)
      .map(m => ({
        id: m.type,
        label: m.paletteLabel!,
        keyword: m.paletteKeyword!,
        Icon: (m.menuIcon || m.icon) as any,
        action: () => appendBlock(`module_${m.codeBlockLanguage || m.type}`)
      }));

    return [...baseOptions, ...dynamicOptions];
  }, [blocks, paletteContextBlockId, onAddBlockAfter, onAddDropZoneBlockAfter, handleAddSummaryBlock]);
};
