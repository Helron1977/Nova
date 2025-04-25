import React, { useMemo } from 'react';
import type { TableBlock, InlineElement } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';

interface CustomTableRendererProps {
  block: TableBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
  listIndex?: number;
  index?: number;
  attributes?: Record<string, any>;
}

const CustomTableRenderer = React.forwardRef<
  HTMLTableElement,
  CustomTableRendererProps
>(({ 
  block, 
  style, 
  onUpdateBlockContent,
  listIndex,
  index,
  ...rest 
}, ref) => {
  const { align, rows } = block.content;
  const { metadata } = block;
  const indentationLevel = metadata?.indentationLevel;

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => ({
    ...style,
    marginLeft: indentationPadding
  }), [style, indentationPadding]);

  if (!rows || rows.length === 0) {
    return null; // Ne rien rendre si pas de lignes
  }

  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  const getAlignmentStyle = (columnIndex: number): React.CSSProperties => {
    const alignment = align?.[columnIndex];
    switch (alignment) {
      case 'left':
        return { textAlign: 'left' };
      case 'center':
        return { textAlign: 'center' };
      case 'right':
        return { textAlign: 'right' };
      default:
        return {};
    }
  };

  return (
    <table key={block.id} ref={ref} style={combinedStyle} {...rest}>
      <thead>
        <tr>
          {headerRow.map((cellContent: InlineElement[], index: number) => (
            <th key={index} style={getAlignmentStyle(index)}>
              {renderInlineElements(cellContent, `${block.id}-th-${index}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bodyRows.map((row: InlineElement[][], rowIndex: number) => (
          <tr key={rowIndex}>
            {row.map((cellContent: InlineElement[], cellIndex: number) => (
              <td key={cellIndex} style={getAlignmentStyle(cellIndex)}>
                {renderInlineElements(cellContent, `${block.id}-td-${rowIndex}-${cellIndex}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

CustomTableRenderer.displayName = 'CustomTableRenderer';

export default CustomTableRenderer; 