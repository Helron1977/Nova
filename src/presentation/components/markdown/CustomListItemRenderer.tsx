import React, { useState, useCallback, useEffect } from 'react';
import { type ListItemBlock, type InlineElement, type TextInline, markdownToBlocks } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { CoreBlockEditor } from '@/presentation/components/editor/CoreBlockEditor';


import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomListItemRendererProps {
  block: ListItemBlock;
  listIndex?: number;
}

const getRawTextFromChildren = (children: InlineElement[] | undefined): string => {
  if (!Array.isArray(children)) return '';
  return children.map(child => {
    switch (child?.type) {
      case 'text':
        return (child as TextInline).rawMarkdown || (child as TextInline).value || '';
      case 'strong':
        return `**${getRawTextFromChildren(child.children)}**`;
      case 'emphasis':
        return `*${getRawTextFromChildren(child.children)}*`;
      case 'delete':
        return `~~${getRawTextFromChildren(child.children)}~~`;
      case 'link':
        return `[${getRawTextFromChildren(child.children)}](${(child as any).url})`;
      case 'inlineCode':
        return `\`${(child as any).value}\``;
      case 'html':
        return (child as any).value || '';
      default:
        return '';
    }
  }).join('');
};

const CustomListItemRenderer: React.FC<CustomListItemRendererProps> = ({ block, listIndex }) => {
  const { activeBlockId, setActiveBlockId, updateBlock } = useEditorCommands();
  const isEditing = activeBlockId === block.id;

  const { id, content: { children }, metadata } = block;
  const { checked, ordered, depth } = metadata;

  const [clickCoords, setClickCoords] = useState<{ x: number, y: number } | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    setClickCoords({ x: e.clientX, y: e.clientY });
    setActiveBlockId(id);
  };

  const handleSave = useCallback((newMarkdown: string) => {
    const newBlocks = markdownToBlocks(newMarkdown);
    updateBlock(id, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
    setActiveBlockId(null);
  }, [updateBlock, id, block, setActiveBlockId]);

  const handleCancel = useCallback(() => {
    setActiveBlockId(null);
  }, [setActiveBlockId]);

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const newCheckedState = event.target.checked;
    const rawMarkdown = children && children.length > 0
      ? children.map(child => (child as any).rawMarkdown || (child as any).value || '').join('')
      : '';
    const indentation = '  '.repeat(block.metadata.depth || 0); 
    const markerStr = block.metadata.ordered ? '1. ' : '- ';
    const newCheckboxMarker = newCheckedState ? '[x] ' : '[ ] ';
    const newFullRawText = `${indentation}${markerStr}${newCheckboxMarker}${rawMarkdown}`;
    
    const newBlocks = markdownToBlocks(newFullRawText);
    updateBlock(id, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
  };

  useEffect(() => {
    if (metadata?.isNewBlock && !isEditing) {
      setActiveBlockId(id);
      const updatedMetadata = { ...metadata };
      delete updatedMetadata.isNewBlock;
      updateBlock(id, block, { type: 'UPDATE_METADATA', metadata: updatedMetadata });
    }
  }, [metadata?.isNewisEditing, setActiveBlockId, id, updateBlock, block]);

  if (isEditing) {
    const fallbackRawText = children && children.length > 0 ? getRawTextFromChildren(children) : '';
    const indentationStr = '  '.repeat(depth || 0);
    const markerStr = ordered ? '1. ' : '- ';
    const checkboxStr = checked === true ? '[x] ' : (checked === false ? '[ ] ' : '');
    const computedInitialContent = block.rawMarkdown || `${indentationStr}${markerStr}${checkboxStr}${fallbackRawText}`;

    return (
      <div key={`${id}-editor`} className="editing-list-item" style={{ paddingLeft: `${(depth || 0) * 1.5}rem` }}>
        <CoreBlockEditor
          blockId={id}
          initialContent={computedInitialContent}
          onSave={handleSave}
          onCancel={handleCancel}
          languageMode="markdown"
          enableInlineFormatting={true}
          autoFocus={true}
          singleLine={true}
          initialClickCoords={clickCoords}
        />
      </div>
    );
  }

  let marker = '•';
  if (ordered) {
    if (listIndex !== undefined) {
      if (depth === 0) {
        marker = `${listIndex + 1}.`;
      } else if (depth === 1) {
        marker = `${String.fromCharCode(97 + listIndex)}.`;
      } else {
        const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
        marker = `${romanNumerals[listIndex] || listIndex + 1}.`;
      }
    } else {
      marker = '1.';
    }
  }

  const renderedChildren = renderInlineElements(children, block.id);
  let contentWithMarker;

  let checkboxElement: React.ReactNode = null;
  if (checked === true || checked === false) {
    checkboxElement = (
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()}
        className="mr-2 align-middle cursor-pointer mt-1"
      />
    );
  }

  let mainContent = renderedChildren;
  if (checked === true) {
    mainContent = <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{renderedChildren}</span>;
  }

  contentWithMarker = (
    <div className="flex items-center">
      {!checkboxElement && <span className="mr-2 list-marker">{marker}</span>}
      {checkboxElement}
      <div 
        className="list-item-main-content flex-1 cursor-text"
        onClick={handleClick}
        title="Cliquez pour modifier"
      >
        {mainContent}
      </div>
    </div>
  );

  return (
    <div 
      key={id}
      className="list-item-content"
      style={{ paddingLeft: `${(depth || 0) * 1.5}rem` }}
    >
      {contentWithMarker}
    </div>
  );
};

export default React.memo(CustomListItemRenderer);